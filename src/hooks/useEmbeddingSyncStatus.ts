import { useState, useEffect, useCallback } from 'react';
import type { WorldInfoEntry } from '../types';
import { hashContent, formatLorebookContentForEmbedding, syncEmbeddings, getCachedEmbeddings, ensureEmbeddingsLoaded } from '../services/embeddingService';
import { useToast } from '../components/ToastSystem';

export type SyncStatus = 'synced' | 'needs_sync' | 'not_synced';

export const useEmbeddingSyncStatus = (characterId: string, entries: WorldInfoEntry[]) => {
    const [statusMap, setStatusMap] = useState<Record<string, SyncStatus>>({});
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
    const { showToast } = useToast();

    const checkStatus = useCallback(async () => {
        if (!characterId) return;
        
        await ensureEmbeddingsLoaded(characterId);
        const cacheArray = getCachedEmbeddings(characterId);
        
        // Group by UID to check if any chunks exist for a UID
        const cacheMap = new Map<string, any[]>();
        cacheArray.forEach(r => {
            if (!cacheMap.has(r.uid)) cacheMap.set(r.uid, []);
            cacheMap.get(r.uid)!.push(r);
        });

        const newStatusMap: Record<string, SyncStatus> = {};
        
        const validEntries = entries.filter(e => e.uid && e.content && e.content.trim().length > 0);

        await Promise.all(validEntries.map(async (entry) => {
            if (!entry.uid) return;
            
            const existingRecords = cacheMap.get(entry.uid);
            if (!existingRecords || existingRecords.length === 0) {
                newStatusMap[entry.uid] = 'not_synced';
            } else {
                const contentToEmbed = formatLorebookContentForEmbedding(entry);
                const currentHash = await hashContent(contentToEmbed);
                // All chunks for a UID share the same contentHash, so checking the first one is sufficient
                if (existingRecords[0].contentHash !== currentHash) {
                    newStatusMap[entry.uid] = 'needs_sync';
                } else {
                    newStatusMap[entry.uid] = 'synced';
                }
            }
        }));
        
        setStatusMap(newStatusMap);
    }, [characterId, entries]);

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    const handleSync = async () => {
        if (!characterId || entries.length === 0) return;
        
        setIsSyncing(true);
        try {
            const enabledEntries = entries.filter(e => e.enabled !== false);
            await syncEmbeddings(
                characterId, 
                enabledEntries, 
                (current, total) => setSyncProgress({ current, total })
            );
            showToast('Đồng bộ Semantic Search thành công!', 'success');
            await checkStatus();
        } catch (error: any) {
            console.error("Sync error:", error);
            showToast(`Lỗi đồng bộ: ${error.message}`, 'error');
        } finally {
            setIsSyncing(false);
            setSyncProgress({ current: 0, total: 0 });
        }
    };

    const validEntries = entries.filter(e => e.uid && e.content && e.content.trim().length > 0 && e.enabled !== false);
    
    // Only count enabled entries as synced
    const syncedCount = validEntries.filter(e => statusMap[e.uid!] === 'synced').length;
    const totalCount = validEntries.length;

    return {
        statusMap,
        isSyncing,
        syncProgress,
        syncedCount,
        totalCount,
        handleSync,
        checkStatus
    };
};
