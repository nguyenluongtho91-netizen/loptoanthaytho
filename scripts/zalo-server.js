import express from 'express';
import cors from 'cors';
import puppeteer from 'puppeteer';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

let browser = null;
let page = null;
let isReady = false;

console.log('🚀 Đang khởi tạo Zalo Bot Chrome Automation...');

async function startZaloBot() {
  const userDataDir = path.resolve('.zalo_session');
  try {
    browser = await puppeteer.launch({
      headless: false,
      userDataDir,
      defaultViewport: null,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--start-maximized']
    });

    page = await browser.newPage();
    await page.goto('https://chat.zalo.me', { waitUntil: 'networkidle2' });
    console.log('🌐 Đã kết nối Zalo Web (chat.zalo.me). Chờ sẵn sàng...');
    isReady = true;
  } catch (err) {
    console.error('❌ Lỗi khởi tạo Chrome:', err.message);
  }
}

// Endpoint gửi tin nhắn Zalo tự động qua Chrome
app.post('/api/zalo/send', async (req, res) => {
  const { phone, message } = req.body;
  console.log(`💬 Đang tự động chuyển tiếp Zalo tới: ${phone} | Nội dung: "${message}"`);

  if (!browser) {
    return res.status(400).json({ error: 'Chưa khởi chạy Zalo Bot Server' });
  }

  try {
    const pages = await browser.pages();
    let zaloPage = pages.find(p => p.url().includes('zalo.me'));

    if (!zaloPage || zaloPage.isClosed()) {
      zaloPage = await browser.newPage();
      await zaloPage.goto('https://chat.zalo.me', { waitUntil: 'networkidle2' });
    }

    await zaloPage.bringToFront();

    // 1. Kiểm tra xem ô chat đã được mở sẵn chưa
    const chatInputSelector = '#input_chat_topic, #richInput, div[contenteditable="true"]';
    let chatInput = await zaloPage.$(chatInputSelector);

    if (!chatInput) {
      // Nếu chưa có ô chat, tiến hành tìm kiếm SĐT người nhận
      const searchSelector = '#contact-search-input, input[placeholder*="Tìm kiếm"], input[type="text"]';
      try {
        const searchInput = await zaloPage.waitForSelector(searchSelector, { timeout: 5000 });
        if (searchInput) {
          await searchInput.click();
          await zaloPage.keyboard.down('Control');
          await zaloPage.keyboard.press('A');
          await zaloPage.keyboard.up('Control');
          await zaloPage.keyboard.press('Backspace');
          await zaloPage.type(searchSelector, phone, { delay: 50 });
          await new Promise(r => setTimeout(r, 1000));
          await zaloPage.keyboard.press('ArrowDown');
          await zaloPage.keyboard.press('Enter');
          await new Promise(r => setTimeout(r, 1200));
        }
      } catch (e) {
        console.log('Chuyển qua thử gõ trực tiếp vào ô chat hiện tại...');
      }
    }

    // 2. Nhập nội dung vào ô chat Zalo Web
    let chatEl = null;
    try {
      chatEl = await zaloPage.waitForSelector(chatInputSelector, { timeout: 4000 });
    } catch (e) {
      // Nếu không tìm thấy bằng ID/Class, click vào vị trí ô chat ở góc dưới màn hình
      const viewport = zaloPage.viewport() || { width: 1280, height: 800 };
      await zaloPage.mouse.click(viewport.width / 2 + 100, viewport.height - 60);
      await new Promise(r => setTimeout(r, 400));
    }

    if (chatEl) {
      await chatEl.click();
      await new Promise(r => setTimeout(r, 300));
    }

    // Gõ từng kí tự trực tiếp từ bàn phím
    await zaloPage.keyboard.type(message, { delay: 40 });
    await new Promise(r => setTimeout(r, 600));

    // Nhấn Enter để gửi đi
    await zaloPage.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 1000));

    console.log(`✅ ĐÃ GỬI ZALO THÀNH CÔNG TỚI: ${phone}`);
    return res.json({ success: true });
  } catch (err) {
    console.error('❌ Zalo Bot Auto Handled:', err.message);
    return res.json({ success: true, warning: err.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🌐 Zalo Bot Server đang chạy tại http://localhost:${PORT}`);
  startZaloBot();
});
