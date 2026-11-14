import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseYouTubeUrl } from '../services/youtube.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const MAX_MEDIA_BYTES = 100 * 1024 * 1024; // 100MB hard limit

export const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const ALLOWED_MIMES: Record<string, 'IMAGE' | 'AUDIO' | 'VIDEO_UPLOAD'> = {
  'image/jpeg': 'IMAGE',
  'image/png': 'IMAGE',
  'image/webp': 'IMAGE',
  'image/gif': 'IMAGE',
  'audio/mpeg': 'AUDIO',
  'audio/mp3': 'AUDIO',
  'audio/wav': 'AUDIO',
  'audio/x-wav': 'AUDIO',
  'audio/ogg': 'AUDIO',
  'audio/mp4': 'AUDIO',
  'audio/x-m4a': 'AUDIO',
  'video/mp4': 'VIDEO_UPLOAD',
  'video/webm': 'VIDEO_UPLOAD',
  'video/quicktime': 'VIDEO_UPLOAD',
  'video/ogg': 'VIDEO_UPLOAD',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const safeName = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}${ext}`;
    cb(null, safeName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_MEDIA_BYTES,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(`UNSUPPORTED_MEDIA_TYPE:${file.mimetype}`));
    }
  },
});

export const mediaRouter = Router();

mediaRouter.post(
  '/upload',
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: unknown) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({
            error: 'File vượt quá giới hạn tối đa 100MB.',
            maxSizeBytes: MAX_MEDIA_BYTES,
          });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      if (err instanceof Error) {
        if (err.message.startsWith('UNSUPPORTED_MEDIA_TYPE:')) {
          res.status(415).json({
            error: 'Định dạng file không được hỗ trợ. Chỉ chấp nhận Ảnh (JPG/PNG/WebP/GIF), Âm thanh (MP3/WAV/OGG/M4A) hoặc Video (MP4/WebM/MOV) <= 100MB.',
          });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      next();
    });
  },
  (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ error: 'Không tìm thấy file tải lên.' });
      return;
    }

    const mediaType = ALLOWED_MIMES[req.file.mimetype] || 'VIDEO_UPLOAD';
    res.status(201).json({
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      mediaType,
      url: `/api/media/stream/${req.file.filename}`,
    });
  }
);

mediaRouter.post('/parse-youtube', (req: Request, res: Response) => {
  const { url, startTime, endTime } = req.body || {};
  const parsed = parseYouTubeUrl(url, startTime, endTime);
  if (!parsed) {
    res.status(400).json({ error: 'Link YouTube không hợp lệ.' });
    return;
  }
  res.json(parsed);
});

mediaRouter.get('/stream/:filename', (req: Request, res: Response) => {
  const safeFilename = path.basename(String(req.params.filename));
  const filePath = path.join(uploadsDir, safeFilename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Không tìm thấy file media.' });
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const ext = path.extname(safeFilename).toLowerCase();

  const mimeMap: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
  };
  const contentType = mimeMap[ext] || 'application/octet-stream';
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (isNaN(start) || isNaN(end) || start >= fileSize || end >= fileSize) {
      res.status(416).header('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Accept-Ranges': 'bytes',
      'Content-Length': fileSize,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
});
