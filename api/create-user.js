import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Chỉ chấp nhận method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password, name, role } = req.body;

  // LƯU Ý: Sử dụng SERVICE_ROLE_KEY để có quyền Admin bỏ qua RLS
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL, 
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  try {
    // 1. Tạo user trong hệ thống Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // Tự động xác thực email để đăng nhập được ngay
      user_metadata: { name: name }
    });

    if (authError) throw authError;

    // 2. Cập nhật thông tin vào bảng public.profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ name: name, role: role, active: true })
      .eq('id', authData.user.id);

    if (profileError) throw profileError;

    // Trả về kết quả thành công cho Frontend
    return res.status(200).json({ ok: true, user: authData.user });
    
  } catch (error) {
    console.error("Lỗi khi tạo người dùng:", error);
    return res.status(400).json({ ok: false, error: error.message });
  }
}
