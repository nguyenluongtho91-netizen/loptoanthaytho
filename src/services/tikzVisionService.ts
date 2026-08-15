// src/services/tikzVisionService.ts
import { callGeminiPublic } from './geminiService';

export type VisionImagePart = {
  mimeType: string;
  dataBase64: string; // base64 (KHÔNG có prefix data:)
};

function normalizeTikzFromModel(text: string): string {
  const s = (text || '').trim();

  // remove ``` fences if any
  const fence = s.match(/```(?:tex|latex)?\s*([\s\S]*?)\s*```/i);
  const content = (fence?.[1] ?? s).trim();

  // cut tikzpicture if model returns extra
  const tikzMatch = content.match(
    /\\begin\{tikzpicture\}[\s\S]*?\\end\{tikzpicture\}/
  );
  if (tikzMatch) return tikzMatch[0].trim();

  return content;
}

export async function generateTikzFromDescriptionAndImages(args: {
  problemText?: string;
  extraDescription?: string;
  images?: VisionImagePart[]; // ✅ multiple images
  model?: string;
}): Promise<{ tikz: string; raw: string }> {
  const problemText = (args.problemText || '').trim();
  const extraDescription = (args.extraDescription || '').trim();
  const images = args.images || [];

  const prompt = `
Bạn là trợ lý chuyên chuyển đề bài/hình vẽ thành mã TikZ.

YÊU CẦU TRẢ VỀ:
- Chỉ trả về đúng 01 khối tikzpicture: \\begin{tikzpicture} ... \\end{tikzpicture}
- Không giải thích, không markdown, không thêm văn bản ngoài tikzpicture.
- Cố gắng dùng thư viện phổ biến: calc, intersections, angles, quotes, arrows.meta, positioning.
- Nếu hình có nhãn điểm (A,B,C,...) thì đặt đúng nhãn. Nếu thiếu thì suy luận hợp lý.
- Nếu không chắc, vẫn tạo một hình gần đúng, gọn, rõ.

ĐỀ BÀI (TEXT):
${problemText || '(không có)'}

MÔ TẢ THÊM:
${extraDescription || '(không có)'}

Hãy nhìn các ảnh (nếu có) và tạo hình TikZ tương ứng.
`.trim();

  // ✅ NEW: pass multiple inline images to geminiService via "inlineDataList"
  const raw = await callGeminiPublic(prompt, args.model, undefined, images.length
    ? images.map((img) => ({ mime_type: img.mimeType, data: img.dataBase64 }))
    : undefined
  );

  const tikz = normalizeTikzFromModel(raw);

  if (
    !/\\begin\{tikzpicture\}/.test(tikz) ||
    !/\\end\{tikzpicture\}/.test(tikz)
  ) {
    throw new Error(
      'Gemini không trả về đúng khối tikzpicture. Thầy thử: mô tả rõ hơn, hoặc ảnh nét hơn.'
    );
  }

  return { tikz, raw };
}
