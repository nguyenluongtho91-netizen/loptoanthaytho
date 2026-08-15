// src/services/sessionService.ts
import { supabase } from '@/lib/supabase';
import { useEffect, useRef, useCallback } from 'react';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

export const generateSessionId = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

const getDeviceInfo = (): string => {
  const ua = navigator.userAgent;
  if (/mobile/i.test(ua)) return 'Mobile Browser';
  if (/tablet|ipad/i.test(ua)) return 'Tablet Browser';
  return 'Desktop Browser';
};

const getDocId = (roomId: string, studentId: string) => `${roomId}_${studentId}`;

// ─── DATABASE OPERATIONS ─────────────────────────────────────────────────────

export const registerSession = async (params: {
  roomId: string;
  studentId: string;
  studentName: string;
  sessionId: string;
  className?: string;
  totalQuestions: number;
  timeRemaining: number;
}) => {
  const id = getDocId(params.roomId, params.studentId);
  
  const { data: existing } = await supabase
    .from('exam_sessions')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  const sessionData = {
    id,
    room_id: params.roomId,
    student_id: params.studentId,
    session_id: params.sessionId,
    student_name: params.studentName,
    class_name: params.className || '',
    device_info: getDeviceInfo(),
    total_questions: params.totalQuestions,
    time_remaining: params.timeRemaining,
    last_heartbeat: new Date().toISOString(),
    status: existing?.status === 'submitted' ? 'submitted' : 'active',
    tab_switches: existing?.tab_switches || 0,
    violations: existing?.violations || [],
    answered_count: existing?.answered_count || 0
  };

  const { error } = await supabase.from('exam_sessions').upsert(sessionData);
  if (error) console.error("Lỗi đăng ký session:", error);
};

export const sendHeartbeat = async (roomId: string, studentId: string, payload: any) => {
  await supabase
    .from('exam_sessions')
    .update({
      last_heartbeat: new Date().toISOString(),
      answered_count: payload.answeredCount,
      time_remaining: payload.timeRemaining,
      tab_switches: payload.tabSwitches
    })
    .eq('id', getDocId(roomId, studentId));
};

export const recordViolation = async (roomId: string, studentId: string, violation: any) => {
  const id = getDocId(roomId, studentId);
  const { data } = await supabase.from('exam_sessions').select('violations, tab_switches').eq('id', id).single();
  const currentViolations = data?.violations || [];
  
  await supabase
    .from('exam_sessions')
    .update({
      violations: [...currentViolations, violation],
      tab_switches: violation.type === 'tab_switch' ? (data?.tab_switches || 0) + 1 : (data?.tab_switches || 0)
    })
    .eq('id', id);
};

// ─── REACT HOOK ──────────────────────────────────────────────────────────────

interface UseExamSessionOptions {
  roomId: string;
  studentId: string;
  studentName: string;
  sessionId: string;
  className?: string;
  totalQuestions: number;
  onKicked?: (deviceInfo: string) => void;
}

export function useExamSession({ roomId, studentId, studentName, sessionId, className, totalQuestions, onKicked }: UseExamSessionOptions) {
  const tabSwitchRef = useRef(0);
  const heartbeatInterval = useRef<any>(null);
  const timeRemainingRef = useRef(0);
  const answeredCountRef = useRef(0);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      await registerSession({
        roomId, studentId, studentName, sessionId, className,
        totalQuestions, timeRemaining: timeRemainingRef.current
      });

      if (!isMounted) return;

      const channel = supabase
        .channel(`session_${studentId}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'exam_sessions',
          filter: `id=eq.${getDocId(roomId, studentId)}`
        }, (payload) => {
          if (payload.new.session_id !== sessionId) {
            onKicked?.(payload.new.device_info || 'Thiết bị khác');
          }
        }).subscribe();

      heartbeatInterval.current = setInterval(() => {
        sendHeartbeat(roomId, studentId, {
          answeredCount: answeredCountRef.current,
          timeRemaining: timeRemainingRef.current,
          tabSwitches: tabSwitchRef.current
        });
      }, 10000);

      return () => {
        supabase.removeChannel(channel);
      };
    };

    init();

    return () => {
      isMounted = false;
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    };
  }, [roomId, studentId, sessionId]);

  const reportTabSwitch = useCallback(() => {
    tabSwitchRef.current += 1;
    recordViolation(roomId, studentId, {
      type: 'tab_switch', timestamp: new Date().toISOString(), detail: `Lần ${tabSwitchRef.current}`
    });
  }, [roomId, studentId]);

  const updateProgress = useCallback((answered: number, timeLeft: number) => {
    answeredCountRef.current = answered;
    timeRemainingRef.current = timeLeft;
  }, []);

  const submitSession = useCallback(async () => {
    await supabase.from('exam_sessions').update({ status: 'submitted', last_heartbeat: new Date().toISOString() }).eq('id', getDocId(roomId, studentId));
  }, [roomId, studentId]);

  return { reportTabSwitch, updateProgress, submitSession };
}
