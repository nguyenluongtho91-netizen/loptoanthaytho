// @ts-nocheck
import { useEffect, useState, useRef } from 'react'
import { BookOpen, Plus, FileText, ChevronRight, Pencil, Check, X, Trash2, RefreshCw, Youtube, Users, Eye, EyeOff } from 'lucide-react'
import { useCourseStore } from '@/store/courseStore'
import { useExamStore } from '@/store/examStore'
import { useDataStore } from '@/store/dataStore' 
import { useAuthStore } from '@/store/authStore'
import { uploadPdfToSupabase } from '@/services/supabaseService'
import Modal from '@/components/Modal'
import toast from 'react-hot-toast'
import InteractiveVideoEditor from '@/components/InteractiveVideoEditor'

const sortLessons = (lessons: any[]) => {
  return [...lessons].sort((a, b) => {
    const getNum = (title: string) => {
      const match = title.match(/(?:buổi|buoi|bài|bai|lớp|lop)\s*(\d+)/i) || title.match(/(\d+)/)
      return match ? parseInt(match[1], 10) : Infinity
    }
    const numA = getNum(a.title || '')
    const numB = getNum(b.title || '')
    if (numA !== numB) return numA - numB
    return (a.title || '').localeCompare(b.title || '', 'vi', { numeric: true, sensitivity: 'base' })
  })
}

const getCourseGrade = (title: string) => {
  const t = (title || '').toLowerCase()
  if (t.includes('lớp 6') || t.includes('khối 6') || t.includes('toán 6') || t.includes('khối sáu') || /\b(khối\s+)?6\b/.test(t)) return 6
  if (t.includes('lớp 7') || t.includes('khối 7') || t.includes('toán 7') || t.includes('khối bảy') || /\b(khối\s+)?7\b/.test(t)) return 7
  if (t.includes('lớp 8') || t.includes('khối 8') || t.includes('toán 8') || t.includes('khối tám') || /\b(khối\s+)?8\b/.test(t)) return 8
  if (t.includes('lớp 9') || t.includes('khối 9') || t.includes('toán 9') || t.includes('khối chín') || /\b(khối\s+)?9\b/.test(t)) return 9
  return null
}

