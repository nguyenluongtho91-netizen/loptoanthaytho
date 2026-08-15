import { useEffect, useState, useMemo } from 'react'
import { Banknote, Plus, CheckCircle, XCircle, Mail, Send, Loader2, MessageCircle, AlertCircle, Trash2, Check, QrCode } from 'lucide-react'
import { useDataStore } from '@/store/dataStore'
import { fmtVNDShort } from '@/lib/helpers'
import Modal from '@/components/Modal'
import VietQRModal from '@/components/VietQRModal'
import toast from 'react-hot-toast'
import type { PaymentMethod } from '@/types'

interface TuitionNotificationRow {
  student: any
  notification: any | null
  status: 'unnotified' | 'unpaid' | 'paid'
}

export default function Tuition() {
  const {
    classes, students, enrollments, tuitionNotifications,
    loadClasses, loadStudents, loadEnrollments, loadPayments, loadTuitionNotifications,
    addPayment, upsertTuitionNotification, updateTuitionNotification
  } = useDataStore()

  const [selClass, setSelClass] = useState('')
  const [courseName, setCourseName] = useState('Khóa hè')
  const [courseAmount, setCourseAmount] = useState('600000')

  // Modals state
  const [payModal, setPayModal] = useState<TuitionNotificationRow | null>(null)
  const [qrModal, setQrModal]   = useState<TuitionNotificationRow | null>(null)
  const [payForm, setPayForm]   = useState({ amount: '', method: 'transfer' as PaymentMethod, note: '' })
  const [saving, setSaving]     = useState(false)
  const [sending, setSending]   = useState(false)
  const [sendResult, setSendResult] = useState<{sent:number;skipped:number;errors:number}|null>(null)
  const [zaloModal, setZaloModal]   = useState<{row:TuitionNotificationRow;msg:string;qrUrl:string;phone:string}|null>(null)
  const [batchZaloModal, setBatchZaloModal] = useState<{ list: TuitionNotificationRow[]; currentIndex: number } | null>(null)
  const [copiedZalo, setCopiedZalo] = useState<'text'|'img'|null>(null)

  const [confirmModal, setConfirmModal] = useState<{studentName:string;amount:number;studentId:string;phone:string;email:string}|null>(null)
  const [sendingConfirm, setSendingConfirm] = useState(false)

  // ── Load foundational data on mount ──
  useEffect(() => {
    void Promise.all([loadClasses(), loadStudents(), loadEnrollments(), loadTuitionNotifications()])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load notifications + payments when class changes ──
  useEffect(() => {
    if (!selClass) {
      void loadTuitionNotifications()
      return
    }
    void loadTuitionNotifications(selClass)
    void loadPayments(selClass)

    // Auto-detect grade 6 classes to prefill 1.000.000đ, otherwise 600.000đ
    const cls = classes.find(c => c.id === selClass)
    if (cls) {
      const clsName = ((cls as any).class_name || cls.name || '').toLowerCase()
      const clsGrade = ((cls as any).grade || '').toLowerCase()
      if (clsName.includes('6') || clsGrade.includes('6')) {
        setCourseAmount('1000000')
      } else {
        setCourseAmount('600000')
      }
    }
  }, [selClass, classes]) // eslint-disable-line react-hooks/exhaustive-deps

  // Group classes by grade
  const classesByGrade = useMemo(() => {
    const groups: Record<string, typeof classes> = {}
    
    const sorted = [...classes]
      .filter(c => c.status === 'active')
      .sort((a, b) => {
        const nameA = ((a as any).class_name || a.name || '')
        const nameB = ((b as any).class_name || b.name || '')
        
        const yearA = parseInt(nameA.match(/\d{4}/)?.[0] || '0', 10)
        const yearB = parseInt(nameB.match(/\d{4}/)?.[0] || '0', 10)
        
        if (yearA !== yearB) {
          return yearB - yearA // Descending year (2015 -> 2014)
        }
        
        return nameA.localeCompare(nameB)
      })

    sorted.forEach(c => {
      const gradeStr = (c as any).grade || 'Khác'
      const key = gradeStr.toLowerCase().startsWith('khối') ? gradeStr : `Khối ${gradeStr}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(c)
    })
    
    return Object.entries(groups).sort((a, b) => {
      const numA = parseInt(a[0].replace(/\D/g, ''), 10) || 0
      const numB = parseInt(b[0].replace(/\D/g, ''), 10) || 0
      return numB - numA // Sort grades descending (e.g. Khối 2015 -> Khối 2014; or Khối 9 -> Khối 8)
    })
  }, [classes])

  // Compute tuition notification row list for table
  const tuitionData = useMemo((): TuitionNotificationRow[] => {
    if (!selClass) return []
    const classEnrollments = enrollments.filter(e => e.class_id === selClass && e.status === 'active')
    
    const rows = classEnrollments.flatMap(e => {
      const student = students.find(s => s.id === e.student_id)
      if (!student) return []
      
      const notif = tuitionNotifications.find(n => n.class_id === selClass && n.student_id === e.student_id)
      
      let status: 'unnotified' | 'unpaid' | 'paid' = 'unnotified'
      if (notif) {
        status = notif.is_paid ? 'paid' : 'unpaid'
      }

      return [{
        student,
        notification: notif ?? null,
        status
      }]
    })

    // Sắp xếp: Đã đóng (paid) lên đầu -> Chưa đóng (unpaid) -> Chưa báo học phí (unnotified)
    // Cùng trạng thái thì sắp xếp theo tên học sinh (alphabetical)
    return rows.sort((a, b) => {
      if (a.status === 'paid' && b.status !== 'paid') return -1
      if (a.status !== 'paid' && b.status === 'paid') return 1
      
      if (a.status === 'unpaid' && b.status === 'unnotified') return -1
      if (a.status === 'unnotified' && b.status === 'unpaid') return 1
      
      const nameA = a.student.full_name || ''
      const nameB = b.student.full_name || ''
      return nameA.localeCompare(nameB, 'vi')
    })
  }, [selClass, enrollments, students, tuitionNotifications])

  // Statistics (School-wide or Class-wide)
  const stats = useMemo(() => {
    if (selClass) {
      const totalStudents = tuitionData.length
      const notifiedCount = tuitionData.filter(d => d.status !== 'unnotified').length
      const paidCount = tuitionData.filter(d => d.status === 'paid').length
      const unpaidCount = tuitionData.filter(d => d.status === 'unpaid').length
      
      const totalPaidAmount = tuitionData
        .filter(d => d.status === 'paid' && d.notification)
        .reduce((sum, d) => sum + Number(d.notification.amount), 0)
        
      const totalUnpaidAmount = tuitionData
        .filter(d => d.status === 'unpaid' && d.notification)
        .reduce((sum, d) => sum + Number(d.notification.amount), 0)

      return {
        totalStudents,
        notifiedCount,
        paidCount,
        unpaidCount,
        totalPaidAmount,
        totalUnpaidAmount
      }
    }

    // School-wide stats (when no class is selected)
    // Unique active students enrolled in active classes or overall active students
    const activeStudentIds = new Set(
      enrollments
        .filter(e => {
          const cls = classes.find(c => c.id === e.class_id)
          return e.status === 'active' && cls?.status === 'active'
        })
        .map(e => e.student_id)
    )
    const totalStudents = activeStudentIds.size > 0 
      ? activeStudentIds.size 
      : students.filter(s => s.status === 'active').length

    // Tuition notifications across the entire school
    const uniqueNotifiedStudentIds = new Set(tuitionNotifications.map(n => n.student_id))
    const notifiedCount = uniqueNotifiedStudentIds.size

    let totalPaidAmount = 0
    let totalUnpaidAmount = 0
    let paidCount = 0
    let unpaidCount = 0

    tuitionNotifications.forEach(n => {
      if (n.is_paid) {
        paidCount += 1
        totalPaidAmount += Number(n.amount || 0)
      } else {
        unpaidCount += 1
        totalUnpaidAmount += Number(n.amount || 0)
      }
    })

    return {
      totalStudents,
      notifiedCount,
      paidCount,
      unpaidCount,
      totalPaidAmount,
      totalUnpaidAmount
    }
  }, [selClass, tuitionData, enrollments, classes, students, tuitionNotifications])

  // ── Send notifications for the entire class ──
  const [sendingNotif, setSendingNotif] = useState(false)
  const sendClassNotifications = async () => {
    if (!selClass) return
    const amt = parseFloat(courseAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Vui lòng nhập số tiền học phí hợp lệ!')
      return
    }
    if (!courseName.trim()) {
      toast.error('Vui lòng nhập tên khóa học!')
      return
    }

    const unnotifiedRows = tuitionData.filter(r => r.status === 'unnotified')
    if (unnotifiedRows.length === 0) {
      if (!window.confirm('Tất cả học sinh đã có thông báo học phí. Bạn có muốn cập nhật lại mức học phí mới cho các học sinh chưa thanh toán không?')) {
        return
      }
    }

    setSendingNotif(true)
    try {
      const targetRows = unnotifiedRows.length > 0 ? unnotifiedRows : tuitionData.filter(r => r.status === 'unpaid')
      if (targetRows.length === 0) {
        toast.error('Không tìm thấy học sinh nào cần gửi thông báo học phí.')
        return
      }

      const promises = targetRows.map(async (row) => {
        return upsertTuitionNotification({
          student_id: row.student.id,
          class_id: selClass,
          course_name: courseName.trim(),
          amount: amt,
          is_paid: false
        })
      })

      await Promise.all(promises)
      toast.success(`📢 Đã tạo thông báo học phí khóa "${courseName}" cho ${promises.length} học sinh`)
      void loadTuitionNotifications(selClass)
    } catch (e: any) {
      toast.error('Lỗi khi gửi thông báo: ' + e.message)
    } finally {
      setSendingNotif(false)
    }
  }

  // Send single student notification
  const sendSingleNotification = async (studentId: string) => {
    const amt = parseFloat(courseAmount)
    if (isNaN(amt) || amt <= 0) {
      toast.error('Vui lòng nhập số tiền học phí hợp lệ!')
      return
    }
    if (!courseName.trim()) {
      toast.error('Vui lòng nhập tên khóa học!')
      return
    }
    try {
      await upsertTuitionNotification({
        student_id: studentId,
        class_id: selClass,
        course_name: courseName.trim(),
        amount: amt,
        is_paid: false
      })
      toast.success('✅ Đã tạo thông báo học phí thành công!')
      void loadTuitionNotifications(selClass)
    } catch (e: any) {
      toast.error('Lỗi: ' + e.message)
    }
  }

  // ── Send Zalo: open custom preview modal ──
  const sendZalo = (row: TuitionNotificationRow) => {
    if (!row.notification) return
    const student = students.find((s: any) => s.id === row.student.id)
    const phone = (student as any)?.zalo || (student as any)?.parent_phone || ''
    const amountVal = Number(row.notification.amount)

    const msg = `Học phí khóa ${row.notification.course_name} của học sinh ${row.student.full_name} là ${amountVal.toLocaleString('vi-VN')} Đồng, phụ huynh vui lòng chuyển khoản vào stk: 3714235000320 HKD DINH CONG LINH`

    const bankId      = import.meta.env.VITE_BANK_ID      || ''
    const bankAccount = import.meta.env.VITE_BANK_ACCOUNT || ''
    const bankName    = import.meta.env.VITE_BANK_NAME    || import.meta.env.VITE_BANK_ACCOUNT_NAME || ''
    const addInfo     = 'HP ' + row.student.student_code + ' KH'
    const qrUrl       = bankId && bankAccount
      ? 'https://img.vietqr.io/image/' + bankId + '-' + bankAccount + '-compact2.png'
        + '?amount=' + amountVal
        + '&addInfo=' + encodeURIComponent(addInfo)
        + '&accountName=' + encodeURIComponent(bankName)
      : ''

    const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '84')
    setZaloModal({ row, msg, qrUrl, phone: cleanPhone })
    setCopiedZalo(null)
  }

  const startBatchZalo = () => {
    const unpaidList = tuitionData.filter(r => r.status === 'unpaid')
    if (unpaidList.length === 0) {
      toast.error('Không có học sinh nào chưa đóng học phí.')
      return
    }
    setBatchZaloModal({ list: unpaidList, currentIndex: 0 })
  }


  const copyZaloContent = async (type: 'text' | 'img') => {
    if (!zaloModal) return
    if (type === 'text') {
      try {
        await navigator.clipboard.writeText(zaloModal.msg)
        setCopiedZalo('text')
        setTimeout(() => setCopiedZalo(null), 2500)
      } catch { toast.error('Không copy được') }
    } else {
      try {
        const res  = await fetch(zaloModal.qrUrl)
        const blob = await res.blob()
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
        setCopiedZalo('img')
        setTimeout(() => setCopiedZalo(null), 2500)
      } catch {
        const a = document.createElement('a')
        a.href     = zaloModal.qrUrl
        a.download = 'QR_' + zaloModal.row.student.student_code + '.png'
        a.click()
        toast.success('Đã tải QR xuống, gửi vào Zalo nhé!')
      }
    }
  }

  // ── Send reminders via Gmail proxy ──
  const sendGmailReminder = async (row?: TuitionNotificationRow) => {
    if (!selClass || !courseName) return
    setSending(true)
    setSendResult(null)
    try {
      const studentIds = row ? [row.student.id] : undefined
      const res = await fetch('/api/send-tuition-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId: selClass,
          courseName: courseName.trim(),
          studentIds
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setSendResult(data.summary)
      toast.success(`✅ Đã gửi ${data.summary.sent} email nhắc học phí`)
    } catch (e: any) {
      toast.error('Lỗi gửi email: ' + e.message)
    } finally {
      setSending(false)
    }
  }

  // ── One-Click Quick Mark Paid (Tick button next to student icon) ──
  const quickCollectTuition = async (row: TuitionNotificationRow) => {
    if (!row.notification) return
    const confirmCollect = window.confirm(`Xác nhận đã thu học phí khóa "${row.notification.course_name}" của học sinh ${row.student.full_name}?`)
    if (!confirmCollect) return
    
    try {
      // 1. Record payment in the database
      await addPayment({
        student_id: row.student.id,
        class_id:   selClass,
        amount:     Number(row.notification.amount),
        method:     'transfer',
        note:       `Thu học phí khóa ${row.notification.course_name} (Thu nhanh)`,
      })

      // 2. Mark notification as PAID
      await updateTuitionNotification(row.notification.id, { is_paid: true })

      // 3. Reload data
      await loadTuitionNotifications(selClass)
      await loadPayments(selClass)

      toast.success(`✅ Đã thu học phí khóa ${row.notification.course_name} từ ${row.student.full_name}`)
    } catch (error: any) {
      toast.error('Lỗi khi thu học phí: ' + error.message)
    }
  }

  // ── Optioned Payment (Manual popup) ──
  const openManualPay = (row: TuitionNotificationRow) => {
    setQrModal(null)
    setPayModal(row)
    setPayForm({
      amount: String(row.notification?.amount || courseAmount),
      method: 'transfer',
      note: `Thu học phí khóa ${row.notification?.course_name || courseName}`
    })
  }

  const savePay = async () => {
    const amt = parseFloat(payForm.amount)
    if (!payForm.amount || isNaN(amt) || amt <= 0) {
      toast.error('Nhập số tiền hợp lệ')
      return
    }
    if (!payModal || !payModal.notification) return
    setSaving(true)
    try {
      // 1. Add payment transaction record
      await addPayment({
        student_id: payModal.student.id,
        class_id:   selClass,
        amount:     amt,
        method:     payForm.method,
        note:       payForm.note || `Thu học phí khóa ${payModal.notification.course_name}`,
      })

      // 2. Mark notification as PAID
      await updateTuitionNotification(payModal.notification.id, { is_paid: true })

      // 3. Reload everything
      await loadTuitionNotifications(selClass)
      await loadPayments(selClass)

      toast.success(`✅ Đã ghi nhận ${fmtVNDShort(amt)} từ ${payModal.student.full_name}`)

      // 4. Offer to send confirmation message
      const studentObj = students.find(s => s.id === payModal.student.id)
      setConfirmModal({
        studentName: payModal.student.full_name,
        amount:      amt,
        studentId:   payModal.student.id,
        phone:       ((studentObj as any)?.zalo || (studentObj as any)?.parent_phone || '').replace(/\D/g,'').replace(/^0/,'84'),
        email:       (studentObj as any)?.email || '',
      })
      setPayModal(null)
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi lưu')
    } finally {
      setSaving(false)
    }
  }

  // ── Send Receipt Confirm via Gmail proxy ──
  const sendConfirmEmail = async () => {
    if (!confirmModal) return
    setSendingConfirm(true)
    try {
      const res = await fetch(import.meta.env.VITE_GAS_EMAIL_URL || '', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'follow',
        body: JSON.stringify({
          type:          'payment_confirm',
          secret:        import.meta.env.VITE_GAS_WEBHOOK_SECRET || '',
          parentEmail:   confirmModal.email,
          studentName:   confirmModal.studentName,
          amount:        confirmModal.amount,
          transactionId: 'THU-' + Date.now(),
          transferAt:    new Date().toISOString(),
          centerName:    import.meta.env.VITE_CENTER_NAME || 'EduCenter',
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'GAS lỗi')
      toast.success('✅ Đã gửi email xác nhận!')
      setConfirmModal(null)
    } catch (e: any) {
      toast.error('Lỗi gửi email: ' + e.message)
    } finally {
      setSendingConfirm(false)
    }
  }

  // ── Send Receipt Confirm via Zalo copy ──
  const sendConfirmZalo = async () => {
    if (!confirmModal) return
    const msg = `✅ Xác nhận thanh toán học phí\n`
              + `----------------------------\n`
              + `Học sinh: ${confirmModal.studentName}\n`
              + `Số tiền: ${fmtVNDShort(confirmModal.amount)}\n`
              + `Thời gian: ${new Date().toLocaleDateString('vi-VN')}\n`
              + `Nội dung: Đóng học phí khóa ${courseName}\n`
              + `----------------------------\n`
              + `Trung tâm đã nhận được học phí. Cảm ơn quý phụ huynh! 🙏`
    try {
      await navigator.clipboard.writeText(msg)
      toast.success('✅ Đã copy! Dán vào Zalo và gửi.')
    } catch { toast.error('Không copy được') }
    if (confirmModal.phone) window.open('https://zalo.me/' + confirmModal.phone, '_blank')
    else window.open('https://chat.zalo.me', '_blank')
    setConfirmModal(null)
  }

  // ── Delete notice (undo send) ──
  const deleteNotice = async (notifId: string) => {
    if (!window.confirm('Bạn có muốn xóa thông báo học phí này?')) return
    try {
      const { supabase } = await import('@/lib/supabase')
      const { error } = await supabase.from('tuition_notifications').delete().eq('id', notifId)
      if (error) throw error
      toast.success('Xóa thông báo học phí thành công!')
      void loadTuitionNotifications(selClass)
    } catch (e: any) {
      toast.error('Lỗi khi xóa: ' + e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="page-header">
        <h1 className="section-title flex items-center gap-2">
          <Banknote className="w-7 h-7 text-teal-600" /> Học phí khóa học
        </h1>
      </div>

      {/* Summary Statistics Cards (School-wide or Selected Class) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: selClass ? 'Tổng học sinh lớp' : 'Tổng số học sinh', value: `${stats.totalStudents} HS`, color: 'bg-teal-50 text-teal-700 border border-teal-100' },
          { label: 'Đã báo học phí', value: `${stats.notifiedCount} HS`, color: 'bg-blue-50 text-blue-700 border border-blue-100' },
          { label: 'Tổng đã thu', value: fmtVNDShort(stats.totalPaidAmount), color: 'bg-green-50 text-green-700 border border-green-100' },
          { label: 'Tổng chưa thu', value: fmtVNDShort(stats.totalUnpaidAmount), color: 'bg-red-50 text-red-700 border border-red-100' },
        ].map(s => (
          <div key={s.label} className={`card p-5 rounded-2xl ${s.color} shadow-sm transition-all hover:shadow-md`}>
            <p className="text-xs font-bold opacity-75 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-2xl font-black">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Class selection cards grouped by grade */}
      <div className="card p-6 border border-slate-100 shadow-sm rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-teal-50 pb-3">
          <div>
            <h2 className="font-extrabold text-teal-800 text-lg">Chọn Lớp học theo Khối</h2>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">Vui lòng nhấp chọn lớp để xem và báo học phí</p>
          </div>
        </div>
        
        <div className="space-y-4 pt-1">
          {/* Quick "Toàn trường" option button */}
          <div className="pb-2 border-b border-slate-100">
            <button
              onClick={() => setSelClass('')}
              className={`px-5 py-2.5 rounded-xl font-extrabold text-sm transition-all duration-200 border cursor-pointer hover:scale-[1.02] active:scale-[0.98]
                ${!selClass 
                  ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/15 ring-2 ring-teal-600/20' 
                  : 'bg-teal-50/70 text-teal-800 border-teal-200 hover:border-teal-400 hover:bg-teal-100/50'
                }`}
            >
              🏫 TOÀN TRƯỜNG (TỔNG HỢP)
            </button>
          </div>

          {classesByGrade.length === 0 && (
            <div className="text-center py-6 text-gray-400 text-sm font-semibold italic">
              Không tìm thấy lớp học hoạt động nào.
            </div>
          )}
          {classesByGrade.map(([grade, list]) => (
            <div key={grade} className="space-y-2">
              <div className="text-xs font-extrabold text-slate-400 uppercase tracking-wider text-left">
                {grade}
              </div>
              <div className="flex flex-wrap gap-2.5">
                {list.map(c => {
                  const isSelected = selClass === c.id
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelClass(isSelected ? '' : c.id)}
                      className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-200 border cursor-pointer hover:scale-[1.02] active:scale-[0.98]
                        ${isSelected 
                          ? 'bg-teal-650 bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/15' 
                          : 'bg-white text-slate-700 border-slate-200 hover:border-teal-300 hover:bg-teal-50/10'
                        }`}
                    >
                      {(c as any).class_name || c.name}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selClass && (
        <>
          {/* Form Setup Tuition Notification */}
          <div className="card p-6 bg-gradient-to-br from-teal-50/50 to-white border border-teal-100 shadow-sm rounded-3xl">
            <h3 className="font-extrabold text-teal-800 mb-4 flex items-center gap-2 text-base">
              📢 Thiết lập & Phát hành Báo học phí theo Khóa
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div>
                <label className="label text-teal-700 font-semibold text-xs uppercase tracking-wide">Tên khóa học *</label>
                <input
                  type="text"
                  value={courseName}
                  onChange={e => setCourseName(e.target.value)}
                  placeholder="VD: Khóa hè 2026, Khóa hè"
                  className="input border-teal-200 focus:border-teal-500 bg-white font-bold"
                />
              </div>
              
              <div>
                <label className="label text-teal-700 font-semibold text-xs uppercase tracking-wide">Mức học phí tùy chọn (đ) *</label>
                <input
                  type="number"
                  value={courseAmount}
                  onChange={e => setCourseAmount(e.target.value)}
                  placeholder="Mức phí..."
                  className="input border-teal-200 focus:border-teal-550 focus:border-teal-500 bg-white font-mono font-bold"
                />
                <span className="text-[10px] text-gray-400 font-medium block mt-1">
                  * Khối 6 mặc định: 1.000.000đ | Các khối khác: 600.000đ (có thể chỉnh sửa tùy ý).
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-teal-100/70 pt-4">
              <div className="text-xs text-gray-400 font-medium max-w-md">
                Hệ thống sẽ hiển thị thông báo đóng học phí cho học sinh trên trang cổng thi (`/thi`). Dòng thông báo sẽ tự biến mất sau khi bạn tích "Đã thu".
              </div>
              
              <button
                onClick={sendClassNotifications}
                disabled={sendingNotif}
                className="btn-teal py-3 px-6 shadow-md shadow-teal-500/15 flex items-center gap-2 font-extrabold text-sm rounded-xl"
              >
                {sendingNotif ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Đang phát hành...</>
                ) : (
                  <><Send className="w-4 h-4" /> Báo học phí cả lớp ({tuitionData.filter(r => r.status === 'unnotified').length} HS)</>
                )}
              </button>
            </div>
          </div>

          {/* Student Tuition Notice List */}
          <div className="card overflow-hidden border border-slate-100 shadow-sm rounded-3xl">
            <div className="px-6 py-4 border-b border-teal-50 flex flex-wrap items-center justify-between gap-3 bg-white">
              <div>
                <h3 className="font-extrabold text-gray-800 text-lg">Danh sách Báo học phí của Lớp</h3>
                <p className="text-xs text-gray-400 font-semibold mt-0.5">Quản lý đóng học phí theo khóa hè</p>
              </div>
              
              {stats.unpaidCount > 0 && (
                <div className="flex items-center gap-3">
                  {sendResult && (
                    <span className="text-xs text-gray-550">
                      ✅ {sendResult.sent} gửi · ⏭ {sendResult.skipped} bỏ qua · ❌ {sendResult.errors} lỗi
                    </span>
                  )}
                  <button
                    onClick={startBatchZalo}
                    className="btn-teal text-xs py-2 px-4 flex items-center gap-1.5 font-extrabold shadow-md shadow-blue-500/10 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <MessageCircle className="w-4 h-4" /> 🚀 Gửi Zalo Hàng Loạt ({stats.unpaidCount} HS)
                  </button>

                  <button
                    onClick={() => sendGmailReminder()}
                    disabled={sending}
                    className="btn-outline border-teal-200 text-teal-700 hover:bg-teal-50 text-xs py-2 px-4 flex items-center gap-1.5 font-bold"
                  >
                    {sending ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang gửi...</>
                    ) : (
                      <><Mail className="w-3.5 h-3.5" /> Gửi nhắc Gmail ({stats.unpaidCount} HS)</>
                    )}
                  </button>

                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-teal-50/50">
                    {[
                      'Học sinh', 'Khóa học', 'Mức học phí', 'Trạng thái', 'Thu học phí', 'Nhắc học phí', ''
                    ].map(h => (
                      <th
                        key={h}
                        className="px-5 py-3.5 text-left text-teal-800 font-extrabold text-xs uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tuitionData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-400 text-sm font-semibold italic">
                        Không có học sinh nào hoạt động trong lớp này.
                      </td>
                    </tr>
                  )}
                  {tuitionData.map(row => (
                    <tr
                      key={row.student.id}
                      className="border-b border-teal-50/40 hover:bg-slate-50 transition-colors"
                    >
                      {/* Học sinh */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-teal-100/50 text-teal-700 rounded-2xl flex items-center justify-center font-extrabold shadow-inner shrink-0">
                            {row.student.full_name?.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-extrabold text-gray-800">{row.student.full_name}</p>
                            <span className="text-xs bg-slate-100 text-slate-500 font-mono font-bold px-1.5 py-0.5 rounded border border-slate-200">
                              {row.student.student_code}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Khóa học */}
                      <td className="px-5 py-4 font-semibold text-gray-700">
                        {row.notification ? row.notification.course_name : '—'}
                      </td>

                      {/* Mức học phí */}
                      <td className="px-5 py-4 font-mono font-bold text-gray-800">
                        {row.notification ? fmtVNDShort(row.notification.amount) : '—'}
                      </td>

                      {/* Trạng thái */}
                      <td className="px-5 py-4">
                        {row.status === 'paid' ? (
                          <span className="badge-paid inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Đã đóng
                          </span>
                        ) : row.status === 'unpaid' ? (
                          <span className="badge-debt inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold px-2.5 py-1 rounded-full">
                            <XCircle className="w-3 h-3 animate-pulse" /> Chưa đóng
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-400 border border-slate-250 border-slate-200 text-xs font-medium px-2.5 py-1 rounded-full">
                            <AlertCircle className="w-3 h-3" /> Chưa báo học phí
                          </span>
                        )}
                      </td>

                      {/* Thu học phí: Tick button next to student icon */}
                      <td className="px-5 py-4">
                        {row.status === 'unpaid' ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => quickCollectTuition(row)}
                              className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-emerald-500/20 transition-all hover:scale-105"
                              title="Tích đã thu tiền"
                            >
                              <Check className="w-5 h-5 font-black stroke-[3px]" />
                            </button>
                            
                            <button
                              onClick={() => setQrModal(row)}
                              className="p-2 text-teal-650 text-teal-600 hover:bg-teal-50 rounded-xl border border-teal-100 transition-colors"
                              title="Hiển thị mã QR / Thu tùy chọn"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                          </div>
                        ) : row.status === 'paid' ? (
                          <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-lg">✓ Hoàn tất</span>
                        ) : (
                          <button
                            onClick={() => sendSingleNotification(row.student.id)}
                            className="btn-teal text-xs py-1.5 px-3 flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" /> Báo học phí
                          </button>
                        )}
                      </td>

                      {/* Nhắc học phí */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => sendZalo(row)}
                            disabled={row.status !== 'unpaid'}
                            className="p-2 text-blue-600 hover:bg-blue-50 disabled:opacity-40 rounded-xl border border-blue-100 transition-all flex items-center justify-center"
                            title="Nhắc qua Zalo"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={() => sendGmailReminder(row)}
                            disabled={row.status !== 'unpaid' || sending}
                            className="p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-40 rounded-xl border border-rose-100 transition-all flex items-center justify-center"
                            title="Nhắc qua Gmail"
                          >
                            <Mail className="w-4 h-4" />
                          </button>
                        </div>
                      </td>

                      {/* Xóa báo học phí */}
                      <td className="px-5 py-4 text-right">
                        {row.notification && (
                          <button
                            onClick={() => deleteNotice(row.notification.id)}
                            className="text-slate-405 text-slate-400 hover:text-red-500 p-2 rounded-xl transition-all"
                            title="Xóa thông báo học phí"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* QR VietQR Modal */}
      {qrModal && qrModal.notification && (
        <VietQRModal
          open={!!qrModal}
          onClose={() => setQrModal(null)}
          studentName={qrModal.student.full_name}
          studentCode={qrModal.student.student_code}
          amount={Number(qrModal.notification.amount)}
          month={qrModal.notification.course_name}
          onConfirmManual={() => openManualPay(qrModal)}
        />
      )}

      {/* Ghi nhận thanh toán Modal */}
      <Modal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        title="Ghi nhận thanh toán học phí"
        size="sm"
      >
        {payModal && payModal.notification && (
          <div className="space-y-4">
            <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
              <p className="font-bold text-teal-800">{payModal.student.full_name}</p>
              <p className="text-sm text-teal-600 mt-0.5">
                Mức học phí khóa: <strong>{fmtVNDShort(Number(payModal.notification.amount))}</strong>
              </p>
            </div>
            <div>
              <label className="label text-teal-700 font-bold">Số tiền (đ) *</label>
              <input
                type="number"
                value={payForm.amount}
                onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                className="input"
              />
            </div>
            <div>
              <label className="label text-teal-700 font-bold">Hình thức</label>
              <select
                value={payForm.method}
                onChange={e => setPayForm(f => ({ ...f, method: e.target.value as PaymentMethod }))}
                className="input"
              >
                <option value="transfer">🏦 Chuyển khoản ngân hàng</option>
                <option value="cash">💵 Tiền mặt</option>
                <option value="seapay">📱 SeaPay</option>
              </select>
            </div>
            <div>
              <label className="label text-teal-700 font-bold">Ghi chú</label>
              <input
                value={payForm.note}
                onChange={e => setPayForm(f => ({ ...f, note: e.target.value }))}
                className="input"
              />
            </div>
            <div className="flex gap-3 justify-end pt-3">
              <button onClick={() => setPayModal(null)} className="btn-outline border-slate-200">Hủy</button>
              <button
                onClick={() => { void savePay() }}
                disabled={saving}
                className="btn-teal px-5"
              >
                {saving ? 'Đang lưu...' : '✅ Xác nhận'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Xác nhận thanh toán & gửi thông báo nhận tiền */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-teal-105 border-teal-100 animate-scale-up">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-5 text-center text-white">
              <div className="text-4xl mb-1">🎉</div>
              <p className="font-extrabold text-lg">Đã thu học phí thành công!</p>
              <p className="text-emerald-100 text-sm mt-1">
                {confirmModal.studentName} · {fmtVNDShort(confirmModal.amount)}
              </p>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-500 text-center font-medium">
                Gửi biên lai xác nhận đến phụ huynh qua:
              </p>

              {/* Gmail */}
              <button
                onClick={sendConfirmEmail}
                disabled={sendingConfirm || !confirmModal.email}
                className="w-full py-3 flex items-center justify-between px-4 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition disabled:opacity-40"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">📧</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-800 text-sm">Gửi Gmail</p>
                    <p className="text-xs text-gray-400">
                      {confirmModal.email || 'Chưa cấu hình email'}
                    </p>
                  </div>
                </div>
                {sendingConfirm
                  ? <Loader2 className="w-4 h-4 animate-spin text-red-500" />
                  : <Mail className="w-4 h-4 text-red-500" />}
              </button>

              {/* Zalo */}
              <button
                onClick={sendConfirmZalo}
                disabled={sendingConfirm}
                className="w-full py-3 flex items-center justify-between px-4 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl transition"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">💬</span>
                  <div className="text-left">
                    <p className="font-bold text-gray-800 text-sm">Nhắn Zalo</p>
                    <p className="text-xs text-gray-400">
                      {confirmModal.phone ? 'Copy nội dung + mở Zalo chat' : 'Mở Zalo Web'}
                    </p>
                  </div>
                </div>
                <MessageCircle className="w-4 h-4 text-blue-500" />
              </button>

              <button
                onClick={() => setConfirmModal(null)}
                className="w-full py-2.5 text-gray-400 hover:text-gray-600 text-sm font-semibold transition"
              >
                Bỏ qua, không gửi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zalo Share Modal */}
      {zaloModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-teal-150">
            <div className="bg-gradient-to-r from-blue-500 to-blue-400 px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-white" />
                <span className="text-white font-extrabold">Nhắc phí qua Zalo</span>
              </div>
              <button onClick={() => setZaloModal(null)} className="text-white/70 hover:text-white text-xl leading-none font-bold">✕</button>
            </div>

            <div className="p-4 space-y-3">
              {/* Step 1: Copy Text message */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-400">① Tin nhắn học phí</span>
                  <button onClick={() => copyZaloContent('text')}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all
                      ${copiedZalo === 'text' ? 'bg-green-600 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
                    {copiedZalo === 'text' ? '✓ Đã copy' : 'Copy tin nhắn'}
                  </button>
                </div>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed font-sans font-medium">{zaloModal.msg}</pre>
              </div>

              {/* Step 2: Copy QR */}
              {zaloModal.qrUrl && (
                <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-blue-700">② Ảnh QR chuyển khoản</span>
                    <button onClick={() => copyZaloContent('img')}
                      className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all
                        ${copiedZalo === 'img' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white hover:bg-blue-600'}`}>
                      {copiedZalo === 'img' ? '✓ Đã copy' : 'Copy QR'}
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <img src={zaloModal.qrUrl} alt="QR" className="w-20 h-20 rounded-xl border border-blue-200 shrink-0" />
                    <p className="text-xs text-blue-900/70 leading-relaxed font-medium">
                      Bấm <strong>Copy QR</strong> → vào Zalo → <strong>Ctrl+V</strong> để gửi ảnh.<br/>
                      Hoặc đính kèm ảnh QR đã tải xuống.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Open Zalo chat */}
              <button
                onClick={() => window.open(zaloModal.phone ? 'https://zalo.me/' + zaloModal.phone : 'https://chat.zalo.me', '_blank')}
                className="w-full py-2.5 bg-blue-500 text-white rounded-xl font-bold text-sm hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-500/10">
                <MessageCircle className="w-4 h-4" />
                {zaloModal.phone ? '③ Mở Zalo phụ huynh' : '③ Mở Zalo Web'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Zalo Runner Modal */}
      {batchZaloModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-blue-100">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between text-white">
              <div>
                <h3 className="font-black text-lg flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" /> 🚀 Trợ lý Gửi Zalo Hàng Loạt
                </h3>
                <p className="text-xs text-blue-100 font-medium">
                  Đang tiến hành: Học sinh {batchZaloModal.currentIndex + 1} / {batchZaloModal.list.length}
                </p>
              </div>
              <button
                onClick={() => setBatchZaloModal(null)}
                className="text-white/80 hover:text-white text-xl font-extrabold"
              >
                ✕
              </button>
            </div>

            {/* Content for Current Student */}
            {(() => {
              const currentRow = batchZaloModal.list[batchZaloModal.currentIndex]
              if (!currentRow || !currentRow.notification) return null
              const studentObj = students.find((s: any) => s.id === currentRow.student.id)
              const rawPhone = (studentObj as any)?.zalo || (studentObj as any)?.parent_phone || ''
              const digits = rawPhone.replace(/\D/g, '')
              const cleanPhone = digits.startsWith('84') ? '0' + digits.substring(2) : (digits.startsWith('0') ? digits : '0' + digits)
              const amt = Number(currentRow.notification.amount)


              const msg = `Học phí khóa ${currentRow.notification.course_name} của học sinh ${currentRow.student.full_name} là ${amt.toLocaleString('vi-VN')} Đồng, phụ huynh vui lòng chuyển khoản vào stk: 3714235000320 HKD DINH CONG LINH`

              const openAndCopy = async () => {
                try {
                  await navigator.clipboard.writeText(msg)
                  toast.success(`Đã copy tin nhắn học phí cho ${currentRow.student.full_name}`)
                } catch {
                  toast.error('Lỗi copy')
                }
                const targetUrl = cleanPhone
                  ? `https://zalo.me/${cleanPhone}`
                  : 'https://chat.zalo.me'
                window.open(targetUrl, '_blank')
              }


              return (
                <div className="p-6 space-y-4">
                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                      style={{ width: `${((batchZaloModal.currentIndex + 1) / batchZaloModal.list.length) * 100}%` }}
                    />
                  </div>

                  {/* Student Info Card */}
                  <div className="bg-blue-50/60 p-4 rounded-2xl border border-blue-100">
                    <p className="text-xs text-blue-700 font-extrabold uppercase tracking-wider">Học sinh hiện tại</p>
                    <p className="text-lg font-black text-gray-900 mt-0.5">{currentRow.student.full_name}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-600">
                      <span>Mã: <strong>{currentRow.student.student_code}</strong></span>
                      <span>SĐT: <strong>{rawPhone || 'Chưa cập nhật'}</strong></span>
                      <span>Học phí: <strong>{amt.toLocaleString('vi-VN')} đ</strong></span>
                    </div>
                  </div>

                  {/* Script Helper note */}
                  <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
                    💡 <strong>Mẹo Tự Động 100%:</strong> Đã tạo file <a href="/zalo-auto-sender.user.js" target="_blank" className="underline font-bold text-amber-950">zalo-auto-sender.user.js</a>. Khi cài kịch bản này vào Tampermonkey/Violentmonkey, Zalo Web sẽ tự động dán tin nhắn & tự động bấm gửi!
                  </div>

                  {/* Action buttons for Current Step */}
                  <div className="space-y-2 pt-2">
                    <button
                      onClick={openAndCopy}
                      className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-2xl shadow-lg shadow-blue-500/20 text-sm flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-5 h-5" /> Copy & Mở Zalo Cho {currentRow.student.full_name}
                    </button>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        disabled={batchZaloModal.currentIndex === 0}
                        onClick={() => setBatchZaloModal(b => b ? { ...b, currentIndex: b.currentIndex - 1 } : null)}
                        className="w-1/2 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs disabled:opacity-40"
                      >
                        ← Học sinh trước
                      </button>
                      <button
                        disabled={batchZaloModal.currentIndex >= batchZaloModal.list.length - 1}
                        onClick={() => setBatchZaloModal(b => b ? { ...b, currentIndex: b.currentIndex + 1 } : null)}
                        className="w-1/2 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs disabled:opacity-40"
                      >
                        Học sinh tiếp theo →
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

    </div>
  )
}
