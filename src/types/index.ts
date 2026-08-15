// ─── PHẦN 1: QUẢN LÝ TRUNG TÂM (CRM / LMS CƠ BẢN) ────────────────────

export type Role = 'ADMIN' | 'TEACHER' | 'TA'

export interface Profile {
  id: string
  email: string
  name: string | null
  role: Role
  active: boolean
  created_at: string
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: Role;
  isApproved: boolean;
  createdAt: any;
  classIds: string[];
}

export interface Class {
  id: string
  name: string
  description: string | null
  schedule: string | null
  fee_per_session: number
  status: 'active' | 'inactive'
  created_at: string
}

export interface ClassJoinRequest {
  id: string;
  classId: string;
  studentId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
}

export interface Student {
  id: string
  student_code: string
  full_name: string
  date_of_birth: string | null
  school: string | null
  grade: string | null
  address: string | null
  parent_name: string | null
  parent_phone: string | null
  parent_email: string | null
  zalo: string | null
  note: string | null
  status: 'active' | 'inactive'
  created_at: string
  avatar_url?: string | null
}

export interface Enrollment {
  id: string
  student_id: string
  class_id: string
  status: 'active' | 'inactive'
  enrolled_at: string
}

export type AttendanceStatus = 'present' | 'late' | 'absent'

export interface AttendanceRecord {
  id: string
  class_id: string
  student_id: string
  date: string
  present: boolean
  status: AttendanceStatus
  note: string | null
  created_at: string
}

export type PaymentMethod = 'cash' | 'transfer' | 'seapay'

export interface Payment {
  id: string
  student_id: string | null
  class_id: string | null
  amount: number
  method: PaymentMethod
  note: string | null
  paid_at: string
  transaction_id: string | null
  created_at: string
}

export type EmailType = 'tuition' | 'attendance' | 'payment_confirm'

export interface EmailLog {
  id: string
  student_id: string | null
  type: EmailType
  recipient: string
  subject: string
  status: 'sent' | 'failed'
  error: string | null
  created_at: string
}

export interface TeacherClass {
  id: string
  teacher_id: string
  class_id: string
  status: 'active' | 'inactive'
}

export interface TuitionNotification {
  id: string
  student_id: string
  class_id: string
  course_name: string
  amount: number
  is_paid: boolean
  created_at: string
}

export interface TuitionRow {
  student: Student
  plannedSessions: number
  absences: number
  attendedSessions: number
  totalFee: number
  paidAmount: number
  debt: number
}

export interface AttendanceRow {
  student: Student
  record: AttendanceRecord | null
  status: AttendanceStatus
  note: string
}

export interface AttendanceReportRecord {
  date: string
  status: AttendanceStatus
  note: string | null
}

export interface SendEmailPayload {
  type: EmailType
  parentEmail: string
  studentName: string
  className: string
  month: string
  centerName?: string
  parentPhone?: string
  plannedSessions?: number
  absences?: number
  attendedSessions?: number
  feePerSession?: number
  totalFee?: number
  paidAmount?: number
  debt?: number
  bankId?: string
  bankAccount?: string
  bankAccountName?: string
  records?: AttendanceReportRecord[]
  amount?: number
  transactionId?: string
  transferAt?: string
  description?: string
}

// ─── PHẦN 2: TÍNH NĂNG THI CỬ (EXAM) ──────────────────────────────

// ✅ Gộp kiểu dữ liệu cũ và mới để không báo lỗi
export type QuestionType = 
  | 'multiple_choice' | 'true_false' | 'short_answer' | 'writing' | 'unknown'
  | 'multichoice' | 'truefalse' | 'shortans' | 'essay';

// ✅ Khai báo biến hằng số để các component LaTeX dùng (hoạt động như Enum)
export const QuestionType = {
  MULTICHOICE: 'multichoice' as const,
  TRUEFALSE: 'truefalse' as const,
  SHORTANS: 'shortans' as const,
  ESSAY: 'essay' as const,
};

export interface ImageData {
  id?: string;
  data: string;
  type: string;
  name?: string;
  width?: number;
  height?: number;
  filename?: string;
  rId?: string;
}

export interface QuestionOption {
  id?: string;
  text: string;
  letter: string;
  isCorrect?: boolean;
  images?: ImageData[];
}

export interface Question {
  id?: string;
  number: number | string;
  part?: number;
  type: QuestionType;
  text: string;
  options?: QuestionOption[];
  correctAnswer?: string | null;
  solution?: string;
  images?: ImageData[];
  [key: string]: any;
}

export interface QuestionSolutionRange {
  pageStart: number;
  pageEnd?: number;
}

export interface ExamPointsConfig {
  maxScore: number;
  sections: SectionPointsConfig[];
}

export interface SectionPointsConfig {
  part?: number;
  sectionId?: string;
  sectionName?: string;
  questionType?: string;
  totalQuestions?: number;
  totalPoints: number;
  pointsPerQuestion: number;
  trueFalseMode?: string;
}

export interface ExamData {
  title?: string;
  questions: Question[];
  [key: string]: any;
}

