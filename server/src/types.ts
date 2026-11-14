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
  isCorrect: boolean;
  color: OptionColor;
  sticker?: string;
  imageUrl?: string;
}

export interface Question {
  id: string;
  quizId: string;
  orderIndex: number;
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

export interface SessionRecord {
  id: string;
  quizId: string;
  quizTitle: string;
  mode: 'LIVE' | 'SELF_PACED';
  pin?: string;
  startedAt: string;
  endedAt: string;
  totalQuestions: number;
  playerCount: number;
}
