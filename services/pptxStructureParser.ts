/**
 * PPTX Structure Parser - Phase 2
 * 
 * Parses PowerPoint XML structure to maintain context during translation:
 * - Paragraph grouping (<a:p>)
 * - Line breaks (<a:br/>)
 * - Tables (<a:tbl>)
 * - Hyperlinks (<a:hlinkClick>)
 * - Shape boundaries and properties
 */

export interface TextRun {
  element: Element;
  text: string;
  hasHyperlink: boolean;
  hyperlinkId?: string;
}

export interface LineBreak {
  element: Element;
  position: number; // Position within paragraph text
}

export interface ParsedParagraph {
  element: Element; // The <a:p> element
  runs: TextRun[];
  lineBreaks: LineBreak[];
  fullText: string; // Concatenated text from all runs
  textElements: Element[]; // All <a:t> elements in order
}

export interface ParsedShape {
  shapeElement: Element;
  shapeId: string;
  shapeName: string;
  paragraphs: ParsedParagraph[];
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface TableCell {
  element: Element; // <a:tc> element
  rowIndex: number;
  colIndex: number;
  paragraphs: ParsedParagraph[];
  fullText: string;
}

export interface ParsedTable {
  tableElement: Element; // <a:tbl> element
  rows: TableCell[][];
  totalCells: number;
}

/**
 * Extract all paragraphs from a shape's text body
 */
export const extractParagraphsFromShape = (shapeElement: Element): ParsedParagraph[] => {
  const paragraphs: ParsedParagraph[] = [];
  
  // Find <p:txBody> or <a:txBody>
  const txBody = shapeElement.querySelector('txBody') || 
                 Array.from(shapeElement.getElementsByTagNameNS('*', 'txBody'))[0];
  
  if (!txBody) return paragraphs;
  
  // Get all <a:p> elements
  const pElements = Array.from(txBody.getElementsByTagNameNS('*', 'p'));
  
  for (const pElement of pElements) {
    const paragraph = parseParagraph(pElement);
    if (paragraph.runs.length > 0 || paragraph.lineBreaks.length > 0) {
      paragraphs.push(paragraph);
    }
  }
  
  return paragraphs;
};

/**
 * Parse a single paragraph element
 */
export const parseParagraph = (pElement: Element): ParsedParagraph => {
  const runs: TextRun[] = [];
  const lineBreaks: LineBreak[] = [];
  const textElements: Element[] = [];
  let fullText = '';
  let currentPosition = 0;
  
  // Iterate through child nodes in order to preserve structure
  const children = Array.from(pElement.childNodes);
  
  for (const child of children) {
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const element = child as Element;
    
    // Check for text run (<a:r>)
    if (element.nodeName.includes(':r') || element.nodeName === 'r') {
      const textElement = element.getElementsByTagNameNS('*', 't')[0];
      if (textElement) {
        const text = textElement.textContent || '';
        
        // Check for hyperlink
        const runProps = element.getElementsByTagNameNS('*', 'rPr')[0];
        const hyperlinkClick = runProps?.getElementsByTagNameNS('*', 'hlinkClick')[0];
        const hyperlinkId = hyperlinkClick?.getAttributeNS('*', 'id') || undefined;
        
        runs.push({
          element: textElement,
          text,
          hasHyperlink: !!hyperlinkId,
          hyperlinkId,
        });
        
        textElements.push(textElement);
        fullText += text;
        currentPosition += text.length;
      }
    }
    
    // Check for line break (<a:br/>)
    else if (element.nodeName.includes(':br') || element.nodeName === 'br') {
      lineBreaks.push({
        element,
        position: currentPosition,
      });
      fullText += '\n';
      currentPosition += 1;
    }
    
    // Check for field (<a:fld> - for dates, etc.)
    else if (element.nodeName.includes(':fld') || element.nodeName === 'fld') {
      const textElement = element.getElementsByTagNameNS('*', 't')[0];
      if (textElement) {
        const text = textElement.textContent || '';
        // Mark as non-translatable by not adding to runs
        // Just add to fullText for context
        fullText += text;
        currentPosition += text.length;
      }
    }
  }
  
  return {
    element: pElement,
    runs,
    lineBreaks,
    fullText,
    textElements,
  };
};

/**
 * Extract all shapes from a slide document
 */
export const extractShapesFromSlide = (doc: Document): ParsedShape[] => {
  const shapes: ParsedShape[] = [];
  
  // Find all <p:sp> elements (shapes)
  const shapeElements = Array.from(doc.getElementsByTagNameNS('*', 'sp'));
  
  for (const shapeElement of shapeElements) {
    // Get shape ID and name
    const nvSpPr = shapeElement.getElementsByTagNameNS('*', 'nvSpPr')[0];
    const cNvPr = nvSpPr?.getElementsByTagNameNS('*', 'cNvPr')[0];
    const shapeId = cNvPr?.getAttribute('id') || 'unknown';
    const shapeName = cNvPr?.getAttribute('name') || 'unnamed';
    
    // Get shape bounds (optional for now)
    const bounds = extractShapeBounds(shapeElement);
    
    // Extract paragraphs
    const paragraphs = extractParagraphsFromShape(shapeElement);
    
    if (paragraphs.length > 0) {
      shapes.push({
        shapeElement,
        shapeId,
        shapeName,
        paragraphs,
        bounds,
      });
    }
  }
  
  return shapes;
};

/**
 * Extract shape bounds (position and size)
 */
const extractShapeBounds = (shapeElement: Element): ParsedShape['bounds'] | undefined => {
  try {
    const spPr = shapeElement.getElementsByTagNameNS('*', 'spPr')[0];
    if (!spPr) return undefined;
    
    const xfrm = spPr.getElementsByTagNameNS('*', 'xfrm')[0];
    if (!xfrm) return undefined;
    
    const off = xfrm.getElementsByTagNameNS('*', 'off')[0];
    const ext = xfrm.getElementsByTagNameNS('*', 'ext')[0];
    
    if (!off || !ext) return undefined;
    
    const x = parseInt(off.getAttribute('x') || '0');
    const y = parseInt(off.getAttribute('y') || '0');
    const width = parseInt(ext.getAttribute('cx') || '0');
    const height = parseInt(ext.getAttribute('cy') || '0');
    
    return { x, y, width, height };
  } catch (e) {
    return undefined;
  }
};

/**
 * Extract tables from a slide
 */
export const extractTablesFromSlide = (doc: Document): ParsedTable[] => {
  const tables: ParsedTable[] = [];
  
  // Find all <a:tbl> elements
  const tableElements = Array.from(doc.getElementsByTagNameNS('*', 'tbl'));
  
  for (const tableElement of tableElements) {
    const rows: TableCell[][] = [];
    let totalCells = 0;
    
    // Get all table rows (<a:tr>)
    const trElements = Array.from(tableElement.getElementsByTagNameNS('*', 'tr'));
    
    trElements.forEach((trElement, rowIndex) => {
      const rowCells: TableCell[] = [];
      
      // Get all table cells (<a:tc>)
      const tcElements = Array.from(trElement.getElementsByTagNameNS('*', 'tc'));
      
      tcElements.forEach((tcElement, colIndex) => {
        // Extract paragraphs from cell
        const txBody = tcElement.getElementsByTagNameNS('*', 'txBody')[0];
        const paragraphs: ParsedParagraph[] = [];
        let fullText = '';
        
        if (txBody) {
          const pElements = Array.from(txBody.getElementsByTagNameNS('*', 'p'));
          for (const pElement of pElements) {
            const paragraph = parseParagraph(pElement);
            paragraphs.push(paragraph);
            fullText += paragraph.fullText + ' ';
          }
        }
        
        rowCells.push({
          element: tcElement,
          rowIndex,
          colIndex,
          paragraphs,
          fullText: fullText.trim(),
        });
        
        totalCells++;
      });
      
      rows.push(rowCells);
    });
    
    if (totalCells > 0) {
      tables.push({
        tableElement,
        rows,
        totalCells,
      });
    }
  }
  
  return tables;
};

/**
 * Reconstruct paragraph text from translated parts
 * Handles splitting translated text back into runs proportionally
 */
export const reconstructParagraph = (
  paragraph: ParsedParagraph,
  translatedFullText: string
): void => {
  // If only one text element, simple replacement
  if (paragraph.textElements.length === 1) {
    paragraph.textElements[0].textContent = translatedFullText;
    return;
  }
  
  // Multiple runs: split proportionally by original length
  const originalLengths = paragraph.runs.map(r => r.text.length);
  const totalOriginalLength = originalLengths.reduce((sum, len) => sum + len, 0);
  
  if (totalOriginalLength === 0) return;
  
  // Calculate proportional lengths
  const translatedLength = translatedFullText.length;
  let currentIndex = 0;
  
  paragraph.runs.forEach((run, idx) => {
    const proportion = originalLengths[idx] / totalOriginalLength;
    const targetLength = Math.round(translatedLength * proportion);
    
    // Extract substring for this run
    const endIndex = Math.min(currentIndex + targetLength, translatedLength);
    const runTranslation = translatedFullText.substring(currentIndex, endIndex);
    
    run.element.textContent = runTranslation;
    currentIndex = endIndex;
  });
  
  // If there's remaining text, add it to the last run
  if (currentIndex < translatedLength) {
    const lastRun = paragraph.runs[paragraph.runs.length - 1];
    lastRun.element.textContent += translatedFullText.substring(currentIndex);
  }
};

/**
 * Check if element is inside a date/time field
 */
export const isDateField = (element: Element): boolean => {
  let current: Element | null = element;
  
  while (current) {
    const nodeName = current.nodeName.toLowerCase();
    if (nodeName.includes('fld') || nodeName === 'fld') {
      return true;
    }
    current = current.parentElement;
  }
  
  return false;
};
