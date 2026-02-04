
import ExcelJS from 'exceljs';
import { translateText, translateBatchStrings, extractTextFromImage, extractTextFromBase64 } from './geminiService';
import { SupportedLanguage, GlossaryItem } from '../types';
import { processPptx } from './pptxProcessor';

export { processPptx };

// --- HELPERS ---

// Helper to convert ArrayBuffer to Base64 string
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

const richTextToTaggedString = (value: ExcelJS.CellValue): string => {
  if (value && typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    return value.richText.map(part => {
      let text = part.text;
      if (part.font?.bold) text = `<b>${text}</b>`;
      if (part.font?.italic) text = `<i>${text}</i>`;
      if (part.font?.underline) text = `<u>${text}</u>`;
      if (part.font?.strike) text = `<s>${text}</s>`;
      return text;
    }).join('');
  }
  return value ? String(value) : '';
};

const taggedStringToRichText = (text: string): ExcelJS.CellRichTextValue => {
  const parts: ExcelJS.RichText[] = [];
  const tokens = text.split(/(<\/?(?:b|i|u|s)>)/g);

  let currentStyle = {
    bold: false,
    italic: false,
    underline: false,
    strike: false
  };

  tokens.forEach(token => {
    if (token === '<b>') currentStyle.bold = true;
    else if (token === '</b>') currentStyle.bold = false;
    else if (token === '<i>') currentStyle.italic = true;
    else if (token === '</i>') currentStyle.italic = false;
    else if (token === '<u>') currentStyle.underline = true;
    else if (token === '</u>') currentStyle.underline = false;
    else if (token === '<s>') currentStyle.strike = true;
    else if (token === '</s>') currentStyle.strike = false;
    else if (token !== '') {
      if (currentStyle.bold || currentStyle.italic || currentStyle.underline || currentStyle.strike) {
        parts.push({
          text: token,
          font: {
            bold: currentStyle.bold,
            italic: currentStyle.italic,
            underline: currentStyle.underline,
            strike: currentStyle.strike
          }
        });
      } else {
        parts.push({ text: token });
      }
    }
  });

  return { richText: parts };
};

const hasFormattingTags = (text: string) => /<\/?(?:b|i|u|s)>/.test(text);

const getGlossaryCellString = (cell: ExcelJS.Cell): string => {
  if (!cell) return '';
  if (cell.value && typeof cell.value === 'object' && 'richText' in cell.value) {
    return (cell.value as ExcelJS.CellRichTextValue).richText.map(r => r.text).join('');
  }
  if (cell.formula) {
    if (cell.result !== undefined && cell.result !== null && typeof cell.result !== 'object') {
        return String(cell.result);
    }
  }
  return cell.text || (cell.value !== null && cell.value !== undefined ? String(cell.value) : '');
};

// --- GLOSSARY IMPORT UTILS ---

export interface ExcelPreviewData {
  headers: string[];
  sampleRows: string[][]; // First 5 rows of data
  totalRowsEstimate: number;
}

/**
 * Reads the first sheet of an Excel file to get headers and sample data.
 * Used for the Column Mapping UI.
 */
export const getExcelPreview = async (file: File): Promise<ExcelPreviewData> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  const worksheet = workbook.worksheets[0]; // Assume glossary is on first sheet
  if (!worksheet) throw new Error("File contains no sheets");

  const headers: string[] = [];
  const sampleRows: string[][] = [];
  
  // Assume Row 1 is header
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
     headers[colNumber - 1] = getGlossaryCellString(cell).trim() || `Column ${colNumber}`;
  });

  // Get next 5 rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (sampleRows.length >= 5) return;

    const rowData: string[] = [];
    // Ensure we map based on header length to align columns
    for(let i = 0; i < headers.length; i++) {
       const cell = row.getCell(i + 1);
       rowData.push(getGlossaryCellString(cell));
    }
    sampleRows.push(rowData);
  });

  return {
    headers,
    sampleRows,
    totalRowsEstimate: worksheet.rowCount
  };
};

/**
 * Extracts glossary items based on specific user-mapped columns.
 */
