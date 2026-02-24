import JSZip from 'jszip';
import { translateBatchStrings, translateImageContent } from './geminiService';
import { SupportedLanguage, GlossaryItem } from '../types';
import { maskBatchTexts, unmaskText, ProtectionMap } from './textProtector';

/**
 * Xử lý file PPTX: Dịch text (bao gồm Table) và dịch Ảnh.
 * 
 * Phase 1 Improvements:
 * - URL/Hyperlink preservation using textProtector
 * - Vietnamese spacing fix via xml:space="preserve"
 * - Date field detection to skip translation
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
    isDateField: boolean; // Flag for date/time fields
  }
  const textNodes: TextNodeRef[] = [];

  // URL/Link protection patterns
  const urlBlacklist = [
    { id: 'url-http', term: 'http://', caseSensitive: false, enabled: true },
    { id: 'url-https', term: 'https://', caseSensitive: false, enabled: true },
    { id: 'url-www', term: 'www.', caseSensitive: false, enabled: true },
    { id: 'email', term: '@', caseSensitive: false, enabled: true },
  ];

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
        // Check if this is a date/time field (inside <a:fld> tag)
        const parent = el.parentElement;
        const isDateField = parent?.nodeName?.includes('fld') || 
                           parent?.parentElement?.nodeName?.includes('fld') ||
                           false;
        
        textNodes.push({ filePath: path, element: el, text: val, isDateField });
        
        // Add xml:space="preserve" to prevent space normalization (Vietnamese spacing fix)
        el.setAttribute('xml:space', 'preserve');
      }
    });
  }

  // 2. Dịch Text theo Batch (với URL protection và date field skipping)
  if (textNodes.length > 0) {
    // Separate date fields from regular text
    const regularNodes = textNodes.filter(n => !n.isDateField);
    const dateFieldNodes = textNodes.filter(n => n.isDateField);
    
    if (dateFieldNodes.length > 0) {
      onProgress(`Skipping ${dateFieldNodes.length} date/time fields...`, 18);
    }

    if (regularNodes.length > 0) {
      // Extract original texts
      const originalTexts = regularNodes.map(n => n.text);
      
      // Mask URLs and sensitive patterns
      const { maskedTexts, protectionMap } = maskBatchTexts(originalTexts, urlBlacklist);
      
      const BATCH_SIZE = 50;
      const translatedMasked: string[] = [];
      
      for (let i = 0; i < maskedTexts.length; i += BATCH_SIZE) {
        const chunk = maskedTexts.slice(i, i + BATCH_SIZE);
        const startIndex = i;
        const endIndex = Math.min(i + BATCH_SIZE, maskedTexts.length);
        
        onProgress(
          `Translating text ${startIndex + 1}-${endIndex}/${maskedTexts.length}...`, 
          20 + Math.floor((i / maskedTexts.length) * 50)
        );
        
        const translated = await translateBatchStrings(chunk, targetLang, context, glossary);
        translatedMasked.push(...translated);
      }
      
      // Unmask URLs in translated texts
      const finalTranslated = translatedMasked.map(text => unmaskText(text, protectionMap));
      
      // Update text nodes with translated content
      regularNodes.forEach((node, idx) => {
        if (finalTranslated[idx]) {
          node.element.textContent = finalTranslated[idx];
        }
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