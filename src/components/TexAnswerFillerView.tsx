// src/components/TexAnswerFillerView.tsx
import React, { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, CheckCircle, XCircle, AlertTriangle,
  Eye, Download, ExternalLink, X, Wand2, Loader2,
  LayoutGrid, CheckSquare, MessageSquare, PenLine,
  ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react';
import { compileFullTex, base64ToBlob, downloadBlob } from '../services/api';
import { EX_TEST_DETHI_TEMPLATE } from '../constants';

// ─── Types ───────────────────────────────────────────────────────────────────

type QType = 'multichoice' | 'truefalse' | 'shortans' | 'essay';

interface MCDetail {
  type: 'multichoice';
  options: string[];           // 4 option texts (stripped of \True)
  answer: string | null;       // 'A'|'B'|'C'|'D'|null
}
interface TFDetail {
  type: 'truefalse';
  statements: string[];        // 4 statement texts (stripped of \True)
  answers: (boolean | null)[]; // true/false/null per statement
}
interface SADetail {
  type: 'shortans';
  answer: string;              // current answer text
}
interface EssayDetail { type: 'essay' }

type QDetail = MCDetail | TFDetail | SADetail | EssayDetail;

interface ParsedQuestion {
  index: number;           // 1-based sequence
  raw: string;             // original \begin{ex}...\end{ex} text
  detail: QDetail;
  hasAnswer: boolean;
  collapsed: boolean;
}

type PdfState = { url: string; blob: Blob; filename: string } | null;

// ─── Constants ───────────────────────────────────────────────────────────────

const TEMPLATE_MARKER = '%=== THÊM CÂU HỎI TẠI ĐÂY ===';
const MC_LABELS = ['A', 'B', 'C', 'D'] as const;

// ─── Helpers – Parsing ───────────────────────────────────────────────────────

/** Extract brace-balanced args after a position */
function extractBraceArgs(text: string, start: number, count: number): string[] {
  const args: string[] = [];
  let i = start;
  for (let n = 0; n < count; n++) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length || text[i] !== '{') break;
    let depth = 0, argStart = i + 1, j = i;
    while (j < text.length) {
      const ch = text[j];
      if (ch === '\\' && j + 1 < text.length && (text[j + 1] === '{' || text[j + 1] === '}')) { j += 2; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) { args.push(text.slice(argStart, j)); i = j + 1; break; } }
      j++;
    }
    if (depth !== 0) break;
  }
  return args;
}

/** Remove \True prefix from an option string */
function stripTrue(s: string): string {
  return s.replace(/^\\True\s*/, '').trim();
}

/** Find all \begin{ex}...\end{ex} blocks */
function extractExBlocks(tex: string): string[] {
  const blocks: string[] = [];
  const beginTag = '\\begin{ex}';
  const endTag = '\\end{ex}';
  let pos = 0;
  while (true) {
    const start = tex.indexOf(beginTag, pos);
    if (start === -1) break;
    const end = tex.indexOf(endTag, start);
    if (end === -1) break;
    blocks.push(tex.slice(start, end + endTag.length));
    pos = end + endTag.length;
  }
  return blocks;
}

