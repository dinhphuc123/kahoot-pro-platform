import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Play,
  Upload,
  Youtube,
  Music,
  Film,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  Zap,
  HelpCircle,
  Copy,
  ChevronUp,
  ChevronDown,
  Eye,
  Palette,
  Sparkles,
  Grid,
  FileText,
  X,
} from 'lucide-react';
import {
  PRESCHOOL_STICKER_GROUPS,
  QUIZ_THEMES,
  type ImageRevealMode,
  type MediaType,
  type OptionColor,
  type Question,
  type QuestionType,
  type Quiz,
  type QuizThemeId,
} from '../types.ts';
import { API_BASE, speakVietnameseText, uploadMediaFileWithProgress } from '../utils/api.ts';
import { MathText } from '../components/MathText.tsx';
import { MediaStage } from '../components/MediaStage.tsx';

const COLORS: OptionColor[] = ['RED', 'BLUE', 'YELLOW', 'GREEN'];

const KAHOOT_TILE_STYLES: Record<
  OptionColor,
  { bg: string; border: string; shape: React.ReactNode; name: string }
> = {
  RED: {
    bg: 'bg-[#E21B3C]',
    border: 'border-rose-300',
    name: 'Đỏ Tam giác',
    shape: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white shrink-0">
        <polygon points="12,3 22,20 2,20" />
      </svg>
    ),
  },
  BLUE: {
    bg: 'bg-[#1368CE]',
    border: 'border-sky-300',
    name: 'Xanh Hình thoi',
    shape: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white shrink-0">
        <polygon points="12,2 22,12 12,22 2,12" />
      </svg>
    ),
  },
  YELLOW: {
    bg: 'bg-[#D89E00]',
    border: 'border-amber-200',
    name: 'Vàng Hình tròn',
    shape: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white shrink-0">
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  GREEN: {
    bg: 'bg-[#26890C]',
    border: 'border-emerald-300',
    name: 'Lá Hình vuông',
    shape: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white shrink-0">
        <rect x="4" y="4" width="16" height="16" rx="2" />
      </svg>
    ),
  },
};

function parseBulkTextToQuestions(rawText: string): Question[] {
  const blocks = rawText
    .trim()
    .split(/\n\s*\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const parsed: Question[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) continue;

    const qText = lines[0].replace(/^(Câu\s*\d+\s*[:.]|\d+\s*[:.)])\s*/i, '').trim();
    const optLines = lines.slice(1);
    const options: Question['options'] = [];

    for (let i = 0; i < Math.min(4, optLines.length); i++) {
      let line = optLines[i];
      const isStarred = line.startsWith('*') || /\[(đúng|x|correct)\]/i.test(line);
      line = line
        .replace(/^\*\s*/, '')
        .replace(/^[A-D][.):]\s*/i, '')
        .replace(/\[(đúng|x|correct)\]/gi, '')
        .trim();

      options.push({
        id: `opt-${Date.now()}-${parsed.length}-${i}`,
        text: line || `Đáp án ${i + 1}`,
        isCorrect: isStarred,
        color: COLORS[i % 4],
      });
    }

    while (options.length < 4) {
      const idx = options.length;
      options.push({
        id: `opt-${Date.now()}-${parsed.length}-${idx}`,
        text: `Đáp án ${idx + 1}`,
        isCorrect: false,
        color: COLORS[idx % 4],
      });
    }

    if (!options.some((o) => o.isCorrect)) {
      options[0].isCorrect = true;
    }

    parsed.push({
      id: `q-bulk-${Date.now()}-${parsed.length}`,
      type: 'SINGLE_CHOICE',
      text: qText || 'Câu hỏi mới',
      explanation: '',
      timeLimitSec: 20,
      pointsMultiplier: 1,
      mediaType: 'NONE',
      mediaUrl: '',
      mediaStartTime: 0,
      mediaEndTime: 0,
      imageReveal: 'NONE',
      options,
    });
  }

  return parsed;
}

