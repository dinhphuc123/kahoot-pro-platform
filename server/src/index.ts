import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { getDb } from './db/database.ts';
import { seedDefaultQuizIfNeeded } from './db/seed.ts';
import { createQuizzesRouter } from './routes/quizzes.ts';
import { mediaRouter } from './routes/media.ts';
import { createSelfPacedRouter } from './routes/selfPaced.ts';
import { createReportsRouter } from './routes/reports.ts';
import { attachArenaSocket } from './socket/arenaManager.ts';

const PORT = Number(process.env.PORT || 3001);
const HOST_PASSCODE = process.env.HOST_PASSCODE || '123456';

const db = getDb();
seedDefaultQuizIfNeeded(db);

export const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// Health check & simple Host passcode verify endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', maxUploadBytes: 100 * 1024 * 1024 });
});

app.post('/api/auth/verify-host', (req, res) => {
  const code = String(req.body?.passcode || '').trim();
  if (!code || code === HOST_PASSCODE) {
    res.json({ ok: true, hostName: String(req.body?.hostName || 'Giáo viên / Host') });
  } else {
    res.status(401).json({ ok: false, error: 'Mã bảo mật Host không đúng (Mặc định: 123456).' });
  }
});

app.use('/api/quizzes', createQuizzesRouter(db));
app.use('/api/media', mediaRouter);
app.use('/api/self-paced', createSelfPacedRouter(db));
app.use('/api/reports', createReportsRouter(db));

// Serve static frontend build in production / single-port mode
const clientDistCandidates = [
  path.resolve(process.cwd(), '../client/dist'),
  path.resolve(process.cwd(), 'client/dist'),
  path.resolve(process.cwd(), 'dist'),
];
const clientDistPath = clientDistCandidates.find((p) => fs.existsSync(p));

if (clientDistPath) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

attachArenaSocket(io, db);

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(PORT, () => {
    console.log(`[Kahoot Pro Server] Running at http://localhost:${PORT}`);
  });
}
