// src/components/VietQRModal.tsx
// Hiển thị mã QR VietQR để phụ huynh chuyển khoản học phí
// Không cần API key – dùng https://img.vietqr.io miễn phí
//
// ENV cần thêm vào .env:
//   VITE_BANK_ID=MB           ← mã ngân hàng (MB, VCB, TCB, ACB, BIDV, VTB...)
//   VITE_BANK_ACCOUNT=0123456789  ← số tài khoản
//   VITE_BANK_NAME=NGUYEN VAN A   ← tên chủ tài khoản (in hoa, không dấu)

import { useState, useEffect } from 'react'
import { X, Copy, CheckCircle2, RefreshCw, QrCode, Building2 } from 'lucide-react'
import { fmtVNDShort } from '@/lib/helpers'

// ─── Config từ ENV ────────────────────────────────────────────────────────────
// ✅ Đọc cả VITE_ prefix (frontend) và không prefix (Vercel server),
//    đồng thời hỗ trợ cả BANK_NAME và BANK_ACCOUNT_NAME
const BANK_ID      = import.meta.env.VITE_BANK_ID
                  || (import.meta.env as any).BANK_ID
                  || 'VBA'
const BANK_ACCOUNT = import.meta.env.VITE_BANK_ACCOUNT
                  || (import.meta.env as any).BANK_ACCOUNT
                  || '3714235000320'
const BANK_NAME    = import.meta.env.VITE_BANK_NAME
                  || import.meta.env.VITE_BANK_ACCOUNT_NAME
                  || (import.meta.env as any).BANK_ACCOUNT_NAME
                  || (import.meta.env as any).BANK_NAME
                  || 'HKD DINH CONG LINH'

// ─── Danh sách ngân hàng phổ biến (để hiện tên đẹp) ─────────────────────────
const BANK_NAMES: Record<string, string> = {
  MB: 'MB Bank', VCB: 'Vietcombank', TCB: 'Techcombank',
  ACB: 'ACB', BIDV: 'BIDV', VTB: 'VietinBank',
  TPB: 'TPBank', STB: 'Sacombank', VPB: 'VPBank',
  MSB: 'MSB', HDB: 'HDBank', OCB: 'OCB',
  SHB: 'SHB', EXIM: 'Eximbank', NAB: 'Nam A Bank',
  VBA: 'Agribank', Agribank: 'Agribank',
}

// ─── Build nội dung chuyển khoản theo format chuẩn để webhook match ──────────
//    Format: "HP {studentCode} T{month}/{year}"
//    VD: "HP HS001 T5/2026"
//    Nếu không phải dạng yyyy-MM, dùng tên khóa học dạng không dấu
function buildTransferContent(studentCode: string, courseName: string): string {
  if (/^\d{4}-\d{2}$/.test(courseName)) {
    const [y, m] = courseName.split('-')
    return `HP ${studentCode} T${parseInt(m)}/${y}`
  }
  
  const cleanCourse = courseName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
  
  return `HP ${studentCode} ${cleanCourse}`.substring(0, 25).trim()
}

