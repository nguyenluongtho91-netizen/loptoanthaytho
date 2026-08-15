// @ts-nocheck
// src/components/ExamGeneratorView.tsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  BookOpen, Search, ChevronDown, ChevronRight, Plus, Trash2,
  GraduationCap, Layers, Wand2, Eye, Download, ExternalLink,
  X, Loader2, ArrowRight, Copy, Check, RefreshCw, Code,
  FileText, AlertTriangle, Edit3, Table2, Sparkles, Settings2,
} from 'lucide-react';
import { QuestionType } from '../types';
import { flattenTopics, TopicItem, DifficultyLevel } from '../data/topicData';
import { callGeminiPublic } from '../services/geminiService';
import { getAllTikzSnippets, getTikzSnippetsForTopic } from '../tikzSnippets';
import { compileFullTex, base64ToBlob, downloadBlob } from '../services/api';
import { EX_TEST_DETHI_TEMPLATE } from '../constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  [QuestionType.MULTICHOICE]: 'Trắc nghiệm',
  [QuestionType.TRUEFALSE]:   'Đúng / Sai',
  [QuestionType.SHORTANS]:    'Trả lời ngắn',
  [QuestionType.ESSAY]:       'Tự luận',
};

const SECTION_LABELS: Record<string, string> = {
  [QuestionType.MULTICHOICE]: 'TRẮC NGHIỆM',
  [QuestionType.TRUEFALSE]:   'ĐÚNG/SAI',
  [QuestionType.SHORTANS]:    'TRẢ LỜI NGẮN',
  [QuestionType.ESSAY]:       'TỰ LUẬN',
};

const SECTION_ORDER: QuestionType[] = [
  QuestionType.MULTICHOICE,
  QuestionType.TRUEFALSE,
  QuestionType.SHORTANS,
  QuestionType.ESSAY,
];

const TYPE_COLORS: Record<QuestionType, string> = {
  [QuestionType.MULTICHOICE]: 'bg-blue-100 text-blue-700 border-blue-200',
  [QuestionType.TRUEFALSE]:   'bg-green-100 text-green-700 border-green-200',
  [QuestionType.SHORTANS]:    'bg-orange-100 text-orange-700 border-orange-200',
  [QuestionType.ESSAY]:       'bg-purple-100 text-purple-700 border-purple-200',
};

const LEVEL_COLORS: Record<string, string> = {
  'Nhận biết':   'bg-sky-100 text-sky-700',
  'Thông hiểu':  'bg-teal-100 text-teal-700',
  'Vận dụng':    'bg-amber-100 text-amber-700',
  'Vận dụng cao':'bg-rose-100 text-rose-700',
};

const ALL_DIFFICULTY_LEVELS: DifficultyLevel[] = [
  'Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao',
];

