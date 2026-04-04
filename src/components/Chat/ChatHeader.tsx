
import React, { useState, useEffect, useRef } from 'react';
import type { VisualState } from '../../types';
import { usePreset } from '../../contexts/PresetContext';
import { useTTS } from '../../contexts/TTSContext';
import { useChatStore } from '../../store/chatStore'; // Import Store for Arena State
import { 
    getConnectionSettings, 
    saveConnectionSettings, 
    GlobalConnectionSettings, 
    MODEL_OPTIONS, 
    PROXY_MODEL_OPTIONS,
    getActiveModel,
    getStoredProxyModels,
    StoredProxyModel,
    getProxyProfiles,
    ProxyProfile,
    getProxyUrl,
    getProxyPassword,
    getProxyLegacyMode
} from '../../services/settingsService';
import { fetchProxyModels } from '../../services/api/proxyApi';
import { ToggleInput } from '../ui/ToggleInput';

import { useUserPersona } from '../../contexts/UserPersonaContext';
import { ArenaSettingsModal } from './ArenaSettingsModal';

export interface ChatHeaderProps {
    characterName: string;
    onBack: () => void;
    isImmersive: boolean;
    setIsImmersive: (value: boolean) => void;
    visualState: VisualState;
    onVisualUpdate: (type: string, value: any) => void; 
    onToggleHUD?: () => void;
    isHUDOpen?: boolean;
    onToggleStatusHUD?: () => void;
    isStatusHUDOpen?: boolean;
    activePresetName?: string;
    onPresetChange?: (presetName: string) => void;
    activePersonaId?: string;
    onPersonaChange?: (personaId: string) => void;
    onToggleAssistant?: () => void;
    isAssistantOpen?: boolean;
    onToggleRpgDashboard?: () => void;
    isRpgDashboardOpen?: boolean;
    hasRpgData?: boolean;
    onSyncLorebook?: () => void;
    isSyncingLorebook?: boolean;
}

const ChatSettingsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    visualState: VisualState;
    onUpdate: (type: string, value: any) => void;
    isHUDOpen?: boolean;
    onToggleHUD?: () => void;
    isStatusHUDOpen?: boolean;
    onToggleStatusHUD?: () => void;
}> = ({ 
    isOpen, onClose, visualState, onUpdate,
    isHUDOpen, onToggleHUD, isStatusHUDOpen, onToggleStatusHUD
}) => {
    const modalRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isOpen) {
            const handleKeyDown = (event: KeyboardEvent) => {
                if (event.key === 'Escape') {
                    onClose();
                } else if (event.key === 'Tab' && modalRef.current) {
                    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
                        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                    );
                    if (focusableElements.length > 0) {
                        const firstElement = focusableElements[0];
                        const lastElement = focusableElements[focusableElements.length - 1];

                        if (event.shiftKey) { // Shift + Tab
                            if (document.activeElement === firstElement) {
                                lastElement.focus();
                                event.preventDefault();
                            }
                        } else { // Tab
                            if (document.activeElement === lastElement) {
                                firstElement.focus();
                                event.preventDefault();
                            }
                        }
                    }
                }
            };

            document.addEventListener('keydown', handleKeyDown);
            setTimeout(() => closeButtonRef.current?.focus(), 100);

            return () => {
                document.removeEventListener('keydown', handleKeyDown);
            };
        }
    }, [isOpen, onClose]);


    if (!isOpen) return null;

    return (
        <div ref={modalRef} className="absolute top-14 right-4 w-80 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50  p-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
            <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h3 className="font-bold text-slate-200">Cài đặt Trò chuyện</h3>
                <button 
                    ref={closeButtonRef} 
                    onClick={onClose} 
                    className="text-slate-400 hover:text-white"
                    aria-label="Đóng cài đặt"
                >
                     <span className="text-xs font-bold">[Đóng]</span>
                </button>
            </div>
            
            <div className="space-y-6">
                
                {/* Group 1: Display Tools */}
                <div className="space-y-3">
                    <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider border-b border-slate-700/50 pb-1">Công cụ hiển thị</h4>
                    {onToggleHUD && (
                        <ToggleInput 
                            label="Bảng Gỡ lỗi (Debug Panel)" 
                            checked={!!isHUDOpen} 
                            onChange={() => onToggleHUD()} 
                            clean 
                        />
                    )}
                    {onToggleStatusHUD && (
                        <ToggleInput 
                            label="Giao diện Thẻ nổi (Floating HUD)" 
                            checked={!!isStatusHUDOpen} 
                            onChange={() => onToggleStatusHUD()} 
                            clean 
                        />
                    )}
                    
                    {/* NEW: Disable Interactive Mode Toggle */}
                    <ToggleInput 
                        label="Chế độ Văn bản thuần"
                        checked={!!visualState.disableInteractiveMode} 
                        onChange={(v) => onUpdate('disableInteractiveMode', v)} 
                        clean 
                        tooltip="Tắt xử lý Regex/Script/HTML. Hiển thị nội dung thô nguyên bản trong bong bóng chat."
                    />
                </div>

                {/* Group 2: Appearance */}
                <div className="space-y-4">
                    <h4 className="text-xs font-bold text-sky-400 uppercase tracking-wider border-b border-slate-700/50 pb-1">Giao diện & Hình ảnh</h4>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Link Hình nền (URL)</label>
                        <input 
                            type="text" 
                            value={visualState.backgroundImage || ''} 
                            onChange={(e) => onUpdate('bg', e.target.value)}
                            placeholder="https://..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                        />
                        <button onClick={() => onUpdate('bg', 'off')} className="text-xs text-red-400 mt-1 hover:underline">Xóa nền</button>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Link Nhạc nền (URL)</label>
                        <input 
                            type="text" 
                            value={visualState.musicUrl || ''} 
                            onChange={(e) => onUpdate('music', e.target.value)}
                            placeholder="https://... (mp3/ogg)"
                            className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                        />
                        <button onClick={() => onUpdate('music', 'off')} className="text-xs text-red-400 mt-1 hover:underline">Tắt nhạc</button>
                    </div>
                     <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Hiệu ứng CSS Global</label>
                        <input 
                            type="text" 
                            value={visualState.globalClass || ''} 
                            onChange={(e) => onUpdate('class', e.target.value)}
                            placeholder="grayscale, blur-sm, sepia..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                        />
                    </div>
                </div>

                {/* Group 3: Audio */}
                <div className="space-y-4">
                     <div className="flex items-center justify-between border-b border-slate-700/50 pb-1">
                        <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider">Cấu hình Âm thanh</h4>
                        <ToggleInput 
                            checked={visualState.systemSoundEnabled !== false} 
                            onChange={(v) => onUpdate('systemSoundEnabled', v)} 
                            clean 
                            className="scale-90 origin-right"
                        />
                    </div>

                    <div className={visualState.systemSoundEnabled === false ? 'opacity-50 pointer-events-none' : ''}>
                        <div className="mb-3">
                            <label className="block text-xs font-medium text-slate-400 mb-1">Âm thanh AI Xong (URL)</label>
                            <input 
                                type="text" 
                                value={visualState.aiSoundUrl || ''} 
                                onChange={(e) => onUpdate('aiSoundUrl', e.target.value)}
                                placeholder="Mặc định: 'Pop'"
                                className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Âm thanh RPG Xong (URL)</label>
                            <input 
                                type="text" 
                                value={visualState.rpgSoundUrl || ''} 
                                onChange={(e) => onUpdate('rpgSoundUrl', e.target.value)}
                                placeholder="Mặc định: 'Magic Chime'"
                                className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-slate-200 focus:border-sky-500 focus:outline-none"
                            />
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 italic">
                            Để trống để sử dụng âm thanh mặc định của hệ thống.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
};

