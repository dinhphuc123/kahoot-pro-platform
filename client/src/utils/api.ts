export const getApiBase = (): string => {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem('KAHOOT_BACKEND_URL');
  if (stored) return stored.replace(/\/$/, '');
  if (window.location.port === '5173') return 'http://localhost:3001';
  return '';
};

export const API_BASE = getApiBase();

export function resolveMediaUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_BASE}${url.startsWith('/') ? '' : '/'}${url}`;
}

export function speakVietnameseText(rawText: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const cleaned = rawText.replace(/\$+/g, '').replace(/\\[a-zA-Z]+/g, '').trim();
    if (!cleaned) return;
    const utter = new SpeechSynthesisUtterance(cleaned);
    utter.lang = 'vi-VN';
    utter.rate = 0.95;
    utter.pitch = 1.1;
    const voices = window.speechSynthesis.getVoices();
    const viVoice = voices.find((v) => v.lang.toLowerCase().includes('vi'));
    if (viVoice) utter.voice = viVoice;
    window.speechSynthesis.speak(utter);
  } catch {
    // ignore speech errors on unsupported browsers
  }
}

export function extractYouTubeEmbedUrl(
  rawUrl?: string,
  startTime?: number,
  endTime?: number,
  autoplay = true
): string | null {
  if (!rawUrl) return null;
  let videoId = '';
  const trimmed = rawUrl.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    videoId = trimmed;
  } else {
    try {
      const u = new URL(trimmed);
      const host = u.hostname.replace(/^www\./, '');
      if (host === 'youtu.be') {
        videoId = u.pathname.slice(1).split('/')[0];
      } else if (host.includes('youtube')) {
        if (u.pathname === '/watch') {
          videoId = u.searchParams.get('v') || '';
        } else {
          const parts = u.pathname.split('/');
          videoId = parts[2] || '';
        }
      }
    } catch {
      return null;
    }
  }

  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;

  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    autoplay: autoplay ? '1' : '0',
  });
  if (startTime && startTime > 0) params.set('start', String(Math.floor(startTime)));
  if (endTime && endTime > 0) params.set('end', String(Math.floor(endTime)));

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

export async function uploadMediaFileWithProgress(
  file: File,
  onProgress?: (percent: number) => void
): Promise<{
  filename: string;
  url: string;
  mediaType: 'IMAGE' | 'AUDIO' | 'VIDEO_UPLOAD';
  size: number;
}> {
  const MAX_BYTES = 100 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    throw new Error(
      `Dung lượng file (${(file.size / 1024 / 1024).toFixed(1)}MB) vượt quá giới hạn tối đa 100MB!`
    );
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        onProgress(Math.round((ev.loaded / ev.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          reject(new Error(data.error || 'Lỗi tải file lên server.'));
        }
      } catch {
        reject(new Error('Phản hồi từ server không hợp lệ.'));
      }
    };

    xhr.onerror = () => reject(new Error('Mất kết nối khi đang tải file lên.'));
    xhr.open('POST', `${API_BASE}/api/media/upload`);
    xhr.send(formData);
  });
}
