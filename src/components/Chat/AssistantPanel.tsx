
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { getApiKey, MODEL_OPTIONS } from '../../services/settingsService';
import type { ChatMessage, CharacterCard, ChatTurnLog, SystemLogEntry, PromptEntry, WorldInfoEntry } from '../../types';
import { Loader } from '../Loader';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useCharacter } from '../../contexts/CharacterContext';
import { usePreset } from '../../contexts/PresetContext';
import { useToast } from '../ToastSystem';
import { useGeminiModels } from '../../hooks/useGeminiModels';

interface AssistantPanelProps {
    isOpen: boolean;
    onClose: () => void;
    gameHistory: ChatMessage[];
    card: CharacterCard | null;
    variables: Record<string, any>;
    logs: {
        turns: ChatTurnLog[];
        systemLog: SystemLogEntry[];
        smartScanLog: string[];
        worldInfoLog: string[];
    };
    // NEW PROPS FOR ADVANCED ACTIONS
    onUpdateVariable: (key: string, value: any) => void;
    onRewriteMessage: (messageId: string, newContent: string) => void;
}

interface AssistantMessage {
    role: 'user' | 'model';
    content: string;
    actionProposal?: ActionPayload; // AI có thể đính kèm đề xuất hành động
}

// Định nghĩa cấu trúc JSON mà AI sẽ trả về để đề xuất hành động
interface ActionPayload {
    tool: 'add_prompt' | 'update_author_note' | 'add_lore' | 'move_prompt' | 'toggle_prompt' | 'edit_prompt' | 'update_variable' | 'rewrite_last_turn';
    reason: string;
    data: any;
}

const DEFAULT_CO_PILOT_PROMPT = `Bạn là Trợ lý Architect Co-pilot thông minh cho hệ thống SillyTavern.
Nhiệm vụ: Giải thích hành vi nhân vật, gỡ lỗi logic, quản lý biến số trò chơi, và ĐỀ XUẤT CÁC THAY ĐỔI CẤU TRÚC (Prompt/Lore/Settings) để sửa lỗi.

DỮ LIỆU CỐT LÕI (SỔ TAY):
{{char_book}}

CẤU TRÚC PROMPT HIỆN TẠI (Thứ tự thực thi từ trên xuống dưới):
{{prompt_structure}}

TRẠNG THÁI GAME HIỆN TẠI (BIẾN SỐ):
{{variables}}

LỊCH SỬ HỘI THOẠI (GAMEPLAY):
--- Bắt đầu ---
{{roleplay_history}}
--- Kết thúc ---

LỜI NHẮC HỆ THỐNG VỪA GỬI ĐI (Dùng để phân tích lý do AI phản hồi):
--- Bắt đầu Prompt ---
{{last_outgoing_prompt}}
--- Kết thúc Prompt ---

CÂU HỎI CỦA NGƯỜI DÙNG:
"{{user_query}}"

QUY TẮC PHẢN HỒI (RẤT QUAN TRỌNG):
1. Phân tích nguyên nhân vấn đề dựa trên Lịch sử hội thoại và Biến số.
2. Nếu cần can thiệp kỹ thuật, bạn PHẢI xuất ra một khối mã JSON ở cuối câu trả lời theo định dạng sau:

\`\`\`json
{
  "tool": "tên_công_cụ",
  "reason": "Lý do ngắn gọn cho hành động này",
  "data": { ... }
}
\`\`\`

DANH SÁCH CÔNG CỤ (TOOLS):

1. **update_variable** (Điều chỉnh biến số trò chơi):
   - Dùng khi: Cần sửa HP, chỉ số thiện cảm, trạng thái nhân vật...
   - Data: { "key": "tên_biến (ví dụ: stat_data.hp)", "value": giá_trị_mới }

2. **rewrite_last_turn** (Viết lại lượt phản hồi cuối của AI):
   - Dùng khi: AI trả lời sai logic, OOC (Out of Character), hoặc văn phong kém.
   - Data: { "content": "Nội dung phản hồi mới hoàn chỉnh mà bạn viết lại..." }

3. **add_prompt** (Thêm prompt mới):
   - Data: { "name": "Tên", "content": "Nội dung...", "role": "system", "enabled": true }

4. **move_prompt** (Di chuyển vị trí prompt):
   - Data: { "name": "Tên chính xác", "position": "top" | "bottom" | số_index }

5. **toggle_prompt** (Bật/Tắt prompt):
   - Data: { "name": "Tên chính xác", "enabled": true | false }

6. **edit_prompt** (Sửa nội dung prompt có sẵn):
   - Data: { "name": "Tên chính xác", "content": "Nội dung MỚI" }

Lưu ý: Chỉ xuất JSON nếu thực sự cần hành động.`;

