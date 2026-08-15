// @ts-nocheck
import { useState, useRef, useCallback, useEffect } from "react";
import type { CSSProperties } from "react";
import * as XLSX from "xlsx";
import FeedbackRenderer from '@/components/FeedbackRenderer';
import { useDataStore } from '@/store/dataStore';
import { useAuthStore } from '@/store/authStore';
import { KeyRound, Users, GraduationCap, UploadCloud } from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AnswerKey {
  p1: string[];
  p2: string[];
  p3: string[];
  p4: string;
}

interface Weights {
  p1: number;
  p2: number;
  p3: number;
  p4: number;
}

interface ImgData {
  data: string;
  type: string;
}

interface GradingStudent {
  id: string; // Dùng UUID của Supabase
  name: string;
  student_code?: string;
  images: ImgData[];
}

interface P1Result { student: string; correct: string; ok: boolean; }
interface P2Sub  { student: string; correct: string; ok: boolean; }
interface P2Result { subs: P2Sub[]; qScore: number; }
interface P3Result { student: string; correct: string; ok: boolean; }

interface P4SubStep { text: string; ok: boolean; }
interface P4SubQ   { q: number; score: number; max: number; steps: P4SubStep[]; comment: string; }
interface GradeP4   { score: number; feedback: string; detail?: P4SubQ[]; }

interface StudentResult {
  p1: GradeP1;
  p2: GradeP2;
  p3: GradeP3;
  p4: GradeP4;
  total: number;
}

interface AIResponse {
  p1: string[];
  p2: string[];
  p3: string[];
  p4_score: number;
  p4_feedback: string;
  p4_detail?: P4SubQ[];
}

