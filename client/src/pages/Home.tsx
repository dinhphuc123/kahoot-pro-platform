import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Gamepad2, Sparkles, BarChart3, Layers, Play, Volume2, Film, Calculator } from 'lucide-react';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pin, setPin] = useState(searchParams.get('pin') || '');
  const [nickname, setNickname] = useState('');

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.replace(/\D/g, '').slice(0, 6);
    if (!cleanPin) return;
    const params = new URLSearchParams({ pin: cleanPin });
    if (nickname.trim()) params.set('name', nickname.trim());
    navigate(`/play?${params.toString()}`);
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950 text-white">
      {/* Top Navbar */}
      <header className="w-full max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Gamepad2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight bg-gradient-to-r from-white via-indigo-200 to-fuchsia-300 bg-clip-text text-transparent">
              KAHOOT! PRO
            </span>
            <span className="ml-2 px-2 py-0.5 text-[10px] font-black uppercase rounded-md bg-indigo-500/30 border border-indigo-400/40 text-indigo-200">
              Multimedia & Math Edition
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/studio')}
            className="px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-sm font-bold flex items-center gap-2 transition"
          >
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>Quản lý Bộ đề (Studio)</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-sm font-bold flex items-center gap-2 transition"
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Báo cáo & Điểm Excel</span>
          </button>
        </div>
      </header>

      {/* Main Hero & PIN Box */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-indigo-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="text-center mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-extrabold mb-2">
              <Sparkles className="w-3.5 h-3.5" /> Tham gia trực tiếp bằng Mã PIN
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Nhập Mã Phòng Chơi
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Không cần tạo tài khoản • Hỗ trợ tự động kết nối lại khi F5
            </p>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-1.5">
                Mã PIN Phòng (6 chữ số)
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="VD: 123456"
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-950 border-2 border-slate-700 focus:border-indigo-500 focus:outline-none text-center text-2xl font-black tracking-[0.25em] text-amber-300 placeholder:text-slate-600 placeholder:tracking-normal"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-1.5">
                Biệt danh của bạn (Để trống sẽ tự tạo tên vui)
              </label>
              <input
                type="text"
                maxLength={28}
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nhập tên hoặc biệt danh..."
                className="w-full px-4 py-3 rounded-2xl bg-slate-950 border border-slate-700 focus:border-indigo-500 focus:outline-none text-center text-base font-bold text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 text-white font-black text-lg flex items-center justify-center gap-2 kahoot-shadow transition"
            >
              <Play className="w-5 h-5 fill-current" /> VÀO ĐẤU TRƯỜNG NGAY
            </button>
          </form>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl w-full mt-10">
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <Film className="w-6 h-6 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold text-sm">Video ≤ 100MB & YouTube</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Streaming HTTP Range mượt mà, cắt đoạn giây bắt đầu/kết thúc, chế độ tiết kiệm Wi-Fi lớp học.
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <Volume2 className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold text-sm">Âm thanh & Nhịp Đếm Ngược</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Đính kèm MP3/WAV vào câu hỏi, tuỳ chọn nghe/xem xong mới bắt đầu đếm ngược tính điểm.
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-3">
            <Calculator className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-extrabold text-sm">Toán KaTeX & Xuất Điểm Excel</div>
              <div className="text-xs text-slate-400 mt-0.5">
                Hiển thị công thức Toán học sắc nét, giải thích đáp án sau mỗi câu và thống kê câu hỏi khó nhất.
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-xs text-slate-500">
        Kahoot! Pro Fullstack Platform • Live Arena, Self-Paced Homework & Analytics
      </footer>
    </div>
  );
};
