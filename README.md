# EduCenter – Hệ thống quản lý trung tâm giáo dục

> React 18 · Vite · Tailwind CSS · Supabase · Vercel · Nodemailer

## 🎯 Tính năng

| Tính năng | Mô tả |
|-----------|-------|
| 👤 Phân quyền | ADMIN / TEACHER / TA |
| 📚 Quản lý lớp | Thêm, sửa, xoá lớp học; phân công giáo viên |
| 🧑‍🎓 Quản lý học sinh | Hồ sơ, lớp đang học, thông tin phụ huynh |
| ✅ Điểm danh | Chấm điểm danh theo lớp/ngày; xuất báo cáo |
| 💰 Học phí | Tự tính dựa trên số ngày nghỉ; quản lý thanh toán |
| 📧 Thông báo Gmail | Thông báo học phí + QR VietQR đẹp mắt |
| 📱 Zalo (tương lai) | Chừa cổng n8n – cắm vào là chạy |
| 💳 SeaPay webhook | Auto xác nhận khi phụ huynh chuyển khoản |

---

## 🗂️ Cấu trúc dự án

```
edu-center/
├── api/
│   ├── send-email.js          # Gửi email học phí / điểm danh
│   └── payment-webhook.js     # SeaPay webhook → xác nhận thanh toán
├── public/
│   └── logo.svg
├── src/
│   ├── components/
│   │   ├── Layout.jsx         # Sidebar navigation
│   │   └── Modal.jsx          # Reusable modal
│   ├── lib/
│   │   ├── supabase.js
│   │   ├── helpers.js         # Utility functions
│   │   └── emailTemplates.js  # HTML email templates
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Classes.jsx
│   │   ├── Students.jsx
│   │   ├── Attendance.jsx
│   │   ├── Tuition.jsx
│   │   ├── EmailCenter.jsx
│   │   └── UserMgmt.jsx
│   ├── store/
│   │   ├── authStore.js       # Zustand auth state
│   │   └── dataStore.js       # Zustand data state
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── supabase/
│   └── schema.sql             # Paste vào Supabase SQL Editor
├── .env.example
├── package.json
├── vite.config.js
├── tailwind.config.js
└── vercel.json
```

---

## 🚀 Hướng dẫn triển khai

### Bước 1 – Tạo dự án Supabase

