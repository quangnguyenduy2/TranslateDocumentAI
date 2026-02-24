import { TestCase, TestResult } from './types.ts';
import ExcelJS from 'exceljs';

/**
 * Test 1: Excel Creation and Parsing
 * Validates Excel workbook creation and reading
 */
export const excelCreationTest: TestCase = {
  id: 'processing-001',
  name: 'Excel Creation',
  description: 'Test creating and parsing Excel workbooks',
  category: 'Processing',
  run: async (): Promise<TestResult> => {
    const startTime = performance.now();
    
    try {
      // Create a test workbook
      const workbook = new ExcelJS.Workbook();
      const sheet1 = workbook.addWorksheet('Sheet1');
      const sheet2 = workbook.addWorksheet('Sheet2');
      
      // Add data
      sheet1.addRow(['Name', 'Age', 'City']);
      sheet1.addRow(['John', 30, 'New York']);
      sheet1.addRow(['Jane', 25, 'Los Angeles']);
      
      sheet2.addRow(['Product', 'Price']);
      sheet2.addRow(['Laptop', 1000]);
      
      // Export to buffer
      const buffer = await workbook.xlsx.writeBuffer();
      
      // Create blob and read back
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const arrayBuffer = await blob.arrayBuffer();
      
      // Parse the workbook
      const parsedWorkbook = new ExcelJS.Workbook();
      await parsedWorkbook.xlsx.load(arrayBuffer);
      
      // Validate
      const sheetCount = parsedWorkbook.worksheets.length;
      const expectedSheetCount = 2;
      
      if (sheetCount !== expectedSheetCount) {
        return {
          success: false,
          message: `Expected ${expectedSheetCount} sheets, got ${sheetCount}`,
          duration: performance.now() - startTime,
          details: { expected: expectedSheetCount, actual: sheetCount }
        };
      }
      
      const firstSheet = parsedWorkbook.getWorksheet('Sheet1');
      const rowCount = firstSheet?.rowCount || 0;
      const expectedRowCount = 3;
      
      if (rowCount !== expectedRowCount) {
        return {
          success: false,
          message: `Expected ${expectedRowCount} rows, got ${rowCount}`,
          duration: performance.now() - startTime,
          details: { expected: expectedRowCount, actual: rowCount }
        };
      }
      
      return {
        success: true,
        message: 'Excel creation and parsing works correctly',
        duration: performance.now() - startTime,
        details: { 
          sheetCount, 
          rowCount,
          blobSize: blob.size 
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: performance.now() - startTime
      };
    }
  }
};

/**
 * Test 2: Rich Text Handling
 * Validates rich text formatting in Excel
 */
export const richTextTest: TestCase = {
  id: 'processing-002',
  name: 'Rich Text Handling',
  description: 'Test Excel rich text formatting',
  category: 'Processing',
  run: async (): Promise<TestResult> => {
    const startTime = performance.now();
    
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');
      
      // Create rich text cell
      const richTextValue: ExcelJS.CellRichTextValue = {
        richText: [
          { text: 'Bold ', font: { bold: true } },
          { text: 'Italic ', font: { italic: true } },
          { text: 'Underline', font: { underline: true } }
        ]
      };
      
      const cell = sheet.getCell('A1');
      cell.value = richTextValue;
      
      // Export and re-import
      const buffer = await workbook.xlsx.writeBuffer();
      const parsedWorkbook = new ExcelJS.Workbook();
      await parsedWorkbook.xlsx.load(buffer);
      
      const parsedSheet = parsedWorkbook.getWorksheet('Test');
      const parsedCell = parsedSheet?.getCell('A1');
      const parsedValue = parsedCell?.value;
      
      // Validate rich text was preserved
      const hasRichText = parsedValue && typeof parsedValue === 'object' && 'richText' in parsedValue;
      
      if (!hasRichText) {
        return {
          success: false,
          message: 'Rich text formatting was lost',
          duration: performance.now() - startTime,
          details: { parsedValue }
        };
      }
      
      const richTextArray = (parsedValue as ExcelJS.CellRichTextValue).richText;
      const expectedParts = 3;
      const actualParts = richTextArray.length;
      
      const success = actualParts === expectedParts;
      
      return {
        success,
        message: success 
          ? 'Rich text handling works correctly' 
          : `Expected ${expectedParts} rich text parts, got ${actualParts}`,
        duration: performance.now() - startTime,
        details: { expected: expectedParts, actual: actualParts }
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: performance.now() - startTime
      };
    }
  }
};

