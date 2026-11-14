import React, { useEffect, useRef, useState } from 'react';
import { Volume2, Play, RotateCcw, Film, Music, Youtube, Image as ImageIcon, Grid } from 'lucide-react';
import type { ImageRevealMode, MediaDeliveryMode, MediaType } from '../types.ts';
import { extractYouTubeEmbedUrl, resolveMediaUrl } from '../utils/api.ts';

// Deterministic reveal sequence so tiles uncover in an exciting scattered pattern
const ORDER_3X3 = [4, 0, 8, 2, 6, 1, 7, 3, 5];
const ORDER_5X5 = [
  12, 0, 24, 4, 20, 6, 18, 8, 16, 2, 22, 10, 14, 1, 23, 3, 21, 5, 19, 7, 17, 9, 15, 11, 13,
];

interface MediaStageProps {
  mediaType: MediaType;
  mediaUrl?: string;
  startTime?: number;
  endTime?: number;
  imageReveal?: ImageRevealMode;
  revealComplete?: boolean;
  role: 'HOST' | 'PLAYER' | 'EDITOR';
  deliveryMode?: MediaDeliveryMode;
  autoPlay?: boolean;
  onMediaEnded?: () => void;
}

export const MediaStage: React.FC<MediaStageProps> = ({
  mediaType,
  mediaUrl,
  startTime = 0,
  endTime = 0,
  imageReveal = 'NONE',
  revealComplete = false,
  role,
  deliveryMode = 'PROJECTOR_FIRST',
  autoPlay = true,
  onMediaEnded,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playerOptedIn, setPlayerOptedIn] = useState(false);
  const [uncoveredCount, setUncoveredCount] = useState(0);

  const totalTiles = imageReveal === 'GRID_5X5' ? 25 : imageReveal === 'GRID_3X3' ? 9 : 0;
  const orderList = imageReveal === 'GRID_5X5' ? ORDER_5X5 : ORDER_3X3;

  useEffect(() => {
    setPlayerOptedIn(false);
  }, [mediaUrl, mediaType]);

  // Progressive Image Reveal timer (like create.kahoot.it Image Reveal)
  useEffect(() => {
    if (mediaType !== 'IMAGE' || imageReveal === 'NONE' || revealComplete) {
      setUncoveredCount(totalTiles);
      return;
    }
    setUncoveredCount(1); // Start with 1 tile uncovered
    const stepMs = imageReveal === 'GRID_5X5' ? 650 : 1400;
    const timer = window.setInterval(() => {
      setUncoveredCount((prev) => {
        if (prev >= totalTiles) {
          clearInterval(timer);
          return totalTiles;
        }
        return prev + 1;
      });
    }, stepMs);
    return () => clearInterval(timer);
  }, [mediaType, mediaUrl, imageReveal, revealComplete, totalTiles]);

  useEffect(() => {
    const el = videoRef.current || audioRef.current;
    if (!el) return;

    const handleLoaded = () => {
      if (startTime > 0) {
        el.currentTime = startTime;
      }
      if (autoPlay) {
        el.play().catch(() => {});
      }
    };

    const handleTimeUpdate = () => {
      if (endTime > 0 && el.currentTime >= endTime) {
        el.pause();
        onMediaEnded?.();
      }
    };

    el.addEventListener('loadedmetadata', handleLoaded);
    el.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      el.removeEventListener('loadedmetadata', handleLoaded);
      el.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [mediaUrl, startTime, endTime, autoPlay, playerOptedIn, onMediaEnded]);

  if (!mediaType || mediaType === 'NONE' || !mediaUrl) {
    return null;
  }

  const isBandwidthProtected =
    role === 'PLAYER' &&
    deliveryMode === 'PROJECTOR_FIRST' &&
    (mediaType === 'VIDEO_UPLOAD' || mediaType === 'YOUTUBE' || mediaType === 'AUDIO') &&
    !playerOptedIn;

  if (isBandwidthProtected) {
    return (
      <div className="w-full max-w-xl mx-auto my-3 p-4 rounded-2xl bg-slate-900/90 border border-indigo-500/40 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shrink-0">
            {mediaType === 'AUDIO' ? <Music className="w-5 h-5" /> : <Film className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-sm font-bold text-indigo-200">
              Đang phát {mediaType === 'AUDIO' ? 'Âm thanh' : mediaType === 'YOUTUBE' ? 'Video YouTube' : 'Video HD'} trên màn hình chính
            </div>
            <div className="text-xs text-slate-400">
              Chế độ Lớp học tiết kiệm Wi-Fi. Nếu bạn ngồi xa màn chiếu, bấm nút bên cạnh để mở trên máy của bạn.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPlayerOptedIn(true)}
          className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 shadow"
        >
          <Play className="w-4 h-4" /> Mở trên máy tôi
        </button>
      </div>
    );
  }

  const fullUrl = resolveMediaUrl(mediaUrl);

  const replayFromStart = () => {
    if (mediaType === 'IMAGE' && imageReveal !== 'NONE') {
      setUncoveredCount(1);
      return;
    }
    const el = videoRef.current || audioRef.current;
    if (el) {
      el.currentTime = startTime > 0 ? startTime : 0;
      el.play().catch(() => {});
    }
  };

  const uncoveredSet = new Set(orderList.slice(0, uncoveredCount));

  return (
    <div className="w-full max-w-3xl mx-auto my-3">
      {mediaType === 'IMAGE' && (
        <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-900/80 shadow-xl flex justify-center">
          <img
            src={fullUrl}
            alt="Question illustration"
            className="max-h-72 sm:max-h-80 w-auto object-contain"
          />

          {/* Kahoot Image Reveal Grid Overlay */}
          {imageReveal !== 'NONE' && !revealComplete && (
            <div
              className={`absolute inset-0 grid ${
                imageReveal === 'GRID_5X5' ? 'grid-cols-5 grid-rows-5' : 'grid-cols-3 grid-rows-3'
              }`}
            >
              {Array.from({ length: totalTiles }).map((_, tileIdx) => {
                const isUncovered = uncoveredSet.has(tileIdx);
                return (
                  <div
                    key={tileIdx}
                    className={`border border-white/10 transition-all duration-500 flex items-center justify-center font-black text-xs text-white/30 ${
                      isUncovered
                        ? 'opacity-0 scale-75 pointer-events-none'
                        : 'opacity-100 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900'
                    }`}
                  >
                    ?
                  </div>
                );
              })}
            </div>
          )}

          <span className="absolute top-2 left-2 px-2.5 py-1 rounded-lg bg-slate-950/80 text-xs font-bold text-slate-300 flex items-center gap-1">
            {imageReveal !== 'NONE' ? (
              <>
                <Grid className="w-3.5 h-3.5 text-amber-400" /> Mở hình bí ẩn ({imageReveal === 'GRID_5X5' ? '5×5' : '3×3'})
              </>
            ) : (
              <>
                <ImageIcon className="w-3.5 h-3.5 text-emerald-400" /> Hình minh họa
              </>
            )}
          </span>

          {imageReveal !== 'NONE' && role === 'EDITOR' && (
            <button
              type="button"
              onClick={replayFromStart}
              className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-slate-950/90 hover:bg-slate-800 text-amber-300 text-xs font-bold flex items-center gap-1 border border-amber-400/40"
            >
              <RotateCcw className="w-3 h-3" /> Xem thử hiệu ứng mở ô
            </button>
          )}
        </div>
      )}

      {mediaType === 'AUDIO' && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/90 via-slate-900 to-purple-950/90 border border-indigo-500/40 shadow-xl flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-indigo-300 font-extrabold text-sm">
            <Volume2 className="w-5 h-5 animate-pulse text-amber-400" />
            <span>Câu hỏi Âm thanh {endTime > 0 ? `(${startTime}s – ${endTime}s)` : ''}</span>
          </div>
          <audio
            ref={audioRef}
            src={fullUrl}
            controls
            onEnded={onMediaEnded}
            className="w-full max-w-md"
          />
          <button
            type="button"
            onClick={replayFromStart}
            className="text-xs font-bold text-indigo-300 hover:text-white flex items-center gap-1 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Phát lại đoạn âm thanh
          </button>
        </div>
      )}

      {mediaType === 'VIDEO_UPLOAD' && (
        <div className="relative rounded-2xl overflow-hidden border border-indigo-500/40 bg-black shadow-2xl">
          <video
            ref={videoRef}
            src={fullUrl}
            controls
            playsInline
            onEnded={onMediaEnded}
            className="w-full max-h-80 object-contain mx-auto"
          />
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/95 border-t border-slate-800 text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-bold text-emerald-300">
              <Film className="w-4 h-4" /> Video HD Stream (≤100MB)
              {endTime > 0 ? ` • Đoạn: ${startTime}s → ${endTime}s` : ''}
            </span>
            <button
              type="button"
              onClick={replayFromStart}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Phát lại
            </button>
          </div>
        </div>
      )}

      {mediaType === 'YOUTUBE' && (
        <div className="rounded-2xl overflow-hidden border border-rose-500/40 bg-black shadow-2xl">
          {extractYouTubeEmbedUrl(mediaUrl, startTime, endTime, autoPlay) ? (
            <div className="aspect-video w-full max-h-80">
              <iframe
                src={extractYouTubeEmbedUrl(mediaUrl, startTime, endTime, autoPlay)!}
                title="YouTube Question Clip"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="p-6 text-center text-rose-300 text-sm">
              Link YouTube không hợp lệ: {mediaUrl}
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/95 border-t border-slate-800 text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-bold text-rose-400">
              <Youtube className="w-4 h-4" /> YouTube Embed
              {endTime > 0 || startTime > 0 ? ` • Đoạn phát: ${startTime || 0}s → ${endTime || 'Hết'}` : ''}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
