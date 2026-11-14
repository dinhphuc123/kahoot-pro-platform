import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultDataDir = path.resolve(__dirname, '../../data');
if (!fs.existsSync(defaultDataDir)) {
  fs.mkdirSync(defaultDataDir, { recursive: true });
}

const defaultDbPath = path.join(defaultDataDir, 'kahoot.db');

let dbInstance: DatabaseSync | null = null;

export function getDb(customPath?: string): DatabaseSync {
  if (dbInstance && !customPath) {
    return dbInstance;
  }

  const targetPath = customPath || process.env.DB_PATH || defaultDbPath;
  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new DatabaseSync(targetPath);
  db.exec('PRAGMA foreign_keys = ON;');
  initSchema(db);

  if (!customPath) {
    dbInstance = db;
  }
  return db;
}

export function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      cover_image TEXT DEFAULT '',
      theme_id TEXT NOT NULL DEFAULT 'CLASSIC_PURPLE',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'SINGLE_CHOICE',
      text TEXT NOT NULL,
      explanation TEXT DEFAULT '',
      time_limit_sec INTEGER NOT NULL DEFAULT 20,
      points_multiplier INTEGER NOT NULL DEFAULT 1,
      media_type TEXT NOT NULL DEFAULT 'NONE',
      media_url TEXT DEFAULT '',
      media_start_time REAL DEFAULT 0,
      media_end_time REAL DEFAULT 0,
      image_reveal TEXT NOT NULL DEFAULT 'NONE',
      options_json TEXT NOT NULL,
      FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      quiz_id TEXT NOT NULL,
      quiz_title TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'LIVE',
      pin TEXT DEFAULT '',
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      total_questions INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS session_players (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      nickname TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER NOT NULL DEFAULT 0,
      max_streak INTEGER NOT NULL DEFAULT 0,
      rank INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS player_answers (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      selected_option_ids_json TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0,
      response_time_ms INTEGER NOT NULL DEFAULT 0,
      earned_points INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (player_id) REFERENCES session_players(id) ON DELETE CASCADE
    );
  `);

  // Safe migrations for existing kahoot.db files
  const quizCols = db.prepare('PRAGMA table_info(quizzes)').all() as Array<{ name: string }>;
  if (!quizCols.some((c) => c.name === 'theme_id')) {
    db.exec(`ALTER TABLE quizzes ADD COLUMN theme_id TEXT NOT NULL DEFAULT 'CLASSIC_PURPLE';`);
  }

  const questionCols = db.prepare('PRAGMA table_info(questions)').all() as Array<{ name: string }>;
  if (!questionCols.some((c) => c.name === 'image_reveal')) {
    db.exec(`ALTER TABLE questions ADD COLUMN image_reveal TEXT NOT NULL DEFAULT 'NONE';`);
  }
}
