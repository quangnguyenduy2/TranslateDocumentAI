# System Health Dashboard - Testing Documentation

## Overview
The System Health Dashboard is an in-app testing framework that validates core functionality of the TranslateDocumentAI application at runtime.

## Features

### 🎯 Test Categories

#### 1. Core Tests (4 tests)
- **Glossary Matching**: Validates term replacement logic
- **Blacklist Masking**: Tests sensitive data protection (masking/unmasking)
- **Placeholder Extraction**: Validates pattern matching for emails, phones, URLs
- **Case Sensitivity**: Tests case-sensitive vs case-insensitive matching

#### 2. Storage Tests (4 tests)
- **IndexedDB Initialization**: Verifies database creation with correct object stores
- **File Blob Storage**: Tests saving and retrieving binary data
- **Glossary Storage**: Validates CRUD operations for glossary items
- **Blacklist Storage**: Validates CRUD operations for blacklist items

#### 3. Processing Tests (4 tests)
- **Excel Creation**: Tests Excel workbook creation and parsing
- **Rich Text Handling**: Validates rich text formatting preservation
- **Formula Handling**: Tests Excel formula preservation
- **Multiple Worksheets**: Validates handling of multiple sheets

## Accessing the Dashboard

### Method 1: Keyboard Shortcut
Press `Ctrl + Shift + T` anywhere in the application

### Method 2: Footer Link
Click "System Health" in the footer at the bottom of the page

## Using the Dashboard

1. **Open Dashboard**: Use one of the access methods above
2. **Run Tests**: Click "Run All Tests" button
3. **View Results**: 
   - Tests run sequentially
   - Real-time status updates (Pending → Running → Passed/Failed)
   - Expand individual tests to see detailed results
4. **Review Details**:
   - Execution time (milliseconds)
   - Result messages
   - JSON details for debugging

## Test Results

Each test provides:
- ✅ **Pass/Fail Status**: Visual indicator (green/red)
- ⏱️ **Execution Time**: Performance metrics
- 📝 **Message**: Human-readable result
- 🔍 **Details**: JSON object with test-specific data

## Statistics Dashboard

The stats bar shows:
- **Total Tests**: 12 comprehensive tests
- **Executed**: Number of completed tests
- **Passed**: Successfully validated tests
- **Failed**: Tests requiring attention

## Architecture

```
tests/
├── types.ts              # TypeScript interfaces
├── coreTests.ts          # Business logic tests
├── storageTests.ts       # Database tests
├── processingTests.ts    # File processing tests
└── index.ts              # Test aggregator

components/
└── TestDashboard.tsx     # UI component
```

## Adding New Tests

Create a new test in the appropriate test file:

```typescript
export const myNewTest: TestCase = {
  id: 'category-XXX',
  name: 'Test Name',
  description: 'What this test validates',
  category: 'Core' | 'Storage' | 'Processing' | 'UI',
  run: async (): Promise<TestResult> => {
    const startTime = performance.now();
    
    try {
      // Test logic here
      const success = true; // Your validation
      
      return {
        success,
        message: 'Test passed!',
        duration: performance.now() - startTime,
        details: { /* additional data */ }
      };
    } catch (error) {
      return {
        success: false,
        message: error.message,
        duration: performance.now() - startTime
      };
    }
  }
};
```

Then add it to the exports array in the respective test file.

## Best Practices

1. **Test Isolation**: Each test should be independent
2. **Cleanup**: Tests clean up after themselves (temporary data)
3. **Performance**: Keep tests under 1000ms when possible
4. **Error Handling**: Always wrap test logic in try/catch
5. **Details**: Provide meaningful debug information

## Troubleshooting

### Common Issues

**Tests Fail After Updates**
- Check if API contracts changed
- Verify IndexedDB schema version
- Review test expectations

**Slow Test Execution**
- Check network conditions (if tests use external resources)
- Review async operations
- Consider test complexity

**False Positives**
- Verify test data setup
- Check timing issues (async/await)
- Review validation logic

## Version History

- **v1.0.0**: Initial release with 12 tests
  - Core functionality validation
  - Storage layer testing
  - File processing verification

## Support

For issues or questions about the testing framework:
1. Review test details in expanded view
2. Check browser console for errors
3. Verify all dependencies are loaded
4. Contact development team

---

**Note**: This testing framework is designed for development and QA validation. Run tests before major releases to ensure system stability.
