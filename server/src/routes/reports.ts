import { Router } from 'express';
import type { Request, Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import * as XLSX from 'xlsx';

export function createReportsRouter(db: DatabaseSync): Router {
  const router = Router();

  // 1. List all game sessions (Live & Self-Paced)
  router.get('/', (_req: Request, res: Response) => {
    const rows = db
      .prepare(`
        SELECT gs.*,
               (SELECT COUNT(*) FROM session_players WHERE session_id = gs.id) as player_count
        FROM game_sessions gs
        ORDER BY gs.ended_at DESC
      `)
      .all() as Array<{
      id: string;
      quiz_id: string;
      quiz_title: string;
      mode: 'LIVE' | 'SELF_PACED';
      pin: string;
      started_at: string;
      ended_at: string;
      total_questions: number;
      player_count: number;
    }>;

    res.json(
      rows.map((r) => ({
        id: r.id,
        quizId: r.quiz_id,
        quizTitle: r.quiz_title,
        mode: r.mode,
        pin: r.pin,
        startedAt: r.started_at,
        endedAt: r.ended_at,
        totalQuestions: r.total_questions,
        playerCount: r.player_count,
      }))
    );
  });

  // 2. Get detailed analytics for a session (Leaderboard, Question Accuracy, Hardest Questions)
  router.get('/:sessionId', (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId) as
      | {
          id: string;
          quiz_id: string;
          quiz_title: string;
          mode: string;
          pin: string;
          started_at: string;
          ended_at: string;
          total_questions: number;
        }
      | undefined;

    if (!session) {
      res.status(404).json({ error: 'Không tìm thấy báo cáo trận đấu.' });
      return;
    }

    const players = db
      .prepare('SELECT * FROM session_players WHERE session_id = ? ORDER BY rank ASC, score DESC')
      .all(sessionId) as Array<{
      id: string;
      nickname: string;
      score: number;
      correct_count: number;
      max_streak: number;
      rank: number;
    }>;

    const answers = db
      .prepare('SELECT * FROM player_answers WHERE session_id = ?')
      .all(sessionId) as Array<{
      id: string;
      player_id: string;
      question_id: string;
      question_text: string;
      is_correct: number;
      response_time_ms: number;
      earned_points: number;
    }>;

    // Group stats per question
    const qMap = new Map<
      string,
      {
        questionId: string;
        questionText: string;
        totalAttempts: number;
        correctAttempts: number;
        totalResponseMs: number;
      }
    >();

    for (const ans of answers) {
      const existing = qMap.get(ans.question_id) || {
        questionId: ans.question_id,
        questionText: ans.question_text,
        totalAttempts: 0,
        correctAttempts: 0,
        totalResponseMs: 0,
      };
      existing.totalAttempts += 1;
      if (ans.is_correct === 1) existing.correctAttempts += 1;
      existing.totalResponseMs += ans.response_time_ms;
      qMap.set(ans.question_id, existing);
    }

    const questionStats = Array.from(qMap.values()).map((item) => ({
      questionId: item.questionId,
      questionText: item.questionText,
      totalAttempts: item.totalAttempts,
      correctAttempts: item.correctAttempts,
      accuracyPercent:
        item.totalAttempts > 0 ? Math.round((item.correctAttempts / item.totalAttempts) * 100) : 0,
      avgResponseTimeSec:
        item.totalAttempts > 0
          ? Number((item.totalResponseMs / item.totalAttempts / 1000).toFixed(1))
          : 0,
    }));

    // Hardest questions: sorted by lowest accuracyPercent (< 70% or top 3 lowest)
    const hardestQuestions = [...questionStats].sort(
      (a, b) => a.accuracyPercent - b.accuracyPercent
    );

    res.json({
      id: session.id,
      quizId: session.quiz_id,
      quizTitle: session.quiz_title,
      mode: session.mode,
      pin: session.pin,
      startedAt: session.started_at,
      endedAt: session.ended_at,
      totalQuestions: session.total_questions,
      players: players.map((p) => ({
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        correctCount: p.correct_count,
        maxStreak: p.max_streak,
        rank: p.rank,
        accuracyPercent:
          session.total_questions > 0
            ? Math.round((p.correct_count / session.total_questions) * 100)
            : 0,
      })),
      questionStats,
      hardestQuestions,
    });
  });

  // 3. Export Session Report to Excel (.xlsx) or CSV
  router.get('/:sessionId/export', (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId) as
      | {
          id: string;
          quiz_title: string;
          mode: string;
          pin: string;
          ended_at: string;
          total_questions: number;
        }
      | undefined;

    if (!session) {
      res.status(404).json({ error: 'Không tìm thấy báo cáo trận đấu.' });
      return;
    }

    const players = db
      .prepare('SELECT * FROM session_players WHERE session_id = ? ORDER BY rank ASC, score DESC')
      .all(sessionId) as Array<{
      nickname: string;
      score: number;
      correct_count: number;
      max_streak: number;
      rank: number;
    }>;

    const answers = db
      .prepare('SELECT * FROM player_answers WHERE session_id = ?')
      .all(sessionId) as Array<{
      question_id: string;
      question_text: string;
      is_correct: number;
      response_time_ms: number;
    }>;

    const leaderboardRows = players.map((p) => ({
      Hang: p.rank,
      TenNguoiChoi: p.nickname,
      TongDiem: p.score,
      SoCauDung: p.correct_count,
      TongSoCau: session.total_questions,
      TyLeDungPercent:
        session.total_questions > 0
          ? Math.round((p.correct_count / session.total_questions) * 100)
          : 0,
      ChuoiThangDaiNhat: p.max_streak,
    }));

    const qMap = new Map<
      string,
      { questionText: string; total: number; correct: number; totalMs: number }
    >();
    for (const a of answers) {
      const cur = qMap.get(a.question_id) || {
        questionText: a.question_text,
        total: 0,
        correct: 0,
        totalMs: 0,
      };
      cur.total += 1;
      if (a.is_correct === 1) cur.correct += 1;
      cur.totalMs += a.response_time_ms;
      qMap.set(a.question_id, cur);
    }

    const questionRows = Array.from(qMap.values()).map((q, idx) => ({
      STT: idx + 1,
      CauHoi: q.questionText,
      SoLuotTraLoi: q.total,
      SoLuotDung: q.correct,
      TyLeDungPercent: q.total > 0 ? Math.round((q.correct / q.total) * 100) : 0,
      ThoiGianTrungBinhGiay: q.total > 0 ? Number((q.totalMs / q.total / 1000).toFixed(1)) : 0,
    }));

    const workbook = XLSX.utils.book_new();
    const playerSheet = XLSX.utils.json_to_sheet(leaderboardRows);
    const questionSheet = XLSX.utils.json_to_sheet(questionRows);
    XLSX.utils.book_append_sheet(workbook, playerSheet, 'BangDiem');
    XLSX.utils.book_append_sheet(workbook, questionSheet, 'ThongKeCauHoi');

    const format = String(req.query.format || 'xlsx').toLowerCase();
    if (format === 'csv') {
      const csv = XLSX.utils.sheet_to_csv(playerSheet);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="report_${sessionId.slice(0, 8)}.csv"`);
      res.send(Buffer.from('\uFEFF' + csv, 'utf-8'));
      return;
    }

    const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', `attachment; filename="report_${sessionId.slice(0, 8)}.xlsx"`);
    res.send(Buffer.from(out));
  });

  // 4. Delete session report
  router.delete('/:sessionId', (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    db.prepare('DELETE FROM player_answers WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM session_players WHERE session_id = ?').run(sessionId);
    db.prepare('DELETE FROM game_sessions WHERE id = ?').run(sessionId);
    res.json({ success: true });
  });

  return router;
}
