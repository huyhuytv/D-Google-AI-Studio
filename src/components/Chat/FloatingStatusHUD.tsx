
import React, { forwardRef, useState } from 'react';
import { InteractiveHtmlMessage } from '../InteractiveHtmlMessage';
import type { TavernHelperScript } from '../../types';

interface FloatingStatusHUDProps {
    isOpen: boolean;
    onClose: () => void;
    htmlContent: string;
    scripts: TavernHelperScript[];
    originalRawContent: string;
    variables: any;
    extensionSettings: any;
    characterName: string;
    userPersonaName: string;
    characterId: string;
    sessionId: string;
    characterAvatarUrl: string | null;
}

export const FloatingStatusHUD = forwardRef<HTMLIFrameElement, FloatingStatusHUDProps>(({
    isOpen,
    onClose,
    htmlContent,
    scripts,
    originalRawContent,
    variables,
    extensionSettings,
    characterName,
    userPersonaName,
    characterId,
    sessionId,
    characterAvatarUrl
}, ref) => {
    const [isMinimized, setIsMinimized] = useState(false);

    if (!isOpen) return null;

    if (!htmlContent) {
        return (
            <div className="fixed top-20 right-4 w-80 bg-slate-800/90 border border-red-500/50 rounded-xl p-4 shadow-2xl z-40 text-red-300 text-sm">
                <div className="flex justify-between items-center mb-2">
                    <span className="font-bold">Lỗi HUD</span>
                    <button onClick={onClose} aria-label="Đóng thông báo lỗi">✕</button>
                </div>
                <p>Không tìm thấy nội dung giao diện thẻ (Interactive HTML) trong lịch sử trò chuyện.</p>
            </div>
        );
    }

    return (
        <div 
            className={`fixed right-4 z-40   ease-in-out flex flex-col shadow-2xl  bg-slate-900/80 border border-slate-600/50 rounded-xl overflow-hidden ${
                isMinimized ? 'w-48 h-10 bottom-24' : 'w-[450px] max-w-[90vw] h-[80vh] top-20'
            }`}
        >
            {/* Header Bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-800/80 border-b border-slate-700 shrink-0 cursor-move">
                <div className="flex items-center gap-2">
                    <span className="text-amber-400 text-lg" aria-hidden="true">🎴</span>
                    <span className="font-bold text-slate-200 text-sm truncate max-w-[150px]">
                        {characterName} - Trạng thái
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button 
                        onClick={() => setIsMinimized(!isMinimized)}
                        className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded "
                        title={isMinimized ? "Mở rộng" : "Thu nhỏ"}
                        aria-label={isMinimized ? "Mở rộng HUD" : "Thu nhỏ HUD"}
                    >
                        <span className="text-xs font-bold">[Thu nhỏ/Mở rộng]</span>
                    </button>
                    <button 
                        onClick={onClose}
                        className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded "
                        title="Đóng HUD"
                        aria-label="Đóng HUD"
                    >
                        <span className="text-xs font-bold">[Đóng]</span>
                    </button>
                </div>
            </div>

            {/* Iframe Container */}
            {!isMinimized && (
                <div className="flex-grow overflow-hidden relative bg-slate-900/50">
                    <InteractiveHtmlMessage
                        ref={ref}
                        htmlContent={htmlContent}
                        scripts={scripts}
                        originalContent={originalRawContent}
                        initialData={variables}
                        extensionSettings={extensionSettings}
                        characterName={characterName}
                        userPersonaName={userPersonaName}
                        characterId={characterId}
                        chatId={sessionId}
                        userAvatarUrl={characterAvatarUrl || undefined}
                    />
                </div>
            )}
        </div>
    );
});