// --- Quick Config Modal (Model + Preset) ---
const QuickConfigModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    activePresetName?: string;
    onPresetChange?: (name: string) => void;
    activePersonaId?: string;
    onPersonaChange?: (id: string) => void;
    // Data for live tuning connection
    onConnectionChange: () => void; // Trigger parent refresh
}> = ({ isOpen, onClose, activePresetName, onPresetChange, activePersonaId, onPersonaChange, onConnectionChange }) => {
    const { presets } = usePreset();
    const { personas } = useUserPersona();
    const modalRef = useRef<HTMLDivElement>(null);
    const [conn, setConn] = useState<GlobalConnectionSettings>(getConnectionSettings());
    const [proxyModels, setProxyModels] = useState<StoredProxyModel[]>([]);
    const [proxyProfiles, setProxyProfiles] = useState<ProxyProfile[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    // Sync state when modal opens
    useEffect(() => {
        if (isOpen) {
            setConn(getConnectionSettings());
            setProxyProfiles(getProxyProfiles());
            const stored = getStoredProxyModels();
            setProxyModels(stored);
        }
    }, [isOpen]);

    // Fetch proxy models when profile changes
    useEffect(() => {
        if (!isOpen || conn.source !== 'proxy') return;

        const fetchModels = async () => {
            setIsLoadingModels(true);
            try {
                let url = getProxyUrl();
                let password = getProxyPassword();
                let legacy = getProxyLegacyMode();

                if (conn.proxy_profile_id) {
                    const profile = proxyProfiles.find(p => p.id === conn.proxy_profile_id);
                    if (profile) {
                        url = profile.url;
                        password = profile.password;
                        legacy = profile.legacyMode;
                    }
                }

                if (!url) {
                    setIsLoadingModels(false);
                    return;
                }

                if (!conn.proxy_profile_id) {
                    const stored = getStoredProxyModels();
                    if (stored.length > 0) setProxyModels(stored);
                } else {
                    setProxyModels([]);
                }

                const models = await fetchProxyModels(url, password, legacy);
                setProxyModels(models);
            } catch (e) {
                console.error("Failed to fetch proxy models:", e);
            } finally {
                setIsLoadingModels(false);
            }
        };

        fetchModels();
    }, [conn.source, conn.proxy_profile_id, isOpen, proxyProfiles]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    // --- Handlers for Model Config ---
    const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSource = e.target.value as any;
        const newConn = { ...conn, source: newSource };
        saveConnectionSettings(newConn);
        setConn(newConn);
        onConnectionChange(); // Notify parent to update badge
    };

    const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const newVal = e.target.value;
        const newConn = { ...conn };
        
        if (conn.source === 'gemini') newConn.gemini_model = newVal;
        else if (conn.source === 'proxy') newConn.proxy_model = newVal;
        else if (conn.source === 'openrouter') newConn.openrouter_model = newVal;
        
        saveConnectionSettings(newConn);
        setConn(newConn);
        onConnectionChange(); // Notify parent to update badge
    };

    const currentOptions = conn.source === 'gemini' 
        ? MODEL_OPTIONS 
        : (proxyModels.length > 0 ? proxyModels : PROXY_MODEL_OPTIONS);

    return (
        <div ref={modalRef} className="absolute top-14 left-16 md:left-auto md:right-1/4 w-72 bg-slate-800 border border-slate-600 rounded-xl shadow-2xl z-50  flex flex-col max-h-[70vh]">
            
            {/* Header */}
            <div className="p-3 border-b border-slate-700 bg-slate-900/50 rounded-t-xl shrink-0 flex items-center gap-2">
                 <span className="text-xs font-bold">[Cấu hình]</span>
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Cấu hình Nhanh</h3>
            </div>

            <div className="overflow-y-auto custom-scrollbar p-3 space-y-4">
                
                {/* SECTION 1: MODEL CONFIG */}
                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-indigo-400 uppercase">Nguồn & Model (Brain)</label>
                    
                    {/* Source Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-12 shrink-0">Nguồn:</span>
                        <select 
                            value={conn.source} 
                            onChange={handleSourceChange}
                            className="flex-grow bg-slate-900 border border-slate-600 rounded text-xs p-1.5 text-white focus:border-indigo-500 outline-none"
                        >
                            <option value="gemini">Google Gemini</option>
                            <option value="openrouter">OpenRouter</option>
                            <option value="proxy">Proxy</option>
                        </select>
                    </div>

                    {/* Proxy Profile Selector */}
                    {conn.source === 'proxy' && (
                        <div className="flex items-center gap-2 ">
                            <span className="text-xs text-emerald-400 w-12 shrink-0">Profile:</span>
                            <select
                                value={conn.proxy_profile_id || ''}
                                onChange={(e) => {
                                    const newConn = { ...conn, proxy_profile_id: e.target.value || undefined };
                                    saveConnectionSettings(newConn);
                                    setConn(newConn);
                                    onConnectionChange();
                                }}
                                className="flex-grow bg-slate-900 border border-slate-600 rounded text-xs p-1.5 text-white focus:border-emerald-500 outline-none"
                            >
                                <option value="">-- Mặc định (Global) --</option>
                                {proxyProfiles.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Model Selector */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-12 shrink-0">Model:</span>
                        {conn.source === 'openrouter' ? (
                            <input 
                                type="text"
                                value={conn.openrouter_model || ''}
                                onChange={handleModelChange}
                                placeholder="google/gemini-..."
                                className="flex-grow bg-slate-900 border border-slate-600 rounded text-xs p-1.5 text-white focus:border-indigo-500 outline-none"
                            />
                        ) : (
                            <div className="flex-grow relative">
                                <select 
                                    value={conn.source === 'gemini' ? conn.gemini_model : conn.proxy_model} 
                                    onChange={handleModelChange}
                                    disabled={isLoadingModels}
                                    className="w-full bg-slate-900 border border-slate-600 rounded text-xs p-1.5 text-white focus:border-indigo-500 outline-none disabled:opacity-50"
                                >
                                    {currentOptions.map(m => (
                                        <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                </select>
                                {isLoadingModels && (
                                    <div className="absolute right-6 top-1/2 -translate-y-1/2">
                                        <div className="w-3 h-3 border-2 border-sky-400 border-t-transparent rounded-full "></div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="h-px bg-slate-700/50"></div>
                
                {/* SECTION 1.5: PERSONA LIST */}
                <div className="space-y-1">
                     <label className="text-[10px] font-bold text-emerald-400 uppercase mb-2 block">Persona (Hồ sơ)</label>
                     <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                        {personas.map(persona => (
                            <button
                                key={persona.id}
                                onClick={() => { if(onPersonaChange) onPersonaChange(persona.id); onClose(); }}
                                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium  flex items-center justify-between ${
                                    activePersonaId === persona.id 
                                    ? 'bg-emerald-900/30 text-emerald-100 border border-emerald-500/30' 
                                    : 'text-slate-400 hover:bg-slate-700 hover:text-white border border-transparent'
                                }`}
                                aria-label={`Chọn hồ sơ ${persona.name}`}
                            >
                                <span className="truncate">{persona.name}</span>
                                {activePersonaId === persona.id && <span className="text-[8px] text-emerald-400">●</span>}
                            </button>
                        ))}
                     </div>
                </div>

                <div className="h-px bg-slate-700/50"></div>

                {/* SECTION 2: PRESET LIST */}
                <div className="space-y-1">
                     <label className="text-[10px] font-bold text-amber-400 uppercase mb-2 block">Preset (Soul)</label>
                     <div className="max-h-40 overflow-y-auto custom-scrollbar space-y-1 pr-1">
                        {presets.map(preset => (
                            <button
                                key={preset.name}
                                onClick={() => { if(onPresetChange) onPresetChange(preset.name); onClose(); }}
                                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium  flex items-center justify-between ${
                                    activePresetName === preset.name 
                                    ? 'bg-amber-900/30 text-amber-100 border border-amber-500/30' 
                                    : 'text-slate-400 hover:bg-slate-700 hover:text-white border border-transparent'
                                }`}
                                aria-label={`Chọn preset ${preset.name}`}
                            >
                                <span className="truncate">{preset.name}</span>
                                {activePresetName === preset.name && <span className="text-[8px] text-amber-400">●</span>}
                            </button>
                        ))}
                     </div>
                </div>

            </div>
        </div>
    );
};

// --- TTS Controls Component ---
const TTSControls: React.FC = () => {
    const { isPlaying, isPaused, autoPlayEnabled, toggleAutoPlay, togglePause, skip, isLoading, settings } = useTTS();
    const ttsEnabled = settings.tts_enabled;

    if (!ttsEnabled) return null;

    return (
        <div className="flex items-center bg-slate-800/80 rounded-full px-2 py-1 gap-1 border border-slate-600/50 mr-2">
            {/* Auto Play Toggle */}
            <button
                onClick={toggleAutoPlay}
                className={`p-1.5 rounded-full  ${autoPlayEnabled ? 'text-sky-400 bg-sky-900/20' : 'text-slate-500 hover:text-slate-300'}`}
                title={autoPlayEnabled ? "Tự động đọc: BẬT" : "Tự động đọc: TẮT"}
                aria-label={autoPlayEnabled ? "Tắt tự động đọc" : "Bật tự động đọc"}
                aria-pressed={autoPlayEnabled}
            >
                <span className="text-xs font-bold">[Tự động đọc]</span>
            </button>

            {/* Play/Pause/Loading/Skip Group (Visible when active or paused) */}
            {(isPlaying || isPaused || isLoading) && (
                <>
                    <div className="w-px h-3 bg-slate-600 mx-1"></div>
                    
                    {/* Pause/Resume */}
                    <button
                        onClick={togglePause}
                        className={`p-1.5 rounded-full text-slate-200 hover:text-white hover:bg-slate-700  ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        title={isPaused ? "Tiếp tục" : "Tạm dừng"}
                        aria-label={isPaused ? "Tiếp tục đọc" : "Tạm dừng đọc"}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                             <span className="text-xs font-bold">[Đang tải]</span>
                        ) : isPaused ? (
                            <span className="text-xs font-bold">[Tiếp tục]</span>
                        ) : (
                            <span className="text-xs font-bold">[Tạm dừng]</span>
                        )}
                    </button>

                    {/* Skip */}
                    <button
                        onClick={skip}
                        className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 "
                        title="Bỏ qua (Next)"
                        aria-label="Bỏ qua câu hiện tại"
                    >
                        <span className="text-xs font-bold">[Bỏ qua]</span>
                    </button>
                </>
            )}
        </div>
    );
};

// --- NEW UNIFIED COMPONENT ---
const UnifiedConfigBadge: React.FC<{
    presetName?: string;
    onClick?: () => void;
    // Force refresh key to update visuals
    refreshKey?: number;
}> = ({ presetName, onClick, refreshKey }) => {
    const conn = getConnectionSettings();
    const activeModel = getActiveModel();
    
    // Determine styles based on connection source
    const getStyles = () => {
         if (conn.source === 'openrouter') return {
             bg: 'bg-purple-900/40 hover:bg-purple-900/60',
             border: 'border-purple-500/30',
             text: 'text-purple-200'
         };
         if (conn.source === 'proxy') return {
             bg: 'bg-cyan-900/40 hover:bg-cyan-900/60',
             border: 'border-cyan-500/30',
             text: 'text-cyan-200'
         };
         // Gemini default
         return {
             bg: 'bg-sky-900/40 hover:bg-sky-900/60',
             border: 'border-sky-500/30',
             text: 'text-sky-200'
         };
    };

    const style = getStyles();
    
    const getSourceLabel = () => {
        if (conn.source === 'openrouter') return 'OR';
        if (conn.source === 'proxy') return 'PRX';
        return 'AI';
    };

    return (
        <button
            onClick={onClick}
            className={`group flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-medium   ${style.bg} ${style.border} ${style.text} max-w-[280px] sm:max-w-[350px] shadow-sm`}
            title="Nhấn để cấu hình Nhanh (Model & Preset)"
        >
            {/* Model Part */}
            <div className="flex items-center gap-1.5 shrink-0 min-w-0 max-w-[60%]">
                <span className="opacity-60 text-[9px] uppercase tracking-wider font-bold">{getSourceLabel()}</span>
                <span className="truncate font-bold">{activeModel}</span>
            </div>

            {/* Vertical Divider */}
            <div className={`w-px h-3 ${style.text} opacity-20`}></div>

            {/* Preset Part */}
            <div className="flex items-center gap-1.5 shrink-0 min-w-0 max-w-[40%]">
                <span className="text-xs font-bold">[Preset]</span>
                <span className="truncate opacity-90">{presetName || 'Default'}</span>
            </div>
        </button>
    );
};

export const ChatHeader: React.FC<ChatHeaderProps> = ({ 
    characterName, onBack, isImmersive, setIsImmersive, visualState, onVisualUpdate, 
    onToggleHUD, isHUDOpen, onToggleStatusHUD, isStatusHUDOpen,
    activePresetName, onPresetChange, activePersonaId, onPersonaChange, onToggleAssistant, isAssistantOpen,
    onToggleRpgDashboard, isRpgDashboardOpen, hasRpgData, onSyncLorebook, isSyncingLorebook
}) => {
    const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
    const [isConfigMenuOpen, setIsConfigMenuOpen] = useState(false);
    const [isArenaSettingsOpen, setIsArenaSettingsOpen] = useState(false); // NEW
    const [refreshKey, setRefreshKey] = useState(0); // To force re-render of badge
    const triggerRef = useRef<HTMLButtonElement>(null);
    
    // Arena Mode Logic
    const { isArenaMode, setArenaMode, arenaModelId } = useChatStore();
    // Removed inline proxyModels state and useEffect as it's now handled in modal

    const handleCloseMenu = () => {
        setIsSettingsMenuOpen(false);
        triggerRef.current?.focus();
    }

    const handleConnectionChange = () => {
        setRefreshKey(prev => prev + 1);
    }

    const headerClasses = isImmersive
        ? "p-3 bg-slate-900/60  border-b border-white/10 flex items-center gap-4 relative z-10   hover:bg-slate-900/80"
        : "p-3 border-b border-slate-700 flex items-center gap-4 relative z-10 bg-slate-800/80 ";

    return (
        <div className={headerClasses}>
            <button 
                onClick={onBack} 
                className="text-slate-400 hover:text-sky-400 " 
                title="Quay lại"
                aria-label="Quay lại sảnh chờ"
            >
                <span className="text-xs font-bold">[Quay lại]</span>
            </button>
            <div className="flex-grow min-w-0 flex flex-col justify-center">
                <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-lg font-bold text-slate-200 truncate">{characterName}</h2>
                </div>
                {!isImmersive && (
                    <div className="flex items-center gap-3">
                        <UnifiedConfigBadge 
                            presetName={activePresetName} 
                            onClick={() => onPresetChange && setIsConfigMenuOpen(!isConfigMenuOpen)}
                            refreshKey={refreshKey}
                        />
                        {/* Arena Mode Toggle */}
                        <div className="flex items-center gap-2 bg-slate-900/50 rounded-full px-2 py-0.5 border border-slate-700 relative">
                             <button
                                onClick={() => setArenaMode(!isArenaMode)}
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded  ${isArenaMode ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                                title={isArenaMode ? "Tắt chế độ Đấu trường" : "Bật chế độ Đấu trường (So sánh Model)"}
                             >
                                VS
                             </button>
                             
                             {isArenaMode && (
                                <>
                                    <button 
                                        onClick={() => setIsArenaSettingsOpen(!isArenaSettingsOpen)}
                                        className="text-[10px] text-rose-300 font-bold hover:text-rose-100 flex items-center gap-1 max-w-[120px]"
                                        title="Cấu hình Đấu trường"
                                    >
                                        <span className="truncate">{arenaModelId || 'Chọn Model'}</span>
                                        <span className="text-xs font-bold">[Chọn]</span>
                                    </button>
                                    <ArenaSettingsModal 
                                        isOpen={isArenaSettingsOpen} 
                                        onClose={() => setIsArenaSettingsOpen(false)} 
                                    />
                                </>
                             )}
                        </div>

                         {/* Quick Config Modal attached to the badge area */}
                         <div className="relative">
                            <QuickConfigModal 
                                isOpen={isConfigMenuOpen}
                                onClose={() => setIsConfigMenuOpen(false)}
                                activePresetName={activePresetName}
                                onPresetChange={onPresetChange}
                                activePersonaId={activePersonaId}
                                onPersonaChange={onPersonaChange}
                                onConnectionChange={handleConnectionChange}
                            />
                         </div>
                    </div>
                )}
            </div>

            {/* TTS Controls */}
            <TTSControls />

            {/* --- ACTION BUTTONS --- */}
            
            {/* Sync Lorebook Toggle */}
            {onSyncLorebook && (
                <button
                    onClick={onSyncLorebook}
                    disabled={isSyncingLorebook}
                    className={`p-2 rounded-full  ${isSyncingLorebook ? 'bg-sky-600 text-white ' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                    title="Đồng bộ Lorebook Ngữ nghĩa"
                >
                    <span className="text-xs font-bold">[Đồng bộ]</span>
                </button>
            )}
            
            {/* RPG Dashboard Toggle */}
            {hasRpgData && onToggleRpgDashboard && (
                <button
                    onClick={onToggleRpgDashboard}
                    className={`p-2 rounded-full  ${isRpgDashboardOpen ? 'bg-rose-600 text-white shadow-lg shadow-rose-900/50' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                    title="Bật/Tắt RPG Dashboard (Mythic Engine)"
                >
                    <span className="text-xs font-bold">[RPG]</span>
                </button>
            )}

            {/* Assistant Toggle */}
            {onToggleAssistant && (
                <button
                    onClick={onToggleAssistant}
                    className={`p-2 rounded-full  ${isAssistantOpen ? 'bg-sky-600 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                    title="Bật/Tắt Trợ lý Co-pilot"
                >
                    <span className="text-xs font-bold">[Trợ lý]</span>
                </button>
            )}

            {/* Chat Settings Toggle (Consolidated) */}
            <div className="relative">
                <button 
                    ref={triggerRef}
                    onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
                    className={`p-2 rounded-full  ${isSettingsMenuOpen ? 'bg-slate-700 text-white' : 'text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                    title="Cài đặt Trò chuyện (Giao diện & Công cụ)"
                >
                     <span className="text-xs font-bold">[Cài đặt]</span>
                </button>
                <ChatSettingsModal 
                    isOpen={isSettingsMenuOpen} 
                    onClose={handleCloseMenu}
                    visualState={visualState}
                    onUpdate={onVisualUpdate}
                    isHUDOpen={isHUDOpen}
                    onToggleHUD={onToggleHUD}
                    isStatusHUDOpen={isStatusHUDOpen}
                    onToggleStatusHUD={onToggleStatusHUD}
                />
            </div>
        </div>
    );
};
