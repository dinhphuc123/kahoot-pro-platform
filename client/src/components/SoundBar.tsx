import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, Music } from 'lucide-react';

// Web Audio API Synthesizer for zero-dependency Kahoot-style BGM and SFX
class SoundEngine {
  private ctx: AudioContext | null = null;
  public muted = false;
  public bgmEnabled = true;
  private bgmInterval: number | null = null;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playTone(freq: number, durationSec: number, type: OscillatorType = 'triangle', gainVal = 0.12, delaySec = 0) {
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + delaySec);

    gain.gain.setValueAtTime(0.001, ctx.currentTime + delaySec);
    gain.gain.exponentialRampToValueAtTime(gainVal, ctx.currentTime + delaySec + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delaySec + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime + delaySec);
    osc.stop(ctx.currentTime + delaySec + durationSec + 0.02);
  }

  public playJoinPop() {
    this.playTone(523.25, 0.12, 'sine', 0.15, 0);
    this.playTone(659.25, 0.16, 'sine', 0.15, 0.08);
  }

  public playCorrect() {
    this.playTone(523.25, 0.15, 'triangle', 0.18, 0);
    this.playTone(659.25, 0.15, 'triangle', 0.18, 0.1);
    this.playTone(783.99, 0.15, 'triangle', 0.18, 0.2);
    this.playTone(1046.5, 0.35, 'triangle', 0.22, 0.3);
  }

  public playWrong() {
    this.playTone(311.13, 0.22, 'sawtooth', 0.12, 0);
    this.playTone(233.08, 0.38, 'sawtooth', 0.14, 0.18);
  }

  public playPodiumFanfare() {
    const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const times = [0, 0.14, 0.28, 0.42, 0.62, 0.78];
    notes.forEach((n, idx) => {
      this.playTone(n, idx === notes.length - 1 ? 0.55 : 0.16, 'triangle', 0.2, times[idx]);
    });
  }

  public startBgm(mode: 'LOBBY' | 'COUNTDOWN') {
    this.stopBgm();
    if (this.muted || !this.bgmEnabled) return;

    const lobbyNotes = [261.63, 329.63, 392.0, 329.63, 293.66, 369.99, 440.0, 369.99];
    const countdownNotes = [330, 330, 392, 330, 440, 392, 330, 293.66];
    const pattern = mode === 'LOBBY' ? lobbyNotes : countdownNotes;
    const stepMs = mode === 'LOBBY' ? 380 : 260;

    let step = 0;
    this.bgmInterval = window.setInterval(() => {
      if (this.muted || !this.bgmEnabled) return;
      const freq = pattern[step % pattern.length];
      this.playTone(freq, 0.22, mode === 'LOBBY' ? 'sine' : 'triangle', 0.06, 0);
      step++;
    }, stepMs);
  }

  public stopBgm() {
    if (this.bgmInterval !== null) {
      clearInterval(this.bgmInterval);
      this.bgmInterval = null;
    }
  }
}

export const soundEngine = new SoundEngine();

interface SoundBarProps {
  bgmMode?: 'NONE' | 'LOBBY' | 'COUNTDOWN';
}

export const SoundBar: React.FC<SoundBarProps> = ({ bgmMode = 'NONE' }) => {
  const [muted, setMuted] = useState(soundEngine.muted);
  const [bgmOn, setBgmOn] = useState(soundEngine.bgmEnabled);
  const modeRef = useRef(bgmMode);
  modeRef.current = bgmMode;

  useEffect(() => {
    if (bgmMode === 'NONE' || muted || !bgmOn) {
      soundEngine.stopBgm();
    } else {
      soundEngine.startBgm(bgmMode);
    }
    return () => {
      soundEngine.stopBgm();
    };
  }, [bgmMode, muted, bgmOn]);

  const toggleMute = () => {
    const next = !muted;
    soundEngine.muted = next;
    setMuted(next);
  };

  const toggleBgm = () => {
    const next = !bgmOn;
    soundEngine.bgmEnabled = next;
    setBgmOn(next);
  };

  return (
    <div className="inline-flex items-center gap-2 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-xl text-xs font-bold">
      <button
        type="button"
        onClick={toggleMute}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition ${
          muted ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
        }`}
        title="Bật/Tắt Hiệu ứng âm thanh (SFX)"
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        <span>{muted ? 'Đã tắt tiếng' : 'SFX Bật'}</span>
      </button>

      <button
        type="button"
        onClick={toggleBgm}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition ${
          !bgmOn || muted ? 'bg-slate-800 text-slate-400' : 'bg-indigo-500/20 text-indigo-300'
        }`}
        title="Bật/Tắt Nhạc nền phòng chờ & đếm ngược"
      >
        <Music className="w-4 h-4" />
        <span>{bgmOn && !muted ? 'Nhạc nền: Bật' : 'Nhạc nền: Tắt'}</span>
      </button>
    </div>
  );
};
