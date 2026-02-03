import JSZip from 'jszip';
import { translateBatchStrings, translateImageContent } from './geminiService';
import { SupportedLanguage, GlossaryItem } from '../types';

/**
 * Xử lý file PPTX: Dịch text (bao gồm Table) và dịch Ảnh.
 */
export const processPptx = async (
  file: File,
  targetLang: SupportedLanguage,
  context: string,
  glossary: GlossaryItem[],
  onProgress: (msg: string, percent: number) => void,
  isTranslateImages: boolean = true // Mặc định bật dịch ảnh
): Promise<Blob> => {
  onProgress('Unzipping PowerPoint...', 5);
  const zip = new JSZip();
  const content = await file.arrayBuffer();
  const loadedZip = await zip.loadAsync(content);

  // Danh sách các file XML có thể chứa text (Slides, Notes, Masters, Layouts)
  const xmlFiles = Object.keys(loadedZip.files).filter(path => 
    (path.startsWith('ppt/slides/slide') || 
     path.startsWith('ppt/notesSlides/notesSlide') ||
     path.startsWith('ppt/slideMasters/slideMaster') ||
     path.startsWith('ppt/slideLayouts/slideLayout')) && 
    path.endsWith('.xml')
  );

  onProgress(`Scanning ${xmlFiles.length} files for text and tables...`, 15);

  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  interface TextNodeRef {
    filePath: string;
    element: Element;
    text: string;
  }
  const textNodes: TextNodeRef[] = [];

  // 1. Thu thập tất cả node text (<a:t>)
  for (const path of xmlFiles) {
    const xml = await loadedZip.file(path)?.async('string');
    if (!xml) continue;
    const doc = parser.parseFromString(xml, 'application/xml');
    
    // Sử dụng namespace-agnostic query để bắt mọi thẻ 't' (a:t, p:t, v:t...)
    const elements = Array.from(doc.getElementsByTagNameNS('*', 't'));
    elements.forEach(el => {
      const val = el.textContent?.trim();
      if (val) {
        textNodes.push({ filePath: path, element: el, text: val });
      }
    });
  }

  // 2. Dịch Text theo Batch
  if (textNodes.length > 0) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < textNodes.length; i += BATCH_SIZE) {
      const chunk = textNodes.slice(i, i + BATCH_SIZE);
      onProgress(`Translating text ${i + 1}/${textNodes.length}...`, 20 + Math.floor((i / textNodes.length) * 50));
      
      const translated = await translateBatchStrings(chunk.map(n => n.text), targetLang, context, glossary);
      chunk.forEach((node, idx) => {
        if (translated[idx]) node.element.textContent = translated[idx];
      });
    }

    // Cập nhật XML vào Zip
    const uniquePaths = Array.from(new Set(textNodes.map(n => n.filePath)));
    for (const path of uniquePaths) {
      const firstNode = textNodes.find(n => n.filePath === path);
      if (firstNode) {
        const updatedXml = serializer.serializeToString(firstNode.element.ownerDocument!);
        loadedZip.file(path, updatedXml);
      }
    }
  }

  // 3. Dịch Hình ảnh (Media)
  if (isTranslateImages) {
    const mediaFiles = Object.keys(loadedZip.files).filter(path => 
      path.startsWith('ppt/media/') && /\.(png|jpe?g)$/i.test(path)
    );

    if (mediaFiles.length > 0) {
      onProgress(`Translating ${mediaFiles.length} embedded images...`, 75);
      for (let i = 0; i < mediaFiles.length; i++) {
        const path = mediaFiles[i];
        onProgress(`Processing image ${i + 1}/${mediaFiles.length}...`, 75 + Math.floor((i / mediaFiles.length) * 20));
        
        try {
          const imgBase64 = await loadedZip.file(path)?.async('base64');
          if (imgBase64) {
            const mime = path.endsWith('.png') ? 'image/png' : 'image/jpeg';
            const translatedImg = await translateImageContent(imgBase64, mime, targetLang, context);
            if (translatedImg) {
              loadedZip.file(path, translatedImg, { base64: true });
            }
          }
        } catch (e) {
          console.error("Failed image translation:", path, e);
        }
      }
    }
  }

  onProgress('Finalizing PowerPoint...', 98);
  const blob = await loadedZip.generateAsync({ type: 'blob' });
  onProgress('Done', 100);
  return blob;
};