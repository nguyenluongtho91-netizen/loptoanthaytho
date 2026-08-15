// src/components/TikzVisionView.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ImagePlus,
  ClipboardPaste,
  Wand2,
  Copy,
  Check,
  RotateCcw,
  Eye,
  ArrowRight,
  Loader2,
  X,
} from 'lucide-react';

import { compileTikzToImage, extractTikzCode } from '../services/api';
import { generateTikzFromDescriptionAndImages } from '../services/tikzVisionService';

type LocalImage = {
  id: string;
  name: string;
  mimeType: string;
  dataUrl: string; // data:<mime>;base64,...
  size: number;
};

interface Props {
  onTransferToCompile: (tikzCode: string) => void;
}

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || ''));
    r.onerror = () => reject(new Error('Không đọc được file ảnh.'));
    r.readAsDataURL(file);
  });
}

function dataUrlToBase64(dataUrl: string): string {
  const i = dataUrl.indexOf(',');
  if (i === -1) return '';
  return dataUrl.slice(i + 1);
}

const TikzVisionView: React.FC<Props> = ({ onTransferToCompile }) => {
  const [problemText, setProblemText] = useState('');
  const [extraDescription, setExtraDescription] = useState('');

  const [images, setImages] = useState<LocalImage[]>([]);
  const [output, setOutput] = useState('');
  const [rawModelText, setRawModelText] = useState('');

  const [copied, setCopied] = useState(false);

  // AI generate states
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  // Preview states
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const cleanupPreviewUrl = useCallback(() => {
    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    return () => cleanupPreviewUrl();
  }, [cleanupPreviewUrl]);

  const resetPreview = useCallback(() => {
    setShowPreview(false);
    setPreviewError('');
    cleanupPreviewUrl();
    setPreviewUrl('');
  }, [cleanupPreviewUrl]);

  const resetAll = useCallback(() => {
    setProblemText('');
    setExtraDescription('');
    setImages([]);
    setOutput('');
    setRawModelText('');
    setAiError('');
    setAiLoading(false);
    resetPreview();
  }, [resetPreview]);

  const handleAddFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;

      const picked = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (picked.length === 0) return;

      const mapped: LocalImage[] = [];
      for (const f of picked) {
        const dataUrl = await fileToDataUrl(f);
        mapped.push({
          id: uid(),
          name: f.name,
          mimeType: f.type || 'image/png',
          dataUrl,
          size: f.size,
        });
      }

      setImages((prev) => [...mapped, ...prev].slice(0, 6));
      resetPreview();
    },
    [resetPreview]
  );

  const removeImage = useCallback(
    (id: string) => {
      setImages((prev) => prev.filter((x) => x.id !== id));
      resetPreview();
    },
    [resetPreview]
  );

  // ✅ Paste image from clipboard (Ctrl+V)
  const onPaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      const imgItems = Array.from(items).filter((it) => it.type.startsWith('image/'));
      if (imgItems.length === 0) return;

      e.preventDefault();

      const files: File[] = [];
      for (const it of imgItems) {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
      if (files.length === 0) return;

      const mapped: LocalImage[] = [];
      for (const f of files) {
        const dataUrl = await fileToDataUrl(f);
        mapped.push({
          id: uid(),
          name: f.name || 'pasted-image.png',
          mimeType: f.type || 'image/png',
          dataUrl,
          size: f.size,
        });
      }

      setImages((prev) => [...mapped, ...prev].slice(0, 6));
      resetPreview();
    },
    [resetPreview]
  );

  const aiCanRun = useMemo(() => {
    return Boolean(problemText.trim() || extraDescription.trim() || images.length > 0);
  }, [problemText, extraDescription, images.length]);

  const handleGenerateTikz = useCallback(async () => {
    if (!aiCanRun || aiLoading) return;

    setAiLoading(true);
    setAiError('');
    resetPreview();

    try {
      const res = await generateTikzFromDescriptionAndImages({
        problemText,
        extraDescription,
        // ✅ multi images + base64 normalized
        images: images
          .map((img) => ({
            mimeType: img.mimeType,
            dataBase64: dataUrlToBase64(img.dataUrl),
          }))
          .filter((x) => Boolean(x.dataBase64)),
      });

      setRawModelText(res.raw || '');
      setOutput(res.tikz || '');
    } catch (err: any) {
      setAiError(err?.message || 'Nhận diện thất bại (không rõ lỗi).');
    } finally {
      setAiLoading(false);
    }
  }, [aiCanRun, aiLoading, resetPreview, problemText, extraDescription, images]);

  const handleCopy = useCallback(async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = output;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }, [output]);

  const handlePreview = useCallback(async () => {
    if (!output.trim()) return;

    setPreviewLoading(true);
    setPreviewError('');
    setShowPreview(false);

    cleanupPreviewUrl();
    setPreviewUrl('');

    try {
      const tikzCode = extractTikzCode(output) || output;
      const result = await compileTikzToImage(tikzCode);

      if (!result.success || !result.image) {
        setPreviewError(result.error || 'Compile thất bại — không có dữ liệu ảnh trả về.');
        setShowPreview(false);
        return;
      }

      // base64 png -> blob url
      try {
        const byteChars = atob(result.image);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
        const blob = new Blob([new Uint8Array(byteNumbers)], { type: 'image/png' });
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setShowPreview(true);
      } catch {
        setPreviewUrl(`data:image/png;base64,${result.image}`);
        setShowPreview(true);
      }
    } catch (e: any) {
      setPreviewError(`Lỗi kết nối: ${e?.message || 'Không rõ'}`);
      setShowPreview(false);
    } finally {
      setPreviewLoading(false);
    }
  }, [output, cleanupPreviewUrl]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* LEFT */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
        <div className="font-extrabold text-slate-800 flex items-center gap-2">
          <ImagePlus className="text-teal-600" size={18} />
          Vẽ TikZ từ mô tả / ảnh (AI)
        </div>

        <div className="space-y-2" onPaste={onPaste}>
          <label className="block text-xs font-semibold text-slate-500">
            Mô tả đề bài (có thể rỗng nếu chỉ dùng ảnh)
          </label>
          <textarea
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
            className="w-full h-[140px] p-3 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none bg-slate-50"
            placeholder="Ví dụ: Cho tam giác ABC vuông tại A, AB=3, AC=4. Vẽ đường cao AH..."
          />

          <label className="block text-xs font-semibold text-slate-500">
            Mô tả thêm (khi upload hình vẽ, muốn nhấn mạnh chi tiết)
          </label>
          <textarea
            value={extraDescription}
            onChange={(e) => setExtraDescription(e.target.value)}
            className="w-full h-[90px] p-3 rounded-xl border border-slate-300 text-sm outline-none focus:ring-2 focus:ring-teal-500 resize-none bg-slate-50"
            placeholder="Ví dụ: đặt A bên trái, B bên phải; ký hiệu góc vuông tại A; ghi AB, AC..."
          />

          <div className="flex flex-wrap gap-2 pt-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleAddFiles(e.target.files)}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center gap-2"
            >
              <ImagePlus size={16} />
              Tải ảnh
            </button>

            <button
              onClick={() => {
                // UX hint; paste handled by onPaste
              }}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center gap-2"
              title="Dán ảnh bằng Ctrl+V vào vùng này"
            >
              <ClipboardPaste size={16} />
              Dán ảnh (Ctrl+V)
            </button>

            <button
              onClick={handleGenerateTikz}
              disabled={!aiCanRun || aiLoading}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm flex items-center gap-2 disabled:opacity-50"
            >
              {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
              Nhận diện → TikZ
            </button>

            <button
              onClick={resetAll}
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm flex items-center gap-2"
            >
              <RotateCcw size={16} />
              Reset
            </button>
          </div>

          <p className="text-xs text-slate-400">
            Có thể upload ảnh đề bài hoặc ảnh hình vẽ. Hỗ trợ tối đa 6 ảnh.
          </p>
        </div>

        {/* IMAGES */}
        {images.length > 0 && (
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
            <div className="text-xs font-semibold text-slate-500 mb-2">
              Ảnh đã chọn ({images.length}/6)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {images.map((img) => (
                <div key={img.id} className="relative group">
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    className="w-full h-28 object-cover rounded-lg border border-slate-200 bg-white"
                  />
                  <button
                    onClick={() => removeImage(img.id)}
                    className="absolute top-2 right-2 p-1 rounded-lg bg-white/90 border border-slate-200 shadow-sm opacity-0 group-hover:opacity-100 transition"
                    title="Xóa ảnh"
                  >
                    <X size={14} className="text-slate-700" />
                  </button>
                  <div className="mt-1 text-[11px] text-slate-500 truncate">{img.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI ERROR */}
        {aiError && (
          <div className="border border-red-200 rounded-xl p-3 bg-red-50">
            <div className="text-xs font-semibold text-red-600 mb-1">❌ Lỗi AI:</div>
            <pre className="text-xs text-red-800 whitespace-pre-wrap font-mono">{aiError}</pre>
          </div>
        )}
      </div>

      {/* RIGHT */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="font-extrabold text-slate-800 flex items-center gap-2">
          <Wand2 className="text-teal-600" size={18} />
          Kết quả TikZ (AI)
        </div>

        <textarea
          value={output}
          onChange={(e) => {
            setOutput(e.target.value);
            resetPreview();
          }}
          className="w-full h-[320px] p-3 rounded-xl border border-slate-300 font-mono text-xs outline-none focus:ring-2 focus:ring-teal-500 resize-none bg-slate-50"
          placeholder="AI sẽ trả về khối \\begin{tikzpicture}...\\end{tikzpicture} ở đây."
        />

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopy}
            disabled={!output}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-sm text-slate-700 flex items-center gap-2 disabled:opacity-50"
          >
            {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
            {copied ? 'Đã copy!' : 'Copy'}
          </button>

          <button
            onClick={handlePreview}
            disabled={!output || previewLoading}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-sm text-slate-700 flex items-center gap-2 disabled:opacity-50"
          >
            {previewLoading ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
            Xem trước (PNG)
          </button>

          <button
            onClick={() => onTransferToCompile(output)}
            disabled={!output}
            className="px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <ArrowRight size={14} />
            Chuyển qua Biên dịch
          </button>
        </div>

        {/* PREVIEW ERROR */}
        {previewError && (
          <div className="border border-red-200 rounded-xl p-3 bg-red-50">
            <div className="text-xs font-semibold text-red-600 mb-1">❌ Lỗi compile TikZ:</div>
            <pre className="text-xs text-red-800 whitespace-pre-wrap max-h-[200px] overflow-auto font-mono">
              {previewError}
            </pre>
          </div>
        )}

        {/* PREVIEW IMG */}
        {showPreview && previewUrl && (
          <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
            <div className="text-xs font-semibold text-slate-500 mb-2">Xem trước:</div>
            <div className="flex justify-center">
              <img
                src={previewUrl}
                alt="TikZ Preview"
                className="max-w-full max-h-[300px] object-contain rounded-lg"
                style={{
                  background:
                    'repeating-conic-gradient(#e2e8f0 0% 25%, transparent 0% 50%) 50% / 16px 16px',
                }}
                onError={() => {
                  setPreviewError(
                    'Không thể hiển thị ảnh. Thử chuyển qua tab Biên dịch LaTeX để compile PDF.'
                  );
                  setShowPreview(false);
                }}
              />
            </div>
          </div>
        )}

        {/* RAW MODEL OUTPUT */}
        {rawModelText && (
          <details className="border border-slate-200 rounded-xl p-3 bg-white">
            <summary className="text-xs font-bold text-slate-600 cursor-pointer">
              Debug: Raw text từ AI
            </summary>
            <pre className="mt-2 text-xs text-slate-700 whitespace-pre-wrap max-h-[220px] overflow-auto font-mono">
              {rawModelText}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
};

export default TikzVisionView;
