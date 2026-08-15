import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface ExamRoom {
  id: string
  code: string
  exam_id: string
  class_id: string | null
  teacher_id?: string
  status: 'waiting' | 'active' | 'closed'
  time_limit: number
  created_at: string
  settings?: any // ✅ Thêm trường này để lưu cấu hình
  exams?: { title: string }
  classes?: { class_name: string } 
  exam_submissions?: Array<{ id: string }>
}

interface ExamRoomState {
  rooms: ExamRoom[]
  loading: boolean
  loadRooms: () => Promise<void>
  createRoom: (roomData: Partial<ExamRoom>) => Promise<void>
  updateRoomStatus: (id: string, status: string) => Promise<void>
  updateRoom: (id: string, roomData: Partial<ExamRoom>) => Promise<void>
  deleteRoom: (id: string) => Promise<void>
}

const generateRoomCode = () => Math.random().toString(36).substring(2, 7).toUpperCase()

export const useExamRoomStore = create<ExamRoomState>((set, get) => ({
  rooms: [],
  loading: false,

  loadRooms: async () => {
    set({ loading: true })
    try {
      const { data, error } = await supabase
        .from('exam_rooms')
        .select(`
          *,
          exams ( title ),
          classes ( class_name ),
          exam_submissions ( id )
        `)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      set({ rooms: data as ExamRoom[] })
    } finally {
      set({ loading: false })
    }
  },

  createRoom: async (roomData) => {
    let code = generateRoomCode()
    const { data: { user } } = await supabase.auth.getUser() 
    
    const { error } = await supabase.from('exam_rooms').insert([{
      ...roomData, // ✅ Lúc này roomData đã có sẵn settings bên trong
      code,
      teacher_id: user?.id
    }])

    if (error) {
      console.error('Lỗi tạo phòng:', error)
      throw error
    }
    
    await get().loadRooms() 
  },

  updateRoomStatus: async (id, status) => {
    const { error } = await supabase.from('exam_rooms').update({ status }).eq('id', id)
    if (error) throw error
    await get().loadRooms()
  },

  updateRoom: async (id, roomData) => {
    const { error } = await supabase.from('exam_rooms').update(roomData).eq('id', id)
    if (error) throw error
    await get().loadRooms()
  },

  deleteRoom: async (id) => {
    const { error } = await supabase.from('exam_rooms').delete().eq('id', id)
    if (error) throw error
    await get().loadRooms()
  }
}))
