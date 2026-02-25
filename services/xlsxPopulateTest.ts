import XlsxPopulate from 'xlsx-populate';

/**
 * Test script to verify xlsx-populate shape API is working
 * Run in browser console or Node environment
 */

export const testXlsxPopulateShapes = async () => {
  console.log('🧪 Testing xlsx-populate shape support...\n');

  try {
    // Create a new workbook
    const workbook = await XlsxPopulate.fromBlankAsync();
    const sheet = workbook.sheet(0);

    // Add some test data
    sheet.cell('A1').value('Test Cell');
    sheet.cell('B2').value('Another Cell');

    console.log('✅ Basic cell operations work');

    // Test shape API
    try {
      const shapes = sheet.shapes();
      console.log(`✅ Shape API accessible: ${Array.isArray(shapes) ? 'Array' : typeof shapes}`);
      console.log(`   Current shape count: ${shapes ? shapes.length : 0}`);

      // Note: Creating shapes programmatically is not fully supported in xlsx-populate
      // Shapes are best read from existing files
      console.log('ℹ️  Shape creation not fully supported - read-only API');
      console.log('ℹ️  To test translation: Open an Excel file with existing shapes');

    } catch (shapeErr) {
      console.error('❌ Shape API failed:', shapeErr);
      return false;
    }

    // Generate output
    const buffer = await workbook.outputAsync();
    console.log(`✅ Output generated: ${buffer.byteLength} bytes`);

    console.log('\n✅ ALL TESTS PASSED');
    console.log('📝 Next: Test with real Excel file containing shapes');
    return true;

  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    return false;
  }
};

/**
 * Test with actual Excel file containing shapes
 */
export const testShapeTranslation = async (fileBuffer: ArrayBuffer) => {
  console.log('🧪 Testing shape translation on real file...\n');

  try {
    const workbook = await XlsxPopulate.fromDataAsync(fileBuffer);
    const sheets = workbook.sheets();

    console.log(`📊 File loaded: ${sheets.length} sheets`);

    let totalShapes = 0;
    let shapesWithText = 0;

    for (const sheet of sheets) {
      const sheetName = sheet.name();
      const shapes = sheet.shapes();

      if (shapes && shapes.length > 0) {
        console.log(`\n📄 Sheet "${sheetName}": ${shapes.length} shapes found`);
        totalShapes += shapes.length;

        shapes.forEach((shape, idx) => {
          try {
            const text = shape.text();
            if (text && text.trim().length > 0) {
              shapesWithText++;
              console.log(`   Shape ${idx + 1}: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
            } else {
              console.log(`   Shape ${idx + 1}: (no text)`);
            }
          } catch (err) {
            console.log(`   Shape ${idx + 1}: (error reading text)`);
          }
        });
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Total shapes: ${totalShapes}`);
    console.log(`   Shapes with text: ${shapesWithText}`);
    console.log(`   Translatable: ${shapesWithText} shapes`);

    if (shapesWithText > 0) {
      console.log('\n✅ Shape translation ready!');
      return true;
    } else {
      console.log('\n⚠️  No shapes with text found - file may not have flowcharts');
      return false;
    }

  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    return false;
  }
};

// Export for use in app
if (typeof window !== 'undefined') {
  (window as any).testXlsxPopulateShapes = testXlsxPopulateShapes;
  (window as any).testShapeTranslation = testShapeTranslation;
  console.log('Test functions available: testXlsxPopulateShapes(), testShapeTranslation(fileBuffer)');
}
