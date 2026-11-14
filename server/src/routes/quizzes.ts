import { Router } from 'express';
import type { Request, Response } from 'express';
import type { DatabaseSync } from 'node:sqlite';
import multer from 'multer';
import crypto from 'node:crypto';
import type { ImageRevealMode, Question, Quiz, QuizThemeId } from '../types.ts';
import {
  exportQuizToWorkbookBuffer,
  normalizeQuestionInput,
  parseImportedFileBuffer,
} from '../services/importExport.ts';

const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

export function getFullQuizById(db: DatabaseSync, quizId: string): Quiz | null {
  const quizRow = db.prepare('SELECT * FROM quizzes WHERE id = ?').get(quizId) as
    | {
        id: string;
        title: string;
        description: string;
        cover_image: string;
        theme_id?: string;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!quizRow) return null;

  const qRows = db
    .prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index ASC')
    .all(quizId) as Array<{
    id: string;
    quiz_id: string;
    order_index: number;
    type: Question['type'];
    text: string;
    explanation: string;
    time_limit_sec: number;
    points_multiplier: number;
    media_type: Question['mediaType'];
    media_url: string;
    media_start_time: number;
    media_end_time: number;
    image_reveal?: string;
    options_json: string;
  }>;

  const questions: Question[] = qRows.map((r) => ({
    id: r.id,
    quizId: r.quiz_id,
    orderIndex: r.order_index,
    type: r.type,
    text: r.text,
    explanation: r.explanation || '',
    timeLimitSec: r.time_limit_sec,
    pointsMultiplier: (r.points_multiplier === 0 ? 0 : r.points_multiplier === 2 ? 2 : 1) as 0 | 1 | 2,
    mediaType: r.media_type,
    mediaUrl: r.media_url || '',
    mediaStartTime: r.media_start_time || 0,
    mediaEndTime: r.media_end_time || 0,
    imageReveal: (r.image_reveal as ImageRevealMode) || 'NONE',
    options: JSON.parse(r.options_json || '[]'),
  }));

  return {
    id: quizRow.id,
    title: quizRow.title,
    description: quizRow.description,
    coverImage: quizRow.cover_image,
    themeId: (quizRow.theme_id as QuizThemeId) || 'CLASSIC_PURPLE',
    createdAt: quizRow.created_at,
    updatedAt: quizRow.updated_at,
    questions,
  };
}

