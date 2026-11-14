import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  BookOpen,
  Play,
  ArrowRight,
  Trophy,
  Flame,
  HelpCircle,
  Home as HomeIcon,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { KIDS_AVATARS, type Question } from '../types.ts';
import { API_BASE, speakVietnameseText } from '../utils/api.ts';
import { MathText } from '../components/MathText.tsx';
import { MediaStage } from '../components/MediaStage.tsx';
import { AnswerGrid } from '../components/AnswerGrid.tsx';
import { SoundBar, soundEngine } from '../components/SoundBar.tsx';

export const SelfPaced: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [quizTitle, setQuizTitle] = useState('');
  const [quizDesc, setQuizDesc] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [recentLeaderboard, setRecentLeaderboard] = useState<
    Array<{ nickname: string; score: number; correctCount: number }>
  >([]);

  const [nickname, setNickname] = useState('');
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [questionStartedAt, setQuestionStartedAt] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [typedText, setTypedText] = useState('');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [noStressPreschool, setNoStressPreschool] = useState(false);
  const [gentleHint, setGentleHint] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{
    isCorrect: boolean;
    earnedPoints: number;
    streakBonus: number;
    correctOptionIds: string[];
    explanation: string;
  } | null>(null);

  const [answerHistory, setAnswerHistory] = useState<
    Array<{ questionId: string; selectedOptionIds: string[]; responseTimeMs: number }>
  >([]);

  const [finishedSummary, setFinishedSummary] = useState<{
    sessionId: string;
    totalScore: number;
    correctCount: number;
    totalQuestions: number;
    maxStreak: number;
  } | null>(null);

  useEffect(() => {
    if (!quizId) return;
    fetch(`${API_BASE}/api/self-paced/${quizId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) {
          setQuizTitle(data.title);
          setQuizDesc(data.description || '');
          setQuestions(data.questions || []);
          setRecentLeaderboard(data.recentLeaderboard || []);
        }
      });
  }, [quizId]);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) return;
    setStarted(true);
    setCurrentIdx(0);
    setQuestionStartedAt(Date.now());
  };

  const currentQ = questions[currentIdx];

  const submitQuestionAnswer = async (chosenIds: string[]) => {
    if (!currentQ || !quizId || feedback) return;
    const elapsedMs = Math.max(200, Date.now() - questionStartedAt);

    const res = await fetch(`${API_BASE}/api/self-paced/${quizId}/check-answer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: currentQ.id,
        selectedOptionIds: chosenIds,
        responseTimeMs: elapsedMs,
        currentStreak: streak,
      }),
    });
    const data = await res.json();
    if (noStressPreschool && !data.isCorrect) {
      soundEngine.playWrong();
      const retryMsg = 'Ôi chưa đúng rồi! Bé nhìn kỹ hình và thử chọn lại một lần nữa nhé!';
      setGentleHint(retryMsg);
      speakVietnameseText(retryMsg);
      setSelectedIds([]);
      return;
    }

    setGentleHint(null);
    if (data.isCorrect) {
      soundEngine.playCorrect();
      if (noStressPreschool) {
        speakVietnameseText('Hoan hô! Bé trả lời giỏi quá! Cô thưởng cho bé một ngôi sao vàng!');
      }
    } else {
      soundEngine.playWrong();
    }

    setScore((prev) => prev + (data.earnedPoints || 0));
    setStreak(data.newStreak || 0);
    setFeedback({
      isCorrect: Boolean(data.isCorrect),
      earnedPoints: data.earnedPoints || 0,
      streakBonus: data.streakBonus || 0,
      correctOptionIds: data.correctOptionIds || [],
      explanation: data.explanation || '',
    });
    setAnswerHistory((prev) => [
      ...prev,
      {
        questionId: currentQ.id,
        selectedOptionIds: chosenIds,
        responseTimeMs: elapsedMs,
      },
    ]);
  };

  const handleToggleOption = (optId: string) => {
    if (!currentQ || feedback) return;
    if (currentQ.type === 'MULTIPLE_CHOICE') {
      setSelectedIds((prev) =>
        prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
      );
      return;
    }
    setSelectedIds([optId]);
    submitQuestionAnswer([optId]);
  };

  const handleNext = async () => {
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((prev) => prev + 1);
      setSelectedIds([]);
      setTypedText('');
      setFeedback(null);
      setQuestionStartedAt(Date.now());
    } else {
      // Complete self-paced quiz
      const res = await fetch(`${API_BASE}/api/self-paced/${quizId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname,
          answers: answerHistory,
        }),
      });
      const summary = await res.json();
      setFinishedSummary(summary);
      soundEngine.playPodiumFanfare();
      confetti({ particleCount: 100, spread: 70 });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
      <header className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            <HomeIcon className="w-4 h-4" />
          </button>
          <div>
            <div className="text-xs font-extrabold uppercase text-indigo-400">
              Chế Độ Tự Luyện (Homework Mode)
            </div>
            <div className="text-sm sm:text-base font-black">{quizTitle}</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SoundBar bgmMode="NONE" />
          {started && !finishedSummary && (
            <div className="px-3 py-1 rounded-xl bg-slate-800 font-black text-sm text-emerald-300">
              {score} đ
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col justify-center">
        {!started ? (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-7 bg-slate-900 border border-indigo-500/30 rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-black">
                <BookOpen className="w-4 h-4" /> Bài tập tự luyện cá nhân ({questions.length} câu hỏi)
              </div>
              <h1 className="text-2xl sm:text-3xl font-black">{quizTitle}</h1>
              <p className="text-sm text-slate-400">{quizDesc}</p>

              <form onSubmit={handleStart} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-extrabold uppercase text-slate-300 mb-1.5">
                    Nhập họ tên / Lớp (Hoặc chọn Hình Con Vật cho Bé Mầm Non)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={32}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="VD: Trần Minh Khôi - Lớp 12A1"
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-950 border border-slate-700 text-white font-bold text-base focus:border-indigo-500 focus:outline-none"
                  />

                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                    {KIDS_AVATARS.slice(0, 6).map((av) => {
                      const label = `${av.emoji} ${av.name}`;
                      return (
                        <button
                          key={av.name}
                          type="button"
                          onClick={() => {
                            setNickname(label);
                            setNoStressPreschool(true);
                          }}
                          className={`p-2 rounded-xl border text-center transition ${
                            nickname === label
                              ? 'bg-amber-400 text-slate-950 border-white font-black'
                              : 'bg-slate-950 border-slate-800 text-slate-200 font-bold'
                          }`}
                        >
                          <div className="text-2xl">{av.emoji}</div>
                          <div className="text-[10px] truncate">{av.name}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-500/15 border border-amber-400/30 cursor-pointer text-xs font-extrabold text-amber-200">
                  <input
                    type="checkbox"
                    checked={noStressPreschool}
                    onChange={(e) => setNoStressPreschool(e.target.checked)}
                    className="w-4 h-4 accent-amber-400"
                  />
                  <span>
                    🧸 Bật Chế Độ Tâm Lý Mầm Non (Không áp lực thời gian, đọc giọng nói & cho bé chọn lại nếu nhầm)
                  </span>
                </label>
                <button
                  type="submit"
                  className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-base flex items-center justify-center gap-2 kahoot-shadow"
                >
                  <Play className="w-5 h-5 fill-current" /> BẮT ĐẦU LÀM BÀI
                </button>
              </form>
            </div>

            <div className="md:col-span-5 bg-slate-900/70 border border-slate-800 rounded-3xl p-6 space-y-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Trophy className="w-4 h-4" /> Bảng vàng Tự luyện gần đây
              </h3>
              {recentLeaderboard.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Hãy là người đầu tiên chinh phục bảng vàng bộ đề này!
                </p>
              ) : (
                <div className="space-y-2">
                  {recentLeaderboard.slice(0, 8).map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold"
                    >
                      <span>
                        #{i + 1} {item.nickname}
                      </span>
                      <span className="text-emerald-300 font-black">{item.score} đ</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : finishedSummary ? (
          <div className="max-w-lg mx-auto w-full bg-slate-900 border border-emerald-500/40 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
            <Trophy className="w-16 h-16 text-amber-400 mx-auto" />
            <h2 className="text-3xl font-black">Hoàn Thành Xuất Sắc!</h2>
            <div className="text-lg font-bold text-slate-300">{nickname}</div>

            <div className="grid grid-cols-3 gap-3 py-3">
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">Tổng điểm</div>
                <div className="text-xl font-black text-amber-300">{finishedSummary.totalScore}</div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">Số câu đúng</div>
                <div className="text-xl font-black text-emerald-400">
                  {finishedSummary.correctCount}/{finishedSummary.totalQuestions}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-slate-950 border border-slate-800">
                <div className="text-xs text-slate-400">Chuỗi Streak</div>
                <div className="text-xl font-black text-fuchsia-400">{finishedSummary.maxStreak}</div>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => navigate(`/reports?session=${finishedSummary.sessionId}`)}
                className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-black text-sm"
              >
                Xem Báo Cáo Chi Tiết
              </button>
              <button
                type="button"
                onClick={() => navigate('/studio')}
                className="px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 font-bold text-sm"
              >
                Về Studio
              </button>
            </div>
          </div>
        ) : (
          currentQ && (
            <div className="space-y-5">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-2">
                <div className="flex items-center justify-between text-xs font-extrabold uppercase text-indigo-300">
                  <span>
                    Câu {currentIdx + 1} / {questions.length}
                  </span>
                  {streak >= 2 && (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Flame className="w-4 h-4 fill-current" /> Chuỗi đúng {streak} câu
                    </span>
                  )}
                </div>
                <h2 className="text-xl sm:text-3xl font-black">
                  <MathText text={currentQ.text} />
                </h2>
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => speakVietnameseText(currentQ.text)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600/40 hover:bg-indigo-600 border border-indigo-400/40 text-xs font-black text-indigo-100"
                  >
                    🔊 Đọc to câu hỏi cho bé
                  </button>
                </div>
                {gentleHint && (
                  <div className="p-3 rounded-2xl bg-amber-400 text-slate-950 font-black text-sm animate-bounce">
                    💡 {gentleHint}
                  </div>
                )}
              </div>

              <MediaStage
                mediaType={currentQ.mediaType}
                mediaUrl={currentQ.mediaUrl}
                startTime={currentQ.mediaStartTime}
                endTime={currentQ.mediaEndTime}
                imageReveal={currentQ.imageReveal || 'NONE'}
                revealComplete={Boolean(feedback)}
                role="HOST"
                deliveryMode="SYNC_ALL_DEVICES"
                autoPlay={!feedback}
              />

              {currentQ.type === 'SLIDE' ? (
                <div className="p-6 rounded-3xl bg-slate-900 border border-indigo-500/40 text-center space-y-4">
                  <div className="text-base sm:text-xl font-bold text-slate-100">
                    <MathText text={currentQ.explanation || ''} />
                  </div>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-3 rounded-xl bg-emerald-500 text-slate-950 font-black text-sm"
                  >
                    Tiếp Tục →
                  </button>
                </div>
              ) : currentQ.type === 'TYPE_ANSWER' && !feedback ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!typedText.trim()) return;
                    submitQuestionAnswer([typedText.trim()]);
                  }}
                  className="p-5 rounded-3xl bg-slate-900 border border-indigo-500/40 space-y-3"
                >
                  <input
                    type="text"
                    value={typedText}
                    onChange={(e) => setTypedText(e.target.value)}
                    placeholder="Nhập đáp số hoặc từ khóa..."
                    className="w-full px-4 py-3.5 rounded-2xl bg-white text-slate-950 font-black text-lg text-center"
                    required
                  />
                  <button
                    type="submit"
                    className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 font-black text-base kahoot-shadow"
                  >
                    Kiểm Tra Đáp Án
                  </button>
                </form>
              ) : (
                <AnswerGrid
                  options={currentQ.options}
                  questionType={currentQ.type}
                  selectedIds={selectedIds}
                  onToggleOption={handleToggleOption}
                  disabled={Boolean(feedback)}
                  revealCorrectIds={feedback?.correctOptionIds}
                />
              )}

              {currentQ.type === 'MULTIPLE_CHOICE' && !feedback && (
                <button
                  type="button"
                  disabled={selectedIds.length === 0}
                  onClick={() => submitQuestionAnswer(selectedIds)}
                  className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 font-black text-base kahoot-shadow"
                >
                  Chốt Đáp Án Đã Chọn ({selectedIds.length})
                </button>
              )}

              {feedback && (
                <div
                  className={`p-5 rounded-3xl border-2 space-y-3 ${
                    feedback.isCorrect
                      ? 'bg-emerald-950/80 border-emerald-500'
                      : 'bg-rose-950/80 border-rose-500'
                  }`}
                >
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2 text-lg font-black">
                      {feedback.isCorrect ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <XCircle className="w-6 h-6 text-rose-400" />
                      )}
                      <span>
                        {feedback.isCorrect
                          ? `Chính xác! +${feedback.earnedPoints} điểm`
                          : 'Chưa chính xác!'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={handleNext}
                      className="px-5 py-2.5 rounded-xl bg-white text-slate-950 font-black text-sm flex items-center gap-1.5 shadow"
                    >
                      <span>
                        {currentIdx + 1 < questions.length ? 'Câu Tiếp Theo' : 'Xem Tổng Kết'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>

                  {feedback.explanation && (
                    <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-700 text-sm">
                      <div className="text-xs font-black uppercase text-emerald-300 flex items-center gap-1 mb-1">
                        <HelpCircle className="w-3.5 h-3.5" /> Giải thích đáp án:
                      </div>
                      <MathText text={feedback.explanation} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        )}
      </main>
    </div>
  );
};