/** Parse a single \begin{ex}...\end{ex} block */
function parseExBlock(raw: string, index: number): ParsedQuestion {
  // ── Multiple choice ─────────────────────────────────────────────────────
  const choiceMatch = raw.match(/\\choice(?:\s|$)/);
  if (choiceMatch) {
    const afterChoice = raw.indexOf('\\choice') + '\\choice'.length;
    const rawArgs = extractBraceArgs(raw, afterChoice, 4);
    const options = rawArgs.map(stripTrue);
    const answerIdx = rawArgs.findIndex(a => a.trimStart().startsWith('\\True'));
    const answer = answerIdx >= 0 ? MC_LABELS[answerIdx] : null;
    return {
      index, raw,
      detail: { type: 'multichoice', options, answer },
      hasAnswer: answer !== null,
      collapsed: true,
    };
  }

  // ── True/False ───────────────────────────────────────────────────────────
  const tfMatch = raw.match(/\\choiceTF(\[.*?\])?/);
  if (tfMatch) {
    const afterTF = raw.indexOf(tfMatch[0]) + tfMatch[0].length;
    const rawArgs = extractBraceArgs(raw, afterTF, 4);
    const statements = rawArgs.map(stripTrue);
    const answers: (boolean | null)[] = rawArgs.map(a =>
      rawArgs.length > 0 ? a.trimStart().startsWith('\\True') : null
    );
    const hasAnswer = rawArgs.length === 4; // considered answered if 4 args present
    return {
      index, raw,
      detail: { type: 'truefalse', statements, answers },
      hasAnswer,
      collapsed: true,
    };
  }

  // ── Short answer ─────────────────────────────────────────────────────────
  const saMatch = raw.match(/\\shortans\{/);
  if (saMatch) {
    const saStart = raw.indexOf('\\shortans{') + '\\shortans{'.length;
    let depth = 1, j = saStart, ans = '';
    while (j < raw.length && depth > 0) {
      if (raw[j] === '{') depth++;
      else if (raw[j] === '}') { depth--; if (depth === 0) break; }
      if (depth > 0) ans += raw[j];
      j++;
    }
    const answer = ans.trim();
    return {
      index, raw,
      detail: { type: 'shortans', answer },
      hasAnswer: answer.length > 0,
      collapsed: true,
    };
  }

  // ── Essay ─────────────────────────────────────────────────────────────────
  return {
    index, raw,
    detail: { type: 'essay' },
    hasAnswer: true,
    collapsed: true,
  };
}

// ─── Helpers – Reconstruction ─────────────────────────────────────────────────

function rebuildChoice(raw: string, answer: string | null): string {
  if (!answer) return raw;
  const answerIdx = MC_LABELS.indexOf(answer as typeof MC_LABELS[number]);
  if (answerIdx < 0) return raw;

  const choicePos = raw.indexOf('\\choice');
  if (choicePos < 0) return raw;
  const afterChoice = choicePos + '\\choice'.length;
  const rawArgs = extractBraceArgs(raw, afterChoice, 4);
  if (rawArgs.length < 4) return raw;

  // Find original arg positions in raw string
  let i = afterChoice;
  const positions: Array<{ open: number; close: number }> = [];
  for (let n = 0; n < 4; n++) {
    while (i < raw.length && /\s/.test(raw[i])) i++;
    if (raw[i] !== '{') break;
    let depth = 0, j = i;
    while (j < raw.length) {
      if (raw[j] === '\\' && j + 1 < raw.length && (raw[j + 1] === '{' || raw[j + 1] === '}')) { j += 2; continue; }
      if (raw[j] === '{') depth++;
      else if (raw[j] === '}') { depth--; if (depth === 0) { positions.push({ open: i, close: j }); i = j + 1; break; } }
      j++;
    }
  }
  if (positions.length < 4) return raw;

  // Rebuild
  let result = raw.slice(0, positions[0].open);
  for (let idx = 0; idx < 4; idx++) {
    const stripped = stripTrue(rawArgs[idx]);
    const prefix = idx === answerIdx ? '{\\True ' : '{';
    result += `${prefix}${stripped}}`;
    if (idx < 3) {
      result += raw.slice(positions[idx].close + 1, positions[idx + 1].open);
    }
  }
  result += raw.slice(positions[3].close + 1);
  return result;
}

function rebuildChoiceTF(raw: string, tfMatch: string, answers: (boolean | null)[], statements: string[]): string {
  const tfPos = raw.indexOf(tfMatch);
  if (tfPos < 0) return raw;
  const afterTF = tfPos + tfMatch.length;
  const rawArgs = extractBraceArgs(raw, afterTF, 4);
  if (rawArgs.length < 4) return raw;

  let i = afterTF;
  const positions: Array<{ open: number; close: number }> = [];
  for (let n = 0; n < 4; n++) {
    while (i < raw.length && /\s/.test(raw[i])) i++;
    if (raw[i] !== '{') break;
    let depth = 0, j = i;
    while (j < raw.length) {
      if (raw[j] === '\\' && j + 1 < raw.length && (raw[j + 1] === '{' || raw[j + 1] === '}')) { j += 2; continue; }
      if (raw[j] === '{') depth++;
      else if (raw[j] === '}') { depth--; if (depth === 0) { positions.push({ open: i, close: j }); i = j + 1; break; } }
      j++;
    }
  }
  if (positions.length < 4) return raw;

  let result = raw.slice(0, positions[0].open);
  for (let idx = 0; idx < 4; idx++) {
    const isTrue = answers[idx] === true;
    const content = statements[idx] || stripTrue(rawArgs[idx]);
    const prefix = isTrue ? '{\\True ' : '{';
    result += `${prefix}${content}}`;
    if (idx < 3) result += raw.slice(positions[idx].close + 1, positions[idx + 1].open);
  }
  result += raw.slice(positions[3].close + 1);
  return result;
}

function rebuildShortAns(raw: string, answer: string): string {
  return raw.replace(/\\shortans\{[^}]*\}/, `\\shortans{${answer}}`);
}

