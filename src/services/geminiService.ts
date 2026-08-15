// @ts-nocheck
import { GoogleGenAI } from "@google/genai";
import { getAllTikzSnippets } from "../tikzSnippets";

// ============ 1. QUẢN LÝ CHÌA KHÓA TẬP TRUNG (Safe Key Management) ============

/**
 * Hàm lấy API Key an toàn từ LocalStorage hoặc Biến môi trường. 
 * Đảm bảo đồng bộ 100% với tên biến 'ocr_gemini_key' trong phần Cài đặt.
 */
const getSafeApiKey = () => {
  const key = (typeof localStorage !== 'undefined' ? localStorage.getItem('ocr_gemini_key') : null) 
              || process.env.GEMINI_API_KEY;
  if (!key || key.trim() === '') {
    throw new Error("Thầy chưa nhập Gemini API Key! Vui lòng bấm vào biểu tượng Cài đặt (⚙️) và dán Key vào.");
  }
  return key.trim();
};

// ============ 2. HELPER UTILS (Dùng chung cho cả OCR và LaTeX) ============

const stripCodeFences = (s: string): string =>
  (s ?? "").replace(/```latex/g, "").replace(/```/g, "").trim();

function keepOnlyExBlocks(raw: string): string {
  const text = stripCodeFences(raw);
  const start = text.indexOf("\\begin{ex}");
  const end = text.lastIndexOf("\\end{ex}");
  if (start !== -1 && end !== -1)
    return text.substring(start, end + "\\end{ex}".length).trim();
  return text.trim();
}

function normalizeExBlocks(text: string): string {
  let t = text.replace(/\\end{ex}\s*\\begin{ex}/g, "\\end{ex}\n\n\\begin{ex}");
  return t.replace(/\n{3,}/g, "\n\n").trim();
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
  });
}

type InlineData = { mime_type: string; data: string };

/**
 * Helper tự động thử lại khi gặp lỗi tạm thời (503 High Demand, 429 Rate Limit, UNAVAILABLE...)
 * Tự động chuyển đổi mô hình dự phòng (Fallback) nếu mô hình chính bị tắc nghẽn.
 */
async function callWithRetry<T>(
  fn: (modelCandidate?: string) => Promise<T>,
  retries = 3,
  delayMs = 1500,
  fallbackModels?: string[]
): Promise<T> {
  let lastError: any;
  const models = fallbackModels && fallbackModels.length > 0 ? fallbackModels : [undefined];

  for (const modelCandidate of models) {
    let currentDelay = delayMs;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn(modelCandidate);
      } catch (error: any) {
        lastError = error;
        const errMsg = (error?.message || String(error)).toLowerCase();
        const isTransientError =
          errMsg.includes("503") ||
          errMsg.includes("429") ||
          errMsg.includes("unavailable") ||
          errMsg.includes("high demand") ||
          errMsg.includes("overloaded") ||
          errMsg.includes("resource_exhausted") ||
          errMsg.includes("fetch failed");

        if (!isTransientError) {
          throw error;
        }

        console.warn(
          `[Gemini API] Quá tải/Nghẽn mạng (Model: ${modelCandidate || "Default"}, Thử lần ${attempt}/${retries}). Thử lại sau ${currentDelay}ms...`
        );

        if (attempt < retries) {
          await new Promise((res) => setTimeout(res, currentDelay));
          currentDelay *= 1.5;
        }
      }
    }
  }
  throw lastError;
}

// ============ 3. HÀM GỌI GEMINI CỐT LÕI (Dùng cho LaTeX & Soạn đề) ============

/**
 * Hàm gọi Gemini sử dụng SDK MỚI @google/genai
 * Có tích hợp Auto-Retry và Fallback Model khi gặp lỗi 503/429
 */
