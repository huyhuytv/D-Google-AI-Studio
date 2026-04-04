
import React, { useState, useEffect } from 'react';
import { 
    MODEL_OPTIONS, 
    getGlobalSmartScanSettings, 
    saveGlobalSmartScanSettings, 
    DEFAULT_SMART_SCAN_SETTINGS, 
    GlobalSmartScanSettings
} from '../services/settingsService';
import { SelectInput } from './ui/SelectInput';
import { SliderInput } from './ui/SliderInput';
import { LabeledTextarea } from './ui/LabeledTextarea';
import { ToggleInput } from './ui/ToggleInput';
import { useToast } from './ToastSystem';

export const SmartScanSettings: React.FC = () => {
    const [settings, setSettings] = useState<GlobalSmartScanSettings>(DEFAULT_SMART_SCAN_SETTINGS);
    const [showPromptEditor, setShowPromptEditor] = useState(false);
    const { showToast } = useToast();

    // Load initial settings on mount
    useEffect(() => {
        const loaded = getGlobalSmartScanSettings();
        setSettings(loaded);
    }, []);

    const handleUpdate = (key: keyof GlobalSmartScanSettings, value: any) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        saveGlobalSmartScanSettings(newSettings);
    };

    const resetToDefault = () => {
        if(window.confirm('Bạn có chắc muốn khôi phục toàn bộ cấu hình quét về mặc định?')) {
            setSettings(DEFAULT_SMART_SCAN_SETTINGS);
            saveGlobalSmartScanSettings(DEFAULT_SMART_SCAN_SETTINGS);
            showToast('Đã khôi phục cấu hình mặc định.', 'info');
        }
    };

    const hasEmbedding = ['semantic', 'hybrid_fast', 'ultimate'].includes(settings.mode);
    const hasLLM = ['llm_only', 'ultimate'].includes(settings.mode);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                 <h3 className="text-xl font-bold text-sky-400">Smart Scan Toàn Cục</h3>
                 <ToggleInput 
                    label="Kích hoạt" 
                    checked={settings.enabled} 
                    onChange={(v) => handleUpdate('enabled', v)} 
                    clean
                />
            </div>

            <div className={`space-y-6   ${!settings.enabled ? 'opacity-50 pointer-events-none' : ''}`}>
                <SelectInput 
                    label="Chế độ Quét"
                    value={settings.mode}
                    onChange={(e) => handleUpdate('mode', e.target.value)}
                    options={[
                        { value: 'keyword', label: '1. Truyền thống (Chỉ Từ khóa)' },
                        { value: 'semantic', label: '2. Ngữ nghĩa (Chỉ Embedding)' },
                        { value: 'hybrid_fast', label: '3. Kết hợp Nhanh (Từ khóa + Embedding) - KHUYÊN DÙNG' },
                        { value: 'llm_only', label: '4. Suy luận Sâu (Chỉ LLM)' },
                        { value: 'ultimate', label: '5. Tối thượng (Từ khóa + Embedding + LLM)' }
                    ]}
                />

                {hasEmbedding && (
                    <div className="bg-sky-900/20 border border-sky-500/30 p-4 rounded-lg space-y-4 ">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sky-400 font-bold text-sm uppercase tracking-wide">Cài đặt Ngữ nghĩa (Embedding)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <SliderInput
                                label="Ngưỡng Tương đồng (Threshold)"
                                value={settings.semantic_threshold || 0.7}
                                onChange={(v) => handleUpdate('semantic_threshold', v)}
                                min={0.1}
                                max={1.0}
                                step={0.05}
                            />
                            <SliderInput
                                label="Ngân sách Mục Ngữ nghĩa (Max Entries)"
                                value={settings.max_semantic_entries || 20}
                                onChange={(v) => handleUpdate('max_semantic_entries', v)}
                                min={1}
                                max={50}
                                step={1}
                            />
                            <SliderInput
                                label="Số mục đồng bộ mỗi lần (Batch Size)"
                                value={settings.embedding_batch_size || 30}
                                onChange={(v) => handleUpdate('embedding_batch_size', v)}
                                min={1}
                                max={100}
                                step={1}
                            />
                        </div>
                    </div>
                )}

                {hasLLM && (
                    <div className="bg-indigo-900/20 border border-indigo-500/30 p-4 rounded-lg space-y-4 ">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-indigo-400 font-bold text-sm uppercase tracking-wide">Cài đặt Suy luận (LLM)</span>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700 space-y-4">
                            <SelectInput 
                                label="Chiến lược Nội dung"
                                value={settings.scan_strategy || 'efficient'}
                                onChange={(e) => handleUpdate('scan_strategy', e.target.value)}
                                options={[
                                    { value: 'efficient', label: '⚡ Tối ưu hóa (Cắt ngắn)' },
                                    { value: 'full', label: '🧠 Chính xác cao (Full)' }
                                ]}
                            />

                            <SelectInput 
                                label="Mô hình Quét (Khuyên dùng Flash)"
                                value={settings.model || 'gemini-3-flash-preview'}
                                onChange={(e) => handleUpdate('model', e.target.value)}
                                options={MODEL_OPTIONS.map(opt => ({ value: opt.id, label: opt.name }))}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <SliderInput
                                label="Độ sâu Quét (Tin nhắn)"
                                value={settings.depth || 3}
                                onChange={(v) => handleUpdate('depth', v)}
                                min={1}
                                max={10}
                                step={1}
                            />

                            <SliderInput
                                label="Ngân sách Mục LLM (Max Entries)"
                                value={settings.max_entries || 5}
                                onChange={(v) => handleUpdate('max_entries', v)}
                                min={1}
                                max={50}
                                step={1}
                            />
                        </div>

                        <div className="bg-emerald-900/20 border border-emerald-500/30 p-4 rounded-lg mt-4">
                            <div className="flex items-center gap-2 mb-2">
                                <span className="text-emerald-400 font-bold text-sm uppercase tracking-wide">AI Persistence</span>
                            </div>
                            <SliderInput
                                label="AI Sticky Duration"
                                value={settings.aiStickyDuration}
                                onChange={(v) => handleUpdate('aiStickyDuration', v)}
                                min={0}
                                max={20}
                                step={1}
                            />
                        </div>

                        {/* Prompt Editor Section */}
                        <div className="border-t border-slate-700 pt-4 mt-4">
                            <button 
                                onClick={() => setShowPromptEditor(!showPromptEditor)}
                                className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-2 font-semibold"
                            >
                                <span aria-hidden="true">{showPromptEditor ? '▼' : '▶'}</span>
                                Chỉnh sửa Lời nhắc Quét (System Prompt)
                            </button>
                            
                            {showPromptEditor && (
                                <div className="mt-4 space-y-4 ">
                                    <LabeledTextarea 
                                        label="Nội dung Prompt"
                                        value={settings.system_prompt || ''}
                                        onChange={(e) => handleUpdate('system_prompt', e.target.value)}
                                        rows={15}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="pt-4 border-t border-slate-700 flex justify-end">
                <button 
                    onClick={resetToDefault}
                    className="text-xs text-red-400 hover:text-red-300 underline"
                >
                    Khôi phục mặc định
                </button>
            </div>
        </div>
    );
};
