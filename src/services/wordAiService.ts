import { callGeminiPublic } from './geminiService'; // Chỉnh lại đường dẫn nếu cần

// Helper: Lấy base64 từ File
export async function fileToBase64Obj(file: File): Promise<{ mime_type: string, data: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      resolve({ mime_type: file.type, data: base64Data });
    };
    reader.onerror = reject;
  });
}

export interface SolveConfig {
  model: string;
  level: string;
  language: string;
}

// 1. Hàm Giải Toán (Phong cách giáo viên)
export async function solveMathTeacherStyle(
  problemText: string,
  problemImages: { mime_type: string, data: string }[],
  knowledgeText: string,
  knowledgeImages: { mime_type: string, data: string }[],
  config: SolveConfig
): Promise<string> {
  const levelMap: Record<string, string> = { primary: 'Tiểu học', secondary: 'THCS', highschool: 'THPT', university: 'Đại học' };
  const levelLabel = levelMap[config.level] || 'THPT';

  let systemPrompt = config.language === 'vi'
    ? `Bạn là giáo viên toán trình bày lời giải trên bảng. Viết lời giải liền mạch, ngắn gọn, đúng trọng tâm — không chia "Bước 1 / Bước 2", không giải thích lý do từng dòng, không lặp lại đề bài.\nPhong cách: biến đổi thẳng từ dòng này sang dòng kia, chỉ ghi chú ngắn khi thực sự cần (ví dụ: "theo Vieta", "đặt t = ...", "vô lý"). Kết thúc bằng kết quả đóng khung hoặc gạch chân.\nDùng LaTeX cho mọi công thức: $...$ (inline) hoặc $$...$$ (display).\nCấp độ: ${levelLabel}.`
    : `You are a math teacher writing a solution on the board. Present it in a flowing, concise style... Use LaTeX: $...$ inline, $$...$$ display.\nLevel: ${levelLabel}.`;

  if (knowledgeText || knowledgeImages.length > 0) {
    systemPrompt += config.language === 'vi' ? '\n\nKIẾN THỨC BỔ SUNG (ưu tiên áp dụng):\n' : '\n\nSUPPLEMENTARY KNOWLEDGE:\n';
    if (knowledgeText) systemPrompt += knowledgeText.trim();
  }

  let fullPrompt = `${systemPrompt}\n\nĐỀ BÀI:\n${problemText}\n\nLời giải:`;

  // Gom tất cả ảnh (cả đề bài và kiến thức SGK) vào chung mảng để truyền cho Gemini
  const allImages = [...knowledgeImages, ...problemImages];

  return callGeminiPublic(fullPrompt, config.model, undefined, allImages.length > 0 ? allImages : undefined);
}

// 2. Hàm Tạo bài tương tự (Word format)
export async function generateSimilarWord(originalText: string, withAnswers: boolean): Promise<string> {
  const targetCount = (originalText.match(/(?:Câu|Bài)\s*\d+/gmi) || []).length || 1;
  
  let prompt = `Bạn là chuyên gia biên soạn đề thi.\nNHIỆM VỤ: TẠO BÀI TƯƠNG TỰ cho toàn bộ ${targetCount} câu. GIỮ cấu trúc, CHỈ đổi số liệu/ngữ cảnh.\n`;
  
  if (withAnswers) {
    prompt += `MỖI câu PHẢI có "Lời giải:" chi tiết + "Đáp án đúng là: [A/B/C/D]".\nCẤU TRÚC OUTPUT:\n===BEGIN_SIMILAR===\nCâu 1: ...\nA. ... B. ... C. ... D. ...\nLời giải:\n...\nĐáp án đúng là: X\n---END_QUESTION---\n===END_SIMILAR===`;
  } else {
    prompt += `TUYỆT ĐỐI KHÔNG thêm lời giải, không đánh dấu đáp án đúng.\nCẤU TRÚC OUTPUT:\n===BEGIN_SIMILAR===\nCâu 1: ...\nA. ... B. ... C. ... D. ...\n---END_QUESTION---\n===END_SIMILAR===`;
  }

  prompt += `\n\nDỮ LIỆU GỐC:\n${originalText}\n\nCông thức toán dùng $...$. BẮT ĐẦU SINH:`;

  const rawResult = await callGeminiPublic(prompt, "gemini-2.5-flash");
  
  // Dọn dẹp các tag bao bọc
  let cleanResult = rawResult.replace(/===BEGIN_SIMILAR===/g, '').replace(/===END_SIMILAR===/g, '').replace(/---END_QUESTION---/g, '\n\n').trim();
  return cleanResult;
}
