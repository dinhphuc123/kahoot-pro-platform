import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore, evaluateAnswer } from '../src/services/scoring.ts';
import { parseYouTubeUrl } from '../src/services/youtube.ts';

describe('Task 2: Scoring Engine & YouTube Parser', () => {
  describe('evaluateAnswer', () => {
    it('evaluates SINGLE_CHOICE correctly', () => {
      const options = [
        { id: '1', text: 'A', isCorrect: true, color: 'RED' as const },
        { id: '2', text: 'B', isCorrect: false, color: 'BLUE' as const },
      ];
      assert.equal(evaluateAnswer('SINGLE_CHOICE', options, ['1']), true);
      assert.equal(evaluateAnswer('SINGLE_CHOICE', options, ['2']), false);
      assert.equal(evaluateAnswer('SINGLE_CHOICE', options, []), false);
    });

    it('evaluates MULTIPLE_CHOICE requiring exact set of all correct options', () => {
      const options = [
        { id: '1', text: 'A', isCorrect: true, color: 'RED' as const },
        { id: '2', text: 'B', isCorrect: true, color: 'BLUE' as const },
        { id: '3', text: 'C', isCorrect: false, color: 'YELLOW' as const },
      ];
      assert.equal(evaluateAnswer('MULTIPLE_CHOICE', options, ['1', '2']), true);
      assert.equal(evaluateAnswer('MULTIPLE_CHOICE', options, ['2', '1']), true);
      assert.equal(evaluateAnswer('MULTIPLE_CHOICE', options, ['1']), false);
      assert.equal(evaluateAnswer('MULTIPLE_CHOICE', options, ['1', '2', '3']), false);
    });

    it('evaluates TYPE_ANSWER case-insensitively and POLL/SLIDE with 0 pointsMultiplier', () => {
      const accepted = [
        { id: '1', text: 'x = 5', isCorrect: true, color: 'RED' as const },
        { id: '2', text: '5', isCorrect: true, color: 'BLUE' as const },
      ];
      assert.equal(evaluateAnswer('TYPE_ANSWER', accepted, ['  X = 5 ']), true);
      assert.equal(evaluateAnswer('TYPE_ANSWER', accepted, ['5']), true);
      assert.equal(evaluateAnswer('TYPE_ANSWER', accepted, ['6']), false);

      const pollScore = calculateScore({
        isCorrect: true,
        responseTimeMs: 1000,
        timeLimitSec: 20,
        pointsMultiplier: 0,
        currentStreak: 3,
      });
      assert.deepEqual(pollScore, { earnedPoints: 0, newStreak: 3, streakBonus: 0 });
    });
  });

  describe('calculateScore', () => {
    it('returns 0 points and resets streak on wrong answer', () => {
      const res = calculateScore({
        isCorrect: false,
        responseTimeMs: 2000,
        timeLimitSec: 20,
        pointsMultiplier: 1,
        currentStreak: 4,
      });
      assert.deepEqual(res, { earnedPoints: 0, newStreak: 0, streakBonus: 0 });
    });

    it('awards maximum speed points + streak bonus on fast correct answer', () => {
      const res = calculateScore({
        isCorrect: true,
        responseTimeMs: 0,
        timeLimitSec: 20,
        pointsMultiplier: 1,
        currentStreak: 2, // becomes streak 3 -> +200 bonus
      });
      assert.equal(res.newStreak, 3);
      assert.equal(res.streakBonus, 200);
      assert.equal(res.earnedPoints, 1200);
    });

    it('applies 2x pointsMultiplier and caps streak bonus at 500', () => {
      const res = calculateScore({
        isCorrect: true,
        responseTimeMs: 10000,
        timeLimitSec: 20,
        pointsMultiplier: 2,
        currentStreak: 10,
      });
      assert.equal(res.newStreak, 11);
      assert.equal(res.streakBonus, 500);
      assert.equal(res.earnedPoints, 2000);
    });
  });

  describe('parseYouTubeUrl', () => {
    it('extracts videoId from standard watch, youtu.be, shorts, and embed URLs', () => {
      assert.equal(parseYouTubeUrl('https://www.youtube.com/watch?v=YompsDlEdtc')?.videoId, 'YompsDlEdtc');
      assert.equal(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=15')?.videoId, 'dQw4w9WgXcQ');
      assert.equal(parseYouTubeUrl('https://www.youtube.com/shorts/abc123XYZ_-')?.videoId, 'abc123XYZ_-');
      assert.equal(parseYouTubeUrl('https://www.youtube.com/embed/YompsDlEdtc')?.videoId, 'YompsDlEdtc');
      assert.equal(parseYouTubeUrl('https://example.com/video.mp4'), null);
    });
  });
});
