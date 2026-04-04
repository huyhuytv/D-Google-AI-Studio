export interface LorebookEmbeddingRecord {
    id: string; // Primary key: `${uid}_${chunkIndex}`
    uid: string; // Original entry UID
    characterId: string;
    contentHash: string;
    vector: number[];
    updatedAt: number;
}

const DB_NAME = 'LorebookEmbeddingsDB';
const STORE_NAME = 'embeddings';
const DB_VERSION = 2; // Upgraded for chunking support

let dbInstance: IDBDatabase | null = null;

const getDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        if (dbInstance) {
            resolve(dbInstance);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", event);
            reject("Failed to open IndexedDB");
        };

        request.onsuccess = (event) => {
            dbInstance = (event.target as IDBOpenDBRequest).result;
            resolve(dbInstance);
        };

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (event.oldVersion < 2) {
                // Clear old store if it exists
                if (db.objectStoreNames.contains(STORE_NAME)) {
                    db.deleteObjectStore(STORE_NAME);
                }
            }
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('characterId', 'characterId', { unique: false });
                store.createIndex('uid', 'uid', { unique: false });
            }
        };
    });
};

export const saveEmbedding = async (record: LorebookEmbeddingRecord): Promise<void> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(record);

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e);
    });
};

export const getEmbedding = async (uid: string): Promise<LorebookEmbeddingRecord | null> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(uid);

        request.onsuccess = (event) => {
            resolve((event.target as IDBRequest).result || null);
        };
        request.onerror = (e) => reject(e);
    });
};

export const getEmbeddingsByCharacter = async (characterId: string): Promise<LorebookEmbeddingRecord[]> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('characterId');
        const request = index.getAll(characterId);

        request.onsuccess = (event) => {
            resolve((event.target as IDBRequest).result || []);
        };
        request.onerror = (e) => reject(e);
    });
};

export const getEmbeddingsByUid = async (uid: string): Promise<LorebookEmbeddingRecord[]> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('uid');
        const request = index.getAll(uid);

        request.onsuccess = (event) => {
            resolve((event.target as IDBRequest).result || []);
        };
        request.onerror = (e) => reject(e);
    });
};

export const deleteEmbeddingsByUid = async (uid: string): Promise<void> => {
    const records = await getEmbeddingsByUid(uid);
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        let completed = 0;
        if (records.length === 0) {
            resolve();
            return;
        }

        records.forEach(record => {
            const request = store.delete(record.id);
            request.onsuccess = () => {
                completed++;
                if (completed === records.length) resolve();
            };
            request.onerror = (e) => reject(e);
        });
    });
};

export const clearEmbeddingsByCharacter = async (characterId: string): Promise<void> => {
    const records = await getEmbeddingsByCharacter(characterId);
    const db = await getDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        let completed = 0;
        if (records.length === 0) {
            resolve();
            return;
        }

        records.forEach(record => {
            const request = store.delete(record.id);
            request.onsuccess = () => {
                completed++;
                if (completed === records.length) resolve();
            };
            request.onerror = (e) => reject(e);
        });
    });
};
