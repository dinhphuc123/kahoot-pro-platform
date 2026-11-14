import type { QuestionOption, QuestionType } from '../types.ts';

function normalizeTypedText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function evaluateAnswer(
  type: QuestionType,
  options: QuestionOption[],
  selectedOptionIdsOrText: string[]
): boolean {
  if (type === 'SLIDE') {
    return true;
  }

  if (type === 'POLL') {
    return selectedOptionIdsOrText && selectedOptionIdsOrText.length > 0;
  }

  if (!selectedOptionIdsOrText || selectedOptionIdsOrText.length === 0) {
    return false;
  }

  if (type === 'TYPE_ANSWER') {
    const playerTyped = normalizeTypedText(selectedOptionIdsOrText[0] || '');
    if (!playerTyped) return false;
    const acceptedTexts = options
      .filter((o) => o.isCorrect || o.text.trim().length > 0)
      .map((o) => normalizeTypedText(o.text))
      .filter(Boolean);
    return acceptedTexts.includes(playerTyped);
  }

  const correctIds = options.filter((o) => o.isCorrect).map((o) => o.id);
  if (correctIds.length === 0) {
    return false;
  }

  if (type === 'SINGLE_CHOICE' || type === 'TRUE_FALSE') {
    return (
      selectedOptionIdsOrText.length === 1 &&
      correctIds.includes(selectedOptionIdsOrText[0])
    );
  }

  // MULTIPLE_CHOICE: exact match of all correct options
  const uniqueSelected = Array.from(new Set(selectedOptionIdsOrText));
  if (uniqueSelected.length !== correctIds.length) {
    return false;
  }
  return correctIds.every((id) => uniqueSelected.includes(id));
}

export function calculateScore(params: {
  isCorrect: boolean;
  responseTimeMs: number;
  timeLimitSec: number;
  pointsMultiplier: 0 | 1 | 2;
  currentStreak: number;
}): { earnedPoints: number; newStreak: number; streakBonus: number } {
  if (params.pointsMultiplier === 0) {
    // Poll / No-points question: preserve streak, award 0 points
    return {
      earnedPoints: 0,
      newStreak: params.currentStreak,
      streakBonus: 0,
    };
  }

  if (!params.isCorrect) {
    return { earnedPoints: 0, newStreak: 0, streakBonus: 0 };
  }

  const totalTimeMs = Math.max(1000, params.timeLimitSec * 1000);
  const clampedTime = Math.max(0, Math.min(params.responseTimeMs, totalTimeMs));
  // Ratio ranges from 1.0 (instant) down to 0.5 (at the buzzer)
  const ratio = 1 - clampedTime / totalTimeMs / 2;
  const basePoints = Math.round(1000 * ratio) * params.pointsMultiplier;
  const newStreak = params.currentStreak + 1;
  const streakBonus = newStreak >= 2 ? Math.min((newStreak - 1) * 100, 500) : 0;

  return {
    earnedPoints: basePoints + streakBonus,
    newStreak,
    streakBonus,
  };
}
