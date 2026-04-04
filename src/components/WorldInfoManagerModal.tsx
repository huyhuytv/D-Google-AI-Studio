
import React, { useEffect, useRef, useState } from 'react';
import type { WorldInfoEntry } from '../types';
import { ToggleInput } from './ui/ToggleInput';
import { PlacementControl } from './ui/PlacementControl';
import { RelevanceTester } from './RelevanceTester';
import { useEmbeddingSyncStatus } from '../hooks/useEmbeddingSyncStatus'; // NEW

interface WorldInfoManagerModalProps {
    isOpen: boolean;
    onClose: () => void;
    entries: WorldInfoEntry[];
    worldInfoState: Record<string, boolean>;
    worldInfoPinned: Record<string, boolean>;
    worldInfoPlacement: Record<string, 'before' | 'after' | undefined>;
    onUpdate: (newState: Record<string, boolean>) => void;
    onUpdatePinned: (newPinnedState: Record<string, boolean>) => void;
    onUpdatePlacement: (newPlacementState: Record<string, 'before' | 'after' | undefined>) => void;
    characterId?: string; // NEW
}

const WorldInfoItem: React.FC<{
    entry: WorldInfoEntry;
    isEnabled: boolean;
    isPinned: boolean;
    placement: 'before' | 'after' | undefined;
    onToggle: (uid: string, isEnabled: boolean) => void;
    onPin: (uid: string, isPinned: boolean) => void;
    onPlacementChange: (uid: string, val: 'before' | 'after' | undefined) => void;
    syncStatus?: 'synced' | 'needs_sync' | 'not_synced';
}> = ({ entry, isEnabled, isPinned, placement, onToggle, onPin, onPlacementChange, syncStatus }) => {
    if (!entry.uid) return null;

    const getStatusIcon = () => {
        if (!syncStatus) return null;
        switch (syncStatus) {
            case 'synced':
                return <span title="Đã đồng bộ Semantic" className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]"></span>;
            case 'needs_sync':
                return <span title="Cần đồng bộ Semantic" className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.8)] "></span>;
            case 'not_synced':
                return <span title="Chưa đồng bộ Semantic" className="w-2 h-2 rounded-full bg-slate-500"></span>;
        }
    };

    return (
        <div className={`bg-slate-700/50 border border-slate-600 rounded-lg p-4 flex flex-col gap-3  ${isPinned ? 'ring-1 ring-amber-500/50 bg-slate-700/80' : ''}`}>
            <div className="flex justify-between items-start">
                 <div>
                    <h3 className="font-bold text-base text-sky-300 flex items-center gap-2">
                        {getStatusIcon()}
                        {entry.comment || 'Mục không có tên'}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-mono">Keys: {(entry.keys || []).join(', ')}</p>
                 </div>
            </div>

            <div className="bg-slate-800/50 rounded p-2 text-sm text-slate-300 max-h-32 overflow-y-auto custom-scrollbar whitespace-pre-wrap font-sans border border-slate-700/50">
                {entry.content}
            </div>

            <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-600/30 gap-y-2">
                 <div className="flex items-center gap-3 flex-wrap">
                     <div className="flex items-center gap-2 bg-slate-800/50 px-2 py-1 rounded border border-slate-600/30">
                         <span className={`text-xs font-semibold ${isEnabled ? 'text-slate-300' : 'text-slate-500'}`}>{isEnabled ? 'Bật' : 'Tắt'}</span>
                         <ToggleInput label="" checked={isEnabled} onChange={(checked) => onToggle(entry.uid!, checked)} clean />
                     </div>
                     <PlacementControl value={placement} onChange={(val) => onPlacementChange(entry.uid!, val)} className="min-w-[150px]" />
                 </div>

                 <button onClick={() => onPin(entry.uid!, !isPinned)} className={`px-3 py-1.5 rounded text-xs font-bold  flex items-center gap-1 ${isPinned ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-sm shadow-amber-500/20' : 'bg-slate-600 hover:bg-slate-500 text-slate-300'}`}>
                    <span aria-hidden="true">📌</span>
                    <span>{isPinned ? 'Đã ghim' : 'Ghim'}</span>
                 </button>
            </div>
        </div>
    );
};

