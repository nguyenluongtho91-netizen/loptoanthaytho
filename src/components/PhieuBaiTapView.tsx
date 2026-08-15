// @ts-nocheck
// src/components/PhieuBaiTapView.tsx
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  BookOpen, Plus, Trash2, Eye, Download, ExternalLink,
  X, Loader2, Copy, Check, Code, FileText, Edit3,
  Sparkles, Wand2, ChevronUp, ChevronDown, AlertCircle,
} from 'lucide-react';
import { callGeminiPublic } from '../services/geminiService';
import { compileFullTex, base64ToBlob, downloadBlob } from '../services/api';
import { EX_PHIEU_BAITAP_TEMPLATE, PHIEU_BAITAP_MARKER } from '../constants';

// ─── Constants ────────────────────────────────────────────────────────────────

const STAR_LABELS: Record<number, string> = {
  0: 'Không sao',
  1: 'Nhận biết',
  2: 'Thông hiểu',
  3: 'Vận dụng',
  4: 'Vận dụng cao',
  5: 'Nâng cao',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface BaiTapRow {
  id: string;
  star: number;       // 0 = không sao, 1-5 = mức sao
  topic: string;      // chủ đề hiển thị
  trenLop: string;    // LaTeX nội dung cột Trên lớp
  veNha: string;      // LaTeX nội dung cột Về nhà
}

type PdfState = { url: string; blob: Blob; filename: string } | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function stripFences(s: string): string {
  return (s ?? '')
    .replace(/```(?:latex|tex)?/gi, '')
    .replace(/```/g, '')
    .trim();
}

/**
 * AI đôi khi trả về cả phiếu/baitap/document hoặc thêm tiêu đề "PHIẾU BÀI TẬP".
 * Hàm này chỉ giữ phần nội dung nhỏ để đưa vào 1 cột của môi trường baitap.
 */
function normalizeLatexColumn(raw: string): string {
  let s = stripFences(raw);

  // Xoá preamble/document nếu AI lỡ sinh cả file .tex
  s = s.replace(/\\documentclass[\s\S]*?\\begin\{document\}/gi, '');
  s = s.replace(/\\end\{document\}/gi, '');

  // Nếu AI lỡ trả về \begin{baitap}[...]{...}{...}, bỏ vỏ ngoài để tránh lồng baitap.
  s = s.replace(/\\begin\{baitap\}(?:\[[^\]]*\])?/gi, '');
  s = s.replace(/\\end\{baitap\}/gi, '');

  // Bỏ các dòng tiêu đề phiếu/cột; tiêu đề TRÊN LỚP/VỀ NHÀ đã do template tự in.
  s = s.replace(/\\textbf\{(?:PHIẾU\s*)?(?:BÀI\s*TẬP|BÀI TẬP TRÊN LỚP|BÀI TẬP VỀ NHÀ|PHIẾU BÀI TẬP VỀ NHÀ)[^}]*\}\s*/gi, '');
  s = s.replace(/^\s*(?:PHIẾU\s*)?(?:BÀI\s*TẬP|BÀI TẬP TRÊN LỚP|BÀI TẬP VỀ NHÀ|PHIẾU BÀI TẬP VỀ NHÀ).*$/gim, '');

  // Không để AI tự đánh "Câu 1, Câu 2..." vì mỗi dòng trong app đã là 1 BÀI TẬP.
  s = s.replace(/\\textbf\{Câu\s*\d+\.?\}\s*/gi, '');
  s = s.replace(/^\s*Câu\s*\d+\.?\s*/gim, '');

  // Chuẩn hoá enumerate và khoảng trắng
  s = s.replace(/\\begin\{enumerate\}(?!\s*\[)/g, '\\begin{enumerate}[a)]');
  s = s.replace(/\n{3,}/g, '\n\n').trim();

  return s;
}

