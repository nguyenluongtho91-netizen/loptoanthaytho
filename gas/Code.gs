/**
 * EduCenter – Google Apps Script Email Service
 * =============================================
 * Deploy as Web App:
 *   Extensions → Apps Script → Deploy → New deployment
 *   → Execute as: Me | Who has access: Anyone
 *   → Copy Web App URL → paste vào VITE_GAS_EMAIL_URL (hoặc GAS_EMAIL_URL trong Vercel)
 *
 * Vercel gọi POST đến Web App này, GAS dùng GmailApp để gửi thay.
 */

// ──────────────────────────────────────────────────────────────────
// Entry point
// ──────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const { type, secret } = payload;

    // Kiểm tra secret key (tùy chọn – thêm 1 lớp bảo vệ đơn giản)
    const WEBHOOK_SECRET = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
    if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
      return jsonResponse({ ok: false, error: "Unauthorized" }, 401);
    }

    let result;
    switch (type) {
      case "tuition":
        result = sendTuitionEmail(payload);
        break;
      case "attendance":
        result = sendAttendanceEmail(payload);
        break;
      case "payment_confirm":
        result = sendPaymentConfirmEmail(payload);
        break;
      default:
        return jsonResponse({ ok: false, error: "Unknown type: " + type }, 400);
    }

    return jsonResponse({ ok: true, ...result });
  } catch (err) {
    Logger.log("doPost error: " + err.message);
    return jsonResponse({ ok: false, error: err.message }, 500);
  }
}

