const DB_NAME = "onpro-document-blobs";
const STORE = "blobs";
const DB_VERSION = 1;

type BlobRecord = {
  dataUrl: string;
  updatedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB open failed"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
      }),
  );
}

export async function putDocumentBlob(key: string, dataUrl: string): Promise<void> {
  const record: BlobRecord = { dataUrl, updatedAt: new Date().toISOString() };
  await withStore("readwrite", (store) => store.put(record, key));
}

export async function getDocumentBlob(key: string): Promise<string | null> {
  try {
    const record = await withStore<BlobRecord | undefined>("readonly", (store) => store.get(key));
    return record?.dataUrl ?? null;
  } catch {
    return null;
  }
}

export async function deleteDocumentBlob(key: string): Promise<void> {
  try {
    await withStore("readwrite", (store) => store.delete(key));
  } catch {
    /* ignore */
  }
}
