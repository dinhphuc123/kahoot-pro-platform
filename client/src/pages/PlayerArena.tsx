import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import {
  CheckCircle2,
  XCircle,
  Flame,
  Send,
  Sparkles,
  Trophy,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { KIDS_AVATARS, type Question, type RoomSettings } from '../types.ts';
import { API_BASE } from '../utils/api.ts';
import { MathText } from '../components/MathText.tsx';
import { MediaStage } from '../components/MediaStage.tsx';
import { AnswerGrid } from '../components/AnswerGrid.tsx';

export const PlayerArena: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);

  const [pin, setPin] = useState(searchParams.get('pin') || '');
  const [nickname, setNickname] = useState(searchParams.get('name') || '');
  const [joined, setJoined] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [quizTitle, setQuizTitle] = useState('');
  const [phase, setPhase] = useState<
    'LOBBY' | 'QUESTION_PREVIEW' | 'QUESTION_ACTIVE' | 'SUBMITTED' | 'RESULT' | 'PODIUM'
  >('LOBBY');

  const [settings, setSettings] = useState<RoomSettings>({
    mediaDeliveryMode: 'PROJECTOR_FIRST',
    pacingMode: 'MEDIA_FIRST',
    shuffleQuestions: false,
    shuffleOptions: false,
    showOptionTextOnPlayer: true,
    isLocked: false,
  });

  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [rank, setRank] = useState(1);

  const [lastResult, setLastResult] = useState<{
    isCorrect: boolean;
    earnedPoints: number;
    streakBonus: number;
    explanation?: string;
    correctOptionIds: string[];
  } | null>(null);

  useEffect(() => {
    const socket = io(API_BASE || window.location.origin);
    socketRef.current = socket;

    socket.on('connect', () => {
      // Check if we have a saved playerSessionToken for auto-reconnect
      const savedSessionRaw = localStorage.getItem('kahoot_pro_player_session');
      if (savedSessionRaw) {
        try {
          const parsed = JSON.parse(savedSessionRaw);
          const targetPin = searchParams.get('pin') || parsed.pin;
          if (parsed.token && parsed.pin === targetPin) {
            socket.emit(
              'player:reconnect',
              { pin: parsed.pin, playerSessionToken: parsed.token },
              (res: {
                ok: boolean;
                pin?: string;
                quizTitle?: string;
                state?: string;
                settings?: RoomSettings;
                alreadyAnswered?: boolean;
                player?: { nickname: string; score: number; streak: number };
                currentQuestion?: { state: string; question: Question };
              }) => {
                if (res?.ok && res.player) {
                  setPin(res.pin || parsed.pin);
                  setNickname(res.player.nickname);
                  setScore(res.player.score);
                  setStreak(res.player.streak);
                  setQuizTitle(res.quizTitle || '');
                  if (res.settings) setSettings(res.settings);
                  setJoined(true);
                  if (res.currentQuestion) {
                    setCurrentQuestion(res.currentQuestion.question);
                    setPhase(
                      res.alreadyAnswered
                        ? 'SUBMITTED'
                        : (res.currentQuestion.state as 'QUESTION_PREVIEW' | 'QUESTION_ACTIVE')
                    );
                  }
                }
              }
            );
          }
        } catch {
          // ignore invalid JSON
        }
      }
    });

    socket.on('room:lobby-update', (data) => {
      if (data.settings) setSettings(data.settings);
    });

    socket.on('room:question', (data) => {
      setCurrentQuestion(data.question);
      setSelectedOptionIds([]);
      setTypedAnswer('');
      setLastResult(null);
      if (data.settings) setSettings(data.settings);
      setPhase(data.state === 'QUESTION_PREVIEW' ? 'QUESTION_PREVIEW' : 'QUESTION_ACTIVE');
    });

    socket.on('player:question-result', (data) => {
      setScore(data.totalScore ?? 0);
      setStreak(data.streak ?? 0);
      setRank(data.rank ?? 1);
      setLastResult({
        isCorrect: Boolean(data.isCorrect),
        earnedPoints: data.earnedPoints || 0,
        streakBonus: data.streakBonus || 0,
        explanation: data.explanation || '',
        correctOptionIds: data.correctOptionIds || [],
      });
      setPhase('RESULT');
    });

    socket.on('room:podium', (data) => {
      setPhase('PODIUM');
      if (Array.isArray(data.leaderboard)) {
        const me = data.leaderboard.find(
          (item: { nickname: string }) => item.nickname === nickname
        );
        if (me) {
          setScore(me.score);
          setRank(me.rank);
        }
      }
    });

    socket.on('player:kicked', (data) => {
      localStorage.removeItem('kahoot_pro_player_session');
      setJoined(false);
      setErrorMsg(data?.reason || 'Bạn đã bị mời rời khỏi phòng.');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const cleanPin = pin.replace(/\D/g, '');
    if (!cleanPin) {
      setErrorMsg('Vui lòng nhập mã PIN 6 chữ số.');
      return;
    }

    socketRef.current?.emit(
      'player:join',
      { pin: cleanPin, nickname },
      (res: {
        ok: boolean;
        error?: string;
        pin?: string;
        nickname?: string;
        playerSessionToken?: string;
        quizTitle?: string;
        settings?: RoomSettings;
      }) => {
        if (!res?.ok) {
          setErrorMsg(res?.error || 'Không thể vào phòng.');
          return;
        }
        setJoined(true);
        setPin(res.pin || cleanPin);
        setNickname(res.nickname || nickname);
        setQuizTitle(res.quizTitle || '');
        if (res.settings) setSettings(res.settings);

        if (res.playerSessionToken) {
          localStorage.setItem(
            'kahoot_pro_player_session',
            JSON.stringify({
              pin: res.pin || cleanPin,
              token: res.playerSessionToken,
              nickname: res.nickname,
            })
          );
        }
      }
    );
  };

  const handleToggleOption = (optionId: string) => {
    if (!currentQuestion || phase === 'SUBMITTED' || phase === 'RESULT') return;

    if (currentQuestion.type === 'MULTIPLE_CHOICE') {
      setSelectedOptionIds((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
      );
      return;
    }

    // SINGLE_CHOICE or TRUE_FALSE -> submit immediately on tap
    setSelectedOptionIds([optionId]);
    submitAnswerToServer([optionId]);
  };

  const submitAnswerToServer = (ids: string[]) => {
    if (ids.length === 0) return;
    const savedRaw = localStorage.getItem('kahoot_pro_player_session');
    const token = savedRaw ? JSON.parse(savedRaw).token : undefined;

    socketRef.current?.emit(
      'player:submit-answer',
      {
        pin,
        selectedOptionIds: ids,
        playerSessionToken: token,
      },
      (res: { ok: boolean; error?: string }) => {
        if (res?.ok) {
          setPhase('SUBMITTED');
        } else if (res?.error) {
          setErrorMsg(res.error);
        }
      }
    );
  };

  if (!joined) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5">
          <div className="text-center">
            <h1 className="text-2xl font-black">Tham Gia Phòng Chơi</h1>
            <p className="text-xs text-slate-400 mt-1">
              Nhập mã PIN trên màn hình chính của Giáo viên / Host
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/90 border border-rose-500 text-rose-200 text-xs font-bold text-center">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleJoinRoom} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-400 mb-1">
                Mã PIN Phòng
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-center text-2xl font-black tracking-widest text-amber-300"
                placeholder="123456"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase text-slate-400 mb-1">
                Tên của bạn (Hoặc chạm chọn Hình Con Vật bên dưới cho Bé Mầm Non)
              </label>
              <input
                type="text"
                maxLength={28}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 text-center text-base font-bold text-white"
                placeholder="VD: Minh Anh 12A1"
              />

              {/* Preschool 1-Tap Animal Avatar Grid */}
              <div className="mt-3">
                <div className="text-[11px] font-black uppercase text-amber-300 mb-1.5 text-center">
                  🧸 Bé Mầm Non Chọn Hình Đại Diện (1 Chạm Không Cần Gõ Chữ):
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {KIDS_AVATARS.map((av) => {
                    const fullLabel = `${av.emoji} ${av.name}`;
                    const selected = nickname === fullLabel;
                    return (
                      <button
                        key={av.name}
                        type="button"
                        onClick={() => setNickname(fullLabel)}
                        className={`p-2 rounded-2xl border flex flex-col items-center gap-0.5 transition ${
                          selected
                            ? 'bg-amber-400 text-slate-950 border-white scale-105 shadow-lg font-black'
                            : 'bg-slate-950 border-slate-800 text-slate-200 hover:border-amber-400/50 font-bold'
                        }`}
                      >
                        <span className="text-2xl">{av.emoji}</span>
                        <span className="text-[10px] truncate max-w-full">{av.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-base kahoot-shadow"
            >
              VÀO PHÒNG NGAY
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
      {/* Player Status Top Bar */}
      <header className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-indigo-600/30 border border-indigo-400/40 text-indigo-200 text-xs font-black">
            PIN: {pin}
          </span>
          <span className="font-black text-sm sm:text-base truncate max-w-[160px]">{nickname}</span>
        </div>

        <div className="flex items-center gap-3">
          {streak >= 2 && (
            <span className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-current" /> {streak}
            </span>
          )}
          <span className="px-3 py-1 rounded-xl bg-slate-800 font-black text-sm text-emerald-300">
            {score} đ
          </span>
        </div>
      </header>

      {/* Main Player Body */}
      <main className="flex-1 max-w-3xl w-full mx-auto p-4 flex flex-col justify-center">
        {phase === 'LOBBY' && (
          <div className="text-center space-y-4 p-8 rounded-3xl bg-slate-900/80 border border-slate-800">
            <Sparkles className="w-12 h-12 text-amber-400 mx-auto animate-pulse" />
            <h2 className="text-2xl font-black">Bạn đã vào sảnh chờ!</h2>
            <p className="text-sm text-slate-300">
              Tên của bạn <strong className="text-indigo-300">{nickname}</strong> đã xuất hiện trên màn hình chính. Hãy nhìn lên màn hình để chuẩn bị!
            </p>
            <div className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" /> Đã bật bảo vệ kết nối (Tự động khôi phục điểm nếu lỡ F5)
            </div>
          </div>
        )}

        {(phase === 'QUESTION_PREVIEW' || phase === 'QUESTION_ACTIVE') && currentQuestion && (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center">
              <div className="text-base sm:text-xl font-black">
                <MathText text={currentQuestion.text} />
              </div>
              {phase === 'QUESTION_PREVIEW' && (
                <div className="mt-2 text-xs font-bold text-amber-300">
                  Hãy xem tình huống Media trước khi đồng hồ đếm ngược bắt đầu!
                </div>
              )}
            </div>

            <MediaStage
              mediaType={currentQuestion.mediaType}
              mediaUrl={currentQuestion.mediaUrl}
              startTime={currentQuestion.mediaStartTime}
              endTime={currentQuestion.mediaEndTime}
              imageReveal={currentQuestion.imageReveal || 'NONE'}
              role="PLAYER"
              deliveryMode={settings.mediaDeliveryMode}
              autoPlay={settings.mediaDeliveryMode === 'SYNC_ALL_DEVICES'}
            />

            {currentQuestion.type === 'SLIDE' ? (
              <div className="p-6 rounded-3xl bg-slate-900 border border-indigo-500/40 text-center space-y-2">
                <div className="text-xs font-black uppercase text-amber-300">
                  Slide Bài Giảng / Kiến Thức
                </div>
                <div className="text-base sm:text-lg font-bold text-slate-100">
                  <MathText text={currentQuestion.explanation || 'Hãy theo dõi nội dung trên màn hình chính.'} />
                </div>
              </div>
            ) : currentQuestion.type === 'TYPE_ANSWER' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!typedAnswer.trim()) return;
                  submitAnswerToServer([typedAnswer.trim()]);
                }}
                className="p-5 rounded-3xl bg-slate-900 border border-indigo-500/40 space-y-3"
              >
                <label className="block text-xs font-black uppercase text-amber-300 text-center">
                  Nhập đáp án của bạn vào ô bên dưới:
                </label>
                <input
                  type="text"
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  placeholder="Gõ đáp số hoặc từ khóa..."
                  className="w-full px-4 py-3.5 rounded-2xl bg-white text-slate-950 font-black text-lg text-center focus:outline-none"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-base flex items-center justify-center gap-2 kahoot-shadow"
                >
                  <Send className="w-5 h-5" /> GỬI ĐÁP ÁN
                </button>
              </form>
            ) : (
              <>
                <AnswerGrid
                  options={currentQuestion.options}
                  questionType={currentQuestion.type}
                  selectedIds={selectedOptionIds}
                  onToggleOption={handleToggleOption}
                  hideText={!settings.showOptionTextOnPlayer}
                />

                {currentQuestion.type === 'MULTIPLE_CHOICE' && (
                  <button
                    type="button"
                    disabled={selectedOptionIds.length === 0}
                    onClick={() => submitAnswerToServer(selectedOptionIds)}
                    className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-black text-base flex items-center justify-center gap-2 kahoot-shadow"
                  >
                    <Send className="w-5 h-5" /> GỬI CÁC ĐÁP ÁN ĐÃ CHỌN ({selectedOptionIds.length})
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {phase === 'SUBMITTED' && (
          <div className="text-center p-10 rounded-3xl bg-indigo-950/60 border border-indigo-500/40 space-y-3">
            <div className="w-14 h-14 rounded-full bg-indigo-600/40 border-2 border-indigo-400 flex items-center justify-center mx-auto animate-pulse">
              <Send className="w-6 h-6 text-indigo-200" />
            </div>
            <h2 className="text-2xl font-black">Đã ghi nhận câu trả lời!</h2>
            <p className="text-sm text-slate-300">
              Hãy chờ các người chơi khác hoàn thành để xem đáp án và điểm tốc độ...
            </p>
          </div>
        )}

        {phase === 'RESULT' && lastResult && (
          <div
            className={`text-center p-6 sm:p-8 rounded-3xl border-2 space-y-4 ${
              lastResult.isCorrect
                ? 'bg-emerald-950/80 border-emerald-500'
                : 'bg-rose-950/80 border-rose-500'
            }`}
          >
            {lastResult.isCorrect ? (
              <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
            ) : (
              <XCircle className="w-16 h-16 text-rose-400 mx-auto" />
            )}

            <h2 className="text-3xl font-black">
              {lastResult.isCorrect ? 'CHÍNH XÁC!' : 'CHƯA CHÍNH XÁC!'}
            </h2>

            <div className="text-xl font-black text-amber-300">
              +{lastResult.earnedPoints} điểm
              {lastResult.streakBonus > 0 && ` (Thưởng chuỗi +${lastResult.streakBonus})`}
            </div>

            <div className="text-sm font-bold text-slate-200">
              Hạng hiện tại của bạn: <strong className="text-white">#{rank}</strong> • Tổng điểm:{' '}
              <strong className="text-emerald-300">{score}</strong>
            </div>

            {lastResult.explanation && (
              <div className="text-left p-4 rounded-2xl bg-slate-950/80 border border-slate-700 text-sm space-y-1">
                <div className="text-xs font-black uppercase text-emerald-300 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" /> Giải thích đáp án:
                </div>
                <div className="font-bold text-slate-100">
                  <MathText text={lastResult.explanation} />
                </div>
              </div>
            )}
          </div>
        )}

        {phase === 'PODIUM' && (
          <div className="text-center p-8 rounded-3xl bg-slate-900 border border-amber-500/40 space-y-4">
            <Trophy className="w-16 h-16 text-amber-400 mx-auto" />
            <h2 className="text-3xl font-black">Trận Đấu Đã Kết Thúc!</h2>
            <div className="text-lg font-bold text-slate-300">
              Hạng chung cuộc: <strong className="text-amber-300 text-2xl">#{rank}</strong>
            </div>
            <div className="text-2xl font-black text-emerald-400">{score} điểm</div>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="mt-4 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-black text-sm"
            >
              Về Trang Chủ
            </button>
          </div>
        )}
      </main>
    </div>
  );
};
