import React from 'react';
import { useChatStore } from '../../store/chatStore';

export const RpgNotificationOverlay: React.FC = () => {
    const notification = useChatStore(state => state.rpgNotification);
    const setNotification = useChatStore(state => state.setRpgNotification);

    if (!notification) return null;

    // Split notification by newlines to render as list if needed
    const lines = notification.split('\n').filter(line => line.trim() !== '');

    return (
        <div className="fixed bottom-24 right-4 z-[60] max-w-xs md:max-w-sm pointer-events-none">
            <div className="bg-slate-900/95  border-l-4 border-amber-500 shadow-2xl rounded-r-lg p-4 pointer-events-auto relative overflow-hidden group">
                
                {/* Close Button (Hidden by default, shown on hover) */}
                <button 
                    onClick={() => setNotification(null)}
                    className="absolute top-1 right-1 text-slate-500 hover:text-white p-1 rounded opacity-0 group-hover:opacity-100 "
                    title="Đóng thông báo này"
                >
                    <span>[Đóng]</span>
                </button>

                <div className="flex items-start gap-3">
                    <div className="p-2 bg-amber-500/20 rounded-full shrink-0">
                        <span className="text-sm font-bold text-amber-500">[RPG]</span>
                    </div>
                    <div className="flex-grow">
                        <h4 className="text-amber-400 font-bold text-xs uppercase tracking-wider mb-1">
                            Mythic Engine Update
                        </h4>
                        <div className="text-sm text-slate-200 space-y-1 font-medium max-h-40 overflow-y-auto custom-scrollbar">
                            {lines.map((line, idx) => (
                                <p key={idx} className="leading-snug border-b border-slate-800/50 last:border-0 pb-1 mb-1 last:pb-0 last:mb-0">{line}</p>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};