function reconstructQuestion(q: ParsedQuestion): string {
  const d = q.detail;
  if (d.type === 'multichoice') return rebuildChoice(q.raw, d.answer);
  if (d.type === 'truefalse') {
    const tfMatch = q.raw.match(/\\choiceTF(\[.*?\])?/);
    if (tfMatch) return rebuildChoiceTF(q.raw, tfMatch[0], d.answers, d.statements);
    return q.raw;
  }
  if (d.type === 'shortans') return rebuildShortAns(q.raw, d.answer);
  return q.raw;
}

function buildFullTex(body: string): string {
  const parts = EX_TEST_DETHI_TEMPLATE.split(TEMPLATE_MARKER);
  if (parts.length >= 2) return `${parts[0]}\n\n${body}\n\n${parts.slice(1).join(TEMPLATE_MARKER)}`;
  return `${EX_TEST_DETHI_TEMPLATE}\n\n${body}`;
}

/**
 * Thay \includegraphics[...]{...} bằng \fbox placeholder để tránh lỗi compile.
 * Chỉ dùng khi compile preview — KHÔNG áp lên file .tex xuất ra.
 */
function replaceIncludegraphics(tex: string): string {
  return tex.replace(
    /\\includegraphics(\[[^\]]*\])?\{([^}]*)\}/g,
    (_match, _opts, filename) => {
      const shortName = (filename as string).split(/[/\\]/).pop() || filename;
      return `\\fbox{\\parbox{5cm}{\\centering\\small\\texttt{[HINH: ${shortName}]}}}`;
    }
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PdfModal({ pdf, onClose, onDownload }: { pdf: PdfState; onClose: () => void; onDownload: () => void }) {
  if (!pdf) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <span className="font-extrabold text-slate-800 flex items-center gap-2">
            <Eye size={16} className="text-teal-600" /> Xem trước PDF
          </span>
          <div className="flex items-center gap-2">
            <button onClick={() => window.open(pdf.url, '_blank')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 flex items-center gap-1.5 text-sm">
              <ExternalLink size={14} /> Mở tab mới
            </button>
            <button onClick={onDownload}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 text-sm">
              <Download size={14} /> Tải PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100"><X size={18} /></button>
          </div>
        </div>
        <div className="h-[74vh]"><iframe src={pdf.url} className="w-full h-full" title="pdf" /></div>
        <div className="px-4 py-2 border-t border-slate-200 text-xs text-slate-400">Nếu không hiển thị, dùng "Mở tab mới".</div>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: QType }) {
  const map: Record<QType, { label: string; icon: React.ReactNode; cls: string }> = {
    multichoice: { label: 'Trắc nghiệm', icon: <LayoutGrid size={11} />, cls: 'bg-blue-100 text-blue-700' },
    truefalse:   { label: 'Đúng/Sai',    icon: <CheckSquare size={11} />, cls: 'bg-green-100 text-green-700' },
    shortans:    { label: 'Trả lời ngắn',icon: <MessageSquare size={11} />, cls: 'bg-orange-100 text-orange-700' },
    essay:       { label: 'Tự luận',     icon: <PenLine size={11} />,  cls: 'bg-purple-100 text-purple-700' },
  };
  const m = map[type];
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${m.cls}`}>
      {m.icon} {m.label}
    </span>
  );
}

// ─── Question card ────────────────────────────────────────────────────────────

interface QuestionCardProps {
  q: ParsedQuestion;
  onChange: (updated: ParsedQuestion) => void;
}

function QuestionCard({ q, onChange }: QuestionCardProps) {
  const d = q.detail;

  const setCollapsed = (c: boolean) => onChange({ ...q, collapsed: c });

  const header = (
    <div
      className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
      onClick={() => setCollapsed(!q.collapsed)}
    >
      <div className="flex items-center gap-3">
        <span className="font-extrabold text-slate-700 text-sm w-14 shrink-0">Câu {q.index}</span>
        <TypeBadge type={d.type} />
        {q.hasAnswer
          ? <CheckCircle size={15} className="text-green-500 shrink-0" />
          : <AlertTriangle size={15} className="text-amber-500 shrink-0" />}
        {!q.hasAnswer && (
          <span className="text-xs text-amber-600 font-semibold">Chưa có đáp án</span>
        )}
      </div>
      <button className="text-slate-400 hover:text-slate-700">
        {q.collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>
    </div>
  );

  if (q.collapsed) return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {header}
    </div>
  );

  // ── MC ─────────────────────────────────────────────────────────────────────
  if (d.type === 'multichoice') {
    const setAnswer = (ans: string) => {
      onChange({ ...q, detail: { ...d, answer: ans }, hasAnswer: true });
    };
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        {header}
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2">
          {d.options.length === 4 ? (
            <div className="grid grid-cols-2 gap-2">
              {MC_LABELS.map((lbl, idx) => {
                const isSelected = d.answer === lbl;
                return (
                  <button key={lbl} onClick={() => setAnswer(lbl)}
                    className={`text-left px-3 py-2 rounded-xl border text-sm transition-all ${
                      isSelected
                        ? 'border-teal-400 bg-teal-50 font-bold text-teal-800 ring-1 ring-teal-300'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
                    }`}>
                    <span className="font-extrabold mr-2">{lbl}.</span>
                    <span className="font-mono text-xs">{d.options[idx] || '(trống)'}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 italic">Không parse được options.</p>
          )}
        </div>
      </div>
    );
  }

  // ── TF ─────────────────────────────────────────────────────────────────────
  if (d.type === 'truefalse') {
    const setTF = (idx: number, val: boolean) => {
      const newAns = [...d.answers] as (boolean | null)[];
      newAns[idx] = val;
      onChange({ ...q, detail: { ...d, answers: newAns }, hasAnswer: true });
    };
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        {header}
        <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-2">
          {(['a', 'b', 'c', 'd'] as const).map((lbl, idx) => (
            <div key={lbl} className="flex items-start gap-3 p-2 rounded-xl border border-slate-100 hover:bg-slate-50">
              <span className="font-extrabold text-slate-600 text-sm w-5 shrink-0">{lbl}.</span>
              <span className="text-xs font-mono text-slate-700 flex-1 leading-relaxed">
                {d.statements[idx] || '(trống)'}
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => setTF(idx, true)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    d.answers[idx] === true
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-green-100'
                  }`}>Đúng</button>
                <button onClick={() => setTF(idx, false)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    d.answers[idx] === false
                      ? 'bg-red-400 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-red-100'
                  }`}>Sai</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── SA ─────────────────────────────────────────────────────────────────────
  if (d.type === 'shortans') {
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
        {header}
        <div className="px-4 pb-4 border-t border-slate-100 pt-3">
          <label className="text-xs font-semibold text-slate-600 mb-1 block">Đáp án:</label>
          <input
            type="text"
            value={d.answer}
            onChange={e => onChange({ ...q, detail: { ...d, answer: e.target.value }, hasAnswer: e.target.value.trim().length > 0 })}
            placeholder="Nhập đáp án... (VD: $3\sqrt{2}$ hoặc 961)"
            className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm focus:ring-2 focus:ring-teal-400 outline-none"
          />
        </div>
      </div>
    );
  }

  // ── Essay ──────────────────────────────────────────────────────────────────
  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
      {header}
      <div className="px-4 pb-4 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-400 italic">Câu tự luận — không cần nhập đáp án riêng.</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface TexAnswerFillerViewProps {
  onTransferToCompile?: (latex: string) => void;
}

const TexAnswerFillerView: React.FC<TexAnswerFillerViewProps> = ({ onTransferToCompile }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName]     = useState('');
  const [rawTex, setRawTex]         = useState('');      // original uploaded content
  const [questions, setQuestions]   = useState<ParsedQuestion[]>([]);
  const [batchInput, setBatchInput] = useState('');       // "ABCD..." string
  const [busy, setBusy]             = useState(false);
  const [log, setLog]               = useState('');
  const [pdf, setPdf]               = useState<PdfState>(null);
  const [showPdf, setShowPdf]       = useState(false);
  const [isFullDoc, setIsFullDoc]   = useState(false);
  const [imgCount, setImgCount]     = useState(0); // số \includegraphics bị thay khi compile

  // ── Load file ──────────────────────────────────────────────────────────────

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.tex')) { alert('Vui lòng chọn file .tex'); return; }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => {
      const text = (e.target?.result as string) || '';
      setRawTex(text);
      processTexContent(text);
    };
    reader.readAsText(file, 'utf-8');
  };

  const processTexContent = (text: string) => {
    const full = /\\documentclass(\[.*?\])?\{.*?\}/.test(text);
    setIsFullDoc(full);

    // Extract body
    let body = text;
    if (full) {
      const docBegin = text.indexOf('\\begin{document}');
      const docEnd   = text.lastIndexOf('\\end{document}');
      if (docBegin >= 0 && docEnd > docBegin) {
        body = text.slice(docBegin + '\\begin{document}'.length, docEnd);
      }
    }

    const blocks = extractExBlocks(body);
    const parsed = blocks.map((b, i) => parseExBlock(b, i + 1));
    setQuestions(parsed);
    setBatchInput('');
    setLog('');
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // ── Batch MC answer apply ──────────────────────────────────────────────────

  const applyBatchAnswer = () => {
    const str = batchInput.toUpperCase().replace(/[^ABCD]/g, '');
    const mcIndices = questions.map((q, i) => ({ q, i })).filter(({ q }) => q.detail.type === 'multichoice');
    const updated = [...questions];
    str.split('').forEach((ch, idx) => {
      if (idx >= mcIndices.length) return;
      const { i } = mcIndices[idx];
      const d = updated[i].detail as MCDetail;
      updated[i] = { ...updated[i], detail: { ...d, answer: ch }, hasAnswer: true };
    });
    setQuestions(updated);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = {
    total:     questions.length,
    answered:  questions.filter(q => q.hasAnswer).length,
    mc:        questions.filter(q => q.detail.type === 'multichoice').length,
    tf:        questions.filter(q => q.detail.type === 'truefalse').length,
    sa:        questions.filter(q => q.detail.type === 'shortans').length,
    essay:     questions.filter(q => q.detail.type === 'essay').length,
    mcMissing: questions.filter(q => q.detail.type === 'multichoice' && !q.hasAnswer).length,
    tfMissing: questions.filter(q => q.detail.type === 'truefalse' && !q.hasAnswer).length,
    saMissing: questions.filter(q => q.detail.type === 'shortans' && !q.hasAnswer).length,
  };

  const allAnswered = stats.answered === stats.total;

  // ── Collapse all / expand all ──────────────────────────────────────────────

  const collapseAll  = () => setQuestions(qs => qs.map(q => ({ ...q, collapsed: true })));
  const expandAll    = () => setQuestions(qs => qs.map(q => ({ ...q, collapsed: false })));
  const expandUnanswered = () => setQuestions(qs => qs.map(q => ({ ...q, collapsed: q.hasAnswer })));

  // ── Rebuild tex & compile ─────────────────────────────────────────────────

  const getReconstructedBody = useCallback(() => {
    return questions.map(reconstructQuestion).join('\n\n');
  }, [questions]);

  const handleCompile = async () => {
    const body  = getReconstructedBody();
    // Đếm số \includegraphics sẽ bị thay
    const matches = body.match(/\\includegraphics(\[[^\]]*\])?\{[^}]*\}/g);
    const count = matches?.length ?? 0;
    setImgCount(count);
    // Chỉ thay \includegraphics khi compile preview — file .tex xuất ra vẫn giữ nguyên
    const full  = replaceIncludegraphics(buildFullTex(body));
    setBusy(true);
    setLog('Đang biên dịch…');
    try {
      const data = await compileFullTex({ tex: full, engine: 'pdflatex', returnLog: true });
      if (!data?.ok) { setLog(data?.detail || data?.log || 'Lỗi'); alert('❌ Biên dịch lỗi. Xem LOG.'); return; }
      setLog(data.log || '✅ Thành công');
      if (data.base64) {
        const blob = base64ToBlob(data.base64, 'application/pdf');
        const url  = URL.createObjectURL(blob);
        if (pdf?.url) URL.revokeObjectURL(pdf.url);
        setPdf({ url, blob, filename: fileName.replace('.tex', '_filled.pdf') || 'output.pdf' });
        setShowPdf(true);
      }
    } catch (e: any) {
      const msg = e?.message || 'Lỗi không xác định';
      setLog(msg); alert(`❌ ${msg}`);
    } finally { setBusy(false); }
  };

  const handleTransfer = () => onTransferToCompile?.(getReconstructedBody());

  const handleDownloadTex = () => {
    const body = getReconstructedBody();
    const blob = new Blob([buildFullTex(body)], { type: 'text/plain' });
    downloadBlob(blob, fileName.replace('.tex', '_filled.tex') || 'output.tex');
  };

  const handleDownloadPdf = () => pdf && downloadBlob(pdf.blob, pdf.filename);

  React.useEffect(() => () => { if (pdf?.url) URL.revokeObjectURL(pdf.url); }, []);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <PdfModal pdf={showPdf ? pdf : null} onClose={() => setShowPdf(false)} onDownload={handleDownloadPdf} />

      <div className="space-y-4">
        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="font-extrabold text-slate-800 flex items-center gap-2 mb-1">
            <FileText size={20} className="text-teal-600" /> Nạp file .tex & điền đáp án
          </div>
          <p className="text-sm text-slate-500">
            Tải file <code>.tex</code> lên — hệ thống tự lọc câu hỏi, phát hiện đáp án còn thiếu và cho phép điền vào rồi biên dịch.
          </p>
        </div>

        {/* Upload zone */}
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileRef.current?.click()}
          className="bg-white rounded-2xl border-2 border-dashed border-slate-300 hover:border-teal-400 shadow-sm p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors group"
        >
          <Upload size={32} className="text-slate-400 group-hover:text-teal-500 transition-colors" />
          {fileName
            ? <span className="font-bold text-teal-700">{fileName}</span>
            : <span className="text-slate-500 font-semibold">Kéo thả hoặc bấm để chọn file <code>.tex</code></span>}
          {isFullDoc && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">
              📄 File đầy đủ (có \documentclass) — đã tự lọc body
            </span>
          )}
          <input ref={fileRef} type="file" accept=".tex" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
        </div>

        {/* Stats & controls */}
        {questions.length > 0 && (
          <>
            {/* Summary bar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Left: stats */}
                <div className="flex flex-wrap gap-3 items-center">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold ${
                    allAnswered ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {allAnswered ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
                    {stats.answered}/{stats.total} câu có đáp án
                  </div>
                  {stats.mc > 0 && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">
                      TN: {stats.mc} ({stats.mcMissing > 0 ? `thiếu ${stats.mcMissing}` : '✓'})
                    </span>
                  )}
                  {stats.tf > 0 && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-semibold">
                      Đ/S: {stats.tf} ({stats.tfMissing > 0 ? `thiếu ${stats.tfMissing}` : '✓'})
                    </span>
                  )}
                  {stats.sa > 0 && (
                    <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold">
                      TLN: {stats.sa} ({stats.saMissing > 0 ? `thiếu ${stats.saMissing}` : '✓'})
                    </span>
                  )}
                  {stats.essay > 0 && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold">
                      TL: {stats.essay}
                    </span>
                  )}
                </div>
                {/* Right: collapse controls */}
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={expandUnanswered}
                    className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-bold text-xs hover:bg-amber-100">
                    Mở câu chưa đáp
                  </button>
                  <button onClick={expandAll}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs">
                    Mở tất cả
                  </button>
                  <button onClick={collapseAll}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs">
                    Thu tất cả
                  </button>
                </div>
              </div>
            </div>

            {/* Batch MC answer input */}
            {stats.mc > 0 && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
                <div className="font-bold text-slate-700 text-sm mb-2 flex items-center gap-2">
                  <LayoutGrid size={15} className="text-blue-600" />
                  Nhập đáp án trắc nghiệm nhanh ({stats.mc} câu MC)
                </div>
                <p className="text-xs text-slate-500 mb-3">
                  Nhập chuỗi ký tự A/B/C/D theo thứ tự câu TN. Ví dụ: <code className="bg-slate-100 px-1 rounded">ABCADCBA</code>
                  &nbsp;→ câu 1=A, câu 2=B, câu 3=C, ...
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={batchInput}
                    onChange={e => setBatchInput(e.target.value.toUpperCase().replace(/[^ABCDabcd]/g, ''))}
                    placeholder={`Nhập ${stats.mc} ký tự ABCD...`}
                    maxLength={stats.mc}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 font-mono text-sm tracking-widest uppercase focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                    batchInput.length === stats.mc ? 'text-green-600 bg-green-100' : 'text-slate-500 bg-slate-100'
                  }`}>
                    {batchInput.length}/{stats.mc}
                  </span>
                  <button
                    onClick={applyBatchAnswer}
                    disabled={batchInput.length === 0}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw size={14} /> Áp dụng
                  </button>
                </div>
              </div>
            )}

            {/* Question list */}
            <div className="space-y-2">
              {questions.map((q, i) => (
                <QuestionCard
                  key={q.index}
                  q={q}
                  onChange={updated => {
                    const next = [...questions];
                    next[i] = updated;
                    setQuestions(next);
                  }}
                />
              ))}
            </div>

            {/* Compile section */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
              <div className="font-bold text-slate-700 text-sm mb-3 flex items-center gap-2">
                <Wand2 size={15} className="text-teal-600" /> Biên dịch & xuất file
              </div>
              {!allAnswered && (
                <div className="flex items-start gap-2 mb-3 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>Còn <strong>{stats.total - stats.answered}</strong> câu chưa có đáp án. Vẫn có thể biên dịch nhưng file sẽ thiếu đáp án.</span>
                </div>
              )}
              {imgCount > 0 && (
                <div className="flex items-start gap-2 mb-3 p-3 bg-sky-50 rounded-xl border border-sky-200 text-xs text-sky-700">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  <span>
                    Lần biên dịch vừa rồi đã thay <strong>{imgCount} hình ảnh</strong> (<code>\includegraphics</code>)
                    bằng placeholder <code>[HINH: tên_file]</code> để tránh lỗi compile.
                    File <strong>.tex xuất ra vẫn giữ nguyên</strong> đường dẫn hình gốc.
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button onClick={handleCompile} disabled={busy}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-extrabold flex items-center gap-2 disabled:opacity-60">
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Eye size={15} />}
                  Biên dịch xem trước
                </button>
                <button onClick={handleDownloadTex} disabled={busy}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold flex items-center gap-2 disabled:opacity-50">
                  <Download size={15} /> Tải .tex
                </button>
                {pdf && (
                  <button onClick={handleDownloadPdf}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center gap-2">
                    <Download size={15} /> Tải PDF
                  </button>
                )}
                {onTransferToCompile && (
                  <button onClick={handleTransfer} disabled={busy}
                    className="px-4 py-2 rounded-xl border border-teal-200 text-teal-700 hover:bg-teal-50 font-bold flex items-center gap-2 disabled:opacity-50">
                    → Sang Biên dịch
                  </button>
                )}
              </div>

              {log && (
                <div className="mt-3 bg-slate-800 rounded-xl p-3">
                  <div className="text-xs font-bold text-slate-400 mb-1">LOG biên dịch</div>
                  <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap max-h-40 overflow-auto">{log}</pre>
                </div>
              )}
            </div>
          </>
        )}

        {/* Empty state */}
        {questions.length === 0 && rawTex && (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
            <XCircle size={32} className="mx-auto mb-2 text-slate-300" />
            Không tìm thấy khối <code>\begin&#123;ex&#125;</code> nào trong file.
          </div>
        )}
      </div>
    </>
  );
};

export default TexAnswerFillerView;