export const parseGlossaryByColumns = async (
  file: File, 
  termColIndex: number, // 0-based index
  transColIndex: number // 0-based index
): Promise<GlossaryItem[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  const worksheet = workbook.worksheets[0];

  const items: GlossaryItem[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip Header

    const term = getGlossaryCellString(row.getCell(termColIndex + 1)).trim();
    const translation = getGlossaryCellString(row.getCell(transColIndex + 1)).trim();

    if (term && translation) {
      items.push({
        id: Math.random().toString(36).substr(2, 9),
        term,
        translation
      });
    }
  });

  return items;
};

// --- MAIN PROCESSING ---

export const getExcelSheetNames = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  return workbook.worksheets.map(ws => ws.name);
};

export const processMarkdown = async (
  fileContent: string,
  targetLang: SupportedLanguage,
  context: string,
  glossary: GlossaryItem[],
  onProgress: (msg: string, percent: number) => void
): Promise<{ blob: Blob, translatedText: string }> => {
  onProgress('Analyzing Markdown structure...', 10);
  await new Promise(r => setTimeout(r, 100));

  onProgress('Sending to Gemini for translation...', 30);
  const translatedText = await translateText(fileContent, targetLang, context, glossary);
  
  onProgress('Reconstructing Markdown file...', 90);
  await new Promise(r => setTimeout(r, 100));

  onProgress('Done', 100);
  const blob = new Blob([translatedText], { type: 'text/markdown' });
  return { blob, translatedText };
};

export const processImage = async (
  file: File,
  targetLang: SupportedLanguage,
  context: string,
  glossary: GlossaryItem[],
  onProgress: (msg: string, percent: number) => void
): Promise<{ blob: Blob, translatedText: string }> => {
  onProgress('Uploading and analyzing image (OCR)...', 15);
  // Step 1: Extract Text using Multimodal Vision
  const extractedText = await extractTextFromImage(file);
  
  if (extractedText.includes("NO_TEXT_FOUND")) {
    onProgress('No text found in image.', 100);
    const blob = new Blob(["# No text detected in image"], { type: 'text/markdown' });
    return { blob, translatedText: "# No text detected in image" };
  }

  onProgress('Translating extracted text...', 50);
  // Step 2: Translate the extracted text using standard pipeline (applies glossary)
  const translatedText = await translateText(extractedText, targetLang, context, glossary);
  
  onProgress('Formatting output...', 90);
  const blob = new Blob([translatedText], { type: 'text/markdown' });
  return { blob, translatedText };
};

