// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Image as ImageIcon, Wand2, Loader2, Upload, Play, Clipboard, X, 
  FileText, Eye, Download, ExternalLink, Code, Copy, Check 
} from 'lucide-react';
import { imageToExTest } from '../services/geminiService';
import { compileFullTex, base64ToBlob, downloadBlob } from '../services/api';
import { EX_TEST_DETHI_TEMPLATE } from '../constants';

interface ImageToLatexViewProps {
  onTransferToConvert?: (latex: string) => void;
}

// ─── Build full .tex để compile ───────────────────────────────────────────────
const TEMPLATE_MARKER = '%=== THÊM CÂU HỎI TẠI ĐÂY ===';

function buildFullTex(body: string): string {
  const parts = EX_TEST_DETHI_TEMPLATE.split(TEMPLATE_MARKER);
  if (parts.length >= 2) {
    return `${parts[0]}\n\n${body}\n\n${parts.slice(1).join(TEMPLATE_MARKER)}`;
  }
  return `${EX_TEST_DETHI_TEMPLATE}\n\n${body}`;
}

// ─── Modal xem trước PDF ──────────────────────────────────────────────────────
type PdfState = { url: string; blob: Blob; filename: string } | null;

function PdfModal({ pdf, onClose, onDownload }: { pdf: PdfState; onClose: () => void; onDownload: () => void }) {
  if (!pdf) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
          <span className="font-extrabold text-slate-800 flex items-center gap-2">
            <Eye size={18} className="text-teal-600" /> Xem trước PDF (Biên dịch từ OCR)
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => window.open(pdf.url, '_blank')}
              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 font-bold text-slate-700 flex items-center gap-1.5 text-sm transition-colors">
              <ExternalLink size={14} /> Mở tab mới
            </button>
            <button onClick={onDownload}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 text-sm shadow-sm transition-colors">
              <Download size={14} /> Tải PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:bg-slate-200 hover:text-red-500 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="h-[74vh] bg-slate-100">
          <iframe src={pdf.url} className="w-full h-full" title="pdf-preview" />
        </div>
      </div>
    </div>
  );
}

