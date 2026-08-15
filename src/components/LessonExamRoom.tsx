// @ts-nocheck
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import MathText from '@/components/MathText';
import { parseTFAnswer, serializeTFAnswer } from './ExamRoom';
import { Check as CheckIcon, X as XIcon } from 'lucide-react';

interface LessonExamRoomProps {
  examId: string;
  studentName: string;
  onSubmitted: (percentage: number, scoreBreakdown: any) => void;
  onExit: () => void;
}

export default function LessonExamRoom({ examId, studentName, onSubmitted, onExit }: LessonExamRoomProps) {
  const [exam, setExam] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(45 * 60); // Mặc định 45 phút
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const fetchExam = async () => {
      try {
        const { data, error } = await supabase.from('exams').select('data, title').eq('id', examId).single();
        if (error) throw error;
        setExam({ ...data.data, title: data.title });
        if (data.data.timeLimit) setTimeLeft(data.data.timeLimit * 60);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchExam();
  }, [examId]);

  // Đếm ngược thời gian
  useEffect(() => {
    if (loading || !exam) return;
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); handleSubmit(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, exam]);

  const handleAnswer = (qNum: number, ans: string) => setAnswers(prev => ({ ...prev, [qNum]: ans }));

  // CHẤM ĐIỂM TRỰC TIẾP
  const handleSubmit = () => {
    let mcTotal = 0, mcCorrect = 0, tfTotal = 0, tfCorrect = 0, saTotal = 0, saCorrect = 0;

    exam.questions.forEach((q: any) => {
      const uAns = answers[q.number];
      if (q.type === 'multiple_choice') {
        mcTotal++; if (uAns && q.correctAnswer && uAns.toUpperCase() === q.correctAnswer.toUpperCase()) mcCorrect++;
      } else if (q.type === 'true_false') {
        tfTotal++;
        if (uAns && q.correctAnswer) {
          const cArr = q.correctAnswer.toLowerCase().split(',').filter(Boolean);
          const uMap = parseTFAnswer(uAns);
          let correctParts = 0;
          q.options?.forEach((opt: any) => {
            const letter = opt.letter.toLowerCase();
            const isTrue = cArr.includes(letter);
            const choseTrue = uMap[letter] === 'T';
            if (choseTrue === isTrue && uMap[letter] !== undefined) correctParts++;
          });
          if (correctParts === 4) tfCorrect++;
        }
      } else if (q.type === 'short_answer') {
        saTotal++; if (uAns && q.correctAnswer && String(uAns).trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()) saCorrect++;
      }
    });

    const totalCorrect = mcCorrect + tfCorrect + saCorrect;
    const totalQ = mcTotal + tfTotal + saTotal;
    const percentage = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;

    onSubmitted(percentage, { mcCorrect, tfCorrect, saCorrect, totalCorrect, totalQ });
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = exam?.questions?.length || 0;

  if (loading) return <div className="h-full flex items-center justify-center bg-gray-50">⏳ Đang tải bài tập...</div>;
  if (!exam) return <div className="h-full flex items-center justify-center text-red-500 bg-gray-50">❌ Không tìm thấy dữ liệu bài tập</div>;

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* HEADER PHÒNG THI ẢO */}
      <div className="bg-teal-700 text-white p-4 flex justify-between items-center shadow-md">
        <div>
          <h2 className="font-bold text-lg">{exam.title}</h2>
          <p className="text-xs text-teal-100">Bài tập Luyện tập • Học sinh: {studentName}</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center bg-teal-800 px-4 py-1 rounded-lg border border-teal-600">
            <p className="text-[10px] text-teal-200 uppercase">Còn lại</p>
            <p className="font-mono font-bold text-xl">
              {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </p>
          </div>
          <button onClick={onExit} className="bg-gray-500 hover:bg-gray-600 px-4 py-2 rounded-xl font-bold transition shadow-md">
            Thoát
          </button>
          <button onClick={() => setShowConfirm(true)} className="bg-orange-500 hover:bg-orange-600 px-6 py-2 rounded-xl font-bold transition shadow-lg">
            Nộp bài
          </button>
        </div>
      </div>

      {/* DANH SÁCH CÂU HỎI */}
      <div className="flex-1 overflow-y-auto p-4 max-w-4xl mx-auto w-full space-y-6 custom-scrollbar">
        {exam.questions.map((q: any, i: number) => {
          const displayNum = i + 1;
          const uAns = answers[q.number];
          
          return (
            <div key={q.number} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex gap-3 mb-4 border-b pb-3">
                <div className="w-8 h-8 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold">{displayNum}</div>
                <div className="flex-1 pt-1"><MathText html={q.text} block /></div>
              </div>

              {q.type === 'multiple_choice' && (
                <div className="grid grid-cols-2 gap-3 pl-11">
                  {q.options?.map((opt: any) => (
                    <label key={opt.letter} className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition ${uAns === opt.letter ? 'border-teal-500 bg-teal-50' : 'border-gray-100'}`}>
                      <input type="radio" name={`q${q.number}`} value={opt.letter} checked={uAns === opt.letter} onChange={e => handleAnswer(q.number, e.target.value)} className="hidden" />
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${uAns === opt.letter ? 'bg-teal-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{opt.letter}</span>
                      <MathText html={opt.text} />
                    </label>
                  ))}
                </div>
              )}

              {/* Các câu Đúng / Sai */}
              {q.type === 'true_false' && (
                <div className="pl-11">
                  <TrueFalseGrid options={q.options || []} userAnswer={uAns} onChange={val => handleAnswer(q.number, val)} />
                </div>
              )}

              {/* Các câu Trả lời ngắn */}
              {q.type === 'short_answer' && (
                <div className="pl-11">
                  <input type="text" value={uAns || ''} onChange={e => handleAnswer(q.number, e.target.value)} placeholder="Nhập đáp án..." className="w-full max-w-sm p-3 border-2 border-gray-200 rounded-xl outline-none focus:border-teal-500" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* CONFIRM MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl">
            <h3 className="text-xl font-bold mb-2">Xác nhận nộp bài?</h3>
            <p className="text-gray-600 mb-6">Đã làm: {answeredCount}/{totalQuestions} câu</p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="flex-1 py-3 rounded-xl border border-gray-300 font-semibold hover:bg-gray-50">Làm tiếp</button>
              <button onClick={handleSubmit} className="flex-1 py-3 rounded-xl font-bold text-white bg-teal-600 hover:bg-teal-700">Nộp luôn</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Bảng Đúng/Sai cực kỳ trực quan
const TrueFalseGrid: React.FC<any> = ({ options, userAnswer, onChange }) => {
  const tfMap = useMemo(() => parseTFAnswer(userAnswer), [userAnswer]);
  
  const handleSelect = (letter: string, val: 'T' | 'F') => {
    const current = { ...tfMap }; const key = letter.toLowerCase();
    if (current[key] === val) delete current[key]; else current[key] = val;
    onChange(serializeTFAnswer(current));
  };

  return (
    <div className="rounded-xl border-2 border-teal-600 overflow-hidden shadow-sm mt-3">
      {/* HEADER BẢNG */}
      <div className="grid grid-cols-[1fr_70px_70px] sm:grid-cols-[1fr_90px_90px] bg-teal-600 text-xs font-black text-white uppercase divide-x-2 divide-teal-500 border-b-2 border-teal-600">
        <div className="px-4 py-3 flex items-center bg-teal-600">Mệnh đề</div>
        <div className="py-3 flex items-center justify-center gap-1 bg-teal-600"><CheckIcon className="w-4 h-4"/> Đúng</div>
        <div className="py-3 flex items-center justify-center gap-1 bg-teal-600"><XIcon className="w-4 h-4"/> Sai</div>
      </div>
      
      {/* CÁC DÒNG MỆNH ĐỀ */}
      <div className="divide-y-2 divide-teal-100">
        {options.map((opt: any, idx: number) => {
          const displayLetter = String.fromCharCode(97 + idx); // a, b, c, d
          const cVal = tfMap[opt.letter.toLowerCase()];
          
          return (
            <div key={opt.letter} className="grid grid-cols-[1fr_70px_70px] sm:grid-cols-[1fr_90px_90px] bg-white divide-x-2 divide-teal-100 hover:bg-teal-50/30 transition-colors">
              
              <div className="px-4 py-4 flex gap-3 items-start">
                <span className="w-7 h-7 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center text-[13px] font-black shrink-0 shadow-sm border border-teal-100">
                  {displayLetter}
                </span>
                <MathText html={opt.text || ''} className="flex-1 text-[15px] pt-0.5 text-gray-800" />
              </div>

              {/* NÚT ĐÚNG */}
              <button 
                onClick={() => handleSelect(opt.letter, 'T')} 
                className={`flex items-center justify-center transition-all outline-none hover:bg-emerald-50 ${cVal === 'T' ? 'bg-emerald-500 text-white shadow-inner' : 'text-gray-300'}`}
              >
                {cVal === 'T' ? <CheckIcon className="w-6 h-6 stroke-[3]" /> : ''}
              </button>

              {/* NÚT SAI */}
              <button 
                onClick={() => handleSelect(opt.letter, 'F')} 
                className={`flex items-center justify-center transition-all outline-none hover:bg-red-50 ${cVal === 'F' ? 'bg-red-500 text-white shadow-inner' : 'text-gray-300'}`}
              >
                {cVal === 'F' ? <XIcon className="w-6 h-6 stroke-[3]" /> : ''}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
