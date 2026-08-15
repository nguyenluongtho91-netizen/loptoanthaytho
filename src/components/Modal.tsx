import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl'
}

const sizeClass: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-4xl',
  '3xl': 'max-w-6xl',
}

export default function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!open) return null

  return (
    // ĐỔI 1: Thay items-center thành items-start
    // ĐỔI 2: Thêm pt-12 (cách mép trên ~48px) và pb-12 (cách mép dưới) để luôn có khoảng thở
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-12 pb-12 sm:px-6">
      
      {/* Lớp nền đen mờ (đổi absolute thành fixed để bám chặt màn hình) */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* KHUNG MODAL */}
      <div 
        className={`relative flex flex-col bg-white rounded-2xl shadow-2xl w-full ${sizeClass[size]} overflow-hidden`}
        // ĐỔI 3: Ép chiều cao tối đa bằng 100% màn hình trừ đi phần khoảng hở trên/dưới (6rem tương đương pt-12 + pb-12)
        style={{ maxHeight: 'calc(100vh - 6rem)' }}
      >
        {/* HEADER: Luôn cố định */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 bg-gradient-to-r from-teal-600 to-teal-500">
          <h2 className="text-white font-bold text-lg">{title}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/20 rounded-lg p-1.5 transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY (Nội dung form): Chiếm không gian còn lại và tự sinh thanh cuộn bên trong */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </div>
      </div>
      
    </div>
  )
}