async function callGemini(
  prompt: string,
  modelName?: string,
  inlineData?: InlineData,
  inlineDataList?: InlineData[]
): Promise<string> {
  const apiKey = getSafeApiKey();
  const ai = new GoogleGenAI({ apiKey });

  const parts: any[] = [{ text: prompt }];

  if (Array.isArray(inlineDataList) && inlineDataList.length > 0) {
    for (const img of inlineDataList) {
      if (img?.data) {
        parts.push({ inlineData: { mimeType: img.mime_type, data: img.data } });
      }
    }
  } else if (inlineData?.data) {
    parts.push({ inlineData: { mimeType: inlineData.mime_type, data: inlineData.data } });
  }

  const primaryModel = modelName || "gemini-2.5-flash";
  const fallbackList = [primaryModel, "gemini-2.0-flash", "gemini-1.5-flash"];

  return callWithRetry(async (selectedModel) => {
    try {
      const response = await ai.models.generateContent({
        model: selectedModel || primaryModel,
        contents: parts, 
      });
      return response.text || "";
    } catch (error: any) {
      console.error(`Gemini API Error (${selectedModel}):`, error);
      throw error;
    }
  }, 3, 1500, fallbackList).catch((error: any) => {
    throw new Error(error.message || "Lỗi khi gọi AI. Thầy hãy kiểm tra lại Key hoặc kết nối mạng.");
  });
}

// ============ 4. PHẦN 1: CLASS GEMINI SERVICE (Dành cho Sửa lỗi OCR Stream) ============

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor(apiKey?: string) {
    const finalKey = apiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('ocr_gemini_key') : null) || process.env.GEMINI_API_KEY;
    if (finalKey) {
      this.ai = new GoogleGenAI({ apiKey: finalKey });
    }
  }

  updateKey(apiKey: string) {
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  private extractImages(markdown: string) {
    const imageMap = new Map<string, string>();
    let counter = 0;
    const cleanText = markdown.replace(/!\[(.*?)\]\((data:image\/[^)]+)\)/g, (match) => {
      const placeholder = `{{__IMG_${counter}__}}`;
      imageMap.set(placeholder, match);
      counter++;
      return placeholder;
    });
    return { cleanText, imageMap };
  }

  private restoreImages(text: string, imageMap: Map<string, string>): string {
    let restoredText = text;
    imageMap.forEach((originalImageTag, placeholder) => {
      restoredText = restoredText.split(placeholder).join(originalImageTag);
    });
    return restoredText;
  }

  /**
   * Tính năng sửa lỗi chính tả văn bản OCR bằng Stream
   */
  async correctTextStream(text: string, onChunk: (text: string) => void): Promise<string> {
    if (!this.ai) {
      const key = getSafeApiKey();
      this.ai = new GoogleGenAI({ apiKey: key });
    }

    const { cleanText, imageMap } = this.extractImages(text);
    const prompt = `Bạn là chuyên gia biên tập tiếng Việt. Hãy sửa lỗi chính tả văn bản OCR sau, giữ nguyên cấu trúc Markdown, placeholder {{__IMG_x__}} và công thức LaTeX.\n\nVăn bản gốc:\n${cleanText}`;

    return callWithRetry(async (selectedModel) => {
      try {
        const responseStream = await this.ai!.models.generateContentStream({
          model: selectedModel || 'gemini-2.5-flash',
          contents: prompt,
          config: {
            temperature: 0.1,
          }
        });

        let fullResponseText = '';
        for await (const chunk of responseStream) {
          if (chunk.text) {
            fullResponseText += chunk.text;
            onChunk(chunk.text);
          }
        }
        return this.restoreImages(fullResponseText, imageMap);
      } catch (error: any) {
        console.error("Gemini stream error:", error);
        throw error;
      }
    }, 3, 1500, ['gemini-2.5-flash', 'gemini-2.0-flash']);
  }
}

// ============ 5. PHẦN 2: CÁC HÀM XỬ LÝ TOÁN / LATEX ============

export async function solveOriginalProblem(input: string, options: any): Promise<string> {
  const prompt = `Bạn là trợ lý giải bài tập. Môn: ${options.subject}.\nMức độ: ${options.level}. ĐỀ BÀI:\n${input}`;
  return callGemini(prompt);
}

export async function convertToLatex(input: string, includeSolutions: boolean): Promise<string> {
  const prompt = `Chuyển nội dung sau thành LaTeX chuẩn.\n${includeSolutions ? "Kèm lời giải." : "Không lời giải."}\nNỘI DUNG:\n${input}`;
  return stripCodeFences(await callGemini(prompt));
}

export async function transformToExTest(rawText: string): Promise<string> {
  const prompt = `Bạn là chuyên gia chuyển đổi sang chuẩn "ex_test". Chỉ trả về khối \\begin{ex}...\\end{ex}.\nNỘI DUNG:\n${rawText}`;
  return normalizeExBlocks(keepOnlyExBlocks(await callGemini(prompt)));
}