1. Vào [supabase.com](https://supabase.com) → **New project**
2. Lưu lại: **Project URL** và **anon public key** (Settings → API)
3. Vào **SQL Editor** → paste toàn bộ nội dung `supabase/schema.sql` → **Run**
4. Tạo tài khoản admin đầu tiên:
   - Authentication → Users → **Invite user** (nhập email của bạn)
   - Sau khi user được tạo, chạy SQL sau:
   ```sql
   update profiles set role = 'ADMIN' where email = 'your@email.com';
   ```

### Bước 2 – Cấu hình Gmail (App Password)

1. Vào [myaccount.google.com](https://myaccount.google.com) → Security → **2-Step Verification** (phải bật)
2. Tìm **App passwords** → Tạo password cho "Mail"
3. Lưu lại chuỗi 16 ký tự (dùng ở Bước 4)

### Bước 3 – Cấu hình VietQR (miễn phí, không cần API key)

QR thanh toán sử dụng [VietQR](https://www.vietqr.io/) – không cần đăng ký, chỉ cần:
- **Mã ngân hàng** (BIN): xem tại [vietqr.io/danh-sach-ngan-hang](https://www.vietqr.io/danh-sach-ngan-hang)  
  Ví dụ: MB = `970422`, Vietcombank = `970436`, Techcombank = `970407`
- **Số tài khoản** của trung tâm
- **Tên tài khoản** (hiển thị trên QR)

### Bước 4 – Deploy lên Vercel

```bash
# 1. Fork / push code lên GitHub
git init && git add . && git commit -m "Initial commit"
git remote add origin https://github.com/your-username/edu-center.git
git push -u origin main

# 2. Vào vercel.com → Import repository
# 3. Thêm Environment Variables:
```

| Variable | Giá trị |
|----------|---------|
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` (anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (service role key – chỉ dùng cho webhook) |
| `GMAIL_USER` | `your@gmail.com` |
| `GMAIL_APP_PASSWORD` | App password 16 ký tự |
| `CENTER_NAME` | `Trung tâm Anh ngữ ABC` |
| `BANK_ID` | `970422` (MB Bank) |
| `BANK_ACCOUNT` | `1234567890` |
| `BANK_ACCOUNT_NAME` | `NGUYEN VAN A` |
| `N8N_WEBHOOK_URL` | *(để trống nếu chưa có)* |
| `SEAPAY_WEBHOOK_SECRET` | *(để trống nếu chưa có)* |

4. Click **Deploy** → Done! 🎉

---

## 💳 Tích hợp SeaPay (webhook tự động)

Khi phụ huynh chuyển khoản, SeaPay sẽ gọi đến:
```
POST https://your-domain.vercel.app/api/payment-webhook
```

**Cấu hình trong SeaPay Dashboard:**
- Webhook URL: `https://your-domain.vercel.app/api/payment-webhook`
- Secret key: điền vào `SEAPAY_WEBHOOK_SECRET` trong Vercel

**Quy tắc nội dung chuyển khoản:**  
Yêu cầu phụ huynh ghi nội dung theo mẫu:
> `HOCPHI HS001` (mã học sinh)

Hệ thống sẽ tự động:
1. Tra mã học sinh → tìm email phụ huynh
2. Ghi thanh toán vào database
3. Gửi email xác nhận + cảm ơn đẹp mắt
4. Forward sang n8n (Zalo) nếu đã cấu hình

---

## 📱 Tích hợp Zalo qua n8n (tương lai)

1. Cài [n8n](https://n8n.io) (self-host hoặc n8n.cloud)
2. Tạo workflow với **Webhook** node
3. Copy URL webhook → điền vào `N8N_WEBHOOK_URL` trong Vercel
4. n8n nhận payload JSON và gửi qua Zalo OA API

Payload mẫu n8n nhận được:
```json
{
  "type": "tuition",
  "studentName": "Nguyễn Văn A",
  "parentPhone": "0901234567",
  "amount": 500000,
  "month": "5/2025",
  "className": "Anh văn lớp 5"
}
```

---

## 📐 Tính học phí

```
Học phí tháng = Học phí/buổi × (Số buổi kế hoạch − Số buổi nghỉ)
```

- **Số buổi kế hoạch**: tính từ lịch học (thứ trong tuần) trong tháng
- **Số buổi nghỉ**: đếm từ bảng điểm danh (`present = false`)
- **Đã đóng**: tổng từ bảng `payments` theo lớp + tháng
- **Còn nợ**: Học phí tháng − Đã đóng

---

## 🔑 Phân quyền

| Trang | ADMIN | TEACHER | TA |
|-------|-------|---------|-----|
| Dashboard | ✅ | ✅ | ✅ |
| Lớp học (xem) | ✅ | ✅ | ✅ |
| Lớp học (sửa) | ✅ | ✅ | ❌ |
| Học sinh | ✅ | ✅ | ❌ |
| Điểm danh | ✅ | ✅ | ✅ |
| Học phí | ✅ | ✅ | ❌ |
| Email center | ✅ | ✅ | ❌ |
| Quản lý users | ✅ | ❌ | ❌ |

---

## 🛠️ Chạy local

```bash
npm install
cp .env.example .env.local
# Điền các biến môi trường vào .env.local
npm run dev
```

> **Lưu ý:** API routes (`/api/*`) cần Vercel CLI để chạy local:
> ```bash
> npm i -g vercel
> vercel dev
> ```

---

## 📦 Tech Stack

- **Frontend**: React 18 + Vite + Tailwind CSS
- **State**: Zustand
- **Database + Auth**: Supabase (PostgreSQL + RLS)
- **Email**: Nodemailer + Gmail SMTP
- **QR thanh toán**: VietQR (miễn phí)
- **Hosting**: Vercel (frontend + serverless API)
- **Zalo (future)**: n8n webhook

---

## 🐛 Troubleshooting

**Email không gửi được:**
- Kiểm tra Gmail App Password (không phải mật khẩu thường)
- Đảm bảo đã bật 2-Step Verification
- Kiểm tra GMAIL_USER và GMAIL_APP_PASSWORD trong Vercel

**Lỗi khi đăng nhập:**
- Kiểm tra VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY
- Đảm bảo đã chạy schema.sql trong Supabase

**SeaPay webhook trả về 401:**
- Kiểm tra SEAPAY_WEBHOOK_SECRET khớp với SeaPay Dashboard

**QR không hiển thị:**
- Kiểm tra BANK_ID (phải là BIN số, không phải tên ngân hàng)
- Kiểm tra BANK_ACCOUNT không có khoảng trắng

---

## 📧 Cấu hình Gmail qua Google Apps Script

> **Không cần App Password, không cần nodemailer.** GAS dùng `GmailApp.sendEmail()` – gửi bằng tài khoản Gmail của bạn miễn phí.

### Bước 1 – Tạo Apps Script project

1. Vào [script.google.com](https://script.google.com) → **New project**
2. Paste toàn bộ nội dung `gas/Code.gs` vào editor
3. Sửa secret key trong hàm `setupProperties()` rồi **Run** hàm đó 1 lần
4. **Deploy → New deployment**
   - Type: **Web App**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Copy **Web App URL** (dạng `https://script.google.com/macros/s/AKfy.../exec`)

### Bước 2 – Thêm vào Vercel

| Variable | Giá trị |
|----------|---------|
| `GAS_EMAIL_URL` | Web App URL từ bước 1 |
| `GAS_WEBHOOK_SECRET` | Secret key bạn đặt trong `setupProperties()` |

✅ Xong! Không cần cấu hình gì thêm về Gmail.

### Giới hạn GAS

| | Tài khoản cá nhân | Google Workspace |
|--|--|--|
| Email/ngày | 100 | 1,500 |
| Recipient/email | 50 | 50 |

> Với trung tâm < 100 học sinh, giới hạn này hoàn toàn đủ dùng.
