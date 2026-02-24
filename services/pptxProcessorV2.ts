import JSZip from 'jszip';
import { translateBatchStrings, translateImageContent } from './geminiService';
import { SupportedLanguage, GlossaryItem } from '../types';
import { maskBatchTexts, unmaskText } from './textProtector';
import {
  extractShapesFromSlide,
  extractTablesFromSlide,
  reconstructParagraph,
  ParsedParagraph,
  ParsedShape,
  ParsedTable,
} from './pptxStructureParser';
import { autoAdjustShape } from './pptxShapeAdjuster';

/**
 * PPTX Processor V2 - Advanced Structure-Aware Translation
 * 
 * Improvements over V1:
 * - Paragraph-level translation (maintains context)
 * - Line break preservation
 * - Table row-aware translation
 * - Hyperlink preservation
 * - Date field skipping
 * - Vietnamese spacing fix (xml:space="preserve")
 * - Auto-shape sizing to prevent overflow
 */

interface TranslationTask {
  type: 'paragraph' | 'table-row';
  originalText: string;
  paragraph?: ParsedParagraph;
  tableCells?: ParsedParagraph[];
  shape?: ParsedShape; // Track shape for auto-sizing
  filePath: string;
}

export const processPptxV2 = async (
  file: File,
  targetLang: SupportedLanguage,
  context: string,
  glossary: GlossaryItem[],
  onProgress: (msg: string, percent: number) => void,
  isTranslateImages: boolean = true
): Promise<Blob> => {
  onProgress('Unzipping PowerPoint...', 5);
  const zip = new JSZip();
  const content = await file.arrayBuffer();
  const loadedZip = await zip.loadAsync(content);

  // XML files to process
  const xmlFiles = Object.keys(loadedZip.files).filter(path => 
    (path.startsWith('ppt/slides/slide') || 
     path.startsWith('ppt/notesSlides/notesSlide') ||
     path.startsWith('ppt/slideMasters/slideMaster') ||
     path.startsWith('ppt/slideLayouts/slideLayout')) && 
    path.endsWith('.xml')
  );

  onProgress(`Analyzing ${xmlFiles.length} slides...`, 10);

  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  
  // URL/Link protection patterns
  const urlBlacklist = [
    { id: 'url-http', term: 'http://', caseSensitive: false, enabled: true },
    { id: 'url-https', term: 'https://', caseSensitive: false, enabled: true },
    { id: 'url-www', term: 'www.', caseSensitive: false, enabled: true },
    { id: 'email', term: '@', caseSensitive: false, enabled: true },
  ];

  const translationTasks: TranslationTask[] = [];
  const documents: { path: string; doc: Document }[] = [];

  // Step 1: Parse structure and collect translation tasks
  for (const path of xmlFiles) {
    const xml = await loadedZip.file(path)?.async('string');
    if (!xml) continue;
    
    const doc = parser.parseFromString(xml, 'application/xml');
    documents.push({ path, doc });
    
    // Extract shapes and their paragraphs
    const shapes = extractShapesFromSlide(doc);
    for (const shape of shapes) {
      for (const paragraph of shape.paragraphs) {
        if (paragraph.fullText.trim()) {
          translationTasks.push({
            type: 'paragraph',
            originalText: paragraph.fullText,
            paragraph,
            shape, // Track shape reference
            filePath: path,
          });
        }
      }
    }
    
    // Extract tables
    const tables = extractTablesFromSlide(doc);
    for (const table of tables) {
      // Translate table by rows for better context
      for (const row of table.rows) {
        const rowText = row.map(cell => cell.fullText).join(' | ');
        if (rowText.trim()) {
          const rowParagraphs = row.flatMap(cell => cell.paragraphs);
          translationTasks.push({
            type: 'table-row',
            originalText: rowText,
            tableCells: rowParagraphs,
            filePath: path,
          });
        }
      }
    }
  }

  onProgress(`Found ${translationTasks.length} text segments to translate...`, 15);

  // Step 2: Add xml:space="preserve" to all text elements
  for (const { doc } of documents) {
    const textElements = Array.from(doc.getElementsByTagNameNS('*', 't'));
    textElements.forEach(el => {
      el.setAttribute('xml:space', 'preserve');
    });
  }

  // Step 3: Translate with URL protection
  if (translationTasks.length > 0) {
    const originalTexts = translationTasks.map(task => task.originalText);
    
    // Mask URLs
    const { maskedTexts, protectionMap } = maskBatchTexts(originalTexts, urlBlacklist);
    
    // Translate in batches
    const BATCH_SIZE = 50;
    const translatedMasked: string[] = [];
    
    for (let i = 0; i < maskedTexts.length; i += BATCH_SIZE) {
      const chunk = maskedTexts.slice(i, i + BATCH_SIZE);
      const progress = 20 + Math.floor((i / maskedTexts.length) * 60);
      
      onProgress(
        `Translating segment ${i + 1}-${Math.min(i + BATCH_SIZE, maskedTexts.length)}/${maskedTexts.length}...`,
        progress
      );
      
      const translated = await translateBatchStrings(chunk, targetLang, context, glossary);
      translatedMasked.push(...translated);
    }
    
    // Unmask URLs
    const finalTranslated = translatedMasked.map(text => unmaskText(text, protectionMap));
    
    // Step 4: Apply translations back to structure and auto-adjust shapes
    onProgress('Reconstructing document structure...', 85);
    
    let shapesAdjusted = 0;
    
    translationTasks.forEach((task, idx) => {
      const translatedText = finalTranslated[idx];
      if (!translatedText) return;
      
      if (task.type === 'paragraph' && task.paragraph) {
        reconstructParagraph(task.paragraph, translatedText);
        
        // Auto-adjust shape if text expanded significantly
        if (task.shape) {
          const result = autoAdjustShape(task.shape, task.originalText, translatedText);
          if (result.heightAdjusted || result.widthAdjusted) {
            shapesAdjusted++;
          }
        }
      } else if (task.type === 'table-row' && task.tableCells) {
        // Split translated row back into cells
        const cellTexts = translatedText.split('|').map(t => t.trim());
        task.tableCells.forEach((paragraph, cellIdx) => {
          if (cellTexts[cellIdx]) {
            reconstructParagraph(paragraph, cellTexts[cellIdx]);
          }
        });
      }
    });
    
    if (shapesAdjusted > 0) {
      onProgress(`Auto-adjusted ${shapesAdjusted} shapes to prevent overflow...`, 87);
    }
  }

  // Step 5: Serialize updated XML back to ZIP
  onProgress('Updating slide files...', 90);
  for (const { path, doc } of documents) {
    const updatedXml = serializer.serializeToString(doc);
    loadedZip.file(path, updatedXml);
  }

  // Step 6: Translate images
  if (isTranslateImages) {
    const mediaFiles = Object.keys(loadedZip.files).filter(path => 
      path.startsWith('ppt/media/') && /\.(png|jpe?g)$/i.test(path)
    );

    if (mediaFiles.length > 0) {
      onProgress(`Translating ${mediaFiles.length} embedded images...`, 92);
      for (let i = 0; i < mediaFiles.length; i++) {
        const path = mediaFiles[i];
        const progress = 92 + Math.floor((i / mediaFiles.length) * 6);
        onProgress(`Processing image ${i + 1}/${mediaFiles.length}...`, progress);
        
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
          console.error('Failed to translate image:', path, e);
        }
      }
    }
  }

  onProgress('Generating final file...', 98);
  const blob = await loadedZip.generateAsync({ type: 'blob' });
  onProgress('Done', 100);
  return blob;
};
