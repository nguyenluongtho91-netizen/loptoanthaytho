import { useEffect, useState, useCallback } from 'react'
import { Users, BookOpen, CalendarCheck, ChevronLeft, ChevronRight, Clock, MapPin, Search, Eye, EyeOff } from 'lucide-react'
import { useDataStore } from '@/store/dataStore'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import { fmt, parseScheduleToDays } from '@/lib/helpers'
import type { LucideIcon } from 'lucide-react'
import Modal from '@/components/Modal'
import StudentScorecardModal from '@/components/StudentScorecardModal'

type Color = 'teal' | 'green' | 'amber' | 'red'

interface StatCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  sub?: string
  color?: Color
  hideable?: boolean
  isHidden?: boolean
  onToggleHide?: () => void
}

const colorMap: Record<Color, string> = {
  teal:  'from-teal-500 to-teal-400',
  green: 'from-green-500 to-green-400',
  amber: 'from-amber-500 to-amber-400',
  red:   'from-red-500 to-red-400',
}

function StatCard({ icon: Icon, label, value, sub, color = 'teal', hideable, isHidden, onToggleHide }: StatCardProps) {
  return (
    <div className="card p-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-7 h-7 text-white" />
        </div>
        <div>
          <p className="text-gray-500 text-sm font-semibold">{label}</p>
          <p className="text-2xl font-extrabold text-gray-800">
            {hideable && isHidden ? '•••' : value}
          </p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
      {hideable && onToggleHide && (
        <button 
          onClick={onToggleHide}
          className="p-2 text-gray-400 hover:text-teal-600 hover:bg-gray-100 rounded-lg transition"
          title={isHidden ? "Hiện số lượng" : "Ẩn số lượng"}
        >
          {isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>
      )}
    </div>
  )
}

function parseTimeToMinutes(timeStr: string | null | undefined): number {
  if (!timeStr) return 9999
  const cleanStr = timeStr.trim().toLowerCase()
  const firstPart = cleanStr.split(/[-–đ]/)[0].trim()
  const match = firstPart.match(/(\d{1,2})\s*[h:]\s*(\d{2})?/)
  if (match) {
    const hours = parseInt(match[1], 10)
    const minutes = match[2] ? parseInt(match[2], 10) : 0
    return hours * 60 + minutes
  }
  const hourOnlyMatch = firstPart.match(/^(\d{1,2})$/)
  if (hourOnlyMatch) {
    return parseInt(hourOnlyMatch[1], 10) * 60
  }
  return 9999
}

export default function Dashboard() {
  const { profile } = useAuthStore()
  const { classes, students, enrollments, loadClasses, loadStudents, loadEnrollments } = useDataStore()

  const [loaded, setLoaded]       = useState(false)

  const [detailClass, setDetailClass] = useState<any>(null)
  const [modalSearch, setModalSearch] = useState('')
  const [scorecardStudent, setScorecardStudent] = useState<any>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [completedStats, setCompletedStats] = useState<Record<string, number>>({})
  const [showStudentCount, setShowStudentCount] = useState(false)

  const [viewDate, setViewDate] = useState(new Date())

  // Get Monday of the week containing viewDate, and return all 7 days
  const getWeekDays = (baseDate: Date) => {
    const currentDay = baseDate.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat
    const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay
    const monday = new Date(baseDate)
    monday.setDate(baseDate.getDate() + diffToMonday)

    const days = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      days.push(d)
    }
    return days
  }

  const weekDays = getWeekDays(viewDate)

  const isToday = (date: Date) => {
    const today = new Date()
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
  }

  const formatWeekRange = (days: Date[]) => {
    if (days.length === 0) return ''
    const start = days[0]
    const end = days[days.length - 1]
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(start.getDate())}/${pad(start.getMonth() + 1)} - ${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`
  }

  const getClassesForDay = (dayNum: number) => {
    return classes
      .filter(c => c.status === 'active')
      .flatMap(c => {
        const scheduleDays = parseScheduleToDays(c.schedule)
        const matched = scheduleDays.filter(s => s.day === dayNum)
        return matched.map(m => ({
          ...c,
          time: m.time
        }))
      })
      .sort((a, b) => {
        return parseTimeToMinutes(a.time) - parseTimeToMinutes(b.time)
      })
  }

  const prevWeek = () => {
    setViewDate(prev => {
      const d = new Date(prev)
      d.setDate(prev.getDate() - 7)
      return d
    })
  }

  const nextWeek = () => {
    setViewDate(prev => {
      const d = new Date(prev)
      d.setDate(prev.getDate() + 7)
      return d
    })
  }

  const goToday = () => {
    setViewDate(new Date())
  }

  // ✅ FIX 1: deps [] → chỉ chạy 1 lần khi mount, không loop
  // ✅ FIX 3: loadAttendance() cần params → fetch trực tiếp Supabase cho Dashboard
  const loadDashboard = useCallback(async () => {
    try {
      await Promise.all([
        loadClasses(),
        loadStudents(),
        loadEnrollments(),
      ])
    } finally {
      setLoaded(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  const fetchClassStats = async (classId: string, roster: any[]) => {
    if (!classId) {
      setCompletedStats({})
      return
    }
    setStatsLoading(true)
    try {
      const { data: rooms, error: roomsErr } = await supabase
        .from('exam_rooms')
        .select('id')
        .eq('class_id', classId)
        .eq('status', 'active')

      if (roomsErr) throw roomsErr

      const roomIds = rooms?.map(r => r.id) || []
      if (roomIds.length === 0) {
        setCompletedStats({})
        return
      }

      const { data: subs, error: subsErr } = await supabase
        .from('exam_submissions')
        .select('student_id, room_id, score')
        .in('room_id', roomIds)
        .eq('status', 'submitted')

      if (subsErr) throw subsErr

      const stats: Record<string, number> = {}
      const studentIds = roster.map(s => s.id)

      studentIds.forEach(studentId => {
        const studentSubs = subs?.filter(sub => sub.student_id === studentId && sub.score !== 0) || []
        const submittedRooms = new Set(studentSubs.map(sub => sub.room_id))
        const completedCount = submittedRooms.size
        const pct = Math.round((completedCount / roomIds.length) * 100)
        stats[studentId] = pct
      })

      setCompletedStats(stats)
    } catch (err) {
      console.error('Lỗi tính toán phần trăm bài tập:', err)
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    if (detailClass) {
      const roster = enrollments
        .filter(e => e.class_id === detailClass.id && e.status === 'active')
        .map(e => students.find(s => s.id === e.student_id))
        .filter(Boolean)
      void fetchClassStats(detailClass.id, roster)
    } else {
      setCompletedStats({})
    }
  }, [detailClass, enrollments, students])

  const rosterStudents: any[] = detailClass
    ? enrollments
        .filter(e => e.class_id === detailClass.id && e.status === 'active')
        .map(e => students.find(s => s.id === e.student_id))
        .filter(Boolean)
    : []

  const filteredRoster = rosterStudents.filter(s =>
    s.full_name?.toLowerCase().includes(modalSearch.toLowerCase()) ||
    s.student_code?.toLowerCase().includes(modalSearch.toLowerCase())
  )

  const activeClasses  = classes.filter(c => c.status === 'active').length
  const activeStudents = students.filter(s => s.status === 'active').length

  if (!loaded) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-10 h-10 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="section-title">LỚP TOÁN THẦY LĨNH</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Xin chào, <strong>{profile?.name ?? profile?.email}</strong> 👋
          </p>
        </div>
        <span className="text-sm text-gray-400">{fmt(new Date(), 'EEEE, dd/MM/yyyy')}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard icon={BookOpen}      label="Lớp đang mở"      value={activeClasses}             sub="lớp học đang hoạt động" color="teal"  />
        <StatCard 
          icon={Users}         
          label="Học sinh"          
          value={activeStudents}            
          sub="đang theo học"          
          color="green" 
          hideable={true}
          isHidden={!showStudentCount}
          onToggleHide={() => setShowStudentCount(!showStudentCount)}
        />
      </div>

      <div className="card p-6 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-bold text-gray-800 flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-teal-600" />
            Lịch học tuần này
          </h3>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={prevWeek} 
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
              title="Tuần trước"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button 
              onClick={goToday} 
              className="text-xs font-semibold px-2 py-1 rounded bg-teal-50 text-teal-600 hover:bg-teal-100 transition"
            >
              Hôm nay
            </button>
            <button 
              onClick={nextWeek} 
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition"
              title="Tuần sau"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100">
              {formatWeekRange(weekDays)}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto -mx-2 px-2 scrollbar-thin">
          <div className="grid grid-cols-7 gap-2 min-w-[750px] py-1">
            {weekDays.map((dayDate) => {
              const dayNum = dayDate.getDay()
              const isDayToday = isToday(dayDate)
              const dayClasses = getClassesForDay(dayNum)
              const dayNames = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7']

              return (
                <div 
                  key={dayDate.toISOString()} 
                  className={`flex flex-col gap-2 p-1.5 rounded-xl transition-all duration-300 ${
                    isDayToday 
                      ? 'bg-teal-50/50 border border-teal-200 shadow-sm' 
                      : 'border border-transparent'
                  }`}
                >
                  {/* Day Header */}
                  <div className={`flex flex-col items-center py-2 rounded-lg border ${
                    isDayToday 
                      ? 'bg-teal-100/50 border-teal-200' 
                      : 'bg-gray-50/60 border-gray-100'
                  }`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      isDayToday ? 'text-teal-700' : 'text-gray-400'
                    }`}>
                      {dayNames[dayNum]}
                    </span>
                    <span className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-extrabold mt-1 transition-all duration-300 ${
                      isDayToday 
                        ? 'bg-teal-600 text-white shadow-sm' 
                        : 'text-gray-700'
                    }`}>
                      {String(dayDate.getDate()).padStart(2, '0')}
                    </span>
                    {isDayToday && (
                      <span className="text-[8px] font-bold text-teal-600 mt-1 bg-white px-1.5 py-0.5 rounded-full uppercase tracking-tight shadow-sm border border-teal-100">
                        Hôm nay
                      </span>
                    )}
                  </div>

                  {/* Classes list */}
                  <div className="flex flex-col gap-2 flex-1 min-h-[160px]">
                    {dayClasses.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center py-6 border border-dashed border-gray-200 rounded-lg bg-gray-50/20">
                        <span className="text-[9px] text-gray-400 font-medium italic">Không có lớp</span>
                      </div>
                    ) : (
                      dayClasses.map(cls => (
                        <div 
                          key={`${cls.id}-${cls.time}`} 
                          onClick={() => {
                            setDetailClass(cls)
                            setModalSearch('')
                          }}
                          className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-teal-300 transition-all duration-200 flex flex-col gap-1 cursor-pointer"
                        >
                          <div className="font-extrabold text-gray-800 text-[10px] leading-tight line-clamp-2">
                            {(cls as any).class_name || (cls as any).name}
                          </div>
                          
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            <span className="inline-block px-1 py-0.2 text-[8px] font-bold rounded bg-teal-50 text-teal-600 border border-teal-100">
                              {(cls as any).subject || 'Toán'}
                            </span>
                            {(cls as any).room && (
                              <div className="flex items-center gap-0.5 text-[8px] text-gray-500 bg-gray-50 border border-gray-200 px-1 py-0.2 rounded">
                                <MapPin className="w-2 h-2 text-gray-400" />
                                <span className="truncate max-w-[45px]">{(cls as any).room}</span>
                              </div>
                            )}
                          </div>
                          
                          {cls.time && (
                            <div className="flex items-center gap-1 text-[9px] font-medium text-teal-700 mt-1">
                              <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                              <span>{cls.time}</span>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal: Danh sách học sinh của lớp */}
      <Modal
        open={!!detailClass}
        onClose={() => setDetailClass(null)}
        title={`Danh sách học sinh · Lớp ${detailClass?.class_name || detailClass?.name}`}
        size="2xl"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Tìm tên hoặc mã học sinh trong lớp..."
              value={modalSearch}
              onChange={e => setModalSearch(e.target.value)}
              className="input pl-9 w-full text-xs py-2 bg-gray-50/30 border-gray-200 focus:bg-white"
            />
          </div>

          <div className="space-y-3 mt-4">
            {statsLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <div className="w-8 h-8 border-4 border-teal-200 border-t-teal-600 rounded-full animate-spin" />
                <span className="text-xs text-gray-500 font-medium">Đang tải tiến độ học sinh...</span>
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm font-medium">
                {modalSearch ? 'Không tìm thấy học sinh phù hợp' : 'Chưa có học sinh nào đăng ký lớp này'}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredRoster.map(s => {
                  const pct = completedStats[s.id]
                  const bgStyle = pct !== undefined
                    ? { background: `linear-gradient(to right, #dcfce7 ${pct}%, #fee2e2 ${pct}%)` }
                    : { backgroundColor: '#ffffff' }

                  return (
                    <div
                      key={s.id}
                      onClick={() => setScorecardStudent(s)}
                      style={bgStyle}
                      className="relative border border-gray-200 hover:border-teal-300 rounded-xl hover:shadow-sm transition-all duration-200 cursor-pointer flex flex-col items-center justify-center py-4 px-3 min-h-[56px] text-center"
                    >
                      <span className="font-extrabold text-xs text-gray-800 tracking-wide uppercase line-clamp-2">
                        {s.full_name}
                      </span>
                      {pct !== undefined && (
                        <span className="absolute bottom-1 left-2 text-[9px] font-black font-mono text-gray-650 bg-white/70 px-1 py-0.2 rounded shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                          {pct}%
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal: Xem hồ sơ và bảng điểm rút gọn của học sinh */}
      <StudentScorecardModal
        student={scorecardStudent}
        open={!!scorecardStudent}
        onClose={() => {
          setScorecardStudent(null)
          if (detailClass) {
            void fetchClassStats(detailClass.id, rosterStudents)
          }
        }}
      />
    </div>
  )
}
