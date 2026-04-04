
import React, { useState } from 'react';
import type { SystemLogEntry, ChatTurnLog, SummaryQueueItem, NetworkLogEntry, ChatMessage } from '../../types';

// Import sub-components from the new directory
import { ConsoleView } from './Debug/ConsoleView';
import { NetworkLogView } from './Debug/NetworkLogView';
import { SmartScanLogView } from './Debug/SmartScanView';
import { MythicLogView } from './Debug/MythicView';
import { SummariesView } from './Debug/SummariesView';
import { WorldInfoLogView } from './Debug/WorldInfoView';
import { PromptsView, ResponsesView, AiCreatorView } from './Debug/ConversationViews';
import { SelectionLogView } from './Debug/SelectionLogView'; // NEW

interface SummaryStats {
    messageCount: number;
    summaryCount: number;
    contextDepth: number;
    chunkSize: number;
    queueLength: number;
}

interface DebugPanelProps {
    logs: {
        turns: ChatTurnLog[];
        systemLog: SystemLogEntry[];
        smartScanLog: string[];
        worldInfoLog: string[];
        mythicLog: string[];
        networkLog?: NetworkLogEntry[];
        selectionLog?: string[]; // NEW
    };
    messages?: ChatMessage[]; // Added optional messages
    onClearLogs: () => void;
    onInspectState: () => void;
    onCopyLogs: () => void; 
    copyStatus: boolean;
    isImmersive: boolean;
    onLorebookCreatorOpen: () => void;
    summaryStats?: SummaryStats;
    longTermSummaries?: string[];
    summaryQueue?: SummaryQueueItem[];
    onForceSummarize?: () => void;
    onRegenerateSummary?: (index: number) => Promise<void>; 
    onRetryFailedTask?: () => Promise<void>; 
    onRetryMythic?: () => Promise<void>;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ 
    logs, 
    messages,
    onClearLogs, 
    onInspectState, 
    copyStatus, 
    isImmersive, 
    onLorebookCreatorOpen,
    summaryStats,
    longTermSummaries, 
    summaryQueue, 
    onForceSummarize,
    onRegenerateSummary,
    onRetryFailedTask, 
    onRetryMythic
}) => {
    const [isExpanded, setIsExpanded] = useState(false);

    if (isImmersive) return null;

    const errorCount = logs.systemLog.filter(l => l.level.includes('error')).length;
    const queueError = summaryQueue?.some(i => i.status === 'failed');

    return (
        <div className="mt-4 border-t border-slate-700/50">
            {/* Header */}
            <button 
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800  text-slate-300 rounded-t-lg group focus:outline-none focus:ring-2 focus:ring-inset focus:ring-sky-500/50"
            >
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold" aria-hidden="true">[Công cụ]</span>
                    <span className="font-bold text-sm group-hover:text-white ">Bảng Gỡ Lỗi & Dữ Liệu Hệ Thống</span>
                    {(errorCount > 0 || queueError) && (
                        <span className="bg-red-500/20 text-red-400 text-[10px] px-2 py-0.5 rounded-full font-bold border border-red-500/30 flex items-center gap-1 ">
                            <span aria-hidden="true">●</span> {queueError ? 'Lỗi Tóm Tắt' : `${errorCount} Lỗi`}
                        </span>
                    )}
                </div>
                <span className="text-xs font-bold">[Mở/Đóng]</span>
            </button>

            {/* Body */}
            {isExpanded && (
                <div className="bg-slate-900/50 border-x border-b border-slate-800 rounded-b-lg p-2  max-h-[70vh] overflow-y-auto custom-scrollbar">
                    
                    {/* Section 1: Console */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-sky-400 uppercase tracking-wider mb-2 border-b border-sky-500/20 pb-1 flex items-center gap-2">
                            <span>1. Bảng điều khiển Hệ thống (Console)</span>
                        </h3>
                        <ConsoleView logs={logs.systemLog} onInspectState={onInspectState} onClearLogs={onClearLogs} />
                    </div>

                    {/* Section 2: AI Creator */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 border-b border-indigo-500/20 pb-1 flex items-center gap-2">
                            <span>2. Công cụ AI</span>
                        </h3>
                        <AiCreatorView onOpen={onLorebookCreatorOpen} />
                    </div>

                    {/* Section 3: World Info Logs */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2 border-b border-emerald-500/20 pb-1 flex items-center gap-2">
                            <span>3. Nhật ký Quét World Info</span>
                        </h3>
                        <WorldInfoLogView logs={logs.worldInfoLog} />
                    </div>

                    {/* Section 4: Smart Scan Logs */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-fuchsia-400 uppercase tracking-wider mb-2 border-b border-fuchsia-500/20 pb-1 flex items-center gap-2">
                            <span>4. Nhật ký Smart Scan</span>
                        </h3>
                        <SmartScanLogView logs={logs.smartScanLog} />
                    </div>

                    {/* Section 5: Prompts */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-violet-400 uppercase tracking-wider mb-2 border-b border-violet-500/20 pb-1 flex items-center gap-2">
                            <span>5. Lời nhắc Gửi đi (Prompts)</span>
                        </h3>
                        <PromptsView turns={logs.turns} />
                    </div>

                    {/* Section 6: Responses */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2 border-b border-blue-500/20 pb-1 flex items-center gap-2">
                            <span>6. Phản hồi AI (Raw Response)</span>
                        </h3>
                        <ResponsesView turns={logs.turns} />
                    </div>

                    {/* Section 7: Summaries */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-2 border-b border-amber-500/20 pb-1 flex items-center gap-2">
                            <span>7. Tóm tắt (Summaries)</span>
                        </h3>
                        <SummariesView 
                            turns={logs.turns} 
                            messages={messages || []}
                            stats={summaryStats} 
                            longTermSummaries={longTermSummaries} 
                            summaryQueue={summaryQueue} 
                            onForceSummarize={onForceSummarize}
                            onRegenerate={onRegenerateSummary}
                            onRetry={onRetryFailedTask} 
                        />
                    </div>

                    {/* Section 8: Mythic Engine */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between border-b border-rose-500/20 pb-1 mb-2">
                            <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                                <span>8. Nhật ký Mythic Engine (RPG)</span>
                            </h3>
                            {onRetryMythic && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); onRetryMythic(); }}
                                    className="px-2 py-0.5 text-[10px] bg-rose-600 hover:bg-rose-500 text-white rounded shadow-sm border border-rose-400/50 flex items-center gap-1 "
                                    title="Buộc chạy lại logic RPG cho lượt hội thoại cuối cùng (ngay cả khi log trống)"
                                >
                                    <span className="text-xs font-bold">[Chạy lại]</span>
                                    Force Run
                                </button>
                            )}
                        </div>
                        <MythicLogView logs={logs.mythicLog} onRetry={onRetryMythic} />
                    </div>

                    {/* Section 9: Network Inspector */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-2 border-b border-cyan-500/20 pb-1 flex items-center gap-2">
                            <span>9. Network Inspector (CURL)</span>
                        </h3>
                        <NetworkLogView logs={logs.networkLog} />
                    </div>

                    {/* Section 10: World Info Selection */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider mb-2 border-b border-amber-600/20 pb-1 flex items-center gap-2">
                            <span>10. Kết quả Chọn World Info (AI/Semantic)</span>
                        </h3>
                        <SelectionLogView logs={logs.selectionLog || []} />
                    </div>

                </div>
            )}
        </div>
    );
};