const ImageToLatexView: React.FC<ImageToLatexViewProps> = ({ onTransferToConvert }) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultLatex, setResultLatex] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // State copy
  const [copied, setCopied] = useState(false);

  // State cho phần biên dịch
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileLog, setCompileLog] = useState('');
  const [pdf, setPdf] = useState<PdfState>(null);
  const [showPdf, setShowPdf] = useState(false);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) handleFileSelection(blob);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // Dọn dẹp object URL khi unmount
  useEffect(() => {
    return () => { if (pdf?.url) URL.revokeObjectURL(pdf.url); };
  }, [pdf]);

  const handleFileSelection = (selectedFile: File) => {
    if (selectedFile.type.startsWith('image/') || selectedFile.type === 'application/pdf') {
      setFile(selectedFile);
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      setResultLatex('');
      setCompileLog('');
    } else {
      alert('Chỉ hỗ trợ file Ảnh (PNG, JPG) hoặc PDF.');
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleClear = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setResultLatex('');
    setCompileLog('');
  };

  const handleConvert = async () => {
    if (!file) return;

    setLoading(true);
    setMessage('Đang phân tích hình ảnh & nhận diện công thức toán...');
    setCompileLog('');

    try {
      const latex = await imageToExTest(file);
      setResultLatex(latex);
      setMessage('');
    } catch (error: any) {
      alert('Lỗi OCR: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // ─── Hàm Copy ───
  const handleCopy = useCallback(async () => {
    if (!resultLatex) return;
    try {
      await navigator.clipboard.writeText(resultLatex);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('Không thể copy. Vui lòng copy thủ công.');
    }
  }, [resultLatex]);

  // ─── Hàm biên dịch PDF ───
  const handleCompilePdf = useCallback(async () => {
    if (!resultLatex) return;
    setIsCompiling(true);
    setCompileLog('Đang gửi mã LaTeX lên máy chủ biên dịch...');
    try {
      const tex = buildFullTex(resultLatex);
      const data = await compileFullTex({ tex, engine: 'pdflatex', returnLog: true });
      if (!data?.ok) {
        setCompileLog(data?.detail || data?.log || 'Biên dịch thất bại.');
        alert('❌ Lỗi biên dịch LaTeX. Thầy xem LOG bên dưới để sửa mã nhé.');
        return;
      }
      setCompileLog(data.log || '✅ Biên dịch thành công!');
      if (data.base64) {
        const blob = base64ToBlob(data.base64, 'application/pdf');
        const url = URL.createObjectURL(blob);
        if (pdf?.url) URL.revokeObjectURL(pdf.url);
        setPdf({ url, blob, filename: 'ocr_preview.pdf' });
        setShowPdf(true);
      }
    } catch (e: any) {
      const msg = e?.message || 'Lỗi kết nối đến máy chủ biên dịch.';
      setCompileLog(msg);
      alert(`❌ ${msg}`);
    } finally {
      setIsCompiling(false);
    }
  }, [resultLatex, pdf]);

  return (
    <div className="animate-in fade-in duration-500">
      <PdfModal pdf={showPdf ? pdf : null} onClose={() => setShowPdf(false)} onDownload={() => pdf && downloadBlob(pdf.blob, pdf.filename)} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ─── TRÁI: INPUT ─── */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            <ImageIcon className="text-teal-600" /> Ảnh / PDF đề bài
          </h3>

          {!file ? (
            <div className="border-2 border-dashed border-slate-300 rounded-xl h-[540px] flex flex-col items-center justify-center p-8 text-center hover:bg-slate-50 transition-colors relative">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={handleUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="w-20 h-20 bg-teal-100 rounded-full flex items-center justify-center mb-4">
                <Upload className="w-10 h-10 text-teal-600" />
              </div>
              <h4 className="font-bold text-slate-700 text-lg">Upload hoặc Dán ảnh (Ctrl+V)</h4>
              <p className="text-slate-500 text-sm mt-2">Hỗ trợ: JPG, PNG, PDF</p>
              <div className="mt-6 flex gap-2 text-xs text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                <Clipboard size={14} /> Hỗ trợ dán trực tiếp
              </div>
            </div>
          ) : (
            <div className="relative h-[540px] border border-slate-200 rounded-xl bg-slate-900 overflow-hidden flex items-center justify-center group">
              {file.type.startsWith('image/') ? (
                <img src={previewUrl!} alt="Preview" className="max-w-full max-h-full object-contain" />
              ) : (
                <div className="text-white flex flex-col items-center gap-2">
                  <FileText size={48} />
                  <span>{file.name}</span>
                  <span className="text-xs text-slate-400">PDF Preview không khả dụng</span>
                </div>
              )}

              <button
                onClick={handleClear}
                className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full hover:bg-red-600 transition-colors"
                title="Xóa ảnh"
              >
                <X size={16} />
              </button>

              {!loading && !resultLatex && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                  <button
                    onClick={handleConvert}
                    className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-full shadow-xl border border-teal-400 flex items-center gap-2 transform transition-transform hover:scale-105"
                  >
                    <Wand2 size={18} /> Phân tích ngay
                  </button>
                </div>
              )}

              {loading && (
                <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                  <Loader2 className="w-12 h-12 animate-spin mb-4 text-teal-400" />
                  <p className="font-medium animate-pulse">{message}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── PHẢI: OUTPUT ─── */}
        <div className="space-y-4 flex flex-col h-full">
          <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
            <Wand2 className="text-teal-600" /> Kết quả LaTeX (ex_test)
          </h3>

          <div className="flex-1 flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm min-h-[540px]">
            {resultLatex ? (
              <>
                <textarea
                  value={resultLatex}
                  onChange={(e) => setResultLatex(e.target.value)}
                  className="flex-1 p-4 font-mono text-sm bg-slate-50 text-slate-800 resize-none focus:outline-none"
                  placeholder="Mã LaTeX sẽ hiển thị ở đây..."
                  spellCheck={false}
                />
                
                {/* Compile Log hiển thị nếu có lỗi hoặc đang chạy */}
                {compileLog && (
                  <div className="border-t border-slate-200 bg-slate-800 p-3 max-h-[120px] overflow-auto">
                    <div className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-2">
                      <Code size={12} /> LOG biên dịch
                    </div>
                    <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap leading-relaxed">
                      {compileLog}
                    </pre>
                  </div>
                )}

                <div className="p-4 bg-white border-t border-gray-200 flex flex-wrap justify-end gap-3">
                  <button
                    onClick={handleCopy}
                    className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold shadow-sm flex items-center gap-2 transition-all"
                  >
                    {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                    {copied ? 'Đã copy!' : 'Copy mã'}
                  </button>
                  <button
                    onClick={handleCompilePdf}
                    disabled={isCompiling}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-bold shadow-md flex items-center gap-2 transition-all"
                  >
                    {isCompiling ? <Loader2 size={16} className="animate-spin" /> : <Eye size={16} />}
                    {isCompiling ? 'Đang biên dịch...' : 'Biên dịch PDF'}
                  </button>
                  {onTransferToConvert && (
                    <button
                      onClick={() => onTransferToConvert(resultLatex)}
                      className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold shadow-md flex items-center gap-2 transition-all"
                    >
                      <Play size={16} />
                      Sang Biên dịch
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50 p-8 text-center">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                  <FileText size={32} />
                </div>
                <p>Tải ảnh/PDF lên và nhấn <b>"Phân tích ngay"</b> để AI trích xuất nội dung.</p>
                <p className="text-xs mt-2 text-slate-400">
                  Hỗ trợ nhận diện: Trắc nghiệm, Đúng/Sai, Tự luận & Hình vẽ TikZ.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageToLatexView;
