import { useNavigate } from 'react-router-dom';
import TexExamCreator from '@/components/TexExamCreator';
import { createExam } from '@/services/supabaseService';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export default function CreateTexExamPage() {
  const navigate = useNavigate();
  // ✅ Gọi thẳng từ store thay vì import auth bị lỗi từ supabaseService cũ
  const { user } = useAuthStore() as any;

  const handleSaveExam = async (finalExamData: any) => {
    try {
      await createExam(finalExamData);
      toast.success('🎉 Đã tạo đề thi LaTeX thành công!');
      navigate('/exams'); 
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Lỗi khi lưu đề thi vào hệ thống');
    }
  };

  return (
    <div className="max-w-5xl mx-auto py-6">
      <TexExamCreator
        teacherId={user?.id || ''}
        onSave={handleSaveExam}
        onCancel={() => navigate('/exams')}
      />
    </div>
  );
}
