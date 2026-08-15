import puppeteer from 'puppeteer';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env natively
const env = {};
try {
  const envContent = fs.readFileSync(path.resolve('.env'), 'utf-8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
} catch (err) {}

const supabaseUrl = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Lỗi: Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong file .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);


async function main() {
  console.log('🤖 Starting EduCenter Zalo Auto Bot...');
  console.log('====================================================');

  // 1. Fetch unpaid tuition notifications from database
  const { data: notifications, error: notifError } = await supabase
    .from('tuition_notifications')
    .select('*, students(*)')
    .eq('is_paid', false);

  if (notifError) {
    console.error('❌ Lỗi lấy dữ liệu từ Supabase:', notifError.message);
    process.exit(1);
  }

  if (!notifications || notifications.length === 0) {
    console.log('🎉 Tất cả học sinh đã hoàn tất đóng học phí! Không có học sinh nào cần gửi.');
    process.exit(0);
  }

  console.log(`📋 Tìm thấy ${notifications.length} học sinh chưa đóng học phí cần gửi Zalo.`);

  // 2. Launch Puppeteer Chrome browser with persistent session
  const userDataDir = path.resolve('.zalo_session');
  if (!fs.existsSync(userDataDir)) {
    fs.mkdirSync(userDataDir, { recursive: true });
  }

  console.log('🚀 Đang mở trình duyệt Chrome (Lưu session tại .zalo_session)...');
  const browser = await puppeteer.launch({
    headless: false, // Hiển thị Chrome để xem tiến trình
    userDataDir,
    defaultViewport: null,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--start-maximized',
      '--disable-notifications'
    ]
  });

  const page = await browser.newPage();

  // Navigate to Zalo Web to verify login
  console.log('🌐 Đang kết nối Zalo Web (chat.zalo.me)...');
  await page.goto('https://chat.zalo.me', { waitUntil: 'networkidle2' });

  console.log('⌛ Vui lòng đảm bảo Zalo Web đã đăng nhập trên cửa sổ Chrome vừa mở.');
  console.log('⌛ (Nếu lần đầu chạy, hãy dùng App Zalo trên điện thoại quét mã QR)...');

  // Wait until user is logged in (search input exists)
  try {
    await page.waitForSelector('#contact-search-input, input[placeholder*="Tìm kiếm"]', { timeout: 600000 });
    console.log('✅ Đã đăng nhập Zalo Web thành công!');
  } catch {
    console.error('❌ Hết thời gian chờ đăng nhập Zalo. Vui lòng thử lại.');
    await browser.close();
    process.exit(1);
  }

  console.log('====================================================');
  console.log('🚀 Bắt đầu gửi tin nhắn học phí tự động...');
  console.log('====================================================');

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < notifications.length; i++) {
    const item = notifications[i];
    const student = item.students;

    if (!student) {
      console.warn(`[${i + 1}/${notifications.length}] ⏭ Bỏ qua: Không tìm thấy thông tin học sinh.`);
      continue;
    }

    const rawPhone = student.zalo || student.parent_phone || '';
    const digits = rawPhone.replace(/\D/g, '');
    const cleanPhone = digits.startsWith('84')
      ? '0' + digits.substring(2)
      : (digits.startsWith('0') ? digits : '0' + digits);

    if (!cleanPhone || cleanPhone.length < 9) {
      console.warn(`[${i + 1}/${notifications.length}] ⏭ Bỏ qua: Học sinh ${student.full_name} không có SĐT hợp lệ (${rawPhone})`);
      failCount++;
      continue;
    }

    const amountVal = Number(item.amount);
    const msg = `Học phí khóa ${item.course_name} của học sinh ${student.full_name} là ${amountVal.toLocaleString('vi-VN')} Đồng, phụ huynh vui lòng chuyển khoản vào stk: 3714235000320 HKD DINH CONG LINH (Nội dung: HP ${student.student_code} KH)`;

    console.log(`[${i + 1}/${notifications.length}] 💬 Đang gửi đến: ${student.full_name} (${cleanPhone})...`);

    try {
      // Direct navigation via zalo.me
      await page.goto(`https://zalo.me/${cleanPhone}`, { waitUntil: 'networkidle2' });
      await new Promise(r => setTimeout(r, 2500));

      // Check if redirected to chat.zalo.me
      const currentUrl = page.url();
      if (!currentUrl.includes('chat.zalo.me')) {
        // Fallback search inside chat.zalo.me
        await page.goto('https://chat.zalo.me', { waitUntil: 'networkidle2' });
        await new Promise(r => setTimeout(r, 1500));

        const searchSelector = '#contact-search-input, input[placeholder*="Tìm kiếm"]';
        await page.waitForSelector(searchSelector, { timeout: 10000 });
        await page.click(searchSelector);
        
        // Clear search box
        await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (el) el.value = '';
        }, searchSelector);

        await page.type(searchSelector, cleanPhone, { delay: 50 });
        await page.keyboard.press('Enter');
        await new Promise(r => setTimeout(r, 2000));

        // Click search result
        const resultSelector = '.conv-item, .search-item, .cell-item, [data-id]';
        const found = await page.$(resultSelector);
        if (found) {
          await found.click();
          await new Promise(r => setTimeout(r, 1500));
        } else {
          throw new Error(`Không tìm thấy Zalo của SĐT ${cleanPhone}`);
        }
      }

      // Find chat box input
      const chatInputSelector = '#input_chat_topic, div[contenteditable="true"], .rich-input';
      await page.waitForSelector(chatInputSelector, { timeout: 10000 });
      await page.focus(chatInputSelector);

      // Type text message into chat box
      await page.evaluate((text) => {
        const input = document.querySelector('#input_chat_topic, div[contenteditable="true"]');
        if (input) {
          input.focus();
          document.execCommand('insertText', false, text);
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, msg);

      await new Promise(r => setTimeout(r, 800));

      // Press Enter to send
      await page.keyboard.press('Enter');
      console.log(`     ✅ Đã gửi thành công cho ${student.full_name}!`);
      successCount++;

      // Delay between sends to avoid rate limit
      await new Promise(r => setTimeout(r, 3500));

    } catch (err) {
      console.error(`     ❌ Lỗi khi gửi cho ${student.full_name}:`, err.message);
      failCount++;
    }
  }

  console.log('====================================================');
  console.log(`🎉 HOÀN THÀNH BÁO HỌC PHÍ ZALO: Thành công: ${successCount} | Thất bại/Bỏ qua: ${failCount}`);
  console.log('====================================================');

  await new Promise(r => setTimeout(r, 5000));
  await browser.close();
}

main().catch(err => {
  console.error('❌ Lỗi chạy Bot Zalo:', err);
  process.exit(1);
});