// ─── API Gọi Trực Tiếp Gemini ─────────────────────────────────────────────────
async function directGeminiVision(apiKey: string, parts: any[]) {
  if (!apiKey) throw new Error("Vui lòng nhập API Key của Gemini!");
  
  // Dùng model flash mới nhất chuyên xử lý ảnh tốc độ cao
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ parts }],
    generationConfig: { 
      temperature: 0.1, 
      responseMimeType: "application/json" 
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  
  return json.candidates[0].content.parts[0].text;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseAnswerKey(txt: string): AnswerKey {
  const key: AnswerKey = { p1: [], p2: [], p3: [], p4: "" };
  const p4Lines: string[] = [];
  txt.split("\n").forEach(raw => {
    const line = raw.trim();
    if (!line) return;
    const parts = line.split("|").map(s => s.trim());
    if (parts.length < 3) return;
    const section = parts[0].toUpperCase();
    const num = parseInt(parts[1]) - 1;
    const ans = parts.slice(2).join("|").trim();
    if (section === "P1") key.p1[num] = ans;
    else if (section === "P2") key.p2[num] = ans;
    else if (section === "P3") key.p3[num] = ans;
    else if (section === "P4") p4Lines.push(ans);
  });
  if (p4Lines.length) key.p4 = p4Lines.join("\n");
  return key;
}

async function fileToBase64(file: File): Promise<ImgData> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res({ data: (r.result as string).split(",")[1], type: file.type || "image/jpeg" });
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function normalizeAns(s: string): string { return String(s).trim().replace(",", ".").toLowerCase(); }

function gradeP1(studentArr: string[], keyArr: string[], totalPts: number): GradeP1 {
  const per = keyArr.length ? totalPts / keyArr.length : 0;
  let score = 0;
  const results = keyArr.map((ans, i) => {
    const stu = String(studentArr[i] || "?").toUpperCase().trim();
    const cor = ans.toUpperCase().trim();
    const ok = stu === cor;
    if (ok) score += per;
    return { student: stu, correct: cor, ok };
  });
  return { score: Math.round(score * 100) / 100, results };
}

const MINISTRY_PCT: Record<number, number> = { 0: 0, 1: 0.10, 2: 0.25, 3: 0.50, 4: 1.0 };

function gradeP2(studentArr: string[], keyArr: string[], totalPts: number, mode: 'equal' | 'ministry' = 'equal'): GradeP2 {
  const per = keyArr.length ? totalPts / keyArr.length : 0;
  let score = 0;
  const results = keyArr.map((keyStr, i) => {
    const stuStr = String(studentArr[i] || "????").padEnd(4, "?");
    const subs = keyStr.toUpperCase().split("").map((k, j) => {
      const s = (stuStr[j] || "?").toUpperCase();
      return { student: s, correct: k, ok: s === k };
    });
    const correctCount = subs.filter(s => s.ok).length;
    const qScore = mode === 'ministry'
      ? per * (MINISTRY_PCT[Math.min(correctCount, 4)] ?? 0)
      : per * (correctCount / subs.length);
    score += qScore;
    return { subs, qScore: Math.round(qScore * 100) / 100 };
  });
  return { score: Math.round(score * 100) / 100, results };
}

function gradeP3(studentArr: string[], keyArr: string[], totalPts: number): GradeP3 {
  const per = keyArr.length ? totalPts / keyArr.length : 0;
  let score = 0;
  const results = keyArr.map((ans, i) => {
    const stu = String(studentArr[i] || "").trim();
    const ok = normalizeAns(stu) === normalizeAns(ans);
    if (ok) score += per;
    return { student: stu, correct: ans, ok };
  });
  return { score: Math.round(score * 100) / 100, results };
}

async function callGradingAPI(apiKey: string, student: GradingStudent, answerKey: AnswerKey, weights: Weights, p4Images: ImgData[], p4SubCount: number): Promise<AIResponse> {
  let rubricInfo = answerKey.p4 ? `\nTiêu chí chấm (Rubric text): ${answerKey.p4}` : "";
  if (p4Images.length > 0) rubricInfo += `\nLưu ý: Có kèm theo ảnh đáp án chuẩn của giáo viên để bạn đối chiếu.`;

  const prompt = `Đọc ảnh phiếu trả lời và trích xuất + chấm điểm toàn bộ bài làm của học sinh.

Cấu trúc phiếu:
- Phần I (Trắc nghiệm): ${answerKey.p1.length} câu, mỗi câu chọn A/B/C/D
- Phần II (Đúng/Sai): ${answerKey.p2.length} câu, mỗi câu có 4 ý a/b/c/d, mỗi ý ghi D (đúng) hoặc S (sai)
- Phần III (Trả lời ngắn): ${answerKey.p3.length} câu, ghi số/kết quả
- Phần IV (Tự luận): ${p4SubCount} câu, mỗi câu tối đa ${weights.p4 / p4SubCount} điểm (tổng ${weights.p4}đ).${rubricInfo}

Đáp án đúng để so sánh:
P1: ${answerKey.p1.join(", ")}
P2: ${answerKey.p2.map((s, i) => `C${i+1}=${s}`).join(", ")} (D=Đúng, S=Sai)
P3: ${answerKey.p3.map((s, i) => `C${i+1}=${s}`).join(", ")}

Trả về JSON ĐÚNG FORMAT SAU (không dùng markdown):
{
  "p1": ["A","B",...],
  "p2": ["DDSS","SDSD",...],
  "p3": ["2026","-1.5",...],
  "p4_score": 2.25,
  "p4_feedback": "Nhận xét tổng quan ngắn gọn về bài tự luận",
  "p4_detail": [
    {
      "q": 1,
      "score": 0.75,
      "max": ${weights.p4 / p4SubCount},
      "steps": [
        { "text": "Gọi $x$ là chiều dài (m), $x > 0$", "ok": true }
      ],
      "comment": "Làm tốt"
    }
  ]
}

Nếu không đọc được câu nào, dùng "?" cho P1/P2 và "" cho P3.`;

  const parts: any[] = [];

  if (p4Images && p4Images.length > 0) {
    parts.push({ text: "--- ẢNH ĐÁP ÁN CHUẨN PHẦN TỰ LUẬN (GIÁO VIÊN CUNG CẤP) ---" });
    p4Images.forEach(img => {
      parts.push({ inline_data: { mime_type: img.type || "image/jpeg", data: img.data } });
    });
  }

  parts.push({ text: "--- BÀI LÀM CỦA HỌC SINH ---" });
  student.images.forEach(img => {
    parts.push({ inline_data: { mime_type: img.type || "image/jpeg", data: img.data } });
  });
  
  parts.push({ text: prompt });

  // Gọi API Trực tiếp
  const resultText = await directGeminiVision(apiKey, parts);
  const clean = resultText.replace(/```json|```/g, "").trim();
  return JSON.parse(clean) as AIResponse;
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function P1Grid({ results }: { results: P1Result[] }) {
  return (
    <div>
      <p style={styles.sectionLabel}>Phần I — Trắc Nghiệm</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", paddingTop: "20px" }}>
        {results.map((r, i) => (
          <div key={i} style={{ position: "relative", textAlign: "center" }}>
            <span style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{i+1}</span>
            <div style={{
              width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 15, fontFamily: "var(--font-mono, monospace)",
              background: r.ok ? "#ecfdf5" : "#fef2f2",
              border: `2px solid ${r.ok ? "#6ee7b7" : "#fca5a5"}`,
              color: r.ok ? "#047857" : "#b91c1c",
            }}>
              {r.student === "?" ? "–" : r.student}
            </div>
            {!r.ok && (
              <div style={{ position: "absolute", bottom: -16, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: "#059669", fontWeight: 700, whiteSpace: "nowrap" }}>
                →{r.correct}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function P2Grid({ results }: { results: P2Result[] }) {
  const labels = ["a", "b", "c", "d"];
  const disp = (c: string) => c === "D" ? "Đ" : c;
  return (
    <div>
      <p style={styles.sectionLabel}>Phần II — Đúng/Sai</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
        {results.map((q, i) => (
          <div key={i} style={{ background: "#f8fafc", borderRadius: 12, padding: "12px 14px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Câu {i + 1} · {q.qScore.toFixed(2)} đ
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {q.subs.map((s, j) => (
                <div key={j} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600 }}>{labels[j]}</span>
                  <div style={{
                    width: 36, height: 36, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                    background: s.ok ? "#ecfdf5" : "#fef2f2",
                    border: `2px solid ${s.ok ? "#6ee7b7" : "#fca5a5"}`,
                    position: "relative"
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: s.ok ? "#047857" : "#b91c1c", fontFamily: "monospace" }}>
                      {s.student === "?" ? "–" : disp(s.student)}
                    </span>
                    {!s.ok && <span style={{ fontSize: 9, color: "#059669", position: "absolute", bottom: -14, fontWeight: 700 }}>→{disp(s.correct)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function P3Grid({ results }: { results: P3Result[] }) {
  return (
    <div>
      <p style={styles.sectionLabel}>Phần III — Trả Lời Ngắn</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {results.map((r, i) => (
          <div key={i} style={{
            padding: "8px 12px", borderRadius: 10, border: `2px solid ${r.ok ? "#6ee7b7" : "#fca5a5"}`,
            background: r.ok ? "#ecfdf5" : "#fef2f2", fontSize: 13
          }}>
            <span style={{ color: "#94a3b8", fontSize: 11, marginRight: 4 }}>C{i+1}</span>
            <span style={{ fontWeight: 700, fontFamily: "monospace", color: r.ok ? "#047857" : "#b91c1c" }}>
              {r.student || "–"}
            </span>
            {!r.ok && (
              <span style={{ marginLeft: 6, fontSize: 12, color: "#64748b" }}>
                → <span style={{ color: "#059669", fontWeight: 700 }}>{r.correct}</span>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function P4DetailGrid({ p4, maxScore }: { p4: GradeP4; maxScore: number }) {
  const hasDetal = p4.detail && p4.detail.length > 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={styles.sectionLabel}>Phần IV — Tự Luận</p>
        <span style={{ fontWeight: 800, fontSize: 16, color: "#0891b2" }}>
          {p4.score}<span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>/{maxScore} đ</span>
        </span>
      </div>

      {hasDetal ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {p4.detail!.map((q, qi) => {
            const pct = q.max > 0 ? Math.min(1, q.score / q.max) : 0;
            const allOk = q.steps.length > 0 && q.steps.every(s => s.ok);
            const anyOk = q.steps.some(s => s.ok);
            const borderColor = allOk ? "#6ee7b7" : anyOk ? "#fde68a" : "#fca5a5";
            const bgColor = allOk ? "#f0fdf4" : anyOk ? "#fffbeb" : "#fef2f2";
            return (
              <div key={qi} style={{ borderRadius: 14, border: `2px solid ${borderColor}`, background: bgColor, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: `1px solid ${borderColor}`, background: "rgba(255,255,255,0.6)" }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: allOk ? "#059669" : anyOk ? "#d97706" : "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                    {q.q}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#0f172a", flex: 1 }}>Câu {q.q}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 72, height: 6, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct * 100}%`, background: allOk ? "#059669" : anyOk ? "#d97706" : "#dc2626", borderRadius: 999 }} />
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 14, color: allOk ? "#059669" : anyOk ? "#d97706" : "#dc2626", minWidth: 48, textAlign: "right" }}>
                      {q.score.toFixed(2)}<span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>/{q.max}</span>
                    </span>
                  </div>
                </div>
                {q.steps.length > 0 && (
                  <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                    {q.steps.map((step, si) => (
                      <div key={si} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: "50%", flexShrink: 0, marginTop: 1,
                          background: step.ok ? "#dcfce7" : "#fee2e2",
                          border: `2px solid ${step.ok ? "#86efac" : "#fca5a5"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 800,
                          color: step.ok ? "#166534" : "#991b1b"
                        }}>
                          {step.ok ? "✓" : "✗"}
                        </div>
                        <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.65, color: step.ok ? "#14532d" : "#7f1d1d" }}>
                          <FeedbackRenderer content={step.text} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {q.comment && (
                  <div style={{ padding: "8px 16px 12px", borderTop: `1px dashed ${borderColor}` }}>
                    <div style={{ fontSize: 12, color: "#475569", fontStyle: "italic", display: "flex", gap: 6, alignItems: "flex-start" }}>
                      <span style={{ flexShrink: 0 }}>💬</span>
                      <FeedbackRenderer content={q.comment} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        p4.feedback ? (
          <div style={{ background: "#f0fdfa", borderRadius: 12, padding: 16, border: "1px solid #99f6e4" }}>
            <FeedbackRenderer content={p4.feedback} />
          </div>
        ) : null
      )}
      {hasDetal && p4.feedback && (
        <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Nhận xét tổng quan</div>
          <FeedbackRenderer content={p4.feedback} />
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (score / max) * 100) : 0;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 800, color }}>{score.toFixed(2)}<span style={{ color: "#cbd5e1", fontWeight: 400 }}>/{max}</span></span>
      </div>
      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 999, transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}

function GradeBadge({ total }: { total: number }) {
  const [label, bg]: [string, string] = total >= 8 ? ["Giỏi", "#059669"] : total >= 6.5 ? ["Khá", "#2563eb"] : total >= 5 ? ["Trung bình", "#d97706"] : ["Yếu", "#dc2626"];
  return (
    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, background: bg, color: "white", fontSize: 12, fontWeight: 700, letterSpacing: "0.03em" }}>
      {label}
    </span>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, CSSProperties> = {
  sectionLabel: { margin: "0 0 4px", fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" },
  card: { background: "#ffffff", borderRadius: 16, padding: "20px 24px", border: "1px solid #e2e8f0", marginBottom: 16 },
  h2: { margin: "0 0 16px", fontSize: 15, fontWeight: 700, color: "#0f172a" },
  input: { width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 14, boxSizing: "border-box", outline: "none" },
  btnPrimary: { padding: "10px 22px", borderRadius: 10, border: "none", background: "#0d9488", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14 },
  btnSecondary: { padding: "8px 16px", borderRadius: 8, border: "none", background: "#ccfbf1", color: "#0f766e", fontWeight: 600, cursor: "pointer", fontSize: 13 },
  btnSuccess: { padding: "10px 22px", borderRadius: 10, border: "none", background: "#059669", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14 },
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PhieuGrader() {
  const [tab, setTab] = useState(0);
  const [keyRaw, setKeyRaw] = useState("");
  const [answerKey, setAnswerKey] = useState<AnswerKey | null>(null);
  
  // ✅ Tích hợp DataStore & Auth để lấy Lớp / Học sinh
  const { classes, students, enrollments, loadClasses, loadStudents, loadEnrollments } = useDataStore() as any;
  const { user, isAdmin } = useAuthStore() as any;

  // Lọc danh sách lớp của GV
  const myClasses = isAdmin() ? classes : classes?.filter((c:any) => c.teacher_id === user?.id);

  // Lưu API Key Local
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  useEffect(() => { localStorage.setItem('gemini_api_key', apiKey); }, [apiKey]);

  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  
  const [p4Rubric, setP4Rubric] = useState("");
  const [p4Images, setP4Images] = useState<ImgData[]>([]);
  const [weights, setWeights] = useState<Weights>({ p1: 3, p2: 2, p3: 2, p4: 3 });
  const [p2Mode, setP2Mode] = useState<'equal' | 'ministry'>('equal');
  const [p4SubCount, setP4SubCount] = useState(3);
  
  const [gradingStudents, setGradingStudents] = useState<GradingStudent[]>([]);
  const [results, setResults] = useState<Record<string, StudentResult>>({});
  const [grading, setGrading] = useState<Record<string, boolean>>({});
  const [newImgs, setNewImgs] = useState<ImgData[]>([]);
  
  const keyRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const p4ImgRef = useRef<HTMLInputElement>(null);

  const totalW = Object.values(weights).reduce((a, b) => a + b, 0);

  useEffect(() => {
    loadClasses(); loadStudents(); loadEnrollments();
  }, []);

  // Lấy danh sách HS theo lớp
  const rosterStudents = selectedClassId 
    ? enrollments.filter((e:any) => e.class_id === selectedClassId && e.status === 'active')
                 .map((e:any) => students.find((s:any) => s.id === e.student_id))
                 .filter(Boolean)
    : [];

  const handleKeyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const txt = await f.text();
    setKeyRaw(txt);
    const parsed = parseAnswerKey(txt);
    if (parsed.p4) setP4Rubric(parsed.p4);
    setAnswerKey({ ...parsed, p4: parsed.p4 || p4Rubric });
  };

  const applyKey = () => {
    const parsed = parseAnswerKey(keyRaw);
    parsed.p4 = p4Rubric;
    setAnswerKey(parsed);
    toast.success("Đã áp dụng cấu trúc đáp án!");
  };

  const handleImgFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const slots = 2 - newImgs.length;
    const toAdd = await Promise.all(files.slice(0, slots).map(fileToBase64));
    setNewImgs(imgs => [...imgs, ...toAdd]);
    e.target.value = "";
  };

  const handleP4ImgFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const slots = 5 - p4Images.length; 
    const toAdd = await Promise.all(files.slice(0, slots).map(fileToBase64));
    setP4Images(imgs => [...imgs, ...toAdd]);
    e.target.value = "";
  };

  const addStudentToQueue = () => {
    if (!selectedStudentId) return toast.error("Vui lòng chọn học sinh!");
    if (newImgs.length === 0) return toast.error("Vui lòng đính kèm ảnh bài làm!");
    
    const stu = students.find((s:any) => s.id === selectedStudentId);
    if (!stu) return;

    if (gradingStudents.some(s => s.id === stu.id)) {
      return toast.error("Học sinh này đã có trong danh sách chờ chấm!");
    }

    setGradingStudents(s => [...s, { id: stu.id, name: stu.full_name, student_code: stu.student_code, images: newImgs }]);
    setSelectedStudentId("");
    setNewImgs([]);
    toast.success(`Đã thêm ${stu.full_name} vào danh sách chấm!`);
  };

  const removeStudent = (id: string) => {
    setGradingStudents(s => s.filter(x => x.id !== id));
    setResults(r => { const n = { ...r }; delete n[id]; return n; });
  };

  const gradeOne = useCallback(async (student: GradingStudent) => {
    if (!answerKey || !student.images.length) return;
    if (!apiKey) return toast.error("Vui lòng nhập Gemini API Key ở Tab 'Học Sinh'!");

    setGrading(g => ({ ...g, [student.id]: true }));
    const toastId = toast.loading(`Đang chấm bài của ${student.name}...`);
    
    try {
      const fullKey = { ...answerKey, p4: p4Rubric };
      // Dùng hàm API gọi thẳng
      const ai = await callGradingAPI(apiKey, student, fullKey, weights, p4Images, p4SubCount);
      
      const p1 = gradeP1(ai.p1 || [], answerKey.p1, weights.p1);
      const p2 = gradeP2(ai.p2 || [], answerKey.p2, weights.p2, p2Mode);
      const p3 = gradeP3(ai.p3 || [], answerKey.p3, weights.p3);
      const p4Score = Math.min(weights.p4, Math.max(0, Number(ai.p4_score) || 0));
      const total = Math.round((p1.score + p2.score + p3.score + p4Score) * 100) / 100;
      const p4Detail = Array.isArray(ai.p4_detail) && ai.p4_detail.length > 0 ? ai.p4_detail : undefined;
      
      setResults(r => ({ ...r, [student.id]: { p1, p2, p3, p4: { score: p4Score, feedback: ai.p4_feedback || "", detail: p4Detail }, total } }));
      toast.success(`Chấm xong: ${student.name} (${total}đ)`, { id: toastId });
    } catch (err: any) {
      toast.error(`Lỗi chấm bài: ${err.message}`, { id: toastId });
    }
    setGrading(g => ({ ...g, [student.id]: false }));
  }, [answerKey, p4Rubric, weights, p4Images, p2Mode, p4SubCount, apiKey]);

  const gradeAll = () => gradingStudents.filter(s => s.images.length && !grading[s.id]).forEach(gradeOne);

  const saveToSupabase = () => {
    toast.success("Chức năng lưu bài thi trực tiếp vào Supabase sẽ được tích hợp ở bản cập nhật tiếp theo!", { icon: '🚀' });
  };

  const exportExcel = () => {
    if (!answerKey) return;
    const wb = XLSX.utils.book_new();
    const rows = gradingStudents.filter(s => results[s.id]).map(s => {
      const r = results[s.id];
      const row: Record<string, unknown> = {
        "Họ và tên": s.name,
        "Mã HS": s.student_code || '',
        [`P1 (tối đa ${weights.p1}đ)`]: r.p1.score,
        [`P2 (tối đa ${weights.p2}đ)`]: r.p2.score,
        [`P3 (tối đa ${weights.p3}đ)`]: r.p3.score,
        [`P4 (tối đa ${weights.p4}đ)`]: r.p4.score,
        "Tổng điểm (/10)": r.total,
        "Xếp loại": r.total >= 8 ? "Giỏi" : r.total >= 6.5 ? "Khá" : r.total >= 5 ? "Trung bình" : "Yếu",
      };
      r.p1.results.forEach((q, i) => { row[`P1.C${i+1}(ĐA:${q.correct})`] = q.student; });
      r.p2.results.forEach((q, i) => {
        (["a","b","c","d"] as const).forEach((lbl, j) => {
          if (q.subs[j]) row[`P2.C${i+1}${lbl}(ĐA:${q.subs[j].correct})`] = q.subs[j].student;
        });
      });
      r.p3.results.forEach((q, i) => { row[`P3.C${i+1}(ĐA:${q.correct})`] = q.student; });
      row["P4 Nhận xét AI"] = r.p4.feedback;
      return row;
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Kết quả");
    const keyRows = [
      ...answerKey.p1.map((a, i) => ({ Phần: "P1", "Câu số": i+1, "Đáp án": a, "Loại": "Trắc nghiệm" })),
      ...answerKey.p2.map((a, i) => ({ Phần: "P2", "Câu số": i+1, "Đáp án": a, "Loại": "Đúng/Sai (DDSS)" })),
      ...answerKey.p3.map((a, i) => ({ Phần: "P3", "Câu số": i+1, "Đáp án": a, "Loại": "Trả lời ngắn" })),
      { Phần: "P4", "Câu số": 1, "Đáp án": answerKey.p4, "Loại": "Tự luận (Rubric)" },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(keyRows), "Đáp án");
    XLSX.writeFile(wb, `KetQua_${new Date().toLocaleDateString("vi-VN").replace(/\//g, "-")}.xlsx`);
  };

  const barColors = ["#0d9488", "#f59e0b", "#10b981", "#0891b2"];
  const gradedCount = gradingStudents.filter(s => results[s.id]).length;

  return (
    <div style={{ fontFamily: "'Outfit', 'Segoe UI', system-ui, sans-serif", minHeight: "100vh", background: "#f1f5f9" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');`}</style>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg, #042f2e 0%, #0f766e 100%)", padding: "20px 28px 0", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -20, right: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(94,234,212,0.1)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(94,234,212,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>⚡</div>
          <div>
            <h1 style={{ margin: 0, color: "white", fontSize: 20, fontWeight: 800 }}>PhieuGrader AI</h1>
            <p style={{ margin: 0, color: "#5eead4", fontSize: 12 }}>Chấm tự động cực nhanh với Gemini Vision</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 16, fontSize: 12, color: "#99f6e4" }}>
            <span>📋 {gradingStudents.length} HS chờ chấm</span>
            <span>✅ {gradedCount} đã chấm</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {([["🔑", "Đáp Án"], ["👥", "Học Sinh"], ["📊", "Kết Quả"]] as [string, string][]).map(([icon, label], i) => (
            <button key={i} onClick={() => setTab(i)} style={{
              padding: "10px 20px", border: "none", background: tab === i ? "white" : "transparent",
              color: tab === i ? "#0f766e" : "#5eead4", fontWeight: tab === i ? 700 : 500,
              borderRadius: "10px 10px 0 0", cursor: "pointer", fontSize: 14, transition: "all .15s"
            }}>
              {icon} {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "20px 28px", maxWidth: 900, margin: "0 auto" }}>

        {/* ══ TAB 0: ĐÁP ÁN ══ */}
        {tab === 0 && (
          <div>
            <div style={styles.card}>
              <h2 style={styles.h2}>📂 File đáp án (.txt)</h2>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                <input ref={keyRef} type="file" accept=".txt" onChange={handleKeyFile} style={{ display: "none" }} />
                <button onClick={() => keyRef.current?.click()} style={styles.btnPrimary}>Chọn file .txt</button>
                {answerKey && (
                  <span style={{ color: "#059669", fontWeight: 600, fontSize: 13 }}>
                    ✅ {answerKey.p1.length} câu P1 · {answerKey.p2.length} câu P2 · {answerKey.p3.length} câu P3
                  </span>
                )}
              </div>
              <textarea value={keyRaw} onChange={e => setKeyRaw(e.target.value)}
                placeholder={"P1 | 1 | A\nP1 | 2 | B\n...\nP2 | 1 | DDSS\n...\nP3 | 1 | 2026\n..."}
                style={{ ...styles.input, height: 160, fontFamily: "monospace", fontSize: 13, resize: "vertical" } as CSSProperties} />
              <button onClick={applyKey} style={{ ...styles.btnSecondary, marginTop: 10 }}>Áp dụng đáp án</button>
            </div>

            <div style={styles.card}>
              <h2 style={styles.h2}>✍️ Rubric Tự Luận (Phần IV)</h2>
              <div style={{ marginBottom: 12 }}>
                <input ref={p4ImgRef} type="file" accept="image/*" multiple onChange={handleP4ImgFiles} style={{ display: "none" }} />
                <button onClick={() => p4ImgRef.current?.click()} disabled={p4Images.length >= 5}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "1px dashed #0ea5e9", background: "#f0f9ff", color: "#0369a1", fontWeight: 600, cursor: p4Images.length >= 5 ? "not-allowed" : "pointer", fontSize: 13, opacity: p4Images.length >= 5 ? 0.5 : 1 }}>
                  📷 Thêm ảnh đáp án chuẩn ({p4Images.length}/5)
                </button>
              </div>

              {p4Images.length > 0 && (
                <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                  {p4Images.map((img, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={`data:${img.type};base64,${img.data}`} alt="" style={{ height: 60, borderRadius: 6, border: "1px solid #e2e8f0", objectFit: "cover" }} />
                      <button onClick={() => setP4Images(imgs => imgs.filter((_, j) => j !== i))}
                        style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#ef4444", color: "white", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <textarea value={p4Rubric} onChange={e => setP4Rubric(e.target.value)}
                placeholder={"Ví dụ:\n- Trình bày đúng công thức: 1 điểm\n- Tính toán chính xác: 1 điểm\n- Kết luận rõ ràng: 1 điểm"}
                style={{ ...styles.input, height: 120, resize: "vertical" } as CSSProperties} />
            </div>

            <div style={styles.card}>
              <h2 style={styles.h2}>⚖️ Cấu hình thang điểm</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
                {([ ["p1","P1 – Trắc nghiệm","#0d9488"], ["p2","P2 – Đúng/Sai","#f59e0b"], ["p3","P3 – Ngắn","#10b981"], ["p4","P4 – Tự luận","#0891b2"] ] as [keyof Weights, string, string][]).map(([k, label, color]) => (
                  <div key={k}>
                    <label style={{ fontSize: 11, fontWeight: 700, color, display: "block", marginBottom: 6 }}>{label}</label>
                    <input type="number" min="0" max="10" step="0.5" value={weights[k]}
                      onChange={e => setWeights(w => ({ ...w, [k]: parseFloat(e.target.value) || 0 }))}
                      style={{ ...styles.input, textAlign: "center", fontSize: 20, fontWeight: 800, color, borderColor: color + "44" } as CSSProperties} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 10, background: "#f0f9ff", border: "1px solid #bae6fd" }}>
                <span style={{ fontSize: 13, color: "#0369a1", fontWeight: 600, flex: 1 }}>
                  📝 Số câu tự luận (P4) — mỗi câu {weights.p4 > 0 ? (weights.p4 / p4SubCount).toFixed(2) : 0} đ
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {[1, 2, 3, 4].map(n => (
                    <button key={n} onClick={() => setP4SubCount(n)}
                      style={{ width: 36, height: 36, borderRadius: 8, border: `2px solid ${p4SubCount === n ? "#0891b2" : "#e2e8f0"}`, background: p4SubCount === n ? "#0891b2" : "#fff", color: p4SubCount === n ? "white" : "#64748b", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB 1: HỌC SINH ══ */}
        {tab === 1 && (
          <div>
            {/* ✅ Ô Nhập API Key */}
            <div style={{ marginBottom: 20, padding: 16, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: "#d97706", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <KeyRound className="w-4 h-4" /> Gemini API Key (Bảo mật: Chỉ lưu trên máy của bạn)
              </label>
              <input 
                type="password" 
                value={apiKey} 
                onChange={e => setApiKey(e.target.value)} 
                placeholder="Nhập API Key bắt đầu bằng AIzaSy..." 
                style={{ ...styles.input, borderColor: "#fde68a" } as CSSProperties} 
              />
            </div>

            <div style={styles.card}>
              <h2 style={styles.h2}>➕ Danh sách chờ chấm</h2>
              
              {/* ✅ GIAO DIỆN CHỌN LỚP & HỌC SINH TỪ SUPABASE */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                    <Users className="w-3.5 h-3.5" /> Chọn Lớp học
                  </label>
                  <select 
                    value={selectedClassId} 
                    onChange={e => { setSelectedClassId(e.target.value); setSelectedStudentId(''); }}
                    style={styles.input}
                  >
                    <option value="">-- Chọn một lớp --</option>
                    {myClasses?.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.class_name} ({c.grade})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
                    <GraduationCap className="w-3.5 h-3.5" /> Chọn Học sinh nộp bài
                  </label>
                  <select 
                    value={selectedStudentId} 
                    onChange={e => setSelectedStudentId(e.target.value)}
                    disabled={!selectedClassId}
                    style={{ ...styles.input, background: !selectedClassId ? "#f1f5f9" : "#fff" } as CSSProperties}
                  >
                    <option value="">-- Chọn học sinh --</option>
                    {rosterStudents?.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.full_name} ({s.student_code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input ref={imgRef} type="file" accept="image/*" multiple onChange={handleImgFiles} style={{ display: "none" }} />
                <button onClick={() => imgRef.current?.click()} disabled={newImgs.length >= 2}
                  style={{ padding: "10px 16px", borderRadius: 10, border: "1px dashed #5eead4", background: "#f0fdfa", color: "#0f766e", fontWeight: 600, cursor: newImgs.length >= 2 ? "not-allowed" : "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <UploadCloud className="w-4 h-4" /> Đính kèm ảnh phiếu ({newImgs.length}/2)
                </button>
                
                <button onClick={addStudentToQueue} disabled={!selectedStudentId || newImgs.length === 0}
                  style={{ ...styles.btnPrimary, marginLeft: "auto", opacity: selectedStudentId && newImgs.length > 0 ? 1 : 0.4 }}>
                  Thêm vào hàng chờ
                </button>
              </div>

              {newImgs.length > 0 && (
                <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                  {newImgs.map((img, i) => (
                    <div key={i} style={{ position: "relative" }}>
                      <img src={`data:${img.type};base64,${img.data}`} alt="" style={{ height: 80, borderRadius: 8, border: "1px solid #e2e8f0", objectFit: "cover" }} />
                      <button onClick={() => setNewImgs(imgs => imgs.filter((_, j) => j !== i))}
                        style={{ position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: "50%", background: "#ef4444", color: "white", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {gradingStudents.length > 0 ? (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <p style={{ margin: 0, fontWeight: 700, color: "#0f172a", fontSize: 14 }}>{gradingStudents.length} học sinh đang chờ</p>
                  <button onClick={gradeAll} disabled={!answerKey || !apiKey}
                    style={{ ...styles.btnPrimary, opacity: answerKey && apiKey ? 1 : 0.4 }}>
                    ⚡ Chấm tự động tất cả
                  </button>
                </div>
                {gradingStudents.map(s => {
                  const r = results[s.id];
                  const isGrading = grading[s.id];
                  return (
                    <div key={s.id} style={{ ...styles.card, display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", marginBottom: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#ccfbf1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#0f766e", flexShrink: 0 }}>
                        {s.name.trim().split(" ").pop()![0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{s.name}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>{s.student_code} • {s.images.length} ảnh đính kèm</p>
                      </div>
                      {s.images.map((img, i) => (
                        <img key={i} src={`data:${img.type};base64,${img.data}`} alt="" style={{ height: 44, borderRadius: 6, border: "1px solid #e2e8f0", objectFit: "cover" }} />
                      ))}
                      {r && <GradeBadge total={r.total} />}
                      {r && (
                        <span style={{ fontWeight: 900, fontSize: 22, color: "#0d9488", minWidth: 44, textAlign: "right" }}>
                          {r.total}<span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>/10</span>
                        </span>
                      )}
                      <button onClick={() => gradeOne(s)} disabled={!answerKey || isGrading || !apiKey}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: isGrading ? "#f1f5f9" : "#ccfbf1", color: isGrading ? "#94a3b8" : "#0f766e", fontWeight: 600, cursor: isGrading ? "not-allowed" : "pointer", fontSize: 13, minWidth: 88 }}>
                        {isGrading ? "⏳ Đang..." : r ? "Chấm lại" : "Chấm bài"}
                      </button>
                      <button onClick={() => removeStudent(s.id)}
                        style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: "#fee2e2", color: "#dc2626", cursor: "pointer", fontWeight: 600 }}>🗑</button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
                <p style={{ fontWeight: 600 }}>Chưa có học sinh nào.</p>
                <p style={{ fontSize: 13 }}>Chọn lớp và học sinh ở bảng trên để bắt đầu.</p>
              </div>
            )}
          </div>
        )}

        {/* ══ TAB 2: KẾT QUẢ ══ */}
        {tab === 2 && (
          <div>
            {gradedCount > 0 && (
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <button onClick={saveToSupabase} style={styles.btnSecondary}>
                  ☁️ Lưu điểm lên Hệ thống
                </button>
                <button onClick={exportExcel} style={styles.btnSuccess}>📥 Xuất Excel ({gradedCount} HS)</button>
              </div>
            )}
            {gradedCount === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 20px", color: "#94a3b8" }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>📊</div>
                <p style={{ fontWeight: 600 }}>Chưa có kết quả chấm bài.</p>
                <p style={{ fontSize: 13 }}>Chuyển sang tab <strong>Học Sinh</strong> để thêm bài và chấm.</p>
              </div>
            ) : gradingStudents.filter(s => results[s.id]).map(s => {
              const r = results[s.id];
              const p1Correct = r.p1.results.filter(x => x.ok).length;
              const p3Correct = r.p3.results.filter(x => x.ok).length;
              return (
                <div key={s.id} style={styles.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{s.name} <span style={{ fontSize: 14, color: "#64748b", fontWeight: 600 }}>({s.student_code})</span></h3>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                        <GradeBadge total={r.total} />
                        <span style={{ fontSize: 32, fontWeight: 900, color: "#0d9488", lineHeight: 1 }}>
                          {r.total}<span style={{ fontSize: 14, color: "#94a3b8", fontWeight: 400 }}>/10</span>
                        </span>
                      </div>
                    </div>
                    <div style={{ minWidth: 220 }}>
                      <ScoreBar label="P1 – Trắc nghiệm" score={r.p1.score} max={weights.p1} color={barColors[0]} />
                      <ScoreBar label="P2 – Đúng/Sai" score={r.p2.score} max={weights.p2} color={barColors[1]} />
                      <ScoreBar label="P3 – Trả lời ngắn" score={r.p3.score} max={weights.p3} color={barColors[2]} />
                      <ScoreBar label="P4 – Tự luận" score={r.p4.score} max={weights.p4} color={barColors[3]} />
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
                    {[
                      { label: "P1 đúng", val: `${p1Correct}/${r.p1.results.length}`, color: "#0d9488" },
                      { label: "P3 đúng", val: `${p3Correct}/${r.p3.results.length}`, color: "#10b981" },
                      { label: "P4 điểm", val: `${r.p4.score}/${weights.p4}`, color: "#0891b2" },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ background: "#f8fafc", borderRadius: 10, padding: "8px 14px", border: "1px solid #e2e8f0" }}>
                        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color }}>{val}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 20, display: "flex", flexDirection: "column", gap: 24 }}>
                    <P1Grid results={r.p1.results} />
                    <P2Grid results={r.p2.results} />
                    <P3Grid results={r.p3.results} />
                    {(r.p4.score > 0 || r.p4.feedback || r.p4.detail) && (
                      <P4DetailGrid p4={r.p4} maxScore={weights.p4} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
