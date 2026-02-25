# 📊 Excel Shape & Flowchart Translation - User Guide

## 🎯 What's New?

Your translation app now **preserves and translates flowcharts, diagrams, and shapes** in Excel files!

### Before vs After

**Before (ExcelJS):**
- ✅ Translates cells
- ✅ Translates images (OCR)
- ❌ **Loses flowcharts and shapes**
- ❌ Diagrams disappear after translation

**After (xlsx-populate):**
- ✅ Translates cells
- ✅ **Translates shapes and flowcharts** 🎉
- ✅ **Preserves diagram structure**
- ⚠️ Image OCR temporarily disabled (coming soon)

---

## 🚀 How to Use

### Step 1: Prepare Your Excel File
- Create Excel file with flowcharts, diagrams, or shapes
- Add text to shapes (e.g., flowchart labels)
- Ensure shapes have readable text content

### Step 2: Upload to Translation App
1. Open the app at `http://localhost:3001`
2. Click **Upload** or drag Excel file
3. Select target language (e.g., Vietnamese, English, etc.)
4. Select sheets to translate

### Step 3: Translation Process
The app will now:
- ✅ Analyze cells **and shapes**
- ✅ Extract text from flowchart elements
- ✅ Translate all content in batches
- ✅ Write translated text back to shapes
- ✅ Preserve diagram structure

### Step 4: Download Translated File
- Download the translated Excel file
- Open in Microsoft Excel or Google Sheets
- **Verify flowcharts are intact** with translated text

---

## 📋 Supported Shape Types

### Flowchart Elements
- ✅ Process (rectangles)
- ✅ Decision (diamonds)
- ✅ Data (parallelograms)
- ✅ Start/End (rounded rectangles)
- ✅ Connectors with labels

### Other Shapes
- ✅ Text boxes
- ✅ Callouts
- ✅ Arrows with text
- ✅ Circles, ovals
- ✅ Any shape containing text

---

## ⚙️ Advanced Features

### Smart Language Detection
The app **automatically skips** content already in the target language:
- Saves API tokens
- Faster processing
- No unnecessary re-translation

**Example:**
- Source: Vietnamese Excel with English flowchart
- Target: Vietnamese
- Result: Only English flowchart is translated, Vietnamese cells skipped

### Batch Translation
Shapes and cells are translated together in batches:
- **Small files**: 40 items per batch
- **Large files**: 20 items per batch
- Optimized for Gemini API rate limits

### Glossary & Blacklist Support
- **Glossary**: Ensures consistent translation of technical terms in shapes
- **Blacklist**: Protects sensitive data (e.g., company names in diagrams)

---

## 🧪 Testing Your Files

### Test Checklist
1. **Simple Flowchart**
   - Create 5-10 shape flowchart
   - Add text labels to each shape
   - Upload and translate
   - Verify structure preserved

2. **Complex Diagram**
   - Test with 50+ shapes
   - Include various shape types
   - Check all text is translated

3. **Mixed Content**
   - Excel file with cells + shapes + images
   - Verify cells translated
   - Verify shapes translated
   - (Images: OCR coming soon)

### Common Issues & Solutions

#### Issue: "No shapes found"
- **Cause**: File may not contain shapes, or shapes have no text
- **Solution**: Add text to shapes in Excel before translating

#### Issue: "Shape text not translated"
- **Cause**: Shape might be in a different format (image vs vector)
- **Solution**: Ensure shapes are native Excel shapes, not embedded images

#### Issue: "Flowchart structure changed"
- **Cause**: This shouldn't happen with xlsx-populate
- **Solution**: Report bug with sample file

---

## 🔧 Technical Details

### Library Used
- **xlsx-populate**: Native shape API support
- **Replaces**: ExcelJS for Excel processing (cells + shapes)
- **Kept**: ExcelJS for future image OCR integration

### Processing Flow
```
Upload Excel → Load with xlsx-populate → Extract cells & shapes
    ↓
Batch translate text → Apply glossary/blacklist → Smart skip
    ↓
Write back to shapes → Save Excel → Download
```

### Performance
- **Speed**: ~1-2 seconds per 50 shapes
- **Bottleneck**: API translation (not shape processing)
- **Optimization**: Batch processing reduces API calls

---

## 📊 Example Use Cases

### 1. Business Process Diagrams
- **Input**: Company workflow in English
- **Output**: Translated Vietnamese workflow
- **Benefit**: Preserve visual process flow

### 2. Technical Architecture
- **Input**: System diagram with component labels
- **Output**: Localized diagram for international team
- **Benefit**: Consistent technical terminology (glossary)

### 3. Educational Materials
- **Input**: Science flowcharts with explanations
- **Output**: Multi-language educational content
- **Benefit**: Visual learning aids in native language

### 4. Project Plans
- **Input**: Gantt charts with task descriptions
- **Output**: Translated project timeline
- **Benefit**: Team collaboration across languages

---

## 🐛 Troubleshooting

### Development Mode
If you're developing/testing:

1. **Check Console Logs**
   ```javascript
   // Browser console will show:
   ✓ Translated shape 0 in "Sheet1"
   ✓ Translated shape 1 in "Sheet1"
   ```

2. **Test Shape Detection**
   ```javascript
   // Run in browser console:
   testXlsxPopulateShapes()
   ```

3. **Verify File Structure**
   - Open translated file in Excel
   - Check Developer → Visual Basic → This Workbook
   - Verify shapes exist in object model

### Production Issues

**Shapes disappear after translation:**
- Ensure using latest version (v1.4.0+)
- Check file isn't corrupted
- Try re-uploading original file

**Translation incomplete:**
- Verify shapes contain text (not images)
- Check target language is supported
- Review glossary for conflicts

---

## 🎓 Best Practices

### 1. Prepare Files Properly
- Use native Excel shapes (Insert → Shapes)
- Avoid embedded images as shapes
- Keep shape text concise (<200 chars)

### 2. Optimize Translation
- Use glossary for technical terms
- Enable "Skip Already Translated"
- Process one sheet at a time for large files

### 3. Quality Assurance
- Always review translated flowcharts
- Verify technical terms match glossary
- Check diagram readability

---

## 📞 Support

### Need Help?
- **Issue**: Shape not translating → Check shape type (vector vs image)
- **Issue**: Performance slow → Reduce batch size or sheets
- **Issue**: File won't open → Re-download or try different Excel version

### Feature Requests
Current roadmap:
- [ ] Image OCR re-integration (hybrid approach)
- [ ] Parallel sheet processing
- [ ] Advanced shape formatting preservation
- [ ] Shape relationship detection (connected flowcharts)

---

## 🎉 Summary

**You can now translate Excel files with flowcharts!**

✅ Shapes preserved  
✅ Text translated  
✅ Structure intact  
✅ Smart optimization  
✅ Glossary/blacklist support  

**Happy translating! 🚀📊**
