import { useState } from 'react';
import {
  Calculator,
  Upload,
  Book,
  Image as ImageIcon,
  Settings2,
  Code,
  LayoutTemplate,
  Loader2,
  Sparkles
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  fileToBase64Obj,
  solveMathTeacherStyle,
  SolveConfig
} from '../services/wordAiService';

export default function WordSolveView() {
  const [problemText, setProblemText] = useState('');
  const [knowledgeText, setKnowledgeText] = useState('');
  const [problemImages, setProblemImages] = useState<File[]>([]);
  const [knowledgeImages, setKnowledgeImages] = useState<File[]>([]);

  const [config, setConfig] = useState<SolveConfig>({
    model: 'gemini-2.5-flash',
    level: 'highschool',
    language: 'vi'
  });

  const [isSolving, setIsSolving] = useState(false);
  const [result, setResult] = useState('');
  const [viewMode, setViewMode] = useState<'raw' | 'preview'>('raw');

  const handleSolve = async () => {
    if (!problemText.trim() && problemImages.length === 0) {
      toast.error('Vui lòng nhập đề bài hoặc tải ảnh lên!');
      return;
    }

    setIsSolving(true);
    const toastId = toast.loading('AI đang phân tích và giải toán...');

    try {
      const pImages = await Promise.all(problemImages.map(fileToBase64Obj));
      const kImages = await Promise.all(knowledgeImages.map(fileToBase64Obj));

      const solution = await solveMathTeacherStyle(
        problemText,
        pImages,
        knowledgeText,
        kImages,
        config
      );

      setResult(solution);
      toast.success('Giải toán thành công!', { id: toastId });
    } catch (error: any) {
      toast.error(`Lỗi: ${error.message}`, { id: toastId });
    } finally {
      setIsSolving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Tiêu đề riêng của tab Giải toán */}
      <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-white via-teal-50/60 to-cyan-50 p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-md shadow-teal-600/20">
            <Calculator className="h-6 w-6" />
          </div>

          <div>
            <h2 className="text-xl font-extrabold text-teal-950">
              Giải toán AI
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Nhập đề bài, tải ảnh đề hoặc thêm lý thuyết để AI giải theo phong cách giáo viên.
            </p>
          </div>
        </div>
      </div>

      {/* Cấu hình */}
      <div className="rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-2 font-bold text-teal-800">
            <Settings2 size={18} />
            Cấu hình giải
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <select
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              className="rounded-xl border border-teal-100 bg-teal-50/40 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-teal-400"
            >
              <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
              <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
              <option value="gemini-3.1-flash-lite-preview">Gemini 3.1 Lite</option>
            </select>

            <select
              value={config.level}
              onChange={(e) => setConfig({ ...config, level: e.target.value })}
              className="rounded-xl border border-teal-100 bg-teal-50/40 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-teal-400"
            >
              <option value="primary">Tiểu học</option>
              <option value="secondary">THCS</option>
              <option value="highschool">THPT</option>
              <option value="university">Đại học</option>
            </select>

            <select
              value={config.language}
              onChange={(e) => setConfig({ ...config, language: e.target.value })}
              className="rounded-xl border border-teal-100 bg-teal-50/40 px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-teal-400"
            >
              <option value="vi">Tiếng Việt</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-teal-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 font-extrabold text-teal-800">
            <Calculator size={18} />
            Đề bài
          </h3>

          <textarea
            className="mb-3 h-40 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-teal-400"
            placeholder="Nhập nội dung đề bài vào đây..."
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
          />

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-teal-200 bg-teal-50/40 p-3 text-sm font-bold text-teal-700 transition hover:bg-teal-50">
            <Upload size={16} />
            Tải ảnh đề bài lên ({problemImages.length})
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => setProblemImages(Array.from(e.target.files || []))}
            />
          </label>
        </div>

        <div className="rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 font-extrabold text-cyan-800">
            <Book size={18} />
            Lý thuyết bổ sung
          </h3>

          <textarea
            className="mb-3 h-40 w-full resize-none rounded-xl border border-slate-200 p-3 text-sm outline-none focus:ring-2 focus:ring-cyan-400"
            placeholder="Dán công thức, lý thuyết SGK hoặc yêu cầu cách trình bày..."
            value={knowledgeText}
            onChange={(e) => setKnowledgeText(e.target.value)}
          />

          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-cyan-200 bg-cyan-50/40 p-3 text-sm font-bold text-cyan-700 transition hover:bg-cyan-50">
            <ImageIcon size={16} />
            Tải ảnh SGK lên ({knowledgeImages.length})
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => setKnowledgeImages(Array.from(e.target.files || []))}
            />
          </label>
        </div>
      </div>

      {/* Nút giải */}
      <div className="flex justify-center">
        <button
          onClick={handleSolve}
          disabled={isSolving}
          className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 px-8 py-3 text-sm font-extrabold text-white shadow-lg shadow-teal-600/20 transition hover:from-teal-700 hover:to-cyan-700 disabled:opacity-50"
        >
          {isSolving ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Đang giải...
            </>
          ) : (
            <>
              <Sparkles size={18} />
              Giải Toán Ngay
            </>
          )}
        </button>
      </div>

      {/* Kết quả */}
      {result && (
        <div className="overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-teal-100 bg-teal-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-extrabold text-teal-900">Kết quả</span>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('raw')}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
                  viewMode === 'raw'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-slate-600 hover:text-teal-700'
                }`}
              >
                <Code size={14} />
                Raw Text
              </button>

              <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold ${
                  viewMode === 'preview'
                    ? 'bg-teal-600 text-white'
                    : 'bg-white text-slate-600 hover:text-teal-700'
                }`}
              >
                <LayoutTemplate size={14} />
                Xem trước
              </button>
            </div>
          </div>

          <div className="p-4">
            {viewMode === 'raw' ? (
              <textarea
                value={result}
                readOnly
                className="h-72 w-full resize-none rounded-xl border border-slate-100 bg-slate-50 p-3 font-mono text-sm outline-none"
              />
            ) : (
              <div className="h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-100 bg-white p-4 text-sm leading-relaxed text-slate-700">
                {result}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
