import { getApiKey, getGlobalSmartScanSettings } from './settingsService';
import { GoogleGenAI } from '@google/genai';
import { getEmbeddingsByCharacter, saveEmbedding, deleteEmbeddingsByUid, LorebookEmbeddingRecord } from './embeddingDb';
import type { WorldInfoEntry } from '../types';
import { useChatStore } from '../store/chatStore';

// --- RAM CACHE ---
// Map<characterId, Map<uid, LorebookEmbeddingRecord[]>>
const embeddingCache = new Map<string, Map<string, LorebookEmbeddingRecord[]>>();
const loadingPromises = new Map<string, Promise<void>>();

export const loadEmbeddingsToCache = async (characterId: string): Promise<void> => {
    if (!characterId) return;
    const records = await getEmbeddingsByCharacter(characterId);
    const charCache = new Map<string, LorebookEmbeddingRecord[]>();
    records.forEach(r => {
        if (!charCache.has(r.uid)) charCache.set(r.uid, []);
        charCache.get(r.uid)!.push(r);
    });
    embeddingCache.set(characterId, charCache);
};

export const ensureEmbeddingsLoaded = async (characterId: string): Promise<void> => {
    if (!characterId) return;
    if (embeddingCache.has(characterId)) return;
    
    // Prevent race conditions with a promise cache
    if (!loadingPromises.has(characterId)) {
        const promise = loadEmbeddingsToCache(characterId).finally(() => {
            loadingPromises.delete(characterId);
        });
        loadingPromises.set(characterId, promise);
    }
    return loadingPromises.get(characterId);
};

export const getCachedEmbeddings = (characterId: string): LorebookEmbeddingRecord[] => {
    const charCache = embeddingCache.get(characterId);
    if (!charCache) return [];
    const allRecords: LorebookEmbeddingRecord[] = [];
    for (const records of charCache.values()) {
        allRecords.push(...records);
    }
    return allRecords;
};

export const clearEmbeddingCache = (characterId: string): void => {
    embeddingCache.delete(characterId);
};
// -----------------

const EMBEDDING_MODEL = 'gemini-embedding-2-preview';
const MAX_CHUNK_SIZE = 7500;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const generateBatchEmbeddings = async (ai: GoogleGenAI, texts: string[]): Promise<number[][]> => {
    if (!texts || texts.length === 0) return [];

    const MAX_API_BATCH_SIZE = 100; // Gemini API limit per request
    const allEmbeddings: number[][] = [];

    for (let i = 0; i < texts.length; i += MAX_API_BATCH_SIZE) {
        const batchTexts = texts.slice(i, i + MAX_API_BATCH_SIZE);
        
        // --- NETWORK LOGGING ---
        const totalChars = batchTexts.reduce((sum, t) => sum + t.length, 0);
        useChatStore.getState().addNetworkLog({
            id: `embedding-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            timestamp: Date.now(),
            url: `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: {
                model: EMBEDDING_MODEL,
                contents: batchTexts,
                _meta: { batchSize: batchTexts.length, totalChars }
            },
            source: 'gemini'
        });
        // -----------------------

        const result = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: batchTexts,
        });
        
        if (result.embeddings && result.embeddings.length > 0) {
            allEmbeddings.push(...result.embeddings.map(e => e.values || []));
        } else {
            throw new Error("API trả về mảng embedding rỗng hoặc không hợp lệ.");
        }
        
        // Small delay between API requests if there are more batches
        if (i + MAX_API_BATCH_SIZE < texts.length) {
            await sleep(300);
        }
    }

    return allEmbeddings;
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("Missing Gemini API Key. Please configure it in settings.");
    }
    const ai = new GoogleGenAI({ apiKey });
    const results = await generateBatchEmbeddings(ai, [text]);
    return results[0] || [];
};

