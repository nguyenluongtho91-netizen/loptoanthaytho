/**
 * api/send-tuition-email.js
 * Gửi nhắc học phí qua Gmail (GAS) cho học sinh chưa đóng học phí theo khóa
 *
 * POST /api/send-tuition-email
 * Body: { classId, courseName, studentIds? }
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ─── Gọi GAS gửi email ────────────────────────────────────────────────────────
async function callGAS(payload) {
  const gasUrl = process.env.GAS_EMAIL_URL;
  if (!gasUrl) throw new Error("GAS_EMAIL_URL chưa được cấu hình");

  const res = await fetch(gasUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    redirect: "follow",
    body: JSON.stringify({
      type:   "tuition",
      secret: process.env.GAS_WEBHOOK_SECRET || "",
      ...payload,
    }),
  });

  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (!data.ok) throw new Error(data.error || "GAS trả về lỗi");
    return data;
  } catch {
    throw new Error(`GAS response không hợp lệ: ${text.slice(0, 100)}`);
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { classId, courseName, studentIds } = req.body || {};
  if (!classId || !courseName) {
    return res.status(400).json({ error: "Thiếu classId hoặc courseName" });
  }

  try {
    // ── Lấy thông tin lớp ────────────────────────────────────────────────────
    const { data: cls, error: clsErr } = await supabase
      .from("classes")
      .select("id, class_name")
      .eq("id", classId)
      .single();
    if (clsErr) throw clsErr;

    // ── Lấy thông báo học phí chưa đóng của lớp ──────────────────────────────
    let query = supabase
      .from("tuition_notifications")
      .select("id, amount, student_id, students(id, full_name, email, parent_name)")
      .eq("class_id", classId)
      .eq("course_name", courseName)
      .eq("is_paid", false);

    if (studentIds?.length) {
      query = query.in("student_id", studentIds);
    }

    const { data: notifs, error: notifsErr } = await query;
    if (notifsErr) throw notifsErr;

    const results = [];

    for (const notif of notifs || []) {
      const student = notif.students;
      if (!student?.email) {
        results.push({ studentName: student?.full_name, skipped: "Không có email" });
        continue;
      }

      try {
        await callGAS({
          parentEmail:      student.email,
          studentName:      student.full_name,
          className:        cls.class_name,
          month:            courseName,
          plannedSessions:  1,
          absences:         0,
          attendedSessions: 1,
          feePerSession:    notif.amount,
          totalFee:         notif.amount,
          paidAmount:       0,
          debt:             notif.amount,
          bankId:           process.env.BANK_ID          || "",
          bankAccount:      process.env.BANK_ACCOUNT     || "",
          bankAccountName:  process.env.BANK_ACCOUNT_NAME || "",
          centerName:       process.env.CENTER_NAME      || "EduCenter",
        });

        // Ghi log vào Supabase
        await supabase.from("email_logs").insert({
          student_id:      student.id,
          class_id:        classId,
          type:            "tuition",
          recipient_email: student.email,
          subject:         `Nhắc học phí ${courseName} – ${student.full_name}`,
          status:          "sent",
        });

        results.push({ studentName: student.full_name, email: student.email, sent: true, debt: notif.amount });

      } catch (emailErr) {
        console.error(`Email error for ${student.full_name}:`, emailErr.message);

        await supabase.from("email_logs").insert({
          student_id:  student.id,
          class_id:    classId,
          type:        "tuition",
          recipient_email: student.email,
          status:      "error",
          error_msg:   emailErr.message,
        });

        results.push({ studentName: student.full_name, sent: false, error: emailErr.message });
      }
    }

    const sentCount    = results.filter(r => r.sent).length;
    const skippedCount = results.filter(r => r.skipped).length;
    const errorCount   = results.filter(r => r.sent === false).length;

    return res.status(200).json({
      ok: true,
      summary: { sent: sentCount, skipped: skippedCount, errors: errorCount },
      results,
    });

  } catch (err) {
    console.error("send-tuition-email error:", err);
    return res.status(500).json({ error: err.message });
  }
}
