
import { callGeminiDirect } from '../api/geminiApi';
import { callOpenAIProxyTask } from '../api/proxyApi';
import { getConnectionSettings, getGlobalActionSuggestionSettings } from '../settingsService';
import type { ChatMessage, Lorebook } from '../../types';
import { cleanMessageContent } from '../promptManager';
import { parseLooseJson } from '../../utils';

const safetySettings = [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

export async function summarizeHistory(historySlice: ChatMessage[], cardName: string, customPrompt?: string): Promise<string> {
    const historyText = historySlice.map(msg => `${msg.role === 'user' ? 'User' : cardName}: ${cleanMessageContent(msg.content)}`).join('\n');
    const prompt = customPrompt 
        ? customPrompt.replace('{{chat_history_slice}}', historyText)
        : `Tóm tắt ngắn gọn diễn biến chính của đoạn hội thoại sau:\n\n${historyText}`;

    let responseText = "";

    if (getProxyForTools()) {
        const conn = getConnectionSettings();
        // Ưu tiên dùng model Tool, nếu không có thì dùng model Chat, cuối cùng fallback về Flash
        const targetModel = conn.proxy_tool_model || conn.proxy_model || 'gemini-3-flash-preview';
        responseText = await callOpenAIProxyTask(prompt, targetModel, conn.proxy_protocol, safetySettings);
    } else {
        const response = await callGeminiDirect('gemini-3-flash-preview', prompt, { temp: 0.3 } as any, safetySettings);
        responseText = response.text || "";
    }

    return responseText.trim();
}

// Fix: Updated signature to handle extra context from ChatModals
export async function generateLorebookEntry(
    keyword: string, 
    history: ChatMessage[], 
    longTermSummaries: string[], 
    lorebooks: Lorebook[]
): Promise<string> {
    const cardName = lorebooks.length > 0 ? lorebooks[0].name : "Character";
    const prompt = `Dựa trên lịch sử hội thoại, hãy viết một mục từ điển (Lorebook) chi tiết cho từ khóa "${keyword}".\n\nNhân vật: ${cardName}`;
    
    let responseText = "";

    if (getProxyForTools()) {
        const conn = getConnectionSettings();
        // Tạo nội dung cần model thông minh hơn một chút
        const targetModel = conn.proxy_model || conn.proxy_tool_model || 'gemini-3.1-pro-preview';
        responseText = await callOpenAIProxyTask(prompt, targetModel, conn.proxy_protocol, safetySettings);
    } else {
        const response = await callGeminiDirect('gemini-3.1-pro-preview', prompt, { temp: 0.7 } as any, safetySettings);
        responseText = response.text || "";
    }

    return responseText.trim();
}

// Fix: Updated signature to match hook usage in useWorldSystem
export async function scanWorldInfoWithAI(
    history: string,
    context: string,
    candidates: string,
    input: string,
    state: string,
    model: string,
    systemPrompt?: string
): Promise<{ selectedIds: string[], outgoingPrompt: string, rawResponse: string }> {
    const prompt = (systemPrompt || `Nhiệm vụ: Chọn các ID mục World Info cần thiết cho tình huống này.\nTrạng thái: {{state}}\nInput: {{input}}\nỨng viên: {{candidates}}\n\nTrả về mảng JSON ["id1", "id2"]`)
        .replace('{{history}}', history)
        .replace('{{context}}', context)
        .replace('{{candidates}}', candidates)
        .replace('{{input}}', input)
        .replace('{{state}}', state);

    let rawResponse = "";

    if (getProxyForTools()) {
        const conn = getConnectionSettings();
        // Smart Scan cần tốc độ, ưu tiên tool model
        const targetModel = conn.proxy_tool_model || conn.proxy_model || model || 'gemini-3-flash-preview';
        rawResponse = await callOpenAIProxyTask(prompt, targetModel, conn.proxy_protocol, safetySettings);
    } else {
        const response = await callGeminiDirect(model || 'gemini-3-flash-preview', prompt, { temp: 0 } as any, safetySettings);
        rawResponse = response.text || '[]';
    }
    
    // --- BƯỚC LÀM SẠCH QUAN TRỌNG ---
    // Loại bỏ các thẻ markdown code block (```json ... ``` hoặc ``` ... ```)
    rawResponse = rawResponse.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();

    let selectedIds: string[] = [];
    try {
        // Sử dụng parseLooseJson để linh hoạt hơn với lỗi cú pháp nhỏ
        const json = parseLooseJson(rawResponse);
        
        // Hỗ trợ cả định dạng mảng trực tiếp ["id"] hoặc object { selected_ids: ["id"] }
        selectedIds = Array.isArray(json) ? json : (json.selected_ids || []);
    } catch (e) {
        console.warn("[Smart Scan] JSON Parse Failed. Trying regex fallback...", e);
        // Fallback: Nếu parse thất bại, cố gắng dùng Regex để tìm mảng JSON trong văn bản
        const arrayMatch = rawResponse.match(/\[[\s\S]*?\]/);
        if (arrayMatch) {
             try { 
                 const fallbackJson = parseLooseJson(arrayMatch[0]);
                 selectedIds = Array.isArray(fallbackJson) ? fallbackJson : [];
             } catch {}
        } else {
            selectedIds = [];
        }
    }

    // Đảm bảo luôn trả về mảng chuỗi
    if (!Array.isArray(selectedIds)) selectedIds = [];
    selectedIds = selectedIds.map(String);

    return { selectedIds, outgoingPrompt: prompt, rawResponse };
}

export interface ActionSuggestionResponse {
    analysis?: {
        behavioral_snapshot?: any;
        story_snapshot?: string;
        tension_drivers?: string[];
    };
    suggestions: string[];
}

const ACTION_SUGGESTION_PROMPT = `Bạn là một "người đồng sáng tạo" đầy bất ngờ cho một trò chơi nhập vai AI.
Nhiệm vụ của bạn là đề xuất những hướng tiếp diễn thú vị, hợp lý và giàu
tiềm năng nhất dựa trên lịch sử câu chuyện. Hãy coi mỗi gợi ý là một
"cánh cửa" dẫn đến một ngã rẽ mới.

[THÔNG TIN ĐẦU VÀO]
- Lịch sử câu chuyện: {{story_history}}
- Ý định thô của người chơi (có thể bỏ trống): {{player_intent}}

Hãy đọc kỹ ngữ cảnh và vận hành theo các nguyên tắc cốt lõi sau.
Đây là những "định nghĩa lớn" định hướng — cách bạn thực thi, sáng tạo
và liên kết chúng là hoàn toàn tự do.

[Nguyên tắc cốt lõi]

1. **Cá nhân hóa sâu theo hành vi thực tế (Linh hồn của hệ thống):**
   * Trước khi tạo bất kỳ gợi ý nào, hãy **quay lại lịch sử và xác định
     cụ thể** những hành động, lựa chọn và câu nói mà người chơi đã thực
     hiện ở các lượt trước.
   * Từ đó, rút ra:
     - **Họ đang muốn gì?** (Mục tiêu ngắn hạn)
     - **Họ thích làm gì?** (Kiểu hành động lặp lại)
     - **Họ quan tâm đến ai/cái gì?** (NPC, chi tiết nào được tương tác nhiều)
     - **Họ né tránh gì?** (Hướng đi liên tục bị bỏ qua)
   * Ưu tiên cao nhất cho các gợi ý **cộng hưởng** với hướng đi thực tế
     của người chơi. Nhưng vẫn thêm những "nốt trầm" hoặc "nốt cao"
     để tạo cân bằng và bất ngờ.
   * **Nguyên tắc vàng:** Nếu người chơi liên tục chọn một hướng hành động
     nhất định (ví dụ: 3 lượt liên tiếp thiên về đối thoại), phần lớn gợi ý
     nên đi theo hướng đó, nhưng giữ 2-3 gợi ý "phá cách" mở ra
     khả năng mới.
   * **Khi lịch sử còn ít (dưới 3 lượt):** Đừng cố ép phân tích. Hãy dựa
     vào bối cảnh câu chuyện hiện tại, và tạo gợi ý đa dạng nhất có thể
     để "thăm dò" sở thích người chơi.

2. **Xử lý "Ý định thô" một cách sáng tạo:**
   Nếu người chơi có nhập "Ý định thô", hãy dùng nó làm trung tâm cho
   đợt gợi ý này. Hãy tạo ra:
   - Các biến thể đa dạng sắc thái của hành động đó.
   - Các hành động liên quan gần (ví dụ: định ôm → đổi thành nắm tay).
   - Phản ứng của NPC liên quan đến ý định đó (NPC chủ động làm trước,
     hoặc NPC né tránh).
   - Một vài biến cố bất ngờ cắt ngang ý định đó.

   Phân bổ: khoảng 2/3 gợi ý xoay quanh ý định thô, 1/3 là những
   "ngã rẽ" độc lập và táo bạo. Bạn có toàn quyền gợi ý những ngã rẽ
   tiềm năng hơn, miễn là sự chuyển hướng diễn ra tự nhiên và thuyết phục.

3. **Đa chiều & Sống động:**
   * Gợi ý không chỉ là hành động của người chơi. Hãy tạo ra một bức tranh
     "hỗn loạn có tổ chức" bao gồm cả hành động từ NPC và sự kiện
     môi trường bất ngờ.
   * Phân bổ tự nhiên theo ngữ cảnh — nếu câu chuyện đang ở cao trào
     chiến đấu, phần lớn gợi ý có thể là hành động; nếu đang yên bình,
     có thể nhiều gợi ý khám phá/đối thoại hơn.

4. **Kiến tạo sự bất ngờ & "Nút thắt":**
   * Mỗi gợi ý phải tự hỏi: "Điều gì sẽ làm câu chuyện trở nên
     kịch tính, hấp dẫn hoặc sâu sắc hơn?"
   * Đừng ngại tạo ra tình thế khó xử, tiến thoái lưỡng nan, hoặc
     những tình huống "dở khóc dở cười".

5. **Bám sát ngữ cảnh & Mở rộng thế giới:**
   * Mọi gợi ý phải bắt rễ từ ít nhất một chi tiết có thực trong câu chuyện.
   * Bạn được khuyến khích sáng tạo chi tiết ngoại vi mới (NPC lạ mặt,
     âm thanh kỳ lạ, mùi hương trong gió) để làm dày bầu không khí,
     miễn là không mâu thuẫn với những gì đã xác lập.

[NGÔN NGỮ]
Luôn trả lời bằng cùng ngôn ngữ với lịch sử câu chuyện.

[ĐẦU RA]
Chỉ trả về một JSON hợp lệ duy nhất, không kèm bất kỳ văn bản nào khác.

{
  "analysis": {
    "behavioral_snapshot": {
      "recent_actions": [
        "Hành động/lựa chọn cụ thể gần nhất #1",
        "Hành động/lựa chọn cụ thể gần nhất #2",
        "Hành động/lựa chọn cụ thể gần nhất #3"
      ],
      "player_pattern": "Mô tả ngắn gọn quy luật hành vi nhận ra. Ghi 'Chưa đủ dữ liệu' nếu dưới 3 lượt.",
      "current_desire": "Dự đoán người chơi đang muốn gì ở lượt tiếp theo."
    },
    "story_snapshot": "Tình huống hiện tại trong 1-2 câu.",
    "tension_drivers": [
      "Yếu tố #1 có khả năng đẩy câu chuyện tiếp",
      "Yếu tố #2",
      "Yếu tố #3"
    ]
  },
  "suggestions": [
    "[CHOICE: \\"Mô tả hành động cụ thể, giàu hình ảnh, 1-2 câu.\\"]",
    "[CHOICE: \\"...\\"]"
  ]
}

[VÍ DỤ ĐỊNH DẠNG]

Đúng:
  [CHOICE: "Tung đồng tiền vàng lên cao cho nó xoay lấp lánh dưới ánh trăng — đôi mắt tham lam của tên lính gác khó mà không bám theo."]

Sai:
  "Tung đồng tiền để đánh lạc hướng."
  [CHOICE: Tung đồng tiền]
  CHOICE: "Tung đồng tiền"

Luôn dùng đúng định dạng: [CHOICE: "Nội dung đầy đủ ở đây."]

Quy tắc cho nội dung bên trong mỗi CHOICE:
- Phải là một câu văn nhập vai, giàu hình ảnh và tinh tế, như một lời
  mời gọi.
- Mô tả hành động cụ thể bắt đầu, có thể là của người chơi, NPC hoặc
  một sự kiện môi trường.
- Lồng ghép tự nhiên bối cảnh, cảm xúc hoặc gợi ý rất nhỏ về kết quả
  tiềm năng.
- Độ dài: 1-2 câu, đủ để gợi mở nhưng không kể hết.
- TUYỆT ĐỐI KHÔNG dùng các công thức như 'Thành công: X%', 'Lợi ích:',
  hay 'Rủi ro:'.
- Tránh mọi gợi ý chung chung, vô thưởng vô phạt.
- Tất cả gợi ý dùng chung định dạng [CHOICE: "..."], KHÔNG phân loại
  hay đánh nhãn loại gợi ý.
- Đảm bảo ít nhất 15 gợi ý trong mảng suggestions.`;

export async function fetchActionSuggestions(historySlice: ChatMessage[], intent: string): Promise<ActionSuggestionResponse> {
    const historyText = historySlice.map(msg => `${msg.role}: ${cleanMessageContent(msg.content)}`).join('\n\n');
    const prompt = ACTION_SUGGESTION_PROMPT
        .replace('{{story_history}}', historyText)
        .replace('{{player_intent}}', intent || "(Không có)");

    let rawResponse = "";

    const conn = getConnectionSettings();
    if (conn.source === 'proxy') {
        const targetModel = conn.proxy_tool_model || conn.proxy_model || 'gemini-3-flash-preview';
        rawResponse = await callOpenAIProxyTask(prompt, targetModel, conn.proxy_protocol, safetySettings);
    } else {
        const settings = getGlobalActionSuggestionSettings();
        const targetModel = settings.gemini_model || 'gemini-3-flash-preview';
        const response = await callGeminiDirect(targetModel, prompt, { temp: 0.8 } as any, safetySettings);
        rawResponse = response.text || '{"suggestions":[]}';
    }

    rawResponse = rawResponse.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, '$1').trim();
    
    try {
        const parsed = parseLooseJson(rawResponse) as ActionSuggestionResponse;
        if (parsed && Array.isArray(parsed.suggestions)) {
            // Clean up [CHOICE: "..."] format to just get strings
            parsed.suggestions = parsed.suggestions.map(s => {
                const match = s.match(/\[CHOICE:\s*"?([^"\]]+)"?\]/);
                return match ? match[1].trim() : s.replace(/\[CHOICE:\s*"?/, '').replace(/"?\]$/, '').trim();
            }).filter(Boolean);
            return parsed;
        }
    } catch (e) {
        console.warn("Failed to parse action suggestions JSON:", e, rawResponse);
    }

    return { suggestions: [] };
}
