import { translateText, translateBatchStrings, extractTextFromImage, extractTextFromBase64, detectLanguage } from './geminiService';
import { SupportedLanguage, GlossaryItem, BlacklistItem } from '../types';
import { extractShapeTexts, replaceShapeTexts } from './excelShapeExtractor';

/**
 * Process Excel file with full shape/drawing support using ZIP manipulation
 * This replaces the ExcelJS processor for better shape handling
 */
export const processExcelWithShapes = async (
  arrayBuffer: ArrayBuffer,
  targetLang: SupportedLanguage,
  selectedSheets: string[],
  context: string,
  glossary: GlossaryItem[],
  onProgress: (msg: string, percent: number) => void,
  skipAlreadyTranslated: boolean = true,
  sourceLang: string = 'auto',
  blacklist: BlacklistItem[] = []
): Promise<Blob> => {
  onProgress('Loading Excel file with shape support...', 5);
  
  // STEP 1: Extract shape texts from XLSX ZIP structure
  onProgress('Extracting shape texts from drawings...', 8);
  const shapeTexts = await extractShapeTexts(arrayBuffer);
  console.log(`🎨 Extracted ${shapeTexts.length} shape texts for translation`);
  
  // Dynamic import to ensure Buffer polyfill loads first
  const XlsxPopulate = (await import('xlsx-populate')).default;
  
  // Load workbook with xlsx-populate
  const workbook = await XlsxPopulate.fromDataAsync(arrayBuffer);
  
  // Get all sheets
  const allSheets = workbook.sheets();
  const sheetsToProcess = allSheets.filter(sheet => selectedSheets.includes(sheet.name()));
  
  if (sheetsToProcess.length === 0) {
    throw new Error('No sheets selected for processing');
  }

  onProgress('Analyzing cells and shapes...', 10);
  
  interface TranslatableItem {
    sheetName: string;
    type: 'cell' | 'shape';
    cellAddress?: string;
    shapeId?: string;
    val: string;
  }

  const allItems: TranslatableItem[] = [];
  const totalSheets = sheetsToProcess.length;

  // 1. Collect translatable content from cells and shapes
  for (let sheetIndex = 0; sheetIndex < sheetsToProcess.length; sheetIndex++) {
    const sheet = sheetsToProcess[sheetIndex];
    const sheetName = sheet.name();
    
    onProgress(`Analyzing sheet ${sheetIndex + 1}/${totalSheets}: "${sheetName}"...`, 10 + Math.floor((sheetIndex / totalSheets) * 5));

    // Process cells
    const usedRange = sheet.usedRange();
    if (usedRange) {
      const rows = usedRange.value();
      
      if (Array.isArray(rows)) {
        rows.forEach((row, rowIdx) => {
          if (Array.isArray(row)) {
            row.forEach((cellValue, colIdx) => {
              if (cellValue && typeof cellValue === 'string' && cellValue.trim().length > 0 && !cellValue.startsWith('=')) {
                // Smart language detection
                if (skipAlreadyTranslated) {
                  const detectedLang = detectLanguage(cellValue);
                  const targetLangCode = targetLang.toLowerCase().substring(0, 2);
                  
                  if (detectedLang === targetLangCode) {
                    return; // Skip already translated
                  }
                }
                
                // Convert row/col index to cell address (e.g., A1, B2)
                const cellAddress = sheet.cell(rowIdx + usedRange.startCell().rowNumber(), 
                                               colIdx + usedRange.startCell().columnNumber()).address();
                
                allItems.push({
                  sheetName,
                  type: 'cell',
                  cellAddress,
                  val: cellValue
                });
              }
            });
          }
        });
      }
    }

    // Add shape texts from ZIP extraction (replaces the old sheet.shapes() logic)
    // Small delay between sheets
    if (sheetIndex < sheetsToProcess.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  // 2. Add extracted shape texts to translation queue
  onProgress('Processing extracted shape texts...', 15);
  shapeTexts.forEach((shapeText, idx) => {
    // Smart language detection for shapes
    if (skipAlreadyTranslated) {
      const detectedLang = detectLanguage(shapeText.originalText);
      const targetLangCode = targetLang.toLowerCase().substring(0, 2);
      
      if (detectedLang === targetLangCode) {
        return; // Skip already translated
      }
    }
    
    allItems.push({
      sheetName: 'drawings', // Special marker for shapes
      type: 'shape',
      shapeId: `${shapeText.drawingPath}_${shapeText.shapeIndex}`,
      val: shapeText.originalText
    });
  });

  const totalItems = allItems.length;
  
  // Collection for shape translations (applied later via ZIP manipulation)
  const shapeTranslations = new Map<string, string>();
  
  // 3. Translate all content in batches
  if (totalItems > 0) {
    const startPercent = 20;
    const endPercent = 85;
    const progressRange = endPercent - startPercent;

    const BATCH_SIZE = selectedSheets.length > 20 ? 20 : 40;
    const totalBatches = Math.ceil(totalItems / BATCH_SIZE);
    
    onProgress(`Translating ${totalItems} items (cells + shapes) in ${totalBatches} batches...`, startPercent);
    
    for (let i = 0; i < totalItems; i += BATCH_SIZE) {
      const batchItems = allItems.slice(i, i + BATCH_SIZE);
      const batchTexts = batchItems.map(item => item.val);
      const currentBatchNumber = Math.floor(i / BATCH_SIZE) + 1;

      const progressFraction = i / totalItems;
      const currentPercent = Math.round(startPercent + (progressFraction * progressRange));
      
      onProgress(`Translating batch ${currentBatchNumber}/${totalBatches}...`, currentPercent);

      const translatedTexts = await translateBatchStrings(batchTexts, targetLang, context, glossary, sourceLang, blacklist);

      // Apply translations back to cells (NOT shapes - shapes handled separately)
      batchItems.forEach((item, idx) => {
        const translatedText = translatedTexts[idx];
        if (!translatedText) return;

        try {
          if (item.type === 'cell' && item.cellAddress) {
            // Update cell value
            const sheet = workbook.sheet(item.sheetName);
            if (sheet) {
              const cell = sheet.cell(item.cellAddress);
              cell.value(translatedText);
            }
          } else if (item.type === 'shape') {
            // Collect shape translations for ZIP manipulation
            shapeTranslations.set(item.val, translatedText);
          }
        } catch (applyErr) {
          console.error(`Failed to apply translation for ${item.type}:`, applyErr);
        }
      });
      
      // Small delay between batches for large files
      if (i + BATCH_SIZE < totalItems && selectedSheets.length > 10) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }

  // 3. Handle embedded images (OCR translation)
  onProgress('Processing embedded images...', 85);
  
  // Note: xlsx-populate doesn't have native image extraction API like ExcelJS
  // For now, we skip image OCR in xlsx-populate processor
  // Alternative: Use ExcelJS in parallel just for images, or extract from XML directly
  console.warn('Image OCR not yet implemented in xlsx-populate processor');

  // 4. Translate sheet names
  if (selectedSheets.length > 0) {
    onProgress('Translating sheet names...', 90);
    try {
      const sheetsToTranslate: string[] = [];
      const sheetObjects: any[] = [];
      
      sheetsToProcess.forEach((sheet) => {
        const sheetName = sheet.name();
        if (skipAlreadyTranslated) {
          const detectedLang = detectLanguage(sheetName);
          const targetLangCode = targetLang.toLowerCase().substring(0, 2);
          
          if (detectedLang !== targetLangCode) {
            sheetsToTranslate.push(sheetName);
            sheetObjects.push(sheet);
          }
        } else {
          sheetsToTranslate.push(sheetName);
          sheetObjects.push(sheet);
        }
      });
      
      if (sheetsToTranslate.length > 0) {
        onProgress(`Translating ${sheetsToTranslate.length} sheet names...`, 92);
        const translatedNames = await translateBatchStrings(sheetsToTranslate, targetLang, context, glossary, sourceLang, blacklist);
        
        translatedNames.forEach((newName, idx) => {
          const oldName = sheetsToTranslate[idx];
          const sheet = sheetObjects[idx];
          
          if (newName && newName !== oldName) {
            // Clean invalid characters and limit length
            let cleanName = newName.replace(/[\[\]\*\/\\\?:]/g, '').substring(0, 31).trim();
            
            // Avoid duplicate names
            if (cleanName && !workbook.sheet(cleanName)) {
              try {
                sheet.name(cleanName);
                console.log(`✓ Renamed sheet: "${oldName}" → "${cleanName}"`);
              } catch (err) {
                console.error(`Failed to rename sheet "${oldName}":`, err);
              }
            }
          }
        });
      }
    } catch (e) {
      console.error("Sheet name translation failed", e);
    }
  }

  // 5. Apply shape translations via ZIP manipulation
  let finalBuffer = await workbook.outputAsync();
  
  if (shapeTranslations.size > 0) {
    onProgress(`Applying ${shapeTranslations.size} shape translations...`, 93);
    console.log(`🎨 Applying ${shapeTranslations.size} shape translations to XLSX file...`);
    
    try {
      finalBuffer = await replaceShapeTexts(finalBuffer, shapeTranslations);
      console.log('✅ Shape translations applied successfully');
    } catch (err) {
      console.error('❌ Failed to apply shape translations:', err);
      // Continue with cell translations even if shapes fail
    }
  }

  // 6. Generate output
  onProgress('Finalizing file...', 97);
  
  onProgress('Done', 100);
  return new Blob([finalBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
};
