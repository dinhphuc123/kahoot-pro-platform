export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE'
  | 'TRUE_FALSE'
  | 'TYPE_ANSWER'
  | 'POLL'
  | 'SLIDE';

export type MediaType = 'NONE' | 'IMAGE' | 'AUDIO' | 'VIDEO_UPLOAD' | 'YOUTUBE';
export type OptionColor = 'RED' | 'BLUE' | 'YELLOW' | 'GREEN';
export type MediaDeliveryMode = 'PROJECTOR_FIRST' | 'SYNC_ALL_DEVICES';
export type GamePacingMode = 'MEDIA_FIRST' | 'IMMEDIATE_COUNTDOWN';
export type ImageRevealMode = 'NONE' | 'GRID_3X3' | 'GRID_5X5';
export type QuizThemeId = 'CLASSIC_PURPLE' | 'CYBER_NEON' | 'EMERALD_CLASS' | 'SUNSET_FEST';

export interface QuestionOption {
  id: string;
  text: string;
  isCorrect?: boolean;
  color: OptionColor;
  sticker?: string;
  imageUrl?: string;
}

export interface Question {
  id: string;
  quizId?: string;
  orderIndex?: number;
  type: QuestionType;
  text: string;
  explanation?: string;
  timeLimitSec: number;
  pointsMultiplier: 0 | 1 | 2;
  mediaType: MediaType;
  mediaUrl?: string;
  mediaStartTime?: number;
  mediaEndTime?: number;
  imageReveal?: ImageRevealMode;
  options: QuestionOption[];
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  themeId?: QuizThemeId;
  createdAt: string;
  updatedAt: string;
  questionCount?: number;
  questions: Question[];
}

export interface RoomSettings {
  mediaDeliveryMode: MediaDeliveryMode;
  pacingMode: GamePacingMode;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showOptionTextOnPlayer: boolean;
  isLocked: boolean;
  themeId?: QuizThemeId;
  preschoolMode?: boolean;
}

export const PRESCHOOL_STICKER_GROUPS: Array<{
  category: string;
  items: Array<{ emoji: string; label: string }>;
}> = [
  {
    category: 'Con Vật Đáng Yêu',
    items: [
      { emoji: '🐰', label: 'Thỏ Trắng' },
      { emoji: '🐻', label: 'Gấu Nâu' },
      { emoji: '🐱', label: 'Mèo Con' },
      { emoji: '🐶', label: 'Cún Cưng' },
      { emoji: '🐘', label: 'Voi Con' },
      { emoji: '🦁', label: 'Sư Tử' },
      { emoji: '🐼', label: 'Gấu Trúc' },
      { emoji: '🐓', label: 'Gà Trống' },
      { emoji: '🦆', label: 'Vịt Vàng' },
      { emoji: '🐠', label: 'Cá Vàng' },
      { emoji: '🦋', label: 'Bươm Bướm' },
      { emoji: '🐸', label: 'Ếch Xanh' },
    ],
  },
  {
    category: 'Hoa Quả & Đồ Ăn',
    items: [
      { emoji: '🍎', label: 'Quả Táo' },
      { emoji: '🍌', label: 'Quả Chuối' },
      { emoji: '🍉', label: 'Dưa Hấu' },
      { emoji: '🍓', label: 'Dâu Tây' },
      { emoji: '🍊', label: 'Quả Cam' },
      { emoji: '🍇', label: 'Chùm Nho' },
      { emoji: '🥕', label: 'Cà Rốt' },
      { emoji: '🥛', label: 'Ly Sữa' },
    ],
  },
  {
    category: 'Số Đếm & Hình Khối',
    items: [
      { emoji: '1️⃣', label: 'Số 1' },
      { emoji: '2️⃣', label: 'Số 2' },
      { emoji: '3️⃣', label: 'Số 3' },
      { emoji: '4️⃣', label: 'Số 4' },
      { emoji: '5️⃣', label: 'Số 5' },
      { emoji: '🔴', label: 'Hình Tròn Đỏ' },
      { emoji: '🟦', label: 'Hình Vuông Xanh' },
      { emoji: '🔺', label: 'Tam Giác' },
      { emoji: '⭐', label: 'Ngôi Sao' },
    ],
  },
  {
    category: 'Giao Thông & Cảm Xúc',
    items: [
      { emoji: '🚲', label: 'Xe Đạp' },
      { emoji: '🚗', label: 'Ô Tô' },
      { emoji: '🚒', label: 'Xe Cứu Hỏa' },
      { emoji: '✈️', label: 'Máy Bay' },
      { emoji: '🚢', label: 'Tàu Thủy' },
      { emoji: '😊', label: 'Vui Vẻ' },
      { emoji: '😢', label: 'Buồn' },
      { emoji: '❤️', label: 'Yêu Thương' },
    ],
  },
];

export const KIDS_AVATARS = [
  { emoji: '🐰', name: 'Bé Thỏ Trắng' },
  { emoji: '🐻', name: 'Bé Gấu Nâu' },
  { emoji: '🐱', name: 'Bé Mèo Ngoan' },
  { emoji: '🐶', name: 'Bé Cún Con' },
  { emoji: '🐼', name: 'Bé Gấu Trúc' },
  { emoji: '🦁', name: 'Bé Sư Tử' },
  { emoji: '🐘', name: 'Bé Voi Con' },
  { emoji: '🦊', name: 'Bé Cáo Nhỏ' },
  { emoji: '🦄', name: 'Bé Kỳ Lân' },
  { emoji: '🐬', name: 'Bé Cá Heo' },
  { emoji: '🦋', name: 'Bé Bươm Bướm' },
  { emoji: '🐥', name: 'Bé Gà Bông' },
];

export const QUIZ_THEMES: Record<
  QuizThemeId,
  { name: string; bgGradient: string; cardBg: string; accentBadge: string }
> = {
  CLASSIC_PURPLE: {
    name: 'Kahoot! Classic Purple',
    bgGradient: 'from-[#25076B] via-[#46178F] to-[#1B054E]',
    cardBg: 'bg-[#1c0845]/90 border-purple-400/30',
    accentBadge: 'bg-purple-500/30 text-purple-200 border-purple-400/40',
  },
  CYBER_NEON: {
    name: 'Cyber Neon Dark',
    bgGradient: 'from-slate-950 via-indigo-950 to-slate-900',
    cardBg: 'bg-slate-900/90 border-indigo-500/30',
    accentBadge: 'bg-indigo-500/30 text-indigo-200 border-indigo-400/40',
  },
  EMERALD_CLASS: {
    name: 'Emerald Classroom',
    bgGradient: 'from-emerald-950 via-teal-900 to-slate-950',
    cardBg: 'bg-emerald-950/90 border-emerald-400/30',
    accentBadge: 'bg-emerald-500/30 text-emerald-200 border-emerald-400/40',
  },
  SUNSET_FEST: {
    name: 'Sunset Festival',
    bgGradient: 'from-rose-950 via-orange-950 to-amber-950',
    cardBg: 'bg-rose-950/90 border-amber-400/30',
    accentBadge: 'bg-amber-500/30 text-amber-200 border-amber-400/40',
  },
};
