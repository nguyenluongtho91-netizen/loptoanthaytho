// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Save, Clock, Trash2, FileUp, RefreshCw, ChevronRight, CheckCircle2 } from 'lucide-react';
import MathText from './MathText';
import { parseWordToExam } from '@/services/mathWordParserService';

interface InteractiveVideoEditorProps {
  lesson: any;
  onSave: (questions: any[]) => Promise<void>;
  onClose: () => void;
}

// Tab của panel phải
type RightTab = 'list' | 'manual' | 'import';

export default function InteractiveVideoEditor({ lesson, onSave, onClose }: InteractiveVideoEditorProps) {
  const [questions, setQuestions] = useState<any[]>(lesson.interactive_questions || []);
  const [player, setPlayer] = useState<any>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  // Tab điều hướng panel phải
  const [rightTab, setRightTab] = useState<RightTab>('list');

  // State form nhập tay
  const [qType, setQType] = useState('multiple_choice');
  const [qText, setQText] = useState('');
  const [qOptions, setQOptions] = useState([
    { letter: 'A', text: '' }, { letter: 'B', text: '' },
    { letter: 'C', text: '' }, { letter: 'D', text: '' }
  ]);
  const [qCorrect, setQCorrect] = useState('A');

  // State import Word
  const [importedQuestions, setImportedQuestions] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set()); // track câu đã thêm
  const wordFileRef = useRef<HTMLInputElement>(null);

  // Lấy Video ID từ URL Youtube
  const videoId = lesson.video_url?.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] || '';

  // Khởi tạo Youtube Player API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }

    window.onYouTubeIframeAPIReady = initPlayer;
    if (window.YT && window.YT.Player) initPlayer();

    function initPlayer() {
      const ytPlayer = new window.YT.Player('yt-editor-player', {
        videoId: videoId,
        playerVars: { controls: 1, modestbranding: 1, rel: 0 },
      });
      setPlayer(ytPlayer);
    }

    return () => { window.onYouTubeIframeAPIReady = null; };
  }, [videoId]);

  // Cập nhật thời gian liên tục
  useEffect(() => {
    const timer = setInterval(() => {
      if (player && typeof player.getCurrentTime === 'function') {
        setCurrentTime(Math.floor(player.getCurrentTime()));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [player]);

  const formatTime = (sec: number) => `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  // ── Thêm câu hỏi nhập tay ────────────────────────────────
  const handleSaveManual = () => {
    if (!qText.trim()) return alert('Vui lòng nhập nội dung câu hỏi!');
    if (player) player.pauseVideo?.();
    const newQ = {
      id: Date.now().toString(),
      timestamp: currentTime,
      type: qType,
      text: qText,
      options: qType === 'multiple_choice' ? qOptions : [],
      correctAnswer: qCorrect,
    };
    setQuestions(prev => [...prev, newQ].sort((a, b) => a.timestamp - b.timestamp));
    setQText('');
    setQOptions([{ letter: 'A', text: '' }, { letter: 'B', text: '' }, { letter: 'C', text: '' }, { letter: 'D', text: '' }]);
    setQCorrect('A');
    setRightTab('list');
  };

  // ── Import từ Word ────────────────────────────────────────
  const handleWordFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setImportedQuestions([]);
    setAddedIds(new Set());
    try {
      const examData = await parseWordToExam(file);
      // Chỉ lấy multiple_choice và short_answer (phù hợp với timeline)
      const filtered = examData.questions.filter(
        (q: any) => q.type === 'multiple_choice' || q.type === 'short_answer'
      );
      setImportedQuestions(filtered);
    } catch (err: any) {
      alert('Lỗi đọc file Word: ' + err.message);
    } finally {
      setIsImporting(false);
      if (wordFileRef.current) wordFileRef.current.value = '';
    }
  };

  // Thêm 1 câu từ ngân hàng vào timeline tại thời điểm hiện tại
  const handleAddFromBank = (q: any) => {
    if (player) player.pauseVideo?.();
    const newQ = {
      id: Date.now().toString(),
      timestamp: currentTime,
      type: q.type === 'multiple_choice' ? 'multiple_choice' : 'short_answer',
      text: q.text,
      options: (q.options || []).map((o: any) => ({ letter: o.letter, text: o.text })),
      correctAnswer: q.correctAnswer || '',
    };
    setQuestions(prev => [...prev, newQ].sort((a, b) => a.timestamp - b.timestamp));
    setAddedIds(prev => new Set([...prev, q.number]));
  };

  // ── Lưu toàn bộ ─────────────────────────────────────────
  const handleSaveAll = async () => {
    setIsSaving(true);
    await onSave(questions);
    setIsSaving(false);
  };

  // ── Tab labels ───────────────────────────────────────────
  const tabs: { key: RightTab; label: string }[] = [
    { key: 'list', label: `Danh sách (${questions.length})` },
    { key: 'manual', label: 'Nhập tay' },
    { key: 'import', label: 'Import Word' },
  ];

  const typeLabel = (type: string) =>
    type === 'multiple_choice' ? 'Trắc nghiệm' : type === 'short_answer' ? 'Trả lời ngắn' : type;

  const typeBadgeColor = (type: string) =>
    type === 'multiple_choice'
      ? 'bg-blue-100 text-blue-700'
      : 'bg-orange-100 text-orange-700';

  return (
    <div className="fixed inset-0 z-50 bg-gray-100 flex flex-col">

      {/* Header */}
      <div className="bg-teal-700 text-white px-6 py-4 flex justify-between items-center shadow-md shrink-0">
        <h2 className="font-bold text-lg truncate">🎬 {lesson.title}</h2>
        <div className="flex gap-3">
          <button onClick={onClose} className="px-4 py-2 hover:bg-teal-600 rounded-lg text-sm">Đóng</button>
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="bg-orange-500 hover:bg-orange-600 px-6 py-2 rounded-lg font-bold flex items-center gap-2 text-sm"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Đang lưu...' : 'Lưu cài đặt'}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">

        {/* LEFT: Video Player */}
        <div className="flex-1 p-6 flex flex-col min-w-0">
          <div className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-lg">
            <div id="yt-editor-player" className="w-full h-full" />
          </div>

          {/* Thanh thời gian + nút thêm nhanh */}
          <div className="mt-4 flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 text-teal-700 font-mono font-bold text-xl">
              <Clock className="w-6 h-6" />
              {formatTime(currentTime)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { if (player) player.pauseVideo?.(); setRightTab('manual'); }}
                className="btn-teal flex items-center gap-2 px-5 py-2.5 text-sm"
              >
                <Plus className="w-4 h-4" /> Nhập tay tại {formatTime(currentTime)}
              </button>
              <button
                onClick={() => setRightTab('import')}
                className="flex items-center gap-2 px-5 py-2.5 text-sm bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition"
              >
                <FileUp className="w-4 h-4" /> Import Word
              </button>
            </div>
          </div>

          {/* Timeline mini */}
          {questions.length > 0 && (
            <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                Timeline ({questions.length} câu hỏi)
              </p>
              <div className="flex gap-2 flex-wrap">
                {questions.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => player?.seekTo?.(q.timestamp)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-full text-xs font-mono font-bold text-teal-700 transition"
                    title={q.text}
                  >
                    ⏱ {formatTime(q.timestamp)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Tabbed Panel */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-xl shrink-0">

          {/* Tabs */}
          <div className="flex border-b border-gray-200 shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setRightTab(tab.key)}
                className={`flex-1 py-3 text-xs font-bold transition-colors ${
                  rightTab === tab.key
                    ? 'border-b-2 border-teal-600 text-teal-700 bg-teal-50/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Danh sách ── */}
          {rightTab === 'list' && (
            <div className="flex-1 overflow-y-auto p-4">
              {questions.length === 0 ? (
                <div className="text-center mt-16 text-gray-400">
                  <Clock className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm italic">Chưa có câu hỏi nào trên timeline.</p>
                  <p className="text-xs mt-1">Dùng "Nhập tay" hoặc "Import Word"</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {questions.map((q) => (
                    <div
                      key={q.id}
                      className="p-3 border border-gray-100 rounded-xl bg-gray-50 hover:border-teal-300 transition cursor-pointer group"
                      onClick={() => player?.seekTo?.(q.timestamp)}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="bg-teal-100 text-teal-800 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono">
                          ⏱ {formatTime(q.timestamp)}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setQuestions(prev => prev.filter(item => item.id !== q.id)); }}
                          className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm font-medium text-gray-700 line-clamp-2">
                        <MathText html={q.text} />
                      </p>
                      <span className={`mt-1.5 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${typeBadgeColor(q.type)}`}>
                        {typeLabel(q.type)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Nhập tay ── */}
          {rightTab === 'manual' && (
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 text-xs text-teal-700 font-bold flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" /> Gắn vào: {formatTime(currentTime)}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Loại câu hỏi</label>
                <select value={qType} onChange={e => setQType(e.target.value)} className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-teal-500 outline-none">
                  <option value="multiple_choice">Trắc nghiệm (4 đáp án)</option>
                  <option value="short_answer">Trả lời ngắn</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">Nội dung câu hỏi (hỗ trợ LaTeX $...$)</label>
                <textarea
                  rows={4}
                  value={qText}
                  onChange={e => setQText(e.target.value)}
                  className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:border-teal-500 outline-none resize-none"
                  placeholder="VD: Tính $\sqrt{4}$"
                />
                {qText && (
                  <div className="mt-1.5 p-2.5 bg-white border border-gray-100 rounded-lg text-sm text-gray-700">
                    <MathText html={qText} />
                  </div>
                )}
              </div>

              {qType === 'multiple_choice' && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-gray-500">Phương án (chọn đáp án đúng)</label>
                  {qOptions.map((opt, i) => (
                    <div key={opt.letter} className="flex gap-2 items-center">
                      <input
                        type="radio"
                        name="correct"
                        checked={qCorrect === opt.letter}
                        onChange={() => setQCorrect(opt.letter)}
                        className="w-4 h-4 accent-teal-600 cursor-pointer shrink-0"
                      />
                      <span className="font-bold text-sm w-5 shrink-0">{opt.letter}.</span>
                      <input
                        type="text"
                        value={opt.text}
                        onChange={e => { const o = [...qOptions]; o[i].text = e.target.value; setQOptions(o); }}
                        className="flex-1 p-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-teal-400"
                        placeholder={`Nội dung ${opt.letter}`}
                      />
                    </div>
                  ))}
                </div>
              )}

              {qType === 'short_answer' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Đáp án đúng</label>
                  <input
                    type="text"
                    value={qCorrect}
                    onChange={e => setQCorrect(e.target.value)}
                    className="w-full p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-teal-500"
                    placeholder="VD: 2"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={() => setRightTab('list')} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold hover:bg-gray-50 transition">
                  Hủy
                </button>
                <button onClick={handleSaveManual} className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold transition">
                  Thêm vào timeline
                </button>
              </div>
            </div>
          )}

          {/* ── Tab: Import Word ── */}
          {rightTab === 'import' && (
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* Upload area */}
              <div className="p-4 border-b border-gray-100 shrink-0">
                <label className={`flex flex-col items-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer transition
                  ${isImporting ? 'border-violet-300 bg-violet-50' : 'border-gray-200 hover:border-violet-400 hover:bg-violet-50/50'}`}>
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-7 h-7 text-violet-500 animate-spin" />
                      <span className="text-sm font-bold text-violet-600">Đang phân tích file...</span>
                    </>
                  ) : (
                    <>
                      <FileUp className="w-7 h-7 text-violet-400" />
                      <span className="text-sm font-bold text-gray-600">Upload file Word (.docx)</span>
                      <span className="text-xs text-gray-400">Tự động parse câu hỏi trắc nghiệm</span>
                    </>
                  )}
                  <input
                    ref={wordFileRef}
                    type="file"
                    accept=".docx"
                    className="hidden"
                    onChange={handleWordFileChange}
                    disabled={isImporting}
                  />
                </label>

                {importedQuestions.length > 0 && (
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">
                      Tìm thấy <span className="text-violet-600">{importedQuestions.length}</span> câu hỏi
                    </span>
                    <div className="flex items-center gap-1 text-xs text-teal-600 font-bold bg-teal-50 px-2 py-1 rounded-full">
                      <Clock className="w-3 h-3" /> Gắn vào: {formatTime(currentTime)}
                    </div>
                  </div>
                )}
              </div>

              {/* Danh sách câu hỏi từ Word */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {importedQuestions.length === 0 && !isImporting && (
                  <div className="text-center mt-12 text-gray-400">
                    <p className="text-sm italic">Upload file Word để hiển thị danh sách câu hỏi</p>
                  </div>
                )}

                {importedQuestions.map((q: any) => {
                  const alreadyAdded = addedIds.has(q.number);
                  return (
                    <div
                      key={q.number}
                      className={`p-3 rounded-xl border transition ${
                        alreadyAdded
                          ? 'bg-teal-50 border-teal-200 opacity-70'
                          : 'bg-white border-gray-100 hover:border-violet-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${typeBadgeColor(q.type)}`}>
                              {typeLabel(q.type)}
                            </span>
                            {q.options?.length > 0 && (
                              <span className="text-[10px] text-gray-400">{q.options.length} phương án</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-700 line-clamp-3 leading-relaxed">
                            <MathText html={q.text} />
                          </p>
                        </div>

                        <button
                          onClick={() => handleAddFromBank(q)}
                          disabled={alreadyAdded}
                          className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${
                            alreadyAdded
                              ? 'bg-teal-100 text-teal-600 cursor-default'
                              : 'bg-orange-500 hover:bg-orange-600 text-white'
                          }`}
                        >
                          {alreadyAdded ? (
                            <><CheckCircle2 className="w-3.5 h-3.5" /> Đã thêm</>
                          ) : (
                            <><Plus className="w-3.5 h-3.5" /> {formatTime(currentTime)}</>
                          )}
                        </button>
                      </div>

                      {/* Preview đáp án */}
                      {q.correctAnswer && (
                        <p className="mt-1.5 text-[10px] text-gray-400">
                          Đáp án: <span className="font-bold text-teal-600">{q.correctAnswer}</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Footer hint */}
              {importedQuestions.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 shrink-0">
                  <p className="text-[11px] text-gray-400 text-center">
                    Tua video đến vị trí muốn, bấm <strong>+ [thời gian]</strong> để gắn câu hỏi
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
