// @ts-nocheck
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Submission, Exam, Question, QuestionOption, Room } from '../types';
import { formatScore, getGrade } from '../services/scoringService';
import MathText from './MathText';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';

interface SubmissionDetailViewProps {
  submission?: Submission;
  exam?: Exam;
  room?: Room;
  submissionId?: string;
  onClose: () => void;
}

// ✅ Helper: robust lookup với cả number và string key (fix JSONB key type)
function getAnswerValue(answers: any, qNumber: number | string): string | undefined {
  if (!answers) return undefined;
  return answers[qNumber] ?? answers[String(qNumber)] ?? answers[Number(qNumber)];
}

function getTFBreakdown(details: any, qNumber: number | string): any {
  if (!details) return undefined;
  return details[qNumber] ?? details[String(qNumber)] ?? details[Number(qNumber)];
}

// ✅ Re-export normalizeAnswer để dùng trong ShortAnswerDetail
function normalizeAnswer(ans: string): string {
  let norm = (ans || '').toLowerCase().replace(/\s+/g, '').replace(/,/g, '.').trim();
  const numValue = Number(norm);
  if (!isNaN(numValue) && norm !== '') return numValue.toString();
  return norm;
}

// ✅ Helper: Kiếm tra câu trả lời có đúng hay không
function isQuestionCorrect(question: any, submission: any, partNum: number, sbRaw: any, tf: any): boolean {
  if (!question) return true;
  const qNum = question.number;

  if (partNum === 1) { // Multiple choice
    const userAnswer = getAnswerValue(submission?.answers, qNum);
    return !!userAnswer && String(userAnswer).trim().toUpperCase() === String(question.correctAnswer || '').trim().toUpperCase();
  }

  if (partNum === 2) { // True / False
    const breakdown = getTFBreakdown(tf?.details, qNum);
    if (breakdown) {
      const totalStatements = breakdown.totalStatements ?? (question.options?.length ?? 4);
      return breakdown.correctCount === totalStatements && breakdown.answeredCount === totalStatements;
    }
    const userAnswer = getAnswerValue(submission?.answers, qNum);
    if (!userAnswer) return false;
    const correctArr = (question.correctAnswer || '').toLowerCase().split(',').map((s: string) => s.trim()).filter(Boolean);
    let userAnswers: Record<string, string> = {};
    if (userAnswer.includes(':')) {
      userAnswer.split(',').forEach((p: string) => {
        const [l, v] = p.split(':');
        if (l && v) userAnswers[l.trim().toLowerCase()] = v.trim();
      });
    }
    const options = question.options || [];
    let correctCount = 0;
    options.forEach((opt: any) => {
      const letter = opt.letter.toLowerCase();
      const isCorrectStatement = correctArr.includes(letter);
      const userVal = userAnswers[letter];
      if ((userVal === 'T' && isCorrectStatement) || (userVal === 'F' && !isCorrectStatement)) {
        correctCount++;
      }
    });
    return correctCount === options.length;
  }

  if (partNum === 3) { // Short answer
    const userAnswer = getAnswerValue(submission?.answers, qNum);
    return !!userAnswer && normalizeAnswer(userAnswer) === normalizeAnswer(question.correctAnswer || '');
  }

  if (partNum === 4) { // Essay
    const scoreDetail = sbRaw.essay?.details?.[qNum] || sbRaw.essay?.details?.[String(qNum)];
    if (!scoreDetail) return false;
    return scoreDetail.score > 0;
  }

  return true;
}

function parseEssayAnswer(raw: any) {
  if (!raw) return { text: '', images: [] };
  if (typeof raw === 'object') {
    return {
      text: raw.text || '',
      images: Array.isArray(raw.images) ? raw.images : []
    };
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return {
        text: parsed.text || '',
        images: Array.isArray(parsed.images) ? parsed.images : [],
      };
    }
  } catch {}
  return { text: String(raw), images: [] };
}

