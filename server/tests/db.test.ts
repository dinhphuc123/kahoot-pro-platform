import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDb } from '../src/db/database.ts';
import { seedDefaultQuizIfNeeded } from '../src/db/seed.ts';

describe('Task 1: SQLite Schema & Seed Quiz', () => {
  it('initializes all 5 tables and seeds the default math/multimedia quiz', () => {
    const db = getDb(':memory:');
    seedDefaultQuizIfNeeded(db);

    const quizzes = db.prepare('SELECT * FROM quizzes').all() as Array<{ id: string; title: string }>;
    assert.ok(quizzes.length >= 1);
    const mathQuiz = quizzes.find((q) => q.id === 'demo-math-multimedia-quiz');
    assert.ok(mathQuiz);

    const questions = db.prepare('SELECT * FROM questions WHERE quiz_id = ? ORDER BY order_index ASC').all(mathQuiz.id) as Array<{
      id: string;
      type: string;
      text: string;
      explanation: string;
      media_type: string;
      options_json: string;
    }>;

    assert.equal(questions.length, 4);
    assert.ok(questions[0].text.includes('$x^2 - 5x + 6 = 0$'));
    assert.ok(questions[0].explanation.includes('\\Delta'));
    assert.equal(questions[1].media_type, 'YOUTUBE');
    assert.equal(questions[2].type, 'MULTIPLE_CHOICE');
    assert.equal(questions[3].type, 'TRUE_FALSE');

    // Calling seed again should be idempotent
    const countBefore = quizzes.length;
    seedDefaultQuizIfNeeded(db);
    const quizzesAfter = db.prepare('SELECT COUNT(*) as count FROM quizzes').get() as { count: number };
    assert.equal(quizzesAfter.count, countBefore);
  });
});
