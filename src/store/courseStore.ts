import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface CourseState {
  courses: any[];
  loading: boolean;
  loadCourses: () => Promise<void>;
  createCourse: (course: any) => Promise<any>;
  updateCourse: (id: string, updates: any) => Promise<void>;
  deleteCourse: (id: string) => Promise<void>; // ✅ Hàm xóa khóa học
  addChapter: (chapter: any) => Promise<void>;
  updateChapter: (id: string, updates: any) => Promise<void>;
  deleteChapter: (id: string) => Promise<void>; // ✅ Hàm xóa chương
  addLesson: (lesson: any) => Promise<void>;
  updateLesson: (id: string, updates: any) => Promise<void>;
  deleteLesson: (id: string) => Promise<void>; // ✅ Hàm xóa bài học
}

export const useCourseStore = create<CourseState>((set, get) => ({
  courses: [],
  loading: false,

  loadCourses: async () => {
    set({ loading: true })
    const { data, error } = await supabase.from('courses').select('*, chapters(*, lessons(*))').order('created_at')
    if (error) console.error("Lỗi tải khóa học:", error)
    set({ courses: data || [], loading: false })
  },

  createCourse: async (course: any) => {
    const { data, error } = await supabase.from('courses').insert(course).select().single()
    if (error) throw error;
    await get().loadCourses()
    return data
  },

  updateCourse: async (id: string, updates: any) => {
    const { error } = await supabase.from('courses').update(updates).eq('id', id)
    if (error) throw error;
    await get().loadCourses()
  },

  deleteCourse: async (id: string) => {
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) throw error;
    await get().loadCourses()
  },

  addChapter: async (chapter: any) => {
    const { error } = await supabase.from('chapters').insert(chapter)
    if (error) throw error;
    await get().loadCourses()
  },

  updateChapter: async (id: string, updates: any) => {
    const { error } = await supabase.from('chapters').update(updates).eq('id', id)
    if (error) throw error;
    await get().loadCourses()
  },

  deleteChapter: async (id: string) => {
    const { error } = await supabase.from('chapters').delete().eq('id', id)
    if (error) throw error;
    await get().loadCourses()
  },

  addLesson: async (lesson: any) => {
    const { error } = await supabase.from('lessons').insert(lesson)
    if (error) throw error;
    await get().loadCourses()
  },

  updateLesson: async (id: string, updates: any) => {
    const { error } = await supabase.from('lessons').update(updates).eq('id', id)
    if (error) throw error;
    await get().loadCourses()
  },

  deleteLesson: async (id: string) => {
    const { error } = await supabase.from('lessons').delete().eq('id', id)
    if (error) throw error;
    await get().loadCourses()
  }
}))
