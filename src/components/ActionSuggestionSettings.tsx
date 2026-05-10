import React, { useState, useEffect } from 'react';
import { 
    getGlobalActionSuggestionSettings, 
    saveGlobalActionSuggestionSettings,
    getConnectionSettings
} from '../services/settingsService';
import { useGeminiModels } from '../hooks/useGeminiModels';
import { useToast } from './ToastSystem';
import { ToggleInput } from './ui/ToggleInput';
import { SelectInput } from './ui/SelectInput';
import { LabeledTextarea } from './ui/LabeledTextarea';

export const ActionSuggestionSettings: React.FC = () => {
    const { showToast } = useToast();
    const [enabled, setEnabled] = useState(false);
    const [geminiModel, setGeminiModel] = useState('');
    const [promptText, setPromptText] = useState('');
    const { models: geminiModels, isLoading } = useGeminiModels([]);

    const conn = getConnectionSettings();
    const isGeminiSource = conn.source === 'gemini';

    useEffect(() => {
        const settings = getGlobalActionSuggestionSettings();
        setEnabled(settings.enabled);
        setGeminiModel(settings.gemini_model);
        setPromptText(settings.action_suggestion_prompt);
    }, []);

    const handleSave = () => {
        saveGlobalActionSuggestionSettings({
            enabled,
            gemini_model: geminiModel,
            action_suggestion_prompt: promptText
        });
        showToast('Đã lưu cấu hình Gợi ý hành động', 'success');
    };

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-xl font-bold text-sky-400 mb-2">Cài đặt Gợi ý Hành động</h3>
                <p className="text-sm text-slate-400 mb-4">
                    Gợi ý các hành động tiếp theo dựa trên lịch sử trò chuyện và ý định của bạn.
                </p>
                <div className="space-y-4">
                    <ToggleInput 
                        label="Bật Gợi ý Hành động"
                        checked={enabled}
                        onChange={setEnabled}
                    />

                    {enabled && isGeminiSource && (
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                            <label className="block text-sm font-bold text-indigo-300 mb-2">Mô hình Google Gemini (Chuyên dụng)</label>
                            <SelectInput
                                value={geminiModel}
                                onChange={(e) => setGeminiModel(e.target.value)}
                                options={geminiModels.map(m => ({ value: m.id, label: m.name }))}
                                disabled={isLoading}
                            />
                            <p className="text-xs text-slate-500 mt-2">
                                * Yêu cầu này chạy dưới nền nên có thể chọn các mô hình nhẹ và tốc độ cao như Flash.
                            </p>
                        </div>
                    )}
                    
                    {enabled && !isGeminiSource && (
                         <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                            <p className="text-sm text-slate-300">
                                Đang sử dụng {conn.source === 'proxy' ? 'Proxy Tool Model' : 'OpenRouter Model'} (Được cấu hình trong Thiết lập API)
                            </p>
                        </div>
                    )}

                    {enabled && (
                        <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                            <h4 className="text-sm font-bold text-sky-300 mb-2">Tùy chỉnh Lời nhắc (Prompt)</h4>
                            <p className="text-xs text-slate-400 mb-4">Các biến mặc định: <code className="text-sky-300">{"{{long_term_summary}}"}</code>, <code className="text-sky-300">{"{{current_page_history}}"}</code>, <code className="text-sky-300">{"{{worldInfo}}"}</code>, <code className="text-sky-300">{"{{user_input}}"}</code></p>
                            <LabeledTextarea
                                label="Lời nhắc (System Prompt)"
                                value={promptText}
                                onChange={(e) => setPromptText(e.target.value)}
                                rows={15}
                                placeholder="Nhập lời nhắc tuỳ chỉnh cho Gợi ý hành động..."
                            />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end border-t border-slate-700 pt-4">
                <button
                    onClick={handleSave}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-6 rounded-lg shadow-lg"
                >
                    Lưu cấu hình
                </button>
            </div>
        </div>
    );
};
