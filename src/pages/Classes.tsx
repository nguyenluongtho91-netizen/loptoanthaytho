// @ts-nocheck
import { useEffect, useState } from 'react'
import { Plus, Pencil, Users, BookOpen, User, Trash2, Search, UserPlus, GraduationCap, Calendar, MapPin } from 'lucide-react'
import { useDataStore } from '@/store/dataStore'
import { useAuthStore } from '@/store/authStore'
import Modal from '@/components/Modal'
import StudentScorecardModal from '@/components/StudentScorecardModal'
import { fmtVNDShort } from '@/lib/helpers'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase' // ✅ Thêm supabase để gọi lệnh xóa trực tiếp

const EMPTY = {
  class_name: '', subject: 'Toán', grade: '', teacher_id: '', fee_per_session: '',
  planned_sessions: '', start_date: '', max_students: 30,
  room: '', school: '', schedule: '', note: '', status: 'active'
}

export default function Classes() {
  const { classes, students, enrollments, profiles, loadClasses, loadStudents, loadEnrollments, loadProfiles,
    addClass, updateClass, enroll, unenroll } = useDataStore()
  
  // ✅ Lấy thêm user từ AuthStore để biết ai đang đăng nhập
  const { user, isAdmin } = useAuthStore() as any
  
  const [modal, setModal]       = useState<'form' | 'add_student' | null>(null)
  const [editing, setEditing]   = useState<any>(null)
  const [form, setForm]         = useState(EMPTY)
  const [selClass, setSelClass] = useState<any>(null)
  const [scorecardStudent, setScorecardStudent] = useState<any>(null)
  const [saving, setSaving]     = useState(false)
  const [search, setSearch]     = useState('')
  const [leftSearch, setLeftSearch]   = useState('')
  const [rightSearch, setRightSearch] = useState('')
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)

  useEffect(() => {
    loadClasses(); loadStudents(); loadEnrollments(); loadProfiles();
  }, [])

  // ✅ Nếu là Giáo viên tạo lớp, tự động gán teacher_id là ID của giáo viên đó
  const openAdd  = () => { 
    setEditing(null); 
    setForm({ ...EMPTY, teacher_id: isAdmin() ? '' : user?.id }); 
    setModal('form');
  }
  const openEdit = (c: any) => { setEditing(c); setForm({ ...c }); setModal('form') }

  const save = async () => {
    if (!form.class_name) return toast.error('Nhập tên lớp')
    if (!form.grade) return toast.error('Vui lòng chọn Khối lớp')
    setSaving(true)
    try {
      const payload: any = {
        ...form,
        fee_per_session: Number(form.fee_per_session) || 0,
        planned_sessions: Number(form.planned_sessions) || 0,
        max_students: Number(form.max_students) || 30,
        start_date: form.start_date || null,
        teacher_id: form.teacher_id || null
      }

      if (editing) await updateClass(editing.id, payload)
      else await addClass(payload)

      toast.success(editing ? 'Đã cập nhật lớp' : 'Đã thêm lớp mới')
      setModal(null)
    } catch (e: any) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  // ✅ HÀM XÓA LỚP HỌC TRỰC TIẾP
  const handleDeleteClass = async (id: string, className: string) => {
    const confirmMsg = `Thầy/Cô có chắc chắn muốn xóa lớp "${className}"?\n\nHệ thống sẽ tự động dọn dẹp TOÀN BỘ danh sách học sinh, điểm danh và dữ liệu học phí thuộc lớp này. Hành động không thể hoàn tác!`
    if (!window.confirm(confirmMsg)) return;

    const toastId = toast.loading('Đang xóa lớp học...');
    try {
      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) throw error;
      
      toast.success('Đã xóa lớp học thành công!', { id: toastId });
      loadClasses(); // Tải lại danh sách lớp ngầm
    } catch (e: any) {
      toast.error(e.message || 'Lỗi khi xóa lớp học!', { id: toastId });
    }
  }

  // ✅ LỌC LỚP HỌC: Admin thấy hết, Giáo viên chỉ thấy lớp do mình phụ trách
  const myClasses = isAdmin() ? classes : classes.filter((c: any) => c.teacher_id === user?.id)

  const filtered = myClasses.filter(c => {
    const matchesSearch =
      (c as any).class_name?.toLowerCase().includes(search.toLowerCase()) ||
      ((c as any).subject || '').toLowerCase().includes(search.toLowerCase())
    const matchesGrade = selectedGrade === null || String((c as any).grade) === selectedGrade
    return matchesSearch && matchesGrade
  })

  const currentClass = classes.find(c => c.id === selClass?.id) || (filtered.length > 0 ? filtered[0] : null)

  const rosterStudents: any[] = currentClass
    ? enrollments
        .filter(e => e.class_id === currentClass.id && e.status === 'active')
        .map(e => students.find(s => s.id === e.student_id))
        .filter(Boolean)
    : []

  const filteredRoster = rosterStudents.filter(s =>
    s.full_name?.toLowerCase().includes(leftSearch.toLowerCase()) ||
    s.student_code?.toLowerCase().includes(leftSearch.toLowerCase())
  )

  const filteredAllStudents = students
    .filter(s => s.status === 'active')
    .filter(s => currentClass ? !enrollments.some(e => e.class_id === currentClass.id && e.student_id === s.id && e.status === 'active') : true)
    .filter(s =>
      s.full_name?.toLowerCase().includes(rightSearch.toLowerCase()) ||
      s.student_code?.toLowerCase().includes(rightSearch.toLowerCase())
    )
    .sort((a, b) => {
      const aCount = enrollments.filter(e => e.student_id === a.id && e.status === 'active').length
      const bCount = enrollments.filter(e => e.student_id === b.id && e.status === 'active').length
      if (aCount === 0 && bCount > 0) return -1
      if (bCount === 0 && aCount > 0) return 1
      if (aCount !== bCount) return aCount - bCount
      return (a.full_name || '').localeCompare(b.full_name || '', 'vi')
    })

  const inp = (field: keyof typeof EMPTY, extra = {}) => ({
    value: form[field] || '',
    onChange: (e: any) => setForm(f => ({ ...f, [field]: e.target.value })),
    className: 'input',
    ...extra,
  })

  const teachers = profiles.filter(p => p.role === 'TEACHER' || p.role === 'ADMIN')

  const [statsLoading, setStatsLoading] = useState(false)
  const [completedStats, setCompletedStats] = useState<Record<string, number>>({})

  const fetchClassStats = async () => {
    if (!currentClass?.id) {
      setCompletedStats({})
      return
    }
    setStatsLoading(true)
    try {
      const { data: rooms, error: roomsErr } = await supabase
        .from('exam_rooms')
        .select('id')
        .eq('class_id', currentClass.id)
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
      const studentIds = rosterStudents.map(s => s.id)

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
    void fetchClassStats()
  }, [currentClass?.id, rosterStudents.length])

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-teal-50 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-gray-800 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-teal-600" /> Lớp học {isAdmin() ? '(Tất cả)' : 'của tôi'}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {myClasses.length} lớp học · {myClasses.filter((c: any) => c.status === 'active').length} lớp đang hoạt động
          </p>
        </div>
        <button onClick={openAdd} className="btn-teal flex items-center gap-2 self-start sm:self-auto py-2.5 px-5 shadow-lg shadow-teal-100 hover:shadow-teal-200 hover:scale-[1.02] active:scale-[0.98] transition-all">
          <Plus className="w-4 h-4" /> Thêm lớp
        </button>
      </div>

      {/* Split Pane Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* CỘT TRÁI: DANH SÁCH LỚP HỌC (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-205 p-4 shadow-sm space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Tìm lớp học, môn học..."
                className="input pl-9 w-full text-sm py-2 bg-gray-50/50 focus:bg-white border-gray-200"
              />
            </div>

            {/* Grade filter buttons */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedGrade(null)}
                className={`flex-1 min-w-[55px] text-center py-1.5 px-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                  selectedGrade === null
                    ? 'bg-teal-600 text-white shadow-sm shadow-teal-100'
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                Tất cả
              </button>
              {['6', '7', '8', '9'].map(grade => (
                <button
                  key={grade}
                  onClick={() => setSelectedGrade(grade)}
                  className={`flex-1 min-w-[55px] text-center py-1.5 px-2 rounded-lg text-xs font-bold transition-all duration-200 ${
                    selectedGrade === grade
                      ? 'bg-teal-600 text-white shadow-sm shadow-teal-100'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                >
                  Khối {grade}
                </button>
              ))}
            </div>
            
            <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 custom-scrollbar">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  Chưa có lớp học nào
                </div>
              ) : (
                filtered.map((c: any) => {
                  const isActive = currentClass?.id === c.id
                  const count = enrollments.filter(e => e.class_id === c.id && e.status === 'active').length
                  const teacher = profiles.find(p => p.id === c.teacher_id)
                  
                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelClass(c)}
                      className={`relative group cursor-pointer border rounded-2xl p-4 transition-all duration-200 ${
                        isActive
                          ? 'border-teal-500 bg-teal-50/30 shadow-md shadow-teal-50/30'
                          : 'border-gray-200 hover:border-teal-300 hover:bg-slate-50/30'
                      }`}
                    >
                      {/* Thẻ Khối lớp & Trạng thái */}
                      <div className="flex justify-between items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          isActive ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'
                        }`}>
                          Khối {c.grade}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          <span className={c.status === 'active' ? 'text-[10px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded' : 'text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded'}>
                            {c.status === 'active' ? 'Đang mở' : 'Đóng'}
                          </span>
                          
                          {/* Nút cộng thêm học sinh nhanh */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelClass(c)
                              setRightSearch('')
                              setModal('add_student')
                            }}
                            title="Thêm nhanh học sinh"
                            className="p-1 rounded-full bg-teal-600 hover:bg-teal-700 text-white transition-colors shadow-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Tên Lớp */}
                      <h3 className={`font-bold text-sm ${isActive ? 'text-teal-950' : 'text-gray-800'} line-clamp-1 group-hover:text-teal-800`}>
                        {c.class_name}
                      </h3>

                      {/* Môn & Giáo viên */}
                      <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2 text-xs text-gray-500">
                        <span>Môn: <strong className="text-gray-700">{c.subject}</strong></span>
                        <span>•</span>
                        <span className="truncate">
                          GV: <strong className="text-gray-700">{teacher ? (teacher.name || teacher.email) : 'Chưa phân công'}</strong>
                        </span>
                      </div>

                      {/* Lịch học & Sĩ số */}
                      <div className="mt-3 pt-3 border-t border-dashed border-gray-200 flex justify-between items-center text-xs">
                        <span className="text-gray-400 truncate max-w-[60%]">{c.schedule || 'Chưa xếp lịch'}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          isActive ? 'bg-teal-100 text-teal-800' : 'bg-teal-50 text-teal-700 border border-teal-100'
                        }`}>
                          <Users className="w-3 h-3" />
                          {count}/{c.max_students || '∞'}
                        </span>
                      </div>

                      {/* Nút thao tác lớp: Hiện khi hover hoặc khi active */}
                      <div className="absolute right-3 top-8 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-white/90 backdrop-blur-sm p-1 rounded-lg shadow-sm border border-gray-200">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openEdit(c)
                          }}
                          title="Sửa thông tin"
                          className="p-1 text-teal-600 hover:bg-teal-50 rounded"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteClass(c.id, c.class_name)
                          }}
                          title="Xóa lớp"
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: CHI TIẾT LỚP & HỌC SINH (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          {currentClass ? (
            <>
              {/* Danh sách học sinh trong lớp */}
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200">
                  <div>
                    <h3 className="font-extrabold text-gray-800 text-base flex flex-col sm:flex-row sm:items-center gap-2">
                      <span>Danh sách học sinh · Lớp {currentClass.class_name}</span>
                      <span className="text-xs font-bold text-teal-600 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-full self-start sm:self-auto">
                        {rosterStudents.length} học sinh
                      </span>
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setRightSearch('')
                        setModal('add_student')
                      }}
                      className="btn-teal flex items-center gap-1.5 py-1.5 px-3 text-xs shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Thêm học sinh
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm tên hoặc mã học sinh trong lớp..."
                    value={leftSearch}
                    onChange={e => setLeftSearch(e.target.value)}
                    className="input pl-9 w-full text-xs py-2 bg-gray-50/30 border-gray-200 focus:bg-white"
                  />
                </div>

                <div className="space-y-3 mt-4">
                  {filteredRoster.length === 0 ? (
                    <div className="text-center py-12 text-gray-400 text-sm font-medium">
                      {leftSearch ? 'Không tìm thấy học sinh phù hợp' : 'Chưa có học sinh nào đăng ký lớp này'}
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
                            className="relative group border border-gray-200 hover:border-teal-300 rounded-xl hover:shadow-sm transition-all duration-200 cursor-pointer flex flex-col items-center justify-center py-4 px-3 min-h-[56px] text-center"
                          >
                            <span className="font-extrabold text-xs text-gray-800 tracking-wide uppercase line-clamp-2">
                              {s.full_name}
                            </span>
                            {pct !== undefined && (
                              <span className="absolute bottom-1 left-2 text-[9px] font-black font-mono text-gray-650 bg-white/70 px-1 py-0.2 rounded shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                                {pct}%
                              </span>
                            )}
                            
                            {/* Bỏ ghi danh học sinh (hiển thị khi di chuột qua) */}
                            <button
                              onClick={async (e) => {
                                e.stopPropagation()
                                const confirmMsg = `Bạn muốn xóa học sinh "${s.full_name}" khỏi lớp "${currentClass.class_name}"?`
                                if (!window.confirm(confirmMsg)) return
                                await unenroll(s.id, currentClass.id)
                                toast.success('Đã bỏ ghi danh học sinh')
                              }}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 text-red-500 hover:bg-red-50 rounded-full"
                              title="Xóa khỏi lớp"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-bold text-gray-700 text-base">Chưa chọn lớp học</h3>
              <p className="text-gray-400 text-xs mt-1">Chọn một lớp học bên trái hoặc tạo lớp mới để xem danh sách học sinh</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Thêm/Sửa thông tin lớp */}
      <Modal open={modal==='form'} onClose={() => setModal(null)}
        title={editing ? `Sửa lớp: ${editing.class_name}` : 'Thêm lớp mới'} size="2xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-3">
            <label className="label">Tên lớp học *</label>
            <input {...inp('class_name')} placeholder="VD: Toán 10A" />
          </div>
          <div>
            <label className="label">Trạng thái</label>
            <select {...inp('status')} className="input">
              <option value="active">Đang mở</option>
              <option value="inactive">Đóng lớp</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="label font-bold text-teal-700">Giáo viên phụ trách</label>
            {/* ✅ Nếu là GV, khóa cứng dropdown tên GV để họ không tự gán lớp cho người khác */}
            <select {...inp('teacher_id')} className="input border-teal-200" disabled={!isAdmin()}>
              {isAdmin() ? (
                <>
                  <option value="">— Chưa phân công —</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.name || t.email} ({t.role})</option>
                  ))}
                </>
              ) : (
                <option value={user?.id}>{user?.user_metadata?.full_name || user?.email || 'Bản thân tôi'}</option>
              )}
            </select>
          </div>
          <div>
            <label className="label">Môn học</label>
            <select {...inp('subject')} className="input">
              {['Toán','Lý','Hóa','Anh','Văn','Sinh','Sử','Địa','Tin'].map(s=>(
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Khối lớp *</label>
            <select {...inp('grade')} className="input" required>
              <option value="">-- Chọn khối lớp --</option>
              <option value="6">Khối 6</option>
              <option value="7">Khối 7</option>
              <option value="8">Khối 8</option>
              <option value="9">Khối 9</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="label">Trường</label>
            <input {...inp('school')} placeholder="THPT..." />
          </div>
          <div>
            <label className="label">Học phí/buổi</label>
            <input {...inp('fee_per_session')} type="number" placeholder="150000" />
          </div>
          <div>
            <label className="label">Số buổi/tháng</label>
            <input {...inp('planned_sessions')} type="number" placeholder="8" />
          </div>

          <div className="md:col-span-2">
            <label className="label">Ngày bắt đầu</label>
            <input {...inp('start_date')} type="date" />
          </div>
          <div>
            <label className="label">Sĩ số tối đa</label>
            <input {...inp('max_students')} type="number" />
          </div>
          <div>
            <label className="label">Phòng học</label>
            <input {...inp('room')} placeholder="P.101..." />
          </div>

          <div className="md:col-span-4">
            <label className="label">Lịch học chi tiết</label>
            <input {...inp('schedule')} placeholder="VD: Thứ 2 (18h-20h), Thứ 5 (17h-19h)" />
          </div>

          <div className="md:col-span-4">
            <label className="label">Ghi chú thêm</label>
            <input {...inp('note')} placeholder="Ghi chú về tài liệu, yêu cầu..." className="input" />
          </div>
        </div>

        <div className="flex gap-3 mt-5 justify-end border-t border-gray-100 pt-4 sticky bottom-0 bg-white pb-2">
          <button onClick={() => setModal(null)} className="btn-outline px-6">Hủy</button>
          <button onClick={save} disabled={saving} className="btn-teal px-8 shadow-md">
            {saving ? 'Đang lưu...' : editing ? 'Cập nhật' : 'Thêm lớp học'}
          </button>
        </div>
      </Modal>

      {/* Modal: Thêm học sinh vào lớp */}
      <Modal
        open={modal === 'add_student'}
        onClose={() => setModal(null)}
        title={`Thêm học sinh – Lớp ${currentClass?.class_name}`}
        size="2xl"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Nhập tên hoặc mã học sinh để tìm kiếm..."
              value={rightSearch}
              onChange={e => setRightSearch(e.target.value)}
              className="input pl-9 w-full text-sm"
            />
          </div>

          <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
            {filteredAllStudents.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-12">Không tìm thấy học sinh nào khả dụng</p>
            ) : (
              filteredAllStudents.map(s => {
                const studentClasses = enrollments
                  .filter(e => e.student_id === s.id && e.status === 'active')
                  .map(e => classes.find(c => c.id === e.class_id))
                  .filter(Boolean)

                const initials = s.full_name
                  ?.split(' ')
                  .slice(-2)
                  .map((w: string) => w[0])
                  .join('')
                  .toUpperCase() || 'HS'

                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between bg-white border border-gray-200 hover:border-teal-300 rounded-2xl p-4 shadow-sm hover:shadow transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      {s.avatar_url ? (
                        <img
                          src={s.avatar_url}
                          alt={s.full_name}
                          className="w-10 h-10 rounded-full object-cover border border-teal-100 shrink-0 shadow-sm"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center text-white text-xs font-black shrink-0 shadow-sm">
                          {initials}
                        </div>
                      )}
                      
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-sm text-gray-800 truncate">{s.full_name}</p>
                          <span className="text-[9px] text-gray-400 font-mono bg-gray-100 px-1 py-0.5 rounded shrink-0">
                            {s.student_code}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {s.school || 'Không rõ trường'} • Khối {s.grade || '—'}
                        </p>
                        
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {studentClasses.length === 0 ? (
                            <span className="text-[9px] text-gray-400 italic">Chưa học lớp nào</span>
                          ) : (
                            studentClasses.map(sc => (
                              <span
                                key={sc.id}
                                className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border bg-gray-50 text-gray-600 border-gray-200"
                              >
                                {sc.class_name}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        await enroll(s.id, currentClass.id)
                        toast.success(`Đã thêm ${s.full_name} vào lớp`)
                      }}
                      className="text-xs btn-teal py-1.5 px-3 shadow-sm font-bold flex items-center gap-1.5 shrink-0"
                    >
                      <UserPlus className="w-3.5 h-3.5" /> Thêm vào lớp
                    </button>
                  </div>
                )
              })
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
          void fetchClassStats()
        }}
      />
    </div>
  )
}
