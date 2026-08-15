/**
 * api/send-email.js
 * Proxy đến Google Apps Script Web App để gửi email qua GmailApp.
 * Không cần Gmail App Password hay nodemailer.
 */

async function forwardToN8n(payload) {
  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  if (!n8nUrl) return;
  try {
    await fetch(n8nUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error("n8n forward failed:", e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const gasUrl = process.env.GAS_EMAIL_URL;
  if (!gasUrl) {
    return res.status(500).json({ error: "GAS_EMAIL_URL not configured" });
  }

  const payload = req.body;
  const secret = process.env.GAS_WEBHOOK_SECRET || "";
  const gasPayload = { ...payload, secret };

  try {
    // Gọi Google Apps Script Web App
    const gasRes = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      redirect: "follow", // GAS redirect 302
      body: JSON.stringify(gasPayload),
    });

    const gasData = await gasRes.json();
    if (!gasData.ok) throw new Error(gasData.error || "GAS returned error");

    // Forward sang n8n (Zalo) nếu đã cấu hình
    await forwardToN8n({
      type: payload.type,
      studentName: payload.studentName,
      parentPhone: payload.parentPhone,
      className: payload.className,
      month: payload.month,
      debt: payload.debt,
    });

    return res.status(200).json({ ok: true, subject: gasData.subject, recipient: gasData.recipient });
  } catch (err) {
    console.error("send-email error:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
