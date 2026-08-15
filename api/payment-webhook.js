/**
 * api/payment-webhook.js
 * Supports: SePay (sepay.vn) + Casso (casso.vn) + SeaPay (legacy)
 */

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function normalizePayload(body) {
  if (body.transferAmount !== undefined) {
    return {
      source: 'sepay',
      transaction_id: body.referenceCode || body.id?.toString(),
      amount: body.transferAmount,
      description: body.content || body.description || '',
      transfer_at: body.transactionDate ? new Date(body.transactionDate).toISOString() : new Date().toISOString(),
      is_incoming: !body.transferType || body.transferType === 'in',
    };
  }
  if (body.tid !== undefined) {
    return {
      source: 'casso',
      transaction_id: body.tid?.toString() || body.id?.toString(),
      amount: body.amount,
      description: body.description || '',
      transfer_at: body.when ? new Date(body.when).toISOString() : new Date().toISOString(),
      is_incoming: body.amount > 0,
    };
  }
  return {
    source: 'seapay',
    transaction_id: body.transaction_id,
    amount: Math.abs(body.amount || 0),
    description: body.description || body.reference || '',
    transfer_at: body.transfer_at || new Date().toISOString(),
    is_incoming: true,
  };
}

function parseTransferContent(description) {
  const text = (description || '').toUpperCase();
  // Format mới: "HP K9001 T052026" (zero-padded, no slash)
  const vietqrNew = text.match(/HP\s+([A-Z0-9]+)\s+T(\d{2})(\d{4})/);
  if (vietqrNew) {
    return { studentCode: vietqrNew[1], month: `${vietqrNew[3]}-${vietqrNew[2]}` };
  }
  // Format cũ fallback: "HP K9001 T5/2026"
  const vietqr = text.match(/HP\s+([A-Z0-9]+)\s+T(\d{1,2})\/(\d{4})/);
  if (vietqr) {
    return { studentCode: vietqr[1], month: `${vietqr[3]}-${String(vietqr[2]).padStart(2, '0')}` };
  }
  const code = text.match(/\b([A-Z]{1,3}\d{3,})\b/);
  if (code) return { studentCode: code[1], month: null };
  return { studentCode: null, month: null };
}

async function findActiveClassId(studentId) {
  const { data } = await supabase.from('enrollments').select('class_id')
    .eq('student_id', studentId).eq('status', 'active').limit(1).maybeSingle();
  return data?.class_id || null;
}

async function sendConfirmEmail(student, amount, transactionId, month) {
  const gasUrl = process.env.GAS_EMAIL_URL;
  if (!gasUrl || !student?.email) return false;
  try {
    const res = await fetch(gasUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'follow',
      body: JSON.stringify({
        type: 'payment_confirm', secret: process.env.GAS_WEBHOOK_SECRET || '',
        parentEmail: student.email, studentName: student.full_name,
        amount, transactionId, month: month || '',
        centerName: process.env.CENTER_NAME || 'EduCenter',
      }),
    });
    const data = await res.json();
    return data.ok === true;
  } catch (e) { console.error('GAS email error:', e.message); return false; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  console.log('Webhook received:', JSON.stringify(req.body).slice(0, 300));

  const payload = normalizePayload(req.body);

  if (!payload.is_incoming) return res.status(200).json({ ok: true, skipped: 'outgoing' });
  if (!payload.transaction_id || !payload.amount) {
    return res.status(400).json({ error: 'Missing fields', received: req.body });
  }

  const { data: existing } = await supabase.from('payments').select('id')
    .eq('note', `[${payload.source}] ${payload.description}`.slice(0, 200))
    .eq('amount', payload.amount).maybeSingle();
  if (existing) return res.status(200).json({ ok: true, duplicate: true, payment_id: existing.id });

  try {
    const { studentCode, month } = parseTransferContent(payload.description);
    let student = null, classId = null;

    if (studentCode) {
      const { data } = await supabase.from('students').select('id, full_name, email')
        .eq('student_code', studentCode).maybeSingle();
      if (data) { student = data; classId = await findActiveClassId(data.id); }
    }

    const { data: payment, error: payErr } = await supabase.from('payments').insert({
      student_id: student?.id || null, class_id: classId || null,
      amount: payload.amount, method: 'transfer',
      date: payload.transfer_at.slice(0, 10),
      note: `[${payload.source}] ${payload.description}`.slice(0, 200),
    }).select().single();

    if (payErr) throw payErr;

    const emailSent = await sendConfirmEmail(student, payload.amount, payload.transaction_id, month);
    if (emailSent && student) {
      await supabase.from('email_logs').insert({
        student_id: student.id, type: 'payment_confirm',
        recipient_email: student.email,
        subject: `Xac nhan thanh toan – ${student.full_name}`, status: 'sent',
      });
    }

    return res.status(200).json({
      ok: true, source: payload.source, payment_id: payment.id,
      student_code: studentCode, student_name: student?.full_name || null,
      month, email_sent: emailSent,
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).json({ error: err.message });
  }
}
