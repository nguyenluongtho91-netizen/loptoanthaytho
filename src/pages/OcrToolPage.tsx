// @ts-nocheck
import React, { useState, useRef } from 'react';
import {
  UploadCloud, FileText, ArrowRight, Wand2, Download, AlertCircle,
  CheckCircle2, Sparkles, FileDown, Loader2, Settings, Save
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { marked } from 'marked'; 
import { OCRResult, AppState } from '@/types'; 
import { uploadToGAS } from '@/services/ocrService';
import { GeminiService } from '@/services/geminiService';
import toast from 'react-hot-toast';

export default function OcrToolPage() {
  const [showSettings, setShowSettings] = useState(false);

  // ─── STATE CÀI ĐẶT (Lưu tự động vào LocalStorage) ───
  const [gasEndpoint, setGasEndpoint] = useState(() => localStorage.getItem('ocr_gas_url') || '');
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('ocr_gemini_key') || '');

  const handleSaveSettings = () => {
    localStorage.setItem('ocr_gas_url', gasEndpoint);
    localStorage.setItem('ocr_gemini_key', geminiKey);
    toast.success('Đã lưu cấu hình OCR!');
    setShowSettings(false);
  };

  // ─── STATE GAS OCR ───
  const [state, setState] = useState<AppState>(AppState.IDLE);
  const [file, setFile] = useState<File | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [correctedText, setCorrectedText] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  const geminiServiceRef = useRef<GeminiService>(new GeminiService(geminiKey));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setState(AppState.IDLE);
      setOcrResult(null);
      setCorrectedText('');
      setErrorMsg('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!gasEndpoint) {
      setErrorMsg('Vui lòng mở phần Cài đặt (⚙️) và nhập Link Google Apps Script.');
      setShowSettings(true);
      return;
    }
    setState(AppState.UPLOADING_OCR);
    setErrorMsg('');
    try {
      const result = await uploadToGAS(file, gasEndpoint);
      setOcrResult(result);
      setState(AppState.OCR_COMPLETE);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi kết nối tới máy chủ OCR.');
      setState(AppState.ERROR);
    }
  };

  const handleCorrection = async () => {
    if (!ocrResult?.allMarkdownDataUri) return;
    if (!geminiKey) {
      setErrorMsg('Vui lòng mở phần Cài đặt (⚙️) và nhập Gemini API Key.');
      setShowSettings(true);
      return;
    }
    setState(AppState.CORRECTING);
    setCorrectedText('');
    try {
      geminiServiceRef.current.updateKey(geminiKey);
      const finalRestoredText = await geminiServiceRef.current.correctTextStream(
        ocrResult.allMarkdownDataUri,
        (chunk) => setCorrectedText((prev) => prev + chunk)
      );
      setCorrectedText(finalRestoredText);
      setState(AppState.OCR_COMPLETE);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi xử lý AI.');
      setState(AppState.ERROR);
    }
  };

  const handleDownloadMarkdown = () => {
    const textToSave = correctedText || ocrResult?.allMarkdownDataUri || '';
    if (!textToSave) return;
    const blob = new Blob([textToSave], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (file?.name.replace('.pdf', '') || 'document') + '_converted.md';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ✅ 100% LOGIC VÀ TEMPLATE XUẤT WORD GỐC CỦA THẦY
  const handleExportWord = async () => {
    const textToSave = correctedText || ocrResult?.allMarkdownDataUri || '';
    if (!textToSave) return;
    let htmlContent = '';
    try {
      // Dùng hàm parse của thư viện marked vừa cài đặt, không can thiệp chuỗi
      htmlContent = await marked.parse(textToSave);
    } catch (e) {
      alert('Lỗi khi chuyển đổi Markdown sang HTML');
      return;
    }
    const wordTemplate = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Export Document</title>
        <style>
          body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12pt; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 1em; }
          td, th { border: 1px solid #000; padding: 6px 8px; vertical-align: top; }
          th { background-color: #f2f2f2; font-weight: bold; }
          img { max-width: 100%; height: auto; display: block; margin: 10px 0; }
          pre, code { font-family: 'Courier New', monospace; background-color: #f5f5f5; padding: 2px 4px; }
          pre { padding: 10px; white-space: pre-wrap; }
          h1, h2, h3, h4, h5, h6 { margin-top: 1em; margin-bottom: 0.5em; font-weight: bold; }
        </style>
      </head>
      <body>${htmlContent}</body>
      </html>`;
    const blob = new Blob(['\ufeff', wordTemplate], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (file?.name.replace('.pdf', '') || 'document') + '_export.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const currentDisplayMarkdown = correctedText || ocrResult?.allMarkdownDataUri || '';
  const isCorrecting = state === AppState.CORRECTING;
  const isProcessingOCR = state === AppState.UPLOADING_OCR;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-5 rounded-2xl shadow-sm border border-teal-100">
        <div>
          <h1 className="text-2xl font-bold text-teal-800 flex items-center gap-2">
            <FileText className="w-6 h-6 text-teal-600" /> Smart OCR & Fixer
          </h1>
          <p className="text-sm text-gray-500 mt-1">Chuyển PDF sang Text và sửa lỗi chính tả bằng AI</p>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} className="btn-outline flex items-center gap-2">
          <Settings className="w-4 h-4" /> Cấu hình API
        </button>
      </div>

      {showSettings && (
        <div className="bg-teal-50 border-2 border-teal-200 p-6 rounded-2xl shadow-inner mb-6 animate-in slide-in-from-top-4 fade-in">
          <h3 className="font-bold text-teal-900 mb-4 flex items-center gap-2">⚙️ Cấu hình Hệ thống OCR</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-teal-700 mb-1">Google Apps Script URL (OCR)</label>
              <input 
                type="text" 
                value={gasEndpoint} 
                onChange={(e) => setGasEndpoint(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full px-4 py-2 rounded-xl border border-teal-300 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-teal-700 mb-1">Gemini API Key (Dùng để sửa lỗi)</label>
              <input 
                type="password" 
                value={geminiKey} 
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full px-4 py-2 rounded-xl border border-teal-300 focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={handleSaveSettings} className="btn-teal flex items-center gap-2 px-6">
              <Save className="w-4 h-4" /> Lưu cấu hình
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 min-h-[60vh]">
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div className="text-sm text-red-700 font-medium">{errorMsg}</div>
          </div>
        )}

        {!ocrResult && !isProcessingOCR && (
          <div className="max-w-2xl mx-auto mt-8 border-2 border-dashed border-teal-200 bg-teal-50/30 rounded-3xl p-10 text-center">
            <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <UploadCloud className="w-10 h-10 text-teal-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-3">Tải lên tài liệu PDF</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">Hỗ trợ nhận diện tiếng Việt chính xác, giữ nguyên định dạng bảng biểu và hình ảnh qua Google Script.</p>
            <div className="relative inline-block">
              <input type="file" accept=".pdf" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />
              <div className="flex items-center justify-center gap-3 px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-xl transition-all shadow-lg">
                <span>Chọn file PDF</span><ArrowRight className="w-4 h-4" />
              </div>
            </div>
            {file && (
              <div className="mt-8 flex flex-col items-center gap-4">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium border border-teal-200"><CheckCircle2 className="w-4 h-4" /> {file.name}</span>
                <button onClick={handleUpload} className="px-10 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl shadow-lg transition-all flex items-center gap-2"><Wand2 className="w-4 h-4" /> Bắt đầu Xử lý OCR</button>
              </div>
            )}
          </div>
        )}

        {isProcessingOCR && (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 text-teal-600 animate-spin mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">Đang xử lý tài liệu...</h3>
            <p className="text-gray-500">Hệ thống đang OCR qua Google Script, vui lòng đợi.</p>
          </div>
        )}

        {(ocrResult || isCorrecting) && !isProcessingOCR && (
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 border border-gray-200">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <div>
                  <h3 className="font-bold text-gray-800">Xử lý hoàn tất</h3>
                  <p className="text-xs text-gray-500">{ocrResult?.pageCount} trang · {ocrResult?.totalImages} hình ảnh</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!correctedText && !isCorrecting && (
                  <button onClick={handleCorrection} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg flex items-center gap-2 transition-all shadow-sm"><Sparkles className="w-4 h-4" /> Sửa lỗi bằng AI</button>
                )}
                {isCorrecting && (
                  <div className="px-4 py-2 bg-amber-50 text-amber-700 font-medium rounded-lg flex items-center gap-2 border border-amber-200"><Loader2 className="w-4 h-4 animate-spin" /> Đang sửa lỗi...</div>
                )}
                <div className="w-px h-8 bg-gray-300 mx-2" />
                <button onClick={handleDownloadMarkdown} className="btn-outline flex items-center gap-2 px-3 py-2"><Download className="w-4 h-4" /> Markdown</button>
                <button onClick={handleExportWord} className="btn-teal flex items-center gap-2 px-3 py-2"><FileDown className="w-4 h-4" /> Xuất Word</button>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-100 px-4 py-2 font-bold text-gray-700 flex items-center gap-2 text-sm border-b border-gray-200">
                {correctedText ? <><Sparkles className="w-4 h-4 text-amber-500" /> Kết quả đã tối ưu hóa</> : <><FileText className="w-4 h-4 text-teal-600" /> Bản nháp OCR</>}
              </div>
              <div className="p-6 bg-white max-h-[60vh] overflow-y-auto prose prose-teal max-w-none text-sm">
                <ReactMarkdown>{currentDisplayMarkdown}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