/**
 * Test 3: Cell Formula Handling
 * Validates Excel formulas are preserved
 */
export const formulaTest: TestCase = {
  id: 'processing-003',
  name: 'Formula Handling',
  description: 'Test Excel formula preservation',
  category: 'Processing',
  run: async (): Promise<TestResult> => {
    const startTime = performance.now();
    
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Test');
      
      // Add numbers
      sheet.getCell('A1').value = 10;
      sheet.getCell('A2').value = 20;
      
      // Add formula
      sheet.getCell('A3').value = { formula: 'SUM(A1:A2)' };
      
      // Export and re-import
      const buffer = await workbook.xlsx.writeBuffer();
      const parsedWorkbook = new ExcelJS.Workbook();
      await parsedWorkbook.xlsx.load(buffer);
      
      const parsedSheet = parsedWorkbook.getWorksheet('Test');
      const parsedCell = parsedSheet?.getCell('A3');
      const cellValue = parsedCell?.value;
      
      // Check if formula is preserved
      const hasFormula = cellValue && typeof cellValue === 'object' && 'formula' in cellValue;
      
      return {
        success: hasFormula,
        message: hasFormula 
          ? 'Formula handling works correctly' 
          : 'Formula was not preserved',
        duration: performance.now() - startTime,
        details: { cellValue, hasFormula }
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: performance.now() - startTime
      };
    }
  }
};

/**
 * Test 4: Multiple Worksheets
 * Validates handling of multiple sheets
 */
export const multipleWorksheetsTest: TestCase = {
  id: 'processing-004',
  name: 'Multiple Worksheets',
  description: 'Test handling multiple worksheets',
  category: 'Processing',
  run: async (): Promise<TestResult> => {
    const startTime = performance.now();
    
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Create 5 sheets
      const sheetNames = ['Sales', 'Inventory', 'Customers', 'Reports', 'Settings'];
      sheetNames.forEach(name => {
        const sheet = workbook.addWorksheet(name);
        sheet.getCell('A1').value = `${name} Data`;
      });
      
      // Export and re-import
      const buffer = await workbook.xlsx.writeBuffer();
      const parsedWorkbook = new ExcelJS.Workbook();
      await parsedWorkbook.xlsx.load(buffer);
      
      const parsedSheetCount = parsedWorkbook.worksheets.length;
      const expectedCount = 5;
      
      if (parsedSheetCount !== expectedCount) {
        return {
          success: false,
          message: `Expected ${expectedCount} sheets, got ${parsedSheetCount}`,
          duration: performance.now() - startTime,
          details: { expected: expectedCount, actual: parsedSheetCount }
        };
      }
      
      // Validate sheet names
      const parsedNames = parsedWorkbook.worksheets.map(s => s.name);
      const allNamesMatch = sheetNames.every(name => parsedNames.includes(name));
      
      return {
        success: allNamesMatch,
        message: allNamesMatch 
          ? 'Multiple worksheets handled correctly' 
          : 'Some worksheet names do not match',
        duration: performance.now() - startTime,
        details: { expected: sheetNames, actual: parsedNames }
      };
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        duration: performance.now() - startTime
      };
    }
  }
};

export const processingTests: TestCase[] = [
  excelCreationTest,
  richTextTest,
  formulaTest,
  multipleWorksheetsTest
];
