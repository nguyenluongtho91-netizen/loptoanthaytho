import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

const formatDuration = (seconds?: number) => {
  if (!seconds || seconds <= 0) return '0 giây'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  if (m === 0) return `${s} giây`
  return `${m} phút ${s.toString().padStart(2, '0')} giây`
}

const formatDate = (dateObj: Date | string) => {
  const d = typeof dateObj === 'string' ? new Date(dateObj) : dateObj
  if (isNaN(d.getTime())) return '—'
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export interface ExportRoomOptions {
  roomId: string
  room?: any
  exam?: any
  submissions?: any[]
  notSubmittedStudents?: any[]
}

export async function exportExamRoomToExcel(options: ExportRoomOptions | string) {
  let roomId = typeof options === 'string' ? options : options.roomId
  let room = typeof options === 'object' ? options.room : null
  let exam = typeof options === 'object' ? options.exam : null
  let submissions = typeof options === 'object' ? options.submissions : null
  let notSubmittedStudents = typeof options === 'object' ? options.notSubmittedStudents : null

  // 1. Fetch missing room and exam data if needed
  if (!room || !exam) {
    const { data: roomData, error: roomErr } = await supabase
      .from('exam_rooms')
      .select('*, exams(id, title, data), classes(id, name, class_name)')
      .eq('id', roomId)
      .single()

    if (roomErr || !roomData) {
      throw new Error(roomErr?.message || 'Không tìm thấy thông tin phòng thi')
    }
    room = roomData
    exam = roomData.exams
  }

  // 2. Fetch submissions if needed
  if (!submissions) {
    const { data: subsData, error: subsErr } = await supabase
      .from('exam_submissions')
      .select('*, students(id, full_name, student_code)')
      .eq('room_id', roomId)
      .order('submitted_at', { ascending: false })

    if (subsErr) {
      throw new Error(subsErr?.message || 'Không thể tải danh sách bài làm')
    }
    const rawSubs = subsData || []
    // Filter active submissions (score !== 0 or as configured)
    submissions = rawSubs.filter((s: any) => s.score !== 0)
  }

  // 3. Fetch not submitted students if needed
  if (!notSubmittedStudents && room.class_id) {
    const { data: enrolledData } = await supabase
      .from('enrollments')
      .select('student_id, students(id, full_name, student_code)')
      .eq('class_id', room.class_id)
      .eq('status', 'active')

    if (enrolledData) {
      const activeStudentIds = new Set((submissions || []).map((s: any) => s.student_id))
      notSubmittedStudents = enrolledData
        .filter((e: any) => !activeStudentIds.has(e.student_id))
        .map((e: any) => e.students)
        .filter(Boolean)
    } else {
      notSubmittedStudents = []
    }
  } else if (!notSubmittedStudents) {
    notSubmittedStudents = []
  }

  const examQuestions = exam?.data?.questions || []
  const className = room.classes?.class_name || room.classes?.name || 'Tất cả'
  const examTitle = exam?.title || 'Đề thi'
  const timeLimit = room.time_limit || 45
  const roomCode = room.code || '—'

  // Sort submitted students by score descending
  const sortedSubs = [...submissions].sort((a, b) => {
    const scoreA = a.score ?? -1
    const scoreB = b.score ?? -1
    return scoreB - scoreA
  })

  // Sort not submitted students by name
  const sortedNotSubmitted = [...notSubmittedStudents].sort((a, b) => 
    (a.full_name || '').localeCompare(b.full_name || '', 'vi')
  )

  const totalEnrolled = sortedSubs.length + sortedNotSubmitted.length
  const submittedCount = sortedSubs.length
  const notSubmittedCount = sortedNotSubmitted.length

  // Build rows array matching 1.xlsx structure
  const rows: any[][] = []

  // Row 1: Title
  rows.push(['BẢNG ĐIỂM VÀ KẾT QUẢ THI CHI TIẾT'])

  // Row 2: Exam Title
  rows.push([`Tên đề thi: ${examTitle}`])

  // Row 3: Room info
  rows.push([`Mã phòng thi: ${roomCode}  |  Lớp: ${className}  |  Thời gian làm bài: ${timeLimit} phút`])

  // Row 4: Export date & summary
  const nowFormatted = formatDate(new Date())
  rows.push([`Ngày xuất file: ${nowFormatted}  |  Tổng số học sinh: ${totalEnrolled} (Đã nộp: ${submittedCount}, Chưa làm: ${notSubmittedCount})`])

  // Row 5: Blank row
  rows.push([])

  // Row 6: Table Headers
  rows.push([
    'STT (Xếp hạng)',
    'Mã học sinh',
    'Họ và tên',
    'Lớp',
    'Điểm số',
    'Số câu đúng',
    'Số lần thi',
    'Số lần vi phạm (Chuyển tab)',
    'Tổng thời gian làm bài',
    'Trạng thái',
    'Thời gian nộp bài'
  ])

  // Rows for submitted students
  const validScores: number[] = []

  sortedSubs.forEach((sub, index) => {
    const sb = sub.score_breakdown || {}
    const historyTabSwitches = (sb.history || []).reduce((sum: number, att: any) => sum + (att.tab_switches || 0), 0)
    const totalTabSwitches = (sub.tab_switches || 0) + historyTabSwitches

    const mcCorrect = sb.multipleChoice?.correct || 0
    const tfCorrect = sb.trueFalse?.correct || 0
    const saCorrect = sb.shortAnswer?.correct || 0
    const computedCorrectCount = mcCorrect + tfCorrect + saCorrect

    const totalQCount = examQuestions.length ||
      ((sb.multipleChoice?.total || 0) + (sb.trueFalse?.total || 0) + (sb.shortAnswer?.total || 0))

    const scoreVal = sub.score != null ? Number(Number(sub.score).toFixed(2)) : 0
    validScores.push(scoreVal)

    const durationStr = formatDuration(sub.duration)
    const submittedTimeStr = sub.submitted_at ? formatDate(sub.submitted_at) : '—'
    const statusText = sub.status === 'submitted' ? 'Đã nộp bài' : 'Đang làm bài'

    rows.push([
      index + 1,
      sub.students?.student_code || '',
      sub.students?.full_name || '',
      className,
      scoreVal,
      `${computedCorrectCount}/${totalQCount}`,
      sb.attempt_count || 1,
      totalTabSwitches,
      durationStr,
      statusText,
      submittedTimeStr
    ])
  })

  // Rows for unsubmitted students
  sortedNotSubmitted.forEach((student) => {
    rows.push([
      '—',
      student.student_code || '',
      student.full_name || '',
      className,
      'Chưa làm',
      'Chưa làm',
      'Chưa làm',
      'Chưa làm',
      'Chưa làm',
      'Chưa làm bài',
      '—'
    ])
  })

  // Statistics section
  rows.push([])
  rows.push(['--- BẢNG THỐNG KÊ KẾT QUẢ ---'])
  rows.push(['Tổng số học sinh trong danh sách:', totalEnrolled])

  const completionPct = totalEnrolled > 0 ? ((submittedCount / totalEnrolled) * 100).toFixed(1) : '0.0'
  rows.push(['Số học sinh đã hoàn thành:', `${submittedCount} (${completionPct}%)`])
  rows.push(['Số học sinh chưa làm bài:', notSubmittedCount])

  if (validScores.length > 0) {
    const maxScore = Math.max(...validScores)
    const minScore = Math.min(...validScores)
    const avgScore = validScores.reduce((sum, s) => sum + s, 0) / validScores.length
    const passedCount = validScores.filter(s => s >= 5).length
    const passedPct = ((passedCount / validScores.length) * 100).toFixed(1)

    rows.push(['Điểm cao nhất:', maxScore.toFixed(2)])
    rows.push(['Điểm thấp nhất:', minScore.toFixed(2)])
    rows.push(['Điểm trung bình:', avgScore.toFixed(2)])
    rows.push(['Tỷ lệ học sinh đạt điểm >= 5:', `${passedCount}/${validScores.length} (${passedPct}%)`])
  } else {
    rows.push(['Điểm cao nhất:', '—'])
    rows.push(['Điểm thấp nhất:', '—'])
    rows.push(['Điểm trung bình:', '—'])
    rows.push(['Tỷ lệ học sinh đạt điểm >= 5:', '0/0 (0.0%)'])
  }

  // Create worksheet and workbook
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Column widths
  ws['!cols'] = [
    { wch: 16 }, // STT (Xếp hạng)
    { wch: 14 }, // Mã học sinh
    { wch: 26 }, // Họ và tên
    { wch: 14 }, // Lớp
    { wch: 12 }, // Điểm số
    { wch: 14 }, // Số câu đúng
    { wch: 12 }, // Số lần thi
    { wch: 28 }, // Số lần vi phạm (Chuyển tab)
    { wch: 24 }, // Tổng thời gian làm bài
    { wch: 16 }, // Trạng thái
    { wch: 20 }  // Thời gian nộp bài
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Bảng điểm chi tiết')

  // Generate file name
  const safeCode = (roomCode || 'ROOM').replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeExam = (examTitle || 'Exam').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9 -]/g, '_').trim().slice(0, 40)
  const fileName = `Bang_Diem_${safeCode}_${safeExam}.xlsx`

  XLSX.writeFile(wb, fileName)
}
