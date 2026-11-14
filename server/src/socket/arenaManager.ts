import type { Server as SocketIOServer, Socket } from 'socket.io';
import type { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import type {
  GamePacingMode,
  MediaDeliveryMode,
  Question,
  QuestionOption,
  RoomSettings,
} from '../types.ts';
import { getFullQuizById } from '../routes/quizzes.ts';
import { calculateScore, evaluateAnswer } from '../services/scoring.ts';

export type RoomState =
  | 'LOBBY'
  | 'QUESTION_PREVIEW'
  | 'QUESTION_ACTIVE'
  | 'QUESTION_REVEAL'
  | 'LEADERBOARD'
  | 'PODIUM';

export interface ArenaPlayer {
  id: string;
  socketId: string;
  sessionToken: string;
  nickname: string;
  score: number;
  streak: number;
  maxStreak: number;
  correctCount: number;
  connected: boolean;
  lastAnswer?: {
    questionId: string;
    selectedOptionIds: string[];
    isCorrect: boolean;
    earnedPoints: number;
    streakBonus: number;
    responseTimeMs: number;
  };
}

export interface AnswerLogEntry {
  playerId: string;
  questionId: string;
  questionText: string;
  selectedOptionIds: string[];
  isCorrect: boolean;
  responseTimeMs: number;
  earnedPoints: number;
}

export interface LiveRoom {
  pin: string;
  quizId: string;
  quizTitle: string;
  hostSocketId: string;
  hostToken: string;
  state: RoomState;
  settings: RoomSettings;
  questions: Question[];
  currentQuestionIndex: number;
  questionStartedAt: number;
  startedAtIso: string;
  savedSessionId?: string;
  players: Map<string, ArenaPlayer>; // key: playerId
  tokenToPlayerId: Map<string, string>; // key: playerSessionToken -> playerId
  answersForCurrentQuestion: Map<string, { selectedOptionIds: string[]; responseTimeMs: number }>;
  allAnswerLogs: AnswerLogEntry[];
  timerHandle?: ReturnType<typeof setTimeout>;
}

const FUNNY_NICKNAMES = [
  'Cáo Siêu Tốc',
  'Gấu Trúc Vũ Trụ',
  'Nhà Toán Học Trẻ',
  'Tia Chớp Xanh',
  'Thần Đồng Giải Tích',
  'Mèo Máy Thông Thái',
  'Kỳ Lân Ngân Hà',
  'Phù Thủy Đạo Hàm',
  'Sóc Bay Tinh Nhuệ',
  'Đại Bàng Vượt Vũ Môn',
];

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function attachArenaSocket(io: SocketIOServer, db: DatabaseSync): Map<string, LiveRoom> {
  const rooms = new Map<string, LiveRoom>();

  function generateUniquePin(): string {
    for (let i = 0; i < 100; i++) {
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      if (!rooms.has(pin)) return pin;
    }
    return String(Date.now()).slice(-6);
  }

  function sanitizeQuestionForPlayer(q: Question, settings: RoomSettings) {
    const COLORS: Array<QuestionOption['color']> = ['RED', 'BLUE', 'YELLOW', 'GREEN'];
    return {
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
          : q.options.map((opt, idx) => ({
              id: opt.id,
              text: settings.showOptionTextOnPlayer ? opt.text : '',
              color: COLORS[idx % 4],
              sticker: opt.sticker,
              imageUrl: opt.imageUrl,
            })),
    };
  }

  function sanitizeQuestionForHost(q: Question, includeCorrect: boolean) {
    const COLORS: Array<QuestionOption['color']> = ['RED', 'BLUE', 'YELLOW', 'GREEN'];
    return {
      ...q,
      imageReveal: q.imageReveal || 'NONE',
      options: q.options.map((opt, idx) => ({
        id: opt.id,
        text: opt.text,
        color: COLORS[idx % 4],
        sticker: opt.sticker,
        imageUrl: opt.imageUrl,
        ...(includeCorrect ? { isCorrect: opt.isCorrect } : {}),
      })),
    };
  }

  function getLeaderboard(room: LiveRoom) {
    return Array.from(room.players.values())
      .sort((a, b) => b.score - a.score)
      .map((p, idx) => ({
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        streak: p.streak,
        maxStreak: p.maxStreak,
        correctCount: p.correctCount,
        connected: p.connected,
        rank: idx + 1,
        lastEarnedPoints: p.lastAnswer?.earnedPoints || 0,
      }));
  }

  function broadcastLobbyState(room: LiveRoom) {
    io.to(`room:${room.pin}`).emit('room:lobby-update', {
      pin: room.pin,
      quizTitle: room.quizTitle,
      state: room.state,
      settings: room.settings,
      players: getLeaderboard(room),
    });
  }

  function startCurrentQuestion(room: LiveRoom) {
    if (room.timerHandle) {
      clearTimeout(room.timerHandle);
      room.timerHandle = undefined;
    }

    const q = room.questions[room.currentQuestionIndex];
    if (!q) {
      finalizeGameToPodium(room);
      return;
    }

    room.answersForCurrentQuestion.clear();
    for (const p of room.players.values()) {
      p.lastAnswer = undefined;
    }

    // If MEDIA_FIRST is enabled and question has media (or host prefers reading time first), start in QUESTION_PREVIEW
    if (room.settings.pacingMode === 'MEDIA_FIRST' && q.mediaType !== 'NONE') {
      room.state = 'QUESTION_PREVIEW';
      room.questionStartedAt = 0;

      const hostPayload = {
        state: room.state,
        questionIndex: room.currentQuestionIndex,
        totalQuestions: room.questions.length,
        settings: room.settings,
        question: sanitizeQuestionForHost(q, false),
      };
      const playerPayload = {
        state: room.state,
        questionIndex: room.currentQuestionIndex,
        totalQuestions: room.questions.length,
        settings: room.settings,
        question: sanitizeQuestionForPlayer(q, room.settings),
      };

      io.to(room.hostSocketId).emit('room:question', hostPayload);
      io.to(`players:${room.pin}`).emit('room:question', playerPayload);
      return;
    }

    activateCountdownForCurrentQuestion(room);
  }

  function activateCountdownForCurrentQuestion(room: LiveRoom) {
    if (room.timerHandle) {
      clearTimeout(room.timerHandle);
      room.timerHandle = undefined;
    }

    const q = room.questions[room.currentQuestionIndex];
    if (!q) return;

    room.state = 'QUESTION_ACTIVE';
    room.questionStartedAt = Date.now();

    const hostPayload = {
      state: room.state,
      questionIndex: room.currentQuestionIndex,
      totalQuestions: room.questions.length,
      settings: room.settings,
      questionStartedAt: room.questionStartedAt,
      question: sanitizeQuestionForHost(q, false),
    };
    const playerPayload = {
      state: room.state,
      questionIndex: room.currentQuestionIndex,
      totalQuestions: room.questions.length,
      settings: room.settings,
      questionStartedAt: room.questionStartedAt,
      question: sanitizeQuestionForPlayer(q, room.settings),
    };

    io.to(room.hostSocketId).emit('room:question', hostPayload);
    io.to(`players:${room.pin}`).emit('room:question', playerPayload);

    room.timerHandle = setTimeout(() => {
      revealCurrentQuestion(room);
    }, q.timeLimitSec * 1000 + 400);
  }

  function revealCurrentQuestion(room: LiveRoom) {
    if (room.timerHandle) {
      clearTimeout(room.timerHandle);
      room.timerHandle = undefined;
    }
    if (room.state === 'QUESTION_REVEAL') return;

    const q = room.questions[room.currentQuestionIndex];
    if (!q) return;

    room.state = 'QUESTION_REVEAL';

    // Option selection counts for bar chart
    const optionCounts: Record<string, number> = {};
    for (const opt of q.options) {
      optionCounts[opt.id] = 0;
    }
    for (const ans of room.answersForCurrentQuestion.values()) {
      for (const optId of ans.selectedOptionIds) {
        if (optionCounts[optId] !== undefined) {
          optionCounts[optId] += 1;
        }
      }
    }

    // Reset streak for players who didn't answer at all
    for (const p of room.players.values()) {
      if (!room.answersForCurrentQuestion.has(p.id)) {
        p.streak = 0;
        p.lastAnswer = {
          questionId: q.id,
          selectedOptionIds: [],
          isCorrect: false,
          earnedPoints: 0,
          streakBonus: 0,
          responseTimeMs: q.timeLimitSec * 1000,
        };
      }
    }

    const leaderboard = getLeaderboard(room);

    // Send full reveal + explanation to Host
    io.to(room.hostSocketId).emit('room:question-reveal', {
      state: room.state,
      questionIndex: room.currentQuestionIndex,
      totalQuestions: room.questions.length,
      question: sanitizeQuestionForHost(q, true),
      explanation: q.explanation || '',
      optionCounts,
      totalAnswers: room.answersForCurrentQuestion.size,
      leaderboard,
    });

    // Send personalized feedback to each connected player
    for (const p of room.players.values()) {
      const rankObj = leaderboard.find((l) => l.id === p.id);
      io.to(p.socketId).emit('player:question-result', {
        questionId: q.id,
        isCorrect: p.lastAnswer?.isCorrect || false,
        earnedPoints: p.lastAnswer?.earnedPoints || 0,
        streakBonus: p.lastAnswer?.streakBonus || 0,
        totalScore: p.score,
        streak: p.streak,
        rank: rankObj?.rank || 1,
        correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
        explanation: q.explanation || '',
      });
    }
  }

  function persistRoomSession(room: LiveRoom): string {
    if (room.savedSessionId) return room.savedSessionId;

    const sessionId = crypto.randomUUID();
    room.savedSessionId = sessionId;
    const endedAtIso = new Date().toISOString();

    db.prepare(`
      INSERT INTO game_sessions (id, quiz_id, quiz_title, mode, pin, started_at, ended_at, total_questions)
      VALUES (?, ?, ?, 'LIVE', ?, ?, ?, ?)
    `).run(
      sessionId,
      room.quizId,
      room.quizTitle,
      room.pin,
      room.startedAtIso,
      endedAtIso,
      room.questions.length
    );

    const leaderboard = getLeaderboard(room);
    const insertPlayer = db.prepare(`
      INSERT INTO session_players (id, session_id, nickname, score, correct_count, max_streak, rank)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const playerDbIdMap = new Map<string, string>();
    for (const p of leaderboard) {
      const dbPlayerId = crypto.randomUUID();
      playerDbIdMap.set(p.id, dbPlayerId);
      insertPlayer.run(dbPlayerId, sessionId, p.nickname, p.score, p.correctCount, p.maxStreak, p.rank);
    }

    const insertAnswer = db.prepare(`
      INSERT INTO player_answers (
        id, session_id, player_id, question_id, question_text,
        selected_option_ids_json, is_correct, response_time_ms, earned_points
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const log of room.allAnswerLogs) {
      const dbPid = playerDbIdMap.get(log.playerId);
      if (!dbPid) continue;
      insertAnswer.run(
        crypto.randomUUID(),
        sessionId,
        dbPid,
        log.questionId,
        log.questionText,
        JSON.stringify(log.selectedOptionIds),
        log.isCorrect ? 1 : 0,
        log.responseTimeMs,
        log.earnedPoints
      );
    }

    return sessionId;
  }

  function finalizeGameToPodium(room: LiveRoom): string {
    if (room.timerHandle) {
      clearTimeout(room.timerHandle);
      room.timerHandle = undefined;
    }
    room.state = 'PODIUM';
    const sessionId = persistRoomSession(room);
    const leaderboard = getLeaderboard(room);

    io.to(`room:${room.pin}`).emit('room:podium', {
      state: 'PODIUM',
      sessionId,
      quizTitle: room.quizTitle,
      leaderboard,
      podiumTop3: leaderboard.slice(0, 3),
    });

    return sessionId;
  }

  io.on('connection', (socket: Socket) => {
    // 1. Host creates a Live Arena Room
    socket.on('host:create-room', (payload, cb) => {
      try {
        const quizId = String(payload?.quizId || '');
        const quiz = getFullQuizById(db, quizId);
        if (!quiz || quiz.questions.length === 0) {
          cb?.({ ok: false, error: 'Bộ đề không tồn tại hoặc chưa có câu hỏi nào.' });
          return;
        }

        const rawSettings = payload?.settings || {};
        const settings: RoomSettings = {
          mediaDeliveryMode:
            (rawSettings.mediaDeliveryMode as MediaDeliveryMode) === 'SYNC_ALL_DEVICES'
              ? 'SYNC_ALL_DEVICES'
              : 'PROJECTOR_FIRST',
          pacingMode:
            (rawSettings.pacingMode as GamePacingMode) === 'IMMEDIATE_COUNTDOWN'
              ? 'IMMEDIATE_COUNTDOWN'
              : 'MEDIA_FIRST',
          shuffleQuestions: Boolean(rawSettings.shuffleQuestions),
          shuffleOptions: Boolean(rawSettings.shuffleOptions),
          showOptionTextOnPlayer:
            rawSettings.showOptionTextOnPlayer === undefined
              ? true
              : Boolean(rawSettings.showOptionTextOnPlayer),
          isLocked: false,
          themeId: rawSettings.themeId || quiz.themeId || 'CLASSIC_PURPLE',
        };

        let preparedQuestions = quiz.questions.map((q) => ({
          ...q,
          options: settings.shuffleOptions ? shuffleArray(q.options) : [...q.options],
        }));
        if (settings.shuffleQuestions) {
          preparedQuestions = shuffleArray(preparedQuestions);
        }

        const pin = generateUniquePin();
        const hostToken = crypto.randomUUID();
        const room: LiveRoom = {
          pin,
          quizId: quiz.id,
          quizTitle: quiz.title,
          hostSocketId: socket.id,
          hostToken,
          state: 'LOBBY',
          settings,
          questions: preparedQuestions,
          currentQuestionIndex: 0,
          questionStartedAt: 0,
          startedAtIso: new Date().toISOString(),
          players: new Map(),
          tokenToPlayerId: new Map(),
          answersForCurrentQuestion: new Map(),
          allAnswerLogs: [],
        };

        rooms.set(pin, room);
        socket.join(`room:${pin}`);

        cb?.({
          ok: true,
          pin,
          hostToken,
          room: {
            pin,
            quizId: room.quizId,
            quizTitle: room.quizTitle,
            state: room.state,
            settings: room.settings,
            totalQuestions: room.questions.length,
            players: [],
          },
        });
      } catch (err) {
        cb?.({ ok: false, error: err instanceof Error ? err.message : 'Lỗi tạo phòng' });
      }
    });

    // 2. Host updates room settings in Lobby or mid-game
    socket.on('host:update-settings', (payload, cb) => {
      const pin = String(payload?.pin || '');
      const room = rooms.get(pin);
      if (!room) {
        cb?.({ ok: false, error: 'Không tìm thấy phòng.' });
        return;
      }
      room.settings = {
        ...room.settings,
        ...(payload?.settings || {}),
      };
      broadcastLobbyState(room);
      cb?.({ ok: true, settings: room.settings });
    });

    // 3. Host kicks a player
    socket.on('host:kick-player', (payload, cb) => {
      const pin = String(payload?.pin || '');
      const playerId = String(payload?.playerId || '');
      const room = rooms.get(pin);
      if (!room) {
        cb?.({ ok: false, error: 'Không tìm thấy phòng.' });
        return;
      }
      const p = room.players.get(playerId);
      if (p) {
        io.to(p.socketId).emit('player:kicked', { reason: 'Bạn đã bị Quản trò mời rời phòng.' });
        room.tokenToPlayerId.delete(p.sessionToken);
        room.players.delete(playerId);
        broadcastLobbyState(room);
      }
      cb?.({ ok: true });
    });

    // 4. Player joins room via PIN + Nickname
    socket.on('player:join', (payload, cb) => {
      const pin = String(payload?.pin || '').trim();
      const room = rooms.get(pin);
      if (!room) {
        cb?.({ ok: false, error: 'Mã PIN phòng không tồn tại hoặc đã kết thúc.' });
        return;
      }
      if (room.settings.isLocked) {
        cb?.({ ok: false, error: 'Phòng hiện đang khóa không nhận thêm người chơi mới.' });
        return;
      }

      let nickname = String(payload?.nickname || '').trim();
      if (!nickname) {
        const rand = FUNNY_NICKNAMES[Math.floor(Math.random() * FUNNY_NICKNAMES.length)];
        nickname = `${rand} #${Math.floor(10 + Math.random() * 89)}`;
      }

      // Prevent duplicate nickname collision
      const existingNames = new Set(
        Array.from(room.players.values()).map((p) => p.nickname.toLowerCase())
      );
      if (existingNames.has(nickname.toLowerCase())) {
        nickname = `${nickname} (${room.players.size + 1})`;
      }

      const playerId = crypto.randomUUID();
      const playerSessionToken = crypto.randomUUID();
      const player: ArenaPlayer = {
        id: playerId,
        socketId: socket.id,
        sessionToken: playerSessionToken,
        nickname,
        score: 0,
        streak: 0,
        maxStreak: 0,
        correctCount: 0,
        connected: true,
      };

      room.players.set(playerId, player);
      room.tokenToPlayerId.set(playerSessionToken, playerId);

      socket.join(`room:${pin}`);
      socket.join(`players:${pin}`);

      broadcastLobbyState(room);

      cb?.({
        ok: true,
        pin,
        playerId,
        playerSessionToken,
        nickname,
        quizTitle: room.quizTitle,
        state: room.state,
        settings: room.settings,
      });

      // If game is already mid-question, immediately sync current question to the newly joined player
      if (room.state === 'QUESTION_PREVIEW' || room.state === 'QUESTION_ACTIVE') {
        const q = room.questions[room.currentQuestionIndex];
        if (q) {
          socket.emit('room:question', {
            state: room.state,
            questionIndex: room.currentQuestionIndex,
            totalQuestions: room.questions.length,
            settings: room.settings,
            questionStartedAt: room.questionStartedAt,
            question: sanitizeQuestionForPlayer(q, room.settings),
          });
        }
      }
    });

    // 5. Player Auto-Reconnect via playerSessionToken
    socket.on('player:reconnect', (payload, cb) => {
      const pin = String(payload?.pin || '').trim();
      const token = String(payload?.playerSessionToken || '').trim();
      const room = rooms.get(pin);
      if (!room) {
        cb?.({ ok: false, error: 'Phòng chơi không còn tồn tại.' });
        return;
      }

      const playerId = room.tokenToPlayerId.get(token);
      if (!playerId) {
        cb?.({ ok: false, error: 'Phiên kết nối không hợp lệ.' });
        return;
      }

      const player = room.players.get(playerId);
      if (!player) {
        cb?.({ ok: false, error: 'Không tìm thấy thông tin người chơi.' });
        return;
      }

      player.socketId = socket.id;
      player.connected = true;
      socket.join(`room:${pin}`);
      socket.join(`players:${pin}`);

      const q = room.questions[room.currentQuestionIndex];
      const alreadyAnswered = room.answersForCurrentQuestion.has(player.id);

      cb?.({
        ok: true,
        pin,
        quizTitle: room.quizTitle,
        state: room.state,
        settings: room.settings,
        alreadyAnswered,
        player: {
          id: player.id,
          nickname: player.nickname,
          score: player.score,
          streak: player.streak,
          maxStreak: player.maxStreak,
          correctCount: player.correctCount,
        },
        currentQuestion:
          q && (room.state === 'QUESTION_PREVIEW' || room.state === 'QUESTION_ACTIVE')
            ? {
                state: room.state,
                questionIndex: room.currentQuestionIndex,
                totalQuestions: room.questions.length,
                questionStartedAt: room.questionStartedAt,
                question: sanitizeQuestionForPlayer(q, room.settings),
              }
            : null,
      });

      broadcastLobbyState(room);
    });

    // 6. Host starts the game
    socket.on('host:start-game', (payload, cb) => {
      const pin = String(payload?.pin || '');
      const room = rooms.get(pin);
      if (!room) {
        cb?.({ ok: false, error: 'Không tìm thấy phòng.' });
        return;
      }
      room.currentQuestionIndex = 0;
      room.startedAtIso = new Date().toISOString();
      startCurrentQuestion(room);
      cb?.({ ok: true, state: room.state });
    });

    // 7. Host triggers countdown when in QUESTION_PREVIEW (MEDIA_FIRST mode)
    socket.on('host:start-countdown', (payload, cb) => {
      const pin = String(payload?.pin || '');
      const room = rooms.get(pin);
      if (!room) {
        cb?.({ ok: false, error: 'Không tìm thấy phòng.' });
        return;
      }
      activateCountdownForCurrentQuestion(room);
      cb?.({ ok: true, state: room.state });
    });

    // 8. Player submits answer
    socket.on('player:submit-answer', (payload, cb) => {
      const pin = String(payload?.pin || '');
      const room = rooms.get(pin);
      if (!room) {
        cb?.({ ok: false, error: 'Không tìm thấy phòng.' });
        return;
      }

      // If still in QUESTION_PREVIEW, automatically activate countdown timestamp so eager players can answer
      if (room.state === 'QUESTION_PREVIEW') {
        room.state = 'QUESTION_ACTIVE';
        room.questionStartedAt = Date.now();
      }

      if (room.state !== 'QUESTION_ACTIVE') {
        cb?.({ ok: false, error: 'Câu hỏi hiện đã khóa hoặc chưa bắt đầu.' });
        return;
      }

      // Find player by socketId or playerSessionToken
      let player: ArenaPlayer | undefined;
      if (payload?.playerSessionToken) {
        const pid = room.tokenToPlayerId.get(String(payload.playerSessionToken));
        if (pid) player = room.players.get(pid);
      }
      if (!player) {
        player = Array.from(room.players.values()).find((p) => p.socketId === socket.id);
      }

      if (!player) {
        cb?.({ ok: false, error: 'Không xác định được người chơi.' });
        return;
      }

      if (room.answersForCurrentQuestion.has(player.id)) {
        cb?.({ ok: true, alreadyAnswered: true });
        return;
      }

      const q = room.questions[room.currentQuestionIndex];
      if (!q) {
        cb?.({ ok: false, error: 'Không tìm thấy câu hỏi.' });
        return;
      }

      const selectedOptionIds: string[] = Array.isArray(payload?.selectedOptionIds)
        ? payload.selectedOptionIds.map(String)
        : [];
      const responseTimeMs = Math.max(0, Date.now() - (room.questionStartedAt || Date.now()));
      const isCorrect = evaluateAnswer(q.type, q.options, selectedOptionIds);
      const { earnedPoints, newStreak, streakBonus } = calculateScore({
        isCorrect,
        responseTimeMs,
        timeLimitSec: q.timeLimitSec,
        pointsMultiplier: q.pointsMultiplier,
        currentStreak: player.streak,
      });

      player.score += earnedPoints;
      player.streak = newStreak;
      if (newStreak > player.maxStreak) player.maxStreak = newStreak;
      if (isCorrect) player.correctCount += 1;

      player.lastAnswer = {
        questionId: q.id,
        selectedOptionIds,
        isCorrect,
        earnedPoints,
        streakBonus,
        responseTimeMs,
      };

      room.answersForCurrentQuestion.set(player.id, { selectedOptionIds, responseTimeMs });
      room.allAnswerLogs.push({
        playerId: player.id,
        questionId: q.id,
        questionText: q.text,
        selectedOptionIds,
        isCorrect,
        responseTimeMs,
        earnedPoints,
      });

      // Notify host of answer count update
      io.to(room.hostSocketId).emit('room:answer-count', {
        answeredCount: room.answersForCurrentQuestion.size,
        totalPlayers: room.players.size,
      });

      cb?.({ ok: true, received: true });

      // If all connected players have answered, auto-reveal immediately
      const activePlayers = Array.from(room.players.values()).filter((p) => p.connected);
      if (activePlayers.length > 0 && room.answersForCurrentQuestion.size >= activePlayers.length) {
        revealCurrentQuestion(room);
      }
    });

    // 9. Host manually reveals answer early (Skip timer)
    socket.on('host:reveal-answer', (payload, cb) => {
      const pin = String(payload?.pin || '');
      const room = rooms.get(pin);
      if (!room) {
        cb?.({ ok: false, error: 'Không tìm thấy phòng.' });
        return;
      }
      revealCurrentQuestion(room);
      cb?.({ ok: true });
    });

    // 10. Host shows Leaderboard between questions
    socket.on('host:show-leaderboard', (payload, cb) => {
      const pin = String(payload?.pin || '');
      const room = rooms.get(pin);
      if (!room) {
        cb?.({ ok: false, error: 'Không tìm thấy phòng.' });
        return;
      }
      room.state = 'LEADERBOARD';
      const leaderboard = getLeaderboard(room);
      io.to(`room:${room.pin}`).emit('room:leaderboard', {
        state: 'LEADERBOARD',
        questionIndex: room.currentQuestionIndex,
        totalQuestions: room.questions.length,
        leaderboard,
      });
      cb?.({ ok: true, leaderboard });
    });

    // 11. Host advances to Next Question (or Podium if at the end)
    socket.on('host:next-question', (payload, cb) => {
      const pin = String(payload?.pin || '');
      const room = rooms.get(pin);
      if (!room) {
        cb?.({ ok: false, error: 'Không tìm thấy phòng.' });
        return;
      }
      room.currentQuestionIndex += 1;
      if (room.currentQuestionIndex >= room.questions.length) {
        const sessionId = finalizeGameToPodium(room);
        cb?.({ ok: true, finished: true, sessionId });
      } else {
        startCurrentQuestion(room);
        cb?.({ ok: true, finished: false, state: room.state });
      }
    });

    // 12. Host finishes game early and saves session report
    socket.on('host:finish-game', (payload, cb) => {
      const pin = String(payload?.pin || '');
      const room = rooms.get(pin);
      if (!room) {
        cb?.({ ok: false, error: 'Không tìm thấy phòng.' });
        return;
      }
      const sessionId = finalizeGameToPodium(room);
      cb?.({ ok: true, sessionId });
    });

    socket.on('disconnect', () => {
      for (const room of rooms.values()) {
        for (const p of room.players.values()) {
          if (p.socketId === socket.id) {
            p.connected = false;
            broadcastLobbyState(room);
          }
        }
      }
    });
  });

  return rooms;
}
