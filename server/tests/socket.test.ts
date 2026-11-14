import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { getDb } from '../src/db/database.ts';
import { seedDefaultQuizIfNeeded } from '../src/db/seed.ts';
import { attachArenaSocket } from '../src/socket/arenaManager.ts';

describe('Task 6: Socket.io Live Arena Engine (Pacing, Anti-Cheat, Moderation & Auto-Reconnect)', () => {
  const db = getDb(':memory:');
  seedDefaultQuizIfNeeded(db);

  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });
  attachArenaSocket(io, db);

  const clients: ClientSocket[] = [];

  after(() => {
    for (const c of clients) c.disconnect();
    io.close();
    httpServer.close();
  });

  it('runs a full Live Arena cycle with MEDIA_FIRST pacing, strips isCorrect on active questions, supports Auto-Reconnect, and persists session analytics', async () => {
    await new Promise<void>((resolve) => httpServer.listen(0, resolve));
    const addr = httpServer.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;
    const url = `http://localhost:${port}`;

    const hostSocket = ioClient(url);
    const playerSocket1 = ioClient(url);
    clients.push(hostSocket, playerSocket1);

    // 1. Host creates room with MEDIA_FIRST pacing
    const createRes = await new Promise<{
      ok: boolean;
      pin: string;
      hostToken: string;
      room: { settings: { pacingMode: string; mediaDeliveryMode: string } };
    }>((resolve) => {
      hostSocket.emit(
        'host:create-room',
        {
          quizId: 'demo-math-multimedia-quiz',
          settings: {
            mediaDeliveryMode: 'PROJECTOR_FIRST',
            pacingMode: 'MEDIA_FIRST',
            shuffleQuestions: false,
            shuffleOptions: false,
            showOptionTextOnPlayer: true,
          },
        },
        resolve
      );
    });

    assert.equal(createRes.ok, true);
    assert.equal(createRes.pin.length, 6);
    const pin = createRes.pin;

    // 2. Player joins room & receives playerSessionToken
    const joinRes = await new Promise<{
      ok: boolean;
      playerId: string;
      playerSessionToken: string;
      nickname: string;
    }>((resolve) => {
      playerSocket1.emit('player:join', { pin, nickname: 'Minh Toán 12' }, resolve);
    });

    assert.equal(joinRes.ok, true);
    assert.ok(joinRes.playerSessionToken);

    // 3. Host starts game -> Question 1 has no media so it enters QUESTION_ACTIVE or QUESTION_PREVIEW
    // Let's advance to Question 1 and check player payload never leaks isCorrect
    const playerQuestionPromise = new Promise<{
      state: string;
      question: { id: string; options: Array<{ id: string; text: string; isCorrect?: boolean }> };
    }>((resolve) => {
      playerSocket1.once('room:question', resolve);
    });

    await new Promise<{ ok: boolean }>((resolve) => {
      hostSocket.emit('host:start-game', { pin }, resolve);
    });

    const qPayload = await playerQuestionPromise;
    assert.equal(qPayload.question.options.length, 4);
    // Security boundary check: isCorrect must NOT be present on active question sent to player
    assert.equal('isCorrect' in qPayload.question.options[0], false);

    // If room is in QUESTION_PREVIEW (because of MEDIA_FIRST), host triggers start countdown
    if (qPayload.state === 'QUESTION_PREVIEW') {
      await new Promise<{ ok: boolean }>((resolve) => {
        hostSocket.emit('host:start-countdown', { pin }, resolve);
      });
    }

    // 4. Player submits correct answer for Question 1 ('opt-1')
    const answerRes = await new Promise<{ ok: boolean; alreadyAnswered?: boolean }>((resolve) => {
      playerSocket1.emit(
        'player:submit-answer',
        { pin, selectedOptionIds: ['opt-1'] },
        resolve
      );
    });
    assert.equal(answerRes.ok, true);

    // 5. Simulate Player 1 disconnecting (F5 / network drop) and reconnecting with playerSessionToken
    playerSocket1.disconnect();
    const playerSocketReconnected = ioClient(url);
    clients.push(playerSocketReconnected);

    const reconnectRes = await new Promise<{
      ok: boolean;
      player: { nickname: string; score: number; streak: number };
    }>((resolve) => {
      playerSocketReconnected.emit(
        'player:reconnect',
        { pin, playerSessionToken: joinRes.playerSessionToken },
        resolve
      );
    });

    assert.equal(reconnectRes.ok, true);
    assert.equal(reconnectRes.player.nickname, 'Minh Toán 12');
    assert.ok(reconnectRes.player.score > 500);
    assert.equal(reconnectRes.player.streak, 1);

    // 6. Host ends game and saves analytics session to SQLite
    const endRes = await new Promise<{ ok: boolean; sessionId: string }>((resolve) => {
      hostSocket.emit('host:finish-game', { pin }, resolve);
    });
    assert.equal(endRes.ok, true);
    assert.ok(endRes.sessionId);

    const savedSession = db
      .prepare('SELECT * FROM game_sessions WHERE id = ?')
      .get(endRes.sessionId) as { id: string; mode: string } | undefined;
    assert.ok(savedSession);
    assert.equal(savedSession.mode, 'LIVE');
  });
});
