
import React from 'react';


interface SelectionEntry {
    timestamp: number;
    prompt: string;
    selectedItems: { id: string, score: number, name: string }[];
}

interface SelectionLogViewProps {
    logs: string[];
}

export const SelectionLogView: React.FC<SelectionLogViewProps> = ({ logs }) => {
    const [expandedIndex, setExpandedIndex] = React.useState<number | null>(0);

    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
                <span>[Search]</span>
                <p className="text-sm font-medium">Chưa có dữ liệu quét World Info.</p>
                <p className="text-xs opacity-60">Dữ liệu sẽ xuất hiện sau khi bạn gửi tin nhắn.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3 p-1">
            {logs.map((logStr, idx) => {
                let log: SelectionEntry;
                try {
                    log = JSON.parse(logStr);
                } catch {
                    return null;
                }

                const isExpanded = expandedIndex === idx;

                return (
                    <div 
                        key={idx}
                        className="border border-zinc-800 rounded-lg bg-zinc-900/50 overflow-hidden"
                    >
                        <button
                            onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                            className="w-full flex items-center justify-between p-3 hover:bg-zinc-800/50  text-left"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded bg-amber-500/10 text-amber-500">
                                    <span>[Search]</span>
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-zinc-200">
                                        Lượt quét #{logs.length - idx}
                                    </div>
                                    <div className="text-[10px] text-zinc-500 font-mono">
                                        {new Date(log.timestamp).toLocaleTimeString()} • {log.selectedItems.length} mục được chọn
                                    </div>
                                </div>
                            </div>
                            {isExpanded ? <span>[ChevronDown]</span> : <span>[ChevronRight]</span>}
                        </button>

                        {isExpanded && (
                            <div
                                className="border-t border-zinc-800 p-4 space-y-4"
                            >
                                {/* PROMPT SECTION */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                                        <span>[FileText]</span>
                                        Lời nhắc gửi đi
                                    </div>
                                    <div className="bg-black/40 rounded p-3 text-xs text-zinc-400 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto border border-zinc-800/50 leading-relaxed">
                                        {log.prompt}
                                    </div>
                                </div>

                                {/* SELECTED ITEMS SECTION */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2 text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                                        <span>[CheckCircle2]</span>
                                        Các mục đã chọn & Độ phù hợp
                                    </div>
                                    <div className="space-y-2">
                                        {log.selectedItems.length > 0 ? (
                                            log.selectedItems.map((item, i) => (
                                                <div 
                                                    key={i}
                                                    className="flex items-center justify-between p-2 rounded bg-zinc-800/30 border border-zinc-800/50"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="text-xs font-medium text-zinc-300">{item.name}</span>
                                                        <span className="text-[10px] text-zinc-500 font-mono">ID: {item.id}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="h-1.5 w-16 bg-zinc-800 rounded-full overflow-hidden">
                                                            <div 
                                                                className="h-full bg-amber-500" 
                                                                style={{ width: `${Math.min(100, item.score * 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-mono font-bold text-amber-500 w-8 text-right">
                                                            {(item.score * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-xs text-zinc-600 italic p-2">
                                                Không có mục nào được chọn trong lượt này.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
