import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { toTitleCase } from '@/lib/helpers'
import type {
  Class, Student, Enrollment, AttendanceRecord,
  Payment, EmailLog, Profile, AttendanceStatus,
  PaymentMethod, EmailType, TuitionNotification,
} from '@/types'

interface DataState {
  classes:     Class[]
  students:    Student[]
  enrollments: Enrollment[]
  attendance:  AttendanceRecord[]
  payments:    Payment[]
  emailLogs:   EmailLog[]
  profiles:    Profile[]
  tuitionNotifications: TuitionNotification[]

  // Classes
  loadClasses:  () => Promise<void>
  addClass:     (cls: Omit<Class, 'id' | 'created_at'>) => Promise<Class>
  updateClass:  (id: string, updates: Partial<Class>) => Promise<Class>

  // Students
  loadStudents:  () => Promise<void>
  addStudent:    (student: Omit<Student, 'id' | 'created_at'>) => Promise<Student>
  updateStudent: (id: string, updates: Partial<Student>) => Promise<Student>

  // Enrollments
  loadEnrollments: () => Promise<void>
  enroll:   (studentId: string, classId: string) => Promise<Enrollment>
  unenroll: (studentId: string, classId: string) => Promise<void>

  // Attendance
  loadAttendance:   (classId?: string, dateFrom?: string, dateTo?: string) => Promise<void>
  upsertAttendance: (rows: Array<{
    class_id: string; student_id: string; date: string
    present: boolean; late?: boolean; status: AttendanceStatus; note?: string | null
  }>) => Promise<AttendanceRecord[]>

  // Payments
  loadPayments: (classId?: string) => Promise<void>
  addPayment:   (payment: {
    student_id?: string | null; class_id?: string | null
    amount: number; method: PaymentMethod; note?: string | null; paid_at?: string
  }) => Promise<Payment>

  // Profiles
  loadProfiles:   () => Promise<void>
  updateProfile:  (id: string, updates: Partial<Profile>) => Promise<Profile>

  // Email Logs
  loadEmailLogs: () => Promise<void>
  addEmailLog:   (log: {
    student_id?: string | null; type: EmailType
    recipient: string; subject: string; status: 'sent' | 'failed'; error?: string | null
  }) => Promise<EmailLog | null>

  // Teacher assignments
  assignTeacher:        (teacherId: string, classId: string) => Promise<void>
  getClassesForTeacher:(teacherId: string) => Promise<string[]>

  // Tuition Notifications
  loadTuitionNotifications: (classId?: string) => Promise<void>
  upsertTuitionNotification: (notif: {
    student_id: string; class_id: string; course_name: string; amount: number; is_paid?: boolean
  }) => Promise<TuitionNotification>
  updateTuitionNotification: (id: string, updates: Partial<TuitionNotification>) => Promise<TuitionNotification>
}

