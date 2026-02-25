import JSZip from 'jszip';

interface ShapeText {
  drawingPath: string; // e.g., "xl/drawings/drawing1.xml"
  shapeIndex: number;
  originalText: string;
}

/**
 * Check if Excel file contains any shapes/drawings (fast detection)
 * Returns true if file has shapes, false otherwise
 */
export const hasShapes = async (arrayBuffer: ArrayBuffer): Promise<boolean> => {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    // Check if xl/drawings/ folder exists
    const drawingFiles = Object.keys(zip.files).filter(path => 
      path.startsWith('xl/drawings/drawing') && path.endsWith('.xml')
    );
    
    if (drawingFiles.length === 0) {
      console.log('✅ No shapes detected - using fast ExcelJS processor');
      return false;
    }
    
    // Check if any drawing file contains actual text
    for (const drawingPath of drawingFiles) {
      const xmlContent = await zip.file(drawingPath)?.async('text');
      if (xmlContent && xmlContent.includes('<a:t>')) {
        console.log('🎨 Shapes with text detected - using xlsx-populate + ZIP processor');
        return true;
      }
    }
    
    console.log('✅ Shapes exist but no text - using fast ExcelJS processor');
    return false;
  } catch (error) {
    console.warn('Failed to detect shapes, falling back to ExcelJS:', error);
    return false; // Default to fast processor if detection fails
  }
};

/**
 * Extract all shape texts from Excel XLSX file (which is a ZIP container)
 */
export const extractShapeTexts = async (arrayBuffer: ArrayBuffer): Promise<ShapeText[]> => {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const shapeTexts: ShapeText[] = [];
  
  // Find all drawing XML files in the ZIP
  const drawingFiles = Object.keys(zip.files).filter(path => 
    path.startsWith('xl/drawings/drawing') && path.endsWith('.xml')
  );
  
  console.log(`🔍 Found ${drawingFiles.length} drawing files in Excel`);
  
  for (const drawingPath of drawingFiles) {
    const xmlContent = await zip.file(drawingPath)?.async('text');
    if (!xmlContent) continue;
    
    // Parse XML to find text elements
    // Shapes contain text in <a:t> tags (DrawingML text runs)
    const textMatches = xmlContent.matchAll(/<a:t>([^<]+)<\/a:t>/g);
    
    let shapeIndex = 0;
    for (const match of textMatches) {
      const text = match[1];
      if (text && text.trim().length > 0) {
        shapeTexts.push({
          drawingPath,
          shapeIndex,
          originalText: text.trim()
        });
        console.log(`  Shape ${shapeIndex} in ${drawingPath}: "${text.trim().substring(0, 50)}..."`);
        shapeIndex++;
      }
    }
  }
  
  console.log(`📊 Total shape texts extracted: ${shapeTexts.length}`);
  return shapeTexts;
};

/**
 * Replace shape texts in the XLSX file
 */
export const replaceShapeTexts = async (
  arrayBuffer: ArrayBuffer,
  translations: Map<string, string> // key: originalText, value: translatedText
): Promise<ArrayBuffer> => {
  const zip = await JSZip.loadAsync(arrayBuffer);
  
  // Find all drawing XML files
  const drawingFiles = Object.keys(zip.files).filter(path => 
    path.startsWith('xl/drawings/drawing') && path.endsWith('.xml')
  );
  
  let replacedCount = 0;
  
  for (const drawingPath of drawingFiles) {
    let xmlContent = await zip.file(drawingPath)?.async('text');
    if (!xmlContent) continue;
    
    // Replace all <a:t> text nodes with translated versions
    xmlContent = xmlContent.replace(/<a:t>([^<]+)<\/a:t>/g, (match, originalText) => {
      const trimmed = originalText.trim();
      const translated = translations.get(trimmed);
      
      if (translated) {
        console.log(`✓ Replacing shape text: "${trimmed}" → "${translated}"`);
        replacedCount++;
        return `<a:t>${translated}</a:t>`;
      }
      
      return match; // Keep original if no translation
    });
    
    // Write modified XML back to ZIP
    zip.file(drawingPath, xmlContent);
  }
  
  console.log(`✅ Replaced ${replacedCount} shape texts in Excel file`);
  
  // Generate new XLSX buffer
  return await zip.generateAsync({ type: 'arraybuffer' });
};
