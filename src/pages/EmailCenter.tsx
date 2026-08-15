import { useEffect, useState, useMemo } from 'react'
import { Mail, Send, CheckCircle, XCircle, RefreshCw, MessageSquare } from 'lucide-react'
import { useDataStore } from '@/store/dataStore'
import { fmtVNDShort, fmt, countDaysInMonth, parseSchedule } from '@/lib/helpers'
import { format, endOfMonth } from 'date-fns'
import type { Student, Class, AttendanceRecord, EmailType } from '@/types'
import toast from 'react-hot-toast'

// ── Local row types ──────────────────────────────────────────────────────────

interface TuitionItem {
  student:    Student
  cls:        Class
  planned:    number
  absences:   number
  attended:   number
  totalFee:   number
  paidAmount: number
  debt:       number
}

interface AttendanceItem {
  student: Student
  cls:     Class | undefined
  recs:    AttendanceRecord[]
  present: number
  absent:  number
}

// ── Component ────────────────────────────────────────────────────────────────

export default function EmailCenter() {
  const {
    classes, students, enrollments, attendance, payments, emailLogs,
    loadClasses, loadStudents, loadEnrollments,
    loadAttendance, loadPayments, loadEmailLogs, addEmailLog,
  } = useDataStore()

  const now = new Date()
  const [tab, setTab]           = useState<'tuition' | 'attendance' | 'logs'>('tuition')
  const [selClass, setSelClass] = useState('')
  const [month, setMonth]       = useState(format(now, 'yyyy-MM'))
  const [sending, setSending]   = useState<Record<string, boolean>>({})
  const [sendingAll, setSendingAll] = useState(false)

  useEffect(() => {
    void Promise.all([loadClasses(), loadStudents(), loadEnrollments(), loadPayments(), loadEmailLogs()])
  }, [loadClasses, loadStudents, loadEnrollments, loadPayments, loadEmailLogs])

  useEffect(() => {
    if (!selClass) return
    const [y, m] = month.split('-')
    const from = `${y}-${m}-01`
    const to   = format(endOfMonth(new Date(+y, +m - 1)), 'yyyy-MM-dd')
    void loadAttendance(selClass, from, to)
  }, [selClass, month, loadAttendance])

  const [y, m] = month.split('-')

  // ── Tuition data ────────────────────────────────────────────────────────────
  const tuitionData = useMemo((): TuitionItem[] => {
    if (!selClass) return []
    const cls = classes.find(c => c.id === selClass)
    if (!cls) return []
    const from = `${y}-${m}-01`
    const to   = format(endOfMonth(new Date(+y, +m - 1)), 'yyyy-MM-dd')
    const weekdays = parseSchedule((cls as any).schedule)
    const planned  = countDaysInMonth(+y, +m, weekdays)

    return enrollments
      .filter(e => e.class_id === selClass && e.status === 'active')
      .flatMap(e => {
        const student = students.find(s => s.id === e.student_id)
        if (!student) return []
        const attRecs  = attendance.filter(a =>
          a.class_id === selClass && a.student_id === e.student_id && a.date >= from && a.date <= to
        )
        const absences = attRecs.filter(a => !a.present).length
        const attended = Math.max(0, planned - absences)
        const totalFee = attended * ((cls as any).fee_per_session ?? 0)
        const paidAmount = payments
          .filter(p => p.class_id === selClass && p.student_id === e.student_id && p.paid_at >= from && p.paid_at <= to)
          .reduce((s, p) => s + (p.amount ?? 0), 0)
        const debt = Math.max(0, totalFee - paidAmount)
        return [{ student, cls, planned, absences, attended, totalFee, paidAmount, debt }]
      })
  }, [selClass, month, classes, enrollments, students, attendance, payments, y, m])

  // ── Attendance data ─────────────────────────────────────────────────────────
  const attendanceData = useMemo((): AttendanceItem[] => {
    if (!selClass) return []
    const from = `${y}-${m}-01`
    const to   = format(endOfMonth(new Date(+y, +m - 1)), 'yyyy-MM-dd')
    const cls  = classes.find(c => c.id === selClass)

    return enrollments
      .filter(e => e.class_id === selClass && e.status === 'active')
      .flatMap(e => {
        const student = students.find(s => s.id === e.student_id)
        if (!student) return []
        const recs = attendance
          .filter(a => a.class_id === selClass && a.student_id === e.student_id && a.date >= from && a.date <= to)
          .sort((a, b) => a.date.localeCompare(b.date))
        return [{ student, cls, recs, present: recs.filter(a => a.present).length, absent: recs.filter(a => !a.present).length }]
      })
  }, [selClass, month, classes, enrollments, students, attendance, y, m])

  // ── Send single email ───────────────────────────────────────────────────────
  const sendEmail = async (type: EmailType, item: TuitionItem | AttendanceItem) => {
    const email = item.student.parent_email
    if (!email) {
      toast.error(`${item.student.full_name} chưa có email phụ huynh`)
      return
    }
    const key = item.student.id
    setSending(s => ({ ...s, [key]: true }))
    try {
      const cls = classes.find(c => c.id === selClass)
      const payload = {
        type,
        parentEmail:  email,
        studentName:  item.student.full_name,
        parentPhone:  item.student.parent_phone ?? '',
        className:    (cls as any)?.class_name || cls?.name || '',
        month:        `${m}/${y}`,
        centerName:   import.meta.env.VITE_CENTER_NAME ?? 'EduCenter',
        ...(type === 'tuition' && 'debt' in item ? {
          plannedSessions: item.planned,
          absences:        item.absences,
          attendedSessions:item.attended,
          feePerSession:   (cls as any)?.fee_per_session ?? 0,
          totalFee:        item.totalFee,
          paidAmount:      item.paidAmount,
          debt:            item.debt,
          bankId:          import.meta.env.VITE_BANK_ID,
          bankAccount:     import.meta.env.VITE_BANK_ACCOUNT,
          bankAccountName: import.meta.env.VITE_BANK_ACCOUNT_NAME,
        } : {}),
        ...(type === 'attendance' && 'recs' in item ? {
          records: item.recs.map(r => ({
            date:   fmt(r.date, 'dd/MM'),
            status: r.status,
            note:   r.note,
          })),
        } : {}),
      }

      const res  = await fetch('/api/send-email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json() as { ok: boolean; subject?: string; error?: string }
      if (!data.ok) throw new Error(data.error ?? 'Gửi thất bại')

      await addEmailLog({ type, recipient: email, student_id: item.student.id, subject: data.subject ?? '', status: 'sent' })
      toast.success(`📧 Đã gửi tới ${item.student.full_name}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Lỗi'
      await addEmailLog({ type, recipient: email, student_id: item.student.id, subject: '', status: 'failed', error: msg })
      toast.error(`Lỗi: ${msg}`)
    } finally {
      setSending(s => { const n = { ...s }; delete n[key]; return n })
    }
  }

  const sendAll = async (type: EmailType) => {
    const data  = type === 'tuition' ? tuitionData : attendanceData
    const hasEmail = data.filter(d => d.student.parent_email)
    if (!hasEmail.length) { toast.error('Không có học sinh nào có email'); return }
    setSendingAll(true)
    let ok = 0, fail = 0
    for (const item of hasEmail) {
      try { await sendEmail(type, item); ok++ } catch { fail++ }
      await new Promise(r => setTimeout(r, 600))
    }
    toast.success(`Gửi xong: ${ok} thành công${fail ? `, ${fail} thất bại` : ''}`)
    setSendingAll(false)
  }

  const TABS = [
    { id: 'tuition',    label: '💰 Học phí' },
    { id: 'attendance', label: '📋 Điểm danh' },
    { id: 'logs',       label: '📜 Lịch sử' },
  ] as const

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="section-title flex items-center gap-2">
          <Mail className="w-7 h-7 text-teal-600" /> Email / Zalo
        </h1>
      </div>

      <div className="flex gap-2 border-b border-teal-100 pb-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2 ${
              tab === t.id ? 'border-teal-500 text-teal-700 bg-teal-50' : 'border-transparent text-gray-500 hover:text-teal-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab !== 'logs' && (
        <div className="card p-4 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-48">
            <label className="label">Lớp học</label>
            <select value={selClass} onChange={e => setSelClass(e.target.value)} className="input">
              <option value="">— Chọn lớp —</option>
              {classes.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>{(c as any).class_name || (c as any).name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tháng</label>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input" />
          </div>
          {selClass && (
            <button onClick={() => { void sendAll(tab as EmailType) }} disabled={sendingAll}
              className="btn-teal flex items-center gap-2">
              {sendingAll ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Gửi tất cả
            </button>
          )}
        </div>
      )}

      {tab === 'tuition' && selClass && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'linear-gradient(135deg,#0d9488,#14b8a6)' }}>
                  {['Học sinh','Email PH','Học phí','Đã đóng','Còn nợ','Hành động'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-white font-bold text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tuitionData.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">Chưa có dữ liệu</td></tr>}
                {tuitionData.map(d => (
                  <tr key={d.student.id} className="border-b border-teal-50 hover:bg-teal-50/40">
                    <td className="px-4 py-3 font-bold">{d.student.full_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {d.student.parent_email
                        ? <span className="text-green-600">✓ {d.student.parent_email}</span>
                        : <span className="text-red-400">✗ Chưa có email</span>}
                    </td>
                    <td className="px-4 py-3 font-bold text-teal-700">{fmtVNDShort(d.totalFee)}</td>
                    <td className="px-4 py-3 text-green-600">{fmtVNDShort(d.paidAmount)}</td>
                    <td className="px-4 py-3 font-bold text-red-600">{d.debt > 0 ? fmtVNDShort(d.debt) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { void sendEmail('tuition', d) }}
                          disabled={!!sending[d.student.id] || !d.student.parent_email}
                          className="btn-teal text-xs py-1.5 px-3 flex items-center gap-1 disabled:opacity-50">
                          {sending[d.student.id] ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Gmail
                        </button>
                        <button className="btn-outline text-xs py-1.5 px-3 opacity-50 cursor-not-allowed" title="Cần cấu hình n8n">
                          <MessageSquare className="w-3 h-3 inline mr-1" />Zalo
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'attendance' && selClass && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'linear-gradient(135deg,#0d9488,#14b8a6)' }}>
                  {['Học sinh','Email PH','Có mặt','Vắng','Hành động'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-white font-bold text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attendanceData.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-gray-400">Chưa có dữ liệu</td></tr>}
                {attendanceData.map(d => (
                  <tr key={d.student.id} className="border-b border-teal-50 hover:bg-teal-50/40">
                    <td className="px-4 py-3 font-bold">{d.student.full_name}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {d.student.parent_email
                        ? <span className="text-green-600">✓ {d.student.parent_email}</span>
                        : <span className="text-red-400">✗ Chưa có email</span>}
                    </td>
                    <td className="px-4 py-3 text-green-600 font-bold">{d.present}</td>
                    <td className="px-4 py-3 text-red-500 font-bold">{d.absent}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { void sendEmail('attendance', d) }}
                          disabled={!!sending[d.student.id] || !d.student.parent_email}
                          className="btn-teal text-xs py-1.5 px-3 flex items-center gap-1 disabled:opacity-50">
                          {sending[d.student.id] ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                          Gmail
                        </button>
                        <button className="btn-outline text-xs py-1.5 px-3 opacity-50 cursor-not-allowed" title="Cần cấu hình n8n">
                          <MessageSquare className="w-3 h-3 inline mr-1" />Zalo
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'logs' && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'linear-gradient(135deg,#0d9488,#14b8a6)' }}>
                  {['Thời gian','Loại','Học sinh','Email','Trạng thái','Lỗi'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-white font-bold text-xs">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emailLogs.length === 0 && <tr><td colSpan={6} className="text-center py-10 text-gray-400">Chưa có lịch sử</td></tr>}
                {emailLogs.map(log => {
                  const student = students.find(s => s.id === log.student_id)
                  return (
                    <tr key={log.id} className="border-b border-teal-50 hover:bg-teal-50/40">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmt(log.created_at, 'dd/MM HH:mm')}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${
                          log.type === 'tuition' ? 'bg-blue-100 text-blue-700' :
                          log.type === 'attendance' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'
                        }`}>{log.type}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{student?.full_name ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{log.recipient}</td>
                      <td className="px-4 py-3">
                        {log.status === 'sent'
                          ? <span className="flex items-center gap-1 text-green-600 text-xs font-bold"><CheckCircle className="w-3.5 h-3.5" />Thành công</span>
                          : <span className="flex items-center gap-1 text-red-500 text-xs font-bold"><XCircle className="w-3.5 h-3.5" />Thất bại</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-red-400">{log.error ?? ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
