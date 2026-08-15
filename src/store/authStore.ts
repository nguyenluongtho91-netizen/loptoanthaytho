import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile, Role } from '@/types'

interface AuthState {
  user: User | null
  profile: Profile | null
  loading: boolean

  init: () => Promise<void>
  fetchProfile: (user: User) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>

  isAdmin: () => boolean
  isTeacher: () => boolean
  isTA: () => boolean
  role: () => Role | undefined
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user:    null,
  profile: null,
  loading: true,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await get().fetchProfile(session.user)
    } else {
      set({ loading: false })
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await get().fetchProfile(session.user)
      } else {
        set({ user: null, profile: null, loading: false })
      }
    })
  },

  fetchProfile: async (user: User) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    set({ user, profile: data as Profile | null, loading: false })
  },

  login: async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },

  isAdmin:   () => get().profile?.role === 'ADMIN',
  isTeacher: () => ['ADMIN', 'TEACHER'].includes(get().profile?.role ?? ''),
  isTA:      () => ['ADMIN', 'TA'].includes(get().profile?.role ?? ''),
  role:      () => get().profile?.role,
}))
