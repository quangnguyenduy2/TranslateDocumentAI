/**
 * PPTX Shape Adjuster - Phase 3
 * 
 * Automatically adjusts textbox/shape dimensions when translated text
 * overflows the original bounds.
 * 
 * Features:
 * - EMU (English Metric Units) calculations
 * - Text length estimation
 * - Conservative auto-sizing (20% buffer)
 * - Aspect ratio preservation
 */

import { ParsedShape } from './pptxStructureParser';

// EMU conversion constants
const EMU_PER_INCH = 914400;
const EMU_PER_CM = 360000;

/**
 * Estimate text overflow percentage
 * Simple heuristic: character count ratio
 */
export const estimateOverflow = (
  originalText: string,
  translatedText: string
): number => {
  const originalLength = originalText.length;
  const translatedLength = translatedText.length;
  
  if (originalLength === 0) return 0;
  
  const ratio = translatedLength / originalLength;
  return (ratio - 1) * 100; // Percentage overflow
};

/**
 * Adjust shape height to accommodate longer text
 * 
 * @param shapeElement - The <p:sp> shape element
 * @param overflowPercent - Estimated overflow percentage
 * @param minIncrease - Minimum height increase (EMUs)
 */
export const adjustShapeHeight = (
  shapeElement: Element,
  overflowPercent: number,
  minIncrease: number = 100000 // ~0.11 inches
): boolean => {
  if (overflowPercent <= 5) return false; // No adjustment needed for <5% overflow
  
  try {
    // Navigate to shape properties
    const spPr = shapeElement.getElementsByTagNameNS('*', 'spPr')[0];
    if (!spPr) return false;
    
    const xfrm = spPr.getElementsByTagNameNS('*', 'xfrm')[0];
    if (!xfrm) return false;
    
    const ext = xfrm.getElementsByTagNameNS('*', 'ext')[0];
    if (!ext) return false;
    
    // Get current dimensions
    const currentHeight = parseInt(ext.getAttribute('cy') || '0');
    if (currentHeight === 0) return false;
    
    // Calculate new height with buffer
    const increaseRatio = 1 + (overflowPercent / 100) * 1.2; // 20% safety buffer
    let newHeight = Math.round(currentHeight * increaseRatio);
    
    // Ensure minimum increase
    if (newHeight - currentHeight < minIncrease) {
      newHeight = currentHeight + minIncrease;
    }
    
    // Apply new height
    ext.setAttribute('cy', newHeight.toString());
    
    return true;
  } catch (e) {
    console.error('Failed to adjust shape height:', e);
    return false;
  }
};

/**
 * Adjust shape width (less common, but useful for narrow columns)
 */
export const adjustShapeWidth = (
  shapeElement: Element,
  overflowPercent: number,
  maxWidthIncrease: number = 200000 // ~0.22 inches max
): boolean => {
  if (overflowPercent <= 10) return false;
  
  try {
    const spPr = shapeElement.getElementsByTagNameNS('*', 'spPr')[0];
    if (!spPr) return false;
    
    const xfrm = spPr.getElementsByTagNameNS('*', 'xfrm')[0];
    if (!xfrm) return false;
    
    const ext = xfrm.getElementsByTagNameNS('*', 'ext')[0];
    if (!ext) return false;
    
    const currentWidth = parseInt(ext.getAttribute('cx') || '0');
    if (currentWidth === 0) return false;
    
    // Calculate increase (capped)
    const increaseAmount = Math.min(
      Math.round(currentWidth * 0.15), // Max 15% increase
      maxWidthIncrease
    );
    
    const newWidth = currentWidth + increaseAmount;
    ext.setAttribute('cx', newWidth.toString());
    
    return true;
  } catch (e) {
    console.error('Failed to adjust shape width:', e);
    return false;
  }
};

/**
 * Auto-adjust shape dimensions based on text changes
 * 
 * Strategy:
 * - If text increases >20%: increase height
 * - If text increases >30%: increase both height and width (if narrow)
 * - If text decreases: no adjustment (preserve layout)
 */
export const autoAdjustShape = (
  shape: ParsedShape,
  originalTotalText: string,
  translatedTotalText: string
): { heightAdjusted: boolean; widthAdjusted: boolean } => {
  const overflow = estimateOverflow(originalTotalText, translatedTotalText);
  
  let heightAdjusted = false;
  let widthAdjusted = false;
  
  // Only adjust if text increased
  if (overflow > 0) {
    // Adjust height for any significant increase
    if (overflow > 15) {
      heightAdjusted = adjustShapeHeight(shape.shapeElement, overflow);
    }
    
    // Adjust width only for large increases and narrow shapes
    if (overflow > 30 && shape.bounds) {
      const aspectRatio = shape.bounds.width / shape.bounds.height;
      if (aspectRatio < 2) { // Narrow or square shape
        widthAdjusted = adjustShapeWidth(shape.shapeElement, overflow);
      }
    }
  }
  
  return { heightAdjusted, widthAdjusted };
};

/**
 * Batch adjust all shapes in a slide
 */
export const adjustAllShapes = (
  shapes: ParsedShape[],
  translationMap: Map<string, { original: string; translated: string }>
): { totalAdjusted: number; heightAdjustments: number; widthAdjustments: number } => {
  let totalAdjusted = 0;
  let heightAdjustments = 0;
  let widthAdjustments = 0;
  
  for (const shape of shapes) {
    const shapeText = shape.paragraphs.map(p => p.fullText).join('\n');
    const translationData = translationMap.get(shapeText);
    
    if (translationData) {
      const result = autoAdjustShape(shape, translationData.original, translationData.translated);
      
      if (result.heightAdjusted || result.widthAdjusted) {
        totalAdjusted++;
        if (result.heightAdjusted) heightAdjustments++;
        if (result.widthAdjusted) widthAdjustments++;
      }
    }
  }
  
  return { totalAdjusted, heightAdjustments, widthAdjustments };
};

/**
 * Calculate EMUs from inches
 */
export const inchesToEMU = (inches: number): number => {
  return Math.round(inches * EMU_PER_INCH);
};

/**
 * Calculate EMUs from centimeters
 */
export const cmToEMU = (cm: number): number => {
  return Math.round(cm * EMU_PER_CM);
};

/**
 * Calculate inches from EMUs
 */
export const emuToInches = (emus: number): number => {
  return emus / EMU_PER_INCH;
};

/**
 * Calculate centimeters from EMUs
 */
export const emuToCM = (emus: number): number => {
  return emus / EMU_PER_CM;
};
