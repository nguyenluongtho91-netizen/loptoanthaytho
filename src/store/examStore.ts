import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface ExamState {
  exams: any[]
  loading: boolean
  loadExams: () => Promise<void>
  createExam: (examData: any, title: string) => Promise<string>
  deleteExam: (id: string) => Promise<void>
  getExamData: (id: string) => Promise<any> // ✅ THÊM HÀM NÀY
}

export const useExamStore = create<ExamState>((set, get) => ({
  exams: [],
  loading: false,

  loadExams: async () => {
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('exams')
        .select('id, title, created_at, pdfUrl:data->>pdfUrl, pdfDriveUrl:data->>pdfDriveUrl, pdfBase64:data->>pdfBase64')
        .order('created_at', { ascending: false })
      if (error) throw error
      set({ exams: data || [] })
    } finally {
      set({ loading: false })
    }
  },

  createExam: async (examData, title) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('exams').insert([{
      title: title,
      data: examData,
      created_by: user?.id
    }]).select('id').single()

    if (error) throw error
    get().loadExams()
    return data.id
  },

  deleteExam: async (id) => {
    const { error } = await supabase.from('exams').delete().eq('id', id)
    if (error) throw error
    get().loadExams()
  },

  // ✅ HÀM LẤY CHI TIẾT ĐỂ XEM TRƯỚC
  getExamData: async (id) => {
    const { data, error } = await supabase.from('exams').select('data').eq('id', id).single()
    if (error) throw error
    return data.data
  }
}))