const TEMPLATE_MARKER = '%=== THÊM CÂU HỎI TẠI ĐÂY ===';
function buildFullTex(body: string): string {
  const parts = EX_TEST_DETHI_TEMPLATE.split(TEMPLATE_MARKER);
  if (parts.length >= 2) return `${parts[0]}\n\n${body}\n\n${parts.slice(1).join(TEMPLATE_MARKER)}`;
  return `${EX_TEST_DETHI_TEMPLATE}\n\n${body}`;
}
function normalizeExBlocks(text: string): string {
  return text
    .replace(/```latex/g, '').replace(/```/g, '')
    .replace(/\\end\{ex\}\s*\\begin\{ex\}/g, '\\end{ex}\n\n\\begin{ex}')
    .replace(/\n{3,}/g, '\n\n').trim();
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface MatrixRow {
  id: string;
  topicItem: TopicItem;
  questionType: QuestionType;
  count: number;
  level: DifficultyLevel;
  includeSolution: boolean;
  includeTikz: boolean;
}

type PdfState = { url: string; blob: Blob; filename: string } | null;

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildExamPrompt(matrix: MatrixRow[]): string {
  // Group by section type
  const sections = SECTION_ORDER.filter(t => matrix.some(r => r.questionType === t));

  const sectionSpecs = sections.map(secType => {
    const rows = matrix.filter(r => r.questionType === secType);
    const totalCount = rows.reduce((s, r) => s + r.count, 0);
    const rowDesc = rows.map(r =>
      `  - "${r.topicItem.topic}" (${r.topicItem.grade}, mức: ${r.level}): ${r.count} câu`
    ).join('\n');

    let structureNote = '';
    let extraRule = '';
    if (secType === QuestionType.MULTICHOICE) {
      structureNote = `\\begin{ex}
Nội dung câu hỏi
\\choice
{Phương án A}
{\\True Phương án B đúng}
{Phương án C}
{Phương án D}
\\loigiai{Lời giải chi tiết}
\\end{ex}`;
      extraRule = 'KHÔNG viết A./B./C./D. trong ngoặc. Dùng \\True trước phương án đúng.';
    } else if (secType === QuestionType.TRUEFALSE) {
      structureNote = `\\begin{ex}
Đề dẫn câu hỏi
\\choiceTF[t]
{\\True Mệnh đề 1 (đúng)}
{Mệnh đề 2 (sai)}
{\\True Mệnh đề 3 (đúng)}
{Mệnh đề 4 (sai)}
\\loigiai{Lời giải cho từng mệnh đề}
\\end{ex}`;
      extraRule = 'KHÔNG viết a)/b)/c)/d) trong ngoặc. Đánh \\True trước mệnh đề đúng.';
    } else if (secType === QuestionType.SHORTANS) {
      structureNote = `\\begin{ex}
Nội dung câu hỏi
\\shortans{Đáp số}
\\loigiai{Lời giải chi tiết}
\\end{ex}`;
      extraRule = '';
    } else {
      structureNote = `\\begin{ex}
Nội dung câu hỏi (có thể nhiều phần a), b), c)...)
\\loigiai{Lời giải chi tiết đầy đủ}
\\end{ex}`;
      extraRule = '';
    }

    const anyTikz = rows.some(r => r.includeTikz);
    const anyNoSol = rows.some(r => !r.includeSolution);

    return `
=== PHẦN: ${SECTION_LABELS[secType]} (${totalCount} câu) ===
Chủ đề:
${rowDesc}

Cấu trúc bắt buộc:
${structureNote}
${extraRule ? `Lưu ý: ${extraRule}` : ''}
${anyTikz ? '📐 THÊM HÌNH TIKZ phù hợp trong \\begin{center}...\\end{center} khi hình giúp làm rõ bài toán.' : ''}
${anyNoSol ? '🚫 KHÔNG cần \\loigiai{} cho một số câu trong phần này.' : ''}`;
  }).join('\n');

  // TikZ snippets based on topics
  const topicNames = matrix.map(r => r.topicItem.topic).join(', ');
  const tikzSnippets = getTikzSnippetsForTopic(topicNames) || getAllTikzSnippets().slice(0, 2000);

  return `Bạn là chuyên gia biên soạn đề thi Toán THPT Việt Nam (Chương trình 2018).

🎯 NHIỆM VỤ: Tạo đề thi hoàn chỉnh theo ma trận sau.

=== MA TRẬN ĐỀ ===
${sectionSpecs}

=== FORMAT OUTPUT BẮT BUỘC ===
Xuất ra ĐÚNG theo cấu trúc này, có đủ các phần (nếu có trong ma trận):

\\section{TRẮC NGHIỆM}
[các câu \\begin{ex}...\\end{ex} dạng trắc nghiệm]

\\section{ĐÚNG/SAI}
[các câu \\begin{ex}...\\end{ex} dạng đúng/sai]

\\section{TRẢ LỜI NGẮN}
[các câu \\begin{ex}...\\end{ex} dạng trả lời ngắn]

\\section{TỰ LUẬN}
[các câu \\begin{ex}...\\end{ex} dạng tự luận]

=== QUY TẮC CHUNG ===
- Mỗi câu PHẢI có comment: %[Chủ đề - Mức độ]
- Công thức toán dùng $...$ (KHÔNG dùng \\(...\\) )
- Độ khó phù hợp với mức độ đã chỉ định
- Nội dung bám sát chuẩn CTGDPT 2018

📎 KHO MẪU TIKZ (tham khảo khi cần vẽ hình):
${tikzSnippets.slice(0, 3000)}

🔴 OUTPUT: CHỈ trả về LaTeX thuần (\\section{...} và \\begin{ex}...\\end{ex}). KHÔNG giải thích, KHÔNG markdown.`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center gap-1 text-xs">
      {copied ? <><Check size={13} className="text-green-500" /> Đã chép</> : <><Copy size={13} /> Sao chép</>}
    </button>
  );
}