export async function convertImageToText(file: File): Promise<string> {
  const base64 = await fileToBase64(file);
  const prompt = `Trích xuất văn bản và LaTeX từ ảnh. Tham khảo TikZ nếu có hình vẽ:\n${getAllTikzSnippets()}`;
  return callGemini(prompt, undefined, { mime_type: file.type || "image/png", data: base64 });
}

export async function imageToExTest(file: File): Promise<string> {
  const base64 = await fileToBase64(file);
  const prompt = `Bạn là hệ thống OCR Toán học chuyên nghiệp. Chuyển ảnh thành LaTeX chuẩn ex_test.\n\nKHO MẪU TIKZ:\n${getAllTikzSnippets()}\n\nCHỈ trả về khối \\begin{ex}...\\end{ex}.`;
  const result = await callGemini(prompt, "gemini-2.5-flash", { mime_type: file.type || "image/png", data: base64 });
  return normalizeExBlocks(keepOnlyExBlocks(result));
}

export async function convertPdfToText(pdfImages: any[]): Promise<string> {
  const results = [];
  for (const page of pdfImages) {
    const text = await callGemini("Trích xuất văn bản từ trang này:", undefined, { mimeType: page.mimeType, data: page.base64 });
    results.push(`--- Trang ${page.pageNumber} ---\n${text}`);
  }
  return results.join("\n\n");
}

export async function callGeminiPublic(prompt: string, model?: string, inlineData?: InlineData, inlineDataList?: InlineData[]): Promise<string> {
  return callGemini(prompt, model, inlineData, inlineDataList);
}

export async function generateSimilarQuestions(questions: any[]): Promise<any[]> {
  const apiKey = getSafeApiKey();
  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `Bạn là một giáo viên toán trung học chuyên nghiệp. 
Nhiệm vụ của bạn là tạo ra một đề thi toán mới hoàn toàn tương tự đề thi được cung cấp ở dạng JSON dưới đây.
Yêu cầu bắt buộc:
1. Giữ nguyên cấu trúc đề, số lượng câu hỏi, các phần (Part), và dạng toán của từng câu hỏi.
2. Giữ nguyên mức độ khó và phân loại câu hỏi (trắc nghiệm, đúng/sai, trả lời ngắn, tự luận).
3. CHỈ thay đổi các số liệu, hằng số, phương trình hoặc biến số trong đề bài để tạo ra bài toán mới có cách giải và thuật toán tương tự nhưng đáp án khác.
4. Đảm bảo các số liệu mới được chọn sao cho đáp án đẹp (ví dụ: nghiệm nguyên, số hữu tỷ đơn giản) nếu có thể.
5. Cập nhật lại nội dung câu hỏi (text) dưới dạng HTML + LaTeX, các phương án lựa chọn (options) với các trường text và isCorrect phù hợp, đáp án đúng (correctAnswer) và lời giải chi tiết (solution) dưới dạng HTML + LaTeX tương ứng với số liệu mới. Các công thức LaTeX phải được viết chính xác và đặt giữa $ hoặc $$.
6. Trả về kết quả dưới dạng mảng các đối tượng câu hỏi JSON khớp với cấu trúc mảng đầu vào.

ĐỀ THI GỐC (JSON):
${JSON.stringify(questions, null, 2)}`;

  const modelsToTry = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];

  return callWithRetry(async (selectedModel) => {
    try {
      const response = await ai.models.generateContent({
        model: selectedModel || "gemini-2.5-flash",
        contents: [{ text: prompt }],
        config: {
          responseMimeType: "application/json"
        }
      });

      const text = response.text || "";
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed;
      }
      if (parsed.questions && Array.isArray(parsed.questions)) {
        return parsed.questions;
      }
      throw new Error("Định dạng dữ liệu trả về từ AI không hợp lệ.");
    } catch (error: any) {
      console.error(`Lỗi khi tạo đề tương tự (${selectedModel}):`, error);
      throw error;
    }
  }, 3, 1500, modelsToTry).catch((error: any) => {
    throw new Error("Không thể tạo câu hỏi tương tự từ AI: " + (error.message || "Lỗi không xác định"));
  });
}
