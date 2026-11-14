import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { getDb } from '../src/db/database.ts';
import { seedDefaultQuizIfNeeded } from '../src/db/seed.ts';
import { createQuizzesRouter } from '../src/routes/quizzes.ts';

describe('Task 3: Quiz CRUD API & Excel/CSV/JSON Import-Export', () => {
  const db = getDb(':memory:');
  seedDefaultQuizIfNeeded(db);

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/quizzes', createQuizzesRouter(db));

  it('lists seeded quizzes and fetches full quiz with questions', async () => {
    const listRes = await request(app).get('/api/quizzes');
    assert.equal(listRes.status, 200);
    assert.ok(listRes.body.length >= 1);

    const detailRes = await request(app).get('/api/quizzes/demo-math-multimedia-quiz');
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.questions.length, 4);
    assert.equal(detailRes.body.questions[0].options.length, 4);
  });

  it('creates, updates, exports to JSON & XLSX, imports back, and deletes a quiz', async () => {
    const createRes = await request(app)
      .post('/api/quizzes')
      .send({
        title: 'Đề Kiểm Tra Giải Tích 12',
        description: 'Ôn tập nguyên hàm và tích phân',
        questions: [
          {
            type: 'SINGLE_CHOICE',
            text: 'Nguyên hàm của $\\cos(x)$ là gì?',
            explanation: 'Vì $(\\sin x)\' = \\cos x$ nên $\\int \\cos x\\,dx = \\sin x + C$.',
            timeLimitSec: 20,
            pointsMultiplier: 1,
            mediaType: 'NONE',
            options: [
              { id: 'o1', text: '$\\sin(x) + C$', isCorrect: true, color: 'RED' },
              { id: 'o2', text: '$-\\sin(x) + C$', isCorrect: false, color: 'BLUE' },
              { id: 'o3', text: '$\\tan(x) + C$', isCorrect: false, color: 'YELLOW' },
              { id: 'o4', text: '$\\cos(x) + C$', isCorrect: false, color: 'GREEN' },
            ],
          },
        ],
      });

    assert.equal(createRes.status, 201);
    const createdId = createRes.body.id;
    assert.ok(createdId);

    // Export as JSON
    const jsonExport = await request(app).get(`/api/quizzes/${createdId}/export?format=json`);
    assert.equal(jsonExport.status, 200);
    assert.equal(jsonExport.body.title, 'Đề Kiểm Tra Giải Tích 12');

    // Export as Excel (.xlsx)
    const xlsxExport = await request(app)
      .get(`/api/quizzes/${createdId}/export?format=xlsx`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });
    assert.equal(xlsxExport.status, 200);
    assert.ok(Buffer.isBuffer(xlsxExport.body));
    assert.ok(xlsxExport.body.length > 100);

    // Import back from the exported XLSX buffer
    const importRes = await request(app)
      .post('/api/quizzes/import-file')
      .attach('file', xlsxExport.body, {
        filename: 'calculus12.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      .field('title', 'Đề Import Từ Excel');

    assert.equal(importRes.status, 201);
    assert.equal(importRes.body.title, 'Đề Import Từ Excel');
    assert.equal(importRes.body.questions.length, 1);
    assert.ok(importRes.body.questions[0].text.includes('\\cos(x)'));

    // Delete quiz
    const delRes = await request(app).delete(`/api/quizzes/${createdId}`);
    assert.equal(delRes.status, 200);
  });
});