export const processExcel = async (
  arrayBuffer: ArrayBuffer,
  targetLang: SupportedLanguage,
  selectedSheets: string[],
  context: string,
  glossary: GlossaryItem[],
  onProgress: (msg: string, percent: number) => void
): Promise<Blob> => {
  onProgress('Loading Excel file...', 5);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  // 1. Collect all translatable content (Text)
  onProgress('Analyzing cells...', 10);
  
  interface TranslatableItem {
    sheetName: string;
    cellAddress: string;
    val: string;
  }

  const allItems: TranslatableItem[] = [];

  for (const sheetName of selectedSheets) {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) continue;

    worksheet.eachRow((row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        if (cell.type === ExcelJS.ValueType.String || cell.type === ExcelJS.ValueType.RichText) {
          const taggedText = richTextToTaggedString(cell.value);
          if (taggedText && taggedText.trim().length > 0 && !taggedText.startsWith('=')) {
            allItems.push({
              sheetName,
              cellAddress: cell.address,
              val: taggedText
            });
          }
        }
      });
    });
  }

  const totalItems = allItems.length;
  
  // 2. Translate Text in batches
  if (totalItems > 0) {
    const startPercent = 10;
    const endPercent = 80; // Reserve some progress for images
    const progressRange = endPercent - startPercent;

    const BATCH_SIZE = 40;
    const totalBatches = Math.ceil(totalItems / BATCH_SIZE);
    
    for (let i = 0; i < totalItems; i += BATCH_SIZE) {
      const batchItems = allItems.slice(i, i + BATCH_SIZE);
      const batchTexts = batchItems.map(item => item.val);
      const currentBatchIndex = Math.floor(i / BATCH_SIZE);
      const currentBatchNumber = currentBatchIndex + 1;

      const itemsProcessedSoFar = i;
      const progressFraction = itemsProcessedSoFar / totalItems;
      const currentPercent = Math.round(startPercent + (progressFraction * progressRange));
      
      onProgress(`Translating cell batch ${currentBatchNumber}/${totalBatches}...`, currentPercent);

      // translateBatchStrings now has built-in retry + fallback, guaranteed to return translations
      const translatedTexts = await translateBatchStrings(batchTexts, targetLang, context, glossary);

      batchItems.forEach((item, idx) => {
        const translatedText = translatedTexts[idx];
        if (translatedText) {
          const worksheet = workbook.getWorksheet(item.sheetName);
          if (worksheet) {
            const cell = worksheet.getCell(item.cellAddress);
            if (hasFormattingTags(translatedText)) {
              cell.value = taggedStringToRichText(translatedText);
            } else {
              cell.value = translatedText;
            }
            // Visual cue for translated cells
            if (!cell.border) {
              cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
            }
          }
        }
      });
    }
  }

  // 3. Handle Images inside Excel
  onProgress('Scanning for images in worksheets...', 80);
  
  for (const sheetName of selectedSheets) {
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) continue;

    // ExcelJS exposes images via getImages()
    const images = worksheet.getImages();
    if (!images || images.length === 0) continue;

    const totalImages = images.length;
    let imgCount = 0;

    for (const img of images) {
        imgCount++;
        onProgress(`Processing image ${imgCount}/${totalImages} in sheet '${sheetName}'...`, 80 + Math.floor((imgCount/totalImages) * 10));

        try {
            // Find media data from workbook model
            // @ts-ignore - model and media are accessible but types might be loose in ExcelJS
            const mediaId = img.imageId;
            // @ts-ignore
            const media = workbook.model.media.find(m => m.index === mediaId);

            if (media && media.buffer) {
                const base64Data = arrayBufferToBase64(media.buffer);
                const mimeType = media.extension === 'png' ? 'image/png' : media.extension === 'jpeg' || media.extension === 'jpg' ? 'image/jpeg' : 'image/png';

                // OCR Extraction
                const extractedText = await extractTextFromBase64(base64Data, mimeType);
                
                if (extractedText && !extractedText.includes("NO_TEXT_FOUND")) {
                    // Translation
                    const translatedImgText = await translateText(extractedText, targetLang, context, glossary);
                    
                    // Determine where to put the text
                    // img.range.tl gives { nativeRow, nativeCol } (0-indexed usually)
                    // We must be careful with indexing. ExcelJS cell access is 1-based.
                    // @ts-ignore
                    const row = Math.floor(img.range.tl.nativeRow) + 1;
                    // @ts-ignore
                    const col = Math.floor(img.range.tl.nativeCol) + 1;
                    
                    const cell = worksheet.getCell(row, col);
                    
                    // Append text to cell
                    const existingText = cell.text || '';
                    const newContent = `${existingText ? existingText + '\n\n' : ''}--- [IMAGE TRANS] ---\n${translatedImgText}\n----------------------`;
                    
                    cell.value = newContent;
                    cell.alignment = { wrapText: true, vertical: 'top', horizontal: 'left' };
                    // Add a comment to indicate image translation
                    if (!cell.note) {
                        cell.note = "Contains translated text from the image located here.";
                    }
                }
            }
        } catch (err) {
            console.error("Failed to process Excel image", err);
        }
    }
  }

  // 4. Translate Sheet Names
  if (selectedSheets.length > 0) {
      onProgress('Translating sheet names...', 95);
      try {
          const translatedNames = await translateBatchStrings(selectedSheets, targetLang, context, glossary);
          selectedSheets.forEach((oldName, idx) => {
              const newName = translatedNames[idx];
              if (newName && newName !== oldName) {
                  let cleanName = newName.replace(/[\[\]\*\/\\\?]/g, '').substring(0, 31).trim();
                  if (cleanName && !workbook.getWorksheet(cleanName)) {
                      const ws = workbook.getWorksheet(oldName);
                      if (ws) ws.name = cleanName;
                  }
              }
          });
      } catch (e) {
          console.error("Sheet name translation failed", e);
      }
  }

  onProgress('Finalizing file...', 98);
  const buffer = await workbook.xlsx.writeBuffer();
  
  onProgress('Done', 100);
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};