// ─── Build URL ảnh QR từ VietQR (miễn phí, không cần auth) ──────────────────
function buildVietQRUrl(amount: number, content: string): string {
  const base = `https://img.vietqr.io/image/${BANK_ID}-${BANK_ACCOUNT}-compact2.png`
  const params = new URLSearchParams({
    amount:      String(amount),
    addInfo:     content,
    accountName: BANK_NAME,
  })
  return `${base}?${params.toString()}`
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface VietQRModalProps {
  open:        boolean
  onClose:     () => void
  studentName: string
  studentCode: string
  amount:      number       // số tiền cần đóng
  month:       string       // yyyy-MM
  className?:  string       // tên lớp (để hiện info)
  onConfirmManual?: (amount: number) => void  // callback khi GV xác nhận thủ công
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VietQRModal({
  open, onClose,
  studentName, studentCode, amount, month, className,
  onConfirmManual,
}: VietQRModalProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [qrLoaded, setQrLoaded] = useState(false)
  const [qrError, setQrError]   = useState(false)

  const transferContent = buildTransferContent(studentCode, month)
  const qrUrl           = buildVietQRUrl(amount, transferContent)
  
  let monthLabel = month
  if (/^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-')
    monthLabel = `tháng ${parseInt(m)}/${y}`
  }

  // Reset trạng thái khi mở modal
  useEffect(() => {
    if (open) { setQrLoaded(false); setQrError(false) }
  }, [open, qrUrl])

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  if (!open) return null

  // Kiểm tra config chưa setup
  const isNotConfigured = !BANK_ACCOUNT || BANK_ACCOUNT === '0123456789'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-white" />
            <span className="text-white font-bold">Thanh toán VietQR</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Cảnh báo chưa cấu hình */}
          {isNotConfigured && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              <p className="font-bold mb-1">⚠️ Chưa cấu hình tài khoản ngân hàng</p>
              <p className="text-xs">Thêm vào file <code className="bg-amber-100 px-1 rounded">.env</code>:</p>
              <pre className="text-xs mt-1 bg-amber-100 p-2 rounded font-mono">
{`VITE_BANK_ID=MB
VITE_BANK_ACCOUNT=0123456789
VITE_BANK_NAME=TEN CHU TK`}
              </pre>
            </div>
          )}

          {/* Thông tin học sinh */}
          <div className="bg-teal-50 rounded-xl p-3">
            <p className="font-bold text-teal-800 text-sm">{studentName}</p>
            <p className="text-xs text-teal-600">
              {studentCode}{className ? ` · ${className}` : ''} · {monthLabel}
            </p>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center">
            {!qrError ? (
              <div className="relative">
                {!qrLoaded && (
                  <div className="w-52 h-52 flex items-center justify-center bg-gray-100 rounded-xl">
                    <RefreshCw className="w-8 h-8 animate-spin text-teal-400" />
                  </div>
                )}
                <img
                  src={qrUrl}
                  alt="VietQR"
                  className={`w-52 h-52 rounded-xl border-2 border-teal-100 shadow-md transition-opacity duration-300
                    ${qrLoaded ? 'opacity-100' : 'opacity-0 absolute'}`}
                  onLoad={() => setQrLoaded(true)}
                  onError={() => { setQrError(true); setQrLoaded(true) }}
                />
              </div>
            ) : (
              <div className="w-52 h-52 flex flex-col items-center justify-center bg-gray-100 rounded-xl gap-2 text-center p-4">
                <QrCode className="w-10 h-10 text-gray-300" />
                <p className="text-xs text-gray-500">Không tải được QR</p>
                <a href={qrUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-teal-600 underline">Xem trực tiếp →</a>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-2">Quét bằng app ngân hàng bất kỳ</p>
          </div>

          {/* Thông tin chuyển khoản */}
          <div className="space-y-2 text-sm">

            <InfoRow
              label="Ngân hàng"
              value={BANK_NAMES[BANK_ID] || BANK_ID}
              icon={<Building2 className="w-3.5 h-3.5 text-gray-400" />}
            />

            <InfoRow
              label="Số tài khoản"
              value={BANK_ACCOUNT || '—'}
              copyKey="account"
              copyValue={BANK_ACCOUNT}
              copied={copied}
              onCopy={copy}
            />

            <InfoRow
              label="Số tiền"
              value={fmtVNDShort(amount)}
              copyKey="amount"
              copyValue={String(amount)}
              copied={copied}
              onCopy={copy}
              highlight
            />

            <InfoRow
              label="Nội dung CK"
              value={transferContent}
              copyKey="content"
              copyValue={transferContent}
              copied={copied}
              onCopy={copy}
              mono
            />
          </div>

          {/* Lưu ý nội dung chuyển khoản */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
            <p className="font-bold mb-0.5">⚠️ Lưu ý quan trọng:</p>
            <p>Nhập <strong>đúng nội dung chuyển khoản</strong> để hệ thống tự động ghép thanh toán với học sinh.</p>
          </div>

          {/* Nút xác nhận thủ công (dành cho GV) */}
          {onConfirmManual && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400 text-center mb-2">Đã nhận tiền mặt hoặc xác nhận chuyển khoản?</p>
              <button
                onClick={() => onConfirmManual(amount)}
                className="w-full py-2.5 bg-teal-600 text-white rounded-xl font-bold text-sm hover:bg-teal-700 transition"
              >
                ✅ Xác nhận đã thu {fmtVNDShort(amount)}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── InfoRow helper ───────────────────────────────────────────────────────────
function InfoRow({
  label, value, icon,
  copyKey, copyValue, copied, onCopy,
  highlight, mono,
}: {
  label: string; value: string; icon?: React.ReactNode
  copyKey?: string; copyValue?: string
  copied?: string | null; onCopy?: (text: string, key: string) => void
  highlight?: boolean; mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
      <div className="flex items-center gap-1.5 min-w-0">
        {icon}
        <span className="text-gray-500 text-xs shrink-0">{label}:</span>
        <span className={`font-semibold truncate text-xs
          ${highlight ? 'text-teal-700 text-sm font-extrabold' : 'text-gray-800'}
          ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
      </div>
      {copyKey && onCopy && copyValue && (
        <button
          onClick={() => onCopy(copyValue, copyKey)}
          className="shrink-0 text-gray-400 hover:text-teal-600 transition"
          title="Copy"
        >
          {copied === copyKey
            ? <CheckCircle2 className="w-4 h-4 text-teal-500" />
            : <Copy className="w-4 h-4" />}
        </button>
      )}
    </div>
  )
}