function buildLatexBody(rows: BaiTapRow[]): string {
  return rows
    .map(row => {
      const opt = row.star > 0 ? `[${row.star}]` : '';
      return (
        `\\begin{baitap}${opt}\n` +
        `  { % Nội dung cột trên lớp\n    ${row.trenLop}\n  }\n` +
        `  { % Nội dung cột về nhà\n    ${row.veNha}\n  }\n` +
        `\\end{baitap}`
      );
    })
    .join('\n\n');
}

function buildFullDocument(body: string): string {
  const parts = EX_PHIEU_BAITAP_TEMPLATE.split(PHIEU_BAITAP_MARKER);
  if (parts.length >= 2) {
    return `${parts[0]}\n${body}\n${parts.slice(1).join(PHIEU_BAITAP_MARKER)}`;
  }
  return `${EX_PHIEU_BAITAP_TEMPLATE}\n\n${body}`;
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

function promptTrenLop(topic: string, star: number): string {
  const level = STAR_LABELS[star] ?? 'Thông hiểu';
  return `Bạn là giáo viên Toán Việt Nam, chuyên soạn bài tập LaTeX ngắn để đặt trong 1 cột của môi trường \\begin{baitap}[sao]{cột trên lớp}{cột về nhà}.

CHỦ ĐỀ: "${topic}"
MỨC ĐỘ: ${level}

MỤC TIÊU ĐẦU RA:
Tạo đúng 01 bài tập TRÊN LỚP, ngắn gọn, vừa khung 0.48\\textwidth, dùng để app tự bọc vào:
\\begin{baitap}[${star}]
  {NỘI DUNG TRÊN LỚP}
  {NỘI DUNG VỀ NHÀ}
\\end{baitap}

BẮT BUỘC:
- Chỉ trả về PHẦN NỘI DUNG CỦA CỘT TRÊN LỚP.
- Không viết tiêu đề phiếu, không viết "PHIẾU BÀI TẬP", không viết "TRÊN LỚP".
- Không viết "\\textbf{Câu 1.}", "\\textbf{Câu 2.}" vì mỗi lần tạo chỉ là 1 bài tập.
- Không dùng \\begin{baitap}, \\end{baitap}, \\documentclass, \\begin{document}, \\end{document}.
- Không có lời giải, không có đáp án, không có nhận xét.
- Công thức toán phải bọc bằng $...$; không dùng \\(...\\), \\[...\\].
- Nếu có các ý nhỏ thì dùng đúng:
\\begin{enumerate}[a)]
  \\item ...
  \\item ...
\\end{enumerate}
- Tối đa 1 đoạn dẫn và 2 đến 4 ý nhỏ. Không tạo cả phiếu nhiều câu.
- Với chủ đề đại số như hằng đẳng thức, đa thức, phương trình: KHÔNG tự thêm hình TikZ nếu người dùng không yêu cầu rõ "có hình".
- Chỉ dùng TikZ khi chủ đề bắt buộc có hình hoặc người dùng yêu cầu có hình; hình phải nhỏ, scale khoảng 0.6 đến 0.8.

MẪU ĐÚNG CẦN BẮT CHƯỚC:
Rút gọn biểu thức sau bằng cách sử dụng hằng đẳng thức bình phương của một tổng:
$A=(x+4)^2-x(x+8)$

MẪU ĐÚNG NẾU CÓ NHIỀU Ý:
Cho biểu thức $P=(x+2)^2-4x$.
\\begin{enumerate}[a)]
  \\item Rút gọn biểu thức $P$.
  \\item Tính giá trị của $P$ khi $x=2026$.
\\end{enumerate}

OUTPUT:
Chỉ trả về LaTeX thuần của cột TRÊN LỚP.`;
}

function promptVeNha(trenLop: string, topic: string, star: number): string {
  const level = STAR_LABELS[star] ?? 'Thông hiểu';
  return `Bạn là giáo viên Toán Việt Nam, chuyên tạo bài tập VỀ NHÀ tương tự bài TRÊN LỚP để đặt trong cột thứ 2 của môi trường baitap.

CHỦ ĐỀ: "${topic}"
MỨC ĐỘ: ${level}

BÀI TRÊN LỚP:
\`\`\`latex
${trenLop}
\`\`\`

Hãy tạo đúng 01 bài tập VỀ NHÀ tương tự bài trên lớp.

BẮT BUỘC:
- Chỉ trả về PHẦN NỘI DUNG CỦA CỘT VỀ NHÀ.
- Giữ cùng kiểu bài, cùng cấu trúc, cùng số ý nhỏ với bài trên lớp.
- Thay đổi số liệu/biểu thức/tên điểm để không trùng y hệt.
- Độ khó tương đương hoặc nhỉnh hơn rất nhẹ.
- Không thêm câu mở rộng nếu bài trên lớp không có.
- Không viết tiêu đề phiếu, không viết "PHIẾU BÀI TẬP", không viết "VỀ NHÀ".
- Không viết "\\textbf{Câu 1.}", "\\textbf{Câu 2.}".
- Không dùng \\begin{baitap}, \\end{baitap}, \\documentclass, \\begin{document}, \\end{document}.
- Không có lời giải, không có đáp án.
- Công thức toán phải bọc bằng $...$; không dùng \\(...\\), \\[...\\].
- Nếu có các ý nhỏ thì dùng đúng \\begin{enumerate}[a)] ... \\end{enumerate}.
- Nếu bài trên lớp không có TikZ thì bài về nhà cũng không tự thêm TikZ.

OUTPUT:
Chỉ trả về LaTeX thuần của cột VỀ NHÀ.`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }}
      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 flex items-center gap-1 text-xs"
    >
      {copied
        ? <><Check size={13} className="text-green-500" /> Đã chép</>
        : <><Copy size={13} /> Sao chép</>}
    </button>
  );
}

