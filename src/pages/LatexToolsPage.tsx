// @ts-nocheck
import React, { useState } from 'react';
import { 
  PenTool, FileCode, Image as ImageIcon, Wand2, 
  BookOpen, Zap, Settings, Save, X, Key, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

// Import các Views chuyên dụng
import ExamGeneratorView from '@/components/ExamGeneratorView';
import ImageToLatexView from '@/components/ImageToLatexView';
import SampleQuestionsView from '@/components/SampleQuestionsView';
import TikzDrawView from '@/components/TikzDrawView';
import TikzVisionView from '@/components/TikzVisionView';

type LatexTab = 'generate' | 'draw' | 'vision' | 'ocr' | 'samples';

export default function LatexToolsPage() {
  const [activeTab, setActiveTab] = useState<LatexTab>('generate');
  const [showSettings, setShowSettings] = useState(false);

  // ─── QUẢN LÝ API KEY TỪ GIAO DIỆN ───
  const [geminiKey, setGeminiKey] = useState(() => localStorage.getItem('ocr_gemini_key') || '');
  const [gasUrl, setGasUrl] = useState(() => localStorage.getItem('ocr_gas_url') || '');
  const [tikzApi, setTikzApi] = useState(() => localStorage.getItem('latex_tikz_api') || 'https://tikz-fly.fly.dev');

  const handleSaveSettings = () => {
    localStorage.setItem('ocr_gemini_key', geminiKey);
    localStorage.setItem('ocr_gas_url', gasUrl);
    localStorage.setItem('latex_tikz_api', tikzApi);
    toast.success('Đã cập nhật cấu hình API hệ thống!');
    setShowSettings(false);
    // Refresh để các service như GeminiService cập nhật key mới
    setTimeout(() => window.location.reload(), 500);
  };

  const tabs = [
    { id: 'generate', label: 'Soạn đề AI', icon: Wand2, color: 'text-teal-600' },
    { id: 'draw', label: 'Vẽ hình TikZ', icon: PenTool, color: 'text-blue-600' },
    { id: 'vision', label: 'AI Vẽ hình', icon: Zap, color: 'text-orange-600' },
    { id: 'ocr', label: 'PDF sang LaTeX', icon: ImageIcon, color: 'text-purple-600' },
    { id: 'samples', label: 'Kho mẫu', icon: BookOpen, color: 'text-emerald-600' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* ─── HEADER & SETTINGS BUTTON ─── */}
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-teal-100">
        <div>
          <h1 className="text-2xl font-bold text-teal-800 flex items-center gap-3">
            <FileCode className="w-8 h-8 text-teal-600" /> Công cụ Toán học LaTeX
          </h1>
          <p className="text-sm text-gray-500 mt-1">Hệ thống soạn thảo đề thi và vẽ hình TikZ thông minh</p>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all shadow-sm ${
            showSettings ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-100'
          }`}
        >
          {showSettings ? <X size={18} /> : <Settings size={18} />}
          {showSettings ? 'Đóng' : 'Cấu hình API'}
        </button>
      </div>

      {/* ─── SETTINGS PANEL (NHẬP API KEY) ─── */}
      {showSettings && (
        <div className="bg-amber-50 border-2 border-amber-200 p-6 rounded-3xl shadow-lg animate-in slide-in-from-top-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-amber-900 flex items-center gap-2">
              <Key className="w-5 h-5" /> Cài đặt Chìa khóa Hệ thống
            </h3>
            <div className="text-[10px] bg-amber-200 text-amber-800 px-2 py-1 rounded font-bold uppercase">Lưu tại trình duyệt</div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold text-amber-700 mb-1 uppercase tracking-widest">Gemini API Key (AI Soạn đề & Vẽ hình)</label>
                <div className="relative">
                  <input 
                    type="password" 
                    value={geminiKey} 
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full px-4 py-2.5 rounded-xl border-2 border-amber-200 focus:border-teal-500 outline-none font-mono text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-amber-700 mb-1 uppercase tracking-widest">TikZ Compile Server</label>
                <input 
                  type="text" 
                  value={tikzApi} 
                  onChange={(e) => setTikzApi(e.target.value)}
                  placeholder="https://tikz-fly.fly.dev"
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-amber-200 focus:border-teal-500 outline-none text-sm"
                />
              </div>
            </div>

            <div className="bg-white/50 p-4 rounded-2xl border border-amber-200/50">
              <div className="flex items-start gap-2 text-amber-800 text-xs leading-relaxed">
                <Info size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold mb-1 underline">Hướng dẫn:</p>
                  <ul className="list-disc ml-4 space-y-1">
                    <li>Dán <b>Gemini Key</b> để kích hoạt trí tuệ nhân tạo.</li>
                    <li>Link <b>Compile Server</b> dùng để biến mã TikZ thành hình ảnh.</li>
                    <li>Thông tin này được lưu cục bộ, không gửi về máy chủ quản lý.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button 
              onClick={handleSaveSettings}
              className="flex items-center gap-2 px-8 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg shadow-teal-600/20 transition-all active:scale-95"
            >
              <Save size={18} /> Lưu cấu hình
            </button>
          </div>
        </div>
      )}

      {/* ─── TAB NAVIGATION ─── */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-gray-200/50 rounded-2xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as LatexTab)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeTab === tab.id 
                ? 'bg-white text-teal-700 shadow-md scale-105' 
                : 'text-gray-500 hover:bg-white/60 hover:text-teal-600'
            }`}
          >
            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : 'opacity-40'}`} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── TAB CONTENT ─── */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 min-h-[70vh] overflow-hidden relative">
        {!geminiKey && activeTab !== 'samples' && (
          <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex items-center justify-center p-6 text-center">
            <div className="max-w-md bg-white p-8 rounded-3xl shadow-2xl border border-amber-100">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Key size={32} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Chưa cấu hình API Key</h3>
              <p className="text-gray-500 mb-6 text-sm">Vui lòng bấm vào nút <b>Cấu hình API</b> phía trên và dán Gemini Key để sử dụng tính năng này.</p>
              <button onClick={() => setShowSettings(true)} className="px-6 py-2 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors">Cấu hình ngay</button>
            </div>
          </div>
        )}

        {activeTab === 'generate' && <ExamGeneratorView />}
        
        {activeTab === 'draw' && (
          <div className="p-6">
            <TikzDrawView onTransferToCompile={(code) => {
              toast.success('Đã sao chép mã TikZ!');
              navigator.clipboard.writeText(code);
            }} />
          </div>
        )}

        {activeTab === 'vision' && (
          <div className="p-6">
            <TikzVisionView onTransferToCompile={(code) => {
              toast.success('Đã chuyển mã TikZ!');
              navigator.clipboard.writeText(code);
            }} />
          </div>
        )}

        {activeTab === 'ocr' && (
          <div className="p-6">
            <ImageToLatexView onTransferToConvert={(latex) => {
              toast.success('Đã trích xuất mã LaTeX!');
              navigator.clipboard.writeText(latex);
            }} />
          </div>
        )}

        {activeTab === 'samples' && (
          <div className="p-6">
            <SampleQuestionsView />
          </div>
        )}
      </div>
    </div>
  );
}
