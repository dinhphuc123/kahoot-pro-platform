import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import type { QuestionOption } from '../types.ts';

export function seedDefaultQuizIfNeeded(db: DatabaseSync): void {
  const now = new Date().toISOString();
  const insertQ = db.prepare(`
    INSERT INTO questions (
      id, quiz_id, order_index, type, text, explanation,
      time_limit_sec, points_multiplier, media_type, media_url,
      media_start_time, media_end_time, options_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Seed High-School Math & Multimedia Quiz if missing
  const mathExists = db
    .prepare('SELECT id FROM quizzes WHERE id = ?')
    .get('demo-math-multimedia-quiz');

  if (!mathExists) {
    const quizId = 'demo-math-multimedia-quiz';
    db.prepare(`
      INSERT INTO quizzes (id, title, description, cover_image, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      quizId,
      'Đấu Trường Toán Học & Đa Phương Tiện (Demo Pro)',
      'Bộ câu hỏi mẫu tích hợp công thức Toán KaTeX, Video YouTube, câu hỏi nhiều đáp án, Đúng/Sai và Giải thích chi tiết.',
      '',
      now,
      now
    );

    const demoQuestions: Array<{
      id: string;
      type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
      text: string;
      explanation: string;
      timeLimitSec: number;
      pointsMultiplier: 1 | 2;
      mediaType: 'NONE' | 'IMAGE' | 'AUDIO' | 'VIDEO_UPLOAD' | 'YOUTUBE';
      mediaUrl: string;
      mediaStartTime: number;
      mediaEndTime: number;
      options: QuestionOption[];
    }> = [
      {
        id: 'q-math-quadratic',
        type: 'SINGLE_CHOICE',
        text: 'Nghiệm của phương trình bậc hai $x^2 - 5x + 6 = 0$ là gì?',
        explanation:
          'Ta có $\\Delta = (-5)^2 - 4 \\cdot 1 \\cdot 6 = 25 - 24 = 1 > 0$. Vậy phương trình có 2 nghiệm phân biệt $x_1 = \\frac{5 - 1}{2} = 2$ và $x_2 = \\frac{5 + 1}{2} = 3$.',
        timeLimitSec: 20,
        pointsMultiplier: 1,
        mediaType: 'NONE',
        mediaUrl: '',
        mediaStartTime: 0,
        mediaEndTime: 0,
        options: [
          { id: 'opt-1', text: '$x = 2$ hoặc $x = 3$', isCorrect: true, color: 'RED' },
          { id: 'opt-2', text: '$x = -2$ hoặc $x = -3$', isCorrect: false, color: 'BLUE' },
          { id: 'opt-3', text: '$x = 1$ hoặc $x = 6$', isCorrect: false, color: 'YELLOW' },
          { id: 'opt-4', text: 'Phương trình vô nghiệm ($\\Delta < 0$)', isCorrect: false, color: 'GREEN' },
        ],
      },
      {
        id: 'q-youtube-science',
        type: 'SINGLE_CHOICE',
        text: 'Xem đoạn trích Video sau và cho biết: Theo định lý Pythagoras trong tam giác vuông có hai cạnh góc vuông $a, b$ và cạnh huyền $c$, hệ thức nào luôn đúng?',
        explanation:
          'Định lý Pythagoras khẳng định bình phương độ dài cạnh huyền bằng tổng bình phương độ dài hai cạnh góc vuông: $a^2 + b^2 = c^2$.',
        timeLimitSec: 25,
        pointsMultiplier: 2,
        mediaType: 'YOUTUBE',
        mediaUrl: 'https://www.youtube.com/watch?v=YompsDlEdtc',
        mediaStartTime: 5,
        mediaEndTime: 25,
        options: [
          { id: 'opt-21', text: '$a + b = c$', isCorrect: false, color: 'RED' },
          { id: 'opt-22', text: '$a^2 + b^2 = c^2$', isCorrect: true, color: 'BLUE' },
          { id: 'opt-23', text: '$a^2 - b^2 = c^2$', isCorrect: false, color: 'YELLOW' },
          { id: 'opt-24', text: '$\\sqrt{a} + \\sqrt{b} = \\sqrt{c}$', isCorrect: false, color: 'GREEN' },
        ],
      },
      {
        id: 'q-multi-prime',
        type: 'MULTIPLE_CHOICE',
        text: 'Chọn TẤT CẢ các mệnh đề toán học ĐÚNG dưới đây (Câu hỏi nhiều đáp án):',
        explanation:
          'Số $2$ là số nguyên tố chẵn duy nhất, và $\\int_0^1 2x\\,dx = [x^2]_0^1 = 1$. Còn $\\sin(0) = 0 \\neq 1$ và $\\sqrt{9} = 3$.',
        timeLimitSec: 30,
        pointsMultiplier: 2,
        mediaType: 'NONE',
        mediaUrl: '',
        mediaStartTime: 0,
        mediaEndTime: 0,
        options: [
          { id: 'opt-31', text: 'Số $2$ là số nguyên tố chẵn duy nhất', isCorrect: true, color: 'RED' },
          { id: 'opt-32', text: 'Tích phân $\\int_0^1 2x\\,dx = 1$', isCorrect: true, color: 'BLUE' },
          { id: 'opt-33', text: 'Giá trị $\\sin(0^\\circ) = 1$', isCorrect: false, color: 'YELLOW' },
          { id: 'opt-34', text: 'Căn bậc hai số học $\\sqrt{9} = -3$', isCorrect: false, color: 'GREEN' },
        ],
      },
      {
        id: 'q-true-false-derivative',
        type: 'TRUE_FALSE',
        text: 'Đúng hay Sai: Đạo hàm của hàm số $f(x) = e^x$ trên $\\mathbb{R}$ luôn bằng chính nó, tức là $f\'(x) = e^x$?',
        explanation:
          'Chính xác! Hàm số mũ tự nhiên $f(x) = e^x$ có tính chất đặc biệt là $(e^x)\' = e^x$ với mọi $x \\in \\mathbb{R}$.',
        timeLimitSec: 15,
        pointsMultiplier: 1,
        mediaType: 'NONE',
        mediaUrl: '',
        mediaStartTime: 0,
        mediaEndTime: 0,
        options: [
          { id: 'opt-41', text: 'Đúng (True)', isCorrect: true, color: 'BLUE' },
          { id: 'opt-42', text: 'Sai (False)', isCorrect: false, color: 'RED' },
        ],
      },
    ];

    demoQuestions.forEach((q, idx) => {
      insertQ.run(
        q.id || crypto.randomUUID(),
        quizId,
        idx,
        q.type,
        q.text,
        q.explanation,
        q.timeLimitSec,
        q.pointsMultiplier,
        q.mediaType,
        q.mediaUrl,
        q.mediaStartTime,
        q.mediaEndTime,
        JSON.stringify(q.options)
      );
    });
  }

  // 2. Seed Preschool Demo Quiz ("Bé Vui Khám Phá Thế Giới: Con Vật, Số Đếm & Màu Sắc") if missing
  const preschoolExists = db
    .prepare('SELECT id FROM quizzes WHERE id = ?')
    .get('demo-preschool-kids-quiz');

  if (!preschoolExists) {
    const pQuizId = 'demo-preschool-kids-quiz';
    db.prepare(`
      INSERT INTO quizzes (id, title, description, cover_image, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      pQuizId,
      '🌈 Bé Vui Khám Phá Thế Giới: Con Vật, Số Đếm & Giao Thông (Mầm Non 3–6 Tuổi)',
      'Bộ trò chơi tương tác dành riêng cho Giáo viên Mầm non: có Hình Sticker khổng lồ, đọc giọng Tiếng Việt tự động, chia 4 Đội Con Vật và thưởng Sao Vàng Bé Ngoan.',
      '',
      now,
      now
    );

    const preschoolQuestions: Array<{
      id: string;
      type: 'SINGLE_CHOICE';
      text: string;
      explanation: string;
      timeLimitSec: number;
      pointsMultiplier: 1 | 2;
      options: QuestionOption[];
    }> = [
      {
        id: 'pk-1',
        type: 'SINGLE_CHOICE',
        text: 'Đố bé biết: Con vật nào có cái vòi dài và đôi tai to thích ăn mía?',
        explanation: 'Hoan hô bé! Đó chính là bạn Voi con 🐘 có cái vòi dài thật đáng yêu!',
        timeLimitSec: 30,
        pointsMultiplier: 1,
        options: [
          { id: 'pk-o1', text: 'Bạn Voi Con', sticker: '🐘', isCorrect: true, color: 'RED' },
          { id: 'pk-o2', text: 'Bạn Thỏ Trắng', sticker: '🐰', isCorrect: false, color: 'BLUE' },
          { id: 'pk-o3', text: 'Bạn Gà Trống', sticker: '🐓', isCorrect: false, color: 'YELLOW' },
          { id: 'pk-o4', text: 'Bạn Cá Vàng', sticker: '🐠', isCorrect: false, color: 'GREEN' },
        ],
      },
      {
        id: 'pk-2',
        type: 'SINGLE_CHOICE',
        text: 'Bé hãy đếm xem có mấy quả Táo đỏ 🍎🍎🍎 ở trên bảng nhé?',
        explanation: 'Giỏi quá! Một, hai, ba — có tất cả 3 quả táo đỏ 🍎🍎🍎!',
        timeLimitSec: 30,
        pointsMultiplier: 1,
        options: [
          { id: 'pk-o21', text: '1 Quả táo', sticker: '1️⃣', isCorrect: false, color: 'RED' },
          { id: 'pk-o22', text: '3 Quả táo', sticker: '3️⃣', isCorrect: true, color: 'BLUE' },
          { id: 'pk-o23', text: '2 Quả táo', sticker: '2️⃣', isCorrect: false, color: 'YELLOW' },
          { id: 'pk-o24', text: '5 Quả táo', sticker: '5️⃣', isCorrect: false, color: 'GREEN' },
        ],
      },
      {
        id: 'pk-3',
        type: 'SINGLE_CHOICE',
        text: 'Khi đi qua ngã tư đường phố, gặp đèn tín hiệu màu gì thì chúng mình phải DỪNG LẠI?',
        explanation: 'Đúng rồi! Đèn Đỏ 🔴 thì dừng lại, đèn Xanh 🟢 mới được đi nhé!',
        timeLimitSec: 30,
        pointsMultiplier: 1,
        options: [
          { id: 'pk-o31', text: 'Đèn Màu Đỏ', sticker: '🔴', isCorrect: true, color: 'RED' },
          { id: 'pk-o32', text: 'Đèn Màu Xanh Dương', sticker: '🔵', isCorrect: false, color: 'BLUE' },
          { id: 'pk-o33', text: 'Đèn Màu Vàng', sticker: '🟡', isCorrect: false, color: 'YELLOW' },
          { id: 'pk-o34', text: 'Đèn Màu Xanh Lá', sticker: '🟢', isCorrect: false, color: 'GREEN' },
        ],
      },
      {
        id: 'pk-4',
        type: 'SINGLE_CHOICE',
        text: 'Phương tiện nào biết bay tít trên bầu trời xanh cùng những đám mây?',
        explanation: 'Hoan hô! Máy bay ✈️ bay vút trên bầu trời xanh!',
        timeLimitSec: 30,
        pointsMultiplier: 2,
        options: [
          { id: 'pk-o41', text: 'Xe Đạp', sticker: '🚲', isCorrect: false, color: 'RED' },
          { id: 'pk-o42', text: 'Tàu Thủy', sticker: '🚢', isCorrect: false, color: 'BLUE' },
          { id: 'pk-o43', text: 'Ô Tô Cứu Hỏa', sticker: '🚒', isCorrect: false, color: 'YELLOW' },
          { id: 'pk-o44', text: 'Máy Bay', sticker: '✈️', isCorrect: true, color: 'GREEN' },
        ],
      },
    ];

    preschoolQuestions.forEach((q, idx) => {
      insertQ.run(
        q.id,
        pQuizId,
        idx,
        q.type,
        q.text,
        q.explanation,
        q.timeLimitSec,
        q.pointsMultiplier,
        'NONE',
        '',
        0,
        0,
        JSON.stringify(q.options)
      );
    });
  }
}
