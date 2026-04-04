
import { useCallback } from 'react';
import { useChatStore } from '../../store/chatStore';
import { processVariableUpdates } from '../../services/variableEngine';
import { processWithRegex } from '../../services/regexService';
import type { ChatMessage, QuickReply } from '../../types';

// Helper: Trích xuất các lựa chọn từ văn bản thô
// Hỗ trợ: [CHOICE: "Nội dung"], [CHOICE: 'Nội dung'], [CHOICE: “Nội dung”], [CHOICE: 「Nội dung」]
const extractChoices = (text: string): QuickReply[] => {
    const choices: QuickReply[] = [];
    // Regex giải thích:
    // \[CHOICE:\s*   -> Bắt đầu bằng [CHOICE: và khoảng trắng tùy ý
    // (?:["'“「])     -> Non-capturing group: Mở ngoặc bằng ", ', “, hoặc 「
    // (.*?)          -> Capturing group 1: Nội dung bên trong (non-greedy)
    // (?:["'”」])     -> Non-capturing group: Đóng ngoặc bằng ", ', ”, hoặc 」
    // \s*\]          -> Khoảng trắng tùy ý và đóng thẻ ]
    const regex = /\[CHOICE:\s*(?:["'“「])(.*?)(?:["'”」])\s*\]/gi;
    
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (match[1]) {
            const content = match[1].trim();
            if (content) {
                choices.push({
                    label: content,
                    message: content // Khi bấm nút sẽ gửi nội dung này
                });
            }
        }
    }
    return choices;
};

export const useResponseHandler = () => {
    const { setVariables, addMessage, updateMessage, variables, card, setQuickReplies, visualState } = useChatStore();

    const processAIResponse = useCallback(async (rawText: string, messageId: string) => {
        // 0. Trích xuất CHOICE (Quick Replies) trước khi làm sạch văn bản
        // Bước này giúp bắt được các lựa chọn ngay cả khi chúng bị ẩn hoặc xóa bởi script sau này
        const extractedChoices = extractChoices(rawText);
        
        // Nếu tìm thấy lựa chọn mới, cập nhật ngay vào UI
        if (extractedChoices.length > 0) {
            setQuickReplies(extractedChoices);
        } else {
            // Tùy chọn: Bạn có thể bỏ comment dòng dưới nếu muốn xóa nút cũ khi không có nút mới
            // setQuickReplies([]); 
        }

        let displayContent = rawText;
        let interactiveHtml: string | null = null;
        let updatedVariables = variables;

        // 1 & 2. Xử lý Biến số và Regex - Chỉ khi KHÔNG tắt tương tác
        if (!visualState.disableInteractiveMode) {
            // 1. Cập nhật biến số (Variable Engine)
            const result = processVariableUpdates(rawText, variables);
            updatedVariables = result.updatedVariables;
            setVariables(updatedVariables);
            
            displayContent = result.cleanedText;

            // 2. Chạy Regex và trích xuất HTML (Regex Service)
            const scripts = card?.extensions?.regex_scripts || [];
            const regexResult = processWithRegex(displayContent, scripts, [2]);
            displayContent = regexResult.displayContent;
            interactiveHtml = regexResult.interactiveHtml;
        }

        // 3. Cập nhật tin nhắn trong Store
        updateMessage(messageId, {
            content: displayContent,
            interactiveHtml: interactiveHtml || undefined,
            originalRawContent: rawText,
            contextState: updatedVariables
        });

        return { updatedVariables, displayContent, interactiveHtml };
    }, [variables, card, setVariables, updateMessage, setQuickReplies, visualState.disableInteractiveMode]);

    const createPlaceholderMessage = useCallback((role: 'model' | 'user' | 'system'): ChatMessage => {
        return {
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            role,
            content: '...',
            timestamp: Date.now()
        };
    }, []);

    return { processAIResponse, createPlaceholderMessage };
};