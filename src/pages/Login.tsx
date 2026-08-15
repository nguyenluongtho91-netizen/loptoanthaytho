import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { GraduationCap, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading]   = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email || !password) { toast.error('Vui lòng nhập đủ thông tin'); return }
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Đăng nhập thành công! 🎉')
      void navigate('/')
    } catch {
      toast.error('Sai email hoặc mật khẩu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #ccfbf1 0%, #5eead4 50%, #0d9488 100%)' }}
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-teal-300/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-600/20 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl border-2 border-teal-200 overflow-hidden">
          {/* Top banner */}
          <div
            className="px-8 pt-10 pb-8 text-center"
            style={{ background: 'linear-gradient(135deg, #0d9488, #14b8a6, #5eead4)' }}
          >
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg backdrop-blur-sm">
              <GraduationCap className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-white font-extrabold text-2xl tracking-wide">LỚP TOÁN THẦY LĨNH</h1>
            <p className="text-white/75 text-sm mt-1 uppercase tracking-widest text-xs font-semibold">Hệ thống quản lý trung tâm</p>
          </div>

          {/* Form */}
          <form onSubmit={(e) => { void handleSubmit(e) }} className="p-8">
            <h2 className="text-gray-800 font-extrabold text-xl mb-6 text-center">Đăng nhập</h2>

            <div className="space-y-5">
              {/* Email */}
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-teal-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="giaoviên@example.com"
                    className="input pl-10"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="label">Mật khẩu</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-teal-500" />
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="input pl-10 pr-10"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-3.5 top-3 text-teal-400 hover:text-teal-600 transition-colors"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button type="submit" disabled={loading} className="btn-teal w-full flex items-center justify-center gap-2 text-base py-3">
                {loading
                  ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <><span>Đăng nhập</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>

            <p className="mt-6 text-center text-xs text-gray-400">
              Liên hệ quản trị viên để được cấp tài khoản
            </p>
          </form>
        </div>

        <p className="text-center text-white/60 text-xs mt-4">
          © 2025 EduCenter – Powered by React + Supabase
        </p>
      </div>
    </div>
  )
}
