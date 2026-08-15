// @ts-nocheck
import { useState, useEffect, useCallback } from 'react'
import { UserCog, Plus, RefreshCw, CheckCircle2, ShieldAlert, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { roleLabel } from '@/lib/helpers'
import type { Role } from '@/types'
import Modal from '@/components/Modal'
import toast from 'react-hot-toast'

const roleColor: Record<Role, string> = {
  ADMIN:   'bg-red-100 text-red-700 border-red-200',
  TEACHER: 'bg-teal-100 text-teal-700 border-teal-200',
  TA:      'bg-blue-100 text-blue-700 border-blue-200',
}

const EMPTY_FORM = { email: '', password: '', name: '', role: 'TEACHER' as Role }

export default function UserMgmt() {
  // ✅ Dùng local state thay vì store → không phụ thuộc Zustand, không bao giờ treo
  const [profiles, setProfiles] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [creating, setCreating]   = useState(false)

  // ✅ Fetch trực tiếp từ Supabase, không qua store
  const fetchProfiles = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      setProfiles(data || [])
    } catch (e: any) {
      toast.error('Không tải được danh sách người dùng: ' + e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  // ── Cập nhật vai trò ──────────────────────────────────────────────────────
  const setRole = async (id: string, role: Role) => {
    setSaving(id)
    try {
      const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
      if (error) throw error
      // ✅ Cập nhật local state ngay, không cần fetch lại
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, role } : p))
      toast.success('Đã cập nhật vai trò!')
    } catch (e: any) {
      toast.error(e.message || 'Lỗi cập nhật vai trò')
    } finally {
      setSaving(null)
    }
  }

  // ── Khóa / Bật tài khoản ─────────────────────────────────────────────────
  const toggleActive = async (id: string, active: boolean) => {
    setSaving(id)
    try {
      const { error } = await supabase.from('profiles').update({ active: !active }).eq('id', id)
      if (error) throw error
      // ✅ Cập nhật local state ngay
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, active: !active } : p))
      toast.success(!active ? 'Đã kích hoạt tài khoản!' : 'Đã khóa tài khoản!')
    } catch (e: any) {
      toast.error(e.message || 'Lỗi thao tác tài khoản')
    } finally {
      setSaving(null)
    }
  }

  // ── Xóa người dùng ───────────────────────────────────────────────────────
  const handleDeleteUser = async (id: string, name: string, email: string) => {
    if (!window.confirm(`Xóa vĩnh viễn người dùng:\n${name || email}?\n\nHành động không thể hoàn tác!`)) return
    setSaving(id)
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', id)
      if (error) throw error
      // ✅ Xóa khỏi local state ngay
      setProfiles(prev => prev.filter(p => p.id !== id))
      toast.success('Đã xóa người dùng!')
    } catch (e: any) {
      toast.error(e.message || 'Lỗi xóa người dùng')
    } finally {
      setSaving(null)
    }
  }

  // ── Tạo người dùng mới ───────────────────────────────────────────────────
  const handleCreateUser = async () => {
    if (!form.email || !form.password || !form.name)
      return toast.error('Vui lòng nhập đầy đủ Email, Mật khẩu và Tên')
    if (form.password.length < 6)
      return toast.error('Mật khẩu phải từ 6 ký tự trở lên')

    setCreating(true)
    try {
      const res  = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error || 'Tạo người dùng thất bại')

      toast.success('🎉 Đã tạo người dùng thành công!')
      setModalOpen(false)
      setForm(EMPTY_FORM)
      // Fetch lại để lấy user mới (vì cần ID từ Supabase Auth)
      fetchProfiles()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-start">
        <div>
          <h1 className="section-title flex items-center gap-2">
            <UserCog className="w-7 h-7 text-teal-600" /> Quản lý người dùng
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchProfiles} className="p-2 text-teal-600 hover:bg-teal-50 rounded-lg border border-teal-100 transition" title="Tải lại danh sách">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setModalOpen(true)} className="btn-teal flex items-center gap-2 shadow-lg">
            <Plus className="w-4 h-4" /> Thêm người dùng
          </button>
        </div>
      </div>

      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-800 flex items-center gap-2 shadow-sm">
        <ShieldAlert className="w-5 h-5 text-teal-600 shrink-0" />
        <p><strong>Hướng dẫn:</strong> Quản trị viên (Admin) có toàn quyền tạo mới, phân quyền, Khóa/Bật và Xóa tài khoản của các giáo viên khác trong hệ thống.</p>
      </div>

      <div className="card overflow-hidden shadow-xl border-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'linear-gradient(135deg,#0d9488,#0f766e)' }}>
                {['Email','Họ và Tên','Vai trò','Trạng thái','Phân quyền','Thao tác'].map(h => (
                  <th key={h} className="px-5 py-4 text-left text-white font-bold text-xs uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-teal-500 mx-auto" />
                </td></tr>
              ) : profiles.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400 font-medium">Chưa có người dùng nào</td></tr>
              ) : profiles.map((p, i) => (
                <tr key={p.id} className={`hover:bg-teal-50/50 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                  <td className="px-5 py-4 text-gray-800 font-medium">{p.email}</td>
                  <td className="px-5 py-4 font-bold text-teal-900 whitespace-nowrap">{p.name ?? '—'}</td>
                  <td className="px-5 py-4">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wide border whitespace-nowrap ${roleColor[p.role] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {roleLabel[p.role] ?? p.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {p.active ? (
                      <div className="flex items-center gap-1.5 text-emerald-600 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full w-max text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Hoạt động
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-red-600 font-bold bg-red-50 border border-red-200 px-3 py-1 rounded-full w-max text-xs">
                        <ShieldAlert className="w-3.5 h-3.5" /> Đã tắt
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <select
                      value={p.role ?? 'TEACHER'}
                      onChange={e => { void setRole(p.id, e.target.value as Role) }}
                      disabled={saving === p.id}
                      className="w-full max-w-[140px] border border-gray-300 rounded-lg px-3 py-1.5 outline-none focus:border-teal-500 text-xs font-semibold text-gray-700 bg-white disabled:opacity-50 cursor-pointer"
                    >
                      <option value="ADMIN">Quản trị viên</option>
                      <option value="TEACHER">Giáo viên</option>
                      <option value="TA">Trợ giảng</option>
                    </select>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { void toggleActive(p.id, p.active) }}
                        disabled={saving === p.id}
                        className={`text-xs px-4 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap shadow-sm border flex items-center justify-center min-w-[80px] ${
                          p.active
                            ? 'bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300'
                            : 'bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600'
                        } disabled:opacity-50`}
                      >
                        {saving === p.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : (p.active ? 'Khóa User' : 'Bật User')}
                      </button>
                      <button
                        onClick={() => { void handleDeleteUser(p.id, p.name, p.email) }}
                        disabled={saving === p.id}
                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 p-1.5 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                        title="Xóa vĩnh viễn"
                      >
                        {saving === p.id ? <RefreshCw className="w-4 h-4 animate-spin text-red-400" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Thêm người dùng mới" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Họ và tên *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="VD: Cô Cẩm Vi"
              className="w-full border border-gray-300 rounded-xl p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Địa chỉ Email *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="example@gmail.com"
              className="w-full border border-gray-300 rounded-xl p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Mật khẩu khởi tạo *</label>
            <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Ít nhất 6 ký tự"
              className="w-full border border-gray-300 rounded-xl p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all font-medium" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Cấp quyền (Vai trò)</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
              className="w-full border border-gray-300 rounded-xl p-3 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all font-bold text-teal-700 cursor-pointer">
              <option value="TEACHER">Giáo viên</option>
              <option value="TA">Trợ giảng</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
          </div>
          <div className="flex gap-3 mt-6 justify-end border-t border-gray-100 pt-5">
            <button onClick={() => setModalOpen(false)} className="btn-outline px-6 py-2.5 rounded-xl font-bold">Hủy</button>
            <button onClick={() => { void handleCreateUser() }} disabled={creating}
              className="btn-teal px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg">
              {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {creating ? 'Đang tạo...' : 'Tạo tài khoản'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