export const QuizEditor: React.FC = () => {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [showThemeDrawer, setShowThemeDrawer] = useState(false);
  const [showQuickPasteModal, setShowQuickPasteModal] = useState(false);
  const [quickPasteText, setQuickPasteText] = useState(
    `Câu 1: Nghiệm dương của phương trình $x^2 - 9 = 0$ là bao nhiêu?\n*A. $x = 3$\nB. $x = -3$\nC. $x = 9$\nD. $x = 0$\n\nCâu 2: Đạo hàm của hàm số $y = \\sin(x)$ là:\n*A. $\\cos(x)$\nB. $-\\cos(x)$\nC. $\\tan(x)$\nD. $\\sin(x)$`
  );
  const [previewMode, setPreviewMode] = useState(false);
  const [stickerTargetIdx, setStickerTargetIdx] = useState<number | null>(null);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  const showMessage = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 4000);
  };

  useEffect(() => {
    if (!quizId) return;
    fetch(`${API_BASE}/api/quizzes/${quizId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.id) {
          setQuiz(data);
        }
      })
      .catch(() => showMessage('Không thể tải dữ liệu bộ đề.'));
  }, [quizId]);

  if (!quiz) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center font-bold">
        Đang tải Kahoot! Creator Studio...
      </div>
    );
  }

  const currentQuestion: Question | undefined = quiz.questions[selectedIndex];
  const currentTheme = QUIZ_THEMES[quiz.themeId || 'CLASSIC_PURPLE'] || QUIZ_THEMES.CLASSIC_PURPLE;

  const updateCurrentQuestion = (patch: Partial<Question>) => {
    setQuiz((prev) => {
      if (!prev) return prev;
      const copy = [...prev.questions];
      if (!copy[selectedIndex]) return prev;
      copy[selectedIndex] = { ...copy[selectedIndex], ...patch };
      return { ...prev, questions: copy };
    });
  };

  const handleChangeQuestionType = (newType: QuestionType) => {
    if (!currentQuestion) return;

    if (newType === 'TRUE_FALSE') {
      updateCurrentQuestion({
        type: 'TRUE_FALSE',
        pointsMultiplier: currentQuestion.pointsMultiplier === 0 ? 1 : currentQuestion.pointsMultiplier,
        options: [
          { id: `${Date.now()}-1`, text: 'Đúng (True)', isCorrect: true, color: 'BLUE' },
          { id: `${Date.now()}-2`, text: 'Sai (False)', isCorrect: false, color: 'RED' },
        ],
      });
    } else if (newType === 'TYPE_ANSWER') {
      updateCurrentQuestion({
        type: 'TYPE_ANSWER',
        pointsMultiplier: currentQuestion.pointsMultiplier === 0 ? 1 : currentQuestion.pointsMultiplier,
        options: [
          { id: `${Date.now()}-1`, text: currentQuestion.options[0]?.text || 'Đáp án đúng 1', isCorrect: true, color: 'RED' },
          { id: `${Date.now()}-2`, text: '', isCorrect: true, color: 'BLUE' },
          { id: `${Date.now()}-3`, text: '', isCorrect: true, color: 'YELLOW' },
        ],
      });
    } else if (newType === 'SLIDE') {
      updateCurrentQuestion({
        type: 'SLIDE',
        pointsMultiplier: 0,
        explanation:
          currentQuestion.explanation ||
          'Nhập nội dung thuyết trình, định lý Toán học hoặc ghi chú kiến thức tại đây...',
        options: [],
      });
    } else if (newType === 'POLL') {
      const existing = [...currentQuestion.options];
      while (existing.length < 4) {
        const idx = existing.length;
        existing.push({
          id: `${Date.now()}-${idx}`,
          text: `Lựa chọn khảo sát ${idx + 1}`,
          isCorrect: true,
          color: COLORS[idx % 4],
        });
      }
      updateCurrentQuestion({
        type: 'POLL',
        pointsMultiplier: 0,
        options: existing.slice(0, 4).map((o) => ({ ...o, isCorrect: true })),
      });
    } else {
      const existing = [...currentQuestion.options];
      while (existing.length < 4) {
        const idx = existing.length;
        existing.push({
          id: `${Date.now()}-${idx}`,
          text: `Đáp án ${idx + 1}`,
          isCorrect: idx === 0,
          color: COLORS[idx % 4],
        });
      }
      updateCurrentQuestion({
        type: newType,
        pointsMultiplier: currentQuestion.pointsMultiplier === 0 ? 1 : currentQuestion.pointsMultiplier,
        options: existing.slice(0, 4),
      });
    }
  };

  const handleAddQuestion = (presetType: QuestionType = 'SINGLE_CHOICE') => {
    const newQ: Question = {
      id: `q-${Date.now()}`,
      type: presetType,
      text:
        presetType === 'SLIDE'
          ? 'Tiêu đề Slide Bài Giảng / Kiến Thức Trọng Tâm'
          : 'Nhập câu hỏi (Hỗ trợ công thức Toán $x^2 + y^2 = z^2$)...',
      explanation:
        presetType === 'SLIDE'
          ? 'Nội dung ghi chú chính hoặc định lý cần nhớ trước khi bước vào câu hỏi tiếp theo.'
          : '',
      timeLimitSec: 20,
      pointsMultiplier: presetType === 'POLL' || presetType === 'SLIDE' ? 0 : 1,
      mediaType: 'NONE',
      mediaUrl: '',
      mediaStartTime: 0,
      mediaEndTime: 0,
      imageReveal: 'NONE',
      options:
        presetType === 'SLIDE'
          ? []
          : presetType === 'TRUE_FALSE'
          ? [
              { id: `o-${Date.now()}-1`, text: 'Đúng (True)', isCorrect: true, color: 'BLUE' },
              { id: `o-${Date.now()}-2`, text: 'Sai (False)', isCorrect: false, color: 'RED' },
            ]
          : [
              { id: `o-${Date.now()}-1`, text: 'Đáp án A', isCorrect: true, color: 'RED' },
              { id: `o-${Date.now()}-2`, text: 'Đáp án B', isCorrect: false, color: 'BLUE' },
              { id: `o-${Date.now()}-3`, text: 'Đáp án C', isCorrect: false, color: 'YELLOW' },
              { id: `o-${Date.now()}-4`, text: 'Đáp án D', isCorrect: false, color: 'GREEN' },
            ],
    };
    setQuiz((prev) => {
      if (!prev) return prev;
      const nextQuestions = [...prev.questions, newQ];
      setSelectedIndex(nextQuestions.length - 1);
      return { ...prev, questions: nextQuestions };
    });
  };

  const handleDuplicateQuestion = (idx: number) => {
    const source = quiz.questions[idx];
    if (!source) return;
    const cloned: Question = {
      ...source,
      id: `q-dup-${Date.now()}`,
      options: source.options.map((o, i) => ({
        ...o,
        id: `o-dup-${Date.now()}-${i}`,
      })),
    };
    setQuiz((prev) => {
      if (!prev) return prev;
      const next = [...prev.questions];
      next.splice(idx + 1, 0, cloned);
      setSelectedIndex(idx + 1);
      return { ...prev, questions: next };
    });
    showMessage(`Đã nhân bản Câu ${idx + 1}`);
  };

  const handleMoveQuestion = (idx: number, direction: -1 | 1) => {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= quiz.questions.length) return;
    setQuiz((prev) => {
      if (!prev) return prev;
      const next = [...prev.questions];
      const [moved] = next.splice(idx, 1);
      next.splice(targetIdx, 0, moved);
      setSelectedIndex(targetIdx);
      return { ...prev, questions: next };
    });
  };

  const handleDeleteQuestion = (idx: number) => {
    if (quiz.questions.length <= 1) {
      showMessage('Bộ đề phải có ít nhất 1 câu hỏi.');
      return;
    }
    setQuiz((prev) => {
      if (!prev) return prev;
      const next = prev.questions.filter((_, i) => i !== idx);
      setSelectedIndex((cur) => Math.max(0, Math.min(cur, next.length - 1)));
      return { ...prev, questions: next };
    });
  };

  const handleMediaFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadProgress(0);
    try {
      const uploaded = await uploadMediaFileWithProgress(file, (pct) => setUploadProgress(pct));
      updateCurrentQuestion({
        mediaType: uploaded.mediaType,
        mediaUrl: uploaded.url,
      });
      showMessage(`Đã tải lên: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Lỗi tải file media.');
    } finally {
      setUploadProgress(null);
      if (mediaInputRef.current) mediaInputRef.current.value = '';
    }
  };

  const handleSaveQuiz = async (startLiveAfterSave = false) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/quizzes/${quiz.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(quiz),
      });
      if (!res.ok) throw new Error('Không thể lưu bộ đề.');
      const saved = await res.json();
      setQuiz(saved);
      showMessage('Đã lưu toàn bộ bộ câu hỏi thành công!');
      if (startLiveAfterSave) {
        navigate(`/host/${quiz.id}`);
      }
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Lỗi lưu bộ đề.');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyQuickPaste = () => {
    const newQuestions = parseBulkTextToQuestions(quickPasteText);
    if (newQuestions.length === 0) {
      showMessage('Không tìm thấy câu hỏi hợp lệ trong văn bản.');
      return;
    }
    setQuiz((prev) => {
      if (!prev) return prev;
      const next = [...prev.questions, ...newQuestions];
      setSelectedIndex(next.length - newQuestions.length);
      return { ...prev, questions: next };
    });
    setShowQuickPasteModal(false);
    showMessage(`Đã tách và thêm tự động ${newQuestions.length} câu hỏi!`);
  };

  const insertMathSnippet = (snippet: string) => {
    if (!currentQuestion) return;
    updateCurrentQuestion({
      text: `${currentQuestion.text} ${snippet}`.trim(),
    });
  };

  const handleToggleVoiceRecord = async () => {
    if (isRecordingVoice && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecordingVoice(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordedChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `giong-co-giao-${Date.now()}.webm`, {
          type: 'audio/webm',
        });
        try {
          setUploadProgress(10);
          const uploaded = await uploadMediaFileWithProgress(file, (pct) =>
                            setUploadProgress(pct)
                          );
          updateCurrentQuestion({
            mediaType: 'AUDIO',
            mediaUrl: uploaded.url,
          });
          showMessage('Đã lưu bản thu âm giọng Cô giáo vào câu hỏi!');
        } catch (err) {
          showMessage(err instanceof Error ? err.message : 'Lỗi lưu ghi âm.');
        } finally {
          setUploadProgress(null);
        }
      };

      recorder.start();
      setIsRecordingVoice(true);
      showMessage('Đang thu âm giọng Cô giáo... Bấm lại nút Thu âm để dừng và lưu.');
    } catch {
      showMessage('Không thể mở Micro. Vui lòng cấp quyền Micro trên trình duyệt.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* Top Navbar (create.kahoot.it style) */}
      <header className="border-b border-slate-800 bg-slate-900/95 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
        <div className="flex items-center gap-2.5 flex-1 min-w-[260px]">
          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Quay lại Danh sách Bộ đề"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <input
            type="text"
            value={quiz.title}
            onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
            className="bg-slate-950 border border-slate-700 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm sm:text-base font-black text-white w-full max-w-md focus:outline-none"
            placeholder="Nhập tên Kahoot..."
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowQuickPasteModal(true)}
            className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-300 font-black text-xs flex items-center gap-1.5"
          >
            <FileText className="w-4 h-4" /> Dán Nhanh Đề Thi
          </button>

          <button
            type="button"
            onClick={() => setShowThemeDrawer((v) => !v)}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-extrabold flex items-center gap-1.5"
          >
            <Palette className="w-4 h-4 text-fuchsia-400" />
            <span>Chủ đề (Themes)</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className={`px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 ${
              previewMode
                ? 'bg-emerald-600 border-emerald-400 text-white'
                : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>{previewMode ? 'Đóng Xem Trước' : 'Xem Trước (Preview)'}</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveQuiz(false)}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Đang lưu...' : 'Lưu'}</span>
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => handleSaveQuiz(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm flex items-center gap-1.5 shadow"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Lưu & Mở Phòng Live</span>
          </button>
        </div>
      </header>

      {/* Theme Picker Bar */}
      {showThemeDrawer && (
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-black uppercase tracking-wider text-fuchsia-300 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Chọn Chủ Đề Sân Khấu (Visual Theme chuẩn create.kahoot.it):
            </span>
            <div className="flex items-center gap-2.5 flex-wrap">
              {(Object.keys(QUIZ_THEMES) as QuizThemeId[]).map((tKey) => {
                const t = QUIZ_THEMES[tKey];
                const active = (quiz.themeId || 'CLASSIC_PURPLE') === tKey;
                return (
                  <button
                    key={tKey}
                    type="button"
                    onClick={() => setQuiz({ ...quiz, themeId: tKey })}
                    className={`px-3.5 py-2 rounded-xl text-xs font-black border flex items-center gap-2 transition ${
                      active
                        ? 'border-white ring-2 ring-indigo-400 bg-slate-800 text-white'
                        : 'border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full bg-gradient-to-br ${t.bgGradient}`} />
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {statusMsg && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl bg-indigo-600 border border-indigo-400 text-white font-bold text-sm shadow-2xl">
          {statusMsg}
        </div>
      )}

      {/* Quick Paste Modal */}
      {stickerTargetIdx !== null && currentQuestion && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-400/40 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-amber-300">
                🧸 Kho Sticker Mầm Non — Chọn hình cho Đáp án {stickerTargetIdx + 1}
              </h3>
              <button
                type="button"
                onClick={() => setStickerTargetIdx(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {PRESCHOOL_STICKER_GROUPS.map((group) => (
              <div key={group.category} className="space-y-2">
                <div className="text-xs font-black uppercase text-indigo-300">
                  {group.category}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {group.items.map((item) => (
                    <button
                      key={item.emoji + item.label}
                      type="button"
                      onClick={() => {
                        const nextOpts = [...currentQuestion.options];
                        nextOpts[stickerTargetIdx] = {
                          ...nextOpts[stickerTargetIdx],
                          sticker: item.emoji,
                          text:
                            !nextOpts[stickerTargetIdx].text ||
                            nextOpts[stickerTargetIdx].text.startsWith('Đáp án')
                              ? item.label
                              : nextOpts[stickerTargetIdx].text,
                        };
                        updateCurrentQuestion({ options: nextOpts });
                        setStickerTargetIdx(null);
                      }}
                      className="p-2.5 rounded-2xl bg-slate-950 hover:bg-indigo-950 border border-slate-800 hover:border-indigo-400 flex items-center gap-2 text-left transition"
                    >
                      <span className="text-3xl">{item.emoji}</span>
                      <span className="text-xs font-bold text-slate-200">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  const nextOpts = [...currentQuestion.options];
                  nextOpts[stickerTargetIdx] = {
                    ...nextOpts[stickerTargetIdx],
                    sticker: undefined,
                  };
                  updateCurrentQuestion({ options: nextOpts });
                  setStickerTargetIdx(null);
                }}
                className="px-4 py-2 rounded-xl bg-rose-950 text-rose-300 text-xs font-bold"
              >
                Xóa Sticker ở đáp án này
              </button>
              <button
                type="button"
                onClick={() => setStickerTargetIdx(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuickPasteModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-indigo-500/40 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-amber-300 flex items-center gap-2">
                <FileText className="w-5 h-5" /> Tạo Nhanh Câu Hỏi Từ Văn Bản Đề Thi
              </h3>
              <button
                type="button"
                onClick={() => setShowQuickPasteModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Mỗi câu hỏi cách nhau 1 dòng trống. Đặt dấu <strong className="text-emerald-300">*</strong> ở đầu đáp án đúng (VD: <code>*A. Đáp án đúng</code>). Hỗ trợ giữ nguyên công thức Toán <code>$...$</code>.
            </p>
            <textarea
              rows={9}
              value={quickPasteText}
              onChange={(e) => setQuickPasteText(e.target.value)}
              className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-700 font-mono text-xs sm:text-sm text-white focus:border-indigo-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowQuickPasteModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={handleApplyQuickPaste}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black"
              >
                + Tách & Thêm Vào Bộ Đề
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3-Column Kahoot Creator Studio Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 w-full max-w-[1600px] mx-auto gap-4 p-3 sm:p-4">
        {/* LEFT PANE (2 cols): Slide Navigator Rail with Move Up/Down & Duplicate */}
        <aside className="lg:col-span-2 bg-slate-900/90 border border-slate-800 rounded-3xl p-3 flex flex-col justify-between max-h-[86vh]">
          <div className="overflow-y-auto space-y-2 pr-1">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1 mb-1">
              Slides ({quiz.questions.length})
            </div>

            {quiz.questions.map((q, idx) => (
              <div
                key={q.id}
                onClick={() => setSelectedIndex(idx)}
                className={`group cursor-pointer p-2.5 rounded-2xl border transition flex flex-col gap-1.5 ${
                  idx === selectedIndex
                    ? 'bg-indigo-600/25 border-indigo-400 ring-2 ring-indigo-500/40'
                    : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-black">
                  <span className="text-indigo-300">
                    {idx + 1}. {q.type === 'SLIDE' ? 'SLIDE' : q.type === 'TYPE_ANSWER' ? 'ĐIỀN ĐÁP ÁN' : q.type === 'POLL' ? 'KHẢO SÁT' : 'QUIZ'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {q.timeLimitSec}s
                  </span>
                </div>

                <div className="text-xs font-bold line-clamp-2 text-slate-200">{q.text}</div>

                {/* Slide Quick Actions: Up, Down, Duplicate, Delete */}
                <div
                  className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-slate-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMoveQuestion(idx, -1)}
                      className="p-1 rounded hover:bg-slate-800 disabled:opacity-30"
                      title="Chuyển lên"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === quiz.questions.length - 1}
                      onClick={() => handleMoveQuestion(idx, 1)}
                      className="p-1 rounded hover:bg-slate-800 disabled:opacity-30"
                      title="Chuyển xuống"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicateQuestion(idx)}
                      className="p-1 rounded hover:bg-slate-800 text-indigo-300"
                      title="Nhân bản câu hỏi này"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteQuestion(idx)}
                      className="p-1 rounded hover:bg-rose-900/50 text-rose-400"
                      title="Xóa câu hỏi"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-800 space-y-2">
            <button
              type="button"
              onClick={() => handleAddQuestion('SINGLE_CHOICE')}
              className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs flex items-center justify-center gap-1 shadow"
            >
              <Plus className="w-4 h-4 stroke-[3]" /> Thêm Câu Hỏi
            </button>
            <button
              type="button"
              onClick={() => handleAddQuestion('SLIDE')}
              className="w-full py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs flex items-center justify-center gap-1 border border-slate-700"
            >
              + Thêm Slide Thuyết Trình
            </button>
          </div>
        </aside>

        {/* CENTER PANE (7 cols): WYSIWYG Stage Canvas (create.kahoot.it authentic look) */}
        {currentQuestion && (
          <main
            className={`lg:col-span-7 rounded-3xl border border-white/15 bg-gradient-to-br ${currentTheme.bgGradient} p-4 sm:p-6 flex flex-col justify-between gap-5 shadow-2xl`}
          >
            {/* Top Question Banner Card */}
            <div className="bg-white text-slate-900 rounded-2xl p-4 sm:p-5 shadow-xl space-y-2">
              {!previewMode ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500">
                    <span>Gõ câu hỏi (hỗ trợ LaTeX $...$):</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { label: 'Phân số', code: '$\\frac{a}{b}$' },
                        { label: 'Căn', code: '$\\sqrt{x}$' },
                        { label: 'Tích phân', code: '$\\int_0^1 x\\,dx$' },
                        { label: 'Mũ 2', code: '$x^2$' },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => insertMathSnippet(item.code)}
                          className="px-2 py-0.5 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold"
                        >
                          +{item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    value={currentQuestion.text}
                    onChange={(e) => updateCurrentQuestion({ text: e.target.value })}
                    className="w-full text-center text-lg sm:text-2xl font-black text-slate-900 bg-slate-100/80 rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Bấm để nhập câu hỏi của bạn..."
                  />
                  {currentQuestion.text.includes('$') && (
                    <div className="text-center pt-1 text-lg sm:text-2xl font-black text-indigo-950 border-t border-slate-200">
                      <MathText text={currentQuestion.text} />
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center text-xl sm:text-3xl font-black py-2">
                  <MathText text={currentQuestion.text} />
                </div>
              )}
            </div>

            {/* Center Multimedia Stage Box */}
            <div className="flex-1 flex flex-col items-center justify-center">
              {currentQuestion.mediaType === 'NONE' && !previewMode ? (
                <div className="w-full max-w-xl rounded-3xl border-2 border-dashed border-white/30 bg-black/25 backdrop-blur-sm p-6 text-center space-y-4">
                  <div className="text-sm font-extrabold text-white/90">
                    Chèn Đa Phương Tiện (Video ≤ 100MB, Âm thanh, YouTube hoặc Hình ảnh)
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <input
                      ref={mediaInputRef}
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/mp4,image/*"
                      onChange={handleMediaFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => mediaInputRef.current?.click()}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow"
                    >
                      <Upload className="w-4 h-4" /> Tải lên Video ≤100MB / Audio / Ảnh
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCurrentQuestion({ mediaType: 'YOUTUBE' })}
                      className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center gap-1.5 shadow"
                    >
                      <Youtube className="w-4 h-4" /> Chèn Link YouTube
                    </button>
                    <button
                      type="button"
                      onClick={handleToggleVoiceRecord}
                      className={`px-4 py-2.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow ${
                        isRecordingVoice
                          ? 'bg-rose-600 animate-pulse text-white'
                          : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                      }`}
                    >
                      <Music className="w-4 h-4" />
                      <span>
                        {isRecordingVoice ? '⏹ Dừng & Lưu Giọng Cô' : '🎙 Thu Âm Giọng Cô Giáo'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => speakVietnameseText(currentQuestion.text)}
                      className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs"
                    >
                      🔊 Nghe Thử Giọng Đọc TTS
                    </button>
                  </div>
                  {uploadProgress !== null && (
                    <div className="w-full bg-white/20 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-emerald-400 h-full transition-all"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full space-y-3">
                  {!previewMode && (
                    <div className="bg-black/45 backdrop-blur rounded-2xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      {currentQuestion.mediaType === 'YOUTUBE' ? (
                        <input
                          type="text"
                          value={currentQuestion.mediaUrl || ''}
                          onChange={(e) => updateCurrentQuestion({ mediaUrl: e.target.value })}
                          placeholder="Dán link YouTube (https://www.youtube.com/watch?v=...)"
                          className="flex-1 min-w-[200px] px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-white font-bold"
                        />
                      ) : (
                        <span className="font-bold text-emerald-300 truncate max-w-xs">
                          File: {currentQuestion.mediaUrl}
                        </span>
                      )}

                      {currentQuestion.mediaType !== 'IMAGE' && (
                        <div className="flex items-center gap-2">
                          <label className="text-slate-300">Bắt đầu(s):</label>
                          <input
                            type="number"
                            min={0}
                            value={currentQuestion.mediaStartTime || 0}
                            onChange={(e) =>
                              updateCurrentQuestion({ mediaStartTime: Math.max(0, Number(e.target.value)) })
                            }
                            className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-center font-bold"
                          />
                          <label className="text-slate-300">Dừng(s):</label>
                          <input
                            type="number"
                            min={0}
                            value={currentQuestion.mediaEndTime || 0}
                            onChange={(e) =>
                              updateCurrentQuestion({ mediaEndTime: Math.max(0, Number(e.target.value)) })
                            }
                            className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-center font-bold"
                          />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => updateCurrentQuestion({ mediaType: 'NONE', mediaUrl: '' })}
                        className="px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-bold"
                      >
                        Gỡ Media
                      </button>
                    </div>
                  )}

                  <MediaStage
                    mediaType={currentQuestion.mediaType}
                    mediaUrl={currentQuestion.mediaUrl}
                    startTime={currentQuestion.mediaStartTime}
                    endTime={currentQuestion.mediaEndTime}
                    imageReveal={currentQuestion.imageReveal || 'NONE'}
                    role="EDITOR"
                    autoPlay={false}
                  />
                </div>
              )}
            </div>

            {/* Bottom Answer Area: Adapts to Quiz/Poll, True/False, Type Answer, or Slide */}
            {currentQuestion.type === 'SLIDE' ? (
              <div className="bg-black/40 backdrop-blur-md border border-white/20 rounded-2xl p-5 space-y-2">
                <div className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Nội dung Slide Thuyết Trình / Kiến Thức (Hỗ trợ Toán KaTeX $...$):
                </div>
                {!previewMode ? (
                  <textarea
                    rows={4}
                    value={currentQuestion.explanation || ''}
                    onChange={(e) => updateCurrentQuestion({ explanation: e.target.value })}
                    className="w-full p-3.5 rounded-xl bg-slate-950/90 border border-slate-700 text-base font-bold text-white"
                    placeholder="Nhập nội dung bài giảng hoặc kết luận hiển thị trên màn chiếu..."
                  />
                ) : null}
                <div className="text-base sm:text-xl font-bold text-white pt-1">
                  <MathText text={currentQuestion.explanation || ''} />
                </div>
              </div>
            ) : currentQuestion.type === 'TYPE_ANSWER' ? (
              <div className="bg-black/40 backdrop-blur-md border border-white/20 rounded-2xl p-5 space-y-3">
                <div className="text-xs font-black uppercase tracking-wider text-amber-300">
                  Các đáp án văn bản/con số được chấp nhận là ĐÚNG (Không phân biệt chữ hoa/thường):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[0, 1, 2].map((idx) => {
                    const val = currentQuestion.options[idx]?.text || '';
                    return (
                      <input
                        key={idx}
                        type="text"
                        value={val}
                        onChange={(e) => {
                          const next = [...currentQuestion.options];
                          while (next.length <= idx) {
                            next.push({
                              id: `ta-${Date.now()}-${next.length}`,
                              text: '',
                              isCorrect: true,
                              color: COLORS[next.length % 4],
                            });
                          }
                          next[idx] = { ...next[idx], text: e.target.value, isCorrect: true };
                          updateCurrentQuestion({ options: next });
                        }}
                        placeholder={idx === 0 ? 'Đáp án chuẩn (VD: 12)' : `Cách viết khác ${idx + 1} (tuỳ chọn)`}
                        className="px-4 py-3 rounded-xl bg-white text-slate-950 font-black text-base text-center shadow"
                      />
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentQuestion.options.map((opt, oIdx) => {
                  const colorKey = COLORS[oIdx % 4];
                  const tile = KAHOOT_TILE_STYLES[colorKey];

                  const toggleCorrect = () => {
                    if (currentQuestion.type === 'POLL') return;
                    const nextOpts = currentQuestion.options.map((item, idx) => {
                      if (currentQuestion.type === 'MULTIPLE_CHOICE') {
                        return idx === oIdx ? { ...item, isCorrect: !item.isCorrect } : item;
                      }
                      return { ...item, isCorrect: idx === oIdx };
                    });
                    updateCurrentQuestion({ options: nextOpts });
                  };

                  return (
                    <div
                      key={opt.id}
                      className={`${tile.bg} rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 kahoot-shadow transition`}
                    >
                      <div className="w-10 h-10 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                        {tile.shape}
                      </div>

                      {/* Preschool Giant Sticker Picker Button */}
                      <button
                        type="button"
                        onClick={() => setStickerTargetIdx(oIdx)}
                        className="w-12 h-12 rounded-2xl bg-black/25 hover:bg-black/40 border border-white/30 flex items-center justify-center text-2xl shrink-0"
                        title="Chọn Hình Sticker Mầm Non cho đáp án này"
                      >
                        {opt.sticker || '🧸'}
                      </button>

                      <div className="flex-1 min-w-0">
                        {!previewMode && currentQuestion.type !== 'TRUE_FALSE' ? (
                          <input
                            type="text"
                            value={opt.text}
                            onChange={(e) => {
                              const nextOpts = [...currentQuestion.options];
                              nextOpts[oIdx] = { ...nextOpts[oIdx], text: e.target.value };
                              updateCurrentQuestion({ options: nextOpts });
                            }}
                            placeholder={`Nhập đáp án ${oIdx + 1}...`}
                            className="w-full bg-black/20 focus:bg-black/35 text-white placeholder:text-white/70 font-black text-sm sm:text-base px-3 py-2 rounded-xl focus:outline-none"
                          />
                        ) : (
                          <div className="text-base sm:text-lg font-black text-white">
                            <MathText text={opt.text} />
                          </div>
                        )}
                        {!previewMode && opt.text.includes('$') && (
                          <div className="text-xs text-white/90 mt-1 px-1">
                            <MathText text={opt.text} />
                          </div>
                        )}
                      </div>

                      {currentQuestion.type !== 'POLL' && (
                        <button
                          type="button"
                          onClick={toggleCorrect}
                          className={`w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                            opt.isCorrect
                              ? 'bg-emerald-500 border-white text-white scale-110 shadow-lg'
                              : 'border-white/70 bg-black/20 text-transparent hover:bg-black/40'
                          }`}
                          title="Đánh dấu là Đáp án đúng"
                        >
                          <CheckCircle2 className="w-6 h-6" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        )}

        {/* RIGHT PANE (3 cols): Question Properties Inspector Drawer (create.kahoot.it style) */}
        {currentQuestion && (
          <aside className="lg:col-span-3 bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-5 max-h-[86vh] overflow-y-auto">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Loại câu hỏi (Question Type)
              </label>
              <select
                value={currentQuestion.type}
                onChange={(e) => handleChangeQuestionType(e.target.value as QuestionType)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-extrabold text-sm text-white"
              >
                <option value="SINGLE_CHOICE">Quiz — Trắc nghiệm 1 đáp án</option>
                <option value="MULTIPLE_CHOICE">Quiz — Nhiều đáp án (Multi-select)</option>
                <option value="TRUE_FALSE">True / False — Đúng hoặc Sai</option>
                <option value="TYPE_ANSWER">Type Answer — Điền đáp án ngắn</option>
                <option value="POLL">Poll — Bình chọn khảo sát (0 điểm)</option>
                <option value="SLIDE">Slide — Trang thuyết trình bài giảng</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" /> Thời gian (Time Limit)
              </label>
              <select
                value={currentQuestion.timeLimitSec}
                onChange={(e) => updateCurrentQuestion({ timeLimitSec: Number(e.target.value) })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-extrabold text-sm text-white"
              >
                {[10, 15, 20, 30, 45, 60, 90, 120, 180, 240].map((sec) => (
                  <option key={sec} value={sec}>
                    {sec} giây
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-fuchsia-400" /> Điểm số (Points)
              </label>
              <select
                value={currentQuestion.pointsMultiplier}
                disabled={currentQuestion.type === 'POLL' || currentQuestion.type === 'SLIDE'}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  updateCurrentQuestion({
                    pointsMultiplier: v === 0 ? 0 : v === 2 ? 2 : 1,
                  });
                }}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-extrabold text-sm text-white disabled:opacity-50"
              >
                <option value={1}>Điểm chuẩn (Standard - 1000đ)</option>
                <option value={2}>Nhân đôi điểm (Double - 2000đ)</option>
                <option value={0}>Không tính điểm (No points - 0đ)</option>
              </select>
            </div>

            {/* Image Reveal Effect (from create.kahoot.it) */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-amber-300 mb-1.5 flex items-center gap-1.5">
                <Grid className="w-4 h-4" /> Hiệu ứng Mở Ảnh Bí Ẩn (Image Reveal)
              </label>
              <select
                value={currentQuestion.imageReveal || 'NONE'}
                onChange={(e) =>
                  updateCurrentQuestion({ imageReveal: e.target.value as ImageRevealMode })
                }
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 font-extrabold text-sm text-white"
              >
                <option value="NONE">Hiển thị toàn bộ ảnh gốc</option>
                <option value="GRID_3X3">Mở dần từng ô 3×3 (9 mảnh)</option>
                <option value="GRID_5X5">Mở dần từng ô 5×5 (25 mảnh)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Khi chọn Hình ảnh, các ô vuông che ảnh sẽ tự động lật mở dần theo nhịp đếm ngược.
              </p>
            </div>

            {/* Quick Media Switcher */}
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Loại Media đính kèm
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { type: 'NONE', label: 'Không dùng', icon: null },
                    { type: 'YOUTUBE', label: 'YouTube', icon: <Youtube className="w-3.5 h-3.5 text-rose-400" /> },
                    { type: 'VIDEO_UPLOAD', label: 'Video ≤100M', icon: <Film className="w-3.5 h-3.5 text-emerald-400" /> },
                    { type: 'AUDIO', label: 'Âm thanh', icon: <Music className="w-3.5 h-3.5 text-amber-400" /> },
                    { type: 'IMAGE', label: 'Hình ảnh', icon: <ImageIcon className="w-3.5 h-3.5 text-sky-400" /> },
                  ] as Array<{ type: MediaType; label: string; icon: React.ReactNode }>
                ).map((m) => (
                  <button
                    key={m.type}
                    type="button"
                    onClick={() => updateCurrentQuestion({ mediaType: m.type })}
                    className={`px-2.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                      currentQuestion.mediaType === m.type
                        ? 'bg-indigo-600 border-indigo-400 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300'
                    }`}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Pedagogical Explanation */}
            {currentQuestion.type !== 'SLIDE' && (
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-emerald-300 flex items-center gap-1">
                  <HelpCircle className="w-3.5 h-3.5" /> Giải thích đáp án (Hiện sau câu hỏi)
                </label>
                <textarea
                  rows={3}
                  value={currentQuestion.explanation || ''}
                  onChange={(e) => updateCurrentQuestion({ explanation: e.target.value })}
                  placeholder="Nhập lời giải thích (hỗ trợ LaTeX $...$)..."
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:border-emerald-500 focus:outline-none"
                />
                {currentQuestion.explanation && (
                  <div className="text-xs text-emerald-200 bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2">
                    <MathText text={currentQuestion.explanation} />
                  </div>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  );
};