export default function CourseMgmt() {
  const { 
    courses, loadCourses, createCourse, updateCourse, deleteCourse,
    addChapter, updateChapter, deleteChapter,
    addLesson, updateLesson, deleteLesson 
  } = useCourseStore() as any;
  
  const { exams, loadExams } = useExamStore() as any;
  const { classes, loadClasses } = useDataStore() as any; 
  const { user, isAdmin } = useAuthStore() as any; 
  
  const [modalOpen, setModalOpen] = useState(false)
  const [newCourseTitle, setNewCourseTitle] = useState('')
  const [editState, setEditState] = useState<{ id: string, type: 'course'|'chapter'|'lesson', title: string } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLessonId, setUploadingLessonId] = useState<string | null>(null);
  const [attachExamLesson, setAttachExamLesson] = useState<any>(null);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [isRefreshingExams, setIsRefreshingExams] = useState(false);

  const [attachVideoLesson, setAttachVideoLesson] = useState<any>(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [editingVideoLesson, setEditingVideoLesson] = useState<any>(null);

  const [assigningCourse, setAssigningCourse] = useState<any>(null);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  const [activeGrade, setActiveGrade] = useState<number | 'others'>(() => {
    const saved = sessionStorage.getItem('course_mgmt_active_grade')
    if (saved) {
      return saved === 'others' ? 'others' : Number(saved)
    }
    return 9
  })

  // Lưu activeGrade vào sessionStorage khi thay đổi
  useEffect(() => {
    sessionStorage.setItem('course_mgmt_active_grade', activeGrade.toString())
  }, [activeGrade])

  useEffect(() => {
    if (courses && courses.length > 0) {
      const availableGrades = [9, 8, 7, 6].filter(g => 
        courses.some((c: any) => getCourseGrade(c.title) === g)
      )
      
      const saved = sessionStorage.getItem('course_mgmt_active_grade')
      if (saved) {
        const savedVal = saved === 'others' ? 'others' : Number(saved)
        const isValid = savedVal === 'others'
          ? courses.some((c: any) => getCourseGrade(c.title) === null)
          : availableGrades.includes(savedVal)
        if (isValid) {
          setActiveGrade(savedVal)
          return
        }
      }

      if (availableGrades.length > 0) {
        setActiveGrade(availableGrades[0])
      } else if (courses.some((c: any) => getCourseGrade(c.title) === null)) {
        setActiveGrade('others')
      }
    }
  }, [courses])

  useEffect(() => {
    if (loadCourses) loadCourses()
    if (loadExams) loadExams()
    if (loadClasses) loadClasses() 
  }, [loadCourses, loadExams, loadClasses])

  const handleCreateCourse = async () => {
    if (!newCourseTitle.trim()) return toast.error('Vui lòng nhập tên khóa học')
    try {
      // Mặc định khóa học mới sẽ là bản nháp (is_published = false)
      await createCourse({ title: newCourseTitle, description: 'Khóa học mới tạo', teacher_id: user?.id, is_published: false })
      toast.success('Đã tạo khóa học thành công!')
      setModalOpen(false)
      setNewCourseTitle('')
    } catch (error: any) { toast.error('Lỗi tạo khóa học!') }
  }

  const handleDeleteCourse = async (id: string, title: string) => {
    if (!confirm(`Xóa khóa học "${title}"? Toàn bộ dữ liệu sẽ mất.`)) return;
    try { await deleteCourse(id); toast.success('Đã xóa!'); } catch (e) { toast.error('Lỗi xóa khóa học!'); }
  }

  // ✅ HÀM BẬT/TẮT TRẠNG THÁI XUẤT BẢN
  const handleTogglePublish = async (course: any) => {
    const newStatus = !course.is_published;
    try {
      await updateCourse(course.id, { is_published: newStatus });
      toast.success(newStatus ? 'Đã XUẤT BẢN khóa học!' : 'Đã chuyển về BẢN NHÁP!');
    } catch (err) {
      toast.error('Lỗi cập nhật trạng thái!');
    }
  }

  const handleSaveAssignClasses = async () => {
    if (!assigningCourse) return;
    try {
      await updateCourse(assigningCourse.id, { assigned_class_ids: selectedClassIds });
      toast.success('Đã cập nhật danh sách lớp được học!');
      setAssigningCourse(null);
    } catch (err) { toast.error('Lỗi cập nhật lớp học!'); }
  }

  const handleAddChapter = async (courseId: string) => {
    try { await addChapter({ course_id: courseId, title: 'Chương mới', order_index: 1 }); toast.success('Đã thêm chương!'); } catch (e) { toast.error('Lỗi thêm chương!'); }
  }

  const handleDeleteChapter = async (id: string, title: string) => {
    if (!confirm(`Xóa chương "${title}"?`)) return;
    try { await deleteChapter(id); toast.success('Đã xóa!'); } catch (e) { toast.error('Lỗi!'); }
  }

  const handleAddLesson = async (chapterId: string) => {
    try { await addLesson({ chapter_id: chapterId, title: 'Bài học mới', order_index: 1 }); toast.success('Đã thêm bài học!'); } catch (e) { toast.error('Lỗi!'); }
  }

  const handleDeleteLesson = async (id: string, title: string) => {
    if (!confirm(`Xóa bài học "${title}"?`)) return;
    try { await deleteLesson(id); toast.success('Đã xóa!'); } catch (e) { toast.error('Lỗi!'); }
  }

  const handleSaveEdit = async () => {
    if (!editState || !editState.title.trim()) { setEditState(null); return; }
    try {
      if (editState.type === 'course') await updateCourse(editState.id, { title: editState.title });
      else if (editState.type === 'chapter') await updateChapter(editState.id, { title: editState.title });
      else if (editState.type === 'lesson') await updateLesson(editState.id, { title: editState.title });
      toast.success('Đã cập nhật tên!');
    } catch (err) { toast.error('Lỗi!'); } finally { setEditState(null); }
  }

  const handleTriggerUpload = (lessonId: string) => {
    setUploadingLessonId(lessonId);
    fileInputRef.current?.click();
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingLessonId) return;
    const toastId = toast.loading('Đang upload...');
    try {
      const base64 = await fileToBase64(file);
      const result = await uploadPdfToSupabase(base64, file.name);

      // Tìm bài học hiện tại để lấy danh sách PDF đã có
      let currentPdfs = [];
      for (const c of courses || []) {
        for (const ch of c.chapters || []) {
          for (const l of ch.lessons || []) {
            if (l.id === uploadingLessonId) {
              currentPdfs = l.pdf_list || (l.pdf_url ? [{ name: 'Tài liệu PDF', url: l.pdf_url }] : []);
              break;
            }
          }
        }
      }

      const newPdfList = [...currentPdfs, { name: file.name, url: result.fileUrl }];

      await updateLesson(uploadingLessonId, { 
        pdf_list: newPdfList,
        pdf_url: newPdfList[0]?.url || null // Tương thích ngược
      });
      toast.success('Upload thành công!', { id: toastId });
    } catch(err: any) { 
      toast.error(`Lỗi upload: ${err.message || 'Không rõ nguyên nhân'}`, { id: toastId }); 
      console.error(err);
    } 
    finally { setUploadingLessonId(null); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }

  const handleRefreshExams = async () => {
    setIsRefreshingExams(true);
    await loadExams();
    setIsRefreshingExams(false);
    toast.success('Đã làm mới!');
  }

  const handleSaveAttachExam = async () => {
    if (!attachExamLesson || !selectedExamId) return toast.error('Chọn một đề thi!');
    try {
      const currentExamIds = attachExamLesson.exam_ids || (attachExamLesson.exam_id ? [attachExamLesson.exam_id] : []);
      if (currentExamIds.includes(selectedExamId)) {
        return toast.error('Bài tập này đã được gắn rồi!');
      }
      const newExamIds = [...currentExamIds, selectedExamId];
      await updateLesson(attachExamLesson.id, { 
        exam_ids: newExamIds,
        exam_id: newExamIds[0] // tương thích ngược
      });
      toast.success('Gắn thành công!');
      setAttachExamLesson(null); setSelectedExamId('');
    } catch(err) { toast.error('Lỗi gắn bài tập!'); }
  }

  const handleSaveVideo = async () => {
    if (!videoUrl) return toast.error('Nhập link YouTube!');
    try {
      await updateLesson(attachVideoLesson.id, { video_url: videoUrl });
      toast.success('Gắn Video thành công!');
      setAttachVideoLesson(null); setVideoUrl('');
    } catch(err) { toast.error('Lỗi!'); }
  }

  const myClasses = isAdmin() ? classes : classes.filter((c: any) => c.teacher_id === user?.id);
  const myCourses = isAdmin() ? courses : courses?.filter((c: any) => c.teacher_id === user?.id);

  const displayedCourses = myCourses?.filter((course: any) => {
    const g = getCourseGrade(course.title)
    if (activeGrade === 'others') {
      return g === null
    }
    return g === activeGrade
  })

  return (
    <div className="space-y-6">
      <input type="file" accept=".pdf" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

      <div className="flex justify-between items-center">
        <h1 className="section-title flex items-center gap-2">
          <BookOpen className="w-7 h-7 text-teal-600" /> Quản lý Khóa học
        </h1>
        <button onClick={() => setModalOpen(true)} className="btn-teal flex items-center gap-2">
          <Plus className="w-4 h-4" /> Tạo khóa học mới
        </button>
      </div>

      {/* Grade Selector horizontal list */}
      <div className="flex flex-wrap gap-3">
        {[6, 7, 8, 9, 'others'].map((grade) => {
          const isOther = grade === 'others'
          const label = isOther ? 'Khác' : `Khối ${grade}`
          const isActive = activeGrade === grade
          
          const count = myCourses?.filter(c => {
            const g = getCourseGrade(c.title)
            return isOther ? (g === null) : (g === grade)
          }).length || 0

          if (isOther && count === 0) return null

          return (
            <button
              key={grade}
              onClick={() => setActiveGrade(grade as any)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border-2 font-bold text-sm transition-all shadow-sm ${
                isActive
                  ? 'bg-teal-600 border-teal-600 text-white shadow-md shadow-teal-500/10'
                  : 'bg-white border-teal-100 text-gray-700 hover:border-teal-300 hover:bg-teal-50/10'
              }`}
            >
              {label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-extrabold ${
                isActive ? 'bg-teal-700/50 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {displayedCourses?.map((course: any) => (
          <div key={course.id} className={`card p-6 border-l-4 ${course.is_published ? 'border-teal-500' : 'border-gray-400 bg-gray-50/50'}`}>
            <div className="flex justify-between items-start mb-6">
              <div className="flex-1">
                {editState?.id === course.id && editState.type === 'course' ? (
                  <div className="flex items-center gap-2 mb-1">
                    <input autoFocus value={editState.title} onChange={(e) => setEditState({ ...editState, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()} className="text-xl font-bold text-gray-800 border-b-2 border-teal-500 outline-none bg-transparent px-1 w-full max-w-md" />
                    <button onClick={handleSaveEdit} className="text-green-600 p-1 hover:bg-green-50 rounded"><Check className="w-5 h-5"/></button>
                    <button onClick={() => setEditState(null)} className="text-gray-400 p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5"/></button>
                  </div>
                ) : (
                  <div className="flex items-center flex-wrap gap-3 group">
                    <h2 className="text-xl font-bold text-gray-800">{course.title}</h2>
                    
                    {/* ✅ NÚT CÔNG TẮC XUẤT BẢN */}
                    <button 
                      onClick={() => handleTogglePublish(course)} 
                      className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg border transition shadow-sm ml-2 ${
                        course.is_published 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                        : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {course.is_published ? <><Eye className="w-3.5 h-3.5"/> Đã xuất bản</> : <><EyeOff className="w-3.5 h-3.5"/> Bản nháp</>}
                    </button>

                    <button onClick={() => { setAssigningCourse(course); setSelectedClassIds(course.assigned_class_ids || []); }} className="flex items-center gap-1.5 px-3 py-1 bg-teal-50 text-teal-700 text-xs font-bold rounded-lg border border-teal-200 hover:bg-teal-100 transition shadow-sm">
                      <Users className="w-3.5 h-3.5" /> 
                      {course.assigned_class_ids?.length > 0 ? `Đã giao cho ${course.assigned_class_ids.length} lớp` : 'Chưa giao lớp nào'}
                    </button>

                    <button onClick={() => setEditState({ id: course.id, type: 'course', title: course.title })} className="text-gray-400 hover:text-teal-600 opacity-0 group-hover:opacity-100 transition"><Pencil className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteCourse(course.id, course.title)} className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-4 h-4" /></button>
                  </div>
                )}
                <p className="text-gray-500 text-sm mt-2">{course.description}</p>
              </div>
            </div>

            <div className="space-y-4">
              {course.chapters?.sort((a:any, b:any) => a.order_index - b.order_index).map((chapter: any) => (
                <div key={chapter.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-3 group">
                    {editState?.id === chapter.id && editState.type === 'chapter' ? (
                      <div className="flex items-center gap-2 flex-1">
                        <ChevronRight className="w-4 h-4 text-teal-700" />
                        <input autoFocus value={editState.title} onChange={(e) => setEditState({ ...editState, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()} className="font-bold text-teal-700 border-b border-teal-500 outline-none bg-transparent px-1 flex-1 max-w-sm" />
                        <button onClick={handleSaveEdit} className="text-green-600 p-1"><Check className="w-4 h-4"/></button>
                        <button onClick={() => setEditState(null)} className="text-gray-400 p-1"><X className="w-4 h-4"/></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 font-bold text-teal-700">
                        <ChevronRight className="w-4 h-4" /> {chapter.title}
                        <button onClick={() => setEditState({ id: chapter.id, type: 'chapter', title: chapter.title })} className="text-gray-400 hover:text-teal-600 opacity-0 group-hover:opacity-100 transition ml-2"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => handleDeleteChapter(chapter.id, chapter.title)} className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>

                  <div className="pl-6 space-y-2">
                    {sortLessons(chapter.lessons || []).map((lesson: any) => (
                      <div key={lesson.id} className="flex flex-col bg-white p-3 rounded-lg border border-gray-100 shadow-sm group">
                        <div className="flex items-center justify-between">
                          {editState?.id === lesson.id && editState.type === 'lesson' ? (
                            <div className="flex items-center gap-2 flex-1">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <input autoFocus value={editState.title} onChange={(e) => setEditState({ ...editState, title: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()} className="text-sm font-medium border-b border-teal-500 outline-none bg-transparent px-1 flex-1 max-w-sm" />
                              <button onClick={handleSaveEdit} className="text-green-600 p-1"><Check className="w-4 h-4"/></button>
                              <button onClick={() => setEditState(null)} className="text-gray-400 p-1"><X className="w-4 h-4"/></button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <span className="text-sm font-medium">{lesson.title}</span>
                              <button onClick={() => setEditState({ id: lesson.id, type: 'lesson', title: lesson.title })} className="text-gray-400 hover:text-teal-600 opacity-0 group-hover:opacity-100 transition"><Pencil className="w-3.5 h-3.5" /></button>
                              <button onClick={() => handleDeleteLesson(lesson.id, lesson.title)} className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-gray-400 flex flex-wrap gap-4 mt-2 ml-7 items-center">
                           {/* Hiển thị danh sách các tệp PDF đã tải lên */}
                           <div className="flex flex-wrap items-center gap-2">
                             {(() => {
                               const currentPdfs = lesson.pdf_list || (lesson.pdf_url ? [{ name: 'Tài liệu PDF', url: lesson.pdf_url }] : []);
                               return (
                                 <>
                                   {currentPdfs.map((pdf: any, idx: number) => (
                                     <div key={idx} className="flex items-center gap-1 bg-teal-50 text-teal-700 px-2 py-0.5 rounded border border-teal-100 font-medium text-[11px]">
                                       📄 <a href={pdf.url} target="_blank" rel="noreferrer" className="hover:underline max-w-[120px] truncate" title={pdf.name}>{pdf.name}</a>
                                       <button 
                                         onClick={async () => {
                                           if (!confirm(`Bạn có chắc muốn gỡ tài liệu "${pdf.name}"?`)) return;
                                           const newPdfList = currentPdfs.filter((_: any, i: number) => i !== idx);
                                           await updateLesson(lesson.id, { 
                                             pdf_list: newPdfList,
                                             pdf_url: newPdfList[0]?.url || null
                                           });
                                           toast.success('Đã gỡ tài liệu!');
                                         }} 
                                         className="text-red-400 hover:text-red-600 ml-1 font-bold text-[10px]"
                                         title="Gỡ tài liệu"
                                       >
                                         ✕
                                       </button>
                                     </div>
                                   ))}
                                   <button 
                                     onClick={() => handleTriggerUpload(lesson.id)} 
                                     disabled={uploadingLessonId === lesson.id} 
                                     className="text-teal-600 hover:text-teal-800 hover:underline font-bold text-[11px] flex items-center gap-0.5 ml-1"
                                   >
                                     {uploadingLessonId === lesson.id ? '⏳ Đang tải...' : '+ Tải lên PDF'}
                                   </button>
                                 </>
                               );
                             })()}
                           </div>

                           {!lesson.video_url ? (
                             <button onClick={() => setAttachVideoLesson(lesson)} className="hover:text-red-600 font-medium flex items-center gap-1">
                               <Youtube className="w-3 h-3" /> Nhúng Video
                             </button>
                           ) : (
                             <div className="flex items-center gap-1 text-red-600 font-medium">
                               ✅ Có Video <button onClick={() => updateLesson(lesson.id, { video_url: null, interactive_questions: [] })} className="text-[10px] text-gray-400 hover:text-red-600">(Gỡ)</button>
                               <span onClick={() => setEditingVideoLesson(lesson)} className="ml-2 px-2 py-0.5 bg-red-100 rounded text-[10px] cursor-pointer hover:bg-red-200">⚙️ Cài đặt câu hỏi</span>
                             </div>
                           )}
                           
                           {/* Hiển thị danh sách các bài tập đã gắn */}
                           <div className="flex flex-wrap items-center gap-2">
                             {(() => {
                               const currentExamIds = lesson.exam_ids || (lesson.exam_id ? [lesson.exam_id] : []);
                               return (
                                 <>
                                   {currentExamIds.map((exId: string, idx: number) => {
                                     const examObj = exams?.find((e: any) => e.id === exId);
                                     const displayTitle = examObj?.title || `Bài tập ${idx + 1}`;
                                     return (
                                       <div key={exId} className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-100 font-medium text-[11px]">
                                         📝 {displayTitle}
                                         <button 
                                           onClick={async () => {
                                             if (!confirm(`Bạn có chắc muốn gỡ bài tập "${displayTitle}" khỏi bài học?`)) return;
                                             const newExamIds = currentExamIds.filter((id: string) => id !== exId);
                                             await updateLesson(lesson.id, { 
                                               exam_ids: newExamIds,
                                               exam_id: newExamIds[0] || null
                                             });
                                             toast.success('Đã gỡ bài tập!');
                                           }} 
                                           className="text-red-400 hover:text-red-600 ml-1 font-bold"
                                           title="Gỡ bài tập"
                                         >
                                           ✕
                                         </button>
                                       </div>
                                     );
                                   })}
                                   <button 
                                     onClick={() => {
                                       setAttachExamLesson(lesson);
                                       setSelectedExamId('');
                                     }} 
                                     className="text-blue-600 hover:text-blue-800 hover:underline font-bold text-[11px] flex items-center gap-0.5 ml-1"
                                   >
                                     + Gắn Bài tập
                                   </button>
                                 </>
                               );
                             })()}
                           </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => handleAddLesson(chapter.id)} className="text-xs text-teal-600 font-bold hover:underline mt-2 inline-block">+ Thêm bài học mới</button>
                  </div>
                </div>
              ))}
              <button onClick={() => handleAddChapter(course.id)} className="btn-outline w-full text-xs py-2">+ Thêm chương mới</button>
            </div>
          </div>
        ))}
        {(!displayedCourses || displayedCourses.length === 0) && (
          <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
            Chưa có khóa học nào thuộc {activeGrade === 'others' ? 'danh mục Khác' : `Khối ${activeGrade}`}.
          </div>
        )}
      </div>

      {/* ── MODALS ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Tạo khóa học mới">
         <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Tên khóa học</label>
              <input type="text" value={newCourseTitle} onChange={e => setNewCourseTitle(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-teal-500" placeholder="Ví dụ: Toán 9 - Học kì 1" autoFocus />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button onClick={() => setModalOpen(false)} className="btn-outline px-4 py-2">Hủy</button>
              <button onClick={handleCreateCourse} className="btn-teal px-6 py-2">Lưu khóa học</button>
            </div>
         </div>
      </Modal>

      <Modal open={!!assigningCourse} onClose={() => setAssigningCourse(null)} title="Giao khóa học cho lớp">
         <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-2">Khóa học: <strong className="text-teal-700">{assigningCourse?.title}</strong></p>
            <p className="text-xs text-gray-500 mb-4 italic">Học sinh thuộc các lớp được tích chọn dưới đây mới có thể thấy và học khóa này.</p>
            
            <div className="max-h-60 overflow-y-auto space-y-2 border border-gray-200 rounded-xl p-3 bg-gray-50">
              {myClasses?.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Bạn chưa có lớp học nào. Hãy tạo lớp trước!</p>}
              {myClasses?.map((cls: any) => {
                const isSelected = selectedClassIds.includes(cls.id);
                return (
                  <label key={cls.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${isSelected ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white hover:border-teal-300'}`}>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-teal-600 rounded cursor-pointer"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedClassIds([...selectedClassIds, cls.id]);
                        else setSelectedClassIds(selectedClassIds.filter(id => id !== cls.id));
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-bold text-gray-800 text-sm">{cls.class_name}</p>
                      <p className="text-xs text-gray-500">{cls.subject} • {cls.grade}</p>
                    </div>
                  </label>
                )
              })}
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button onClick={() => setAssigningCourse(null)} className="btn-outline px-4 py-2">Hủy</button>
              <button onClick={handleSaveAssignClasses} className="btn-teal px-6 py-2 shadow-md">Lưu cài đặt</button>
            </div>
         </div>
      </Modal>

      <Modal open={!!attachVideoLesson} onClose={() => setAttachVideoLesson(null)} title="Nhúng Video YouTube">
         <div className="space-y-4">
            <p className="text-sm text-gray-600">Bài học: <strong className="text-red-600">{attachVideoLesson?.title}</strong></p>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Link YouTube</label>
              <input type="text" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-red-500" placeholder="https://www.youtube.com/watch?v=..." autoFocus />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button onClick={() => { setAttachVideoLesson(null); setVideoUrl(''); }} className="btn-outline px-4 py-2">Hủy</button>
              <button onClick={handleSaveVideo} className="bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2 rounded-lg shadow-md flex items-center gap-2">
                <Youtube className="w-4 h-4"/> Lưu Video
              </button>
            </div>
         </div>
      </Modal>

      <Modal open={!!attachExamLesson} onClose={() => setAttachExamLesson(null)} title="Gắn bài tập cho Bài học">
         <div className="space-y-5">
            <p className="text-sm text-gray-600">Bài học: <strong className="text-teal-700">{attachExamLesson?.title}</strong></p>
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
              <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-bold text-gray-700">Chọn Đề thi từ Ngân hàng</label>
                <button onClick={handleRefreshExams} disabled={isRefreshingExams} className="text-xs text-teal-600 font-bold hover:underline flex items-center gap-1">
                  <RefreshCw className={`w-3 h-3 ${isRefreshingExams ? 'animate-spin' : ''}`} /> Làm mới
                </button>
              </div>
              <select value={selectedExamId} onChange={e => setSelectedExamId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:border-teal-500 font-semibold">
                <option value="">-- Click để chọn đề thi --</option>
                {exams?.map((ex: any) => <option key={ex.id} value={ex.id}>{ex.title}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
              <button onClick={() => { setAttachExamLesson(null); setSelectedExamId(''); }} className="btn-outline px-4 py-2">Hủy</button>
              <button onClick={handleSaveAttachExam} className="btn-teal px-6 py-2 shadow-md">Gắn bài tập</button>
            </div>
         </div>
      </Modal>

      {editingVideoLesson && (
        <InteractiveVideoEditor 
          lesson={editingVideoLesson} 
          onClose={() => setEditingVideoLesson(null)} 
          onSave={async (questions) => {
            await updateLesson(editingVideoLesson.id, { interactive_questions: questions });
            setEditingVideoLesson(null);
            toast.success('Lưu cài đặt câu hỏi thành công!');
          }} 
        />
      )}

    </div>
  )
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result?.toString().split(',')[1] || '')
    reader.readAsDataURL(file)
  })
}
