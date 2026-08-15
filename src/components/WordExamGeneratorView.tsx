// @ts-nocheck
import React, { useState, useCallback, useMemo } from 'react';
import {
  Search, ChevronDown, ChevronRight, Plus, Trash2,
  Loader2, Table2, FileType, FileText, X
} from 'lucide-react';
import { QuestionType } from '@/types';
import { flattenTopics, TopicItem, DifficultyLevel } from '@/data/topicData';
import { callGeminiPublic } from '@/services/geminiService';
import toast from 'react-hot-toast';

// ─── API & Services cho Word ──────────────────────────────────────────────────
export const PANDOC_API_URL = 'https://pandoc-fly.fly.dev/convert';

export async function convertMarkdownToDocx(markdown: string): Promise<Blob> {
  const response = await fetch(PANDOC_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ markdown })
  });

  if (!response.ok) {
    throw new Error('Pandoc Server Error: ' + response.status);
  }

  return await response.blob();
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function jsonToMarkdown(questions: any[]): string {
  let md = '# ĐỀ KIỂM TRA MÔN TOÁN\n\n';

  questions.forEach((q, index) => {
    md += '**Câu ' + (index + 1) + ':** ' + (q.text || '') + '\n\n';

    if (q.type === 'multiple_choice' && q.options) {
      q.options.forEach((opt: any) => {
        md += (opt.letter || '') + '. ' + (opt.text || '') + '\n';
      });
      md += '\n';
    } else if (q.type === 'true_false' && q.options) {
      q.options.forEach((opt: any) => {
        md += (opt.letter || '') + ') ' + (opt.text || '') + '\n';
      });
      md += '\n';
    } else if (q.type === 'short_answer') {
      md += 'Trả lời: ........................................\n\n';
    } else if (q.type === 'essay') {
      md += '\n\n................................................................................\n\n';
    }
  });

  md += '\n---\n# ĐÁP ÁN VÀ LỜI GIẢI CHI TIẾT\n\n';

  questions.forEach((q, index) => {
    md += '**Câu ' + (index + 1) + ':**\n';
    md += '- **Đáp án:** ' + (q.correctAnswer || '') + '\n';
    if (q.explanation) {
      md += '- **Lời giải:** ' + q.explanation + '\n';
    }
    md += '\n';
  });

  return md;
}

// ─── Constants & Types ────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  [QuestionType.MULTICHOICE]: 'Trắc nghiệm',
  [QuestionType.TRUEFALSE]: 'Đúng / Sai',
  [QuestionType.SHORTANS]: 'Trả lời ngắn',
  [QuestionType.ESSAY]: 'Tự luận'
};

const TYPE_COLORS: Record<string, string> = {
  [QuestionType.MULTICHOICE]: 'bg-blue-100 text-blue-700 border-blue-200',
  [QuestionType.TRUEFALSE]: 'bg-green-100 text-green-700 border-green-200',
  [QuestionType.SHORTANS]: 'bg-orange-100 text-orange-700 border-orange-200',
  [QuestionType.ESSAY]: 'bg-purple-100 text-purple-700 border-purple-200'
};

const LEVEL_COLORS: Record<string, string> = {
  'Nhận biết': 'bg-sky-100 text-sky-700',
  'Thông hiểu': 'bg-teal-100 text-teal-700',
  'Vận dụng': 'bg-amber-100 text-amber-700',
  'Vận dụng cao': 'bg-rose-100 text-rose-700'
};

const ALL_DIFFICULTY_LEVELS: DifficultyLevel[] = [
  'Nhận biết',
  'Thông hiểu',
  'Vận dụng',
  'Vận dụng cao'
];