function PdfModal({
  pdf, onClose, onDownload,
}: { pdf: PdfState; onClose: () => void; onDownload: () => void }) {
  if (!pdf) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <span className="font-extrabold text-slate-800 flex items-center gap-2">
            <Eye size={16} className="text-teal-600" /> Xem trước PDF
          </span>
          <div className="flex gap-2">
            <button onClick={() => window.open(pdf.url, '_blank')}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-sm flex items-center gap-1.5">
              <ExternalLink size={13} /> Mở tab mới
            </button>
            <button onClick={onDownload}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm flex items-center gap-1.5">
              <Download size={13} /> Tải PDF
            </button>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="h-[74vh]">
          <iframe src={pdf.url} className="w-full h-full" title="pdf-preview" />
        </div>
        <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
          Nếu không hiển thị, dùng "Mở tab mới" hoặc "Tải PDF".
        </div>
      </div>
    </div>
  );
}

// ─── Star Selector ────────────────────────────────────────────────────────────

function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => onChange(0)}
        className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${
          value === 0
            ? 'bg-slate-200 text-slate-700 border-slate-300'
            : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
        }`}
      >
        Không sao
      </button>
      <div className="flex">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            title={STAR_LABELS[n]}
            className={`w-7 h-7 text-base transition-all hover:scale-110 ${
              value >= n ? 'text-yellow-400' : 'text-slate-300'
            }`}
          >
            ★
          </button>
        ))}
      </div>
      {value > 0 && (
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          value <= 2 ? 'bg-sky-100 text-sky-700'
          : value === 3 ? 'bg-amber-100 text-amber-700'
          : 'bg-rose-100 text-rose-700'
        }`}>
          {STAR_LABELS[value]}
        </span>
      )}
    </div>
  );
}

// ─── BaiTapEditorPopup ────────────────────────────────────────────────────────

interface BaiTapEditorPopupProps {
  initial?: Partial<BaiTapRow>;
  onSave: (data: Omit<BaiTapRow, 'id'>) => void;
  onClose: () => void;
}

