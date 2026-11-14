export interface ParsedYouTube {
  videoId: string;
  embedUrl: string;
  startTime?: number;
  endTime?: number;
}

export function parseYouTubeUrl(
  rawUrl: string,
  customStart?: number,
  customEnd?: number
): ParsedYouTube | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();

  // Direct 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return buildYouTubeEmbed(trimmed, customStart, customEnd);
  }

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, '');
    let videoId = '';

    if (host === 'youtu.be') {
      videoId = url.pathname.slice(1).split('/')[0];
    } else if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v') || '';
      } else if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/') || url.pathname.startsWith('/v/')) {
        videoId = url.pathname.split('/')[2] || '';
      }
    }

    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      return null;
    }

    const tParam = url.searchParams.get('t') || url.searchParams.get('start');
    const parsedT = tParam ? parseInt(tParam.replace(/\D/g, ''), 10) : undefined;
    const start = customStart !== undefined && customStart > 0 ? customStart : parsedT;

    return buildYouTubeEmbed(videoId, start, customEnd);
  } catch {
    return null;
  }
}

function buildYouTubeEmbed(videoId: string, start?: number, end?: number): ParsedYouTube {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
  });
  if (start && start > 0) params.set('start', String(Math.floor(start)));
  if (end && end > 0) params.set('end', String(Math.floor(end)));

  return {
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}?${params.toString()}`,
    startTime: start,
    endTime: end,
  };
}
