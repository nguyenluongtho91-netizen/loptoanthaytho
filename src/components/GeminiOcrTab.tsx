// @ts-nocheck
import React, { useState, useRef, useCallback } from 'react';
import {
  UploadCloud,
  FileText,
  Sparkles,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronRight,
  FileDown,
  Image as ImageIcon,
  Layers,
  Zap,
  RefreshCw,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { convertPdfToImages, getPdfPageCount } from './pdfUtils';
import { ocrAllPages, combinePageResults, GeminiOcrPageResult } from './geminiOcrService';

type TabStatus = 'idle' | 'reading' | 'converting' | 'ocr' | 'done' | 'error';

interface PageState {
  status: 'pending' | 'processing' | 'done' | 'error';
  text: string;
  figureCount?: number;
  error?: string;
}

export const GeminiOcrTab: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState<TabStatus>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [pageStates, setPageStates] = useState<PageState[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [combinedResult, setCombinedResult] = useState('');
  const [activePreviewPage, setActivePreviewPage] = useState(0);
  const resultsRef = useRef<GeminiOcrPageResult[]>([]);
  const abortRef = useRef(false);

  const resetState = () => {
    setStatus('idle');
    setErrorMsg('');
    setPageStates([]);
    setCurrentPage(0);
    setCombinedResult('');
    setActivePreviewPage(0);
    resultsRef.current = [];
    abortRef.current = false;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    resetState();
    try {
      setStatus('reading');
      const count = await getPdfPageCount(f);
      setTotalPages(count);
      setStatus('idle');
    } catch {
      setTotalPages(0);
      setStatus('idle');
    }
  };

  const handleStart = useCallback(async () => {
    if (!file) return;
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      setErrorMsg('Chưa tìm thấy API Key. Vui lòng thêm API_KEY vào biến môi trường.');
      setStatus('error');
      return;
    }

    abortRef.current = false;
    resetState();
    resultsRef.current = [];

    // Step 1: Convert PDF to images
    setStatus('converting');
    let pageImages: string[] = [];
    try {
      pageImages = await convertPdfToImages(file, 50, 2.0);
      const count = pageImages.length;
      setTotalPages(count);
      setPageStates(Array.from({ length: count }, () => ({ status: 'pending', text: '' })));
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi chuyển đổi PDF sang ảnh.');
      setStatus('error');
      return;
    }

    // Step 2: OCR each page
    setStatus('ocr');
    setCurrentPage(1);

    try {
      const results = await ocrAllPages(apiKey, pageImages, {
        onPageStart: (pageNum) => {
          setCurrentPage(pageNum);
          setPageStates((prev) => {
            const next = [...prev];
            next[pageNum - 1] = { status: 'processing', text: '' };
            return next;
          });
        },
        onPageChunk: (pageNum, text) => {
          setPageStates((prev) => {
            const next = [...prev];
            next[pageNum - 1] = { status: 'processing', text };
            return next;
          });
        },
        onPageDone: (pageNum, markdown, figureCount) => {
          setPageStates((prev) => {
            const next = [...prev];
            next[pageNum - 1] = { status: 'done', text: markdown, figureCount };
            return next;
          });
          resultsRef.current.push({ pageNumber: pageNum, markdown, figureCount });
          // Auto-switch preview to completed page
          setActivePreviewPage(pageNum - 1);
        },
        onPageError: (pageNum, error) => {
          setPageStates((prev) => {
            const next = [...prev];
            next[pageNum - 1] = { status: 'error', text: '', error };
            return next;
          });
          resultsRef.current.push({ pageNumber: pageNum, markdown: '', figureCount: 0, error });
        },
      });

      const combined = combinePageResults(results);
      setCombinedResult(combined);
      setStatus('done');
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi xử lý OCR bằng Gemini.');
      setStatus('done'); // Still show whatever we got
    }
  }, [file]);

  const handleDownloadMarkdown = () => {
    if (!combinedResult) return;
    const blob = new Blob([combinedResult], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (file?.name.replace('.pdf', '') || 'document') + '_gemini_ocr.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportWord = () => {
    if (!combinedResult) return;
    let htmlContent = '';
    try {
      if (window.marked?.parse) {
        htmlContent = window.marked.parse(combinedResult);
      } else {
        alert('Thư viện marked chưa được tải. Vui lòng refresh trang.');
        return;
      }
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
    a.download = (file?.name.replace('.pdf', '') || 'document') + '_gemini_export.doc';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isProcessing = status === 'converting' || status === 'ocr';
  const completedPages = pageStates.filter((p) => p.status === 'done' || p.status === 'error').length;
  const currentPreviewText = pageStates[activePreviewPage]?.text || '';

  // ── Idle / File select state ──────────────────────────────────────────────
  if (status === 'idle' || status === 'reading') {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-white rounded-3xl shadow-xl shadow-orange-900/5 border border-orange-100 overflow-hidden">
          <div className="p-8 md:p-12 text-center">
            {/* Icon */}
            <div className="w-20 h-20 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-6 relative">
              <div className="absolute inset-0 bg-orange-200 rounded-full opacity-0 hover:opacity-60 transition-opacity duration-300 scale-110 blur-xl" />
              <Zap className="w-10 h-10 text-orange-600 relative z-10" />
            </div>

            <h2 className="text-2xl font-bold text-slate-800 mb-2">Gemini Direct OCR</h2>
            <p className="text-slate-500 mb-2 max-w-md mx-auto text-sm">
              Dùng Gemini Vision AI trực tiếp tại trình duyệt. Chuyển từng trang PDF thành ảnh rồi OCR song song, không qua máy chủ trung gian.
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-semibold mb-8">
              <Sparkles className="w-3 h-3" />
              gemini-3.1-flash-lite-preview · Gemini Vision
            </div>

            {/* Upload */}
            <div className="relative">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
              />
              <div className="flex items-center justify-center gap-3 mx-auto px-8 py-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-orange-500/30 transform hover:scale-[1.02] active:scale-[0.98]">
                <UploadCloud className="w-5 h-5" />
                <span>Chọn file PDF</span>
              </div>
            </div>

            {file && (
              <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium border border-orange-100">
                <CheckCircle2 className="w-4 h-4" />
                {file.name}
                {status === 'reading' && <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" />}
                {totalPages > 0 && (
                  <span className="text-orange-500 ml-1">· {totalPages} trang</span>
                )}
              </div>
            )}
          </div>

          {file && status !== 'reading' && (
            <div className="bg-orange-50/50 p-6 border-t border-orange-100 flex justify-center">
              <button
                onClick={handleStart}
                className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-orange-700 to-orange-600 hover:from-orange-600 hover:to-orange-500 text-white font-semibold rounded-xl shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Bắt đầu OCR bằng Gemini
              </button>
            </div>
          )}
        </div>

        {/* Feature cards */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 text-center">
          {[
            { icon: Layers, title: 'Xử lý từng trang', desc: 'Mỗi trang → ảnh → Gemini Vision' },
            { icon: ImageIcon, title: 'Trích xuất hình ảnh', desc: 'Nhận diện và cắt vùng ảnh' },
            { icon: Sparkles, title: 'Markdown sạch', desc: 'Bảng, heading, formula LaTeX' },
          ].map((item, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-white/60 border border-white shadow-sm">
              <item.icon className="w-8 h-8 text-orange-500 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-800 mb-1">{item.title}</h3>
              <p className="text-xs text-slate-500">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <div className="max-w-2xl mx-auto mt-10">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-red-800 mb-1">Đã xảy ra lỗi</h3>
            <p className="text-sm text-red-700">{errorMsg}</p>
            <button
              onClick={resetState}
              className="mt-4 px-4 py-2 bg-white border border-red-200 text-red-700 font-medium rounded-lg text-sm flex items-center gap-2 hover:bg-red-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Thử lại
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Processing + Done state ───────────────────────────────────────────────
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-20 z-30">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${status === 'done' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'}`}>
            {status === 'done' ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Loader2 className="w-5 h-5 animate-spin" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-slate-800">
              {status === 'converting'
                ? 'Đang chuyển đổi PDF → ảnh...'
                : status === 'ocr'
                ? `OCR trang ${currentPage} / ${pageStates.length}...`
                : 'Hoàn tất'}
            </h3>
            <p className="text-xs text-slate-500">
              {pageStates.length > 0
                ? `${completedPages}/${pageStates.length} trang xong · ${pageStates.reduce((s, p) => s + (p.figureCount ?? 0), 0)} hình vẽ · gemini-3.1-flash-lite-preview`
                : 'Đang khởi tạo...'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {status === 'done' && (
            <>
              <button
                onClick={handleDownloadMarkdown}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium rounded-lg flex items-center gap-2 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Tải Markdown
              </button>
              <button
                onClick={handleExportWord}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md shadow-blue-500/20 flex items-center gap-2 transition-all text-sm"
              >
                <FileDown className="w-4 h-4" />
                Xuất Word (.doc)
              </button>
            </>
          )}
          <button
            onClick={() => { resetState(); setFile(null); setTotalPages(0); }}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 rounded-lg flex items-center gap-1.5 transition-colors text-sm"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Làm mới
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Page list sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-orange-50 bg-orange-50/40">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Layers className="w-4 h-4 text-orange-500" />
                Danh sách trang
              </span>
            </div>
            <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
              {status === 'converting' && (
                <div className="p-4 text-center text-sm text-slate-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-orange-400" />
                  Đang render PDF...
                </div>
              )}
              {pageStates.map((page, idx) => (
                <button
                  key={idx}
                  onClick={() => setActivePreviewPage(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-orange-50/50 ${activePreviewPage === idx ? 'bg-orange-50 border-l-2 border-orange-500' : ''}`}
                >
                  {/* Status icon */}
                  <div className="shrink-0">
                    {page.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                    {page.status === 'error' && <AlertCircle className="w-4 h-4 text-red-500" />}
                    {page.status === 'processing' && <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />}
                    {page.status === 'pending' && (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-200" />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${activePreviewPage === idx ? 'text-orange-700' : 'text-slate-600'}`}>
                    Trang {idx + 1}
                  </span>
                  {page.status === 'done' && (page.figureCount ?? 0) > 0 && (
                    <span className="ml-auto text-xs px-1.5 py-0.5 bg-orange-100 text-orange-600 rounded font-medium">
                      {page.figureCount} ảnh
                    </span>
                  )}
                  {activePreviewPage === idx && (page.figureCount ?? 0) === 0 && (
                    <ChevronRight className="w-3.5 h-3.5 text-orange-400 ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
            <div className="px-6 py-3 border-b border-orange-50 bg-orange-50/30 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                {pageStates[activePreviewPage]?.status === 'processing' ? (
                  <>
                    <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                    <span className="text-orange-600">Đang OCR trang {activePreviewPage + 1}...</span>
                  </>
                ) : pageStates[activePreviewPage]?.status === 'done' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    Trang {activePreviewPage + 1} — Hoàn tất
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 text-slate-400" />
                    Trang {activePreviewPage + 1}
                  </>
                )}
              </span>
              {status === 'done' && (
                <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded font-medium">
                  {completedPages}/{pageStates.length} trang
                </span>
              )}
            </div>

            <div className="flex-1 p-6 overflow-auto max-h-[700px] markdown-body">
              {currentPreviewText ? (
                <article className="prose prose-slate max-w-none prose-img:rounded-xl prose-img:shadow-md prose-headings:text-orange-800 prose-a:text-orange-600">
                  <ReactMarkdown>{currentPreviewText}</ReactMarkdown>
                </article>
              ) : pageStates[activePreviewPage]?.status === 'pending' ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <div className="w-8 h-8 rounded-full border-2 border-slate-200 mb-3" />
                  <p className="text-sm">Chờ xử lý...</p>
                </div>
              ) : status === 'converting' ? (
                <div className="flex flex-col items-center justify-center h-48 text-orange-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-3" />
                  <p className="text-sm">Đang chuyển đổi PDF sang ảnh...</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Combined result (shown when done) */}
      {status === 'done' && combinedResult && (
        <div className="mt-6 bg-white rounded-2xl border border-orange-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-orange-50 bg-gradient-to-r from-orange-50 to-white flex items-center justify-between">
            <span className="font-semibold text-slate-700 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-orange-500" />
              Kết quả tổng hợp ({pageStates.length} trang)
            </span>
            <span className="text-xs text-slate-500">
              {combinedResult.length.toLocaleString()} ký tự
            </span>
          </div>
          <div className="p-6 overflow-auto max-h-[600px] markdown-body">
            <article className="prose prose-slate max-w-none prose-img:rounded-xl prose-img:shadow-md prose-headings:text-orange-800">
              <ReactMarkdown>{combinedResult}</ReactMarkdown>
            </article>
          </div>
        </div>
      )}
    </div>
  );
};