function BaiTapEditorPopup({ initial, onSave, onClose }: BaiTapEditorPopupProps) {
  const [topic,    setTopic]    = useState(initial?.topic    ?? '');
  const [star,     setStar]     = useState(initial?.star     ?? 2);
  const [trenLop,  setTrenLop]  = useState(initial?.trenLop  ?? '');
  const [veNha,    setVeNha]    = useState(initial?.veNha    ?? '');
  const [genTL,    setGenTL]    = useState(false);   // generating trên lớp
  const [genVN,    setGenVN]    = useState(false);   // generating về nhà

  const isEdit   = !!initial?.id;
  const canSave  = topic.trim() && trenLop.trim() && veNha.trim();

  // ── AI: Tạo bài Trên lớp ────────────────────────────────────────────────
  const handleGenTrenLop = async () => {
    if (!topic.trim()) { alert('Vui lòng nhập Chủ đề trước!'); return; }
    setGenTL(true);
    try {
      const raw = await callGeminiPublic(promptTrenLop(topic, star));
      setTrenLop(normalizeLatexColumn(raw));
    } catch (e: any) {
      alert(`❌ Lỗi AI: ${e?.message}`);
    } finally { setGenTL(false); }
  };

  // ── AI: Tạo bài Về nhà (tương tự Trên lớp) ──────────────────────────────
  const handleGenVeNha = async () => {
    if (!trenLop.trim()) { alert('Vui lòng có nội dung Trên lớp trước!'); return; }
    setGenVN(true);
    try {
      const raw = await callGeminiPublic(promptVeNha(trenLop, topic, star));
      setVeNha(normalizeLatexColumn(raw));
    } catch (e: any) {
      alert(`❌ Lỗi AI: ${e?.message}`);
    } finally { setGenVN(false); }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 bg-black/50 overflow-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl flex flex-col"
        style={{ maxHeight: '93vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="font-extrabold text-slate-800 text-base flex items-center gap-2">
            <Edit3 size={16} className="text-teal-600" />
            {isEdit ? 'Chỉnh sửa bài tập' : 'Thêm bài tập mới'}
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Row: Chủ đề + Sao */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">
                Chủ đề / Tiêu đề bài tập <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="VD: Phương trình bậc hai, Hình bình hành, Hằng đẳng thức..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 mb-1.5 block">
                Mức độ (dùng sao FontAwesome)
              </label>
              <StarSelector value={star} onChange={setStar} />
            </div>
          </div>

          {/* Hint khi chưa có topic */}
          {!topic.trim() && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
              <AlertCircle size={13} /> Nhập Chủ đề để mở khóa tính năng tạo bằng AI.
            </div>
          )}

          {/* Two columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* ─── Trên lớp ─── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-teal-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block flex-shrink-0" />
                  Bài tập TRÊN LỚP — LaTeX
                </label>
                <div className="flex items-center gap-1.5">
                  {trenLop && (
                    <button
                      onClick={() => { if (confirm('Tạo lại sẽ ghi đè nội dung hiện tại?')) handleGenTrenLop(); }}
                      disabled={genTL || !topic.trim()}
                      className="px-2 py-1 rounded-lg border border-teal-300 text-teal-600 text-xs font-bold flex items-center gap-1 disabled:opacity-40 hover:bg-teal-50 transition-all"
                    >
                      {genTL ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
                      Tạo lại
                    </button>
                  )}
                  <button
                    onClick={handleGenTrenLop}
                    disabled={genTL || !topic.trim()}
                    className={`px-2.5 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50 transition-all ${
                      trenLop ? 'hidden' : 'bg-teal-600 hover:bg-teal-700'
                    }`}
                  >
                    {genTL ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                    {genTL ? 'Đang tạo...' : 'AI tạo'}
                  </button>
                  {!trenLop && (
                    <span className="text-xs text-slate-400">hoặc nhập thủ công</span>
                  )}
                </div>
              </div>

              {genTL ? (
                <div className="h-56 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-teal-200 bg-teal-50">
                  <Loader2 size={24} className="animate-spin text-teal-500" />
                  <span className="text-xs text-teal-600 font-semibold">Gemini đang soạn bài trên lớp…</span>
                </div>
              ) : (
                <textarea
                  value={trenLop}
                  onChange={e => setTrenLop(e.target.value)}
                  placeholder={
                    topic.trim()
                      ? `Nhập LaTeX nội dung bài hoặc nhấn nút "AI tạo" bên trên...`
                      : 'Nhập Chủ đề trước, rồi nhấn "AI tạo" hoặc nhập tay...'
                  }
                  className="w-full h-56 p-3 rounded-xl border border-slate-200 text-xs font-mono outline-none focus:ring-2 focus:ring-teal-400 resize-none bg-slate-50 focus:bg-white transition-colors"
                  spellCheck={false}
                />
              )}

              {trenLop && !genTL && (
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Check size={10} className="text-green-500" />
                    {trenLop.split('\n').length} dòng
                  </span>
                  <span className="italic">Có thể chỉnh sửa tự do</span>
                </div>
              )}
            </div>

            {/* ─── Về nhà ─── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-orange-600 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block flex-shrink-0" />
                  Bài tập VỀ NHÀ — LaTeX
                </label>
                <div className="flex items-center gap-1.5">
                  {veNha && (
                    <button
                      onClick={() => { if (confirm('Tạo lại bài về nhà?')) handleGenVeNha(); }}
                      disabled={genVN || !trenLop.trim()}
                      className="px-2 py-1 rounded-lg border border-orange-300 text-orange-600 text-xs font-bold flex items-center gap-1 disabled:opacity-40 hover:bg-orange-50 transition-all"
                    >
                      {genVN ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                      Tạo lại
                    </button>
                  )}
                  <button
                    onClick={handleGenVeNha}
                    disabled={genVN || !trenLop.trim()}
                    className={`px-2.5 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50 transition-all ${
                      veNha ? 'hidden' : 'bg-orange-500 hover:bg-orange-600'
                    }`}
                  >
                    {genVN ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                    {genVN ? 'Đang tạo...' : 'Tạo bài tương tự'}
                  </button>
                  {!veNha && (
                    <span className="text-xs text-slate-400">hoặc nhập thủ công</span>
                  )}
                </div>
              </div>

              {genVN ? (
                <div className="h-56 flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-orange-200 bg-orange-50">
                  <Loader2 size={24} className="animate-spin text-orange-400" />
                  <span className="text-xs text-orange-600 font-semibold">Gemini đang tạo bài tương tự…</span>
                </div>
              ) : (
                <textarea
                  value={veNha}
                  onChange={e => setVeNha(e.target.value)}
                  placeholder={
                    trenLop.trim()
                      ? 'Nhấn "Tạo bài tương tự" hoặc nhập LaTeX tay...'
                      : 'Cần có nội dung Trên lớp trước mới tạo được bài về nhà...'
                  }
                  className="w-full h-56 p-3 rounded-xl border border-slate-200 text-xs font-mono outline-none focus:ring-2 focus:ring-orange-400 resize-none bg-slate-50 focus:bg-white transition-colors"
                  spellCheck={false}
                />
              )}

              {veNha && !genVN && (
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Check size={10} className="text-green-500" />
                    {veNha.split('\n').length} dòng
                  </span>
                  <span className="italic">Có thể chỉnh sửa tự do</span>
                </div>
              )}
            </div>
          </div>

          {/* Guide: luồng làm việc */}
          {(!trenLop || !veNha) && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-500 leading-relaxed">
              <span className="font-bold text-slate-700">💡 Luồng đề xuất: </span>
              Nhập chủ đề →{' '}
              <span className="text-teal-700 font-semibold">AI tạo bài Trên lớp</span>
              {' '}→ Xem lại & chỉnh sửa →{' '}
              <span className="text-orange-600 font-semibold">AI tạo bài Về nhà tương tự</span>
              {' '}→ Xem lại & chỉnh sửa → Xác nhận thêm vào phiếu.
            </div>
          )}

          {/* Validation warning */}
          {!canSave && (trenLop || veNha) && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700">
              <AlertCircle size={13} className="flex-shrink-0" />
              Cần có đủ: Chủ đề, nội dung Trên lớp và Về nhà trước khi lưu.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50"
          >
            Huỷ
          </button>
          <button
            onClick={() => {
              if (canSave) {
                onSave({ topic, star, trenLop, veNha });
                onClose();
              }
            }}
            disabled={!canSave}
            className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
          >
            <Check size={15} /> {isEdit ? 'Lưu thay đổi' : 'Thêm vào phiếu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PhieuBaiTapViewProps {
  onTransferToCompile?: (latex: string) => void;
}

const PhieuBaiTapView: React.FC<PhieuBaiTapViewProps> = ({ onTransferToCompile }) => {
  const [rows,        setRows]        = useState<BaiTapRow[]>([]);
  const [showAdd,     setShowAdd]     = useState(false);
  const [editingRow,  setEditingRow]  = useState<BaiTapRow | null>(null);
  const [latexBody,   setLatexBody]   = useState('');
  const [isEditing,   setIsEditing]   = useState(false);
  const [editedBody,  setEditedBody]  = useState('');
  const [compiling,   setCompiling]   = useState(false);
  const [pdf,         setPdf]         = useState<PdfState>(null);
  const [showPdf,     setShowPdf]     = useState(false);
  const [log,         setLog]         = useState('');
  const resultRef = useRef<HTMLDivElement>(null);

  // cleanup objectURL on unmount
  useEffect(() => () => { if (pdf?.url) URL.revokeObjectURL(pdf.url); }, []);

  // ── Row CRUD ────────────────────────────────────────────────────────────
  const addRow = useCallback((data: Omit<BaiTapRow, 'id'>) => {
    setRows(prev => [...prev, { ...data, id: `bt_${Date.now()}` }]);
  }, []);

  const updateRow = useCallback((id: string, data: Omit<BaiTapRow, 'id'>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...data, id } : r));
  }, []);

  const removeRow = useCallback((id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  }, []);

  const moveRow = useCallback((id: string, dir: -1 | 1) => {
    setRows(prev => {
      const idx = prev.findIndex(r => r.id === id);
      if (idx < 0) return prev;
      const arr = [...prev];
      const to  = idx + dir;
      if (to < 0 || to >= arr.length) return prev;
      [arr[idx], arr[to]] = [arr[to], arr[idx]];
      return arr;
    });
  }, []);

  // ── Build LaTeX ─────────────────────────────────────────────────────────
  const handleBuildLatex = useCallback(() => {
    const body = buildLatexBody(rows);
    setLatexBody(body);
    setEditedBody(body);
    setIsEditing(false);
    setLog('');
    setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  }, [rows]);

  const currentBody = isEditing ? editedBody : latexBody;

  // ── Compile ─────────────────────────────────────────────────────────────
  const handleCompile = useCallback(async () => {
    if (!currentBody) return;
    setCompiling(true);
    setLog('Đang biên dịch…');
    try {
      const tex  = buildFullDocument(currentBody);
      const data = await compileFullTex({ tex, engine: 'pdflatex', returnLog: true });
      if (!data?.ok) {
        setLog(data?.detail || data?.log || 'Compile thất bại');
        alert('❌ Lỗi biên dịch. Xem LOG phía dưới.');
        return;
      }
      setLog(data.log || '✅ Thành công');
      if (data.base64) {
        const blob     = base64ToBlob(data.base64, 'application/pdf');
        const url      = URL.createObjectURL(blob);
        if (pdf?.url) URL.revokeObjectURL(pdf.url);
        const filename = `phieu_baitap_${Date.now()}.pdf`;
        setPdf({ url, blob, filename });
        setShowPdf(true);
      }
    } catch (e: any) {
      const msg = e?.message || 'Lỗi compile';
      setLog(msg);
      alert(`❌ ${msg}`);
    } finally { setCompiling(false); }
  }, [currentBody, pdf]);

  // ── Download .tex ───────────────────────────────────────────────────────
  const handleDownloadTex = useCallback(() => {
    if (!currentBody) return;
    const full = buildFullDocument(currentBody);
    const blob = new Blob([full], { type: 'text/plain;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href: url, download: `phieu_baitap_${Date.now()}.tex`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentBody]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      {showAdd && (
        <BaiTapEditorPopup
          onSave={addRow}
          onClose={() => setShowAdd(false)}
        />
      )}
      {editingRow && (
        <BaiTapEditorPopup
          initial={editingRow}
          onSave={(data) => updateRow(editingRow.id, data)}
          onClose={() => setEditingRow(null)}
        />
      )}
      <PdfModal
        pdf={showPdf ? pdf : null}
        onClose={() => setShowPdf(false)}
        onDownload={() => pdf && downloadBlob(pdf.blob, pdf.filename)}
      />

      <div className="space-y-4">

        {/* ── Header ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <div className="font-extrabold text-slate-800 flex items-center gap-2 mb-1">
            <BookOpen size={20} className="text-teal-600" /> Tạo Phiếu Bài Tập 2 Cột
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">
            Thêm bài tập → nhập hoặc để AI soạn{' '}
            <span className="font-semibold text-teal-700">Trên lớp</span>
            {' '}→ AI tự tạo bài tương tự cột{' '}
            <span className="font-semibold text-orange-600">Về nhà</span>
            {' '}→ GV duyệt & chỉnh sửa → Xuất PDF theo mẫu đẹp.
          </p>
        </div>

        {/* ── Danh sách bài tập ── */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
            <div className="font-bold text-slate-700 text-sm flex items-center gap-2">
              <FileText size={15} className="text-teal-600" />
              Danh sách bài tập
              {rows.length > 0 && (
                <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-bold">
                  {rows.length} bài
                </span>
              )}
            </div>
            <button
              onClick={() => setShowAdd(true)}
              className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <Plus size={13} /> Thêm bài tập
            </button>
          </div>

          {rows.length === 0 ? (
            <div className="py-14 flex flex-col items-center gap-3 text-slate-400">
              <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                <BookOpen size={28} className="opacity-40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-600">Chưa có bài tập nào</p>
                <p className="text-xs mt-1 opacity-70">Nhấn nút bên trên để soạn bài đầu tiên</p>
              </div>
              <button
                onClick={() => setShowAdd(true)}
                className="mt-1 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm flex items-center gap-2 shadow-md transition-all"
              >
                <Plus size={15} /> Thêm bài tập đầu tiên
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {rows.map((row, idx) => (
                <div
                  key={row.id}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/70 transition-colors"
                >
                  {/* Order controls */}
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0 pt-1">
                    <button
                      onClick={() => moveRow(row.id, -1)}
                      disabled={idx === 0}
                      className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20 transition-colors"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <span className="text-[11px] font-mono text-slate-400 font-bold leading-none py-0.5">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <button
                      onClick={() => moveRow(row.id, 1)}
                      disabled={idx === rows.length - 1}
                      className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-20 transition-colors"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  {/* Content preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="font-bold text-slate-800 text-sm">{row.topic}</span>
                      {row.star > 0 && (
                        <span className="text-yellow-400 text-xs leading-none flex-shrink-0">
                          {'★'.repeat(row.star)}
                          <span className="text-slate-200">{'★'.repeat(5 - row.star)}</span>
                        </span>
                      )}
                      {row.star > 0 && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0 ${
                          row.star <= 2 ? 'bg-sky-100 text-sky-700'
                          : row.star === 3 ? 'bg-amber-100 text-amber-700'
                          : 'bg-rose-100 text-rose-700'
                        }`}>
                          {STAR_LABELS[row.star]}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {/* Trên lớp preview */}
                      <div className="bg-teal-50 border border-teal-100 rounded-xl p-2.5">
                        <div className="text-[10px] font-extrabold text-teal-600 mb-1.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />
                          TRÊN LỚP
                        </div>
                        <pre className="text-[10px] text-slate-600 font-mono leading-relaxed overflow-hidden"
                          style={{ maxHeight: '3.6rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                          {row.trenLop.slice(0, 180)}{row.trenLop.length > 180 ? '…' : ''}
                        </pre>
                      </div>

                      {/* Về nhà preview */}
                      <div className="bg-orange-50 border border-orange-100 rounded-xl p-2.5">
                        <div className="text-[10px] font-extrabold text-orange-600 mb-1.5 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 inline-block" />
                          VỀ NHÀ
                        </div>
                        <pre className="text-[10px] text-slate-600 font-mono leading-relaxed overflow-hidden"
                          style={{ maxHeight: '3.6rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                          {row.veNha.slice(0, 180)}{row.veNha.length > 180 ? '…' : ''}
                        </pre>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 flex-shrink-0 pt-1">
                    <button
                      onClick={() => setEditingRow(row)}
                      title="Chỉnh sửa"
                      className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => { if (confirm(`Xoá bài tập "${row.topic}"?`)) removeRow(row.id); }}
                      title="Xóa"
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}

              {/* Footer */}
              <div className="px-4 py-2 bg-teal-50 flex justify-between items-center">
                <span className="text-xs text-teal-700 font-semibold">
                  Tổng: {rows.length} bài tập
                </span>
                <button
                  onClick={() => { if (confirm('Xóa tất cả bài tập?')) setRows([]); }}
                  className="text-xs text-red-400 hover:text-red-600 font-bold"
                >
                  Xóa tất cả
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Build / Export button ── */}
        {rows.length > 0 && (
          <button
            onClick={handleBuildLatex}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <Code size={18} /> Xuất LaTeX ({rows.length} bài tập)
          </button>
        )}

        {/* ── Result area ── */}
        {latexBody && (
          <div ref={resultRef} className="space-y-3">

            {/* Toolbar */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex items-center gap-2">
                <Code size={15} className="text-teal-600" />
                <span className="font-bold text-slate-800 text-sm">
                  {rows.length} bài tập — LaTeX sẵn sàng
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <CopyBtn text={currentBody} />
                <button
                  onClick={handleDownloadTex}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5"
                >
                  <Download size={13} /> .tex (đầy đủ)
                </button>
                <button
                  onClick={handleCompile}
                  disabled={compiling}
                  className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-60 transition-all"
                >
                  {compiling
                    ? <Loader2 size={13} className="animate-spin" />
                    : <Eye size={13} />}
                  {compiling ? 'Đang biên dịch…' : 'Xem PDF'}
                </button>
                {pdf && (
                  <button
                    onClick={() => pdf && downloadBlob(pdf.blob, pdf.filename)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5"
                  >
                    <Download size={13} /> PDF
                  </button>
                )}
                {onTransferToCompile && (
                  <button
                    onClick={() => onTransferToCompile(buildFullDocument(currentBody))}
                    className="px-3 py-1.5 rounded-xl border border-teal-300 text-teal-700 hover:bg-teal-50 font-bold text-xs flex items-center gap-1.5"
                  >
                    Sang Biên dịch
                  </button>
                )}
              </div>
            </div>

            {/* LaTeX code block */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500 font-mono">
                  LaTeX body — {rows.length} × \begin&#123;baitap&#125; (2 cột)
                </span>
                <button
                  onClick={() => { setIsEditing(e => !e); if (!isEditing) setEditedBody(latexBody); }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    isEditing
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                  }`}
                >
                  <Edit3 size={12} className="inline mr-1" />
                  {isEditing ? 'Đang chỉnh sửa' : 'Chỉnh sửa body'}
                </button>
              </div>

              {isEditing ? (
                <textarea
                  value={editedBody}
                  onChange={e => setEditedBody(e.target.value)}
                  className="w-full h-[440px] p-4 font-mono text-xs text-slate-700 outline-none resize-none border-0 focus:ring-2 focus:ring-teal-400"
                  spellCheck={false}
                />
              ) : (
                <pre className="text-xs font-mono p-4 overflow-auto max-h-[440px] text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
                  {currentBody}
                </pre>
              )}
            </div>

            {/* Compile log */}
            {log && (
              <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
                <div className="text-xs font-bold text-slate-400 mb-1 flex items-center gap-2">
                  <FileText size={12} /> LOG biên dịch
                </div>
                <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap max-h-[200px] overflow-auto leading-relaxed">
                  {log}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default PhieuBaiTapView;
