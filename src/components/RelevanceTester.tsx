import React, { useState } from 'react';
import { generateEmbedding, cosineSimilarity, getCachedEmbeddings, ensureEmbeddingsLoaded } from '../services/embeddingService';
import type { WorldInfoEntry } from '../types';
import { getGlobalSmartScanSettings } from '../services/settingsService';

interface RelevanceTesterProps {
    characterId: string;
    entries: WorldInfoEntry[];
    onClose: () => void;
}

export const RelevanceTester: React.FC<RelevanceTesterProps> = ({ characterId, entries, onClose }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{ entry: WorldInfoEntry, score: number }[]>([]);
    const [isTesting, setIsTesting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleTest = async () => {
        if (!query.trim()) return;
        setIsTesting(true);
        setError(null);
        try {
            const inputEmbedding = await generateEmbedding(query);
            await ensureEmbeddingsLoaded(characterId);
            const existingEmbeddings = getCachedEmbeddings(characterId);
            
            // Create a map for O(1) lookup
            const entryMap = new Map(entries.map(e => [e.uid, e]));
            
            const scoredChunks = existingEmbeddings.map(record => {
                const entry = entryMap.get(record.uid);
                return {
                    entry,
                    uid: record.uid,
                    score: cosineSimilarity(inputEmbedding, record.vector)
                };
            }).filter(item => item.entry !== undefined) as { entry: WorldInfoEntry, uid: string, score: number }[];
            
            // Aggregate scores by UID (take the max score among chunks for a given UID)
            const maxScoreByUid = new Map<string, { entry: WorldInfoEntry, score: number }>();
            scoredChunks.forEach(chunk => {
                const existing = maxScoreByUid.get(chunk.uid);
                if (!existing || chunk.score > existing.score) {
                    maxScoreByUid.set(chunk.uid, { entry: chunk.entry, score: chunk.score });
                }
            });

            const scoredEntries = Array.from(maxScoreByUid.values());
            scoredEntries.sort((a, b) => b.score - a.score);
            setResults(scoredEntries);
        } catch (err: any) {
            console.error("Relevance Test Error:", err);
            setError(err.message || "Lỗi khi kiểm tra độ liên quan.");
        } finally {
            setIsTesting(false);
        }
    };

    const settings = getGlobalSmartScanSettings();
    const threshold = settings.semantic_threshold || 0.7;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-slate-800">
                    <h2 className="text-xl font-bold text-sky-400">Relevance Tester (Kiểm tra Ngữ nghĩa)</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-white ">
                        ✕
                    </button>
                </div>
                
                <div className="p-4 border-b border-slate-800 bg-slate-800/50">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleTest()}
                            placeholder="Nhập câu hỏi hoặc ngữ cảnh để kiểm tra..."
                            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-sky-500"
                        />
                        <button
                            onClick={handleTest}
                            disabled={isTesting || !query.trim()}
                            className="bg-sky-600 hover:bg-sky-500 text-white px-6 py-2 rounded-lg font-medium  disabled:opacity-50"
                        >
                            {isTesting ? 'Đang kiểm tra...' : 'Kiểm tra'}
                        </button>
                    </div>
                    {error && <div className="text-red-400 text-sm mt-2">{error}</div>}
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {results.length === 0 && !isTesting && !error && (
                        <div className="text-center text-slate-500 py-10">
                            Nhập truy vấn để xem các mục Lorebook liên quan nhất.
                        </div>
                    )}
                    
                    {results.map((result, idx) => {
                        const isAboveThreshold = result.score >= threshold;
                        return (
                            <div 
                                key={result.entry.uid || idx} 
                                className={`p-3 rounded-lg border ${isAboveThreshold ? 'bg-sky-900/20 border-sky-500/30' : 'bg-slate-800/30 border-slate-700/50'} flex flex-col gap-1`}
                            >
                                <div className="flex justify-between items-start">
                                    <div className="font-medium text-slate-200">
                                        {result.entry.keys.join(', ')}
                                    </div>
                                    <div className={`text-sm font-mono font-bold ${isAboveThreshold ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {(result.score * 100).toFixed(1)}%
                                    </div>
                                </div>
                                <div className="text-sm text-slate-400 line-clamp-2">
                                    {result.entry.content}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
