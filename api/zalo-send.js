/**
 * api/zalo-send.js
 * Serverless API proxy cho Zalo Official Account (OA) OpenAPI
 * Giải quyết vấn đề CORS & refresh token khi gọi Zalo API từ Client trên Vercel
 */

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const {
      phone,
      message,
      appId = process.env.VITE_ZALO_APP_ID || process.env.ZALO_APP_ID,
      appSecret = process.env.VITE_ZALO_APP_SECRET || process.env.ZALO_APP_SECRET,
      refreshToken = process.env.VITE_ZALO_REFRESH_TOKEN || process.env.ZALO_REFRESH_TOKEN,
      accessToken: directAccessToken,
      action // 'send' | 'test'
    } = req.body || {};

    let accessToken = directAccessToken;
    let newRefreshToken = null;

    // 1. Nếu không truyền trực tiếp Access Token, tiến hành đổi từ Refresh Token qua Zalo OAuth
    if (!accessToken && appId && appSecret && refreshToken) {
      const oauthRes = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'secret_key': appSecret,
        },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          app_id: appId,
          grant_type: 'refresh_token',
        }),
      });

      const oauthData = await oauthRes.json();
      if (oauthData.access_token) {
        accessToken = oauthData.access_token;
        newRefreshToken = oauthData.refresh_token || null;
      } else {
        return res.status(400).json({
          success: false,
          errorCode: 'TOKEN_EXPIRED',
          message: `Lỗi Zalo OAuth: ${oauthData.message || oauthData.error_name || 'Mã Refresh Token đã hết hạn hoặc không hợp lệ'}`,
          zaloDetails: oauthData
        });
      }
    }

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        errorCode: 'UNCONFIGURED',
        message: 'Chưa cấu hình thông tin Zalo OA (App ID, Secret Key, Refresh Token)'
      });
    }

    if (action === 'test') {
      return res.json({
        success: true,
        message: 'Kết nối Zalo OA thành công!',
        accessToken,
        newRefreshToken
      });
    }

    if (!phone || !message) {
      return res.status(400).json({ success: false, message: 'Thiếu số điện thoại hoặc nội dung tin nhắn' });
    }

    // Chuẩn hóa số điện thoại dạng 84xxxxxxxxx
    let formattedPhone = String(phone).replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '84' + formattedPhone.slice(1);
    }

    const isUserId = formattedPhone.length > 13;
    const recipientPayload = isUserId ? { user_id: formattedPhone } : { phone_number: formattedPhone };

    // Gửi tin CSKH qua Zalo CS API
    let response = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': accessToken,
      },
      body: JSON.stringify({
        recipient: recipientPayload,
        message: { text: message },
      }),
    });

    let result = await response.json();

    // Thử lại bằng Promotion API nếu gặp lỗi -201 (cần user_id)
    if (result.error === -201 && !isUserId) {
      let rawPhone = formattedPhone;
      if (rawPhone.startsWith('84')) rawPhone = '0' + rawPhone.slice(2);

      const altRes = await fetch('https://openapi.zalo.me/v3.0/oa/message/promotion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': accessToken,
        },
        body: JSON.stringify({
          recipient: { phone_number: rawPhone },
          message: { text: message },
        }),
      });
      result = await altRes.json();
    }

    if (result.error === 0) {
      return res.json({
        success: true,
        message: 'Gửi tin nhắn Zalo OA thành công!',
        zaloData: result,
        newRefreshToken
      });
    } else {
      return res.status(400).json({
        success: false,
        errorCode: result.error,
        message: `Lỗi Zalo (Mã ${result.error}): ${result.message || 'Không thể gửi tin nhắn'}`,
        zaloData: result
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Lỗi Server Zalo API: ${error.message}`
    });
  }
}