interface MatrixRow {
  id: string;
  topicItem: TopicItem;
  questionType: QuestionType;
  count: number;
  level: DifficultyLevel;
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────
function buildWordPrompt(matrix: MatrixRow[]): string {
  const count = matrix.reduce((sum, row) => sum + row.count, 0);
  const types = Array.from(new Set(matrix.map(r => r.questionType)));

  const matrixStr = matrix
    .map(r =>
      '- Chủ đề: "' +
      r.topicItem.topic +
      '" (' +
      r.topicItem.grade +
      ', mức: ' +
      r.level +
      '): ' +
      r.count +
      ' câu, dạng: ' +
      r.questionType
    )
    .join('\n');

  return 'Bạn là một chuyên gia soạn đề thi cực kỳ chuyên nghiệp và chuẩn xác.\n' +
    'Hãy tạo tổng cộng ' + count + ' câu hỏi dựa trên ma trận sau:\n' +
    matrixStr + '\n\n' +
    'YÊU CẦU ĐỊNH DẠNG JSON (ARRAY):\n' +
    '[\n' +
    '  {\n' +
    '    "id": "uuid",\n' +
    '    "number": 1,\n' +
    '    "type": "multiple_choice",\n' +
    '    "text": "Nội dung câu hỏi. Mọi công thức toán PHẢI viết LaTeX chuẩn và bọc trong dấu $, ví dụ: $x^2 + y^2 = r^2$",\n' +
    '    "options": [\n' +
    '      {"letter": "A", "text": "Phương án A"},\n' +
    '      {"letter": "B", "text": "Phương án B"},\n' +
    '      {"letter": "C", "text": "Phương án C"},\n' +
    '      {"letter": "D", "text": "Phương án D"}\n' +
    '    ],\n' +
    '    "correctAnswer": "A",\n' +
    '    "explanation": "Lời giải chi tiết và đầy đủ. Mọi công thức toán PHẢI viết LaTeX chuẩn và bọc trong dấu $.",\n' +
    '    "difficulty": "medium"\n' +
    '  }\n' +
    ']\n\n' +
    'LOẠI CÂU HỎI TRONG KẾT QUẢ PHẢI KHỚP VỚI MA TRẬN YÊU CẦU: ' + types.join(', ') + '.\n\n' +
    'LƯU Ý QUAN TRỌNG:\n' +
    '- Với câu hỏi "true_false" (Đúng/Sai), "options" BẮT BUỘC phải có đúng 4 mệnh đề với "letter" lần lượt là "a", "b", "c", "d".\n' +
    '- Với câu "true_false", "correctAnswer" PHẢI LÀ chuỗi dạng "a:T,b:F,c:T,d:F" (với T là Đúng, F là Sai).\n' +
    '- Với câu "short_answer", options để trống [], correctAnswer là ĐÁP ÁN SỐ hoặc từ ngắn.\n' +
    '- Với câu "essay", options để trống [], correctAnswer là HƯỚNG DẪN CHẤM.\n' +
    '- Tất cả công thức toán học PHẢI được viết bằng LaTeX chuẩn và PHẢI được bao quanh bởi dấu $ hoặc $$.\n' +
    '- Không dùng thẻ <latex>, không dùng \\( ... \\), không dùng \\[ ... \\]. Chỉ dùng $...$ hoặc $$...$$.\n' +
    '- Không lặp ký hiệu LaTeX bị trùng như $$...$$$ hoặc $ $...$ $.\n' +
    '- CHỈ TRẢ VỀ JSON THUẦN TÚY, không có văn bản giải thích ở ngoài, không bọc trong markdown block.';
}

// ─── Add-to-Matrix Popup ──────────────────────────────────────────────────────
function AddTopicPopup({
  topic,
  onAdd,
  onClose
}: {
  topic: TopicItem;
  onAdd: (row: Omit<MatrixRow, 'id'>) => void;
  onClose: () => void;
}) {
  const [qType, setQType] = useState<QuestionType>(QuestionType.MULTICHOICE);
  const [count, setCount] = useState(3);
  const [level, setLevel] = useState<DifficultyLevel>(
    topic.levels[topic.levels.length > 1 ? 1 : 0]
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <div className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Plus size={15} className="text-blue-600" /> Thêm vào ma trận (Word)
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {topic.grade} · {topic.chapter}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 leading-relaxed font-medium border border-slate-100">
            {topic.topic}
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 mb-2 block">Dạng câu hỏi</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(QuestionType).map(t => (
                <button
                  key={t}
                  onClick={() => setQType(t)}
                  className={
                    'px-3 py-2 rounded-xl border text-xs font-bold transition-all ' +
                    (qType === t
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300')
                  }
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-600 mb-2 block">Số câu hỏi</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={count}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1) setCount(v);
                  }}
                  className="w-full text-center py-2 rounded-xl border border-slate-200 font-extrabold text-blue-700 text-lg outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-2 block">Mức độ</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as DifficultyLevel)}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-400"
              >
                {ALL_DIFFICULTY_LEVELS.map(lv => (
                  <option key={lv} value={lv}>{lv}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
          >
            Huỷ
          </button>
          <button
            onClick={() => {
              onAdd({ topicItem: topic, questionType: qType, count, level });
              onClose();
            }}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2"
          >
            <Plus size={15} /> Thêm vào
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function WordExamGeneratorView() {
  const allTopics = useMemo(() => flattenTopics(), []);
  const allGrades = useMemo(() => Array.from(new Set(allTopics.map(t => t.grade))), [allTopics]);

  const [activeGrade, setActiveGrade] = useState<string>(allGrades[0] || 'Lớp 6');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [pendingTopic, setPendingTopic] = useState<TopicItem | null>(null);
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [generatingWord, setGeneratingWord] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allTopics.filter(t => {
      const matchGrade = !q && t.grade === activeGrade;
      const matchSearch = q && (
        t.topic.toLowerCase().includes(q) ||
        t.chapter.toLowerCase().includes(q) ||
        t.domain.toLowerCase().includes(q)
      );
      return matchGrade || matchSearch;
    });
  }, [allTopics, activeGrade, searchQuery]);

  const grouped = useMemo(() => {
    const map = new Map<string, Map<string, TopicItem[]>>();

    for (const t of filteredTopics) {
      if (!map.has(t.domain)) map.set(t.domain, new Map());
      const domainMap = map.get(t.domain)!;
      if (!domainMap.has(t.chapter)) domainMap.set(t.chapter, []);
      domainMap.get(t.chapter)!.push(t);
    }

    return map;
  }, [filteredTopics]);

  const matrixStats = useMemo(() => {
    let total = 0;
    for (const row of matrix) total += row.count;
    return { total };
  }, [matrix]);

  const addToMatrix = useCallback((data: Omit<MatrixRow, 'id'>) => {
    setMatrix(prev => [...prev, { ...data, id: 'row_' + Date.now() }]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setMatrix(prev => prev.filter(r => r.id !== id));
  }, []);

  const toggleDomain = (key: string) => {
    setExpandedDomains(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const toggleChapter = (key: string) => {
    setExpandedChapters(prev => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  const handleGenerateWord = useCallback(async () => {
    if (matrix.length === 0) {
      toast.error('Ma trận đang trống!');
      return;
    }

    setGeneratingWord(true);
    setProgressMsg('AI đang soạn nội dung câu hỏi...');

    try {
      const prompt = buildWordPrompt(matrix);
      const raw = await callGeminiPublic(prompt);

      setProgressMsg('Đang xử lý định dạng...');
      let jsonStr = raw.trim();
      const codeMarker = '```';

      if (jsonStr.indexOf(codeMarker + 'json') === 0) {
        jsonStr = jsonStr.substring(7);
      }
      if (jsonStr.indexOf(codeMarker) === 0) {
        jsonStr = jsonStr.substring(3);
      }
      if (jsonStr.lastIndexOf(codeMarker) === jsonStr.length - 3 && jsonStr.length >= 3) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3);
      }

      const questionsArr = JSON.parse(jsonStr.trim());
      const markdownResult = jsonToMarkdown(questionsArr);

      setProgressMsg('Đang biên dịch file Word (Equation)...');
      const blob = await convertMarkdownToDocx(markdownResult);

      downloadBlob(blob, 'De_Thi_Word_' + Date.now() + '.docx');
      toast.success('Đã tải xuống file Word thành công!');
    } catch (e: any) {
      console.error('Lỗi xuất Word:', e);
      const errorMsg = e && e.message ? e.message : 'Có thể AI trả về JSON sai cấu trúc';
      toast.error('Lỗi: ' + errorMsg);
    } finally {
      setGeneratingWord(false);
      setProgressMsg('');
    }
  }, [matrix]);

  return (
    <React.Fragment>
      {pendingTopic && (
        <AddTopicPopup
          topic={pendingTopic}
          onAdd={addToMatrix}
          onClose={() => setPendingTopic(null)}
        />
      )}

      <div className="space-y-4 animate-in fade-in">
        <div className="bg-white rounded-2xl border border-blue-200 shadow-sm p-4">
          <div className="font-extrabold text-blue-800 flex items-center gap-2 mb-1">
            <FileType className="text-blue-600" size={20} /> Xuất Đề Thi Word (.docx)
          </div>
          <p className="text-sm text-slate-500">
            Duyệt chủ đề → Thêm ma trận → AI tạo JSON → Convert sang Markdown → Gọi Pandoc xuất file Word chuẩn Equation.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <div className="xl:col-span-2 space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
              <div className="relative">
                <Search className="absolute left-3 top-[50%] -translate-y-[50%] text-slate-400" size={14} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setExpandedDomains(new Set());
                    setExpandedChapters(new Set());
                  }}
                  placeholder="Tìm kiếm chủ đề..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
            </div>

            {!searchQuery && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
                <div className="flex flex-wrap gap-1.5">
                  {allGrades.map(g => (
                    <button
                      key={g}
                      onClick={() => {
                        setActiveGrade(g);
                        setExpandedDomains(new Set());
                        setExpandedChapters(new Set());
                      }}
                      className={
                        'px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ' +
                        (activeGrade === g
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300')
                      }
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="max-h-[520px] overflow-y-auto">
                {grouped.size === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">Không có dữ liệu.</div>
                ) : (
                  Array.from(grouped.entries()).map(([domain, chapters]) => {
                    const domainKey = activeGrade + '::' + domain;
                    const isDomainExpanded = expandedDomains.has(domainKey) || !!searchQuery;

                    return (
                      <div key={domain} className="border-b border-slate-50 last:border-0">
                        <button
                          onClick={() => toggleDomain(domainKey)}
                          className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-blue-50 text-left transition-colors"
                        >
                          {isDomainExpanded ? (
                            <ChevronDown className="text-blue-600 flex-shrink-0" size={14} />
                          ) : (
                            <ChevronRight className="text-slate-400 flex-shrink-0" size={14} />
                          )}
                          <span className="text-xs font-extrabold text-blue-700 uppercase tracking-wide">
                            {domain}
                          </span>
                        </button>

                        {isDomainExpanded && (
                          <div className="pl-2">
                            {Array.from(chapters.entries()).map(([chapter, topics]) => {
                              const chapKey = domainKey + '::' + chapter;
                              const isChapExpanded = expandedChapters.has(chapKey) || !!searchQuery;

                              return (
                                <div key={chapter}>
                                  <button
                                    onClick={() => toggleChapter(chapKey)}
                                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-50 text-left transition-colors"
                                  >
                                    {isChapExpanded ? (
                                      <ChevronDown className="text-slate-400 flex-shrink-0" size={12} />
                                    ) : (
                                      <ChevronRight className="text-slate-300 flex-shrink-0" size={12} />
                                    )}
                                    <span className="text-xs font-bold text-slate-700">
                                      {chapter}
                                    </span>
                                  </button>

                                  {isChapExpanded && (
                                    <div className="pl-4">
                                      {topics.map(topic => (
                                        <button
                                          key={topic.id}
                                          onClick={() => setPendingTopic(topic)}
                                          className="w-full text-left flex items-start gap-2 px-3 py-2.5 hover:bg-blue-50 border-l-2 border-transparent hover:border-blue-400 transition-all group"
                                        >
                                          <Plus className="text-slate-300 group-hover:text-blue-500 flex-shrink-0 mt-0.5 transition-colors" size={13} />
                                          <div className="min-w-0">
                                            <p className="text-xs text-slate-700 leading-snug group-hover:text-blue-800 break-words">
                                              {topic.topic}
                                            </p>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="xl:col-span-3 space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <div className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <Table2 className="text-blue-600" size={15} />
                  Ma trận Xuất Word
                  {matrixStats.total > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">
                      {matrixStats.total} câu
                    </span>
                  )}
                </div>
              </div>

              {matrix.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
                  <Table2 className="opacity-20" size={40} />
                  <p className="text-sm font-medium">Chưa có chủ đề nào</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-3 py-2 text-left text-slate-500 font-bold w-6">#</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-bold">Chủ đề</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-bold w-24">Dạng</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-bold w-24">Mức</th>
                        <th className="px-3 py-2 text-center text-slate-500 font-bold w-14">Câu</th>
                        <th className="px-3 py-2 text-center text-slate-500 font-bold w-12">Xoá</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((row, idx) => (
                        <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-700 leading-snug">
                              {row.topicItem.topic}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={'px-2 py-1 rounded-lg border font-bold text-[11px] ' + (TYPE_COLORS[row.questionType] || '')}>
                              {TYPE_LABELS[row.questionType]}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={'px-2 py-1 rounded-lg font-semibold text-[11px] ' + (LEVEL_COLORS[row.level] || 'bg-slate-100 text-slate-600')}>
                              {row.level}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center font-extrabold text-blue-700">
                            {row.count}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => removeRow(row.id)}
                              className="p-1 rounded hover:bg-red-50 text-red-400"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <button
              onClick={handleGenerateWord}
              disabled={generatingWord || matrix.length === 0}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-extrabold text-sm flex flex-col items-center justify-center gap-1 shadow-lg disabled:opacity-50 transition-all"
            >
              {generatingWord ? (
                <React.Fragment>
                  <div className="flex items-center gap-2">
                    <Loader2 className="animate-spin" size={18} /> {progressMsg}
                  </div>
                  <span className="text-[10px] opacity-80 font-normal">
                    Quá trình này mất khoảng 10 đến 20 giây
                  </span>
                </React.Fragment>
              ) : (
                <div className="flex items-center gap-2">
                  <FileText size={18} /> Soạn và Tải file Word ({matrixStats.total > 0 ? matrixStats.total + ' câu' : '0 câu'})
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </React.Fragment>
  );
}
