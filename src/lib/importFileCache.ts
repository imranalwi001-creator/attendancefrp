type CachedFileRecord = {
  key: string;
  name: string;
  type: string;
  lastModified: number;
  blob: Blob;
};

const DB_NAME = 'lms-digiss-import-cache';
const DB_VERSION = 1;
const STORE_NAME = 'files';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

export async function saveImportFile(cacheKey: string, file: File) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    const store = tx.objectStore(STORE_NAME);
    const record: CachedFileRecord = {
      key: cacheKey,
      name: file.name,
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified,
      blob: file,
    };
    store.put(record);
  });
  db.close();
}

export async function loadImportFile(cacheKey: string): Promise<File | null> {
  const db = await openDb();
  const record = await new Promise<CachedFileRecord | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(cacheKey);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result as CachedFileRecord | undefined);
  });
  db.close();

  if (!record?.blob) return null;
  try {
    return new File([record.blob], record.name, { type: record.type, lastModified: record.lastModified });
  } catch {
    return null;
  }
}

export async function clearImportFile(cacheKey: string) {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
    const store = tx.objectStore(STORE_NAME);
    store.delete(cacheKey);
  });
  db.close();
}

