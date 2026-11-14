import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import { getDb } from '../src/db/database.ts';
import { seedDefaultQuizIfNeeded } from '../src/db/seed.ts';
import { createSelfPacedRouter } from '../src/routes/selfPaced.ts';
import { createReportsRouter } from '../src/routes/reports.ts';

describe('Task 8: Self-Paced Homework Mode & Post-Game Analytics + Excel Export', () => {
  const db = getDb(':memory:');
  seedDefaultQuizIfNeeded(db);

  const app = express();
  app.use(express.json());
  app.use('/api/self-paced', createSelfPacedRouter(db));
  app.use('/api/reports', createReportsRouter(db));

  it('allows a student to play Self-Paced mode, records answers, identifies Hardest Questions, and exports XLSX report', async () => {
    // 1. Fetch quiz for self-paced play (should not leak isCorrect upfront)
    const startRes = await request(app).get('/api/self-paced/demo-math-multimedia-quiz');
    assert.equal(startRes.status, 200);
    assert.equal(startRes.body.questions.length, 4);
    assert.equal('isCorrect' in startRes.body.questions[0].options[0], false);

    // 2. Check single question answer in self-paced mode to get immediate feedback + explanation
    const checkRes = await request(app)
      .post('/api/self-paced/demo-math-multimedia-quiz/check-answer')
      .send({
        questionId: 'q-math-quadratic',
        selectedOptionIds: ['opt-1'],
        responseTimeMs: 3000,
        currentStreak: 0,
      });
    assert.equal(checkRes.status, 200);
    assert.equal(checkRes.body.isCorrect, true);
    assert.ok(checkRes.body.earnedPoints > 500);
    assert.ok(checkRes.body.explanation.includes('\\Delta'));

    // 3. Submit completed self-paced attempt (1 correct, 1 wrong to test Hardest Questions analytics)
    const submitRes = await request(app)
      .post('/api/self-paced/demo-math-multimedia-quiz/complete')
      .send({
        nickname: 'Nguyễn Văn An 12A1',
        answers: [
          {
            questionId: 'q-math-quadratic',
            selectedOptionIds: ['opt-1'],
            responseTimeMs: 3000,
          },
          {
            questionId: 'q-youtube-science',
            selectedOptionIds: ['opt-21'], // wrong answer
            responseTimeMs: 5000,
          },
        ],
      });

    assert.equal(submitRes.status, 201);
    const sessionId = submitRes.body.sessionId;
    assert.ok(sessionId);

    // 4. Verify Reports List & Detailed Analytics (including Hardest Questions)
    const reportsList = await request(app).get('/api/reports');
    assert.equal(reportsList.status, 200);
    assert.equal(reportsList.body.length, 1);

    const reportDetail = await request(app).get(`/api/reports/${sessionId}`);
    assert.equal(reportDetail.status, 200);
    assert.equal(reportDetail.body.players.length, 1);
    assert.equal(reportDetail.body.players[0].nickname, 'Nguyễn Văn An 12A1');
    assert.ok(Array.isArray(reportDetail.body.hardestQuestions));
    assert.equal(reportDetail.body.hardestQuestions[0].questionId, 'q-youtube-science');
    assert.equal(reportDetail.body.hardestQuestions[0].accuracyPercent, 0);

    // 5. Verify Excel (.xlsx) Export of the session report
    const xlsxRes = await request(app)
      .get(`/api/reports/${sessionId}/export?format=xlsx`)
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      });

    assert.equal(xlsxRes.status, 200);
    assert.ok(Buffer.isBuffer(xlsxRes.body));
    assert.ok(xlsxRes.body.length > 100);
  });
});
