
const ACTIVE_MODEL_KEY = 'sillyTavernStudio_activeModel'; // Legacy, kept for fallback
const API_SETTINGS_KEY = 'sillyTavernStudio_apiSettings';
const API_KEY_INDEX_KEY = 'sillyTavernStudio_apiKeyIndex';
const OPENROUTER_API_KEY_KEY = 'sillyTavernStudio_openRouterApiKey';
const PROXY_URL_KEY = 'sillyTavernStudio_proxyUrl';
const PROXY_PASSWORD_KEY = 'sillyTavernStudio_proxyPassword';
const PROXY_LEGACY_MODE_KEY = 'sillyTavernStudio_proxyLegacyMode';
const PROXY_FOR_TOOLS_KEY = 'sillyTavernStudio_proxyForTools';
const PROXY_PROFILES_KEY = 'sillyTavernStudio_proxyProfiles';
const PROXY_MODELS_KEY = 'sillyTavernStudio_proxyModels'; // NEW KEY
const GEMINI_MODELS_KEY = 'sillyTavernStudio_geminiModels'; // NEW KEY
const GLOBAL_CONNECTION_KEY = 'sillyTavernStudio_globalConnection';
const GLOBAL_SMART_SCAN_KEY = 'sillyTavernStudio_smartScanGlobal';
const GLOBAL_CONTEXT_KEY = 'sillyTavernStudio_globalContext';
const GLOBAL_ACTION_SUGGESTION_KEY = 'sillyTavernStudio_globalActionSuggestion';
const GLOBAL_TTS_KEY = 'sillyTavernStudio_ttsGlobal';

