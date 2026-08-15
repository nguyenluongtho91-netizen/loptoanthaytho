import { useEffect, useState } from 'react'
import { CalendarCheck, Save, RefreshCw, CheckSquare, XSquare, Users } from 'lucide-react'
import { useDataStore } from '@/store/dataStore'
import { supabase } from '@/lib/supabase'
import type { AttendanceStatus } from '@/types'
import { fmt } from '@/lib/helpers'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function Attendance() {
  const { classes, students, enrollments, attendance,
    loadClasses, loadStudents, loadEnrollments, loadAttendance } = useDataStore()

  type DraftRow = { present: boolean; late: boolean; status: AttendanceStatus; note: string }
  
  const [selClass, setSelClass] = useState('')
  const [selDate,  setSelDate]  = useState(format(new Date(), 'yyyy-MM-dd'))
  const [draft, setDraft]       = useState<Record<string, DraftRow>>({})
  const [saving, setSaving]     = useState(false)
  const [loaded, setLoaded]     = useState(false)

  // ── Load dữ liệu nền khi mount ─────────────────────────────
  useEffect(() => {
    loadClasses()
    loadStudents()
    loadEnrollments()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── FIX RACE CONDITION:
  //    Chỉ set loaded=false khi đổi lớp/ngày, KHÔNG set loaded=true ở đây.
  //    Việc set loaded=true được chuyển xuống useEffect xây draft bên dưới,
  //    đảm bảo bảng chỉ hiện SAU KHI draft đã được điền đầy đủ từ dữ liệu mới.
  useEffect(() => {
    if (!selClass || !selDate) return
    setLoaded(false)
    loadAttendance(selClass, selDate, selDate)
    // Không gọi .then(() => setLoaded(true)) ở đây nữa
  }, [selClass, selDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build draft từ store attendance + set loaded=true SAU KHI draft sẵn sàng
  useEffect(() => {
    if (!selClass || !selDate) return
    
    const existing: Record<string, DraftRow> = {}
    const enrolled = enrollments
      .filter(e => e.class_id === selClass && e.status === 'active')
      .map(e => e.student_id)

    for (const sid of enrolled) {
      const rec = attendance.find(
        a => a.class_id === selClass && a.student_id === sid && a.date === selDate
      )
      existing[sid] = rec
        ? {
            present: rec.present,
            late: (rec as any).late || false,
            status: rec.status,
            note: rec.note ?? '',
          }
        : { present: false, late: false, status: 'absent' as AttendanceStatus, note: '' }
    }

    setDraft(existing)
    // ✅ Set loaded=true SAU KHI draft đã được build → không bao giờ render bảng trống
    setLoaded(true)
  }, [attendance, selClass, selDate, enrollments])

  const visibleClasses = classes.filter(c => c.status === 'active')

  const enrolledStudents = selClass
    ? enrollments
        .filter(e => e.class_id === selClass && e.status === 'active')
        .map(e => students.find(s => s.id === e.student_id))
        .filter((s): s is NonNullable<typeof s> => s !== undefined)
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
    : []

  const toggle = (sid: string, field: 'present' | 'late') => {
    setDraft(d => {
      const cur = d[sid] || { present: false, late: false, status: 'absent', note: '' }
      if (field === 'present') {
        const nowPresent = !cur.present
        return {
          ...d,
          [sid]: {
            ...cur,
            present: nowPresent,
            late: false,
            status: (nowPresent ? 'present' : 'absent') as AttendanceStatus,
          },
        }
      }
      if (field === 'late') {
        const nowLate = !cur.late
        return {
          ...d,
          [sid]: {
            ...cur,
            late: nowLate,
            present: nowLate, // trễ thì vẫn tính là có mặt
            status: (nowLate ? 'late' : 'absent') as AttendanceStatus,
          },
        }
      }
      return d
    })
  }

  const setNote = (sid: string, note: string) => {
    setDraft(d => ({
      ...d,
      [sid]: {
        ...(d[sid] || { present: false, late: false, status: 'absent' as AttendanceStatus, note: '' }),
        note,
      },
    }))
  }

  const markAll = (present: boolean) => {
    const next: Record<string, DraftRow> = {}
    for (const sid of Object.keys(draft)) {
      next[sid] = {
        ...(draft[sid] || { status: 'absent', note: '' }),
        present,
        late: false,
        status: (present ? 'present' : 'absent') as AttendanceStatus,
      } as DraftRow
    }
    setDraft(next)
  }

  const save = async () => {
    if (!selClass || !selDate) return toast.error('Chọn lớp và ngày')
    if (enrolledStudents.length === 0) return toast.error('Không có học sinh trong lớp')
    setSaving(true)
    try {
      const rows = enrolledStudents.map(s => {
        const isPresent = draft[s.id]?.present || false
        const isLate    = draft[s.id]?.late    || false
        return {
          date:       selDate,
          class_id:   selClass,
          student_id: s.id,
          present:    isPresent,
          late:       isLate,
          status:     (isPresent ? (isLate ? 'late' : 'present') : 'absent') as AttendanceStatus,
          note:       draft[s.id]?.note || '',
        }
      })
      
      // ✅ Gọi trực tiếp Supabase để tránh treo (giống pattern UserMgmt & Classes)
      const { error } = await supabase
        .from('attendance')
        .upsert(rows, { onConflict: 'date,class_id,student_id' })

      if (error) throw error

      toast.success(`✅ Đã lưu điểm danh ${fmt(selDate)} (${rows.length} học sinh)`)
      // Reload store ngầm để badge count cập nhật, KHÔNG await để tránh treo
      loadAttendance(selClass, selDate, selDate)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const presentCount = Object.values(draft).filter(d => d.present && !d.late).length
  const lateCount    = Object.values(draft).filter(d => d.late).length
  const absentCount  = Object.values(draft).filter(d => !d.present).length

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="section-title flex items-center gap-2">
          <CalendarCheck className="w-7 h-7 text-teal-600" /> Điểm danh
        </h1>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="label">Chọn lớp</label>
            <select value={selClass} onChange={e => setSelClass(e.target.value)} className="input">
              <option value="">— Chọn lớp —</option>
              {visibleClasses.map(c => (
                <option key={c.id} value={c.id}>
                  {(c as any).class_name || (c as any).name} ({(c as any).subject})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Ngày</label>
            <input
              type="date"
              value={selDate}
              onChange={e => setSelDate(e.target.value)}
              className="input"
            />
          </div>
        </div>
      </div>

      {selClass && selDate && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-3">
              <div className="bg-green-100 text-green-700 px-3 py-1.5 rounded-xl text-sm font-700">
                ✅ Có mặt: {presentCount}
              </div>
              <div className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded-xl text-sm font-700">
                🕐 Trễ: {lateCount}
              </div>
              <div className="bg-red-100 text-red-700 px-3 py-1.5 rounded-xl text-sm font-700">
                ❌ Vắng: {absentCount}
              </div>
            </div>
            <div className="flex gap-2 ml-auto flex-wrap">
              <button
                onClick={() => markAll(true)}
                className="btn-outline text-sm py-2 px-4 flex items-center gap-1.5"
              >
                <CheckSquare className="w-4 h-4" /> Tất cả có mặt
              </button>
              <button
                onClick={() => markAll(false)}
                className="btn-outline text-sm py-2 px-4 flex items-center gap-1.5"
              >
                <XSquare className="w-4 h-4" /> Tất cả vắng
              </button>
              <button
                onClick={save}
                disabled={saving || !loaded}
                className="btn-teal flex items-center gap-2 text-sm py-2"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Đang lưu...' : 'Lưu điểm danh'}
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            {!loaded ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
              </div>
            ) : enrolledStudents.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Chưa có học sinh trong lớp này</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg,#0d9488,#14b8a6)' }}>
                    <th className="px-4 py-3 text-left text-white font-700 text-xs">#</th>
                    <th className="px-4 py-3 text-left text-white font-700 text-xs">Học sinh</th>
                    <th className="px-4 py-3 text-center text-white font-700 text-xs">✅ Có mặt</th>
                    <th className="px-4 py-3 text-center text-white font-700 text-xs">🕐 Trễ</th>
                    <th className="px-4 py-3 text-left text-white font-700 text-xs">Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledStudents.map((s, i) => {
                    const d = draft[s.id] || { present: false, late: false, note: '' }
                    const rowBg = d.late
                      ? 'bg-amber-50'
                      : d.present
                      ? 'bg-green-50'
                      : 'bg-red-50/50'
                    return (
                      <tr
                        key={s.id}
                        className={`border-b border-teal-50 transition-colors ${rowBg}`}
                      >
                        <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-700 text-gray-800">{s.full_name}</p>
                          <p className="text-xs text-gray-400">{s.student_code}</p>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggle(s.id, 'present')}
                            className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center mx-auto transition-all
                              ${d.present && !d.late
                                ? 'bg-green-500 border-green-500'
                                : 'border-gray-300 hover:border-green-400'
                              }`}
                          >
                            {d.present && !d.late && <span className="text-white text-base">✓</span>}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => toggle(s.id, 'late')}
                            className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center mx-auto transition-all
                              ${d.late
                                ? 'bg-amber-400 border-amber-400'
                                : 'border-gray-300 hover:border-amber-400'
                              }`}
                          >
                            {d.late && <span className="text-white text-xs">T</span>}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            value={d.note || ''}
                            onChange={e => setNote(s.id, e.target.value)}
                            placeholder="Lý do vắng..."
                            className="input text-xs py-1.5 max-w-48"
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  )
}
