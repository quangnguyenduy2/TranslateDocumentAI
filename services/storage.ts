import { GlossaryItem } from '../types';

const DB_NAME = 'DocuTranslateDB';
const FILE_STORE = 'files';
const GLOSSARY_STORE = 'glossary_store';
const DB_VERSION = 2; // Bump version for schema upgrade

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Store for File Blobs
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE);
      }

      // Store for Glossary (Bulk Data)
      if (!db.objectStoreNames.contains(GLOSSARY_STORE)) {
        // We use 'id' as keyPath
        db.createObjectStore(GLOSSARY_STORE, { keyPath: 'id' });
      }
    };
  });
};

// --- FILE STORAGE ---

export const saveFileToDB = async (id: string, blob: Blob): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([FILE_STORE], 'readwrite');
      const store = transaction.objectStore(FILE_STORE);
      const request = store.put(blob, id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error("IndexedDB Save Error:", error);
    throw error;
  }
};

export const getFileFromDB = async (id: string): Promise<Blob | undefined> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([FILE_STORE], 'readonly');
      const store = transaction.objectStore(FILE_STORE);
      const request = store.get(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  } catch (error) {
    console.error("IndexedDB Get Error:", error);
    return undefined;
  }
};

// --- GLOSSARY STORAGE (High Performance) ---

export const saveGlossaryToDB = async (items: GlossaryItem[]): Promise<void> => {
  if (items.length === 0) return;
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([GLOSSARY_STORE], 'readwrite');
    const store = transaction.objectStore(GLOSSARY_STORE);
    
    // Clear existing first (Snapshot replacement strategy)
    // Or we could append, but usually glossary import replaces or merges in memory first
    const clearReq = store.clear();
    
    clearReq.onsuccess = () => {
      items.forEach(item => {
        store.put(item);
      });
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
    
    clearReq.onerror = () => reject(clearReq.error);
  });
};

export const getGlossaryFromDB = async (): Promise<GlossaryItem[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([GLOSSARY_STORE], 'readonly');
    const store = transaction.objectStore(GLOSSARY_STORE);
    const request = store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

export const clearGlossaryDB = async (): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([GLOSSARY_STORE], 'readwrite');
    const store = transaction.objectStore(GLOSSARY_STORE);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};