const SubmissionDetailView: React.FC<SubmissionDetailViewProps> = ({
  submission: propSubmission,
  exam: propExam,
  room: propRoom,
  submissionId,
  onClose
}) => {
  const [mounted, setMounted] = useState(false);
  const [localSubmission, setLocalSubmission] = useState<any>(null);
  const [localExam, setLocalExam] = useState<any>(null);
  const [localRoom, setLocalRoom] = useState<any>(null);
  const [loading, setLoading] = useState(!!submissionId && !propSubmission);
  const [prioritizeWrong, setPrioritizeWrong] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (submissionId && !propSubmission) {
      const fetchSubmission = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from('exam_submissions')
            .select('*, students(id, full_name, student_code), exam_rooms(*, exams(*))')
            .eq('id', submissionId)
            .single();
          if (error) throw error;
          if (data) {
            const sb = data.score_breakdown || {};
            const mcCorrect = sb.multipleChoice?.correct || 0;
            const tfCorrect = sb.trueFalse?.correct || 0;
            const saCorrect = sb.shortAnswer?.correct || 0;
            const computedCorrectCount = mcCorrect + tfCorrect + saCorrect;

            const examData = data.exam_rooms?.exams;
            const examQuestions = examData?.data?.questions || [];
            const totalQCount = examQuestions.length ||
              ((sb.multipleChoice?.total || 0) + (sb.trueFalse?.total || 0) + (sb.shortAnswer?.total || 0));

            const totalTabSwitches = (data.tab_switches || 0) + (sb.history || []).reduce((sum: number, att: any) => sum + (att.tab_switches || 0), 0);

            const formattedSub = {
              ...data,
              student: {
                name: data.students?.full_name,
                className: '',
                studentCode: data.students?.student_code
              },
              roomCode: data.exam_rooms?.code,
              totalScore: data.score || sb.totalScore || 0,
              percentage: sb.percentage || 0,
              correctCount: data.correct_count ?? computedCorrectCount,
              totalQuestions: totalQCount,
              duration: data.duration || 0,
              tabSwitchCount: totalTabSwitches,
              scoreBreakdown: sb,
              answers: data.answers
            };

            setLocalSubmission(formattedSub);
            
            const studentExam = sb.shuffled_exam || data.score_breakdown?.shuffled_exam || examData?.data;
            setLocalExam({ ...studentExam, title: examData?.title });
            setLocalRoom(data.exam_rooms);
          }
        } catch (err) {
          console.error(err);
          toast.error('Không thể tải chi tiết bài làm');
        } finally {
          setLoading(false);
        }
      };
      void fetchSubmission();
    }
  }, [submissionId, propSubmission]);

  const submission = propSubmission || localSubmission;
  const exam = propExam || localExam;
  const room = propRoom || localRoom;

  if (loading || !submission || !exam) {
    const modalContentLoading = (
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-3" onClick={e => e.stopPropagation()}>
          <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold text-gray-600">Đang tải chi tiết bài làm...</span>
        </div>
      </div>
    );
    if (!mounted) return null;
    return createPortal(modalContentLoading, document.body);
  }

  // ✅ FIX: dùng scoreBreakdown (camelCase) với fallback sang score_breakdown (snake_case từ Supabase)
  const sbRaw = submission.scoreBreakdown || (submission as any).score_breakdown || {};
  const mc = sbRaw.multipleChoice || { total: 0, correct: 0, points: 0, pointsPerQuestion: 0 };
  const tf = sbRaw.trueFalse || { total: 0, correct: 0, partial: 0, points: 0, pointsPerQuestion: 0, details: {} };
  const sa = sbRaw.shortAnswer || { total: 0, correct: 0, points: 0, pointsPerQuestion: 0 };

  const gradeInfo = getGrade(submission.percentage ?? sbRaw.percentage ?? 0);
  const totalScore = submission.totalScore ?? (submission as any).score ?? sbRaw.totalScore ?? 0;
  const percentage = submission.percentage ?? sbRaw.percentage ?? 0;

  // ✅ FIX: correctCount & totalQuestions từ submission / scoreBreakdown / exam.questions
  const correctCount = submission.correctCount ??
    ((mc.correct || 0) + (tf.correct || 0) + (sa.correct || 0) + (sbRaw.essay?.correct || 0));

  const totalQuestions = submission.totalQuestions ||
    exam?.questions?.length ||
    ((mc.total || 0) + (tf.total || 0) + (sa.total || 0) + (sbRaw.essay?.total || 0)) || 0;

  const partConfigs: Record<number, { title: string; desc: string; gradient: string; border: string; badge: string }> = {
    1: {
      title: 'PHẦN 1. TRẮC NGHIỆM NHIỀU LỰA CHỌN',
      desc: 'Chọn một phương án đúng A, B, C hoặc D',
      gradient: 'from-blue-600 to-indigo-700',
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-700'
    },
    2: {
      title: 'PHẦN 2. TRẮC NGHIỆM ĐÚNG SAI',
      desc: 'Chọn Đúng hoặc Sai cho mỗi mệnh đề',
      gradient: 'from-teal-600 to-emerald-700',
      border: 'border-teal-200',
      badge: 'bg-teal-100 text-teal-700'
    },
    3: {
      title: 'PHẦN 3. TRẢ LỜI NGẮN',
      desc: 'Điền đáp án số vào ô trống',
      gradient: 'from-orange-500 to-amber-600',
      border: 'border-orange-200',
      badge: 'bg-orange-100 text-orange-700'
    },
    4: {
      title: 'PHẦN 4. TỰ LUẬN',
      desc: 'Bài làm trình bày chi tiết của học sinh',
      gradient: 'from-violet-600 to-purple-700',
      border: 'border-violet-200',
      badge: 'bg-violet-100 text-violet-700'
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-50 rounded-2xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-5 py-4 flex-shrink-0">
          <div className="flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap">
            <div>
              <h2 className="text-xl font-black flex items-center gap-2">
                📋 Chi tiết bài làm
              </h2>
              <p className="text-teal-100 text-sm mt-0.5">
                {submission.student?.name || 'Học sinh'}
                {submission.student?.studentCode && (
                  <span className="ml-2 font-mono opacity-70">· {submission.student.studentCode}</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPrioritizeWrong(!prioritizeWrong)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border shadow-sm ${
                  prioritizeWrong
                    ? 'bg-amber-400 text-amber-950 border-amber-300 hover:bg-amber-300'
                    : 'bg-white/20 text-white border-white/30 hover:bg-white/30'
                }`}
                title="Bật/Tắt ưu tiên hiển thị các câu sai lên đầu"
              >
                {prioritizeWrong ? '🔥 Đang hiện câu sai lên đầu' : '🔢 Hiện theo thứ tự gốc'}
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition font-bold text-lg flex-shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* ── Tổng quan điểm ── */}
        <div className="flex-shrink-0 bg-white border-b border-gray-100 px-5 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Tổng điểm */}
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 rounded-xl p-4 border-2 border-teal-200 shadow-sm">
              <div className="text-xs font-bold uppercase text-teal-500 mb-1">Tổng điểm</div>
              <div className="text-3xl font-black text-teal-700">
                {formatScore(totalScore)}
                <span className="text-base font-normal text-teal-400">/10</span>
              </div>
              <span className={`mt-1 inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${gradeInfo.bg} ${gradeInfo.color}`}>
                {gradeInfo.emoji} {gradeInfo.label}
              </span>
            </div>

            {/* Số câu đúng */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200 shadow-sm">
              <div className="text-xs font-bold uppercase text-blue-500 mb-1">Câu đúng</div>
              <div className="text-3xl font-black text-blue-700">
                {correctCount}
                <span className="text-base font-normal text-blue-400">/{totalQuestions}</span>
              </div>
              <div className="mt-1 text-xs text-blue-500">{percentage}% chính xác</div>
            </div>

            {/* Điểm chi tiết */}
            {mc.total > 0 && (
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-3 border border-blue-200 shadow-sm">
                <div className="text-[10px] font-bold uppercase text-blue-500 mb-1">🔘 Trắc nghiệm</div>
                <div className="text-xl font-black text-blue-700">{formatScore(mc.points)}đ</div>
                <div className="text-xs text-blue-600">{mc.correct}/{mc.total} câu đúng</div>
              </div>
            )}
            {tf.total > 0 && (
              <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-xl p-3 border border-teal-200 shadow-sm">
                <div className="text-[10px] font-bold uppercase text-teal-500 mb-1">✅ Đúng / Sai</div>
                <div className="text-xl font-black text-teal-700">{formatScore(tf.points)}đ</div>
                <div className="text-xs text-teal-600">
                  {tf.correct} đúng hoàn toàn
                  {tf.partial > 0 && <span className="text-yellow-600"> · {tf.partial} phần</span>}
                </div>
              </div>
            )}
            {sa.total > 0 && (
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-3 border border-orange-200 shadow-sm">
                <div className="text-[10px] font-bold uppercase text-orange-500 mb-1">✏️ Trả lời ngắn</div>
                <div className="text-xl font-black text-orange-700">{formatScore(sa.points)}đ</div>
                <div className="text-xs text-orange-600">{sa.correct}/{sa.total} câu đúng</div>
              </div>
            )}
            {sbRaw.essay?.points !== undefined && (
              <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-3 border border-violet-200 shadow-sm">
                <div className="text-[10px] font-bold uppercase text-violet-500 mb-1">✍️ Tự luận</div>
                <div className="text-xl font-black text-violet-700">{formatScore(sbRaw.essay.points)}đ</div>
                <div className="text-xs text-violet-600">Đã chấm bằng AI/GV</div>
              </div>
            )}

            {/* Cảnh báo gian lận */}
            {(submission.tabSwitchCount || (submission as any).tab_switches || 0) > 0 && (
              <div className="bg-red-50 rounded-xl p-3 border-2 border-red-200 shadow-sm col-span-2">
                <div className="text-xs font-bold text-red-600 mb-1">⚠️ Cảnh báo vi phạm</div>
                <div className="text-lg font-black text-red-700">
                  Chuyển tab {submission.tabSwitchCount || (submission as any).tab_switches} lần
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Nội dung chi tiết từng câu ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
          {[1, 2, 3, 4].map(partNum => {
            // ✅ FIX ROOT CAUSE: Hỗ trợ cả 2 kiểu đánh số câu hỏi:
            // 1. Part-based (101,102...): đề gốc → Math.floor(101/100) = 1
            // 2. Sequential (1,2,3...): đề shuffle/merge → dùng q.type để nhóm
            const partTypeMap: Record<number, string[]> = {
              1: ['multiple_choice'],
              2: ['true_false'],
              3: ['short_answer'],
              4: ['writing'],
            };
            const rawQuestionsInPart = (exam.questions || []).filter(q => {
              const qNum = Number(q.number);
              const numBasedPart = Math.floor(qNum / 100);
              if (numBasedPart >= 1 && numBasedPart <= 9) {
                // Đề gốc với part-based numbering
                return numBasedPart === partNum;
              }
              // Đề trộn/shuffle với sequential numbering → dùng question type
              return (partTypeMap[partNum] || []).includes(q.type || 'multiple_choice');
            }).sort((a, b) => Number(a.number) - Number(b.number))
            .map((q, idx) => ({
              ...q,
              originalDisplayIndex: idx + 1
            }));

            // ✅ Sắp xếp câu sai / chưa làm lên đầu nếu prioritizeWrong === true
            const questionsInPart = prioritizeWrong
              ? [...rawQuestionsInPart].sort((a, b) => {
                  const aCorrect = isQuestionCorrect(a, submission, partNum, sbRaw, tf);
                  const bCorrect = isQuestionCorrect(b, submission, partNum, sbRaw, tf);
                  if (aCorrect === bCorrect) {
                    return Number(a.number) - Number(b.number);
                  }
                  return aCorrect ? 1 : -1; // Câu sai (false) lên trước câu đúng (true)
                })
              : rawQuestionsInPart;

            if (questionsInPart.length === 0) return null;
            const config = partConfigs[partNum];

            return (
              <div key={partNum}>
                {/* Section header */}
                <div className={`bg-gradient-to-r ${config.gradient} rounded-2xl p-4 mb-4 shadow-md flex items-center justify-between`}>
                  <div>
                    <h3 className="font-black text-white text-base">{config.title}</h3>
                    <p className="text-white/80 text-xs mt-0.5">{config.desc}</p>
                  </div>
                  {prioritizeWrong && (
                    <span className="text-[11px] font-bold px-2.5 py-1 bg-white/20 text-white rounded-lg backdrop-blur-sm">
                      ⚠️ Đã ưu tiên câu sai lên đầu
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {questionsInPart.map((question) => {
                    // ✅ FIX BUG 7: robust answer lookup với cả number và string key
                    const userAnswer = getAnswerValue(submission.answers, question.number);
                    // ✅ Giữ nguyên số thứ tự gốc của câu hỏi trong đề
                    const displayIndex = (question as any).originalDisplayIndex;

                    return (
                      <div key={question.number}>
                        {partNum === 1 && (
                          <MultipleChoiceDetail
                            question={question}
                            userAnswer={userAnswer}
                            displayIndex={displayIndex}
                            maxPoints={mc.pointsPerQuestion || 0}
                          />
                        )}
                        {partNum === 2 && (
                          <TrueFalseDetail
                            question={question}
                            userAnswer={userAnswer}
                            // ✅ FIX BUG 4: robust TF details lookup
                            breakdown={getTFBreakdown(tf.details, question.number)}
                            displayIndex={displayIndex}
                            maxPointsPerQuestion={tf.pointsPerQuestion || 0}
                          />
                        )}
                        {partNum === 3 && (
                          <ShortAnswerDetail
                            question={question}
                            userAnswer={userAnswer}
                            displayIndex={displayIndex}
                            maxPoints={sa.pointsPerQuestion || 0}
                          />
                        )}
                        {partNum === 4 && (
                          <EssayDetail
                            question={question}
                            userAnswer={userAnswer}
                            displayIndex={displayIndex}
                            scoreDetail={sbRaw.essay?.details?.[question.number] || sbRaw.essay?.details?.[String(question.number)]}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ── */}
        <div className="bg-white border-t border-gray-100 px-5 py-4 flex justify-end flex-shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
          <button
            onClick={onClose}
            className="px-10 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modalContent, document.body);
};

// ─── TRẮC NGHIỆM ────────────────────────────────────────────────────────────
const MultipleChoiceDetail = ({ question, userAnswer, displayIndex, maxPoints = 0 }) => {
  const isCorrect = !!userAnswer && userAnswer.toUpperCase() === question.correctAnswer?.toUpperCase();
  const earnedPoints = isCorrect ? maxPoints : 0;

  return (
    <div className={`rounded-2xl border-2 bg-white overflow-hidden ${
      isCorrect ? 'border-green-200' : userAnswer ? 'border-red-200' : 'border-gray-200'
    }`}>
      {/* Question header */}
      <div className={`px-4 py-2.5 flex items-center justify-between ${
        isCorrect ? 'bg-green-50' : userAnswer ? 'bg-red-50' : 'bg-gray-50'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-white text-xs ${
            isCorrect ? 'bg-green-500' : userAnswer ? 'bg-red-500' : 'bg-gray-400'
          }`}>
            {displayIndex}
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            isCorrect ? 'bg-green-100 text-green-700' : userAnswer ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {isCorrect ? '✅ Đúng' : userAnswer ? '❌ Sai' : '— Bỏ trống'}
          </span>
        </div>
        <span className={`text-sm font-black ${isCorrect ? 'text-green-600' : 'text-gray-400'}`}>
          {formatScore(earnedPoints)}đ
        </span>
      </div>

      {/* Question content */}
      <div className="px-4 py-3">
        <MathText html={question.text} block className="text-sm text-gray-800 leading-relaxed mb-3" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {(question.options || []).map(opt => {
            const isUser = userAnswer === opt.letter;
            const isRight = question.correctAnswer === opt.letter;

            let cls = 'bg-white border-gray-200 text-gray-700';
            if (isRight) cls = 'bg-green-50 border-green-500 text-green-800 font-semibold shadow-sm';
            else if (isUser && !isRight) cls = 'bg-red-50 border-red-400 text-red-800';

            return (
              <div key={opt.letter} className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm transition-colors ${cls}`}>
                <span className={`w-6 h-6 rounded-full border flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                  isRight ? 'bg-green-500 text-white border-green-500'
                  : isUser ? 'bg-red-500 text-white border-red-500'
                  : 'bg-gray-100 border-gray-300 text-gray-600'
                }`}>
                  {opt.letter}
                </span>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <MathText html={opt.text || ''} className="text-xs" />
                </div>
                {isRight && <span className="text-green-500 font-bold">✔</span>}
                {isUser && !isRight && <span className="text-red-500 font-bold">✖</span>}
              </div>
            );
          })}
        </div>

        {/* Học sinh chọn */}
        <div className="mt-3 flex gap-2 text-xs flex-wrap">
          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg">
            Chọn: <strong>{userAnswer || '(bỏ trống)'}</strong>
          </span>
          {!isCorrect && question.correctAnswer && (
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-lg font-bold">
              ĐA: {question.correctAnswer}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── ĐÚNG SAI ────────────────────────────────────────────────────────────────
const TrueFalseDetail = ({ question, userAnswer, breakdown, displayIndex, maxPointsPerQuestion = 0 }) => {
  // ✅ FIX BUG 6: dùng pre-computed breakdown từ scoringService thay vì re-parse
  // Fallback: nếu không có breakdown, re-parse để hiển thị
  let userAnswers: Record<string, string> = {};
  if (userAnswer) {
    if (userAnswer.includes(':')) {
      userAnswer.split(',').forEach(p => {
        const [l, v] = p.split(':');
        if (l && v) userAnswers[l.trim().toLowerCase()] = v.trim();
      });
    } else {
      try {
        const parsed = JSON.parse(userAnswer);
        Object.keys(parsed).forEach(k => {
          if (parsed[k]) userAnswers[k.toLowerCase()] = 'T';
          else userAnswers[k.toLowerCase()] = 'F';
        });
      } catch {
        userAnswer.split(',').forEach(s => {
          const l = s.trim().toLowerCase();
          if (l) userAnswers[l] = 'T';
        });
      }
    }
  }

  const correctArr = (question.correctAnswer || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

  // ✅ Dùng pre-computed nếu có, fallback sang tính lại
  const earnedPoints = breakdown?.points ?? 0;
  const correctStatementCount = breakdown?.correctCount ?? 0;
  const totalStatements = breakdown?.totalStatements ?? (question.options?.length ?? 4);

  const isPerfect = correctStatementCount === totalStatements && (breakdown?.answeredCount ?? 0) === totalStatements;
  const isPartial = earnedPoints > 0 && !isPerfect;

  return (
    <div className={`rounded-2xl border-2 bg-white overflow-hidden ${
      isPerfect ? 'border-teal-300' : isPartial ? 'border-yellow-300' : earnedPoints === 0 && correctStatementCount === 0 ? 'border-gray-200' : 'border-red-200'
    }`}>
      {/* Question header */}
      <div className={`px-4 py-2.5 flex items-center justify-between ${
        isPerfect ? 'bg-teal-50' : isPartial ? 'bg-yellow-50' : 'bg-gray-50'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-white text-xs ${
            isPerfect ? 'bg-teal-500' : isPartial ? 'bg-yellow-500' : 'bg-gray-400'
          }`}>
            {displayIndex}
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            isPerfect ? 'bg-teal-100 text-teal-700'
            : isPartial ? 'bg-yellow-100 text-yellow-700'
            : 'bg-gray-100 text-gray-500'
          }`}>
            {isPerfect ? '✅ Đúng hoàn toàn' : isPartial ? `⚡ Đúng ${correctStatementCount}/${totalStatements}` : '❌ Chưa đúng'}
          </span>
        </div>
        <span className={`text-sm font-black ${earnedPoints > 0 ? 'text-teal-600' : 'text-gray-400'}`}>
          {formatScore(earnedPoints)}đ
        </span>
      </div>

      {/* Question content */}
      <div className="px-4 py-3">
        <MathText html={question.text} block className="text-sm text-gray-800 leading-relaxed mb-3" />

        {/* Bảng đúng/sai */}
        <div className="rounded-xl border-2 border-teal-200 overflow-hidden text-sm shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-[1fr_64px_64px_56px] bg-teal-700 text-white text-center text-[11px] font-black uppercase">
            <div className="px-3 py-2.5 text-left">Mệnh đề</div>
            <div className="py-2.5">HS chọn</div>
            <div className="py-2.5 bg-teal-800">Đáp án</div>
            <div className="py-2.5 bg-teal-900">Kết quả</div>
          </div>

          {/* Rows */}
          {(question.options || []).map((opt, idx) => {
            const letter = opt.letter.toLowerCase();
            const isCorrectStatement = correctArr.includes(letter);
            const userVal = userAnswers[letter];
            const isMatch = userVal
              ? (userVal === 'T' && isCorrectStatement) || (userVal === 'F' && !isCorrectStatement)
              : null;

            return (
              <div key={opt.letter} className={`grid grid-cols-[1fr_64px_64px_56px] border-t border-teal-100 text-xs ${
                userVal
                  ? isMatch ? 'bg-emerald-50/60' : 'bg-red-50/60'
                  : 'bg-gray-50/40'
              }`}>
                <div className="px-3 py-3 flex items-start gap-2 border-r border-teal-100">
                  <span className="w-5 h-5 flex-shrink-0 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center font-black text-[10px]">
                    {String.fromCharCode(97 + idx)}
                  </span>
                  <div className="flex-1 min-w-0 overflow-hidden leading-relaxed">
                    <MathText html={opt.text || ''} />
                  </div>
                </div>
                {/* HS chọn */}
                <div className={`text-center py-3 font-bold border-r border-teal-100 ${
                  userVal
                    ? isMatch ? 'text-emerald-700' : 'text-red-600'
                    : 'text-gray-300'
                }`}>
                  {userVal === 'T' ? 'ĐÚNG' : userVal === 'F' ? 'SAI' : '—'}
                </div>
                {/* Đáp án */}
                <div className="text-center py-3 font-bold text-teal-700 border-r border-teal-100 bg-teal-50/40">
                  {isCorrectStatement ? 'ĐÚNG' : 'SAI'}
                </div>
                {/* Kết quả */}
                <div className="text-center py-3">
                  {isMatch === null
                    ? <span className="text-gray-300 text-base">—</span>
                    : isMatch
                    ? <span className="text-emerald-600 font-bold text-base">✔</span>
                    : <span className="text-red-500 font-bold text-base">✖</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── TRẢ LỜI NGẮN ────────────────────────────────────────────────────────────
const ShortAnswerDetail = ({ question, userAnswer, displayIndex, maxPoints = 0 }) => {
  const isCorrect = !!userAnswer && normalizeAnswer(userAnswer) === normalizeAnswer(question.correctAnswer || '');
  const earnedPoints = isCorrect ? maxPoints : 0;

  return (
    <div className={`rounded-2xl border-2 bg-white overflow-hidden ${
      isCorrect ? 'border-orange-200' : userAnswer ? 'border-red-200' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div className={`px-4 py-2.5 flex items-center justify-between ${
        isCorrect ? 'bg-orange-50' : userAnswer ? 'bg-red-50' : 'bg-gray-50'
      }`}>
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-white text-xs ${
            isCorrect ? 'bg-orange-500' : userAnswer ? 'bg-red-500' : 'bg-gray-400'
          }`}>
            {displayIndex}
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            isCorrect ? 'bg-orange-100 text-orange-700' : userAnswer ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
          }`}>
            {isCorrect ? '✅ Chính xác' : userAnswer ? '❌ Sai' : '— Bỏ trống'}
          </span>
        </div>
        <span className={`text-sm font-black ${isCorrect ? 'text-orange-600' : 'text-gray-400'}`}>
          {formatScore(earnedPoints)}đ
        </span>
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <MathText html={question.text} block className="text-sm text-gray-800 leading-relaxed mb-3" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={`p-3 rounded-xl border-2 ${isCorrect ? 'bg-orange-50 border-orange-200' : userAnswer ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-[10px] font-bold uppercase text-gray-500 mb-1">Học sinh trả lời:</p>
            <p className={`font-bold text-base ${userAnswer ? 'text-gray-800' : 'text-gray-400 italic text-sm'}`}>
              {userAnswer || 'Bỏ trống'}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-teal-50 border-2 border-teal-200">
            <p className="text-[10px] font-bold uppercase text-teal-600 mb-1">Đáp án đúng:</p>
            <p className="font-bold text-base text-teal-800">{question.correctAnswer || '—'}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── TỰ LUẬN ─────────────────────────────────────────────────────────────────
const EssayDetail = ({ question, userAnswer, displayIndex, scoreDetail }) => {
  const parsed = parseEssayAnswer(userAnswer);
  const hasText = !!parsed.text?.trim();
  const hasImages = Array.isArray(parsed.images) && parsed.images.length > 0;
  const hasContent = hasText || hasImages;

  return (
    <div className="rounded-2xl border-2 border-violet-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-2.5 flex items-center justify-between bg-violet-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-violet-500 flex items-center justify-center font-black text-white text-xs">
            {displayIndex}
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${hasContent ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500'}`}>
            {hasContent ? (scoreDetail ? '✅ Đã chấm' : '📝 Đã làm · Chờ GV chấm') : '— Bỏ trống'}
          </span>
        </div>
        {scoreDetail && (
          <span className="text-sm font-black text-violet-700">
            {scoreDetail.score.toFixed(2)}đ
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3">
        <MathText html={question.text} block className="text-sm text-gray-800 mb-3 leading-relaxed" />
        {hasContent ? (
          <div className="space-y-3">
            {hasText && (
              <div className="p-3 bg-violet-50/50 rounded-xl border border-violet-100/50">
                <p className="text-[10px] font-bold text-violet-600 uppercase mb-1">Bài làm:</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {parsed.text}
                </p>
              </div>
            )}
            {hasImages && (
              <div className="grid grid-cols-2 gap-2">
                {parsed.images.map((img: any, i: number) => (
                  <img key={i} src={`data:${img.type};base64,${img.data}`} className="rounded-xl border-2 border-violet-100 shadow-sm max-h-52 object-contain bg-slate-800" alt={`Ảnh ${i + 1}`} />
                ))}
              </div>
            )}
            
            {/* AI Grading result */}
            {scoreDetail && (
              <div className="p-3 bg-green-50 rounded-xl border border-green-200 mt-2">
                <p className="text-[10px] font-bold text-green-700 uppercase mb-1">Nhận xét của giáo viên/AI:</p>
                <p className="text-xs text-green-800 italic whitespace-pre-line leading-relaxed">
                  {scoreDetail.feedback || 'Đã chấm điểm.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400 italic py-2">Học sinh chưa làm câu này.</p>
        )}
      </div>
    </div>
  );
};

export default SubmissionDetailView;