// Trả về JSON response (GAS không có res.json nên dùng ContentService)
function jsonResponse(data, statusCode) {
  // GAS ContentService không hỗ trợ status code – lỗi sẽ nằm trong body
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ──────────────────────────────────────────────────────────────────
// 1. Thông báo học phí
// ──────────────────────────────────────────────────────────────────
function sendTuitionEmail(payload) {
  const {
    parentEmail,
    studentName,
    className,
    month,
    plannedSessions,
    absences,
    attendedSessions,
    feePerSession,
    totalFee,
    paidAmount,
    debt,
    bankId,
    bankAccount,
    bankAccountName,
    centerName,
  } = payload;

  if (!parentEmail) throw new Error("parentEmail is required");

  const subject = `[${centerName || "EduCenter"}] Thông báo học phí ${month} – ${studentName}`;
  const htmlBody = buildTuitionHtml(payload);

  GmailApp.sendEmail(parentEmail, subject, "", { htmlBody, name: centerName || "EduCenter" });

  Logger.log(`Sent tuition email to ${parentEmail} for ${studentName}`);
  return { subject, recipient: parentEmail };
}

// ──────────────────────────────────────────────────────────────────
// 2. Báo cáo điểm danh
// ──────────────────────────────────────────────────────────────────
function sendAttendanceEmail(payload) {
  const {
    parentEmail,
    studentName,
    className,
    month,
    records, // [{ date, status, note }]
    centerName,
  } = payload;

  if (!parentEmail) throw new Error("parentEmail is required");

  const subject = `[${centerName || "EduCenter"}] Báo cáo điểm danh ${month} – ${studentName}`;
  const htmlBody = buildAttendanceHtml(payload);

  GmailApp.sendEmail(parentEmail, subject, "", { htmlBody, name: centerName || "EduCenter" });

  Logger.log(`Sent attendance email to ${parentEmail} for ${studentName}`);
  return { subject, recipient: parentEmail };
}

// ──────────────────────────────────────────────────────────────────
// 3. Xác nhận thanh toán
// ──────────────────────────────────────────────────────────────────
function sendPaymentConfirmEmail(payload) {
  const {
    parentEmail,
    studentName,
    amount,
    transactionId,
    transferAt,
    description,
    centerName,
  } = payload;

  if (!parentEmail) throw new Error("parentEmail is required");

  const subject = `✅ Xác nhận thanh toán học phí – ${studentName}`;
  const htmlBody = buildPaymentConfirmHtml(payload);

  GmailApp.sendEmail(parentEmail, subject, "", { htmlBody, name: centerName || "EduCenter" });

  Logger.log(`Sent payment confirm to ${parentEmail} for ${studentName}`);
  return { subject, recipient: parentEmail };
}

// ──────────────────────────────────────────────────────────────────
// HTML Templates
// ──────────────────────────────────────────────────────────────────

function buildTuitionHtml(p) {
  const {
    studentName, className, month,
    plannedSessions = 0, absences = 0, attendedSessions = 0,
    feePerSession = 0, totalFee = 0, paidAmount = 0, debt = 0,
    bankId, bankAccount, bankAccountName, centerName = "EduCenter",
  } = p;

  const fmtVND = (n) => Number(n).toLocaleString("vi-VN") + "đ";
  const debtColor = debt > 0 ? "#dc2626" : "#16a34a";
  const debtLabel = debt > 0 ? "Còn nợ" : "Đã đóng đủ";

  const qrSection = (debt > 0 && bankId && bankAccount)
    ? `
    <div style="text-align:center;margin:24px 0;">
      <p style="font-size:14px;color:#374151;margin-bottom:12px;">
        📱 <strong>Quét QR để chuyển khoản</strong> (${fmtVND(debt)})
      </p>
      <img
        src="https://img.vietqr.io/image/${bankId}-${bankAccount}-compact2.png?amount=${debt}&addInfo=HOCPHI%20${studentName}&accountName=${encodeURIComponent(bankAccountName || centerName)}"
        alt="QR chuyển khoản"
        style="width:200px;height:200px;border-radius:12px;border:1px solid #e5e7eb;"
      />
      <p style="font-size:12px;color:#6b7280;margin-top:8px;">
        ${bankAccountName || centerName} – ${bankAccount}
      </p>
    </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0d9488,#0891b2);padding:32px 24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">📚 ${centerName}</h1>
      <p style="margin:8px 0 0;color:#99f6e4;font-size:14px;">Thông báo học phí tháng ${month}</p>
    </div>

    <!-- Body -->
    <div style="padding:24px;">
      <p style="color:#374151;font-size:15px;">Kính gửi phụ huynh của <strong>${studentName}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;">Dưới đây là thông tin học phí tháng <strong>${month}</strong> lớp <strong>${className}</strong>:</p>

      <!-- Stats -->
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f0fdfa;">
          <td style="padding:10px 14px;color:#374151;font-size:14px;border-radius:8px 0 0 0;">Buổi kế hoạch</td>
          <td style="padding:10px 14px;text-align:right;font-weight:600;color:#0d9488;">${plannedSessions} buổi</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#374151;font-size:14px;">Số buổi nghỉ</td>
          <td style="padding:10px 14px;text-align:right;font-weight:600;color:#dc2626;">${absences} buổi</td>
        </tr>
        <tr style="background:#f0fdfa;">
          <td style="padding:10px 14px;color:#374151;font-size:14px;">Số buổi học thực tế</td>
          <td style="padding:10px 14px;text-align:right;font-weight:600;color:#0d9488;">${attendedSessions} buổi</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#374151;font-size:14px;">Học phí/buổi</td>
          <td style="padding:10px 14px;text-align:right;font-weight:600;">${fmtVND(feePerSession)}</td>
        </tr>
        <tr style="background:#f0fdfa;">
          <td style="padding:10px 14px;color:#374151;font-size:14px;font-weight:600;">Tổng học phí tháng</td>
          <td style="padding:10px 14px;text-align:right;font-weight:700;font-size:16px;color:#0d9488;">${fmtVND(totalFee)}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#374151;font-size:14px;">Đã thanh toán</td>
          <td style="padding:10px 14px;text-align:right;font-weight:600;color:#16a34a;">${fmtVND(paidAmount)}</td>
        </tr>
        <tr style="background:#fff7ed;">
          <td style="padding:12px 14px;color:#374151;font-size:15px;font-weight:700;border-radius:0 0 0 8px;">${debtLabel}</td>
          <td style="padding:12px 14px;text-align:right;font-size:18px;font-weight:700;color:${debtColor};border-radius:0 0 8px 0;">${fmtVND(debt)}</td>
        </tr>
      </table>

      ${qrSection}

      <p style="color:#6b7280;font-size:13px;margin-top:16px;">
        Nếu có thắc mắc, vui lòng liên hệ trung tâm. Cảm ơn quý phụ huynh đã tin tưởng! 🙏
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">${centerName} · Email tự động, vui lòng không reply</p>
    </div>
  </div>
</body>
</html>`;
}

function buildAttendanceHtml(p) {
  const {
    studentName, className, month,
    records = [], // [{ date, status, note }]
    centerName = "EduCenter",
  } = p;

  const statusLabel = { present: "✅ Có mặt", late: "🕐 Trễ", absent: "❌ Vắng" };
  const statusColor = { present: "#16a34a", late: "#d97706", absent: "#dc2626" };
  const statusBg   = { present: "#f0fdf4", late: "#fffbeb", absent: "#fef2f2" };

  const rows = records.map((r) => `
    <tr style="background:${statusBg[r.status] || "#fff"};">
      <td style="padding:8px 14px;font-size:13px;color:#374151;">${r.date}</td>
      <td style="padding:8px 14px;font-size:13px;font-weight:600;color:${statusColor[r.status] || "#374151"};">${statusLabel[r.status] || r.status}</td>
      <td style="padding:8px 14px;font-size:13px;color:#6b7280;">${r.note || ""}</td>
    </tr>`).join("");

  const total   = records.length;
  const present = records.filter(r => r.status === "present").length;
  const late    = records.filter(r => r.status === "late").length;
  const absent  = records.filter(r => r.status === "absent").length;

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

    <div style="background:linear-gradient(135deg,#0d9488,#0891b2);padding:32px 24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">📚 ${centerName}</h1>
      <p style="margin:8px 0 0;color:#99f6e4;font-size:14px;">Báo cáo điểm danh tháng ${month}</p>
    </div>

    <div style="padding:24px;">
      <p style="color:#374151;font-size:15px;">Kính gửi phụ huynh của <strong>${studentName}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;">Báo cáo điểm danh tháng <strong>${month}</strong> – lớp <strong>${className}</strong>:</p>

      <!-- Summary badges -->
      <div style="display:flex;gap:12px;margin:16px 0;flex-wrap:wrap;">
        <span style="background:#f0fdf4;color:#16a34a;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:600;">✅ Có mặt: ${present}</span>
        <span style="background:#fffbeb;color:#d97706;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:600;">🕐 Trễ: ${late}</span>
        <span style="background:#fef2f2;color:#dc2626;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:600;">❌ Vắng: ${absent}</span>
        <span style="background:#f3f4f6;color:#374151;padding:6px 14px;border-radius:999px;font-size:13px;font-weight:600;">📅 Tổng: ${total}</span>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-top:12px;">
        <thead>
          <tr style="background:#f0fdfa;">
            <th style="padding:10px 14px;text-align:left;font-size:13px;color:#0d9488;">Ngày</th>
            <th style="padding:10px 14px;text-align:left;font-size:13px;color:#0d9488;">Trạng thái</th>
            <th style="padding:10px 14px;text-align:left;font-size:13px;color:#0d9488;">Ghi chú</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <p style="color:#6b7280;font-size:13px;margin-top:16px;">
        Cảm ơn quý phụ huynh đã quan tâm đến việc học của con! 🙏
      </p>
    </div>

    <div style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">${centerName} · Email tự động, vui lòng không reply</p>
    </div>
  </div>
</body>
</html>`;
}

function buildPaymentConfirmHtml(p) {
  const {
    studentName, amount, transactionId,
    transferAt, description, centerName = "EduCenter",
  } = p;

  const fmtVND = (n) => Number(n).toLocaleString("vi-VN") + "đ";
  const fmtDate = (s) => {
    if (!s) return "–";
    const d = new Date(s);
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">

    <div style="background:linear-gradient(135deg,#16a34a,#0d9488);padding:32px 24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">✅</div>
      <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Thanh toán thành công!</h1>
      <p style="margin:8px 0 0;color:#bbf7d0;font-size:14px;">${centerName}</p>
    </div>

    <div style="padding:24px;">
      <p style="color:#374151;font-size:15px;">Kính gửi phụ huynh của <strong>${studentName}</strong>,</p>
      <p style="color:#6b7280;font-size:14px;">Trung tâm đã nhận được khoản thanh toán của quý phụ huynh. Chi tiết giao dịch:</p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr style="background:#f0fdf4;">
          <td style="padding:10px 14px;color:#374151;font-size:14px;">Học sinh</td>
          <td style="padding:10px 14px;text-align:right;font-weight:600;">${studentName}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#374151;font-size:14px;">Số tiền</td>
          <td style="padding:10px 14px;text-align:right;font-weight:700;font-size:18px;color:#16a34a;">${fmtVND(amount)}</td>
        </tr>
        <tr style="background:#f0fdf4;">
          <td style="padding:10px 14px;color:#374151;font-size:14px;">Mã giao dịch</td>
          <td style="padding:10px 14px;text-align:right;font-weight:600;font-size:13px;color:#6b7280;">${transactionId || "–"}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#374151;font-size:14px;">Thời gian</td>
          <td style="padding:10px 14px;text-align:right;font-size:13px;">${fmtDate(transferAt)}</td>
        </tr>
        ${description ? `<tr style="background:#f0fdf4;">
          <td style="padding:10px 14px;color:#374151;font-size:14px;">Nội dung</td>
          <td style="padding:10px 14px;text-align:right;font-size:13px;color:#6b7280;">${description}</td>
        </tr>` : ""}
      </table>

      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px 16px;border-radius:0 8px 8px 0;margin-top:16px;">
        <p style="margin:0;color:#15803d;font-size:14px;">
          🙏 Cảm ơn quý phụ huynh đã tin tưởng và đồng hành cùng <strong>${centerName}</strong>!
        </p>
      </div>
    </div>

    <div style="background:#f9fafb;padding:16px 24px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">${centerName} · Email tự động, vui lòng không reply</p>
    </div>
  </div>
</body>
</html>`;
}

// ──────────────────────────────────────────────────────────────────
// Cài đặt Script Properties
// Chạy hàm này 1 lần trong Apps Script Editor để cấu hình secret
// ──────────────────────────────────────────────────────────────────
function setupProperties() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    WEBHOOK_SECRET: "your-secret-key-here", // đổi thành chuỗi bí mật của bạn
  });
  Logger.log("Properties set.");
}
