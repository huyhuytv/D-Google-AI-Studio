
import React, { useState, FormEvent, KeyboardEvent, useEffect, useRef } from 'react';
import type { QuickReply, ScriptButton } from '../../types';
import { Loader } from '../Loader';
import { truncateText } from '../../utils';

interface ChatInputProps {
    onSend: (text: string) => void;
    onStop: () => void; // Receive stop action from parent
    isLoading: boolean;
    isImmersive: boolean;
    quickReplies: QuickReply[];
    onQuickReplyClick: (reply: QuickReply) => void;
    scriptButtons?: ScriptButton[];
    onScriptButtonClick?: (btn: ScriptButton) => void;
    authorNote?: string;
    onUpdateAuthorNote: (note: string) => void;
    isSummarizing: boolean; 
    isInputLocked?: boolean; 
    children?: React.ReactNode;
    isAutoLooping?: boolean;
    onToggleAutoLoop?: () => void;
    queueLength?: number;
    // New Props for Story Mode
    isStoryMode?: boolean;
    storyQueueLength?: number;
    onNextStoryChunk?: () => void;
    onCancelStoryMode?: () => void;
    // New Props for Error Handling
    error?: string | null;
    onClearError?: () => void;
    isSyncingLorebook?: boolean; // NEW
}

const AVAILABLE_COMMANDS = [
    { cmd: '/help', desc: 'Xem danh sách lệnh hỗ trợ' },
    { cmd: '/bg', desc: 'Đổi hình nền (URL hoặc "off")', example: '/bg https://...' },
    { cmd: '/music', desc: 'Phát nhạc nền (URL hoặc "off")', example: '/music https://...' },
    { cmd: '/sound', desc: 'Phát âm thanh FX (URL)', example: '/sound https://...' },
    { cmd: '/sys', desc: 'Gửi tin nhắn hệ thống (ẩn danh)', example: '/sys Trời bắt đầu mưa...' },
    { cmd: '/echo', desc: 'Hiển thị thông báo (Toast)', example: '/echo Đã lưu game!' },
    { cmd: '/set', desc: 'Đặt biến số (Variable)', example: '/set hp=100' },
    { cmd: '/get', desc: 'Xem giá trị biến số', example: '/get hp' },
    { cmd: '/input', desc: 'Đặt nội dung khung chat', example: '/input Xin chào' },
    { cmd: '/lock', desc: 'Khóa khung chat' },
    { cmd: '/unlock', desc: 'Mở khóa khung chat' },
];