// ✅ THÊM INTERFACE EXAM ĐỂ HỖ TRỢ SUPABASE
export interface Exam {
  id: string;
  title: string;
  description?: string | null;
  timeLimit: number;
  questions: Question[];
  sections?: SectionPointsConfig[];
  answers?: Record<string, any>;
  images?: any;
  createdBy: string;
  pointsConfig?: ExamPointsConfig;

  // --- TRƯỜNG DỮ LIỆU MỚI CHO SUPABASE ---
  pdfUrl?: string; 
  solutionPdfUrl?: string;

  // --- Legacy Drive (Giữ lại để tương thích đề thi cũ) ---
  pdfDriveUrl?: string;
  pdfDriveFileId?: string;
  solutionPdfDriveUrl?: string;
  solutionPdfDriveFileId?: string;

  questionSolutions?: Record<number, QuestionSolutionRange>;
  hasPdfSubcollection?: boolean;
  pdfBase64?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface Room {
  id: string;
  name: string;
  examId: string;
  status: 'waiting' | 'active' | 'completed';
  createdAt: any;
  updatedAt: any;
}

export interface StudentInfo {
  id?: string;
  name: string;
  studentCode?: string;
}

export interface Submission {
  id: string;
  roomId: string;
  studentId: string;
  studentName: string;
  answers: Record<number, string>;
  writingAnswers?: Record<number, string>;
  score: number;
  submitTime: any;
  status: 'submitted' | 'grading';
}

// ─── PHẦN 3: TÍNH NĂNG OCR PDF (CƠ BẢN) ──────────────────────────────

export interface OCRImage {
  id: string;
  caption: string;
  mime: string;
  base64: string;
  dataUri: string;
}

export interface OCRPage {
  pageNumber: number;
  text: string;
  markdown: string;
  markdownDataUri: string;
  images: OCRImage[];
  charCount: number;
}

export interface OCRResult {
  success: boolean;
  pages: OCRPage[];
  pageCount: number;
  pagesWithText: number;
  totalChars: number;
  totalImages: number;
  fileId?: string;
  fileName?: string;
  allMarkdownDataUri?: string;
  logs?: string[];
  processedAt?: string;
  error?: string;
}

export enum AppState {
  IDLE = 'IDLE',
  UPLOADING_OCR = 'UPLOADING_OCR',
  OCR_COMPLETE = 'OCR_COMPLETE',
  CORRECTING = 'CORRECTING',
  ERROR = 'ERROR'
}

export interface Settings {
  gasEndpoint: string;
  geminiApiKey: string;
}

declare global {
  interface Window {
    marked: {
      parse: (text: string) => string;
    };
  }
}

// ─── PHẦN 4: BỘ CÔNG CỤ TOÁN HỌC LATEX & TIKZ ────────────────────────

export type Subject = 'toán' | 'hóa' | 'anh';
export type Difficulty = 'dễ hơn' | 'tương đương' | 'khó hơn';
export type ProblemType = 'tự động phát hiện' | 'trắc nghiệm' | 'tự luận';

export type TikzCategory = 
  | 'hinh_phang'
  | 'hinh_khong_gian'
  | 'do_thi'
  | 'bang_bien_thien'
  | 'truc_so'
  | 'bieu_do'
  | 'khong_co_hinh';

export interface TikzDetectionResult {
  category: TikzCategory;
  confidence: number;
  snippets?: string;
}

export interface TikZRequest {
  source: string;
  mode?: 'auto' | 'tikz' | 'latex';
  format?: 'png' | 'svg' | 'pdf';
  density?: number;
  packages?: string[] | null;
  preamble?: string;
  transparent?: boolean;
  returnLog?: boolean;
}

export interface TikZResponse {
  ok: boolean;
  base64?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  log?: string;
  detail?: string;
}

export interface GenerationOptions {
  numberOfProblems: number;
  difficultyLevel: Difficulty;
  problemType: ProblemType;
  includeSolutions: boolean;
  specificRequirements: string;
  subject: Subject;
}

export interface QuestionTopic {
  name: string;
  difficulty: Difficulty;
  counts: Record<string, number>; 
}

export interface QuestionOptions {
  topics: QuestionTopic[];
  includeTikz: boolean;
  includeSolution: boolean;
  autoTikz: boolean;
  additionalRequirements?: string;
  highQuality?: boolean;
}

export interface GenerationStats {
  count: number;
  expectedCount: number;
  type: string;
  hasTikz: boolean;
  hasSolution: boolean;
  topic: string;
  generatedAt: string;
  isComplete: boolean;
}

export interface GenerationResult {
  success: boolean;
  latex: string;
  stats?: GenerationStats;
  error?: string;
  modelUsed?: string;
}

export interface Coefficients {
  a: number;
  b: number;
  c: number;
  d: number;
  m: number;
  n: number;
}

export interface GeoParams {
  [key: string]: string;
  A: string;
  B: string;
  C: string;
  D: string;
  M: string;
  N: string;
  P: string;
  Q: string;
  h: string;
  R: string;
}

export interface OcrResult {
  text: string;
  tikzDetected?: boolean;
  tikzCategory?: TikzCategory;
  confidence?: number;
}
