
import React from 'react';

interface ChatLayoutProps {
    children: React.ReactNode;
    isImmersive: boolean;
    globalClass?: string;
}

export const ChatLayout: React.FC<ChatLayoutProps> = ({ children, isImmersive, globalClass = '' }) => {
    const containerClasses = isImmersive 
        ? "fixed inset-0 z-50 bg-slate-900 flex flex-col" 
        : "bg-slate-800/50 rounded-xl shadow-lg flex flex-col flex-grow min-h-[70vh] relative overflow-hidden";

    return (
        <div className={`${containerClasses} ${globalClass}`}>
            {children}
        </div>
    );
};