export const ChatInput: React.FC<ChatInputProps> = ({
    onSend,
    onStop,
    isLoading,
    isImmersive,
    quickReplies,
    onQuickReplyClick,
    scriptButtons = [],
    onScriptButtonClick,
    authorNote,
    onUpdateAuthorNote,
    isSummarizing,
    isInputLocked = false,
    children,
    isAutoLooping = false,
    onToggleAutoLoop,
    queueLength,
    isStoryMode = false,
    storyQueueLength = 0,
    onNextStoryChunk,
    onCancelStoryMode,
    error,
    onClearError,
    isSyncingLorebook = false // NEW
}) => {
    const [userInput, setUserInput] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredCommands, setFilteredCommands] = useState(AVAILABLE_COMMANDS);
    const [selectedCmdIndex, setSelectedCmdIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        const handleSetInput = (e: Event) => {
            const customEvent = e as CustomEvent;
            if (customEvent.detail) {
                setUserInput(String(customEvent.detail));
            }
        };
        window.addEventListener('sillytavern:set-input', handleSetInput);
        return () => window.removeEventListener('sillytavern:set-input', handleSetInput);
    }, []);

    // Command Autocomplete Logic
    useEffect(() => {
        if (userInput.startsWith('/')) {
            const searchTerm = userInput.toLowerCase();
            const matches = AVAILABLE_COMMANDS.filter(c => c.cmd.startsWith(searchTerm));
            setFilteredCommands(matches);
            setShowSuggestions(matches.length > 0 && userInput !== matches[0].cmd); 
            setSelectedCmdIndex(0);
        } else {
            setShowSuggestions(false);
        }
    }, [userInput]);

    const handleSelectCommand = (cmd: string, example?: string) => {
        setUserInput(example ? `${cmd} ` : cmd); 
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        
        // Handle STOP Action
        if (isLoading) {
            if (isAutoLooping && onToggleAutoLoop) {
                onToggleAutoLoop();
                return;
            }
            onStop();
            return;
        }

        if (isAutoLooping && onToggleAutoLoop) {
             onToggleAutoLoop(); 
             return;
        }

        // Story Mode Logic: Send next chunk instead of user input
        if (isStoryMode && onNextStoryChunk) {
            onNextStoryChunk();
            return;
        }

        if (!userInput.trim() || isInputLocked || isSummarizing) return;
        onSend(userInput);
        setUserInput('');
        setShowSuggestions(false);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (showSuggestions) {
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedCmdIndex(prev => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedCmdIndex(prev => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
            } else if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                const selected = filteredCommands[selectedCmdIndex];
                if (selected) {
                    handleSelectCommand(selected.cmd);
                }
            } else if (e.key === 'Escape') {
                setShowSuggestions(false);
            }
        }
    };

    const inputAreaClasses = isImmersive
        ? "relative z-10 bg-slate-900/60  border-t border-white/10 w-full"
        : "border-t border-slate-700 relative z-10 bg-slate-800/80 ";

    const inputFormClasses = isImmersive
         ? "p-4 md:p-6 w-full max-w-5xl mx-auto"
         : "p-4 md:p-6";

    const queueMessage = queueLength && queueLength > 0 
        ? `Đang tóm tắt... Còn ${queueLength} phần.` 
        : "Đang tóm tắt...";

    return (
        <div className={inputAreaClasses}>
            
            {/* ERROR BANNER (NON-BLOCKING) */}
            {error && (
                <div className="bg-red-900/90 text-white px-4 py-2 flex items-center justify-between  border-b border-red-700/50">
                    <div className="flex items-center gap-2">
                        <span>[Lỗi]</span>
                        <span className="text-sm font-medium">{error}</span>
                    </div>
                    {onClearError && (
                        <button 
                            onClick={onClearError} 
                            className="p-1 hover:bg-red-800 rounded-full  text-red-200 hover:text-white"
                            title="Đóng thông báo"
                        >
                            <span>[Đóng]</span>
                        </button>
                    )}
                </div>
            )}

            {/* Command Suggestions Popup */}
            {showSuggestions && !isInputLocked && !isSummarizing && (
                <div className={`absolute bottom-full left-4 md:left-6 mb-2 w-72 bg-slate-900 border border-slate-600 rounded-lg shadow-2xl overflow-hidden z-50  flex flex-col`}>
                    <div className="bg-slate-800 px-3 py-2 text-xs font-bold text-slate-400 border-b border-slate-700 uppercase tracking-wider">
                        Gợi ý lệnh hệ thống
                    </div>
                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {filteredCommands.map((item, idx) => (
                            <button
                                key={item.cmd}
                                onClick={() => handleSelectCommand(item.cmd)}
                                className={`w-full text-left px-4 py-2 text-sm flex flex-col  ${
                                    idx === selectedCmdIndex 
                                    ? 'bg-sky-600 text-white' 
                                    : 'text-slate-200 hover:bg-slate-800'
                                }`}
                            >
                                <span className="font-mono font-bold">{item.cmd}</span>
                                <span className={`text-xs ${idx === selectedCmdIndex ? 'text-sky-200' : 'text-slate-500'}`}>{item.desc}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* SCRIPT BUTTONS BAR */}
            {!isInputLocked && scriptButtons.length > 0 && onScriptButtonClick && (
                <div className="px-4 pt-2 pb-1 flex flex-wrap gap-2 justify-center md:justify-start  border-b border-white/5">
                     {scriptButtons.map((btn) => (
                        <button
                            key={btn.id}
                            onClick={() => onScriptButtonClick(btn)}
                            disabled={isSummarizing}
                            className="px-3 py-1.5 text-xs font-bold rounded bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20   active:scale-95 border border-indigo-400/30 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <span className="text-indigo-200" aria-hidden="true">[Script]</span> {btn.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Quick Replies */}
            {!isInputLocked && quickReplies.length > 0 && (
                <div className="px-4 pt-2 flex flex-wrap gap-2 justify-end">
                    {quickReplies.map((reply, idx) => (
                        <button
                            key={idx}
                            onClick={() => onQuickReplyClick(reply)}
                            disabled={isSummarizing}
                            className={`px-3 py-1.5 text-sm rounded-full  border shadow-sm ${
                                isImmersive 
                                ? 'bg-slate-700/80 border-slate-500 hover:bg-sky-600/90 text-white' 
                                : 'bg-slate-700 hover:bg-sky-600 text-slate-200 hover:text-white border-slate-600'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {reply.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Author Note Display */}
            {authorNote && (
                <div className="px-4 pt-3 text-xs">
                    <div className={`p-2 rounded-md flex justify-between items-center gap-2 ${
                        isImmersive 
                        ? 'bg-slate-800/50  border border-slate-700' 
                        : 'bg-slate-900/70'
                    }`}>
                        <p className="text-slate-400 flex-grow truncate">
                            <span className="font-bold text-sky-400">Ghi chú: </span>
                            <span className="italic">{truncateText(authorNote, 100)}</span>
                        </p>
                        <button 
                            onClick={() => onUpdateAuthorNote('')} 
                            className="text-slate-500 hover:text-white p-1 rounded-full flex-shrink-0" 
                            title="Xóa ghi chú"
                            aria-label="Xóa ghi chú của tác giả"
                        >
                            <span className="text-xs font-bold">[Xóa]</span>
                        </button>
                    </div>
                </div>
            )}

            <div className={inputFormClasses}>
                {/* Status Loader */}
                <div className="flex items-center justify-end mb-3 min-h-[20px]">
                    {isSummarizing && <Loader message={queueMessage} />}
                </div>

                {/* Input Form */}
                <form onSubmit={handleSubmit} className="flex gap-4">
                    <div className="relative flex-grow">
                        {isStoryMode ? (
                            <div className={`w-full rounded-lg p-2 md:p-3 flex items-center justify-between transition border border-amber-500/30 gap-2 ${
                                isImmersive ? 'bg-slate-800/70 ' : 'bg-slate-700'
                            }`}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <span className="text-amber-400 font-bold flex items-center gap-2 shrink-0">
                                        <span className="text-xl">📖</span>
                                        <span className="hidden sm:inline">Chế độ Cốt truyện</span>
                                    </span>
                                    
                                    {onCancelStoryMode && (
                                        <button 
                                            type="button"
                                            onClick={onCancelStoryMode}
                                            className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-900 text-red-200 rounded border border-red-700 hover:border-red-500  whitespace-nowrap"
                                        >
                                            Hủy (Dừng & Chat)
                                        </button>
                                    )}
                                </div>
                                <span className="text-slate-300 text-sm font-mono shrink-0">
                                    <span className="hidden sm:inline">Còn: </span>
                                    <span className="text-white font-bold">{storyQueueLength}</span>
                                    <span className="sm:hidden"> left</span>
                                </span>
                            </div>
                        ) : (
                            <input
                                ref={inputRef}
                                type="text"
                                value={userInput}
                                onChange={(e) => setUserInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={isInputLocked ? "Đang chờ kịch bản..." : (isSummarizing ? "Hệ thống đang tóm tắt..." : (isSyncingLorebook ? "Đang đồng bộ World Info..." : (isAutoLooping ? "Đang tự động chạy..." : (isImmersive ? "Nhập tin nhắn..." : "Nhập tin nhắn... (Gõ / để xem lệnh)"))))}
                                className={`w-full rounded-lg p-3 text-slate-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition disabled:opacity-50 ${
                                    isImmersive 
                                    ? 'bg-slate-800/70 border-slate-600/50  placeholder-slate-400' 
                                    : 'bg-slate-700 border border-slate-600'
                                } ${(isInputLocked || isSummarizing || isSyncingLorebook) ? 'cursor-not-allowed opacity-60' : ''}`}
                                disabled={isLoading || isInputLocked || isAutoLooping || isSummarizing || isSyncingLorebook}
                                aria-label="Chat input"
                                autoComplete="off"
                            />
                        )}
                    </div>
                    
                    {/* Send / Stop Button */}
                    <button
                        type="submit"
                        disabled={!isAutoLooping && !isLoading && (isInputLocked || (!userInput.trim() && !isStoryMode) || isSummarizing || isSyncingLorebook)}
                        className={`text-white font-bold py-2 px-5 rounded-lg   disabled:bg-slate-600 disabled:cursor-not-allowed flex-shrink-0 flex items-center justify-center gap-2 min-w-[80px] ${
                            isImmersive 
                            ? 'bg-sky-600/80 hover:bg-sky-600 ' 
                            : (isAutoLooping || isLoading) ? 'bg-red-600 hover:bg-red-700' : 'bg-sky-600 hover:bg-sky-700'
                        }`}
                        aria-label={(isAutoLooping || isLoading) ? "Dừng lại" : "Gửi tin nhắn"}
                    >
                        {(isAutoLooping || isLoading) ? (
                            <>
                                <span className="text-xs font-bold">[Dừng]</span>
                                <span>Dừng</span>
                            </>
                        ) : (
                            isStoryMode ? (
                                <>
                                    <span className="text-xs font-bold">[Tiếp tục]</span>
                                    <span>Tiếp tục</span>
                                </>
                            ) : (
                                <span>Gửi</span>
                            )
                        )}
                    </button>

                    {/* Auto Loop Toggle Button - FIX: Allow viewing/toggling even when loading */}
                    {onToggleAutoLoop && !isInputLocked && !isSummarizing && (
                        <button
                            type="button"
                            onClick={onToggleAutoLoop}
                            className={`py-2 px-3 rounded-lg   border flex items-center justify-center ${
                                isAutoLooping 
                                ? 'bg-sky-500/20 border-sky-500 text-sky-400 shadow-[0_0_10px_rgba(14,165,233,0.3)]' 
                                : 'bg-slate-700 border-slate-600 text-slate-400 hover:bg-slate-600 hover:text-white'
                            }`}
                            title="Tự động chạy (Auto-Play)"
                            aria-label={isAutoLooping ? "Tắt tự động chạy" : "Bật tự động chạy"}
                            aria-pressed={isAutoLooping}
                        >
                            <span className={`text-xl leading-none ${isAutoLooping ? '' : ''}`} aria-hidden="true">♾️</span>
                        </button>
                    )}
                </form>
                
                {children}
            </div>
        </div>
    );
};
