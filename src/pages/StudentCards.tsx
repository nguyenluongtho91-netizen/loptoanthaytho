// @ts-nocheck
import { useEffect, useState } from 'react'
import { Printer, Users, RefreshCw, GraduationCap, QrCode, Palette } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const THEMES = {
  teal:   { gradient: 'linear-gradient(135deg,#0d9488 0%,#134e4a 100%)', qrColor: '0d9488', label: 'Xanh ngọc' },
  blue:   { gradient: 'linear-gradient(135deg,#2563eb 0%,#1e3a8a 100%)', qrColor: '1d4ed8', label: 'Xanh dương' },
  violet: { gradient: 'linear-gradient(135deg,#7c3aed 0%,#4c1d95 100%)', qrColor: '7c3aed', label: 'Tím' },
  orange: { gradient: 'linear-gradient(135deg,#ea580c 0%,#7c2d12 100%)', qrColor: 'ea580c', label: 'Cam' },
  rose:   { gradient: 'linear-gradient(135deg,#e11d48 0%,#881337 100%)', qrColor: 'e11d48', label: 'Đỏ hồng' },
  slate:  { gradient: 'linear-gradient(135deg,#475569 0%,#0f172a 100%)', qrColor: '475569', label: 'Đen xám' },
}

function StudentCard({ student, centerName, classInfo, theme }) {
  const t        = THEMES[theme]
  const initials = student.full_name?.split(' ').slice(-2).map((w) => w[0]).join('').toUpperCase() || 'HS'
  const url      = `${window.location.origin}/progress?code=${student.student_code}`
  const qrSrc    = `https://quickchart.io/qr?text=${encodeURIComponent(url)}&size=120&margin=2&dark=${t.qrColor}&light=ffffff`

  return (
    <div className="student-card" style={{
      width: '85.6mm', height: '54mm',
      borderRadius: '3mm',
      overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: '"Segoe UI", system-ui, sans-serif',
      backgroundColor: '#ffffff',
      boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
      flexShrink: 0,
      position: 'relative',
    }}>

      {/* Header */}
      <div style={{
        background: t.gradient,
        padding: '2.8mm 4mm 2.5mm',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        minHeight: '17mm',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: '8px', // TĂNG SIZE: từ 7px -> 8px
            fontWeight: 700,
            letterSpacing: '2px', textTransform: 'uppercase', marginBottom: '1.2mm',
          }}>
            THẺ HỌC VIÊN
          </div>
          <div style={{ 
            color: '#fff', 
            fontSize: '14px', // TĂNG SIZE: từ 12px -> 14px
            fontWeight: 900, lineHeight: 1.2, maxWidth: '55mm' 
          }}>
            {centerName || 'LỚP TOÁN THẦY THỌ'}
          </div>
          {classInfo?.subject && (
            <div style={{ 
              color: 'rgba(255,255,255,0.75)', 
              fontSize: '10px', // TĂNG SIZE: từ 8.5px -> 10px
              marginTop: '1.2mm', fontWeight: 600 
            }}>
              {classInfo.subject}
            </div>
          )}
        </div>

        {/* Avatar circle */}
        <div style={{
          width: '13mm', height: '13mm', // Nới rộng vòng tròn một chút để chứa chữ to hơn
          background: 'rgba(255,255,255,0.18)',
          border: '1.5px solid rgba(255,255,255,0.4)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', 
          fontSize: '12.5px', // TĂNG SIZE: từ 11px -> 12.5px
          fontWeight: 900, flexShrink: 0,
        }}>
          {initials}
        </div>
      </div>

      {/* Body */}
      <div style={{
        flex: 1, padding: '2.5mm 4mm',
        display: 'flex', gap: '3mm', alignItems: 'stretch',
      }}>
        {/* Info */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1.4mm' }}>
          <div style={{ 
            fontSize: '15px', // TĂNG SIZE: từ 13.5px -> 15px
            fontWeight: 900, color: '#0f172a', lineHeight: 1.2 
          }}>
            {student.full_name}
          </div>
          <div style={{ 
            fontSize: '10.5px', // TĂNG SIZE: từ 9.5px -> 10.5px
            fontFamily: 'monospace', fontWeight: 700, color: '#4b5563', letterSpacing: '0.8px' 
          }}>
            {student.student_code}
          </div>
          {classInfo && (
            <div style={{ 
              fontSize: '10px', // TĂNG SIZE: từ 9px -> 10px
              color: '#1f2937', fontWeight: 700, marginTop: '0.3mm' 
            }}>
              {classInfo.class_name || classInfo.name}
            </div>
          )}
          {student.grade && (
            <div style={{ 
              fontSize: '9px', // TĂNG SIZE: từ 8px -> 9px
              color: '#6b7280', fontWeight: 600 
            }}>Khối {student.grade}</div>
          )}
          <div style={{
            marginTop: '2mm', height: '1.2mm', width: '50%',
            borderRadius: '1mm', background: t.gradient, opacity: 0.5,
          }} />
        </div>

        {/* QR */}
<div style={{
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', gap: '1mm',
  paddingLeft: '2mm', borderLeft: '0.3mm solid #e2e8f0',
}}>
  <img src={qrSrc} alt="QR" style={{ width: '22mm', height: '22mm', display: 'block' }} />
  
  {/* Thêm className="no-print" vào thẻ div dưới đây */}
  <div className="no-print" style={{ 
    fontSize: '7px', 
    color: '#6b7280', fontWeight: 700, textAlign: 'center', lineHeight: 1.4 
  }}>
    Scan xem<br />tiến trình
  </div>
</div>
      </div>
    </div>
  )
}
export default function StudentCards() {
  const [classes, setClasses]         = useState([])
  const [students, setStudents]       = useState([])
  const [enrollments, setEnrollments] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [centerName, setCenterName]       = useState('')
  const [theme, setTheme]                 = useState('teal')
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: cls }, { data: stu }, { data: enr }] = await Promise.all([
          supabase.from('classes').select('*').eq('status', 'active').order('class_name'),
          supabase.from('students').select('*').eq('status', 'active'),
          supabase.from('enrollments').select('*').eq('status', 'active'),
        ])
        setClasses(cls || [])
        setStudents(stu || [])
        setEnrollments(enr || [])
      } catch (e) {
        setError('Không tải được dữ liệu: ' + e.message)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  const classInfo = classes.find(c => c.id === selectedClass)

  const enrolledStudents = selectedClass
    ? enrollments
        .filter(e => e.class_id === selectedClass)
        .map(e => students.find(s => s.id === e.student_id))
        .filter(Boolean)
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
    : []

  return (
    <div className="min-h-screen bg-gray-100 print-root">
      <style>{`
  @media print {
    /* 1. ÉP BUỘC TẤT CẢ CÁC THẺ PHẢI HIỂN THỊ TRÀN TRANG (QUAN TRỌNG NHẤT) */
    * {
      overflow: visible !important;
    }

    /* 2. GỠ BỎ MỌI GIỚI HẠN CHIỀU CAO CỦA REACT/NEXTJS */
    html, body, #root, #__next {
      height: auto !important;
      min-height: auto !important;
      position: static !important;
      background: white !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    /* 3. ẨN CÁC PHẦN TỬ KHÔNG CẦN THIẾT */
    .no-print { display: none !important; }

    /* 4. PHÁ VỠ CẤU TRÚC FLEXBOX/GRID CỦA CÁC THẺ BAO NGOÀI */
    .print-root, .print-layout, .print-area {
      display: block !important;
      width: 100% !important;
      max-width: none !important;
      margin: 0 !important;
      padding: 0 !important;
      background: white !important;
    }

    @page { 
      size: A4 portrait; 
      margin: 10mm; 
    }

    /* 5. ÉP DANH SÁCH THẺ THÀNH FLEX-WRAP ĐỂ TỰ ĐỘNG RỚT XUỐNG TRANG DƯỚI */
    .cards-grid {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 5mm !important;
      justify-content: flex-start !important;
    }

    /* 6. BẢO VỆ TỪNG THẺ KHÔNG BỊ CẮT LÀM ĐÔI GIỮA 2 TRANG */
    .student-card {
      box-shadow: none !important;
      border: 0.4mm solid #e5e7eb !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`}</style>
      {/* Header */}
      <div className="no-print bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-teal-600 rounded-xl flex items-center justify-center shadow-md shadow-teal-500/20">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-black text-gray-800 text-lg leading-tight">In thẻ học viên</h1>
            <p className="text-xs text-gray-400">Tạo và in hàng loạt theo lớp · QR tiến trình học</p>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          disabled={enrolledStudents.length === 0}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed
            text-white font-bold px-6 py-2.5 rounded-xl transition-all shadow-lg shadow-teal-500/25 active:scale-95"
        >
          <Printer className="w-4 h-4" />
          {enrolledStudents.length > 0 ? `In ${enrolledStudents.length} thẻ` : 'In thẻ'}
        </button>
      </div>

      <div className="print-layout max-w-7xl mx-auto p-6 flex gap-6 items-start">

        {/* Config sidebar */}
        <div className="no-print w-72 shrink-0 space-y-4 sticky top-24">

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Tên trung tâm</label>
            <input
              value={centerName}
              onChange={e => setCenterName(e.target.value)}
              placeholder="VD: Trung tâm Toán Thầy Hải"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold
                focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition"
            />
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="block text-xs font-bold text-gray-400 mb-2 uppercase tracking-wider">Chọn lớp</label>
            {loading ? (
              <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Đang tải...
              </div>
            ) : error ? (
              <p className="text-red-500 text-xs py-2">{error}</p>
            ) : (
              <select
                value={selectedClass}
                onChange={e => setSelectedClass(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold focus:border-teal-500 outline-none transition"
              >
                <option value="">— Chọn lớp —</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.class_name || c.name} {c.subject ? `(${c.subject})` : ''}
                  </option>
                ))}
              </select>
            )}
            {selectedClass && (
              <div className="mt-3 flex items-center gap-2 text-teal-700 text-sm font-bold bg-teal-50 px-3 py-2.5 rounded-xl border border-teal-100">
                <Users className="w-4 h-4" /> {enrolledStudents.length} học sinh
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <label className="block text-xs font-bold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5" /> Màu thẻ
            </label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(THEMES).map(([key, t]) => (
                <button
                  key={key}
                  onClick={() => setTheme(key)}
                  title={t.label}
                  className={`relative h-11 rounded-xl overflow-hidden border-2 transition-all ${
                    theme === key ? 'border-gray-800 scale-105 shadow-md' : 'border-transparent hover:border-gray-300'
                  }`}
                  style={{ background: t.gradient }}
                >
                  <span className="text-white text-[10px] font-bold drop-shadow">{t.label}</span>
                  {theme === key && (
                    <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-800" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 border border-teal-100 rounded-2xl p-4">
            <div className="flex items-start gap-2.5">
              <QrCode className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-teal-700">QR tiến trình học</p>
                <p className="text-xs text-teal-600 mt-1 leading-relaxed">
                  Phụ huynh scan QR để xem điểm danh, kết quả thi và tiến độ khóa học của con.
                </p>
                <p className="text-[10px] font-mono text-teal-500 mt-1.5 bg-teal-100 px-2 py-1 rounded-lg">
                  /progress?code=HS001
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Cards area */}
        <div className="flex-1 print-area min-w-0">
          {!selectedClass ? (
            <div className="flex flex-col items-center justify-center h-80 text-gray-300 gap-3">
              <Users className="w-16 h-16" />
              <p className="font-bold text-lg text-gray-400">Chọn lớp để xem trước thẻ</p>
              <p className="text-sm text-gray-300">Thẻ sẽ hiển thị ở đây sau khi chọn lớp</p>
            </div>
          ) : enrolledStudents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-gray-300 gap-3">
              <Users className="w-14 h-14" />
              <p className="font-bold text-gray-400">Lớp này chưa có học sinh</p>
            </div>
          ) : (
            <>
              <p className="no-print text-sm text-gray-500 mb-5 font-medium">
                Xem trước <span className="font-bold text-gray-700">{enrolledStudents.length}</span> thẻ
                <span className="text-gray-400"> · 85.6 × 54mm · 2 thẻ/hàng trên A4</span>
              </p>
              <div className="cards-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, 85.6mm)',
                gap: '16px',
              }}>
                {enrolledStudents.map((student) => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    centerName={centerName}
                    classInfo={classInfo}
                    theme={theme}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
