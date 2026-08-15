// @ts-nocheck
import React, { useState, useRef, useCallback } from 'react';
import { ExamData, ExamPointsConfig } from '../types';
import { parseTexToExam } from '@/services/texParserService';
import { buildPointsConfigFromQuestions } from '@/services/mergeExamsService';
import PointsConfigEditor from './PointsConfigEditor';

interface TexExamCreatorProps {
  teacherId: string;
  onSave: (examData: any) => Promise<void>;
  onCancel: () => void;
}

export default function TexExamCreator({ teacherId, onSave, onCancel }: TexExamCreatorProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  
  const [examData, setExamData] = useState<ExamData | null>(null);
  const [pointsConfig, setPointsConfig] = useState<ExamPointsConfig | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file.name.endsWith('.tex')) {
      setError('Vui lòng chọn file LaTeX (.tex)');
      return;
    }
    
    setError('');
    setStep(2);
    setProgressMsg('Đang khởi tạo bộ phân tích LaTeX...');

    try {
      const fileText = await file.text();
      const parsedData = await parseTexToExam(file, setProgressMsg);
      
      if (!parsedData.questions || parsedData.questions.length === 0) {
        throw new Error('Không tìm thấy câu hỏi nào. Vui lòng kiểm tra lại cấu trúc \\begin{ex}...\\end{ex}');
      }

      parsedData.originalTex = fileText;
      setExamData(parsedData);
      const config = buildPointsConfigFromQuestions(parsedData.questions);
      setPointsConfig(config);
      setStep(3);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Có lỗi xảy ra khi đọc file LaTeX');
      setStep(1);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleSave = async () => {
    if (!examData || !pointsConfig) return;
    setIsSaving(true);
    try {
      const finalExamData = {
        title: examData.title || 'Đề thi LaTeX',
        description: 'Tạo tự động từ file LaTeX',
        timeLimit: 90,
        questions: examData.questions,
        sections: examData.sections,
        answers: examData.answers,
        images: examData.images, 
        pointsConfig: pointsConfig,
        originalTex: examData.originalTex,
        createdBy: teacherId
      };
      await onSave(finalExamData);
    } catch (err) {
      console.error(err);
      alert('Có lỗi khi lưu đề. Vui lòng thử lại.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-lg border border-teal-100">
      <div className="flex items-center gap-2 mb-8 border-b pb-4">
        {[
          { s: 1, label: 'Tải file .TEX' },
          { s: 2, label: 'Phân tích & Biên dịch' },
          { s: 3, label: 'Cấu hình điểm' },
          { s: 4, label: 'Lưu đề' }
        ].map(({ s, label }) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition
              ${step === s ? 'bg-teal-600 text-white shadow-md' : step > s ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-400'}`}>
              <span>{step > s ? '✓' : s}</span>
              <span className="hidden sm:inline">{label}</span>
            </div>
            {s < 4 && <div className="flex-1 h-0.5 bg-gray-200 rounded" />}
          </React.Fragment>
        ))}
      </div>

      {step === 1 && (
        <div className="text-center py-8">
          <h2 className="text-2xl font-extrabold text-gray-800 mb-2">Tạo đề thi từ mã nguồn LaTeX</h2>
          <p className="text-gray-500 mb-8">Hệ thống sẽ tự động đọc câu hỏi, đáp án và biên dịch hình ảnh TikZ</p>
          
          <div onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-teal-300 bg-teal-50/50 rounded-2xl p-12 cursor-pointer hover:bg-teal-50 transition-all group">
            <input ref={fileInputRef} type="file" accept=".tex" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
            <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">📄</div>
            <p className="font-bold text-teal-700 text-lg">Kéo thả file .TEX vào đây</p>
            <p className="text-sm text-teal-600/70 mt-1">Hoặc nhấn để chọn file từ máy tính</p>
          </div>
          {error && <p className="mt-4 text-red-600 font-semibold bg-red-50 p-3 rounded-lg border border-red-200">⚠️ {error}</p>}
        </div>
      )}

      {step === 2 && (
        <div className="text-center py-16">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-teal-100 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-teal-600 rounded-full border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-2xl">⚙️</div>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Đang xử lý mã nguồn LaTeX...</h2>
          <p className="text-teal-600 font-medium animate-pulse">{progressMsg}</p>
        </div>
      )}

      {step >= 3 && examData && pointsConfig && (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-teal-900 text-lg">{examData.title}</h3>
              <p className="text-sm text-teal-700 mt-1">
                Đã phân tích thành công: <strong>{examData.questions.length}</strong> câu hỏi. 
                (Bao gồm <strong>{examData.images?.length || 0}</strong> hình ảnh/TikZ)
              </p>
            </div>
            <button onClick={() => setStep(1)} className="text-sm text-teal-600 underline hover:text-teal-800">
              Tải lại file khác
            </button>
          </div>

          <PointsConfigEditor 
            config={pointsConfig} 
            onChange={setPointsConfig} 
            closeOnSave={false} 
            isSaving={isSaving} 
          />

          <div className="flex justify-between pt-4 border-t">
            <button onClick={onCancel} className="px-6 py-2.5 border border-gray-300 rounded-xl text-gray-600 font-semibold hover:bg-gray-50">
              Hủy bỏ
            </button>
            <button onClick={handleSave} disabled={isSaving} className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 text-lg">
              {isSaving ? <span className="animate-spin">⏳</span> : '💾'} 
              {isSaving ? 'Đang lưu vào CSDL...' : 'Lưu Đề Thi'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