export const WorldInfoManagerModal: React.FC<WorldInfoManagerModalProps> = ({ isOpen, onClose, entries, worldInfoState, worldInfoPinned, worldInfoPlacement, onUpdate, onUpdatePinned, onUpdatePlacement, characterId }) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);
    const [showRelevanceTester, setShowRelevanceTester] = useState(false);

    // Sync Status Logic
    const { 
        statusMap, isSyncing, syncProgress, syncedCount, totalCount, handleSync 
    } = useEmbeddingSyncStatus(characterId || '', entries);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => { closeButtonRef.current?.focus(); }, 100);
            const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

    const handleToggle = (uid: string, isEnabled: boolean) => onUpdate({ ...worldInfoState, [uid]: isEnabled });
    const handlePin = (uid: string, isPinned: boolean) => onUpdatePinned({ ...worldInfoPinned, [uid]: isPinned });
    const handlePlacementChange = (uid: string, val: 'before' | 'after' | undefined) => onUpdatePlacement({ ...worldInfoPlacement, [uid]: val });

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70  flex items-center justify-center z-[100] p-4" onClick={onClose}>
            <div ref={modalRef} className="bg-slate-800 border border-slate-600 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-slate-700 flex-shrink-0 bg-slate-900/50 rounded-t-xl flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-sky-400">Quản lý World Info Động</h2>
                        <p className="text-sm text-slate-400 mt-1">Kiểm soát trạng thái, ghim và vị trí chèn của các mục World Info.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {characterId && (
                            <div className="flex items-center gap-3 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 shadow-inner">
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Semantic Sync</span>
                                    <span className="text-[10px] text-slate-500 font-mono">{syncedCount}/{totalCount}</span>
                                </div>
                                {isSyncing ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-sky-500  "
                                                style={{ width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-sky-400  font-medium">Đang chạy...</span>
                                    </div>
                                ) : (
                                    <button 
                                        onClick={handleSync}
                                        disabled={syncedCount === totalCount && totalCount > 0}
                                        title={syncedCount === totalCount && totalCount > 0 ? 'Tất cả đã được đồng bộ' : 'Đồng bộ hóa dữ liệu tìm kiếm ngữ nghĩa'}
                                        className={`p-1.5 rounded-md  flex items-center justify-center ${
                                            syncedCount === totalCount && totalCount > 0
                                                ? 'text-emerald-500 opacity-50 cursor-default'
                                                : 'bg-sky-600 hover:bg-sky-500 text-white  active:scale-95'
                                        }`}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    </button>
                                )}
                            </div>
                        )}
                        
                        {characterId && (
                            <button 
                                onClick={() => setShowRelevanceTester(true)}
                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold flex items-center gap-2  shadow-lg shadow-indigo-900/20"
                            >
                                <span className="text-sm">🔍</span>
                                Tester
                            </button>
                        )}
                    </div>
                </header>
                <main className="p-4 flex-grow overflow-y-auto custom-scrollbar space-y-4 bg-slate-800">
                    {entries.length === 0 ? (
                        <p className="text-slate-500 text-center italic py-10">Nhân vật này không có mục World Info nào.</p>
                    ) : (
                        entries.map(entry => (
                            <WorldInfoItem
                                key={entry.uid}
                                entry={entry}
                                isEnabled={worldInfoState[entry.uid!] ?? (entry.enabled !== false)}
                                isPinned={!!worldInfoPinned[entry.uid!]}
                                placement={worldInfoPlacement[entry.uid!]}
                                syncStatus={statusMap[entry.uid!]}
                                onToggle={handleToggle}
                                onPin={handlePin}
                                onPlacementChange={handlePlacementChange}
                            />
                        ))
                    )}
                </main>
                <footer className="p-4 border-t border-slate-700 flex justify-end gap-3 flex-shrink-0 bg-slate-900/50 rounded-b-xl">
                    <button ref={closeButtonRef} onClick={onClose} className="px-6 py-2 text-sm font-bold rounded-lg bg-sky-600 hover:bg-sky-500 text-white ">Đóng</button>
                </footer>
            </div>

            {showRelevanceTester && characterId && (
                <RelevanceTester 
                    characterId={characterId}
                    entries={entries}
                    onClose={() => setShowRelevanceTester(false)}
                />
            )}
        </div>
    );
};