function PdfModal({ pdf, onClose, onDownload }: { pdf: PdfState; onClose: () => void; onDownload: () => void }) {
  if (!pdf) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <span className="font-extrabold text-slate-800 flex items-center gap-2"><Eye size={16} className="text-teal-600" />Xem trước PDF</span>
          <div className="flex gap-2">
            <button onClick={() => window.open(pdf.url, '_blank')} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-sm flex items-center gap-1.5"><ExternalLink size={13} />Mở tab mới</button>
            <button onClick={onDownload} className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm flex items-center gap-1.5"><Download size={13} />Tải PDF</button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
          </div>
        </div>
        <div className="h-[74vh]"><iframe src={pdf.url} className="w-full h-full" title="pdf" /></div>
        <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">Nếu không hiển thị, dùng "Mở tab mới" hoặc "Tải PDF".</div>
      </div>
    </div>
  );
}

// ─── Add-to-Matrix Popup ──────────────────────────────────────────────────────

interface AddTopicPopupProps {
  topic: TopicItem;
  onAdd: (row: Omit<MatrixRow, 'id'>) => void;
  onClose: () => void;
}

function AddTopicPopup({ topic, onAdd, onClose }: AddTopicPopupProps) {
  const [qType, setQType] = useState<QuestionType>(QuestionType.MULTICHOICE);
  const [count, setCount] = useState(3);
  const [level, setLevel] = useState<DifficultyLevel>(topic.levels[topic.levels.length > 1 ? 1 : 0]);
  const [inclSol, setInclSol] = useState(true);
  const [inclTikz, setInclTikz] = useState(false);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <div className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <Plus size={15} className="text-teal-600" /> Thêm vào ma trận
            </div>
            <div className="text-xs text-slate-400 mt-0.5">{topic.grade} · {topic.chapter}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100"><X size={16} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Topic name */}
          <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600 leading-relaxed font-medium border border-slate-100">
            {topic.topic}
          </div>

          {/* Question type */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-2 block">Dạng câu hỏi</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.values(QuestionType).map(t => (
                <button key={t} onClick={() => setQType(t)}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                    qType === t ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-300'
                  }`}>
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Count */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-2 block">Số câu hỏi</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setCount(c => Math.max(1, c - 1))}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-lg flex items-center justify-center transition-all">
                −
              </button>
              <input
                type="number"
                min={1}
                max={99}
                value={count}
                onChange={e => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1 && v <= 99) setCount(v);
                }}
                className="flex-1 text-center py-2 rounded-xl border border-slate-200 font-extrabold text-teal-700 text-lg outline-none focus:ring-2 focus:ring-teal-400 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button onClick={() => setCount(c => Math.min(99, c + 1))}
                className="w-9 h-9 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-bold text-lg flex items-center justify-center transition-all">
                +
              </button>
              <div className="flex gap-1">
                {[3, 5, 10].map(n => (
                  <button key={n} onClick={() => setCount(n)}
                    className={`px-2.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                      count === n ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-teal-300'
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Level */}
          <div>
            <label className="text-xs font-bold text-slate-600 mb-2 block">Mức độ</label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALL_DIFFICULTY_LEVELS.map(lv => (
                <button key={lv} onClick={() => setLevel(lv)}
                  className={`py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                    level === lv
                      ? 'bg-teal-600 text-white border-teal-600'
                      : topic.levels.includes(lv)
                        ? 'bg-slate-50 text-slate-700 border-slate-200 hover:border-teal-300'
                        : 'bg-slate-50 text-slate-400 border-slate-100 opacity-50'
                  }`}>
                  {lv}
                </button>
              ))}
            </div>
            {!topic.levels.includes(level) && (
              <p className="text-xs text-amber-600 mt-1">⚠ Mức này không có trong chuẩn — AI sẽ tự điều chỉnh.</p>
            )}
          </div>

          {/* Options */}
          <div className="flex gap-4">
            {[
              { key: 'sol', label: 'Kèm lời giải', val: inclSol, set: setInclSol },
              { key: 'tikz', label: 'Yêu cầu hình TikZ', val: inclTikz, set: setInclTikz },
            ].map(opt => (
              <label key={opt.key} className="flex items-center gap-2 cursor-pointer text-sm text-slate-700">
                <div className="relative">
                  <input type="checkbox" checked={opt.val} onChange={e => opt.set(e.target.checked)}
                    className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-slate-300 checked:bg-teal-600 checked:border-teal-600" />
                  <Check size={10} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" />
                </div>
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50">Huỷ</button>
          <button onClick={() => { onAdd({ topicItem: topic, questionType: qType, count, level, includeSolution: inclSol, includeTikz: inclTikz }); onClose(); }}
            className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2">
            <Plus size={15} /> Thêm vào ma trận
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ExamGeneratorViewProps {
  onTransferToCompile?: (latex: string) => void;
}

const ExamGeneratorView: React.FC<ExamGeneratorViewProps> = ({ onTransferToCompile }) => {
  const allTopics = useMemo(() => flattenTopics(), []);
  const allGrades  = useMemo(() => [...new Set(allTopics.map(t => t.grade))], [allTopics]);

  const [activeGrade, setActiveGrade]         = useState<string>(allGrades[0] ?? 'Lớp 6');
  const [searchQuery, setSearchQuery]         = useState('');
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [pendingTopic, setPendingTopic]       = useState<TopicItem | null>(null);
  const [matrix, setMatrix]                   = useState<MatrixRow[]>([]);
  const [generating, setGenerating]           = useState(false);
  const [result, setResult]                   = useState('');
  const [editedResult, setEditedResult]       = useState('');
  const [isEditing, setIsEditing]             = useState(false);
  const [compiling, setCompiling]             = useState(false);
  const [pdf, setPdf]                         = useState<PdfState>(null);
  const [showPdf, setShowPdf]                 = useState(false);
  const [log, setLog]                         = useState('');
  const resultRef = useRef<HTMLDivElement>(null);

  // Cleanup objectURL
  useEffect(() => () => { if (pdf?.url) URL.revokeObjectURL(pdf.url); }, []);

  // ── Derived: filtered topics ───────────────────────────────────────────────
  const filteredTopics = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allTopics.filter(t => {
      const matchGrade = !q && t.grade === activeGrade;
      const matchSearch = q && (
        t.topic.toLowerCase().includes(q) ||
        t.chapter.toLowerCase().includes(q) ||
        t.domain.toLowerCase().includes(q) ||
        t.grade.toLowerCase().includes(q)
      );
      return matchGrade || matchSearch;
    });
  }, [allTopics, activeGrade, searchQuery]);

  // ── Grouped for tree view ─────────────────────────────────────────────────
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

  // ── Matrix stats ──────────────────────────────────────────────────────────
  const matrixStats = useMemo(() => {
    const byType: Partial<Record<QuestionType, number>> = {};
    let total = 0;
    for (const row of matrix) {
      byType[row.questionType] = (byType[row.questionType] ?? 0) + row.count;
      total += row.count;
    }
    return { byType, total };
  }, [matrix]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const addToMatrix = useCallback((data: Omit<MatrixRow, 'id'>) => {
    setMatrix(prev => [...prev, { ...data, id: `row_${Date.now()}` }]);
  }, []);

  const removeRow = useCallback((id: string) => {
    setMatrix(prev => prev.filter(r => r.id !== id));
  }, []);

  const moveRow = useCallback((id: string, dir: -1 | 1) => {
    setMatrix(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
  }, []);

  const toggleDomain = (key: string) => setExpandedDomains(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });
  const toggleChapter = (key: string) => setExpandedChapters(prev => {
    const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  // ── Generate ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (matrix.length === 0) { alert('Vui lòng thêm ít nhất 1 chủ đề vào ma trận!'); return; }
    setGenerating(true);
    setResult('');
    setLog('');
    setIsEditing(false);
    try {
      const prompt = buildExamPrompt(matrix);
      const raw    = await callGeminiPublic(prompt);
      const latex  = normalizeExBlocks(raw);
      setResult(latex);
      setEditedResult(latex);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (e: any) {
      alert(`❌ Lỗi AI: ${e?.message || 'Không xác định'}`);
    } finally {
      setGenerating(false);
    }
  }, [matrix]);

  const currentLatex = isEditing ? editedResult : result;
  const countBlocks  = (tex: string) => (tex.match(/\\begin\{ex\}/g) || []).length;

  // ── Compile ───────────────────────────────────────────────────────────────
  const handleCompile = useCallback(async () => {
    if (!currentLatex) return;
    setCompiling(true);
    setLog('Đang biên dịch…');
    try {
      const tex  = buildFullTex(currentLatex);
      const data = await compileFullTex({ tex, engine: 'pdflatex', returnLog: true });
      if (!data?.ok) { setLog(data?.detail || data?.log || 'Compile thất bại'); alert('❌ Lỗi biên dịch. Xem LOG.'); return; }
      setLog(data.log || '✅ Thành công');
      if (data.base64) {
        const blob = base64ToBlob(data.base64, 'application/pdf');
        const url  = URL.createObjectURL(blob);
        if (pdf?.url) URL.revokeObjectURL(pdf.url);
        const filename = `de_thi_${Date.now()}.pdf`;
        setPdf({ url, blob, filename });
        setShowPdf(true);
      }
    } catch (e: any) {
      const msg = e?.message || 'Lỗi compile';
      setLog(msg); alert(`❌ ${msg}`);
    } finally { setCompiling(false); }
  }, [currentLatex, pdf]);

  const handleDownloadTex = () => {
    if (!currentLatex) return;
    const blob = new Blob([currentLatex], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `de_thi_${Date.now()}.tex` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {pendingTopic && (
        <AddTopicPopup
          topic={pendingTopic}
          onAdd={addToMatrix}
          onClose={() => setPendingTopic(null)}
        />
      )}
      <PdfModal pdf={showPdf ? pdf : null} onClose={() => setShowPdf(false)} onDownload={() => pdf && downloadBlob(pdf.blob, pdf.filename)} />

      <div className="space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="font-extrabold text-slate-800 flex items-center gap-2 mb-1">
            <GraduationCap size={20} className="text-teal-600" /> Tạo đề thi theo ma trận
          </div>
          <p className="text-sm text-slate-500">
            Duyệt chủ đề theo lớp → thêm vào ma trận với dạng câu hỏi & số câu → AI tạo đề có{' '}
            <code className="px-1 bg-slate-100 rounded text-xs">\section{'{'}..{'}'}</code> chuẩn.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          {/* ──────────── LEFT: Topic Browser ──────────── */}
          <div className="xl:col-span-2 space-y-3">
            {/* Search */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setExpandedDomains(new Set()); setExpandedChapters(new Set()); }}
                  placeholder="Tìm kiếm chủ đề, chương, lĩnh vực..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-400"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-lg">
                    <X size={13} className="text-slate-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Grade tabs - only show when not searching */}
            {!searchQuery && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3">
                <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                  <BookOpen size={12} /> Chọn lớp
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {allGrades.map(g => (
                    <button key={g} onClick={() => { setActiveGrade(g); setExpandedDomains(new Set()); setExpandedChapters(new Set()); }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        activeGrade === g ? 'bg-teal-600 text-white border-teal-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-teal-300'
                      }`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Topic tree */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                  <Layers size={12} />
                  {searchQuery ? `${filteredTopics.length} kết quả tìm kiếm` : `Chủ đề ${activeGrade}`}
                </span>
                {grouped.size > 0 && (
                  <button onClick={() => {
                    const domainKeys = [...grouped.keys()];
                    const allExpanded = domainKeys.every(k => expandedDomains.has(k));
                    if (allExpanded) { setExpandedDomains(new Set()); setExpandedChapters(new Set()); }
                    else { setExpandedDomains(new Set(domainKeys)); }
                  }} className="text-xs text-teal-600 hover:text-teal-800 font-semibold">
                    {[...grouped.keys()].every(k => expandedDomains.has(k)) ? 'Thu gọn' : 'Mở rộng tất cả'}
                  </button>
                )}
              </div>

              <div className="max-h-[520px] overflow-y-auto">
                {grouped.size === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    {searchQuery ? 'Không tìm thấy chủ đề phù hợp.' : 'Không có dữ liệu.'}
                  </div>
                ) : (
                  [...grouped.entries()].map(([domain, chapters]) => {
                    const domainKey = `${activeGrade}::${domain}`;
                    const isDomainExpanded = expandedDomains.has(domainKey) || !!searchQuery;
                    return (
                      <div key={domain} className="border-b border-slate-50 last:border-0">
                        {/* Domain header */}
                        <button onClick={() => toggleDomain(domainKey)}
                          className="w-full flex items-center gap-2 px-4 py-3 bg-slate-50 hover:bg-teal-50 text-left transition-colors">
                          {isDomainExpanded
                            ? <ChevronDown size={14} className="text-teal-600 flex-shrink-0" />
                            : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
                          <span className="text-xs font-extrabold text-teal-700 uppercase tracking-wide">{domain}</span>
                          <span className="ml-auto text-xs bg-teal-100 text-teal-600 px-2 py-0.5 rounded-full font-bold">
                            {[...chapters.values()].reduce((s, a) => s + a.length, 0)}
                          </span>
                        </button>

                        {isDomainExpanded && (
                          <div className="pl-2">
                            {[...chapters.entries()].map(([chapter, topics]) => {
                              const chapKey = `${domainKey}::${chapter}`;
                              const isChapExpanded = expandedChapters.has(chapKey) || !!searchQuery;
                              return (
                                <div key={chapter}>
                                  {/* Chapter header */}
                                  <button onClick={() => toggleChapter(chapKey)}
                                    className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-50 text-left transition-colors">
                                    {isChapExpanded
                                      ? <ChevronDown size={12} className="text-slate-400 flex-shrink-0" />
                                      : <ChevronRight size={12} className="text-slate-300 flex-shrink-0" />}
                                    <span className="text-xs font-bold text-slate-700">{chapter}</span>
                                    <span className="ml-auto text-xs text-slate-400 font-semibold">{topics.length}</span>
                                  </button>

                                  {isChapExpanded && (
                                    <div className="pl-4">
                                      {topics.map(topic => (
                                        <button key={topic.id} onClick={() => setPendingTopic(topic)}
                                          className="w-full text-left flex items-start gap-2 px-3 py-2.5 hover:bg-teal-50 border-l-2 border-transparent hover:border-teal-400 transition-all group">
                                          <Plus size={13} className="text-slate-300 group-hover:text-teal-500 flex-shrink-0 mt-0.5 transition-colors" />
                                          <div className="min-w-0">
                                            <p className="text-xs text-slate-700 leading-snug group-hover:text-teal-800 break-words">
                                              {topic.topic}
                                            </p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {topic.levels.map(lv => (
                                                <span key={lv} className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${LEVEL_COLORS[lv] ?? 'bg-slate-100 text-slate-500'}`}>
                                                  {lv}
                                                </span>
                                              ))}
                                            </div>
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

          {/* ──────────── RIGHT: Matrix + Result ──────────── */}
          <div className="xl:col-span-3 space-y-3">
            {/* Matrix table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
                <div className="font-bold text-slate-700 text-sm flex items-center gap-2">
                  <Table2 size={15} className="text-teal-600" />
                  Ma trận đề
                  {matrixStats.total > 0 && (
                    <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-bold">
                      {matrixStats.total} câu tổng
                    </span>
                  )}
                </div>
                {/* Stats badges */}
                <div className="flex flex-wrap gap-1.5">
                  {SECTION_ORDER.filter(t => matrixStats.byType[t]).map(t => (
                    <span key={t} className={`text-xs px-2 py-0.5 rounded-full font-bold border ${TYPE_COLORS[t]}`}>
                      {SECTION_LABELS[t]}: {matrixStats.byType[t]}
                    </span>
                  ))}
                </div>
              </div>

              {matrix.length === 0 ? (
                <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
                  <Table2 size={40} className="opacity-20" />
                  <p className="text-sm font-medium">Chưa có chủ đề nào trong ma trận</p>
                  <p className="text-xs opacity-70">Click vào chủ đề bên trái để thêm vào</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-3 py-2 text-left text-slate-500 font-bold w-6">#</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-bold">Chủ đề</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-bold w-28">Dạng</th>
                        <th className="px-3 py-2 text-left text-slate-500 font-bold w-24">Mức</th>
                        <th className="px-3 py-2 text-center text-slate-500 font-bold w-14">Câu</th>
                        <th className="px-3 py-2 text-center text-slate-500 font-bold w-16">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((row, idx) => (
                        <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-slate-700 leading-snug">{row.topicItem.topic.slice(0, 70)}{row.topicItem.topic.length > 70 ? '…' : ''}</div>
                            <div className="text-slate-400 mt-0.5">{row.topicItem.grade} · {row.topicItem.chapter.slice(0, 30)}</div>
                            <div className="flex gap-1 mt-1">
                              {row.includeSolution && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded font-bold">Lời giải</span>}
                              {row.includeTikz && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded font-bold">TikZ</span>}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-1 rounded-lg border font-bold text-[11px] ${TYPE_COLORS[row.questionType]}`}>
                              {TYPE_LABELS[row.questionType]}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-1 rounded-lg font-semibold text-[11px] ${LEVEL_COLORS[row.level] ?? 'bg-slate-100 text-slate-600'}`}>
                              {row.level}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center font-extrabold text-teal-700">{row.count}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => moveRow(row.id, -1)} disabled={idx === 0}
                                className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20 text-[10px] font-bold">▲</button>
                              <button onClick={() => moveRow(row.id, 1)} disabled={idx === matrix.length - 1}
                                className="p-1 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20 text-[10px] font-bold">▼</button>
                              <button onClick={() => removeRow(row.id)} className="p-1 rounded hover:bg-red-50 text-red-400">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-teal-50">
                        <td colSpan={4} className="px-3 py-2 font-bold text-teal-700 text-xs text-right">Tổng số câu:</td>
                        <td className="px-3 py-2 text-center font-extrabold text-teal-700 text-sm">{matrixStats.total}</td>
                        <td className="px-3 py-2 text-center">
                          <button onClick={() => setMatrix([])} className="text-xs text-red-400 hover:text-red-600 font-bold">Xóa tất</button>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Generate button */}
            <button onClick={handleGenerate} disabled={generating || matrix.length === 0}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 transition-all">
              {generating
                ? <><Loader2 size={18} className="animate-spin" /> Gemini AI đang tạo đề ({matrixStats.total} câu)…</>
                : <><Sparkles size={18} /> Tạo đề với AI ({matrixStats.total > 0 ? `${matrixStats.total} câu` : 'Chưa có ma trận'})</>}
            </button>

            {/* Result area */}
            {(result || generating) && (
              <div ref={resultRef} className="space-y-3">
                {generating && (
                  <div className="bg-white rounded-2xl border border-teal-100 p-12 flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full border-4 border-teal-100 border-t-teal-600 animate-spin" />
                      <Sparkles size={20} className="text-teal-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-slate-700">Đang tạo {matrixStats.total} câu hỏi…</p>
                      <p className="text-xs text-slate-400 mt-1">Thời gian phụ thuộc số câu và độ phức tạp</p>
                    </div>
                  </div>
                )}

                {result && !generating && (
                  <>
                    {/* Toolbar */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2 items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Code size={15} className="text-teal-600" />
                        <span className="font-bold text-slate-800 text-sm">
                          {countBlocks(currentLatex)} câu — {[...new Set(matrix.map(r => r.topicItem.grade))].join(', ')}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <CopyBtn text={currentLatex} />
                        <button onClick={handleDownloadTex} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5">
                          <Download size={13} /> .tex
                        </button>
                        <button onClick={handleCompile} disabled={compiling} className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-60">
                          {compiling ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
                          Xem PDF
                        </button>
                        {pdf && (
                          <button onClick={() => pdf && downloadBlob(pdf.blob, pdf.filename)} className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5">
                            <Download size={13} /> PDF
                          </button>
                        )}
                        {onTransferToCompile && (
                          <button onClick={() => onTransferToCompile(currentLatex)} className="px-3 py-1.5 rounded-xl border border-teal-300 text-teal-700 hover:bg-teal-50 font-bold text-xs flex items-center gap-1.5">
                            <ArrowRight size={13} /> Sang Biên dịch
                          </button>
                        )}
                        <button onClick={handleGenerate} disabled={generating} className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs flex items-center gap-1.5">
                          <RefreshCw size={13} /> Tạo lại
                        </button>
                      </div>
                    </div>

                    {/* Code block */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                        <span className="text-xs font-semibold text-slate-500 font-mono">
                          LaTeX — {countBlocks(currentLatex)} × \begin&#123;ex&#125; · \section&#123;...&#125; phân loại
                        </span>
                        <button onClick={() => { setIsEditing(e => !e); if (!isEditing) setEditedResult(result); }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold ${isEditing ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                          <Edit3 size={12} className="inline mr-1" />{isEditing ? 'Đang chỉnh sửa' : 'Chỉnh sửa'}
                        </button>
                      </div>
                      {isEditing
                        ? <textarea value={editedResult} onChange={e => setEditedResult(e.target.value)}
                            className="w-full h-[440px] p-4 font-mono text-xs text-slate-700 outline-none resize-none border-0 focus:ring-2 focus:ring-teal-400" spellCheck={false} />
                        : <pre className="text-xs font-mono p-4 overflow-auto max-h-[440px] text-slate-700 leading-relaxed whitespace-pre-wrap break-all">{result}</pre>
                      }
                    </div>

                    {/* Log */}
                    {log && (
                      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
                        <div className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-2"><FileText size={12} />LOG biên dịch</div>
                        <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap max-h-[200px] overflow-auto leading-relaxed">{log}</pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ExamGeneratorView;
