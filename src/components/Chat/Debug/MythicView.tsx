
import React, { useState, useMemo, memo } from 'react';
import { PromptSection } from '../../../types';
import { CopyButton } from '../../ui/CopyButton';
import { LogPaginationControls, PromptBlock } from './DebugCommons';

// Helper Parser
const parseMythicPrompt = (fullText: string): PromptSection[] => {
    const sections: PromptSection[] = [];
    const schemaStart = fullText.indexOf('<Cấu trúc bảng & Luật lệ>');
    if (schemaStart === -1) {
        return [{ id: 'mythic_raw', name: 'Raw Prompt (Unstructured)', content: fullText, role: 'system' }];
    }

    const systemContent = fullText.substring(0, schemaStart).trim();
    if (systemContent) {
        sections.push({ id: 'mythic_system', name: '🎛️ System Instructions (Chỉ dẫn)', content: systemContent, role: 'system' });
    }

    const schemaMatch = fullText.match(/<Cấu trúc bảng & Luật lệ>([\s\S]*?)<\/Cấu trúc bảng & Luật lệ>/);
    if (schemaMatch) {
        sections.push({ id: 'mythic_schema', name: '📐 Schema & Rules (Cấu trúc bảng)', content: schemaMatch[1].trim(), role: 'system' });
    }

    const loreMatch = fullText.match(/<Dữ liệu tham khảo \(Lorebook\)>([\s\S]*?)<\/Dữ liệu tham khảo \(Lorebook\)>/);
    if (loreMatch) {
        const rawLore = loreMatch[1].trim();
        const entries = rawLore.split('### [Lore:').filter(Boolean).map(e => '### [Lore:' + e);
        sections.push({ 
            id: 'mythic_lore', 
            name: '📚 Lorebook Reference (Dữ liệu tham khảo)', 
            content: rawLore, 
            role: 'system',
            subSections: entries.length > 0 ? entries : undefined
        });
    }

    const dataMatch = fullText.match(/<Dữ liệu bảng hiện tại>([\s\S]*?)<\/Dữ liệu bảng hiện tại>/);
    if (dataMatch) {
        sections.push({ id: 'mythic_data', name: '💾 Current Database (Dữ liệu hiện tại)', content: dataMatch[1].trim(), role: 'system' });
    }

    const chatMatch = fullText.match(/<Dữ liệu chính văn>([\s\S]*?)<\/Dữ liệu chính văn>/);
    if (chatMatch) {
        sections.push({ id: 'mythic_chat', name: '💬 Chat Context (Chính văn)', content: chatMatch[1].trim(), role: 'system' });
    }

    const globalMatch = fullText.match(/LUẬT CHUNG:([\s\S]*)$/);
    if (globalMatch) {
        sections.push({ id: 'mythic_global', name: '⚖️ Global Rules (Luật chung)', content: globalMatch[1].trim(), role: 'system' });
    }

    return sections;
};

const MythicLogItem = memo(({ logString, index, total, onRetry, isLatest }: { logString: string, index: number, total: number, onRetry?: () => void, isLatest: boolean }) => {
    const { parsedLog, structuredPrompt } = useMemo(() => {
        let pLog = { latency: 0, fullPrompt: '', rawResponse: '' };
        try {
            pLog = JSON.parse(logString);
        } catch (e) {
            pLog.fullPrompt = logString;
        }
        const sPrompt = parseMythicPrompt(pLog.fullPrompt);
        return { parsedLog: pLog, structuredPrompt: sPrompt };
    }, [logString]);

    return (
        <div className="bg-slate-900/30 border border-rose-500/20 rounded-lg p-3 relative group">
            <div className="flex justify-between items-center mb-2 border-b border-rose-500/20 pb-2">
                <span className="text-xs font-bold text-rose-400">Medusa Cycle #{total - index} <span className="text-slate-500 font-normal">({parsedLog.latency}ms)</span></span>
                {isLatest && onRetry && (
                    <button 
                        onClick={onRetry}
                        className="text-[10px] flex items-center gap-1 px-2 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white shadow-lg "
                    >
                        <span className="text-xs font-bold">[Tạo lại]</span>
                        Tạo lại (Re-run)
                    </button>
                )}
            </div>
            
            <details className="mb-2 group">
                <summary className="cursor-pointer text-[10px] text-slate-400 hover:text-sky-400 font-bold mb-1 flex items-center justify-between rounded hover:bg-slate-800/50 p-1  select-none">
                    <div className="flex items-center gap-2">
                        <span>📤 Lời nhắc Gửi đi (Outgoing Prompt)</span>
                        <span className=" group-open:rotate-90  text-[8px]" aria-hidden="true">▶</span>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                        <CopyButton textToCopy={parsedLog.fullPrompt} label="Sao chép tất cả" absolute={false} />
                    </div>
                </summary>
                <div className="mt-2 space-y-2 pl-2 border-l border-slate-800">
                    {structuredPrompt.map((section) => (
                        <PromptBlock key={section.id} section={section} />
                    ))}
                </div>
            </details>

            <div className="relative">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-orange-400 font-bold">📥 Phản hồi Thô (AI Response)</span>
                    <CopyButton textToCopy={parsedLog.rawResponse} label="Copy" absolute={false} />
                </div>
                <pre className="text-[10px] text-orange-100 font-mono whitespace-pre-wrap break-words bg-black/20 p-2 rounded border border-rose-500/20 max-h-60 overflow-y-auto custom-scrollbar">
                    {parsedLog.rawResponse}
                </pre>
            </div>
        </div>
    );
});

export const MythicLogView: React.FC<{ logs: string[], onRetry?: () => void }> = ({ logs, onRetry }) => {
    const [visibleCount, setVisibleCount] = useState(3);
    const displayedLogs = logs.slice(0, visibleCount);

    return (
        <div className="space-y-4">
            {displayedLogs.length === 0 ? (
                <div className="p-4 text-center text-slate-600 italic text-xs bg-slate-900/30 rounded-lg border border-slate-800">Chưa có dữ liệu Mythic Engine.</div>
            ) : (
                <>
                    {displayedLogs.map((logString, idx) => (
                        <MythicLogItem 
                            key={idx} 
                            logString={logString} 
                            index={idx} 
                            total={logs.length} 
                            onRetry={onRetry}
                            isLatest={idx === 0}
                        />
                    ))}
                    <LogPaginationControls 
                        visibleCount={visibleCount} 
                        totalCount={logs.length} 
                        onLoadMore={() => setVisibleCount(p => p + 3)} 
                        step={3}
                    />
                </>
            )}
        </div>
    );
};