export function saveQuizWithQuestions(
  db: DatabaseSync,
  quizId: string,
  payload: {
    title: string;
    description?: string;
    coverImage?: string;
    themeId?: string;
    questions?: Array<Record<string, unknown>>;
  },
  isNew: boolean
): Quiz {
  const now = new Date().toISOString();
  const title = String(payload.title || 'Bộ câu hỏi chưa đặt tên').trim();
  const description = String(payload.description || '').trim();
  const coverImage = String(payload.coverImage || '').trim();
  const themeId = String(payload.themeId || 'CLASSIC_PURPLE').trim();

  if (isNew) {
    db.prepare(`
      INSERT INTO quizzes (id, title, description, cover_image, theme_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(quizId, title, description, coverImage, themeId, now, now);
  } else {
    db.prepare(`
      UPDATE quizzes
      SET title = ?, description = ?, cover_image = ?, theme_id = ?, updated_at = ?
      WHERE id = ?
    `).run(title, description, coverImage, themeId, now, quizId);
  }

  if (Array.isArray(payload.questions)) {
    db.prepare('DELETE FROM questions WHERE quiz_id = ?').run(quizId);

    const insertQ = db.prepare(`
      INSERT INTO questions (
        id, quiz_id, order_index, type, text, explanation,
        time_limit_sec, points_multiplier, media_type, media_url,
        media_start_time, media_end_time, image_reveal, options_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    payload.questions.forEach((rawQ, idx) => {
      const norm = normalizeQuestionInput(rawQ);
      const qId = String(rawQ.id || crypto.randomUUID());
      insertQ.run(
        qId,
        quizId,
        idx,
        norm.type,
        norm.text,
        norm.explanation || '',
        norm.timeLimitSec,
        norm.pointsMultiplier,
        norm.mediaType,
        norm.mediaUrl || '',
        norm.mediaStartTime || 0,
        norm.mediaEndTime || 0,
        norm.imageReveal || 'NONE',
        JSON.stringify(norm.options)
      );
    });
  }

  return getFullQuizById(db, quizId)!;
}

export function createQuizzesRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    const rows = db
      .prepare(`
        SELECT q.*,
               (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) as question_count
        FROM quizzes q
        ORDER BY q.updated_at DESC
      `)
      .all() as Array<{
      id: string;
      title: string;
      description: string;
      cover_image: string;
      theme_id?: string;
      created_at: string;
      updated_at: string;
      question_count: number;
    }>;

    res.json(
      rows.map((r) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        coverImage: r.cover_image,
        themeId: r.theme_id || 'CLASSIC_PURPLE',
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        questionCount: r.question_count,
      }))
    );
  });

  router.get('/:id', (req: Request, res: Response) => {
    const quiz = getFullQuizById(db, String(req.params.id));
    if (!quiz) {
      res.status(404).json({ error: 'Không tìm thấy bộ đề.' });
      return;
    }
    res.json(quiz);
  });

  router.post('/', (req: Request, res: Response) => {
    const quizId = crypto.randomUUID();
    const created = saveQuizWithQuestions(db, quizId, req.body || {}, true);
    res.status(201).json(created);
  });

  router.put('/:id', (req: Request, res: Response) => {
    const quizId = String(req.params.id);
    const existing = getFullQuizById(db, quizId);
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy bộ đề.' });
      return;
    }
    const updated = saveQuizWithQuestions(db, quizId, req.body || {}, false);
    res.json(updated);
  });

  router.post('/:id/duplicate', (req: Request, res: Response) => {
    const existing = getFullQuizById(db, String(req.params.id));
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy bộ đề.' });
      return;
    }
    const newId = crypto.randomUUID();
    const duplicated = saveQuizWithQuestions(
      db,
      newId,
      {
        title: `${existing.title} (Bản sao)`,
        description: existing.description,
        coverImage: existing.coverImage,
        themeId: existing.themeId,
        questions: existing.questions.map((q) => ({
          ...q,
          id: crypto.randomUUID(),
          options: q.options.map((o) => ({ ...o, id: crypto.randomUUID() })),
        })),
      },
      true
    );
    res.status(201).json(duplicated);
  });

  router.delete('/:id', (req: Request, res: Response) => {
    const quizId = String(req.params.id);
    db.prepare('DELETE FROM questions WHERE quiz_id = ?').run(quizId);
    const info = db.prepare('DELETE FROM quizzes WHERE id = ?').run(quizId);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Không tìm thấy bộ đề.' });
      return;
    }
    res.json({ success: true });
  });

  router.get('/:id/export', (req: Request, res: Response) => {
    const quiz = getFullQuizById(db, String(req.params.id));
    if (!quiz) {
      res.status(404).json({ error: 'Không tìm thấy bộ đề.' });
      return;
    }

    const format = String(req.query.format || 'json').toLowerCase();
    const safeSlug = quiz.id.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'xlsx' || format === 'csv') {
      const buf = exportQuizToWorkbookBuffer(quiz, format);
      const mime =
        format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8';
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Disposition', `attachment; filename="quiz_${safeSlug}.${format}"`);
      res.send(buf);
      return;
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="quiz_${safeSlug}.json"`);
    res.json(quiz);
  });

  router.post('/import-file', memoryUpload.single('file'), (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'Vui lòng chọn file Excel (.xlsx), CSV hoặc JSON để nhập.' });
      return;
    }
    try {
      const customTitle = req.body?.title ? String(req.body.title) : undefined;
      const parsed = parseImportedFileBuffer(req.file.buffer, req.file.originalname, customTitle);
      const quizId = crypto.randomUUID();
      const created = saveQuizWithQuestions(
        db,
        quizId,
        {
          title: parsed.title,
          description: parsed.description,
          questions: parsed.questions as unknown as Array<Record<string, unknown>>,
        },
        true
      );
      res.status(201).json(created);
    } catch (err) {
      res.status(400).json({
        error: `Không thể đọc file nhập vào: ${err instanceof Error ? err.message : 'Định dạng lỗi'}`,
      });
    }
  });

  return router;
}