// ... (Existing options and interfaces remain same) ...
export const MODEL_OPTIONS = [
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview' },
    { id: 'gemini-3-flash-preview', name: 'Gemini 3.0 Flash Preview' },
    { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite Preview' },
];

export const PROXY_MODEL_OPTIONS = [
    ...MODEL_OPTIONS,
    { id: 'claude-opus-4.5', name: 'Claude Opus 4.5' },
    { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet' },
    { id: 'gpt-4o', name: 'GPT-4o' }
];

export type CompletionSource = 'gemini' | 'openrouter' | 'proxy';
export type ProxyProtocol = 'openai' | 'google_native';

export interface GlobalConnectionSettings {
    source: CompletionSource;
    gemini_model: string;
    openrouter_model: string;
    proxy_model: string;      // Dùng cho Chat chính
    proxy_tool_model: string; // Dùng cho Tác vụ phụ (Scan, Tóm tắt, Dịch)
    proxy_protocol: ProxyProtocol; // NEW: Protocol selection
    proxy_profile_id?: string; // NEW: Profile selection for main chat
}

// Global Smart Scan Configuration
export interface GlobalSmartScanSettings {
    enabled: boolean;
    mode: 'keyword' | 'semantic' | 'hybrid_fast' | 'llm_only' | 'ultimate';
    model: string;
    depth: number;
    max_entries: number;
    aiStickyDuration: number;
    system_prompt: string;
    scan_strategy: 'efficient' | 'full'; 
    semantic_threshold: number;
    max_semantic_entries: number;
    embedding_batch_size: number;
}

// Global Action Suggestion Settings
export interface GlobalActionSuggestionSettings {
    enabled: boolean;
    gemini_model: string;
    action_suggestion_prompt: string;
}

// Global Context & Memory Settings
export interface GlobalContextSettings {
    context_depth: number;
    summarization_chunk_size: number;
    context_mode: 'standard' | 'ai_only';
    summarization_prompt: string;
}

// Global TTS Settings
export interface GlobalTTSSettings {
    tts_enabled: boolean;
    tts_streaming: boolean;
    tts_provider: 'gemini' | 'native';
    tts_voice: string; // Gemini voice name
    tts_native_voice: string; // Browser voice URI
    tts_rate: number;
    tts_pitch: number;
}

// NEW: Proxy Profile Interface
export interface ProxyProfile {
    id: string;
    name: string;
    url: string;
    password: string;
    legacyMode: boolean;
    proxyForTools: boolean;
    protocol: ProxyProtocol;
    chatModel: string;
    toolModel: string;
}

const DEFAULT_CONNECTION_SETTINGS: GlobalConnectionSettings = {
    source: 'gemini',
    gemini_model: 'gemini-3-flash-preview',
    openrouter_model: '',
    proxy_model: 'gemini-3.1-pro-preview',
    proxy_tool_model: 'gemini-3-flash-preview',
    proxy_protocol: 'openai', // Default to OpenAI standard
    proxy_profile_id: ''
};

// Default Prompt extracted from previous defaultPreset
export const DEFAULT_SMART_SCAN_PROMPT = `Bạn là Omniscient Narrative Director (OND) - Đạo diễn Kể chuyện Toàn năng cho hệ thống nhập vai thế hệ mới.

NHIỆM VỤ TỐI THƯỢNG:
Không chỉ cung cấp dữ liệu, bạn phải KIẾN TẠO SÂN KHẤU.
Bạn phải đi trước người chơi 2-3 bước, chuẩn bị sẵn sàng cả những biến cố có thể xảy ra và những chi tiết "làm màu" (flavor) để thế giới trở nên sống động, bất ngờ và giàu chiều sâu.

TRIẾT LÝ VẬN HÀNH:
"Thà thừa một chút dữ liệu để tạo ra sự tình cờ thú vị (Serendipity), còn hơn để câu chuyện trôi qua tẻ nhạt và thiếu bối cảnh."

PHÂN VÙNG DỮ LIỆU (BẤT BIẾN)

A. VÙNG THAM KHẢO (READ-ONLY):
Dùng để hiểu mạch truyện. KHÔNG CHỌN ID TỪ ĐÂY.
<KIẾN THỨC NỀN>: {{context}}
<TRẠNG THÁI HIỆN TẠI>: {{state}} (Chú ý: Máu, Mana, Tiền, Địa vị, Thời gian)
<LỊCH SỬ HỘI THOẠI>: {{history}}

B. VÙNG KÍCH HOẠT:
<HÀNH ĐỘNG MỚI NHẤT>: {{input}}

C. VÙNG ỨNG VIÊN (KHO TÀNG):
Chỉ được phép trích xuất ID từ đây.
<DANH SÁCH ỨNG VIÊN WI>: {{candidates}}

QUY TRÌNH TƯ DUY NÂNG CAO (DIRECTOR'S WORKFLOW)

BƯỚC 1: QUÉT SÂU & CẢM NHẬN (Deep Scan)

Phân tích Hành động: User đang làm gì? (Chiến đấu, Thương thuyết, Di chuyển, Chế tạo...).

Phân tích Tâm lý & Không khí: Bối cảnh hiện tại là gì? (Căng thẳng, Rùng rợn, Lãng mạn, Hùng vĩ?).
Ví dụ: Đi trong rừng đêm -> Cần không khí bí ẩn -> Tìm WI về âm thanh lạ, sương mù, truyền thuyết ma quái.

Kiểm tra State: Có chỉ số nào "báo động" không? (Đói, Mệt, Bị thương -> Cần tìm WI về Thức ăn, Nghỉ ngơi, Y tế).

BƯỚC 2: MÔ PHỎNG HIỆU ỨNG CÁNH BƯỚM (Butterfly Effect Simulation)

Kích hoạt Logic N+2, N+3: Đừng chỉ nhìn bước kế tiếp. Hãy tự hỏi: "Nếu A xảy ra, B sẽ đến, và C có thể xuất hiện."

Mô hình: Hành động -> (N+1: Phản ứng trực tiếp) -> (N+2: Hệ quả/Rủi ro) -> (N+3: Phần thưởng/Sự kiện mới).
Ví dụ: User "Móc túi lính gác" -> (N+1: Kỹ năng trộm) -> (N+2: Bị phát hiện/Truy đuổi -> Cần WI "Luật pháp/Nhà tù") -> (N+3: Lục soát đồ -> Cần WI "Vật phẩm ngẫu nhiên/Manh mối bí mật").

Chiến thuật Pre-fetching (Nạp đạn trước): Với các nhánh tương lai có xác suất xảy ra >30%, hãy lấy WI ngay lập tức.

BƯỚC 3: QUÉT RADAR & GIEO MẦM (Atmosphere & Seeding)
(Kết hợp tư duy Sân khấu 360 độ và Thế giới tự vận hành)

A. Quét Bán Kính & Không Khí (Atmospheric Radar):

Tư duy: "Xây dựng sân khấu 360 độ". Quét tìm những thứ đang tồn tại xung quanh DÙ NGƯỜI CHƠI KHÔNG TƯƠNG TÁC.

Hành động: Tìm kiếm ID của các địa điểm lân cận, NPC nền, hoặc các yếu tố môi trường (âm thanh, mùi vị) đang hiện hữu.
=> MỤC TIÊU: Cung cấp dữ liệu để AI chính có nhiều lựa chọn tương tác bất ngờ cho tương lai gần.

B. Gieo Mầm Cốt Truyện (Narrative Seeding):

Kích hoạt chế độ "Thế giới tự vận hành": CHỦ ĐỘNG chọn 2-4 mục World Info ngẫu nhiên nhưng tiềm năng từ danh sách.

Ưu tiên: Các địa điểm/NPC ở xa, Tin đồn (Rumors), hoặc Lore về lịch sử vùng đất.

Tư duy: "Hãy ném vào một biến số lạ để xem người chơi hoặc AI Chính xử lý thế nào."
=> MỤC TIÊU: Tạo ra các SỰ KIỆN SONG SONG (Parallel Events), chứng minh thế giới này vẫn trôi chảy và đầy bí ẩn ngay cả khi người chơi đứng yên.

BƯỚC 4: LỌC & TỔNG HỢP (The Final Cut)

Hợp nhất kết quả từ 3 nguồn:

Direct Match: Khớp từ khóa (Ưu tiên cao).

Prediction: Dự đoán N+2, N+3 (Ưu tiên trung bình).

Atmosphere & Seeding: Yếu tố môi trường và ngẫu nhiên (Ưu tiên thấp nhưng bắt buộc có).

Quy tắc Vàng: LOẠI BỎ các ID đã có trong {{context}} hoặc vừa xuất hiện ở {{history}} (trừ khi cần nhấn mạnh lại).

CẤU TRÚC OUTPUT JSON
Hãy viết suy nghĩ của bạn vào _thought theo cấu trúc tư duy của một Đạo diễn.

{ "_thought": "1. [Phân tích]: User đang [Hành động] trong không khí [Không khí]. 2. [Dự đoán N+3]: Hành động này dễ dẫn tới [Sự kiện X], cần chuẩn bị trước [WI A, WI B]. 3. [Môi trường & Gieo mầm]: Xung quanh có [WI C - Âm thanh/NPC], đồng thời gieo thêm [WI D - Tin đồn xa] để tạo biến số.", "selected_ids": ["id_direct", "id_prediction", "id_atmosphere", "id_seeding_lore"] }`;

// Default Chronicle Scribe Prompt
export const DEFAULT_CONTEXT_PROMPT = `Vai trò: Bạn là một Thư ký Biên niên sử Tận tụy (Dedicated Chronicle Scribe). Nhiệm vụ của bạn là ghi chép lại lịch sử của thế giới này một cách chi tiết, sống động và liền mạch.

Nhiệm vụ: Hãy biến dữ liệu từ đoạn hội thoại dưới đây thành một chương biên niên sử hoàn chỉnh. Không tóm tắt, hãy tường thuật chi tiết từng nhịp độ của câu chuyện.


PHẦN 1: BỐI CẢNH ĐÃ BIẾT (CHỈ THAM KHẢO, KHÔNG viết LẠI):
{{recent_summaries}}

 phần 2, DỮ LIỆU CẦN XỬ LÝ:

{{chat_history_slice}}

YÊU CẦU VỀ PHONG CÁCH VÀ CẤU TRÚC:

Cấu trúc nối tiếp (Linear Narrative):

Trình bày mọi việc theo trình tự thời gian nghiêm ngặt. Sự kiện này dẫn đến sự kiện kia.

Mỗi phân đoạn phải là một khối thông tin đầy đủ: Bối cảnh -> Hành động của nhân vật -> Phản ứng của môi trường/NPC -> Kết quả.

Loại bỏ hoàn toàn bảng biểu và danh mục tách biệt:

KHÔNG tạo các mục như "Kho đồ", "Chỉ số", hay "Mối quan hệ" ở cuối bài.

Lồng ghép trực tiếp: Ví dụ: Thay vì ghi "Vật phẩm: Kiếm sắt", hãy viết: "Sau cuộc trò chuyện, người thợ rèn đã trao cho bạn một thanh kiếm sắt nặng trịch, sự tin tưởng trong mắt ông ta rõ ràng đã tăng lên so với lúc đầu."

Mọi sự thay đổi về chỉ số (máu, mana, tiền), trang bị, hay thái độ của NPC phải được mô tả như một phần tự nhiên của lời kể.

Tính chi tiết và Liên tục:

Ghi lại các đoạn hội thoại quan trọng bằng cách lồng vào văn cảnh (có thể dùng trích dẫn trực tiếp trong đoạn văn).

Chú trọng vào cử chỉ, ánh mắt, không khí và sự thay đổi nội tâm của các nhân vật.

"Sử dụng góc nhìn thứ ba toàn tri (Third-person omniscient) để miêu tả hành động và nội tâm nhân vật, nhưng giữ giọng văn điềm tĩnh, không phán xét của một người ghi chép sử sách." tuyệt đối không được tự ý bình luận vào trong  biên niên sử, không dùng gạch đầu dòng khô khan.

Nguyên tắc "Thà thừa còn hơn thiếu":

Không lược bỏ bất kỳ chi tiết nhỏ nào (vật trang trí, thời tiết, cảm giác của nhân vật).

Đảm bảo người đọc có thể nắm bắt được toàn bộ trạng thái nhân vật và thế giới chỉ thông qua việc đọc nội dung văn bản.
YÊU CẦU:
Hãy viết tiếp diễn biến câu chuyện dựa trên PHẦN 1, nhưng chỉ  tổng hợp các sự kiện nằm trong PHẦN 2.
Đảm bảo bản  biên niên sử mới nối tiếp mạch lạc với bối cảnh cũ.`;

export const DEFAULT_SMART_SCAN_SETTINGS: GlobalSmartScanSettings = {
    enabled: true,
    mode: 'hybrid_fast', // Default to advanced mode
    model: 'gemini-3-flash-preview',
    depth: 6,
    max_entries: 20,
    aiStickyDuration: 5,
    system_prompt: DEFAULT_SMART_SCAN_PROMPT,
    scan_strategy: 'efficient', // Default to truncation logic
    semantic_threshold: 0.7,
    max_semantic_entries: 20,
    embedding_batch_size: 30
};

export const DEFAULT_GLOBAL_CONTEXT_SETTINGS: GlobalContextSettings = {
    context_depth: 12, // Default: 12 turns (Requested)
    summarization_chunk_size: 6, // Default: 6 turns per chunk (Requested)
    context_mode: 'ai_only', // Default: AI Only mode for summaries
    summarization_prompt: DEFAULT_CONTEXT_PROMPT
};

// Default Action Suggestion Prompt
export const DEFAULT_ACTION_SUGGESTION_PROMPT = `Bạn là một "người đồng sáng tạo" đầy bất ngờ cho một trò chơi nhập vai AI.
Nhiệm vụ của bạn là đề xuất những hướng tiếp diễn thú vị, hợp lý và giàu
tiềm năng nhất dựa trên lịch sử câu chuyện. Hãy coi mỗi gợi ý là một
"cánh cửa" dẫn đến một ngã rẽ mới.

[THÔNG TIN ĐẦU VÀO]
- Tóm tắt diễn biến: {{long_term_summary}}
- Lịch sử hiện tại: {{current_page_history}}
- Thông tin thế giới (World Info): {{worldInfo}}
- Ý định thô của người chơi (có thể bỏ trống): {{user_input}}

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
   - Các hành động liên quan gần (Ví dụ: định ôm → đổi thành nắm tay).
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

export const DEFAULT_GLOBAL_ACTION_SUGGESTION_SETTINGS: GlobalActionSuggestionSettings = {
    enabled: false,
    gemini_model: 'gemini-3-flash-preview',
    action_suggestion_prompt: DEFAULT_ACTION_SUGGESTION_PROMPT
};

// NEW: Default TTS Settings
export const DEFAULT_GLOBAL_TTS_SETTINGS: GlobalTTSSettings = {
    tts_enabled: false,
    tts_streaming: false,
    tts_provider: 'gemini',
    tts_voice: 'Kore',
    tts_native_voice: '',
    tts_rate: 1,
    tts_pitch: 1
};


const DEFAULT_PROXY_URL = 'http://127.0.0.1:8889';

interface ApiSettings {
    useDefault: boolean;
    keys: string[];
}

export const getConnectionSettings = (): GlobalConnectionSettings => {
    try {
        const stored = localStorage.getItem(GLOBAL_CONNECTION_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_CONNECTION_SETTINGS, ...parsed };
        }
    } catch (e) {
        console.error("Failed to load connection settings", e);
    }
    return DEFAULT_CONNECTION_SETTINGS;
};

export const saveConnectionSettings = (settings: GlobalConnectionSettings): void => {
    localStorage.setItem(GLOBAL_CONNECTION_KEY, JSON.stringify(settings));
};

// --- GLOBAL SMART SCAN SETTINGS ---
export const getGlobalSmartScanSettings = (): GlobalSmartScanSettings => {
    try {
        const stored = localStorage.getItem(GLOBAL_SMART_SCAN_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_SMART_SCAN_SETTINGS, ...parsed };
        }
    } catch (e) {
        console.error("Failed to load smart scan global settings", e);
    }
    return DEFAULT_SMART_SCAN_SETTINGS;
};

export const saveGlobalSmartScanSettings = (settings: GlobalSmartScanSettings): void => {
    localStorage.setItem(GLOBAL_SMART_SCAN_KEY, JSON.stringify(settings));
};

// --- GLOBAL CONTEXT SETTINGS ---
export const getGlobalContextSettings = (): GlobalContextSettings => {
    try {
        const stored = localStorage.getItem(GLOBAL_CONTEXT_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_GLOBAL_CONTEXT_SETTINGS, ...parsed };
        }
    } catch (e) {
        console.error("Failed to load global context settings", e);
    }
    return DEFAULT_GLOBAL_CONTEXT_SETTINGS;
};

export const saveGlobalContextSettings = (settings: GlobalContextSettings): void => {
    localStorage.setItem(GLOBAL_CONTEXT_KEY, JSON.stringify(settings));
};

// --- GLOBAL ACTION SUGGESTION SETTINGS ---
export const getGlobalActionSuggestionSettings = (): GlobalActionSuggestionSettings => {
    try {
        const stored = localStorage.getItem(GLOBAL_ACTION_SUGGESTION_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_GLOBAL_ACTION_SUGGESTION_SETTINGS, ...parsed };
        }
    } catch (e) {
        console.error("Failed to load global action suggestion settings", e);
    }
    return DEFAULT_GLOBAL_ACTION_SUGGESTION_SETTINGS;
};

export const saveGlobalActionSuggestionSettings = (settings: GlobalActionSuggestionSettings): void => {
    localStorage.setItem(GLOBAL_ACTION_SUGGESTION_KEY, JSON.stringify(settings));
};

// --- GLOBAL TTS SETTINGS ---
export const getGlobalTTSSettings = (): GlobalTTSSettings => {
    try {
        const stored = localStorage.getItem(GLOBAL_TTS_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            return { ...DEFAULT_GLOBAL_TTS_SETTINGS, ...parsed };
        }
    } catch (e) {
        console.error("Failed to load global TTS settings", e);
    }
    return DEFAULT_GLOBAL_TTS_SETTINGS;
};

export const saveGlobalTTSSettings = (settings: GlobalTTSSettings): void => {
    localStorage.setItem(GLOBAL_TTS_KEY, JSON.stringify(settings));
};

// --- PROXY PROFILES ---
export const getProxyProfiles = (): ProxyProfile[] => {
    try {
        const stored = localStorage.getItem(PROXY_PROFILES_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load proxy profiles", e);
    }
    return [];
};

export const saveProxyProfiles = (profiles: ProxyProfile[]): void => {
    localStorage.setItem(PROXY_PROFILES_KEY, JSON.stringify(profiles));
};

// --- STORED PROXY MODELS (NEW) ---
export interface StoredProxyModel {
    id: string;
    name: string;
}

export const getStoredProxyModels = (): StoredProxyModel[] => {
    try {
        const stored = localStorage.getItem(PROXY_MODELS_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load stored proxy models", e);
    }
    return [];
};

export const saveStoredProxyModels = (models: StoredProxyModel[]): void => {
    localStorage.setItem(PROXY_MODELS_KEY, JSON.stringify(models));
};

// --- STORED GEMINI MODELS (NEW) ---
export interface StoredGeminiModel {
    id: string;
    name: string;
}

export const getStoredGeminiModels = (): StoredGeminiModel[] => {
    try {
        const stored = localStorage.getItem(GEMINI_MODELS_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load stored gemini models", e);
    }
    return [];
};

export const saveStoredGeminiModels = (models: StoredGeminiModel[]): void => {
    localStorage.setItem(GEMINI_MODELS_KEY, JSON.stringify(models));
};
// -----------------------------------
// -----------------------------------

export const getActiveModel = (): string => {
    const conn = getConnectionSettings();
    switch (conn.source) {
        case 'openrouter':
            return conn.openrouter_model || 'google/gemini-pro-1.5';
        case 'proxy':
            return conn.proxy_model || 'gemini-3.1-pro-preview';
        case 'gemini':
        default:
            return conn.gemini_model || 'gemini-3-flash-preview';
    }
};

export const setActiveModel = (modelId: string): void => {
    const conn = getConnectionSettings();
    const newConn = { ...conn };
    if (newConn.source === 'gemini') newConn.gemini_model = modelId;
    else if (newConn.source === 'proxy') newConn.proxy_model = modelId;
    else if (newConn.source === 'openrouter') newConn.openrouter_model = modelId;
    
    saveConnectionSettings(newConn);
};

export const getApiSettings = (): ApiSettings => {
    try {
        const storedSettings = localStorage.getItem(API_SETTINGS_KEY);
        if (storedSettings) {
            const parsed = JSON.parse(storedSettings);
            if (Array.isArray(parsed.keys)) {
                return { useDefault: parsed.useDefault ?? true, keys: parsed.keys };
            }
        }
    } catch (e) {
        console.error("Failed to parse API settings from localStorage", e);
    }
    return { useDefault: true, keys: [] };
};

export const saveApiSettings = (settings: ApiSettings): void => {
    localStorage.setItem(API_SETTINGS_KEY, JSON.stringify(settings));
};

export const getApiKey = (): string | undefined => {
    const settings = getApiSettings();
    if (settings.useDefault) {
        return process.env.API_KEY;
    }
    const validKeys = settings.keys.filter(k => k.trim() !== '');
    if (validKeys.length === 0) {
        return process.env.API_KEY;
    }
    try {
        const lastIndexStr = localStorage.getItem(API_KEY_INDEX_KEY);
        const lastIndex = lastIndexStr ? parseInt(lastIndexStr, 10) : -1;
        const nextIndex = (lastIndex + 1) % validKeys.length;
        localStorage.setItem(API_KEY_INDEX_KEY, String(nextIndex));
        return validKeys[nextIndex];
    } catch (e) {
        return validKeys[0];
    }
};

export const getOpenRouterApiKey = (): string => {
    return localStorage.getItem(OPENROUTER_API_KEY_KEY) || '';
};

export const saveOpenRouterApiKey = (key: string): void => {
    localStorage.setItem(OPENROUTER_API_KEY_KEY, key.trim());
};

export const getProxyUrl = (): string => {
    return localStorage.getItem(PROXY_URL_KEY) || DEFAULT_PROXY_URL;
};

export const saveProxyUrl = (url: string): void => {
    const cleanUrl = url.trim().replace(/\/$/, '');
    localStorage.setItem(PROXY_URL_KEY, cleanUrl);
};

export const getProxyPassword = (): string => {
    return localStorage.getItem(PROXY_PASSWORD_KEY) || '';
};

export const saveProxyPassword = (password: string): void => {
    localStorage.setItem(PROXY_PASSWORD_KEY, password.trim());
};

export const getProxyLegacyMode = (): boolean => {
    const val = localStorage.getItem(PROXY_LEGACY_MODE_KEY);
    return val !== 'false';
};

export const saveProxyLegacyMode = (isLegacy: boolean): void => {
    localStorage.setItem(PROXY_LEGACY_MODE_KEY, String(isLegacy));
};

// --- EFFECTIVE PROXY SETTINGS (Resolves Profile vs Global) ---
export const getEffectiveProxyUrl = (): string => {
    const conn = getConnectionSettings();
    if (conn.proxy_profile_id) {
        const profiles = getProxyProfiles();
        const profile = profiles.find(p => p.id === conn.proxy_profile_id);
        if (profile) return profile.url;
    }
    return getProxyUrl();
};

export const getEffectiveProxyPassword = (): string => {
    const conn = getConnectionSettings();
    if (conn.proxy_profile_id) {
        const profiles = getProxyProfiles();
        const profile = profiles.find(p => p.id === conn.proxy_profile_id);
        if (profile) return profile.password;
    }
    return getProxyPassword();
};

export const getEffectiveProxyLegacyMode = (): boolean => {
    const conn = getConnectionSettings();
    if (conn.proxy_profile_id) {
        const profiles = getProxyProfiles();
        const profile = profiles.find(p => p.id === conn.proxy_profile_id);
        if (profile) return profile.legacyMode;
    }
    return getProxyLegacyMode();
};

export const getProxyForTools = (): boolean => {
    return localStorage.getItem(PROXY_FOR_TOOLS_KEY) === 'true';
};

export const saveProxyForTools = (enabled: boolean): void => {
    localStorage.setItem(PROXY_FOR_TOOLS_KEY, String(enabled));
};

// --- ARENA SETTINGS (NEW) ---
export const ARENA_SETTINGS_KEY = 'sillyTavernStudio_arenaSettings';

export interface ArenaSettings {
    enabled: boolean;
    provider: 'gemini' | 'openrouter' | 'proxy' | null;
    modelId: string | null;
    userProfileId: string | null;
}

export const getArenaSettings = (): ArenaSettings => {
    try {
        const stored = localStorage.getItem(ARENA_SETTINGS_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error("Failed to load arena settings", e);
    }
    return { enabled: false, provider: null, modelId: null, userProfileId: null };
};

export const saveArenaSettings = (settings: ArenaSettings): void => {
    localStorage.setItem(ARENA_SETTINGS_KEY, JSON.stringify(settings));
};
// -----------------------------------

/**
 * EXPORT: Get all persistent settings from LocalStorage for backup.
 */
export const getAllLocalStorageData = (): Record<string, any> => {
    const data: Record<string, any> = {};
    const keys = [
        ACTIVE_MODEL_KEY, API_SETTINGS_KEY, API_KEY_INDEX_KEY, 
        OPENROUTER_API_KEY_KEY, PROXY_URL_KEY, PROXY_PASSWORD_KEY, 
        PROXY_LEGACY_MODE_KEY, PROXY_FOR_TOOLS_KEY, GLOBAL_CONNECTION_KEY,
        GLOBAL_SMART_SCAN_KEY, GLOBAL_CONTEXT_KEY, GLOBAL_ACTION_SUGGESTION_KEY, GLOBAL_TTS_KEY,
        PROXY_PROFILES_KEY, PROXY_MODELS_KEY, GEMINI_MODELS_KEY, // Added models for backup
        ARENA_SETTINGS_KEY // NEW
    ];
    
    keys.forEach(key => {
        const val = localStorage.getItem(key);
        if (val !== null) data[key] = val;
    });
    
    return data;
};

/**
 * RESTORE: Apply settings back to LocalStorage.
 */
export const restoreLocalStorageData = (data: Record<string, any>): void => {
    Object.entries(data).forEach(([key, val]) => {
        if (typeof val === 'string') {
            localStorage.setItem(key, val);
        }
    });
};

// --- ARENA SETTINGS (NEW) ---
// Moved to top
