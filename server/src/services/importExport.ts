import * as XLSX from 'xlsx';
import crypto from 'node:crypto';
import type {
  Question,
  QuestionOption,
  QuestionType,
  MediaType,
  OptionColor,
  Quiz,
  ImageRevealMode,
} from '../types.ts';

const COLORS: OptionColor[] = ['RED', 'BLUE', 'YELLOW', 'GREEN'];
const VALID_TYPES: QuestionType[] = [
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'TYPE_ANSWER',
  'POLL',
  'SLIDE',
];

export function exportQuizToWorkbookBuffer(quiz: Quiz, format: 'xlsx' | 'csv'): Buffer {
  const rows = quiz.questions.map((q, idx) => {
    const correctNumbers = q.options
      .map((opt, i) => (opt.isCorrect ? String(i + 1) : null))
      .filter(Boolean)
      .join(',');

    return {
      Order: idx + 1,
      Type: q.type,
      QuestionText: q.text,
      Option1: q.options[0]?.text || '',
      Option2: q.options[1]?.text || '',
      Option3: q.options[2]?.text || '',
      Option4: q.options[3]?.text || '',
      CorrectAnswers: correctNumbers || '1',
      TimeLimitSec: q.timeLimitSec,
      PointsMultiplier: q.pointsMultiplier,
      Explanation: q.explanation || '',
      MediaType: q.mediaType || 'NONE',
      MediaUrl: q.mediaUrl || '',
      MediaStartSec: q.mediaStartTime || 0,
      MediaEndSec: q.mediaEndTime || 0,
      ImageReveal: q.imageReveal || 'NONE',
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

  if (format === 'csv') {
    const csvContent = XLSX.utils.sheet_to_csv(worksheet);
    return Buffer.from('\uFEFF' + csvContent, 'utf-8');
  }

  const out = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(out);
}

export function parseImportedFileBuffer(
  buffer: Buffer,
  filename: string,
  customTitle?: string
): { title: string; description: string; questions: Omit<Question, 'id' | 'quizId' | 'orderIndex'>[] } {
  const ext = filename.toLowerCase().split('.').pop() || '';

  if (ext === 'json') {
    const parsed = JSON.parse(buffer.toString('utf-8'));
    const rawQuestions = Array.isArray(parsed) ? parsed : parsed.questions || [];
    return {
      title: customTitle || parsed.title || 'Bộ đề nhập từ JSON',
      description: parsed.description || 'Nhập từ file JSON',
      questions: rawQuestions.map(normalizeQuestionInput),
    };
  }

  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const questions = rows
    .filter((r) => String(r.QuestionText || r['Câu hỏi'] || '').trim().length > 0)
    .map((r) => {
      const typeRaw = String(r.Type || r['Loại'] || 'SINGLE_CHOICE').toUpperCase();
      const type: QuestionType = VALID_TYPES.includes(typeRaw as QuestionType)
        ? (typeRaw as QuestionType)
        : 'SINGLE_CHOICE';

      const text = String(r.QuestionText || r['Câu hỏi'] || '').trim();
      const correctStr = String(r.CorrectAnswers || r['Đáp án đúng'] || '1');
      const correctIndices = correctStr
        .split(/[,;\s]+/)
        .map((s) => parseInt(s.trim(), 10) - 1)
        .filter((n) => !isNaN(n) && n >= 0 && n < 4);

      const rawOpts = [
        String(r.Option1 || r['Đáp án 1'] || ''),
        String(r.Option2 || r['Đáp án 2'] || ''),
        String(r.Option3 || r['Đáp án 3'] || ''),
        String(r.Option4 || r['Đáp án 4'] || ''),
      ];

      const optionCount = type === 'TRUE_FALSE' ? 2 : 4;
      const options: QuestionOption[] = [];
      for (let i = 0; i < optionCount; i++) {
        const fallback = type === 'TRUE_FALSE' ? (i === 0 ? 'Đúng (True)' : 'Sai (False)') : `Đáp án ${i + 1}`;
        options.push({
          id: crypto.randomUUID(),
          text: rawOpts[i]?.trim() || (type === 'TYPE_ANSWER' || type === 'SLIDE' ? '' : fallback),
          isCorrect:
            type === 'TYPE_ANSWER'
              ? Boolean(rawOpts[i]?.trim())
              : correctIndices.length > 0
              ? correctIndices.includes(i)
              : i === 0,
          color: COLORS[i % 4],
        });
      }

      const mediaTypeRaw = String(r.MediaType || 'NONE').toUpperCase();
      const mediaType: MediaType = ['NONE', 'IMAGE', 'AUDIO', 'VIDEO_UPLOAD', 'YOUTUBE'].includes(mediaTypeRaw)
        ? (mediaTypeRaw as MediaType)
        : 'NONE';

      const imageRevealRaw = String(r.ImageReveal || 'NONE').toUpperCase();
      const imageReveal: ImageRevealMode = ['NONE', 'GRID_3X3', 'GRID_5X5'].includes(imageRevealRaw)
        ? (imageRevealRaw as ImageRevealMode)
        : 'NONE';

      const rawMult = Number(r.PointsMultiplier ?? 1);
      const pointsMultiplier: 0 | 1 | 2 =
        type === 'POLL' || type === 'SLIDE' || rawMult === 0 ? 0 : rawMult === 2 ? 2 : 1;

      return {
        type,
        text,
        explanation: String(r.Explanation || r['Giải thích'] || ''),
        timeLimitSec: Math.max(5, Math.min(240, Number(r.TimeLimitSec || r['Thời gian'] || 20))),
        pointsMultiplier,
        mediaType,
        mediaUrl: String(r.MediaUrl || ''),
        mediaStartTime: Number(r.MediaStartSec || 0),
        mediaEndTime: Number(r.MediaEndSec || 0),
        imageReveal,
        options: type === 'TYPE_ANSWER' ? options.filter((o) => o.text.length > 0) : options,
      };
    });

  return {
    title: customTitle || filename.replace(/\.[^.]+$/, '') || 'Bộ đề nhập từ Excel/CSV',
    description: `Nhập tự động từ file ${filename} (${questions.length} câu hỏi)`,
    questions,
  };
}

export function normalizeQuestionInput(raw: Record<string, unknown>): Omit<Question, 'id' | 'quizId' | 'orderIndex'> {
  const typeRaw = String(raw.type || 'SINGLE_CHOICE').toUpperCase();
  const type: QuestionType = VALID_TYPES.includes(typeRaw as QuestionType)
    ? (typeRaw as QuestionType)
    : 'SINGLE_CHOICE';

  const rawOptions = Array.isArray(raw.options) ? raw.options : [];
  const options: QuestionOption[] = rawOptions.map((o: Record<string, unknown>, idx: number) => ({
    id: String(o.id || crypto.randomUUID()),
    text: String(o.text ?? `Đáp án ${idx + 1}`),
    isCorrect: type === 'TYPE_ANSWER' || type === 'POLL' ? true : Boolean(o.isCorrect),
    color: (COLORS.includes(o.color as OptionColor) ? o.color : COLORS[idx % 4]) as OptionColor,
    sticker: o.sticker ? String(o.sticker) : undefined,
    imageUrl: o.imageUrl ? String(o.imageUrl) : undefined,
  }));

  if (options.length === 0 && type !== 'SLIDE') {
    options.push(
      { id: crypto.randomUUID(), text: 'Đáp án A', isCorrect: true, color: 'RED' },
      { id: crypto.randomUUID(), text: 'Đáp án B', isCorrect: false, color: 'BLUE' }
    );
  } else if (options.length > 0 && !options.some((o) => o.isCorrect)) {
    options[0].isCorrect = true;
  }

  const mediaTypeRaw = String(raw.mediaType || 'NONE').toUpperCase();
  const mediaType: MediaType = ['NONE', 'IMAGE', 'AUDIO', 'VIDEO_UPLOAD', 'YOUTUBE'].includes(mediaTypeRaw)
    ? (mediaTypeRaw as MediaType)
    : 'NONE';

  const imageRevealRaw = String(raw.imageReveal || 'NONE').toUpperCase();
  const imageReveal: ImageRevealMode = ['NONE', 'GRID_3X3', 'GRID_5X5'].includes(imageRevealRaw)
    ? (imageRevealRaw as ImageRevealMode)
    : 'NONE';

  const rawMult = Number(raw.pointsMultiplier ?? 1);
  const pointsMultiplier: 0 | 1 | 2 =
    type === 'POLL' || type === 'SLIDE' || rawMult === 0 ? 0 : rawMult === 2 ? 2 : 1;

  return {
    type,
    text: String(raw.text || 'Câu hỏi mới'),
    explanation: String(raw.explanation || ''),
    timeLimitSec: Math.max(5, Math.min(240, Number(raw.timeLimitSec || 20))),
    pointsMultiplier,
    mediaType,
    mediaUrl: String(raw.mediaUrl || ''),
    mediaStartTime: Number(raw.mediaStartTime || 0),
    mediaEndTime: Number(raw.mediaEndTime || 0),
    imageReveal,
    options,
  };
}