export const useDataStore = create<DataState>((set, _get) => ({
  classes:     [],
  students:    [],
  enrollments: [],
  attendance:  [],
  payments:    [],
  emailLogs:   [],
  profiles:    [],
  tuitionNotifications: [],

  // ── Classes ───────────────────────────────────────────────────────────────
  loadClasses: async () => {
    const { data } = await supabase.from('classes').select('*').order('created_at', { ascending: false })
    set({ classes: (data ?? []) as Class[] })
  },

  addClass: async (cls) => {
    const { data, error } = await supabase.from('classes').insert([cls]).select().single()
    if (error) throw error
    const row = data as Class
    set(s => ({ classes: [row, ...s.classes] }))
    return row
  },

  updateClass: async (id, updates) => {
    const { data, error } = await supabase.from('classes').update(updates).eq('id', id).select().single()
    if (error) throw error
    const row = data as Class
    set(s => ({ classes: s.classes.map(c => c.id === id ? row : c) }))
    return row
  },

  // ── Students ──────────────────────────────────────────────────────────────
  loadStudents: async () => {
    const { data } = await supabase.from('students').select('*').order('full_name')
    set({ students: (data ?? []) as Student[] })
  },

  addStudent: async (student) => {
    const studentWithFormattedName = {
      ...student,
      full_name: toTitleCase(student.full_name)
    }
    const { data, error } = await supabase.from('students').insert([studentWithFormattedName]).select().single()
    if (error) throw error
    const row = data as Student
    set(s => ({ students: [row, ...s.students] }))
    return row
  },

  updateStudent: async (id, updates) => {
    const formattedUpdates = { ...updates }
    if (formattedUpdates.full_name !== undefined) {
      formattedUpdates.full_name = toTitleCase(formattedUpdates.full_name)
    }
    const { data, error } = await supabase.from('students').update(formattedUpdates).eq('id', id).select().single()
    if (error) throw error
    const row = data as Student
    set(s => ({ students: s.students.map(st => st.id === id ? row : st) }))
    return row
  },

  // ── Enrollments ───────────────────────────────────────────────────────────
  loadEnrollments: async () => {
    const { data } = await supabase.from('enrollments').select('*')
    set({ enrollments: (data ?? []) as Enrollment[] })
  },

  enroll: async (studentId, classId) => {
    // 1. Kiểm tra sự tồn tại của bản ghi cũ để tránh lỗi unique constraint của database
    const { data: existing } = await supabase.from('enrollments')
      .select('id, status')
      .eq('student_id', studentId)
      .eq('class_id', classId)
      .maybeSingle()

    let row;

    if (existing) {
      // 2. Nếu đã tồn tại bản ghi, chuyển trạng thái active và cập nhật ngày ghi danh mới nhất
      const { data, error } = await supabase.from('enrollments')
        .update({ status: 'active', enroll_date: new Date().toISOString().split('T')[0] })
        .eq('id', existing.id)
        .select().single()
      if (error) throw error
      row = data as Enrollment
    } else {
      // 3. Nếu chưa từng tồn tại, tiến hành thêm mới hoàn toàn
      const { data, error } = await supabase.from('enrollments')
        .insert([{ student_id: studentId, class_id: classId, status: 'active' }])
        .select().single()
      if (error) throw error
      row = data as Enrollment
    }

    // 4. Đồng bộ hóa mảng enrollments ngay trên bộ nhớ cục bộ giao diện (Zustand State)
    set(s => {
      const existsInState = s.enrollments.find(e => e.student_id === studentId && e.class_id === classId)
      return { 
        enrollments: existsInState 
          ? s.enrollments.map(e => e.id === row.id ? row : e) 
          : [row, ...s.enrollments] 
      }
    })
    
    return row
  },

  unenroll: async (studentId, classId) => {
    const { error } = await supabase.from('enrollments')
      .update({ status: 'inactive' })
      .eq('student_id', studentId).eq('class_id', classId)
    if (error) throw error
    set(s => ({
      enrollments: s.enrollments.map(e =>
        e.student_id === studentId && e.class_id === classId ? { ...e, status: 'inactive' as const } : e
      ),
    }))
  },

  // ── Attendance ────────────────────────────────────────────────────────────
  loadAttendance: async (classId, dateFrom, dateTo) => {
    let q = supabase.from('attendance').select('*')
    if (classId)  q = q.eq('class_id', classId)
    if (dateFrom) q = q.gte('date', dateFrom)
    if (dateTo)   q = q.lte('date', dateTo)
    const { data } = await q.order('date', { ascending: false })
    set({ attendance: (data ?? []) as AttendanceRecord[] })
  },

  upsertAttendance: async (rows) => {
    const { data, error } = await supabase.from('attendance')
      .upsert(rows, { onConflict: 'date,class_id,student_id' })
      .select()
    if (error) throw error
    const updated_rows = data as AttendanceRecord[]
    set(s => {
      const updated = [...s.attendance]
      for (const row of updated_rows) {
        const idx = updated.findIndex(a =>
          a.date === row.date && a.class_id === row.class_id && a.student_id === row.student_id
        )
        if (idx >= 0) updated[idx] = row
        else updated.unshift(row)
      }
      return { attendance: updated }
    })
    return updated_rows
  },

  // ── Payments ──────────────────────────────────────────────────────────────
  loadPayments: async (classId) => {
    let q = supabase.from('payments').select('*')
    if (classId) q = q.eq('class_id', classId)
    const { data } = await q.order('created_at', { ascending: false })
    set({ payments: (data ?? []) as Payment[] })
  },

  addPayment: async (payment) => {
    const { data, error } = await supabase.from('payments').insert([payment]).select().single()
    if (error) throw error
    const row = data as Payment
    set(s => ({ payments: [row, ...s.payments] }))
    return row
  },

  // ── Profiles ──────────────────────────────────────────────────────────────
  loadProfiles: async () => {
    const { data } = await supabase.from('profiles').select('*').order('name')
    set({ profiles: (data ?? []) as Profile[] })
  },

  updateProfile: async (id, updates) => {
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', id).select().single()
    if (error) throw error
    const row = data as Profile
    set(s => ({ profiles: s.profiles.map(p => p.id === id ? row : p) }))
    return row
  },

  // ── Email Logs ────────────────────────────────────────────────────────────
  loadEmailLogs: async () => {
    const { data } = await supabase.from('email_logs').select('*').order('created_at', { ascending: false }).limit(100)
    set({ emailLogs: (data ?? []) as EmailLog[] })
  },

  addEmailLog: async (log) => {
    const { data } = await supabase.from('email_logs').insert([log]).select().single()
    if (data) set(s => ({ emailLogs: [data as EmailLog, ...s.emailLogs] }))
    return data as EmailLog | null
  },

  // ── Teacher assignments ───────────────────────────────────────────────────
  assignTeacher: async (teacherId, classId) => {
    const { error } = await supabase.from('teacher_classes')
      .upsert([{ teacher_id: teacherId, class_id: classId, status: 'active' }],
              { onConflict: 'teacher_id,class_id' })
    if (error) throw error
  },

  getClassesForTeacher: async (teacherId) => {
    const { data } = await supabase
      .from('teacher_classes')
      .select('class_id')
      .eq('teacher_id', teacherId)
      .eq('status', 'active')
    return ((data ?? []) as Array<{ class_id: string }>).map(r => r.class_id)
  },

  // ── Tuition Notifications ──────────────────────────────────────────────────
  loadTuitionNotifications: async (classId) => {
    let q = supabase.from('tuition_notifications').select('*')
    if (classId) q = q.eq('class_id', classId)
    const { data } = await q.order('created_at', { ascending: false })
    set({ tuitionNotifications: (data ?? []) as TuitionNotification[] })
  },

  upsertTuitionNotification: async (notif) => {
    const { data, error } = await supabase.from('tuition_notifications')
      .upsert([notif], { onConflict: 'student_id,class_id,course_name' })
      .select().single()
    if (error) throw error
    const row = data as TuitionNotification
    set(s => {
      const exists = s.tuitionNotifications.find(n => n.id === row.id)
      return {
        tuitionNotifications: exists
          ? s.tuitionNotifications.map(n => n.id === row.id ? row : n)
          : [row, ...s.tuitionNotifications]
      }
    })
    return row
  },

  updateTuitionNotification: async (id, updates) => {
    const { data, error } = await supabase.from('tuition_notifications')
      .update(updates).eq('id', id).select().single()
    if (error) throw error
    const row = data as TuitionNotification
    set(s => ({
      tuitionNotifications: s.tuitionNotifications.map(n => n.id === id ? row : n)
    }))
    return row
  },
}))
