import ExcelJS from 'exceljs';
import { translateText, translateBatchStrings } from './geminiService';
import { SupportedLanguage, GlossaryItem } from '../types';

// --- RICH TEXT HELPERS ---

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

// Deprecated in favor of UI mapping, but kept for fallback legacy calls if needed
export const parseGlossaryFromExcel = async (
  file: File, 
  targetLang: SupportedLanguage
): Promise<GlossaryItem[]> => {
  const preview = await getExcelPreview(file);
  // Simple fallback: If headers exist, try to guess, otherwise use Col 0 and 1
  return parseGlossaryByColumns(file, 0, 1); 
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

  // 1. Collect all translatable content
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
  
  if (totalItems === 0) {
    onProgress('No text found to translate.', 100);
  } else {
    // 2. Translate in batches
    const startPercent = 10;
    const endPercent = 90;
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
      
      onProgress(`Translating batch ${currentBatchNumber}/${totalBatches}...`, currentPercent);

      try {
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
                if (!cell.border) {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                }
             }
          }
        });

      } catch (e) {
        console.error(`Error processing batch ${currentBatchNumber}`, e);
      }
    }
  }

  // 3. Translate Sheet Names
  if (selectedSheets.length > 0) {
      onProgress('Translating sheet names...', 92);
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