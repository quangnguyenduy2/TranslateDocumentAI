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

// --- GLOSSARY PARSING ---

export const parseGlossaryFromExcel = async (
  file: File, 
  targetLang: SupportedLanguage
): Promise<GlossaryItem[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);
  
  const worksheet = workbook.worksheets[0]; // Assume first sheet
  if (!worksheet) return [];

  const items: GlossaryItem[] = [];
  
  // 1. Identify Headers in Row 1
  const headerRow = worksheet.getRow(1);
  let termColIndex = -1;
  let transColIndex = -1;

  // Normalize target lang for comparison (e.g., "Vietnamese" -> "vietnamese")
  const targetLangKey = targetLang.toLowerCase();

  headerRow.eachCell((cell, colNumber) => {
    const val = cell.value?.toString().toLowerCase().trim() || '';
    
    // Find Translation Column (Matches target language)
    if (val.includes(targetLangKey)) {
      transColIndex = colNumber;
    }

    // Find Term Column (Priority: Japanese -> English -> Source -> Term)
    // We prioritize Japanese as per the specific user requirement example
    if (termColIndex === -1) {
       if (val === 'japanese' || val.includes('japanese')) termColIndex = colNumber;
       else if (val === 'english' || val.includes('english')) termColIndex = colNumber;
       else if (val === 'term' || val === 'source') termColIndex = colNumber;
    } else {
       // Upgrade priority if we found "Japanese" specifically
       if ((val === 'japanese' || val.includes('japanese')) && !headerRow.getCell(termColIndex).value?.toString().toLowerCase().includes('japanese')) {
         termColIndex = colNumber;
       }
    }
  });

  // Fallback if headers not found or vague: 
  // If we found a target col, assume the first text column that isn't ID/Target is the term.
  if (transColIndex !== -1 && termColIndex === -1) {
    headerRow.eachCell((cell, colNumber) => {
       const val = cell.value?.toString().toLowerCase() || '';
       if (colNumber !== transColIndex && !val.includes('id') && termColIndex === -1) {
         termColIndex = colNumber;
       }
    });
  }

  // If we still don't have columns, we can't parse safely
  if (termColIndex === -1 || transColIndex === -1) {
    console.warn(`Could not identify 'Japanese/Term' or '${targetLang}' columns in ${file.name}`);
    return [];
  }

  // 2. Extract Data
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const term = row.getCell(termColIndex).text?.trim();
    const translation = row.getCell(transColIndex).text?.trim();

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