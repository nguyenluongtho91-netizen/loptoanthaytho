import { OCRResult } from '../types';

export const uploadToGAS = async (file: File, endpoint: string): Promise<OCRResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = async () => {
      try {
        const base64Raw = reader.result as string;
        
        // Code.gs mới yêu cầu cấu trúc payload cụ thể:
        // { action: 'ocr', base64Data: '...', fileName: '...' }
        const payload = {
          action: 'ocr',
          base64Data: base64Raw, // Đổi từ base64 -> base64Data
          fileName: file.name,
          useGemini: false, // Mặc định false, xử lý Gemini ở client
          returnDocx: false // Mặc định false, xử lý ở client
        };

        // Gửi request dạng text/plain để tránh Preflight CORS phức tạp của Google
        const response = await fetch(endpoint, {
          method: 'POST',
          body: JSON.stringify(payload),
          headers: {
            'Content-Type': 'text/plain', 
          },
        });

        if (!response.ok) {
          throw new Error(`Server returned ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Kiểm tra logic success từ backend
        if (data.success) {
          // Code.gs mới trả về kết quả nằm trong thuộc tính 'ocrResult'
          // data = { success: true, action: 'ocr', ocrResult: { ... }, docx: null }
          if (data.ocrResult) {
             resolve(data.ocrResult as OCRResult);
          } else {
             // Fallback cho trường hợp trả về trực tiếp (code cũ)
             resolve(data as OCRResult);
          }
        } else {
          const errMsg = data.error || (data.result === 'error' ? data.message : "OCR failed on backend");
          reject(new Error(errMsg));
        }
      } catch (error: any) {
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
            reject(new Error('Failed to fetch: Không thể kết nối. Vui lòng kiểm tra lại URL Script hoặc quyền truy cập (Anyone).'));
        } else {
            reject(error);
        }
      }
    };
    reader.onerror = (error) => reject(new Error("Lỗi đọc file: " + error));
  });
};