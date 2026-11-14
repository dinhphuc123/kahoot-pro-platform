import { Router } from 'express';
import type { Request, Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import { getFullQuizById } from './quizzes.ts';
import { calculateScore, evaluateAnswer } from '../services/scoring.ts';

export function createSelfPacedRouter(db: DatabaseSync): Router {
  const router = Router();

  // 1. Get sanitized quiz for Self-Paced Homework play + leaderboard of previous self-paced attempts
  router.get('/:quizId', (req: Request, res: Response) => {
    const quiz = getFullQuizById(db, String(req.params.quizId));
    if (!quiz) {
      res.status(404).json({ error: 'Không tìm thấy bộ đề tự luyện.' });
      return;
    }

    const recentLeaderboard = db
      .prepare(`
        SELECT sp.nickname, sp.score, sp.correct_count as correctCount, sp.max_streak as maxStreak, gs.ended_at as completedAt
        FROM session_players sp
        JOIN game_sessions gs ON gs.id = sp.session_id
        WHERE gs.quiz_id = ?
        ORDER BY sp.score DESC
        LIMIT 20
      `)
      .all(quiz.id);

    res.json({
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      questions: quiz.questions.map((q) => ({
        id: q.id,
        orderIndex: q.orderIndex,
        type: q.type,
        text: q.text,
        explanation: q.type === 'SLIDE' ? q.explanation || '' : undefined,
        timeLimitSec: q.timeLimitSec,
        pointsMultiplier: q.pointsMultiplier,
        mediaType: q.mediaType,
        mediaUrl: q.mediaUrl,
        mediaStartTime: q.mediaStartTime,
        mediaEndTime: q.mediaEndTime,
        imageReveal: q.imageReveal || 'NONE',
        options:
          q.type === 'TYPE_ANSWER' || q.type === 'SLIDE'
            ? []
            : q.options.map((o) => ({
                id: o.id,
                text: o.text,
                color: o.color,
                sticker: o.sticker,
                imageUrl: o.imageUrl,
              })),
      })),
      recentLeaderboard,
    });
  });

  // 2. Check a single question answer immediately (returns correctness, points, streak, explanation)
  router.post('/:quizId/check-answer', (req: Request, res: Response) => {
    const quiz = getFullQuizById(db, String(req.params.quizId));
    if (!quiz) {
      res.status(404).json({ error: 'Không tìm thấy bộ đề.' });
      return;
    }

    const { questionId, selectedOptionIds = [], responseTimeMs = 5000, currentStreak = 0 } = req.body || {};
    const q = quiz.questions.find((item) => item.id === questionId);
    if (!q) {
      res.status(404).json({ error: 'Không tìm thấy câu hỏi.' });
      return;
    }

    const isCorrect = evaluateAnswer(
      q.type,
      q.options,
      Array.isArray(selectedOptionIds) ? selectedOptionIds.map(String) : []
    );
    const { earnedPoints, newStreak, streakBonus } = calculateScore({
      isCorrect,
      responseTimeMs: Number(responseTimeMs),
      timeLimitSec: q.timeLimitSec,
      pointsMultiplier: q.pointsMultiplier,
      currentStreak: Number(currentStreak),
    });

    res.json({
      questionId: q.id,
      isCorrect,
      earnedPoints,
      newStreak,
      streakBonus,
      correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
      explanation: q.explanation || '',
    });
  });

  // 3. Complete full Self-Paced attempt and record to SQLite analytics
  router.post('/:quizId/complete', (req: Request, res: Response) => {
    const quiz = getFullQuizById(db, String(req.params.quizId));
    if (!quiz) {
      res.status(404).json({ error: 'Không tìm thấy bộ đề.' });
      return;
    }

    const nickname = String(req.body?.nickname || 'Học sinh Tự luyện').trim() || 'Học sinh Tự luyện';
    const rawAnswers: Array<{
      questionId: string;
      selectedOptionIds: string[];
      responseTimeMs: number;
    }> = Array.isArray(req.body?.answers) ? req.body.answers : [];

    let totalScore = 0;
    let streak = 0;
    let maxStreak = 0;
    let correctCount = 0;

    const evaluatedLogs: Array<{
      questionId: string;
      questionText: string;
      selectedOptionIds: string[];
      isCorrect: boolean;
      responseTimeMs: number;
      earnedPoints: number;
    }> = [];

    for (const ans of rawAnswers) {
      const q = quiz.questions.find((item) => item.id === ans.questionId);
      if (!q) continue;

      const selectedIds = Array.isArray(ans.selectedOptionIds) ? ans.selectedOptionIds.map(String) : [];
      const responseTimeMs = Math.max(0, Number(ans.responseTimeMs || 5000));
      const isCorrect = evaluateAnswer(q.type, q.options, selectedIds);
      const { earnedPoints, newStreak } = calculateScore({
        isCorrect,
        responseTimeMs,
        timeLimitSec: q.timeLimitSec,
        pointsMultiplier: q.pointsMultiplier,
        currentStreak: streak,
      });

      totalScore += earnedPoints;
      streak = newStreak;
      if (streak > maxStreak) maxStreak = streak;
      if (isCorrect) correctCount += 1;

      evaluatedLogs.push({
        questionId: q.id,
        questionText: q.text,
        selectedOptionIds: selectedIds,
        isCorrect,
        responseTimeMs,
        earnedPoints,
      });
    }

    const sessionId = crypto.randomUUID();
    const playerId = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO game_sessions (id, quiz_id, quiz_title, mode, pin, started_at, ended_at, total_questions)
      VALUES (?, ?, ?, 'SELF_PACED', 'HOMEWORK', ?, ?, ?)
    `).run(sessionId, quiz.id, quiz.title, now, now, quiz.questions.length);

    db.prepare(`
      INSERT INTO session_players (id, session_id, nickname, score, correct_count, max_streak, rank)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(playerId, sessionId, nickname, totalScore, correctCount, maxStreak);

    const insertAns = db.prepare(`
      INSERT INTO player_answers (
        id, session_id, player_id, question_id, question_text,
        selected_option_ids_json, is_correct, response_time_ms, earned_points
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const log of evaluatedLogs) {
      insertAns.run(
        crypto.randomUUID(),
        sessionId,
        playerId,
        log.questionId,
        log.questionText,
        JSON.stringify(log.selectedOptionIds),
        log.isCorrect ? 1 : 0,
        log.responseTimeMs,
        log.earnedPoints
      );
    }

    res.status(201).json({
      sessionId,
      nickname,
      totalScore,
      correctCount,
      totalQuestions: quiz.questions.length,
      maxStreak,
    });
  });

  return router;
}
