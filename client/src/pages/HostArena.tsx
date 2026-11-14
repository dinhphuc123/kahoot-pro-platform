import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import confetti from 'canvas-confetti';
import {
  Users,
  Play,
  Lock,
  Unlock,
  UserX,
  SkipForward,
  Trophy,
  Download,
  HelpCircle,
  Wifi,
  Clock,
  Shuffle,
  Eye,
  EyeOff,
  ArrowLeft,
  Flame,
} from 'lucide-react';
import {
  QUIZ_THEMES,
  type Question,
  type QuizThemeId,
  type RoomSettings,
} from '../types.ts';
import { API_BASE, speakVietnameseText } from '../utils/api.ts';
import { MathText } from '../components/MathText.tsx';
import { MediaStage } from '../components/MediaStage.tsx';
import { AnswerGrid } from '../components/AnswerGrid.tsx';
import { SoundBar, soundEngine } from '../components/SoundBar.tsx';

interface LeaderboardEntry {
  id: string;
  nickname: string;
  score: number;
  streak: number;
  maxStreak: number;
  correctCount: number;
  connected: boolean;
  rank: number;
  lastEarnedPoints: number;
}

export const HostArena: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const socketRef = useRef<Socket | null>(null);

  const [pin, setPin] = useState('');
  const [quizTitle, setQuizTitle] = useState('Đang khởi tạo phòng Live...');
  const [roomState, setRoomState] = useState<
    'LOBBY' | 'QUESTION_PREVIEW' | 'QUESTION_ACTIVE' | 'QUESTION_REVEAL' | 'LEADERBOARD' | 'PODIUM'
  >('LOBBY');
  const [settings, setSettings] = useState<RoomSettings>({
    mediaDeliveryMode: 'PROJECTOR_FIRST',
    pacingMode: 'MEDIA_FIRST',
    shuffleQuestions: false,
    shuffleOptions: false,
    showOptionTextOnPlayer: true,
    isLocked: false,
  });

  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [optionCounts, setOptionCounts] = useState<Record<string, number>>({});
  const [explanation, setExplanation] = useState('');
  const [sessionId, setSessionId] = useState('');

  // Preschool 1-Screen Interactive TV & Team Mode state
  const [preschoolMode, setPreschoolMode] = useState(false);
  const [activeTeamIdx, setActiveTeamIdx] = useState(0);
  const [spinningWheel, setSpinningWheel] = useState(false);
  const [preschoolFeedback, setPreschoolFeedback] = useState<string | null>(null);
  const [preschoolTeams, setPreschoolTeams] = useState([
    { emoji: '🐰', name: 'Đội Thỏ Trắng', stars: 0 },
    { emoji: '🐻', name: 'Đội Gấu Nâu', stars: 0 },
    { emoji: '🐱', name: 'Đội Mèo Con', stars: 0 },
    { emoji: '🐶', name: 'Đội Cún Cưng', stars: 0 },
  ]);

  // Connect Socket & Create Room
  useEffect(() => {
    const socket = io(API_BASE || window.location.origin);
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit(
        'host:create-room',
        { quizId, settings },
        (res: {
          ok: boolean;
          pin?: string;
          room?: {
            quizTitle: string;
            totalQuestions: number;
            settings: RoomSettings;
          };
          error?: string;
        }) => {
          if (res?.ok && res.pin && res.room) {
            setPin(res.pin);
            setQuizTitle(res.room.quizTitle);
            setTotalQuestions(res.room.totalQuestions);
            setSettings(res.room.settings);
          }
        }
      );
    });

    socket.on('room:lobby-update', (data) => {
      setPlayers((prev) => {
        if ((data.players?.length || 0) > prev.length) {
          soundEngine.playJoinPop();
        }
        return data.players || [];
      });
      if (data.settings) setSettings(data.settings);
    });

    socket.on('room:question', (data) => {
      setRoomState(data.state);
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex || 0);
      setTotalQuestions(data.totalQuestions || 0);
      setAnsweredCount(0);
      setOptionCounts({});
      setExplanation('');
      setPreschoolFeedback(null);
      if (data.state === 'QUESTION_ACTIVE' && data.question) {
        setTimeLeft(data.question.timeLimitSec || 20);
      } else {
        setTimeLeft(0);
      }
      if (data.question?.text) {
        speakVietnameseText(data.question.text);
      }
    });

    socket.on('room:answer-count', (data) => {
      setAnsweredCount(data.answeredCount || 0);
    });

    socket.on('room:question-reveal', (data) => {
      setRoomState('QUESTION_REVEAL');
      setCurrentQuestion(data.question);
      setOptionCounts(data.optionCounts || {});
      setExplanation(data.explanation || '');
      if (Array.isArray(data.leaderboard)) setPlayers(data.leaderboard);
      soundEngine.playCorrect();
    });

    socket.on('room:leaderboard', (data) => {
      setRoomState('LEADERBOARD');
      if (Array.isArray(data.leaderboard)) setPlayers(data.leaderboard);
    });

    socket.on('room:podium', (data) => {
      setRoomState('PODIUM');
      if (Array.isArray(data.leaderboard)) setPlayers(data.leaderboard);
      if (data.sessionId) setSessionId(data.sessionId);
      soundEngine.playPodiumFanfare();
      confetti({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.6 },
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [quizId]);

  // Countdown tick when QUESTION_ACTIVE
  useEffect(() => {
    if (roomState !== 'QUESTION_ACTIVE' || timeLeft <= 0) return;
    const t = setInterval(() => {
      setTimeLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [roomState, timeLeft]);

  const updateRoomSetting = (patch: Partial<RoomSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    socketRef.current?.emit('host:update-settings', { pin, settings: next });
  };

  const handleKickPlayer = (playerId: string) => {
    socketRef.current?.emit('host:kick-player', { pin, playerId });
  };

  const handleStartGame = () => {
    socketRef.current?.emit('host:start-game', { pin });
  };

  const handleStartCountdown = () => {
    socketRef.current?.emit('host:start-countdown', { pin });
  };

  const handleRevealEarly = () => {
    socketRef.current?.emit('host:reveal-answer', { pin });
  };

  const handleShowLeaderboard = () => {
    socketRef.current?.emit('host:show-leaderboard', { pin });
  };

  const handleNextQuestion = () => {
    socketRef.current?.emit('host:next-question', { pin });
  };

  const handleSpinMagicWheel = () => {
    if (spinningWheel) return;
    setSpinningWheel(true);
    let ticks = 0;
    const interval = window.setInterval(() => {
      setActiveTeamIdx((prev) => (prev + 1) % preschoolTeams.length);
      soundEngine.playJoinPop();
      ticks++;
      if (ticks >= 12) {
        clearInterval(interval);
        const winnerIdx = Math.floor(Math.random() * preschoolTeams.length);
        setActiveTeamIdx(winnerIdx);
        setSpinningWheel(false);
        const chosen = preschoolTeams[winnerIdx];
        speakVietnameseText(`Xin mời ${chosen.name} lên bảng trả lời nhé!`);
      }
    }, 120);
  };

  const handlePreschoolBoardTapOption = (optionId: string) => {
    if (!preschoolMode || !currentQuestion) return;
    if (roomState === 'QUESTION_REVEAL') return;

    // Ask server to reveal or check against option
    socketRef.current?.emit('host:reveal-answer', { pin });
    const team = preschoolTeams[activeTeamIdx];
    setPreschoolTeams((prev) =>
      prev.map((t, i) => (i === activeTeamIdx ? { ...t, stars: t.stars + 1 } : t))
    );
    const praise = `Hoan hô! ${team.name} giỏi quá! Cô thưởng 1 ngôi sao vàng nhé!`;
    setPreschoolFeedback(praise);
    speakVietnameseText(praise);
    confetti({ particleCount: 70, spread: 60 });
  };

  const joinUrl = `${window.location.origin}/play?pin=${pin}`;

  const bgmMode =
    roomState === 'LOBBY'
      ? 'LOBBY'
      : roomState === 'QUESTION_ACTIVE'
      ? 'COUNTDOWN'
      : 'NONE';

  const activeTheme =
    QUIZ_THEMES[(settings.themeId as QuizThemeId) || 'CLASSIC_PURPLE'] ||
    QUIZ_THEMES.CLASSIC_PURPLE;

  return (
    <div
      className={`min-h-screen bg-gradient-to-br ${activeTheme.bgGradient} text-white flex flex-col justify-between`}
    >
      {/* Top Control Header */}
      <header className="px-4 py-3 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Rời phòng về Studio"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
              {quizTitle}
            </div>
            <div className="flex items-center gap-3 text-sm font-black">
              <span>
                PIN Phòng: <strong className="text-amber-300 tracking-widest">{pin || '...'}</strong>
              </span>
              {roomState !== 'LOBBY' && (
                <span className="text-slate-400">
                  • Câu {questionIndex + 1}/{totalQuestions}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <SoundBar bgmMode={bgmMode} />

          {/* Preschool TV Classroom Board Mode Toggle */}
          <button
            type="button"
            onClick={() => setPreschoolMode((v) => !v)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-black flex items-center gap-1.5 transition ${
              preschoolMode
                ? 'bg-amber-400 border-amber-200 text-slate-950 shadow-lg'
                : 'bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800'
            }`}
          >
            <span>🧸 {preschoolMode ? 'Chế độ Mầm Non (Tivi Lớp Học): BẬT' : 'Bật Chế độ Mầm Non (Tivi 1-Chạm)'}</span>
          </button>

          {/* Quick toggle for Projector vs Online Sync */}
          <button
            type="button"
            onClick={() =>
              updateRoomSetting({
                mediaDeliveryMode:
                  settings.mediaDeliveryMode === 'PROJECTOR_FIRST'
                    ? 'SYNC_ALL_DEVICES'
                    : 'PROJECTOR_FIRST',
              })
            }
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold flex items-center gap-1.5"
            title="Chuyển đổi giữa Chế độ Lớp học (Tiết kiệm Wi-Fi) và Chế độ Online (Đồng bộ mọi máy)"
          >
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {settings.mediaDeliveryMode === 'PROJECTOR_FIRST'
                ? 'Media: Lớp học (Tiết kiệm Wi-Fi)'
                : 'Media: Online (Đồng bộ mọi máy)'}
            </span>
          </button>
        </div>
      </header>

      {/* Main Arena Stage */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 flex flex-col justify-center">
        {/* Preschool 4-Animal Teams & Magic Wheel Bar */}
        {preschoolMode && roomState !== 'PODIUM' && (
          <div className="mb-4 p-4 rounded-3xl bg-slate-900/95 border-2 border-amber-400/50 shadow-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {preschoolTeams.map((t, idx) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => setActiveTeamIdx(idx)}
                  className={`px-3.5 py-2 rounded-2xl border-2 font-black text-xs sm:text-sm flex items-center gap-2 transition ${
                    activeTeamIdx === idx
                      ? 'bg-amber-400 text-slate-950 border-white scale-105 shadow-lg'
                      : 'bg-slate-950 text-white border-slate-700 hover:border-amber-400/50'
                  }`}
                >
                  <span className="text-2xl">{t.emoji}</span>
                  <span>{t.name}</span>
                  <span className="px-2 py-0.5 rounded-full bg-black/25 text-amber-300 font-black">
                    ⭐ {t.stars}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSpinMagicWheel}
                className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-amber-500 hover:from-fuchsia-400 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-lg"
              >
                🎡 {spinningWheel ? 'Đang quay chọn đội...' : 'Vòng Quay Kỳ Diệu Gọi Đội'}
              </button>
              {currentQuestion?.text && (
                <button
                  type="button"
                  onClick={() => speakVietnameseText(currentQuestion.text)}
                  className="px-3.5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm"
                >
                  🔊 Đọc Câu Hỏi Cho Bé
                </button>
              )}
            </div>
          </div>
        )}

        {/* 1. LOBBY SCREEN */}
        {roomState === 'LOBBY' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center bg-slate-900/90 border border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl">
              <div className="lg:col-span-7 space-y-4 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-extrabold">
                  1. Truy cập <span className="underline">{window.location.origin}</span> hoặc quét mã QR
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                    Mã PIN Tham Gia Phòng
                  </div>
                  <div className="text-5xl sm:text-7xl font-black tracking-[0.18em] text-amber-300 mt-1 select-all">
                    {pin || '------'}
                  </div>
                </div>

                {/* Room Pro Settings Toggles */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateRoomSetting({
                        pacingMode:
                          settings.pacingMode === 'MEDIA_FIRST'
                            ? 'IMMEDIATE_COUNTDOWN'
                            : 'MEDIA_FIRST',
                      })
                    }
                    className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-left text-xs font-bold flex items-center gap-2"
                  >
                    <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Nhịp câu hỏi:{' '}
                      <strong className="text-amber-300">
                        {settings.pacingMode === 'MEDIA_FIRST'
                          ? 'Xem Media trước → Đếm ngược sau'
                          : 'Vừa phát vừa đếm ngược ngay'}
                      </strong>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateRoomSetting({
                        showOptionTextOnPlayer: !settings.showOptionTextOnPlayer,
                      })
                    }
                    className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-left text-xs font-bold flex items-center gap-2"
                  >
                    {settings.showOptionTextOnPlayer ? (
                      <Eye className="w-4 h-4 text-indigo-400 shrink-0" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span>
                      Máy người chơi:{' '}
                      <strong className="text-indigo-300">
                        {settings.showOptionTextOnPlayer ? 'Hiện cả chữ & hình' : 'Chỉ hiện 4 hình màu'}
                      </strong>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateRoomSetting({ isLocked: !settings.isLocked })}
                    className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-left text-xs font-bold flex items-center gap-2"
                  >
                    {settings.isLocked ? (
                      <Lock className="w-4 h-4 text-rose-400 shrink-0" />
                    ) : (
                      <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                    <span>
                      Trạng thái phòng:{' '}
                      <strong className={settings.isLocked ? 'text-rose-300' : 'text-emerald-300'}>
                        {settings.isLocked ? 'Đang khóa PIN' : 'Mở tự do'}
                      </strong>
                    </span>
                  </button>

                  <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 text-left text-xs font-bold flex items-center gap-2 text-slate-300">
                    <Shuffle className="w-4 h-4 text-fuchsia-400 shrink-0" />
                    <span>Auto-Reconnect khi F5: Đã bật</span>
                  </div>
                </div>
              </div>

              {/* QR Code Card */}
              <div className="lg:col-span-5 flex flex-col items-center justify-center">
                <div className="p-4 bg-white rounded-3xl shadow-2xl">
                  {pin && <QRCodeSVG value={joinUrl} size={180} />}
                </div>
                <span className="text-xs font-bold text-slate-300 mt-2">
                  Quét mã QR bằng Camera điện thoại để vào thẳng phòng
                </span>
              </div>
            </div>

            {/* Players List & Start Button */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-lg font-black">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span>Người chơi đã tham gia ({players.length})</span>
                </div>

                <button
                  type="button"
                  onClick={handleStartGame}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-base flex items-center gap-2 kahoot-shadow"
                >
                  <Play className="w-5 h-5 fill-current" /> BẮT ĐẦU TRẬN ĐẤU
                </button>
              </div>

              {players.length === 0 ? (
                <div className="py-10 text-center text-slate-400 font-bold text-sm">
                  Đang chờ người chơi nhập mã PIN <strong className="text-amber-300">{pin}</strong>...
                </div>
              ) : (
                <div className="flex flex-wrap gap-2.5">
                  {players.map((p) => (
                    <div
                      key={p.id}
                      className="group px-4 py-2 rounded-2xl bg-indigo-950/90 border border-indigo-500/40 font-extrabold text-sm flex items-center gap-2 shadow"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          p.connected ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                      />
                      <span>{p.nickname}</span>
                      <button
                        type="button"
                        onClick={() => handleKickPlayer(p.id)}
                        className="opacity-60 hover:opacity-100 text-rose-400 ml-1"
                        title="Mời rời phòng (Kick)"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2. QUESTION PREVIEW / ACTIVE / REVEAL */}
        {(roomState === 'QUESTION_PREVIEW' ||
          roomState === 'QUESTION_ACTIVE' ||
          roomState === 'QUESTION_REVEAL') &&
          currentQuestion && (
            <div className="space-y-5">
              {/* Question Banner */}
              <div className="bg-slate-900/95 border border-indigo-500/40 rounded-3xl p-6 text-center shadow-2xl space-y-3">
                <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-wider text-indigo-300">
                  <span>
                    Câu hỏi {questionIndex + 1} / {totalQuestions} •{' '}
                    {currentQuestion.type === 'MULTIPLE_CHOICE'
                      ? 'Chọn nhiều đáp án'
                      : currentQuestion.type === 'TRUE_FALSE'
                      ? 'Đúng / Sai'
                      : '1 Đáp án đúng'}
                  </span>
                  {currentQuestion.pointsMultiplier === 2 && (
                    <span className="px-2.5 py-1 rounded-full bg-fuchsia-500/30 border border-fuchsia-400 text-fuchsia-200">
                      ⚡ NHÂN ĐÔI ĐIỂM (2X)
                    </span>
                  )}
                </div>

                <h2 className="text-2xl sm:text-4xl font-black leading-snug text-white">
                  <MathText text={currentQuestion.text} />
                </h2>
              </div>

              {/* Center Stage: Timer, Media & Answer Counter */}
              <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
                {/* Timer Circle */}
                <div className="w-24 h-24 rounded-full bg-indigo-600 border-4 border-indigo-300 flex flex-col items-center justify-center shadow-xl shrink-0">
                  {roomState === 'QUESTION_PREVIEW' ? (
                    <span className="text-xs font-black uppercase text-center px-1">
                      Xem Media
                    </span>
                  ) : (
                    <>
                      <span className="text-3xl font-black">{timeLeft}</span>
                      <span className="text-[10px] font-bold uppercase opacity-80">Giây</span>
                    </>
                  )}
                </div>

                {/* Multimedia Stage */}
                <div className="flex-1 w-full">
                  <MediaStage
                    mediaType={currentQuestion.mediaType}
                    mediaUrl={currentQuestion.mediaUrl}
                    startTime={currentQuestion.mediaStartTime}
                    endTime={currentQuestion.mediaEndTime}
                    imageReveal={currentQuestion.imageReveal || 'NONE'}
                    revealComplete={roomState === 'QUESTION_REVEAL'}
                    role="HOST"
                    deliveryMode={settings.mediaDeliveryMode}
                    autoPlay={roomState !== 'QUESTION_REVEAL'}
                    onMediaEnded={() => {
                      if (roomState === 'QUESTION_PREVIEW') {
                        handleStartCountdown();
                      }
                    }}
                  />
                </div>

                {/* Answers Counter & Action Buttons */}
                <div className="flex flex-col items-center gap-2.5 shrink-0">
                  <div className="px-5 py-3 rounded-2xl bg-slate-900 border border-slate-700 text-center">
                    <div className="text-2xl font-black text-emerald-400">
                      {answeredCount} / {players.length}
                    </div>
                    <div className="text-xs font-bold text-slate-400">Đã trả lời</div>
                  </div>

                  {roomState === 'QUESTION_PREVIEW' && (
                    <button
                      type="button"
                      onClick={handleStartCountdown}
                      className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm flex items-center gap-1.5 kahoot-shadow"
                    >
                      <Play className="w-4 h-4 fill-current" /> Bắt đầu đếm ngược ({currentQuestion.timeLimitSec}s)
                    </button>
                  )}

                  {roomState === 'QUESTION_ACTIVE' && (
                    <button
                      type="button"
                      onClick={handleRevealEarly}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5"
                    >
                      <SkipForward className="w-4 h-4" /> Mở đáp án ngay
                    </button>
                  )}

                  {roomState === 'QUESTION_REVEAL' && (
                    <button
                      type="button"
                      onClick={handleShowLeaderboard}
                      className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm flex items-center gap-1.5 kahoot-shadow"
                    >
                      Xem Bảng Xếp Hạng →
                    </button>
                  )}
                </div>
              </div>

              {/* Pedagogical Explanation Card on Reveal */}
              {preschoolFeedback && (
                <div className="p-4 rounded-3xl bg-amber-400 text-slate-950 font-black text-center text-lg sm:text-2xl shadow-2xl animate-bounce">
                  🌟 {preschoolFeedback} 🌟
                </div>
              )}

              {roomState === 'QUESTION_REVEAL' && explanation && (
                <div className="p-5 rounded-2xl bg-emerald-950/80 border-2 border-emerald-500/60 text-emerald-100 shadow-xl space-y-1">
                  <div className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4" /> Giải thích đáp án & Ghi chú bài học:
                  </div>
                  <div className="text-base sm:text-lg font-bold">
                    <MathText text={explanation} />
                  </div>
                </div>
              )}

              {/* 4 Answer Shapes Grid or Slide / Type Answer View */}
              {currentQuestion.type === 'SLIDE' ? (
                <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-indigo-400/40 text-center space-y-4 shadow-2xl">
                  <div className="text-lg sm:text-2xl font-bold text-slate-100 leading-relaxed">
                    <MathText text={currentQuestion.explanation || ''} />
                  </div>
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm kahoot-shadow"
                  >
                    Chuyển Sang Câu Tiếp Theo →
                  </button>
                </div>
              ) : currentQuestion.type === 'TYPE_ANSWER' ? (
                <div className="p-6 rounded-3xl bg-slate-900/90 border border-amber-400/40 text-center space-y-3 shadow-xl">
                  <div className="text-sm font-black uppercase tracking-wider text-amber-300">
                    Câu hỏi Điền Đáp Án Ngắn (Người chơi nhập đáp án trực tiếp trên điện thoại)
                  </div>
                  {roomState === 'QUESTION_REVEAL' && (
                    <div className="pt-2">
                      <div className="text-xs font-bold text-slate-400 mb-2">
                        Các đáp án đúng được chấp nhận:
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {currentQuestion.options
                          .filter((o) => o.text.trim().length > 0)
                          .map((o) => (
                            <span
                              key={o.id}
                              className="px-4 py-2 rounded-xl bg-emerald-500 text-slate-950 font-black text-base shadow"
                            >
                              {o.text}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <AnswerGrid
                  options={currentQuestion.options}
                  questionType={currentQuestion.type}
                  selectedIds={[]}
                  disabled={!preschoolMode || roomState === 'QUESTION_REVEAL'}
                  onToggleOption={preschoolMode ? handlePreschoolBoardTapOption : undefined}
                  preschoolMode={preschoolMode}
                  revealCorrectIds={
                    roomState === 'QUESTION_REVEAL'
                      ? currentQuestion.options.filter((o) => o.isCorrect).map((o) => o.id)
                      : undefined
                  }
                  optionCounts={roomState === 'QUESTION_REVEAL' ? optionCounts : undefined}
                />
              )}
            </div>
          )}

        {/* 3. LEADERBOARD BETWEEN QUESTIONS */}
        {roomState === 'LEADERBOARD' && (
          <div className="max-w-3xl w-full mx-auto bg-slate-900/90 border border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl sm:text-3xl font-black flex items-center gap-2.5">
                <Trophy className="w-7 h-7 text-amber-400" /> Bảng Xếp Hạng Tạm Thời
              </h2>
              <button
                type="button"
                onClick={handleNextQuestion}
                className="px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm kahoot-shadow"
              >
                {questionIndex + 1 >= totalQuestions ? 'Vinh Danh Top 3 (Podium) →' : 'Câu Hỏi Tiếp Theo →'}
              </button>
            </div>

            <div className="space-y-3">
              {players.slice(0, 8).map((p, idx) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between p-4 rounded-2xl bg-slate-950/90 border border-slate-800"
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`w-9 h-9 rounded-xl font-black flex items-center justify-center text-sm ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-950'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-950'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <div>
                      <div className="font-black text-base sm:text-lg">{p.nickname}</div>
                      {p.streak >= 2 && (
                        <div className="text-xs font-extrabold text-amber-400 flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 fill-current" /> Chuỗi đúng {p.streak} câu liên tiếp!
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xl font-black text-indigo-300">{p.score} điểm</div>
                    {p.lastEarnedPoints > 0 && (
                      <div className="text-xs font-bold text-emerald-400">+{p.lastEarnedPoints}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. FINAL PODIUM TOP 3 */}
        {roomState === 'PODIUM' && (
          <div className="max-w-4xl w-full mx-auto text-center space-y-8">
            <div>
              <span className="px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase">
                Chung cuộc • {quizTitle}
              </span>
              <h1 className="text-3xl sm:text-5xl font-black mt-2">
                Bục Vinh Danh Nhà Vô Địch
              </h1>
            </div>

            {/* Podium Columns */}
            <div className="grid grid-cols-3 gap-4 items-end max-w-2xl mx-auto pt-6">
              {/* 2nd Place */}
              <div className="flex flex-col items-center">
                <div className="text-base sm:text-lg font-black text-slate-200 mb-2 truncate max-w-full">
                  {players[1]?.nickname || '---'}
                </div>
                <div className="w-full h-36 rounded-t-3xl bg-gradient-to-t from-slate-700 to-slate-500 flex flex-col items-center justify-center p-4 shadow-xl">
                  <span className="text-3xl font-black">#2</span>
                  <span className="text-xs sm:text-sm font-bold mt-1">{players[1]?.score || 0} đ</span>
                </div>
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center">
                <Trophy className="w-10 h-10 text-amber-400 mb-1 animate-bounce" />
                <div className="text-lg sm:text-2xl font-black text-amber-300 mb-2 truncate max-w-full">
                  {players[0]?.nickname || '---'}
                </div>
                <div className="w-full h-48 rounded-t-3xl bg-gradient-to-t from-amber-600 to-amber-400 text-slate-950 flex flex-col items-center justify-center p-4 shadow-2xl">
                  <span className="text-4xl font-black">#1</span>
                  <span className="text-sm sm:text-base font-black mt-1">
                    {players[0]?.score || 0} điểm
                  </span>
                </div>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center">
                <div className="text-base sm:text-lg font-black text-amber-200 mb-2 truncate max-w-full">
                  {players[2]?.nickname || '---'}
                </div>
                <div className="w-full h-28 rounded-t-3xl bg-gradient-to-t from-amber-900 to-amber-700 flex flex-col items-center justify-center p-4 shadow-xl">
                  <span className="text-2xl font-black">#3</span>
                  <span className="text-xs sm:text-sm font-bold mt-1">{players[2]?.score || 0} đ</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              {sessionId && (
                <>
                  <a
                    href={`${API_BASE}/api/reports/${sessionId}/export?format=xlsx`}
                    className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex items-center gap-2 shadow-lg"
                  >
                    <Download className="w-4 h-4" /> Tải Bảng Điểm Excel (.xlsx)
                  </a>
                  <button
                    type="button"
                    onClick={() => navigate(`/reports?session=${sessionId}`)}
                    className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm"
                  >
                    Xem Phân Tích Câu Hỏi Hay Sai Nhất
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => navigate('/studio')}
                className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm"
              >
                Về Quiz Studio
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
