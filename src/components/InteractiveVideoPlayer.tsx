// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import MathText from './MathText';
import toast from 'react-hot-toast';

interface InteractiveVideoPlayerProps {
  lesson: any;
  onComplete: () => void;
}

export default function InteractiveVideoPlayer({ lesson, onComplete }: InteractiveVideoPlayerProps) {
  const questions = lesson.interactive_questions || [];
  const videoId = lesson.video_url?.match(/(?:v=|\/)([a-zA-Z0-9_-]{11})/)?.[1] || '';

  const [player, setPlayer] = useState<any>(null);
  const [activeQuestion, setActiveQuestion] = useState<any>(null);
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
  
  // State khi đang làm câu hỏi
  const [selectedAnswer, setSelectedAnswer] = useState('');
  
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
      const ytPlayer = new window.YT.Player('yt-student-player', {
        videoId: videoId,
        playerVars: { autoplay: 0, controls: 0, modestbranding: 1, rel: 0, showinfo: 0, disablekb: 1 },
        events: {
          onStateChange: (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) startTimeCheck(ytPlayer);
          }
        }
      });
      setPlayer(ytPlayer);
    }

    return () => { window.onYouTubeIframeAPIReady = null; };
  }, [videoId]);

  const timeCheckInterval = useRef<any>(null);

  const startTimeCheck = (ytPlayer: any) => {
    clearInterval(timeCheckInterval.current);
    timeCheckInterval.current = setInterval(() => {
      if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
        const currentTime = Math.floor(ytPlayer.getCurrentTime());
        checkQuestionTrigger(currentTime, ytPlayer);
      }
    }, 1000);
  };

  const checkQuestionTrigger = (currentTime: number, ytPlayer: any) => {
    const q = questions.find((q: any) => currentTime === q.timestamp && !answeredQuestions.has(q.id));
    if (q) {
      ytPlayer.pauseVideo();
      clearInterval(timeCheckInterval.current);
      setActiveQuestion(q);
      setSelectedAnswer('');
    }
    
    // Nếu xem đến gần cuối và đã trả lời hết -> Đánh dấu hoàn thành
    if (ytPlayer.getDuration() > 0 && currentTime >= ytPlayer.getDuration() - 2) {
      if (answeredQuestions.size === questions.length) onComplete();
    }
  };

  const checkAnswer = () => {
    if (!selectedAnswer) return toast.error('Vui lòng chọn hoặc nhập đáp án!');
    
    const isCorrect = 
      activeQuestion.type === 'multiple_choice' 
        ? selectedAnswer === activeQuestion.correctAnswer
        : selectedAnswer.trim().toLowerCase() === activeQuestion.correctAnswer.trim().toLowerCase();

    if (isCorrect) {
      toast.success('Chính xác! Tiếp tục xem video.');
      setAnsweredQuestions(prev => new Set(prev).add(activeQuestion.id));
      setActiveQuestion(null);
      player.playVideo();
      startTimeCheck(player);
    } else {
      toast.error('Sai rồi. Vui lòng thử lại!');
      setSelectedAnswer('');
    }
  };

  const percent = questions.length > 0 ? Math.round((answeredQuestions.size / questions.length) * 100) : 100;

  return (
    <div className="flex flex-col h-full bg-black relative select-none" onContextMenu={e => e.preventDefault()}>
      
      {/* ── Khung Video ── */}
      <div className="flex-1 relative overflow-hidden pointer-events-none">
        <div className="absolute inset-0 w-full h-[150%] -top-[25%]">
           <div id="yt-student-player" className="w-full h-full pointer-events-none"></div>
        </div>
        
        {/* Overlay ngăn chặn click bậy bạ nhưng cho phép click để Play/Pause */}
        <div className="absolute inset-0 z-10 cursor-pointer pointer-events-auto" onClick={() => {
          if(!activeQuestion && player) {
            player.getPlayerState() === 1 ? player.pauseVideo() : player.playVideo();
          }
        }}></div>

        {/* ── Khung Câu hỏi (Hiện lên đè lên video) ── */}
        {activeQuestion && (
          <div className="absolute inset-0 bg-black/90 z-20 flex items-center justify-center pointer-events-auto p-4 animate-fade-in">
            <div className="bg-white rounded-2xl p-8 max-w-xl w-full shadow-2xl">
              <div className="text-teal-600 font-bold mb-4">❓ Câu hỏi tương tác</div>
              <div className="text-lg text-gray-800 mb-6 font-medium"><MathText html={activeQuestion.text} /></div>

              {activeQuestion.type === 'multiple_choice' && (
                <div className="space-y-3">
                  {activeQuestion.options.map((opt: any) => (
                    <button 
                      key={opt.letter} 
                      onClick={() => setSelectedAnswer(opt.letter)}
                      className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition text-left ${
                        selectedAnswer === opt.letter ? 'border-teal-500 bg-teal-50 text-teal-800' : 'border-gray-200 hover:border-teal-200 bg-white'
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold shrink-0 ${selectedAnswer === opt.letter ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{opt.letter}</span>
                      <div className="flex-1"><MathText html={opt.text} /></div>
                    </button>
                  ))}
                </div>
              )}

              {activeQuestion.type === 'short_answer' && (
                <input 
                  type="text" 
                  value={selectedAnswer} 
                  onChange={e => setSelectedAnswer(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && checkAnswer()}
                  placeholder="Nhập đáp án của bạn..." 
                  className="w-full p-4 text-lg border-2 border-gray-300 rounded-xl outline-none focus:border-teal-500" 
                  autoFocus 
                />
              )}

              <button onClick={checkAnswer} className="mt-8 w-full py-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-lg shadow-lg transition">
                Kiểm tra đáp án
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Thanh Tiến trình ở dưới ── */}
      <div className="h-16 bg-gray-900 text-white flex flex-col justify-center px-6">
        <div className="flex justify-between text-xs text-gray-400 font-bold mb-2">
          <span>Tiến độ câu hỏi: {answeredQuestions.size}/{questions.length}</span>
          <span>{percent}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-teal-500 transition-all duration-500" style={{ width: `${percent}%` }}></div>
        </div>
      </div>
    </div>
  );
}
