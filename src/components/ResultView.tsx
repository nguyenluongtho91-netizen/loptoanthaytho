// @ts-nocheck
import React from 'react';
import { Submission, Room, Exam, Question, QuestionOption } from '../types';
import MathText from './MathText';
import { formatScore } from '../services/scoringService';

interface ResultViewProps {
  submission: Submission;
  room: Room;
  exam?: Exam;
  showAnswers?: boolean;
  onExit: () => void;
  onRetry?: () => void;
}

const escapeHtml = (s: string) =>
  (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// ✅ Helper: lấy TF details theo cả number và string key
function getTFDetail(
  scoreBreakdown: any,
  qNumber: number
): { correctCount: number; points: number; answeredCount?: number; totalStatements?: number } | undefined {
  const details = scoreBreakdown?.trueFalse?.details;
  if (!details) return undefined;
  return details[qNumber] ?? details[String(qNumber)];
}

// ✅ Helper: lấy answer theo cả number và string key
function getAnswer(answers: Record<string, string> | undefined, qNumber: number): string | undefined {
  if (!answers) return undefined;
  return answers[qNumber] ?? answers[String(qNumber)];
}

const ResultView: React.FC<ResultViewProps> = ({
  submission,
  room,
  exam,
  onExit,
  onRetry
}) => {
  // ✅ FIX BUG 1+3: Supabase trả về score_breakdown (snake_case), phải fallback
  const scoreBreakdown = submission.scoreBreakdown || (submission as any).score_breakdown;
  const answers = submission.answers;

  const canShowCorrectAnswers = room.settings?.showCorrectAnswers ?? false;
  const canShowExplanations = room.settings?.showExplanations ?? false;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} phút ${secs} giây`;
  };

  const getGrade = (percentage: number) => {
    if (percentage >= 90) return { grade: 'A+', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-300', emoji: '🏆', label: 'Xuất sắc' };
    if (percentage >= 80) return { grade: 'A', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-300', emoji: '🌟', label: 'Giỏi' };
    if (percentage >= 70) return { grade: 'B+', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-300', emoji: '👍', label: 'Khá' };
    if (percentage >= 60) return { grade: 'B', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-300', emoji: '📚', label: 'Trung bình khá' };
    if (percentage >= 50) return { grade: 'C', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-300', emoji: '💪', label: 'Trung bình' };
    if (percentage >= 40) return { grade: 'D', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-300', emoji: '📖', label: 'Yếu' };
    return { grade: 'F', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-300', emoji: '😞', label: 'Kém' };
  };

  const gradeInfo = getGrade(submission.percentage);
  const maxScore = exam?.pointsConfig?.maxScore || 10;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)' }}>
      {submission.percentage >= 80 && (
        <style>{`
          @keyframes confetti {
            0% { transform: translateY(0) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
          .confetti { position: fixed; top: -10px; animation: confetti 3s ease-in-out forwards; }
        `}</style>
      )}
      {submission.percentage >= 80 && (
        <>
          {[...Array(20)].map((_, i) => (
            <div key={i} className="confetti text-2xl" style={{ left: `${Math.random() * 100}%`, animationDelay: `${Math.random() * 2}s` }}>
              {['🎉', '⭐', '🌟', '✨', '🎊'][Math.floor(Math.random() * 5)]}
            </div>
          ))}
        </>
      )}

      {/* Header */}
      <div className="text-white p-6" style={{ background: 'linear-gradient(135deg, #0d9488 0%, #115e59 100%)' }}>
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl font-bold mb-2">🎉 Đã nộp bài thành công!</h1>
          <p className="text-teal-100">{room.examTitle}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {/* Điểm + Xếp loại */}
        <div className="bg-white rounded-3xl shadow-2xl p-8 mb-8">
          <div className="text-center mb-6">
            <div className={`w-32 h-32 ${gradeInfo.bg} border-4 ${gradeInfo.border} rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg`}>
              <div>
                <div className="text-4xl mb-1">{gradeInfo.emoji}</div>
                <div className={`text-3xl font-black ${gradeInfo.color}`}>{gradeInfo.grade}</div>
              </div>
            </div>
            <div className={`inline-block px-4 py-2 rounded-full ${gradeInfo.bg} border ${gradeInfo.border} ${gradeInfo.color} font-bold`}>
              {gradeInfo.label}
            </div>
          </div>

          <div className="text-center mb-8">
            <div className="text-6xl font-black mb-2">
              <span className="text-teal-600">{formatScore(submission.totalScore)}</span>
              <span className="text-gray-300 text-4xl">/{maxScore}</span>
            </div>
            <div className="text-2xl font-bold text-gray-400">{submission.percentage}%</div>
          </div>

          {/* ✅ FIX: dùng scoreBreakdown đã được map đúng */}
          {scoreBreakdown && (
            <div className="mb-8">
              <h3 className="text-center text-base font-bold text-gray-600 mb-4 uppercase tracking-wide">📊 Điểm chi tiết theo phần</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {scoreBreakdown.multipleChoice?.total > 0 && (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 border-2 border-blue-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">🔘</span>
                      <span className="font-bold text-blue-900 text-sm">Trắc nghiệm</span>
                    </div>
                    <div className="text-2xl font-black text-blue-600 mb-1">
                      {formatScore(scoreBreakdown.multipleChoice.points)}
                      <span className="text-sm font-normal text-blue-400">đ</span>
                    </div>
                    <div className="text-sm text-blue-700">
                      Đúng {scoreBreakdown.multipleChoice.correct}/{scoreBreakdown.multipleChoice.total}
                    </div>
                    {scoreBreakdown.multipleChoice.pointsPerQuestion > 0 && (
                      <div className="text-xs text-blue-500 mt-1">({formatScore(scoreBreakdown.multipleChoice.pointsPerQuestion)}đ/câu)</div>
                    )}
                  </div>
                )}

                {scoreBreakdown.trueFalse?.total > 0 && (
                  <div className="bg-gradient-to-br from-teal-50 to-emerald-100 rounded-2xl p-4 border-2 border-teal-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">✅</span>
                      <span className="font-bold text-teal-900 text-sm">Đúng / Sai</span>
                    </div>
                    <div className="text-2xl font-black text-teal-600 mb-1">
                      {formatScore(scoreBreakdown.trueFalse.points)}
                      <span className="text-sm font-normal text-teal-400">đ</span>
                    </div>
                    <div className="text-sm text-teal-700">
                      Đúng hoàn toàn: {scoreBreakdown.trueFalse.correct}/{scoreBreakdown.trueFalse.total}
                      {scoreBreakdown.trueFalse.partial > 0 && (
                        <span className="text-yellow-600"> · +{scoreBreakdown.trueFalse.partial} phần</span>
                      )}
                    </div>
                    {scoreBreakdown.trueFalse.pointsPerQuestion > 0 && (
                      <div className="text-xs text-teal-500 mt-1">({formatScore(scoreBreakdown.trueFalse.pointsPerQuestion)}đ/câu)</div>
                    )}
                  </div>
                )}

                {scoreBreakdown.shortAnswer?.total > 0 && (
                  <div className="bg-gradient-to-br from-orange-50 to-amber-100 rounded-2xl p-4 border-2 border-orange-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">✏️</span>
                      <span className="font-bold text-orange-900 text-sm">Trả lời ngắn</span>
                    </div>
                    <div className="text-2xl font-black text-orange-600 mb-1">
                      {formatScore(scoreBreakdown.shortAnswer.points)}
                      <span className="text-sm font-normal text-orange-400">đ</span>
                    </div>
                    <div className="text-sm text-orange-700">
                      Đúng {scoreBreakdown.shortAnswer.correct}/{scoreBreakdown.shortAnswer.total}
                    </div>
                    {scoreBreakdown.shortAnswer.pointsPerQuestion > 0 && (
                      <div className="text-xs text-orange-500 mt-1">({formatScore(scoreBreakdown.shortAnswer.pointsPerQuestion)}đ/câu)</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
              <div className="text-3xl font-black text-emerald-600">{submission.correctCount}</div>
              <div className="text-xs font-semibold text-emerald-700 mt-1">Câu đúng</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center">
              <div className="text-3xl font-black text-red-500">{submission.wrongCount}</div>
              <div className="text-xs font-semibold text-red-600 mt-1">Câu sai</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
              <div className="text-3xl font-black text-blue-500">{Math.floor((submission.duration || 0) / 60)}</div>
              <div className="text-xs font-semibold text-blue-600 mt-1">Phút làm bài</div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-6 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex gap-2">
                <span className="text-gray-400">👤 Họ tên:</span>
                <span className="font-semibold text-gray-700">{submission.student.name}</span>
              </div>
              {submission.student.className && (
                <div className="flex gap-2">
                  <span className="text-gray-400">🏫 Lớp:</span>
                  <span className="font-semibold text-gray-700">{submission.student.className}</span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-gray-400">🔑 Mã phòng:</span>
                <span className="font-mono font-bold text-teal-600">{submission.roomCode}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-gray-400">⏱ Thời gian:</span>
                <span className="font-semibold text-gray-700">{formatDuration(submission.duration || 0)}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 justify-center">
            <button onClick={onExit} className="px-8 py-3 rounded-xl font-semibold text-teal-600 border-2 border-teal-300 hover:bg-teal-50 transition">
              ← Về trang chủ
            </button>
            {onRetry && (
              <button onClick={onRetry} className="px-8 py-3 rounded-xl font-bold text-white transition" style={{ background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}>
                🔄 Làm lại
              </button>
            )}
          </div>
        </div>

        {/* ✅ FIX: Link xem lại đề thi PDF */}
        {(submission as any).examPdfUrl && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
            <span className="text-2xl">📄</span>
            <div>
              <p className="font-bold text-blue-800 mb-1">Xem lại đề thi</p>
              <a href={(submission as any).examPdfUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition">
                📎 Mở đề thi ↗
              </a>
            </div>
          </div>
        )}

        {/* Xem lại bài làm */}
        {exam && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="p-4 text-white font-bold" style={{ background: 'linear-gradient(135deg, #f97316 0%, #c2410c 100%)' }}>
              📋 Xem lại bài làm
            </div>

            <div className="divide-y divide-gray-100">
              {(!canShowCorrectAnswers || !canShowExplanations) && (
                <div className="p-4 bg-yellow-50 border-l-4 border-yellow-500">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">ℹ️</span>
                    <div>
                      <p className="font-semibold text-yellow-800 text-sm">Thông báo:</p>
                      <ul className="text-sm text-yellow-700 mt-1 list-disc list-inside">
                        {!canShowCorrectAnswers && <li>Không được phép xem đáp án đúng</li>}
                        {!canShowExplanations && <li>Không được phép xem lời giải chi tiết</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {exam.questions.map((q: Question) => {
                // ✅ FIX: robust answer lookup với cả number và string key
                const userAnswer = getAnswer(answers, q.number);
                const correctAnswer = q.correctAnswer || '';

                if (q.type === 'true_false') {
                  // ✅ FIX: truyền đúng breakdown với string key fallback
                  const detail = getTFDetail(scoreBreakdown, q.number);
                  return (
                    <TrueFalseReview
                      key={q.number}
                      question={q}
                      userAnswer={userAnswer}
                      correctAnswer={correctAnswer}
                      showCorrectAnswers={canShowCorrectAnswers}
                      showExplanations={canShowExplanations}
                      breakdown={detail}
                    />
                  );
                } else if (q.type === 'short_answer') {
                  return (
                    <ShortAnswerReview
                      key={q.number}
                      question={q}
                      userAnswer={userAnswer}
                      correctAnswer={correctAnswer}
                      showCorrectAnswers={canShowCorrectAnswers}
                      showExplanations={canShowExplanations}
                    />
                  );
                } else {
                  return (
                    <MultipleChoiceReview
                      key={q.number}
                      question={q}
                      userAnswer={userAnswer}
                      correctAnswer={correctAnswer}
                      showCorrectAnswers={canShowCorrectAnswers}
                      showExplanations={canShowExplanations}
                    />
                  );
                }
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ===== Review: Multiple choice =====
const MultipleChoiceReview: React.FC<{
  question: Question;
  userAnswer?: string;
  correctAnswer: string;
  showCorrectAnswers: boolean;
  showExplanations: boolean;
}> = ({ question, userAnswer, correctAnswer, showCorrectAnswers, showExplanations }) => {
  const isCorrect = !!userAnswer && userAnswer.toUpperCase() === correctAnswer?.toUpperCase();
  const isUnanswered = !userAnswer;
  const displayOptions = question.options || [];

  const statusColor = isUnanswered 
    ? 'bg-gray-50' 
    : isCorrect 
      ? 'bg-emerald-50 border-l-4 border-emerald-400' 
      : 'bg-red-50 border-l-4 border-red-400';

  return (
    <div className={`p-5 ${statusColor}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white flex-shrink-0 ${
          isUnanswered ? 'bg-slate-400' : isCorrect ? 'bg-emerald-500' : 'bg-red-500'
        }`}>
          {question.number % 100}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-gray-800 mb-3 text-[15px] leading-relaxed">
            <MathText html={question.text || ''} block />
          </div>

          {question.images?.length > 0 && (
            <div className="my-2 flex flex-wrap gap-2">
              {question.images.map((img: any, idx: number) => (
                <img key={idx} src={img.base64 ? `data:${img.contentType || 'image/png'};base64,${img.base64}` : ''} alt={`Hình ${idx + 1}`} className="max-h-32 rounded border block" />
              ))}
            </div>
          )}

          {displayOptions.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {displayOptions.map((opt: QuestionOption) => {
                const isUserAnswer = userAnswer?.toUpperCase() === opt.letter.toUpperCase();
                const isCorrectOpt = correctAnswer?.toUpperCase() === opt.letter.toUpperCase();

                let optClass = 'bg-white border-gray-200 text-gray-700';
                if (isUserAnswer) {
                  optClass = isCorrect ? 'bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold' : 'bg-red-50 border-red-400 text-red-800';
                }
                if (showCorrectAnswers && isCorrectOpt && !isUserAnswer) {
                  optClass = 'bg-emerald-50 border-emerald-500 text-emerald-800 font-semibold';
                }

                return (
                  <div key={opt.letter} className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-sm ${optClass}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isUserAnswer
                        ? isCorrect ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                        : showCorrectAnswers && isCorrectOpt ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {opt.letter}
                    </span>
                    <span className="flex-1"><MathText html={opt.text || ''} /></span>
                    {isUserAnswer && isCorrect && <span className="text-emerald-600 font-bold">✔</span>}
                    {isUserAnswer && !isCorrect && <span className="text-red-500 font-bold">✖</span>}
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <span className={`px-3 py-1 rounded-lg text-sm font-semibold ${isUnanswered ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700'}`}>
              Bạn chọn: {userAnswer || '(Chưa chọn)'}
            </span>
            {!isUnanswered && (
              <span className={`px-3 py-1 rounded-lg text-sm font-bold ${isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {isCorrect ? '✅ Chính xác!' : `❌ Không chính xác`}
              </span>
            )}
            {showCorrectAnswers && !isCorrect && !isUnanswered && (
              <span className="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg text-sm font-bold">
                Đáp án đúng: {correctAnswer}
              </span>
            )}
          </div>

          {showExplanations && question.solution && (
            <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-xl">
              <span className="text-blue-700 font-bold text-sm">💡 Lời giải: </span>
              <div className="text-sm text-gray-700 mt-1"><MathText html={question.solution} block /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ===== Review: True/False =====
const TrueFalseReview: React.FC<{
  question: Question;
  userAnswer?: string;
  correctAnswer: string;
  showCorrectAnswers: boolean;
  showExplanations: boolean;
  breakdown?: { correctCount: number; points: number; answeredCount?: number; totalStatements?: number };
}> = ({ question, userAnswer, correctAnswer, showCorrectAnswers, showExplanations, breakdown }) => {

  // ✅ FIX: Parse đáp án học sinh – hỗ trợ JSON {"a":true,"b":false} VÀ format cũ "a:T,b:F"
  let userAnswers: Record<string, string> = {};
  if (userAnswer) {
    if (userAnswer.startsWith('{')) {
      try {
        const parsed = JSON.parse(userAnswer);
        // ✅ FIX: map cả false → 'F', không bỏ qua
        Object.keys(parsed).forEach(k => {
          userAnswers[k.toLowerCase()] = parsed[k] ? 'T' : 'F';
        });
      } catch { /* ignore */ }
    } else if (userAnswer.includes(':')) {
      userAnswer.split(',').forEach(p => {
        const [l, v] = p.split(':');
        if (l && v) userAnswers[l.trim().toLowerCase()] = v.trim();
      });
    } else {
      userAnswer.split(',').forEach(s => {
        const l = s.trim().toLowerCase();
        if (l) userAnswers[l] = 'T';
      });
    }
  }

  // ✅ FIX: Parse correctAnswer – hỗ trợ JSON {"a":true,"b":false} VÀ "a,c" (comma-separated)
  let correctMap: Record<string, boolean> = {};
  try {
    const parsedCA = JSON.parse(correctAnswer || '{}');
    Object.keys(parsedCA).forEach(k => { correctMap[k.toLowerCase()] = !!parsedCA[k]; });
  } catch {
    correctAnswer.toLowerCase().split(',').map(s => s.trim()).filter(Boolean)
      .forEach(l => { correctMap[l] = true; });
  }

  // ✅ FIX: Khi options rỗng (PDF exam tạo bởi PDFExamCreator), tạo options tổng hợp a/b/c/d
  const displayOptions = (question.options && question.options.length > 0)
    ? question.options
    : ['a', 'b', 'c', 'd'].map(l => ({ letter: l, text: l.toUpperCase() }));

  // Dùng breakdown từ scoringService (đã được tính sẵn)
  const correctCount = breakdown?.correctCount ?? 0;
  const earnedPoints = breakdown?.points ?? 0;
  const totalStatements = breakdown?.totalStatements ?? (displayOptions.length ?? 4);

  const allCorrect = correctCount === totalStatements;
  const partialCorrect = correctCount > 0 && !allCorrect;

  const statusBg = allCorrect 
    ? 'bg-emerald-50 border-l-4 border-emerald-400'
    : partialCorrect 
      ? 'bg-yellow-50 border-l-4 border-yellow-400'
      : 'bg-red-50 border-l-4 border-red-400';

  return (
    <div className={`p-5 ${statusBg}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white flex-shrink-0 ${
          allCorrect ? 'bg-emerald-500' : partialCorrect ? 'bg-yellow-500' : 'bg-red-500'
        }`}>
          {question.number % 100}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-gray-800 mb-2 text-[15px] leading-relaxed">
            <MathText html={question.text || ''} block />
          </div>

          {/* Badge điểm đúng sai */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="px-2 py-1 bg-teal-100 text-teal-700 rounded-lg text-xs font-bold">
              ✅ Đúng / Sai
            </span>
            {showCorrectAnswers && (
              <>
                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                  earnedPoints > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                }`}>
                  +{formatScore(earnedPoints)}đ
                </span>
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-lg text-xs">
                  {correctCount}/{totalStatements} ý đúng
                </span>
              </>
            )}
          </div>

          {question.images?.length > 0 && (
            <div className="my-2 flex flex-wrap gap-2">
              {question.images.map((img: any, idx: number) => (
                <img key={idx} src={img.base64 ? `data:${img.contentType || 'image/png'};base64,${img.base64}` : ''} alt={`Hình ${idx + 1}`} className="max-h-32 rounded border block" />
              ))}
            </div>
          )}

          {/* ✅ Bảng đúng/sai – dùng displayOptions, correctMap, userAnswers đã fix */}
          {displayOptions.length > 0 && (
            <div className="rounded-xl border-2 border-teal-200 overflow-hidden shadow-sm">
              <div className="grid bg-teal-600 text-white text-xs font-bold"
                   style={{ gridTemplateColumns: showCorrectAnswers ? '1fr 60px 60px 60px' : '1fr 60px 60px' }}>
                <div className="px-4 py-2.5">Mệnh đề</div>
                <div className="py-2.5 text-center">Bạn chọn</div>
                {showCorrectAnswers && <div className="py-2.5 text-center bg-teal-700">Đáp án</div>}
                <div className="py-2.5 text-center bg-teal-800">Kết quả</div>
              </div>
              <div className="divide-y divide-teal-100">
                {displayOptions.map((opt: QuestionOption) => {
                  const key = opt.letter.toLowerCase();
                  const shouldBeTrue = correctMap[key] ?? false;
                  const userVal = userAnswers[key];
                  const isCorrectStatement = userVal 
                    ? ((userVal === 'T' && shouldBeTrue) || (userVal === 'F' && !shouldBeTrue))
                    : null;

                  return (
                    <div key={opt.letter} className="grid items-center text-sm"
                         style={{ 
                           gridTemplateColumns: showCorrectAnswers ? '1fr 60px 60px 60px' : '1fr 60px 60px',
                           backgroundColor: isCorrectStatement !== null ? (isCorrectStatement ? '#f0fdf4' : '#fef2f2') : '#ffffff'
                         }}>
                      <div className="px-4 py-3 flex gap-2 items-start">
                        <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-black flex-shrink-0">
                          {opt.letter.toLowerCase()}
                        </span>
                        <div className="flex-1"><MathText html={opt.text || opt.letter} /></div>
                      </div>
                      <div className="text-center py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          userVal === 'T' ? 'bg-blue-100 text-blue-700'
                          : userVal === 'F' ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-400'
                        }`}>
                          {userVal === 'T' ? 'Đ' : userVal === 'F' ? 'S' : '—'}
                        </span>
                      </div>
                      {showCorrectAnswers && (
                        <div className="text-center py-3 bg-teal-50/30">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${shouldBeTrue ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                            {shouldBeTrue ? 'Đ' : 'S'}
                          </span>
                        </div>
                      )}
                      <div className="text-center py-3 bg-teal-50/10">
                        {isCorrectStatement !== null
                          ? isCorrectStatement
                            ? <span className="text-emerald-600 font-bold text-base">✔</span>
                            : <span className="text-red-500 font-bold text-base">✖</span>
                          : <span className="text-gray-400">—</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {showExplanations && question.solution && (
            <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-xl">
              <span className="text-blue-700 font-bold text-sm">💡 Lời giải: </span>
              <div className="text-sm text-gray-700 mt-1"><MathText html={question.solution} block /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ===== Review: Short answer =====
const ShortAnswerReview: React.FC<{
  question: Question;
  userAnswer?: string;
  correctAnswer: string;
  showCorrectAnswers: boolean;
  showExplanations: boolean;
}> = ({ question, userAnswer, correctAnswer, showCorrectAnswers, showExplanations }) => {
  const normalizeAnswer = (answer: string): string => {
    let norm = (answer || '').toLowerCase().replace(/\s+/g, '').replace(/,/g, '.').trim();
    const numValue = Number(norm);
    if (!isNaN(numValue) && norm !== '') return numValue.toString();
    return norm;
  };

  const isCorrect = normalizeAnswer(userAnswer || '') === normalizeAnswer(correctAnswer);
  const isUnanswered = !userAnswer;
  const safeUser = escapeHtml(userAnswer || '');
  const safeCorrect = escapeHtml(correctAnswer || '');

  const statusBg = isUnanswered 
    ? 'bg-gray-50' 
    : isCorrect 
      ? 'bg-emerald-50 border-l-4 border-emerald-400' 
      : 'bg-red-50 border-l-4 border-red-400';

  return (
    <div className={`p-5 ${statusBg}`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white flex-shrink-0 ${
          isUnanswered ? 'bg-slate-400' : isCorrect ? 'bg-emerald-500' : 'bg-red-500'
        }`}>
          {question.number % 100}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-gray-800 mb-2 text-[15px] leading-relaxed">
            <MathText html={question.text || ''} block />
            <span className="ml-2 px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">TLN</span>
          </div>

          {question.images?.length > 0 && (
            <div className="my-2 flex flex-wrap gap-2">
              {question.images.map((img: any, idx: number) => (
                <img key={idx} src={img.base64 ? `data:${img.contentType || 'image/png'};base64,${img.base64}` : ''} alt={`Hình ${idx + 1}`} className="max-h-32 rounded border block" />
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className={`p-3 rounded-xl border-2 ${isUnanswered ? 'bg-gray-50 border-gray-200' : isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
              <div className="text-xs font-bold uppercase mb-1 text-gray-500">Bạn trả lời:</div>
              <div className="font-bold text-gray-800">
                {userAnswer ? <MathText html={safeUser} /> : <span className="text-gray-400 italic font-normal">Bỏ trống</span>}
              </div>
              <div className="mt-1">
                {isUnanswered 
                  ? <span className="text-gray-400 italic font-normal">Bỏ trống</span> 
                  : isCorrect 
                    ? <span className="text-emerald-600 font-bold text-sm">✅ Chính xác</span> 
                    : <span className="text-red-500 font-bold text-sm">❌ Không chính xác</span>}
              </div>
            </div>

            {showCorrectAnswers && !isCorrect && !isUnanswered && (
              <div className="p-3 rounded-xl bg-emerald-50 border-2 border-emerald-200">
                <div className="text-xs font-bold uppercase mb-1 text-emerald-600">Đáp án đúng:</div>
                <div className="font-bold text-emerald-800"><MathText html={safeCorrect} /></div>
              </div>
            )}
          </div>

          {showExplanations && question.solution && (
            <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-400 rounded-r-xl">
              <span className="text-blue-700 font-bold text-sm">💡 Lời giải: </span>
              <div className="text-sm text-gray-700 mt-1"><MathText html={question.solution} block /></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResultView;
