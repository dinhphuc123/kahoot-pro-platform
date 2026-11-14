import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { mediaRouter, uploadsDir } from '../src/routes/media.ts';

const app = express();
app.use(express.json());
app.use('/api/media', mediaRouter);

const uploadedFiles: string[] = [];

after(() => {
  for (const f of uploadedFiles) {
    const p = path.join(uploadsDir, f);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  }
});

describe('Task 2: Media Upload (<=100MB) & HTTP Range Streaming API', () => {
  it('uploads an audio or video file and streams it with 206 Partial Content via HTTP Range', async () => {
    const fakeVideoBuffer = Buffer.alloc(1024 * 50, 'v'); // 50KB sample video
    const uploadRes = await request(app)
      .post('/api/media/upload')
      .attach('file', fakeVideoBuffer, {
        filename: 'sample-lesson.mp4',
        contentType: 'video/mp4',
      });

    assert.equal(uploadRes.status, 201);
    assert.equal(uploadRes.body.mediaType, 'VIDEO_UPLOAD');
    assert.ok(uploadRes.body.url.includes('/api/media/stream/'));
    uploadedFiles.push(uploadRes.body.filename);

    // Verify HTTP Range request returns 206 Partial Content
    const rangeRes = await request(app)
      .get(uploadRes.body.url)
      .set('Range', 'bytes=0-1023');

    assert.equal(rangeRes.status, 206);
    assert.equal(rangeRes.headers['accept-ranges'], 'bytes');
    assert.equal(rangeRes.headers['content-range'], `bytes 0-1023/${fakeVideoBuffer.length}`);
    assert.equal(rangeRes.body.length, 1024);
  });

  it('rejects unsupported file types with 415', async () => {
    const badBuffer = Buffer.from('malicious-script');
    const res = await request(app)
      .post('/api/media/upload')
      .attach('file', badBuffer, {
        filename: 'hack.exe',
        contentType: 'application/x-msdownload',
      });

    assert.equal(res.status, 415);
  });

  it('parses YouTube URLs with start and end time via /api/media/parse-youtube', async () => {
    const res = await request(app)
      .post('/api/media/parse-youtube')
      .send({ url: 'https://youtu.be/YompsDlEdtc', startTime: 10, endTime: 40 });

    assert.equal(res.status, 200);
    assert.equal(res.body.videoId, 'YompsDlEdtc');
    assert.ok(res.body.embedUrl.includes('start=10'));
    assert.ok(res.body.embedUrl.includes('end=40'));
  });
});
