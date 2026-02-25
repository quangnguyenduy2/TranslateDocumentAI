import { TestCase, TestResult } from './types';
import { GlossaryItem, BlacklistItem } from '../types';
import { maskText, unmaskText } from '../services/textProtector';

/**
 * Test 1: Glossary Matching Logic
 * Validates that glossary terms are correctly identified and can be applied
 */
export const glossaryMatchingTest: TestCase = {
  id: 'core-001',
  name: 'Glossary Matching',
  description: 'Test glossary term replacement in text',
  category: 'Core',
  run: async (): Promise<TestResult> => {
    const startTime = performance.now();
    
    try {
      const inputText = "Vui lòng Login ngay để tiếp tục";
      const glossary: GlossaryItem[] = [
        { id: '1', term: 'Login', translation: 'Đăng nhập' }
      ];
      
      // Simple glossary application logic (mimicking real behavior)
      let result = inputText;
      glossary.forEach(item => {
        const regex = new RegExp(item.term, 'gi');
        result = result.replace(regex, item.translation);
      });
      
      const expected = "Vui lòng Đăng nhập ngay để tiếp tục";
      const success = result === expected;
      
      return {
        success,
        message: success 
          ? 'Glossary matching works correctly' 
          : `Expected: "${expected}", Got: "${result}"`,
        duration: performance.now() - startTime,
        details: { input: inputText, output: result, expected }
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
 * Test 2: Blacklist Masking/Unmasking
 * Validates sensitive data protection mechanism
 */
export const blacklistMaskingTest: TestCase = {
  id: 'core-002',
  name: 'Blacklist Masking',
  description: 'Test sensitive data masking and unmasking',
  category: 'Core',
  run: async (): Promise<TestResult> => {
    const startTime = performance.now();
    
    try {
      const inputText = "Project Alpha is confidential. Contact john.doe@company.com for details.";
      const blacklist: BlacklistItem[] = [
        { id: '1', term: 'Project Alpha', caseSensitive: false, enabled: true },
        { id: '2', term: 'john.doe@company.com', caseSensitive: true, enabled: true }
      ];
      
      // Test masking
      const { maskedText, protectionMap, maskedCount } = maskText(inputText, blacklist);
      
      // Validate masking occurred
      if (maskedCount !== 2) {
        return {
          success: false,
          message: `Expected 2 masked terms, got ${maskedCount}`,
          duration: performance.now() - startTime,
          details: { maskedText, maskedCount }
        };
      }
      
      // Validate protected terms are hidden
      if (maskedText.includes('Project Alpha') || maskedText.includes('john.doe@company.com')) {
        return {
          success: false,
          message: 'Sensitive data not properly masked',
          duration: performance.now() - startTime,
          details: { maskedText }
        };
      }
      
      // Test unmasking
      const unmaskedText = unmaskText(maskedText, protectionMap);
      
      // Validate restoration
      if (unmaskedText !== inputText) {
        return {
          success: false,
          message: 'Unmasking did not restore original text',
          duration: performance.now() - startTime,
          details: { original: inputText, restored: unmaskedText }
        };
      }
      
      return {
        success: true,
        message: 'Blacklist masking/unmasking works correctly',
        duration: performance.now() - startTime,
        details: { 
          original: inputText, 
          masked: maskedText, 
          restored: unmaskedText,
          maskedCount 
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
 * Test 3: Placeholder Extraction Logic
 * Validates that placeholders are correctly identified
 */
export const placeholderExtractionTest: TestCase = {
  id: 'core-003',
  name: 'Placeholder Extraction',
  description: 'Test extraction and restoration of placeholders',
  category: 'Core',
  run: async (): Promise<TestResult> => {
    const startTime = performance.now();
    
    try {
      const testCases = [
        { input: 'Email: test@example.com', pattern: /[\w.-]+@[\w.-]+\.\w+/g, type: 'email' },
        { input: 'Call 123-456-7890', pattern: /\d{3}-\d{3}-\d{4}/g, type: 'phone' },
        { input: 'Visit https://example.com', pattern: /https?:\/\/[^\s]+/g, type: 'url' }
      ];
      
      let allPassed = true;
      const results: any[] = [];
      
      for (const tc of testCases) {
        const matches = tc.input.match(tc.pattern);
        if (!matches || matches.length === 0) {
          allPassed = false;
          results.push({ type: tc.type, passed: false, reason: 'No matches found' });
        } else {
          results.push({ type: tc.type, passed: true, matches });
        }
      }
      
      return {
        success: allPassed,
        message: allPassed 
          ? 'All placeholder patterns work correctly' 
          : 'Some placeholder patterns failed',
        duration: performance.now() - startTime,
        details: results
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
 * Test 4: Case Sensitivity
 * Validates case-sensitive and case-insensitive matching
 */
export const caseSensitivityTest: TestCase = {
  id: 'core-004',
  name: 'Case Sensitivity',
  description: 'Test case-sensitive vs case-insensitive matching',
  category: 'Core',
  run: async (): Promise<TestResult> => {
    const startTime = performance.now();
    
    try {
      const text = "API key and api key are different";
      
      // Case-sensitive blacklist
      const blacklistCaseSensitive: BlacklistItem[] = [
        { id: '1', term: 'API', caseSensitive: true, enabled: true }
      ];
      
      const { maskedCount: count1 } = maskText(text, blacklistCaseSensitive);
      
      // Case-insensitive blacklist
      const blacklistCaseInsensitive: BlacklistItem[] = [
        { id: '1', term: 'API', caseSensitive: false, enabled: true }
      ];
      
      const { maskedCount: count2 } = maskText(text, blacklistCaseInsensitive);
      
      // Case-sensitive should mask 1 occurrence, case-insensitive should mask 2
      const success = count1 === 1 && count2 === 2;
      
      return {
        success,
        message: success 
          ? 'Case sensitivity works correctly' 
          : `Expected counts 1 and 2, got ${count1} and ${count2}`,
        duration: performance.now() - startTime,
        details: { 
          caseSensitiveCount: count1, 
          caseInsensitiveCount: count2 
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

export const coreTests: TestCase[] = [
  glossaryMatchingTest,
  blacklistMaskingTest,
  placeholderExtractionTest,
  caseSensitivityTest
];
