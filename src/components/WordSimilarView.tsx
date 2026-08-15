import { useState } from 'react';
import { Copy, Wand2, Download, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { generateSimilarWord } from '../services/wordAiService';
// Tái sử dụng hàm tải file Word thầy đã tạo ở phần trước
// import { convertMarkdownToDocx, downloadBlob, jsonToMarkdown } from '../services/wordService';

export default function WordSimilarView() {
  const [originalText, setOriginalText] = useState('');
  const [similarText, setSimilarText] = useState('');
  const [withAnswers, setWithAnswers] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!originalText.trim() || originalText.length < 20) {
      toast.error('Nội dung gốc quá ngắn (cần >20 ký tự)!');
      return;
    }

    setIsGenerating(true);
    const toastId = toast.loading('Đang tạo bài tập tương tự...');

    try {
      const result = await generateSimilarWord(originalText, withAnswers);
      setSimilarText(result);
      toast.success('Thành công!', { id: toastId });
    } catch (error: any) {
      toast.error(`Lỗi: ${error.message}`, { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadTxt = () => {
    if (!similarText) return;

    const blob = new Blob([similarText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `Bai_Tuong_Tu_${Date.now()}.txt`;
    a.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      <div className="bg-orange-50 border border-orange-200 p-4 rounded-2xl flex flex-wrap gap-4 items-center justify-between">
        <div className="font-bold text-orange-800 flex items-center gap-2">
          <Copy size={20} /> Cấu hình Sinh Tương Tự
        </div>

        <button
          onClick={() => setWithAnswers(!withAnswers)}
          className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-colors ${
            withAnswers
              ? 'bg-green-100 text-green-700 border border-green-300'
              : 'bg-slate-200 text-slate-600 border border-slate-300'
          }`}
        >
          {withAnswers ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {withAnswers ? 'Kèm Lời Giải & Đáp Án' : 'Chỉ Đề Bài Trắc Nghiệm'}
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="flex flex-col border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-slate-100 p-3 font-bold text-slate-700 border-b border-slate-200 flex justify-between items-center">
            <span>Bài gốc (Dán Text/OCR vào đây)</span>
          </div>

          <textarea
            value={originalText}
            onChange={e => setOriginalText(e.target.value)}
            className="w-full h-[500px] p-4 text-sm font-mono outline-none resize-none"
            placeholder="Câu 1: Tính giới hạn..."
          />
        </div>

        <div className="flex flex-col border border-orange-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-orange-100 p-3 font-bold text-orange-800 border-b border-orange-200 flex justify-between items-center">
            <span>Kết quả tương tự</span>

            {similarText && (
              <button
                onClick={handleDownloadTxt}
                className="px-3 py-1 bg-white rounded-lg text-xs text-orange-600 shadow-sm flex items-center gap-1 hover:bg-orange-50"
              >
                <Download size={14} /> Tải TXT
              </button>
            )}
          </div>

          <textarea
            value={similarText}
            onChange={e => setSimilarText(e.target.value)}
            className="w-full h-[500px] p-4 text-sm font-mono outline-none resize-none bg-orange-50/30"
            placeholder="Chờ AI tạo bài..."
          />
        </div>
      </div>

      <div className="flex justify-center">
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold rounded-xl shadow-lg disabled:opacity-50 flex items-center gap-2"
        >
          {isGenerating ? (
            'Đang tạo...'
          ) : (
            <>
              <Wand2 size={18} /> Tạo Bài Tương Tự Mới
            </>
          )}
        </button>
      </div>
    </div>
  );
}