export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// Helper to hash content to detect changes
export const hashContent = async (content: string): Promise<string> => {
    const msgBuffer = new TextEncoder().encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export const formatLorebookContentForEmbedding = (entry: WorldInfoEntry): string => {
    const name = entry.comment ? `Name: ${entry.comment} | ` : '';
    const keys = entry.keys && entry.keys.length > 0 ? `Keys: ${entry.keys.join(', ')} | ` : '';
    return `${name}${keys}Content: ${entry.content || ''}`;
};

export const chunkText = (text: string, maxSize: number = MAX_CHUNK_SIZE): string[] => {
    if (text.length <= maxSize) return [text];
    
    const chunks: string[] = [];
    let currentChunk = "";
    
    const paragraphs = text.split('\n');
    
    for (const p of paragraphs) {
        if (currentChunk.length + p.length + 1 > maxSize) {
            if (currentChunk.length > 0) {
                chunks.push(currentChunk);
                currentChunk = "";
            }
            
            if (p.length > maxSize) {
                let remaining = p;
                while (remaining.length > 0) {
                    chunks.push(remaining.slice(0, maxSize));
                    remaining = remaining.slice(maxSize);
                }
            } else {
                currentChunk = p;
            }
        } else {
            currentChunk += (currentChunk.length > 0 ? '\n' : '') + p;
        }
    }
    
    if (currentChunk.length > 0) {
        chunks.push(currentChunk);
    }
    
    return chunks;
};

export const syncEmbeddings = async (
    characterId: string, 
    entries: WorldInfoEntry[], 
    onProgress?: (current: number, total: number) => void
): Promise<void> => {
    if (!characterId) throw new Error("Character ID is required for sync.");
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("Missing Gemini API Key. Please configure it in settings.");
    const ai = new GoogleGenAI({ apiKey });

    // Ensure cache is loaded
    await ensureEmbeddingsLoaded(characterId);
    const charCache = embeddingCache.get(characterId)!;
    
    const validEntries = entries.filter(e => e.uid && e.content && e.content.trim().length > 0);
    const entriesToUpdate: { entry: WorldInfoEntry, chunks: string[], hash: string }[] = [];
    
    // Identify which entries need updating
    await Promise.all(validEntries.map(async (entry) => {
        const contentToEmbed = formatLorebookContentForEmbedding(entry);
        const currentHash = await hashContent(contentToEmbed);
        const existingRecords = charCache.get(entry.uid!);
        
        // If no records or hash mismatch, we need to update
        if (!existingRecords || existingRecords.length === 0 || existingRecords[0].contentHash !== currentHash) {
            const chunks = chunkText(contentToEmbed);
            entriesToUpdate.push({ entry, chunks, hash: currentHash });
        }
    }));

    let currentProgress = validEntries.length - entriesToUpdate.length;
    if (onProgress) onProgress(currentProgress, validEntries.length);

    // Process entries in batches to ensure consistency per entry
    const settings = getGlobalSmartScanSettings();
    const ENTRY_BATCH_SIZE = settings.embedding_batch_size || 30; // Process N entries at a time
    for (let i = 0; i < entriesToUpdate.length; i += ENTRY_BATCH_SIZE) {
        const batchEntries = entriesToUpdate.slice(i, i + ENTRY_BATCH_SIZE);
        
        // Flatten chunks for this batch of entries
        const flatChunks: { entry: WorldInfoEntry, chunk: string, chunkIndex: number, hash: string }[] = [];
        batchEntries.forEach(item => {
            item.chunks.forEach((chunk, index) => {
                flatChunks.push({
                    entry: item.entry,
                    chunk,
                    chunkIndex: index,
                    hash: item.hash
                });
            });
        });

        const textsToEmbed = flatChunks.map(item => item.chunk);
        
        // This will throw immediately if it fails, stopping the sync process
        const vectors = await generateBatchEmbeddings(ai, textsToEmbed);
        
        // Group vectors by entry UID to ensure we process entry by entry
        const vectorsByUid = new Map<string, number[][]>();
        flatChunks.forEach((item, index) => {
            const uid = item.entry.uid!;
            if (!vectorsByUid.has(uid)) vectorsByUid.set(uid, []);
            vectorsByUid.get(uid)!.push(vectors[index]);
        });

        for (const item of batchEntries) {
            const uid = item.entry.uid!;
            const entryVectors = vectorsByUid.get(uid);
            
            // Consistency check: ensure we got vectors for all chunks of this entry
            if (!entryVectors || entryVectors.length !== item.chunks.length || entryVectors.some(v => !v || v.length === 0)) {
                throw new Error(`Dữ liệu trả về bị thiếu cho mục: ${item.entry.comment || uid}`);
            }

            // 1. Clear old records for this UID
            await deleteEmbeddingsByUid(uid);
            charCache.set(uid, []);

            // 2. Save new records
            await Promise.all(item.chunks.map(async (chunk, index) => {
                const vector = entryVectors[index];
                const record: LorebookEmbeddingRecord = {
                    id: `${uid}_${index}`,
                    uid: uid,
                    characterId,
                    contentHash: item.hash,
                    vector,
                    updatedAt: Date.now()
                };
                
                await saveEmbedding(record);
                charCache.get(uid)!.push(record); // Update RAM cache
            }));
        }
        
        currentProgress += batchEntries.length;
        if (onProgress) onProgress(Math.min(currentProgress, validEntries.length), validEntries.length);
        
        // Small delay between batches to be safe
        if (i + ENTRY_BATCH_SIZE < entriesToUpdate.length) {
            await sleep(500);
        }
    }
    
    // Delete embeddings for entries that no longer exist in the provided list
    const validUids = new Set(validEntries.map(e => e.uid));
    for (const [uid, records] of charCache.entries()) {
        if (!validUids.has(uid)) {
            await deleteEmbeddingsByUid(uid);
            charCache.delete(uid);
        }
    }
};

