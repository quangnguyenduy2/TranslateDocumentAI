import { TestCase, TestResult } from './types';
import { initDB, saveFileToDB, getFileFromDB, saveGlossaryToDB, getGlossaryFromDB, saveBlacklistToDB, getBlacklistFromDB } from '../services/storage';
import { GlossaryItem, BlacklistItem } from '../types';

/**
 * Test 1: IndexedDB Initialization
 * Validates that IndexedDB can be opened and has correct stores
 */
export const indexedDBInitTest: TestCase = {
  id: 'storage-001',
  name: 'IndexedDB Initialization',
  description: 'Test IndexedDB database initialization',
  category: 'Storage',
  run: async (): Promise<TestResult> => {
    const startTime = performance.now();
    
    try {
      const db = await initDB();
      
      const expectedStores = ['files', 'glossary_store', 'blacklist_store'];
      const actualStores = Array.from(db.objectStoreNames);
      
      const hasAllStores = expectedStores.every(store => actualStores.includes(store));
      
      db.close();
      
      return {
        success: hasAllStores,
        message: hasAllStores 
          ? 'IndexedDB initialized with all required stores' 
          : `Missing stores. Expected: ${expectedStores.join(', ')}, Found: ${actualStores.join(', ')}`,
        duration: performance.now() - startTime,
        details: { expectedStores, actualStores }
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
 * Test 2: File Storage (Blob)
 * Validates that files can be saved and retrieved from IndexedDB
 */
export const fileBlobStorageTest: TestCase = {
  id: 'storage-002',
  name: 'File Blob Storage',
  description: 'Test saving and retrieving blob data',
  category: 'Storage',
  run: async (): Promise<TestResult> => {
    const startTime = performance.now();
    
    try {
      // Create a test blob (simulating a small file)
      const testData = 'Test file content for storage validation';
      const testBlob = new Blob([testData], { type: 'text/plain' });
      const testId = `test-blob-${Date.now()}`;
      
      // Save blob
      await saveFileToDB(testId, testBlob);
      
      // Retrieve blob
      const retrievedBlob = await getFileFromDB(testId);
      
      if (!retrievedBlob) {
        return {
          success: false,
          message: 'Failed to retrieve saved blob',
          duration: performance.now() - startTime
        };
      }
      
      // Validate size
      const sizeMatch = retrievedBlob.size === testBlob.size;
      
      // Validate content
      const retrievedText = await retrievedBlob.text();
      const contentMatch = retrievedText === testData;
      
      const success = sizeMatch && contentMatch;
      
      return {
        success,
        message: success 
          ? 'Blob storage works correctly' 
          : `Validation failed. Size match: ${sizeMatch}, Content match: ${contentMatch}`,
        duration: performance.now() - startTime,
        details: { 
          originalSize: testBlob.size, 
          retrievedSize: retrievedBlob.size,
          contentMatch 
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
 * Test 3: Glossary Storage
 * Validates glossary CRUD operations
 */
export const glossaryStorageTest: TestCase = {
  id: 'storage-003',
  name: 'Glossary Storage',
  description: 'Test saving and retrieving glossary data',
  category: 'Storage',
  run: async (): Promise<TestResult> => {
    const startTime = performance.now();
    
    try {
      const testGlossary: GlossaryItem[] = [
        { id: 'test-1', term: 'Hello', translation: 'Xin chào' },
        { id: 'test-2', term: 'Goodbye', translation: 'Tạm biệt' },
        { id: 'test-3', term: 'Thank you', translation: 'Cảm ơn' }
      ];
      
      // Save glossary
      await saveGlossaryToDB(testGlossary);
      
      // Retrieve glossary
      const retrieved = await getGlossaryFromDB();
      
      // Validate count
      if (retrieved.length < testGlossary.length) {
        return {
          success: false,
          message: `Expected ${testGlossary.length} items, got ${retrieved.length}`,
          duration: performance.now() - startTime,
          details: { expected: testGlossary.length, actual: retrieved.length }
        };
      }
      
      // Validate content (check if test items exist)
      const testIds = testGlossary.map(g => g.id);
      const retrievedIds = retrieved.map(g => g.id);
      const allFound = testIds.every(id => retrievedIds.includes(id));
      
      return {
        success: allFound,
        message: allFound 
          ? 'Glossary storage works correctly' 
          : 'Some glossary items were not found after retrieval',
        duration: performance.now() - startTime,
        details: { 
          saved: testGlossary.length, 
          retrieved: retrieved.length,
          testIds,
          retrievedIds
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
 * Test 4: Blacklist Storage
 * Validates blacklist CRUD operations
 */
export const blacklistStorageTest: TestCase = {
  id: 'storage-004',
  name: 'Blacklist Storage',
  description: 'Test saving and retrieving blacklist data',
  category: 'Storage',
  run: async (): Promise<TestResult> => {
    const startTime = performance.now();
    
    try {
      const testBlacklist: BlacklistItem[] = [
        { id: 'test-1', term: 'Project Alpha', caseSensitive: false, enabled: true },
        { id: 'test-2', term: 'API_KEY', caseSensitive: true, enabled: true }
      ];
      
      // Save blacklist
      await saveBlacklistToDB(testBlacklist);
      
      // Retrieve blacklist
      const retrieved = await getBlacklistFromDB();
      
      // Validate count
      if (retrieved.length < testBlacklist.length) {
        return {
          success: false,
          message: `Expected ${testBlacklist.length} items, got ${retrieved.length}`,
          duration: performance.now() - startTime,
          details: { expected: testBlacklist.length, actual: retrieved.length }
        };
      }
      
      // Validate content
      const testIds = testBlacklist.map(b => b.id);
      const retrievedIds = retrieved.map(b => b.id);
      const allFound = testIds.every(id => retrievedIds.includes(id));
      
      return {
        success: allFound,
        message: allFound 
          ? 'Blacklist storage works correctly' 
          : 'Some blacklist items were not found after retrieval',
        duration: performance.now() - startTime,
        details: { 
          saved: testBlacklist.length, 
          retrieved: retrieved.length,
          testIds,
          retrievedIds
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

export const storageTests: TestCase[] = [
  indexedDBInitTest,
  fileBlobStorageTest,
  glossaryStorageTest,
  blacklistStorageTest
];
