import { useEffect, useState, useRef } from 'react'
import { MonitorPlay, Plus, Trash2, KeyRound, BarChart3, RefreshCw, Settings, FileSpreadsheet } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useExamRoomStore } from '@/store/examRoomStore'
import { useExamStore } from '@/store/examStore'
import { useDataStore } from '@/store/dataStore'
import { exportExamRoomToExcel } from '@/services/examExportService'
import Modal from '@/components/Modal'
import toast from 'react-hot-toast'

const getExamSessionNumber = (title: string) => {
  const match = title.toLowerCase().match(/buổi\s*(\d+)|buoi\s*(\d+)/)
  if (match) {
    return parseInt(match[1] || match[2], 10)
  }
  return 999
}

const getExamNo = (title: string) => {
  const match = title.toLowerCase().match(/đề\s*(\d+)|de\s*(\d+)/)
  if (match) {
    return parseInt(match[1] || match[2], 10)
  }
  return 999
}

export default function ExamRoomsMgmt() {
  const navigate = useNavigate()
  const { rooms, loading, loadRooms, createRoom, updateRoomStatus, updateRoom, deleteRoom } = useExamRoomStore()
  const { exams, loadExams } = useExamStore()
  const { classes, loadClasses, enrollments, loadEnrollments } = useDataStore()

  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [modalGrade, setModalGrade] = useState<number | ''>('')
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null)
  const [exportingRoomId, setExportingRoomId] = useState<string | null>(null)
  
  // ✅ Đã thêm settings vào Form state
  const [form, setForm] = useState<{
    exam_id: string;
    class_id: string;
    time_limit: number;
    status: 'waiting' | 'active' | 'closed';
    settings: { shuffle: boolean; allowRetry: boolean; showCorrectAnswers: boolean; showExplanations: boolean };
  }>({
    exam_id: '',
    class_id: '',
    time_limit: 45,
    status: 'active',
    settings: { shuffle: true, allowRetry: false, showCorrectAnswers: false, showExplanations: false }
  })

  useEffect(() => {
    void loadRooms()
    void loadExams()
    void loadClasses()
    void loadEnrollments()
  }, [loadRooms, loadExams, loadClasses, loadEnrollments])

  const handleSave = async () => {
    if (!modalGrade) return toast.error('Vui lòng chọn khối lớp')
    if (!form.exam_id) return toast.error('Vui lòng chọn đề thi')
    if (!form.class_id) return toast.error('Vui lòng chọn lớp học')

    setSaving(true)
    try {
      if (editingRoomId) {
        await updateRoom(editingRoomId, {
          time_limit: form.time_limit,
          status: form.status,
          settings: form.settings
        })
        toast.success('Cập nhật phòng thi thành công!')
      } else {
        await createRoom(form)
        toast.success('Mở phòng thi thành công!')
      }
      setModalOpen(false)
      setEditingRoomId(null)
      setModalGrade('')
      setForm({ 
        exam_id: '', class_id: '', time_limit: 45, status: 'active', 
        settings: { shuffle: true, allowRetry: false, showCorrectAnswers: false, showExplanations: false } 
      })
    } catch (e: any) {
      toast.error(editingRoomId ? 'Lỗi khi cập nhật phòng thi' : 'Lỗi khi mở phòng thi')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenEdit = (room: any) => {
    setEditingRoomId(room.id)
    setModalGrade(getRoomGrade(room) || '')
    setForm({
      exam_id: room.exam_id,
      class_id: room.class_id || '',
      time_limit: room.time_limit,
      status: room.status,
      settings: room.settings || { shuffle: true, allowRetry: false, showCorrectAnswers: false, showExplanations: false }
    })
    setModalOpen(true)
  }

  const handleDelete = async (id: string, code: string) => {
    if (!confirm(`Xóa phòng thi mã [${code}]? Mọi bài làm của học sinh sẽ bị mất.`)) return
    try {
      await deleteRoom(id)
      toast.success('Đã xóa phòng thi')
    } catch (e) {
      toast.error('Lỗi khi xóa')
    }
  }

  const getRoomGrade = (room: any) => {
    const roomClass = classes.find(c => c.id === room.class_id) as any
    if (roomClass) {
      const gradeStr = (roomClass.grade || '').toLowerCase().trim()
      if (gradeStr.includes('12') || gradeStr === '12') return 12
      if (gradeStr.includes('11') || gradeStr === '11') return 11
      if (gradeStr.includes('10') || gradeStr === '10') return 10
      if (gradeStr.includes('6') || gradeStr === '6') return 6
      if (gradeStr.includes('7') || gradeStr === '7') return 7
      if (gradeStr.includes('8') || gradeStr === '8') return 8
      if (gradeStr.includes('9') || gradeStr === '9') return 9

      const className = ((roomClass.class_name || roomClass.name || '') as string).toLowerCase()
      if (className.includes('lớp 12') || className.includes('khối 12') || className.includes('toán 12') || /\b12\b/.test(className)) return 12
      if (className.includes('lớp 11') || className.includes('khối 11') || className.includes('toán 11') || /\b11\b/.test(className)) return 11
      if (className.includes('lớp 10') || className.includes('khối 10') || className.includes('toán 10') || /\b10\b/.test(className)) return 10
      if (className.includes('lớp 6') || className.includes('khối 6') || className.includes('toán 6') || /\b6\b/.test(className)) return 6
      if (className.includes('lớp 7') || className.includes('khối 7') || className.includes('toán 7') || /\b7\b/.test(className)) return 7
      if (className.includes('lớp 8') || className.includes('khối 8') || className.includes('toán 8') || /\b8\b/.test(className)) return 8
      if (className.includes('lớp 9') || className.includes('khối 9') || className.includes('toán 9') || /\b9\b/.test(className)) return 9
    }

    const examTitle = (room.exams?.title || '').toLowerCase()
    if (examTitle.includes('lớp 12') || examTitle.includes('khối 12') || examTitle.includes('toán 12') || examTitle.includes('khối mười hai') || /\b(khối\s+)?12\b/.test(examTitle)) return 12
    if (examTitle.includes('lớp 11') || examTitle.includes('khối 11') || examTitle.includes('toán 11') || examTitle.includes('khối mười một') || /\b(khối\s+)?11\b/.test(examTitle)) return 11
    if (examTitle.includes('lớp 10') || examTitle.includes('khối 10') || examTitle.includes('toán 10') || examTitle.includes('khối mười') || /\b(khối\s+)?10\b/.test(examTitle)) return 10
    if (examTitle.includes('lớp 6') || examTitle.includes('khối 6') || examTitle.includes('toán 6') || examTitle.includes('khối sáu') || /\b(khối\s+)?6\b/.test(examTitle)) return 6
    if (examTitle.includes('lớp 7') || examTitle.includes('khối 7') || examTitle.includes('toán 7') || examTitle.includes('khối bảy') || /\b(khối\s+)?7\b/.test(examTitle)) return 7
    if (examTitle.includes('lớp 8') || examTitle.includes('khối 8') || examTitle.includes('toán 8') || examTitle.includes('khối tám') || /\b(khối\s+)?8\b/.test(examTitle)) return 8
    if (examTitle.includes('lớp 9') || examTitle.includes('khối 9') || examTitle.includes('toán 9') || examTitle.includes('khối chín') || /\b(khối\s+)?9\b/.test(examTitle)) return 9

    return null
  }

  const displayGrades = [6, 7, 8, 9, 10, 11, 12]
  const hasOtherRooms = rooms.some(room => {
    const grade = getRoomGrade(room)
    return grade === null || !displayGrades.includes(grade)
  })

  const isFirstRender = useRef(true)

  const [activeGrade, setActiveGrade] = useState<number | 'others'>(() => {
    const saved = sessionStorage.getItem('exam_rooms_active_grade')
    if (saved) {
      return saved === 'others' ? 'others' : Number(saved)
    }
    return 9
  })

  const [selectedClassId, setSelectedClassId] = useState<string | null>(() => {
    return sessionStorage.getItem('exam_rooms_selected_class_id')
  })

  useEffect(() => {
    sessionStorage.setItem('exam_rooms_active_grade', activeGrade.toString())
  }, [activeGrade])

  useEffect(() => {
    if (selectedClassId) {
      sessionStorage.setItem('exam_rooms_selected_class_id', selectedClassId)
    } else {
      sessionStorage.removeItem('exam_rooms_selected_class_id')
    }
  }, [selectedClassId])

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setSelectedClassId(null)
  }, [activeGrade])

  useEffect(() => {
    if (rooms.length > 0 && !rooms.some(r => getRoomGrade(r) === activeGrade)) {
      const gradesWithRooms = displayGrades.filter(g => rooms.some(r => getRoomGrade(r) === g))
      if (gradesWithRooms.length > 0) {
        setActiveGrade(gradesWithRooms[0])
      } else if (hasOtherRooms) {
        setActiveGrade('others')
      }
    }
  }, [rooms])

  useEffect(() => {
    if (!loading && rooms.length > 0) {
      const lastClickedId = sessionStorage.getItem('exam_rooms_last_clicked_id')
      if (lastClickedId) {
        sessionStorage.removeItem('exam_rooms_last_clicked_id')
        setTimeout(() => {
          const element = document.getElementById(`room-card-${lastClickedId}`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            element.classList.add('ring-4', 'ring-teal-500/50', 'bg-teal-50/30')
            setTimeout(() => {
              element.classList.remove('ring-4', 'ring-teal-500/50', 'bg-teal-50/30')
            }, 2000)
          }
        }, 300)
      }
    }
  }, [loading, rooms])

  const getExamGrade = (title: string) => {
    const t = title.toLowerCase()
    if (t.includes('lớp 12') || t.includes('khối 12') || t.includes('toán 12') || t.includes('khối mười hai') || /\b(khối\s+)?12\b/.test(t)) return 12
    if (t.includes('lớp 11') || t.includes('khối 11') || t.includes('toán 11') || t.includes('khối mười một') || /\b(khối\s+)?11\b/.test(t)) return 11
    if (t.includes('lớp 10') || t.includes('khối 10') || t.includes('toán 10') || t.includes('khối mười') || /\b(khối\s+)?10\b/.test(t)) return 10
    if (t.includes('lớp 6') || t.includes('khối 6') || t.includes('toán 6') || t.includes('khối sáu') || /\b(khối\s+)?6\b/.test(t)) return 6
    if (t.includes('lớp 7') || t.includes('khối 7') || t.includes('toán 7') || t.includes('khối bảy') || /\b(khối\s+)?7\b/.test(t)) return 7
    if (t.includes('lớp 8') || t.includes('khối 8') || t.includes('toán 8') || t.includes('khối tám') || /\b(khối\s+)?8\b/.test(t)) return 8
    if (t.includes('lớp 9') || t.includes('khối 9') || t.includes('toán 9') || t.includes('khối chín') || /\b(khối\s+)?9\b/.test(t)) return 9
    return null
  }

  const getClassGrade = (cls: any) => {
    const gradeStr = (cls.grade || '').toLowerCase().trim()
    if (gradeStr.includes('12') || gradeStr === '12') return 12
    if (gradeStr.includes('11') || gradeStr === '11') return 11
    if (gradeStr.includes('10') || gradeStr === '10') return 10
    if (gradeStr.includes('6') || gradeStr === '6') return 6
    if (gradeStr.includes('7') || gradeStr === '7') return 7
    if (gradeStr.includes('8') || gradeStr === '8') return 8
    if (gradeStr.includes('9') || gradeStr === '9') return 9

    const className = ((cls.class_name || cls.name || '') as string).toLowerCase()
    if (className.includes('lớp 12') || className.includes('khối 12') || className.includes('toán 12') || /\b12\b/.test(className)) return 12
    if (className.includes('lớp 11') || className.includes('khối 11') || className.includes('toán 11') || /\b11\b/.test(className)) return 11
    if (className.includes('lớp 10') || className.includes('khối 10') || className.includes('toán 10') || /\b10\b/.test(className)) return 10
    if (className.includes('lớp 6') || className.includes('khối 6') || className.includes('toán 6') || /\b6\b/.test(className)) return 6
    if (className.includes('lớp 7') || className.includes('khối 7') || className.includes('toán 7') || /\b7\b/.test(className)) return 7
    if (className.includes('lớp 8') || className.includes('khối 8') || className.includes('toán 8') || /\b8\b/.test(className)) return 8
    if (className.includes('lớp 9') || className.includes('khối 9') || className.includes('toán 9') || /\b9\b/.test(className)) return 9

    return null
  }

  const filteredExams = modalGrade 
    ? exams.filter(ex => getExamGrade(ex.title) === modalGrade)
    : exams

  const filteredClasses = modalGrade
    ? classes.filter(c => c.status === 'active' && getClassGrade(c) === modalGrade)
    : classes.filter(c => c.status === 'active')

  const getClassName = (cls: any) => cls?.class_name || cls?.name || 'Chưa rõ'

  const activeRooms = rooms.filter(r => 
    activeGrade === 'others' 
      ? (getRoomGrade(r) === null || !displayGrades.includes(getRoomGrade(r)!)) 
      : getRoomGrade(r) === activeGrade
  )

  const classIdsWithRooms = new Set(activeRooms.map(r => r.class_id).filter(Boolean))

  const classesInActiveGrade = classes.filter(c => {
    const grade = getClassGrade(c)
    const belongsToGrade = activeGrade === 'others'
      ? (grade === null || !displayGrades.includes(grade))
      : grade === activeGrade
    return belongsToGrade && (c.status === 'active' || classIdsWithRooms.has(c.id))
  })

  // Sắp xếp các lớp theo tên
  classesInActiveGrade.sort((a, b) => getClassName(a).localeCompare(getClassName(b)))

  const defaultClassId = classesInActiveGrade[0]?.id || null
  const currentClassId = selectedClassId !== null ? selectedClassId : defaultClassId

  const displayedRooms = currentClassId 
    ? activeRooms.filter(r => r.class_id === currentClassId)
    : activeRooms

  // Sắp xếp danh sách phòng thi ngược lại: Buổi lớn -> Buổi nhỏ -> ... -> thời gian tạo mới nhất lên đầu
  const sortedRooms = [...displayedRooms].sort((a, b) => {
    const titleA = a.exams?.title || ''
    const titleB = b.exams?.title || ''
    
    const sessionA = getExamSessionNumber(titleA)
    const sessionB = getExamSessionNumber(titleB)
    
    if (sessionA !== sessionB) {
      if (sessionA === 999) return 1
      if (sessionB === 999) return -1
      return sessionB - sessionA
    }
    
    const deA = getExamNo(titleA)
    const deB = getExamNo(titleB)
    
    if (deA !== deB) {
      if (deA === 999) return 1
      if (deB === 999) return -1
      return deB - deA
    }
    
    if (sessionA === 999 && sessionB === 999) {
      const titleComp = titleB.localeCompare(titleA, 'vi', { numeric: true, sensitivity: 'base' })
      if (titleComp !== 0) return titleComp
    }
    
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-start">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <MonitorPlay className="w-7 h-7 text-teal-600" /> Quản lý Phòng thi
          </h1>
          <p className="text-gray-400 text-sm mt-1">Giao đề và theo dõi kết quả thi của học sinh</p>
        </div>
        
        <button 
          onClick={() => {
            setEditingRoomId(null)
            setModalGrade(typeof activeGrade === 'number' ? activeGrade : '')
            setForm({ 
              exam_id: '', class_id: '', time_limit: 45, status: 'active', 
              settings: { shuffle: true, allowRetry: false, showCorrectAnswers: false, showExplanations: false } 
            })
            setModalOpen(true)
          }} 
          className="btn-teal flex items-center gap-2 shadow-lg shadow-teal-500/20"
        >
          <Plus className="w-4 h-4" /> Mở phòng thi mới
        </button>
      </div>

      {loading && rooms.length === 0 ? (
        <div className="card flex justify-center items-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin text-teal-600" />
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* LEFT SIDEBAR: BUTTONS (25% area) */}
          <div className="w-full lg:w-1/4 flex flex-row lg:flex-col gap-2.5 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 shrink-0">
            {[...displayGrades, ...(hasOtherRooms ? ['others'] : [])].map((col) => {
              const isOther = col === 'others'
              const gradeRooms = rooms.filter(r => isOther ? (getRoomGrade(r) === null || !displayGrades.includes(getRoomGrade(r)!)) : getRoomGrade(r) === col)
              const title = isOther ? 'Khác' : `Khối ${col}`
              const isActive = activeGrade === col

              return (
                <button
                  key={col}
                  onClick={() => setActiveGrade(col as any)}
                  className={`flex items-center justify-between px-5 py-4 rounded-2xl border-2 text-left transition-all duration-200 shrink-0 lg:w-full ${
                    isActive 
                      ? 'bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-500/20 lg:translate-x-1'
                      : 'bg-white border-gray-100 text-gray-750 hover:border-teal-200 hover:bg-teal-50/20'
                  }`}
                >
                  <span className="font-bold text-sm lg:text-base flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-white' : isOther ? 'bg-amber-400' : 'bg-teal-500'}`}></span>
                    {title}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                    isActive 
                      ? 'bg-teal-700/50 border-teal-500 text-white' 
                      : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}>
                    {gradeRooms.length} phòng
                  </span>
                </button>
              )
            })}
          </div>

          {/* RIGHT VIEW: ROOM CARDS GRID (75% area) */}
          <div className="flex-1 bg-slate-50/40 rounded-3xl border border-slate-200/50 p-6 min-h-[500px]">
            {/* Header of selected tab */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3 mb-5">
              <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                Danh sách phòng thi {activeGrade === 'others' ? 'Khác' : `Khối ${activeGrade}`}
              </h2>
              <span className="text-sm font-semibold text-gray-500 bg-white border border-slate-200 px-3 py-1 rounded-xl shadow-sm shrink-0">
                Tổng cộng: {displayedRooms.length} phòng
              </span>
            </div>

            {/* CLASS FILTER BUTTONS */}
            {classesInActiveGrade.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {classesInActiveGrade.map((cls) => {
                  const count = activeRooms.filter((r) => r.class_id === cls.id).length
                  const isActive = currentClassId === cls.id
                  return (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border duration-200 flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-500/10'
                          : 'bg-white border-slate-200 text-gray-600 hover:border-teal-300 hover:bg-teal-50/20'
                      }`}
                    >
                      {getClassName(cls)}
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                          isActive
                            ? 'bg-teal-700/50 text-teal-50'
                            : 'bg-slate-100 text-slate-500 border border-slate-200/50'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {/* List of rooms (horizontal layout, stacked vertically) */}
            {(() => {
              if (sortedRooms.length === 0) {
                return (
                  <div className="flex flex-col justify-center items-center py-24 text-gray-400">
                    <MonitorPlay className="w-12 h-12 opacity-25 mb-3" />
                    <p className="text-sm italic">
                      {selectedClassId
                        ? 'Chưa có phòng thi nào được mở cho lớp này'
                        : `Chưa có phòng thi nào được mở cho ${activeGrade === 'others' ? 'danh mục này' : `Khối ${activeGrade}`}`}
                    </p>
                  </div>
                )
              }

              return (
                <div className="flex flex-col gap-3">
                  {sortedRooms.map((room) => (
                    <div 
                      key={room.id} 
                      id={`room-card-${room.id}`}
                      className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm hover:border-teal-300 hover:shadow-md transition-all duration-200 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      {/* Left: Code & Title & Class */}
                      <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1 min-w-0">
                        <span className="font-mono text-sm font-extrabold text-teal-700 bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200 shadow-sm flex items-center gap-1.5 shrink-0 self-start md:self-auto">
                          <KeyRound className="w-4 h-4 opacity-60" /> {room.code}
                        </span>
                        
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-gray-800 text-base leading-snug truncate" title={room.exams?.title}>
                            {room.exams?.title || '—'}
                          </h4>
                          <p className="text-xs text-gray-400 font-bold mt-1">
                            Lớp học: <span className="text-gray-500 font-medium">{(room.classes as any)?.class_name || (room.classes as any)?.name || 'Tất cả'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Middle: Stats */}
                      {(() => {
                        const totalStudents = enrollments.filter(e => e.class_id === room.class_id && e.status === 'active').length
                        const submittedCount = room.exam_submissions?.length || 0
                        return (
                          <div className="flex-col items-start shrink-0 min-w-[100px] gap-0.5 pl-4 border-l border-slate-200 hidden md:flex">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Đã làm bài</span>
                            <div className="flex items-baseline gap-1 font-extrabold">
                              <span className={`text-base ${submittedCount > 0 ? 'text-teal-600' : 'text-gray-400'}`}>
                                {submittedCount}
                              </span>
                              <span className="text-gray-300 text-xs font-normal">/</span>
                              <span className="text-gray-500 text-xs">
                                {totalStudents} HS
                              </span>
                            </div>
                          </div>
                        )
                      })()}
                      
                      {/* Right: Time, Status, and Actions */}
                      <div className="flex items-center justify-between md:justify-end gap-5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                        {/* Mobile view of stats */}
                        {(() => {
                          const totalStudents = enrollments.filter(e => e.class_id === room.class_id && e.status === 'active').length
                          const submittedCount = room.exam_submissions?.length || 0
                          return (
                            <span className="text-[11px] font-bold text-gray-500 md:hidden bg-slate-50 border border-slate-200/50 px-2 py-1 rounded-xl">
                              Đã nộp: {submittedCount}/{totalStudents}
                            </span>
                          )
                        })()}

                        <span className="text-xs text-gray-400 font-bold bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-150 shrink-0">
                          {room.time_limit} phút
                        </span>
                        
                        <select 
                          value={room.status} 
                          onChange={(e) => updateRoomStatus(room.id, e.target.value as any)}
                          className={`text-[11px] font-extrabold px-3 py-1.5 rounded-full outline-none border-2 cursor-pointer transition-all shrink-0 ${
                            room.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 
                            room.status === 'closed' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          <option value="waiting">🟡 Chờ</option>
                          <option value="active">🟢 Thi</option>
                          <option value="closed">🔴 Khóa</option>
                        </select>
                        
                        <div className="flex gap-1">
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation()
                              try {
                                setExportingRoomId(room.id)
                                toast.loading('Đang chuẩn bị file Excel...', { id: `export-room-${room.id}` })
                                await exportExamRoomToExcel({ roomId: room.id, room })
                                toast.success('Xuất file Excel thành công!', { id: `export-room-${room.id}` })
                              } catch (err: any) {
                                toast.error('Lỗi khi xuất file: ' + (err?.message || err), { id: `export-room-${room.id}` })
                              } finally {
                                setExportingRoomId(null)
                              }
                            }}
                            disabled={exportingRoomId === room.id}
                            className="p-2 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl border border-transparent hover:border-emerald-100 transition-all disabled:opacity-50"
                            title="Xuất file Excel bảng điểm"
                          >
                            {exportingRoomId === room.id ? (
                              <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                            ) : (
                              <FileSpreadsheet className="w-5 h-5" />
                            )}
                          </button>
                          <button 
                            onClick={() => {
                              sessionStorage.setItem('exam_rooms_active_grade', activeGrade.toString())
                              if (currentClassId) {
                                sessionStorage.setItem('exam_rooms_selected_class_id', currentClassId)
                              }
                              sessionStorage.setItem('exam_rooms_last_clicked_id', room.id)
                              navigate(`/exam-results/${room.id}`)
                            }}
                            className="p-2 text-teal-600 hover:bg-teal-50 hover:text-teal-700 rounded-xl border border-transparent hover:border-teal-100 transition-all"
                            title="Xem bảng điểm & kết quả"
                          >
                            <BarChart3 className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleOpenEdit(room)}
                            className="p-2 text-gray-500 hover:bg-slate-100 hover:text-gray-700 rounded-xl transition-all"
                            title="Cấu hình phòng thi"
                          >
                            <Settings className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(room.id, room.code)}
                            className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all"
                            title="Xóa phòng"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingRoomId ? "Cấu hình phòng thi" : "Thiết lập phòng thi mới"} size="md">
        <div className="space-y-5">
          <div className="bg-teal-50 p-4 rounded-2xl border border-teal-100 mb-2">
            <p className="text-xs text-teal-700 font-bold uppercase tracking-wider mb-1">💡 Mẹo nhỏ:</p>
            <p className="text-xs text-teal-600 leading-relaxed">Chọn khối lớp trước. Đề thi và lớp học tương ứng sẽ được lọc tự động theo khối đã chọn.</p>
          </div>

          <div>
            <label className="label">Chọn Khối Lớp *</label>
            <select 
              value={modalGrade} 
              onChange={e => {
                const val = e.target.value
                setModalGrade(val ? Number(val) : '')
                setForm(f => ({ ...f, exam_id: '', class_id: '' }))
              }} 
              className="input font-bold"
              disabled={!!editingRoomId}
            >
              <option value="">-- Chọn khối lớp --</option>
              <option value="6">Khối 6</option>
              <option value="7">Khối 7</option>
              <option value="8">Khối 8</option>
              <option value="9">Khối 9</option>
              <option value="10">Khối 10</option>
              <option value="11">Khối 11</option>
              <option value="12">Khối 12</option>
            </select>
          </div>

          <div>
            <label className="label">1. Chọn đề thi từ thư viện *</label>
            <select 
              value={form.exam_id} 
              onChange={e => setForm({...form, exam_id: e.target.value})} 
              className="input font-semibold text-teal-900"
              disabled={!!editingRoomId || !modalGrade}
            >
              <option value="">{modalGrade ? '-- Chọn đề thi --' : '-- Vui lòng chọn khối lớp trước --'}</option>
              {filteredExams.map(ex => (
                <option key={ex.id} value={ex.id}>{ex.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">2. Giao cho lớp học nào? *</label>
            <select 
              value={form.class_id} 
              onChange={e => setForm({...form, class_id: e.target.value})} 
              className="input"
              disabled={!!editingRoomId || !modalGrade}
            >
              <option value="">{modalGrade ? '-- Chọn lớp học --' : '-- Vui lòng chọn khối lớp trước --'}</option>
              {filteredClasses.map(c => (
                <option key={c.id} value={c.id}>{(c as any).class_name || (c as any).name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Thời gian (Phút)</label>
              <input type="number" value={form.time_limit} onChange={e => setForm({...form, time_limit: Number(e.target.value)})} className="input text-center font-bold text-lg" />
            </div>
            <div>
              <label className="label">Trạng thái phòng</label>
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value as any})} className="input font-bold">
                <option value="waiting">🟡 Chờ bắt đầu</option>
                <option value="active">🟢 Cho thi ngay</option>
              </select>
            </div>
          </div>

          {/* ✅ TÙY CHỌN NÂNG CAO ĐÃ ĐƯỢC THÊM VÀO ĐÂY */}
          <div className="col-span-1 md:col-span-2 flex flex-col gap-3 mt-4 p-4 bg-teal-50 border border-teal-100 rounded-xl">
            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={form.settings.shuffle} 
                onChange={e => setForm({...form, settings: {...form.settings, shuffle: e.target.checked}})} 
                className="w-5 h-5 accent-teal-600 rounded cursor-pointer" 
              />
              <div>
                <span className="text-gray-800 text-sm font-bold block">🔀 Xáo trộn câu hỏi & đáp án</span>
                <span className="text-gray-500 text-xs">(Hệ thống tự trộn mỗi học sinh 1 mã đề - Chỉ dùng cho đề Word)</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={form.settings.allowRetry} 
                onChange={e => setForm({...form, settings: {...form.settings, allowRetry: e.target.checked}})} 
                className="w-5 h-5 accent-teal-600 rounded cursor-pointer" 
              />
              <div>
                <span className="text-gray-800 text-sm font-bold block">🔄 Cho phép thi lại nhiều lần</span>
                <span className="text-gray-500 text-xs">(Học sinh có thể làm lại bài, điểm mới sẽ ghi đè điểm cũ)</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={form.settings.showCorrectAnswers} 
                onChange={e => setForm({...form, settings: {...form.settings, showCorrectAnswers: e.target.checked}})} 
                className="w-5 h-5 accent-teal-600 rounded cursor-pointer" 
              />
              <div>
                <span className="text-gray-800 text-sm font-bold block">👁️ Hiển thị đáp án đúng sau khi nộp</span>
                <span className="text-gray-500 text-xs">(Tô màu xanh đáp án đúng của các câu hỏi khi học sinh xem lại bài)</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={form.settings.showExplanations} 
                onChange={e => setForm({...form, settings: {...form.settings, showExplanations: e.target.checked}})} 
                className="w-5 h-5 accent-teal-600 rounded cursor-pointer" 
              />
              <div>
                <span className="text-gray-800 text-sm font-bold block">📖 Hiển thị lời giải chi tiết sau khi nộp</span>
                <span className="text-gray-500 text-xs">(Hiển thị các bước giải thích chi tiết bên dưới câu hỏi)</span>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-3 mt-8 pt-5 border-t border-gray-100">
            <button onClick={() => setModalOpen(false)} className="btn-outline px-8 py-2.5">Đóng</button>
            <button onClick={handleSave} disabled={saving} className="btn-teal px-10 py-2.5 font-bold shadow-lg shadow-teal-500/30">
              {saving ? (editingRoomId ? 'Đang cập nhật...' : 'Đang khởi tạo...') : (editingRoomId ? 'Lưu cài đặt' : 'Mở phòng thi')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