// --- ACTION CARD COMPONENT ---
const ActionProposalCard: React.FC<{
    proposal: ActionPayload;
    onExecute: (target: 'preset' | 'character') => void;
}> = ({ proposal, onExecute }) => {
    const [target, setTarget] = useState<'preset' | 'character'>('preset');
    const [isExecuted, setIsExecuted] = useState(false);

    const handleExecute = () => {
        onExecute(target);
        setIsExecuted(true);
    };

    const getActionTitle = () => {
        switch (proposal.tool) {
            case 'add_prompt': return 'Thêm Lời Nhắc Mới';
            case 'move_prompt': return 'Di Chuyển Lời Nhắc';
            case 'toggle_prompt': return 'Bật/Tắt Lời Nhắc';
            case 'edit_prompt': return 'Chỉnh Sửa Nội Dung';
            case 'update_author_note': return 'Sửa Ghi Chú Tác Giả';
            case 'add_lore': return 'Thêm World Info';
            case 'update_variable': return 'Cập Nhật Biến Số';
            case 'rewrite_last_turn': return 'Viết Lại Phản Hồi';
            default: return 'Hành Động';
        }
    };

    const getActionColor = () => {
        switch (proposal.tool) {
            case 'add_prompt': return 'text-green-400';
            case 'move_prompt': return 'text-blue-400';
            case 'toggle_prompt': return 'text-amber-400';
            case 'edit_prompt': return 'text-fuchsia-400';
            case 'update_variable': return 'text-rose-400';
            case 'rewrite_last_turn': return 'text-cyan-400';
            default: return 'text-indigo-300';
        }
    };

    const isDirectAction = proposal.tool === 'update_variable' || proposal.tool === 'rewrite_last_turn';

    if (isExecuted) {
        return (
            <div className="mt-2 p-3 bg-green-900/30 border border-green-500/50 rounded-lg text-green-300 text-sm flex items-center gap-2">
                <span>[Thành công]</span>
                <span>Đã thực thi hành động thành công.</span>
            </div>
        );
    }

    return (
        <div className="mt-3 p-4 bg-slate-800 border border-indigo-500/50 rounded-xl shadow-lg ">
            <div className={`flex items-center gap-2 mb-2 font-bold text-sm uppercase tracking-wide ${getActionColor()}`}>
                <span>[Đề xuất]</span>
                Đề xuất: {getActionTitle()}
            </div>
            
            <p className="text-xs text-slate-400 mb-3 italic">"{proposal.reason}"</p>
            
            <div className="bg-slate-900/50 p-2 rounded border border-slate-700 mb-4 text-xs font-mono text-slate-300 max-h-48 overflow-y-auto custom-scrollbar">
                {proposal.tool === 'add_prompt' && (
                    <>
                        <div><strong className="text-sky-400">Tên:</strong> {proposal.data.name}</div>
                        <div><strong className="text-sky-400">Nội dung:</strong> {proposal.data.content}</div>
                    </>
                )}
                {proposal.tool === 'update_variable' && (
                    <>
                        <div><strong className="text-sky-400">Biến số:</strong> {proposal.data.key}</div>
                        <div><strong className="text-sky-400">Giá trị mới:</strong> {JSON.stringify(proposal.data.value)}</div>
                    </>
                )}
                {proposal.tool === 'rewrite_last_turn' && (
                    <>
                        <div className="text-gray-400 mb-1">Nội dung viết lại:</div>
                        <div className="pl-2 border-l-2 border-cyan-500/50">{proposal.data.content}</div>
                    </>
                )}
                {proposal.tool === 'move_prompt' && (
                    <>
                        <div><strong className="text-sky-400">Mục tiêu:</strong> {proposal.data.name}</div>
                        <div><strong className="text-sky-400">Đến vị trí:</strong> {proposal.data.position === 'top' ? 'Đầu danh sách' : (proposal.data.position === 'bottom' ? 'Cuối danh sách' : `Vị trí #${proposal.data.position}`)}</div>
                    </>
                )}
                {proposal.tool === 'toggle_prompt' && (
                    <>
                        <div><strong className="text-sky-400">Mục tiêu:</strong> {proposal.data.name}</div>
                        <div><strong className="text-sky-400">Trạng thái mới:</strong> {proposal.data.enabled ? 'BẬT (Enabled)' : 'TẮT (Disabled)'}</div>
                    </>
                )}
                {proposal.tool === 'edit_prompt' && (
                    <>
                        <div><strong className="text-sky-400">Mục tiêu:</strong> {proposal.data.name}</div>
                        <div className="mt-1 border-t border-slate-700 pt-1 text-green-300"><strong className="text-sky-400">Nội dung mới:</strong> {proposal.data.content}</div>
                    </>
                )}
                {proposal.tool === 'update_author_note' && (
                    <div><strong className="text-sky-400">Nội dung mới:</strong> {proposal.data.content}</div>
                )}
                {proposal.tool === 'add_lore' && (
                    <>
                        <div><strong className="text-sky-400">Keys:</strong> {proposal.data.keys?.join(', ')}</div>
                        <div><strong className="text-sky-400">Content:</strong> {proposal.data.content}</div>
                    </>
                )}
            </div>

            <div className="space-y-3">
                {!isDirectAction && (
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-slate-300">Lưu thay đổi vào đâu?</span>
                        <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-700">
                            <button 
                                onClick={() => setTarget('preset')}
                                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium  ${target === 'preset' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Preset (Toàn cục)
                            </button>
                            <button 
                                onClick={() => setTarget('character')}
                                className={`flex-1 py-1.5 px-3 rounded-md text-xs font-medium  ${target === 'character' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                            >
                                Nhân vật (Cục bộ)
                            </button>
                        </div>
                    </div>
                )}

                <button 
                    onClick={handleExecute}
                    className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-lg shadow-md  active:scale-95 text-sm flex items-center justify-center gap-2"
                >
                    <span>✅</span> {isDirectAction ? 'Thực thi Ngay' : 'Áp dụng Thay đổi'}
                </button>
            </div>
        </div>
    );
};

export const AssistantPanel: React.FC<AssistantPanelProps> = ({ 
    isOpen, 
    onClose, 
    gameHistory, 
    card, 
    variables,
    logs,
    onUpdateVariable,
    onRewriteMessage
}) => {
    const { updateActiveCharacter, reloadCharacters } = useCharacter();
    const { presets, activePresetName, updateActivePreset, reloadPresets } = usePreset();
    const { showToast } = useToast();
    const { models: geminiModels } = useGeminiModels(MODEL_OPTIONS);

    const [messages, setMessages] = useState<AssistantMessage[]>([
        { role: 'model', content: 'Xin chào! Tôi là Co-pilot. Tôi đã đọc xong Sổ tay nhân vật, Biến số và Lời nhắc hệ thống. Bạn cần tôi giải thích điều gì?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
    
    // Settings State
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [systemPrompt, setSystemPrompt] = useState(DEFAULT_CO_PILOT_PROMPT);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (!isSettingsOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen, isSettingsOpen]);

    const handleNewChat = () => {
        setMessages([{ role: 'model', content: 'Đã làm mới cuộc trò chuyện. Tôi có thể giúp gì cho bạn?' }]);
    };

    // --- EXECUTION LOGIC ---
    const executeAction = async (proposal: ActionPayload, target: 'preset' | 'character') => {
        
        // 1. Handle Direct Actions (No Save Target needed)
        if (proposal.tool === 'update_variable') {
            try {
                onUpdateVariable(proposal.data.key, proposal.data.value);
                showToast(`Đã cập nhật biến ${proposal.data.key} thành công.`, 'success');
            } catch (e) {
                showToast(`Lỗi cập nhật biến: ${e}`, 'error');
            }
            return;
        }

        if (proposal.tool === 'rewrite_last_turn') {
            try {
                // Find the last model message
                const lastModelMsg = [...gameHistory].reverse().find(m => m.role === 'model');
                if (lastModelMsg) {
                    onRewriteMessage(lastModelMsg.id, proposal.data.content);
                    showToast('Đã viết lại phản hồi mới nhất.', 'success');
                } else {
                    showToast('Không tìm thấy tin nhắn nào của AI để viết lại.', 'warning');
                }
            } catch (e) {
                showToast(`Lỗi viết lại: ${e}`, 'error');
            }
            return;
        }

        // 2. Handle Structural Actions (Need Card/Preset)
        if (!card) {
            showToast("Không tìm thấy thẻ nhân vật đang hoạt động.", 'error');
            return;
        }

        try {
            if (target === 'preset') {
                const activePreset = presets.find(p => p.name === activePresetName);
                if (!activePreset) throw new Error("Không tìm thấy Preset đang hoạt động.");

                // Deep copy preset
                const newPreset = JSON.parse(JSON.stringify(activePreset));
                if (!newPreset.prompts) newPreset.prompts = [];

                if (proposal.tool === 'add_prompt') {
                    newPreset.prompts.push({
                        ...proposal.data,
                        identifier: `auto_${Date.now()}` // Ensure ID
                    });
                } else if (proposal.tool === 'move_prompt') {
                    const idx = newPreset.prompts.findIndex((p: PromptEntry) => p.name === proposal.data.name);
                    if (idx !== -1) {
                        const [item] = newPreset.prompts.splice(idx, 1);
                        let newIdx = 0;
                        if (proposal.data.position === 'top') newIdx = 0;
                        else if (proposal.data.position === 'bottom') newIdx = newPreset.prompts.length;
                        else newIdx = Math.min(Math.max(0, parseInt(proposal.data.position)), newPreset.prompts.length);
                        
                        newPreset.prompts.splice(newIdx, 0, item);
                    }
                } else if (proposal.tool === 'toggle_prompt') {
                    const idx = newPreset.prompts.findIndex((p: PromptEntry) => p.name === proposal.data.name);
                    if (idx !== -1) {
                        newPreset.prompts[idx].enabled = proposal.data.enabled;
                    }
                } else if (proposal.tool === 'edit_prompt') {
                    const idx = newPreset.prompts.findIndex((p: PromptEntry) => p.name === proposal.data.name);
                    if (idx !== -1) {
                        newPreset.prompts[idx].content = proposal.data.content;
                    }
                } else if (proposal.tool === 'update_author_note') {
                    // Map Author Note to a System Prompt in Preset if target is preset
                    newPreset.prompts.push({
                        name: "Author Note (AI Added)",
                        content: proposal.data.content,
                        role: 'system',
                        enabled: true,
                        identifier: `an_${Date.now()}`
                    });
                } else if (proposal.tool === 'add_lore') {
                     newPreset.prompts.push({
                        name: `Lore: ${proposal.data.keys?.[0] || 'New Info'}`,
                        content: `${proposal.data.keys?.join(', ')}: ${proposal.data.content}`,
                        role: 'system',
                        enabled: true,
                        identifier: `lore_${Date.now()}`
                    });
                }

                await updateActivePreset(newPreset);
                showToast("Đã cập nhật Preset thành công!", 'success');
                await reloadPresets(); // Refresh context
            } 
            else if (target === 'character') {
                // Deep copy card
                const newCard = JSON.parse(JSON.stringify(card));

                // Character Cards are harder to edit structurally via "Move", so we handle logic gracefully
                if (proposal.tool === 'add_prompt') {
                    newCard.system_prompt = (newCard.system_prompt || '') + `\n\n[${proposal.data.name}]\n${proposal.data.content}`;
                } else if (proposal.tool === 'update_author_note') {
                    newCard.system_prompt = (newCard.system_prompt || '') + `\n\n[Author Note]\n${proposal.data.content}`;
                } else if (proposal.tool === 'add_lore') {
                    if (!newCard.char_book) newCard.char_book = { entries: [] };
                    if (!newCard.char_book.entries) newCard.char_book.entries = [];
                    
                    const newEntry: WorldInfoEntry = {
                        keys: proposal.data.keys || ['keyword'],
                        content: proposal.data.content || '',
                        comment: `AI Generated - ${new Date().toLocaleTimeString()}`,
                        enabled: true,
                        constant: false,
                        selective: true,
                        uid: `ai_gen_${Date.now()}`
                    };
                    newCard.char_book.entries.push(newEntry);
                } else if (proposal.tool === 'edit_prompt') {
                    // Try to find if it's a known field
                    const key = Object.keys(newCard).find(k => k.toLowerCase() === proposal.data.name.toLowerCase());
                    if (key && typeof newCard[key] === 'string') {
                        newCard[key] = proposal.data.content;
                        showToast(`Đã cập nhật trường '${key}' của nhân vật.`, 'success');
                    } else {
                        // Fallback: Append to system prompt
                        newCard.system_prompt = (newCard.system_prompt || '') + `\n\n[Edit: ${proposal.data.name}]\n${proposal.data.content}`;
                        showToast(`Đã thêm nội dung vào System Prompt nhân vật (Không tìm thấy trường '${proposal.data.name}').`, 'info');
                    }
                } else {
                    showToast("Hành động này (Move/Toggle) chỉ hỗ trợ tốt nhất trên Preset.", 'warning');
                    return;
                }

                await updateActiveCharacter(newCard);
                showToast("Đã cập nhật Thẻ Nhân vật thành công!", 'success');
                await reloadCharacters();
            }
        } catch (e) {
            console.error(e);
            showToast(`Lỗi khi lưu: ${e instanceof Error ? e.message : String(e)}`, 'error');
        }
    };

    // --- DATA EXTRACTION HELPERS ---

    const getFormattedLorebook = () => {
        if (!card?.char_book?.entries) return "(Không có Sổ tay)";
        return card.char_book.entries
            .filter(e => e.enabled !== false)
            .map(e => `[Mục: ${e.comment || 'Không tên'}]\nKeys: ${e.keys.join(', ')}\nNội dung: ${e.content}`)
            .join('\n\n');
    };

    const getPromptStructureMap = () => {
        const activePreset = presets.find(p => p.name === activePresetName);
        if (!activePreset || !activePreset.prompts) return "(Không có cấu trúc Preset)";
        
        return activePreset.prompts.map((p, idx) => {
            const status = p.enabled ? "[BẬT]" : "[TẮT]";
            return `${idx}. ${status} "${p.name}"`;
        }).join('\n');
    };

    const getLastOutgoingPrompt = () => {
        if (!logs.turns || logs.turns.length === 0) return "(Chưa có lượt nào được ghi lại)";
        const lastTurn = logs.turns[0]; 
        return lastTurn.prompt.map(p => `--- ${p.name} ---\n${p.content}`).join('\n\n');
    };

    const getRoleplayHistory = () => {
        // Get the last 15 messages for context
        return gameHistory.slice(-15).map(m => {
            const role = m.role === 'user' ? 'User' : (card?.name || 'Char');
            // Clean simple html if any
            let content = m.content.replace(/<[^>]*>/g, ''); 
            // Truncate if too long
            if (content.length > 500) content = content.substring(0, 500) + '...';
            return `${role}: ${content}`;
        }).join('\n');
    };

    const getFormattedHistory = () => {
        // This is Architect's OWN chat history
        return messages.slice(-10).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    };

    // --- PROMPT BUILDER ---

    const buildContextPrompt = (userQuery: string) => {
        let finalPrompt = systemPrompt;
        finalPrompt = finalPrompt.replace('{{char_book}}', getFormattedLorebook());
        finalPrompt = finalPrompt.replace('{{prompt_structure}}', getPromptStructureMap());
        finalPrompt = finalPrompt.replace('{{variables}}', JSON.stringify(variables, null, 2));
        finalPrompt = finalPrompt.replace('{{last_outgoing_prompt}}', getLastOutgoingPrompt());
        finalPrompt = finalPrompt.replace('{{roleplay_history}}', getRoleplayHistory()); // NEW
        finalPrompt = finalPrompt.replace('{{chat_history}}', getFormattedHistory());
        finalPrompt = finalPrompt.replace('{{char}}', card?.name || 'Character');
        finalPrompt = finalPrompt.replace('{{user}}', 'User');
        finalPrompt = finalPrompt.replace('{{user_query}}', userQuery);
        return finalPrompt;
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg = input;
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setInput('');
        setIsLoading(true);

        try {
            const apiKey = getApiKey();
            if (!apiKey) throw new Error("Chưa có API Key.");

            const ai = new GoogleGenAI({ apiKey });
            const fullPrompt = buildContextPrompt(userMsg);

            const response = await ai.models.generateContent({
                model: selectedModel,
                contents: fullPrompt,
            });

            const text = response.text || "Xin lỗi, tôi không thể phản hồi lúc này.";
            
            // Try to extract JSON block
            let actionPayload: ActionPayload | undefined;
            let displayContent = text;

            const jsonMatch = text.match(/```json\s*(\{[\s\S]*?\})\s*```/);
            if (jsonMatch) {
                try {
                    actionPayload = JSON.parse(jsonMatch[1]);
                    // Clean the JSON block from display text so it doesn't look messy
                    displayContent = text.replace(jsonMatch[0], '').trim();
                } catch (e) {
                    console.warn("Failed to parse Action JSON from AI response");
                }
            }

            setMessages(prev => [...prev, { 
                role: 'model', 
                content: displayContent,
                actionProposal: actionPayload 
            }]);

        } catch (error) {
            setMessages(prev => [...prev, { role: 'model', content: `Lỗi: ${error instanceof Error ? error.message : String(error)}` }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 z-[60] w-[450px] max-w-full bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col    ease-in-out ">
            {/* Header */}
            <div className="p-3 border-b border-slate-700 bg-slate-800/80 flex flex-col gap-3 shrink-0">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-sky-400 flex items-center gap-2">
                        <span>🤖</span> Trợ Lý Co-pilot (Architect)
                    </h3>
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className={`p-1.5 rounded  ${isSettingsOpen ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}
                            title="Cài đặt Prompt Co-pilot"
                        >
                            <span>[Cài đặt]</span>
                        </button>
                        <button 
                            onClick={handleNewChat}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded "
                            title="Cuộc trò chuyện mới"
                        >
                            <span>[Mới]</span>
                        </button>
                        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded ">
                            <span>[Đóng]</span>
                        </button>
                    </div>
                </div>
                
                {/* Model Selector */}
                <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Model Trợ Lý</label>
                    <select 
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-1.5 text-xs text-slate-300 focus:ring-1 focus:ring-sky-500 outline-none"
                    >
                        {geminiModels.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-grow overflow-hidden relative flex flex-col">
                
                {/* Settings View (Overlay) */}
                {isSettingsOpen ? (
                    <div className="absolute inset-0 bg-slate-900 z-10 flex flex-col p-4 ">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-slate-200">Cấu hình Prompt Co-pilot</h4>
                            <button onClick={() => setSystemPrompt(DEFAULT_CO_PILOT_PROMPT)} className="text-xs text-sky-400 hover:underline">Khôi phục mặc định</button>
                        </div>
                        <div className="flex-grow flex flex-col">
                            <textarea
                                value={systemPrompt}
                                onChange={(e) => setSystemPrompt(e.target.value)}
                                className="flex-grow w-full bg-slate-800 border border-slate-600 rounded-lg p-3 text-xs font-mono text-slate-300 focus:ring-1 focus:ring-indigo-500 resize-none"
                                placeholder="Nhập prompt hệ thống..."
                            />
                            
                            {/* DOCUMENTATION BLOCK */}
                            <div className="mt-3 text-[10px] text-slate-400 bg-slate-950/50 p-3 rounded border border-slate-800 h-64 overflow-y-auto custom-scrollbar">
                                <h5 className="font-bold text-slate-300 mb-2 border-b border-slate-700 pb-1">1. Các Biến số (Macros)</h5>
                                <div className="space-y-3 mb-4">
                                    <div>
                                        <code className="text-sky-400 font-mono font-bold">{'{{char_book}}'}</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Nội dung Sổ tay Thế giới (Lorebook) đang kích hoạt.</p>
                                    </div>
                                    <div>
                                        <code className="text-sky-400 font-mono font-bold">{'{{prompt_structure}}'}</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Danh sách và trạng thái (Bật/Tắt) của các Lời nhắc (Prompt) trong Preset.</p>
                                    </div>
                                    <div>
                                        <code className="text-sky-400 font-mono font-bold">{'{{variables}}'}</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Toàn bộ biến số hiện tại của trò chơi (stat_data).</p>
                                    </div>
                                    <div>
                                        <code className="text-sky-400 font-mono font-bold">{'{{roleplay_history}}'}</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Lịch sử hội thoại của câu chuyện chính (giữa User và Character).</p>
                                    </div>
                                    <div>
                                        <code className="text-sky-400 font-mono font-bold">{'{{chat_history}}'}</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Lịch sử trò chuyện giữa Bạn và Co-pilot này.</p>
                                    </div>
                                    <div>
                                        <code className="text-sky-400 font-mono font-bold">{'{{last_outgoing_prompt}}'}</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Toàn bộ lời nhắc hệ thống thực tế vừa gửi đi cho AI ở lượt trước.</p>
                                    </div>
                                    <div>
                                        <code className="text-sky-400 font-mono font-bold">{'{{user_query}}'}</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Câu hỏi hiện tại của bạn dành cho Co-pilot.</p>
                                    </div>
                                    <div>
                                        <code className="text-sky-400 font-mono font-bold">{'{{char}} / {{user}}'}</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Tên nhân vật và tên người dùng.</p>
                                    </div>
                                </div>

                                <h5 className="font-bold text-slate-300 mb-2 border-b border-slate-700 pb-1">2. Các Công cụ (Tools) AI có thể gọi</h5>
                                <div className="space-y-3">
                                    <div>
                                        <code className="text-rose-400 font-mono font-bold">update_variable</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Điều chỉnh giá trị biến số (ví dụ: HP, thiện cảm...).</p>
                                    </div>
                                    <div>
                                        <code className="text-cyan-400 font-mono font-bold">rewrite_last_turn</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Viết lại nội dung phản hồi cuối cùng của nhân vật chính.</p>
                                    </div>
                                    <div>
                                        <code className="text-green-400 font-mono font-bold">add_prompt</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Thêm một lời nhắc hệ thống mới vào Preset.</p>
                                    </div>
                                    <div>
                                        <code className="text-blue-400 font-mono font-bold">move_prompt</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Thay đổi vị trí thứ tự của một lời nhắc.</p>
                                    </div>
                                    <div>
                                        <code className="text-amber-400 font-mono font-bold">toggle_prompt</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Bật hoặc Tắt trạng thái hoạt động của một lời nhắc.</p>
                                    </div>
                                    <div>
                                        <code className="text-fuchsia-400 font-mono font-bold">edit_prompt</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Chỉnh sửa nội dung của một lời nhắc có sẵn.</p>
                                    </div>
                                    <div>
                                        <code className="text-indigo-400 font-mono font-bold">add_lore</code>
                                        <p className="pl-2 text-slate-500 mt-0.5">Thêm một mục World Info mới vào ngữ cảnh.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <button 
                            onClick={() => setIsSettingsOpen(false)}
                            className="mt-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded-lg "
                        >
                            Lưu & Quay lại
                        </button>
                    </div>
                ) : (
                    /* Chat View */
                    <div className="flex-grow overflow-y-auto custom-scrollbar p-3 space-y-3 bg-slate-900">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[95%] rounded-lg p-3 text-sm ${
                                    msg.role === 'user' 
                                    ? 'bg-sky-700 text-white rounded-tr-none' 
                                    : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                                }`}>
                                    {msg.role === 'model' ? (
                                        <>
                                            <div className="markdown-content" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(msg.content) as string) }} />
                                            {msg.actionProposal && (
                                                <ActionProposalCard 
                                                    proposal={msg.actionProposal} 
                                                    onExecute={(target) => executeAction(msg.actionProposal!, target)} 
                                                />
                                            )}
                                        </>
                                    ) : (
                                        msg.content
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex items-start">
                                <div className="bg-slate-800 rounded-lg p-2 rounded-tl-none border border-slate-700 flex items-center gap-2 text-slate-400 text-xs">
                                    <Loader message="" />
                                    <span>Đang phân tích dữ liệu...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}
            </div>

            {/* Input Area (Only visible when not in settings) */}
            {!isSettingsOpen && (
                <div className="p-3 border-t border-slate-700 bg-slate-800 shrink-0">
                    <div className="relative">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Hỏi Co-pilot (Ví dụ: Tại sao chỉ số HP lại giảm?)..."
                            rows={2}
                            disabled={isLoading}
                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2 pr-10 text-sm text-slate-200 focus:outline-none focus:border-sky-500 resize-none"
                        />
                        <button 
                            onClick={handleSend}
                            disabled={!input.trim() || isLoading}
                            className="absolute bottom-2 right-2 p-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-md  disabled:bg-slate-700 disabled:text-slate-500"
                        >
                            <span>[Gửi]</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
