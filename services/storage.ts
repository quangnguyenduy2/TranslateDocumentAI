import { GlossaryItem, BlacklistItem } from '../types';

const DB_NAME = 'DocuTranslateDB';
const FILE_STORE = 'files';
const GLOSSARY_STORE = 'glossary_store';
const BLACKLIST_STORE = 'blacklist_store';
const DB_VERSION = 3; // Bump version for blacklist store

export const initDB = (): Promise<IDBDatabase> => {
  // Provide a graceful in-memory fallback when running in Node (no indexedDB)
  if (typeof indexedDB === 'undefined') {
    // Create a very small in-memory IndexedDB-like store for tests
    // Stored on globalThis so repeated calls reuse the same DB
    if (!(globalThis as any).__IN_MEMORY_IDB) {
      const stores = new Map<string, Map<any, any>>();
      const storesMeta: Map<string, { keyPath?: string }> = new Map();

      const objectStoreNames: any = {};
      Object.defineProperty(objectStoreNames, 'length', {
        get: () => stores.size
      });
      objectStoreNames.contains = (name: string) => stores.has(name);
      objectStoreNames.item = (i: number) => Array.from(stores.keys())[i];
      objectStoreNames[Symbol.iterator] = function* () {
        yield* stores.keys();
      };

      const db: any = {
        objectStoreNames,
        createObjectStore: (name: string, options?: any) => {
          stores.set(name, new Map());
          if (options && options.keyPath) storesMeta.set(name, { keyPath: options.keyPath });
          else storesMeta.set(name, {});
        },
        transaction: (names: string[] | string, mode?: string) => {
          const storeName = Array.isArray(names) ? names[0] : names;

          const pending: Promise<any>[] = [];

          const transaction: any = {
            objectStore: () => {
              const storeMap = stores.get(storeName) || new Map();
              const meta = storesMeta.get(storeName) || {};

              const requestify = (fn: () => any) => {
                const req: any = {};
                const p = Promise.resolve().then(() => {
                  try {
                    const res = fn();
                    req.result = res;
                    if (typeof req.onsuccess === 'function') req.onsuccess({ target: req });
                    return res;
                  } catch (e) {
                    if (typeof req.onerror === 'function') req.onerror(e);
                    throw e;
                  }
                });
                pending.push(p);
                return req;
              };

              return {
                put: (value: any, key: any) => requestify(() => { 
                  let writeKey = key;
                  if (writeKey === undefined && meta && meta.keyPath) writeKey = (value && (value as any)[meta.keyPath]);
                  storeMap.set(writeKey, value); stores.set(storeName, storeMap); return undefined; 
                }),
                get: (key: any) => requestify(() => storeMap.get(key)),
                clear: () => requestify(() => { storeMap.clear(); stores.set(storeName, storeMap); return undefined; }),
                getAll: () => requestify(() => Array.from(storeMap.values()))
              };
            },
            oncomplete: undefined,
            onerror: undefined,
            error: undefined
          };

          // After microtasks, wait for all pending operations (including ones added later)
          setTimeout(() => {
            const check = () => {
              const snapshot = pending.slice();
              Promise.allSettled(snapshot).then(() => {
                if (pending.length === snapshot.length) {
                  if (typeof transaction.oncomplete === 'function') transaction.oncomplete();
                } else {
                  // New pending operations were added; check again
                  setTimeout(check, 0);
                }
              });
            };
            check();
          }, 0);

          return transaction;
        }
      };

      // initialize stores used by the app
      db.createObjectStore(FILE_STORE);
      db.createObjectStore(GLOSSARY_STORE, { keyPath: 'id' });
      db.createObjectStore(BLACKLIST_STORE, { keyPath: 'id' });

      db.close = () => { /* noop for Node tests */ };
      (globalThis as any).__IN_MEMORY_IDB = db;
    }

    return Promise.resolve((globalThis as any).__IN_MEMORY_IDB as IDBDatabase);
  }

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

      // Store for Blacklist (Protected Terms)
      if (!db.objectStoreNames.contains(BLACKLIST_STORE)) {
        db.createObjectStore(BLACKLIST_STORE, { keyPath: 'id' });
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

// --- BLACKLIST STORAGE ---

export const saveBlacklistToDB = async (items: BlacklistItem[]): Promise<void> => {
  if (items.length === 0) return;
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BLACKLIST_STORE], 'readwrite');
    const store = transaction.objectStore(BLACKLIST_STORE);
    
    const clearReq = store.clear();
    clearReq.onsuccess = () => {
      items.forEach(item => store.put(item));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
    clearReq.onerror = () => reject(clearReq.error);
  });
};

export const getBlacklistFromDB = async (): Promise<BlacklistItem[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BLACKLIST_STORE], 'readonly');
    const store = transaction.objectStore(BLACKLIST_STORE);
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
};

export const clearBlacklistDB = async (): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([BLACKLIST_STORE], 'readwrite');
    const store = transaction.objectStore(BLACKLIST_STORE);
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
};