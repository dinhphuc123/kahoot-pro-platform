import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Trophy,
  Trash2,
  ArrowLeft,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { API_BASE } from '../utils/api.ts';
import { MathText } from '../components/MathText.tsx';

interface SessionItem {
  id: string;
  quizId: string;
  quizTitle: string;
  mode: 'LIVE' | 'SELF_PACED';
  pin: string;
  startedAt: string;
  endedAt: string;
  totalQuestions: number;
  playerCount: number;
}

interface ReportDetail {
  id: string;
  quizTitle: string;
  mode: string;
  pin: string;
  endedAt: string;
  totalQuestions: number;
  players: Array<{
    id: string;
    nickname: string;
    score: number;
    correctCount: number;
    maxStreak: number;
    rank: number;
    accuracyPercent: number;
  }>;
  questionStats: Array<{
    questionId: string;
    questionText: string;
    totalAttempts: number;
    correctAttempts: number;
    accuracyPercent: number;
    avgResponseTimeSec: number;
  }>;
  hardestQuestions: Array<{
    questionId: string;
    questionText: string;
    totalAttempts: number;
    correctAttempts: number;
    accuracyPercent: number;
    avgResponseTimeSec: number;
  }>;
}

export const Reports: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/reports`);
      const list = await res.json();
      const arr = Array.isArray(list) ? list : [];
      setSessions(arr);

      const targetId = searchParams.get('session') || arr[0]?.id;
      if (targetId) {
        loadDetail(targetId);
      } else {
        setSelectedReport(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (sessionId: string) => {
    setSearchParams({ session: sessionId });
    const res = await fetch(`${API_BASE}/api/reports/${sessionId}`);
    if (res.ok) {
      const data = await res.json();
      setSelectedReport(data);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!window.confirm('Xóa báo cáo phiên chơi này?')) return;
    await fetch(`${API_BASE}/api/reports/${sessionId}`, { method: 'DELETE' });
    loadSessions();
  };

  useEffect(() => {
    loadSessions();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      <header className="border-b border-slate-800 bg-slate-900/90 px-4 py-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/studio')}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-black flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                Báo Cáo Trận Đấu & Phân Tích Sư Phạm (Post-Game Analytics)
              </h1>
              <p className="text-xs text-slate-400">
                Lưu trữ bảng điểm Live & Tự luyện, thống kê câu hỏi học sinh hay sai nhất và xuất sổ điểm Excel
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List of Sessions */}
        <aside className="lg:col-span-4 space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-wider text-slate-400 px-1">
            Lịch sử các trận đã tổ chức ({sessions.length})
          </div>

          {loading ? (
            <div className="p-6 text-center text-slate-400 text-sm font-bold">Đang tải...</div>
          ) : sessions.length === 0 ? (
            <div className="p-6 rounded-3xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
              Chưa có trận đấu nào hoàn tất. Hãy mở phòng Live hoặc làm thử bài Tự luyện!
            </div>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => loadDetail(s.id)}
                className={`cursor-pointer p-4 rounded-2xl border transition flex items-start justify-between gap-2 ${
                  selectedReport?.id === s.id
                    ? 'bg-indigo-600/20 border-indigo-500'
                    : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        s.mode === 'LIVE'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {s.mode === 'LIVE' ? `LIVE • PIN ${s.pin}` : 'TỰ LUYỆN'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(s.endedAt).toLocaleString('vi-VN')}
                    </span>
                  </div>
                  <div className="font-black text-sm text-white">{s.quizTitle}</div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" /> {s.playerCount} người chơi • {s.totalQuestions} câu
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(s.id);
                  }}
                  className="p-1.5 rounded-lg hover:bg-rose-900/50 text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </aside>

        {/* Right Detailed Report */}
        <section className="lg:col-span-8 space-y-6">
          {selectedReport ? (
            <>
              {/* Summary Header & Excel Export */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">{selectedReport.quizTitle}</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Hoàn thành lúc {new Date(selectedReport.endedAt).toLocaleString('vi-VN')} •{' '}
                    {selectedReport.players.length} người tham gia
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <a
                    href={`${API_BASE}/api/reports/${selectedReport.id}/export?format=xlsx`}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg"
                  >
                    <FileSpreadsheet className="w-4 h-4" /> Xuất Sổ Điểm Excel (.xlsx)
                  </a>
                  <a
                    href={`${API_BASE}/api/reports/${selectedReport.id}/export?format=csv`}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs sm:text-sm flex items-center gap-1.5"
                  >
                    <Download className="w-4 h-4" /> CSV
                  </a>
                </div>
              </div>

              {/* Hardest Questions Alert Box */}
              {selectedReport.hardestQuestions.length > 0 && (
                <div className="bg-rose-950/30 border border-rose-500/40 rounded-3xl p-6 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-rose-300">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    Top Câu Hỏi Nhiều Người Sai Nhất (Cần Giảng Kỹ Lại)
                  </div>

                  <div className="space-y-2.5">
                    {selectedReport.hardestQuestions.slice(0, 3).map((q, idx) => (
                      <div
                        key={q.questionId || idx}
                        className="p-4 rounded-2xl bg-slate-950/90 border border-rose-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="font-bold text-sm text-white">
                          <MathText text={q.questionText} />
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs font-black">
                          <span className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300">
                            Tỷ lệ đúng: {q.accuracyPercent}% ({q.correctAttempts}/{q.totalAttempts})
                          </span>
                          <span className="text-slate-400">TB: {q.avgResponseTimeSec}s</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Player Leaderboard Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
                <h3 className="text-base font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
                  <Trophy className="w-5 h-5" /> Bảng Điểm Chi Tiết Từng Người Chơi
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs uppercase text-slate-400">
                        <th className="py-2.5 px-3">Hạng</th>
                        <th className="py-2.5 px-3">Họ tên / Nickname</th>
                        <th className="py-2.5 px-3">Tổng điểm</th>
                        <th className="py-2.5 px-3">Số câu đúng</th>
                        <th className="py-2.5 px-3">Tỷ lệ đúng</th>
                        <th className="py-2.5 px-3">Streak tối đa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/70 font-bold">
                      {selectedReport.players.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-950/50">
                          <td className="py-3 px-3 text-amber-300 font-black">#{p.rank}</td>
                          <td className="py-3 px-3 text-white">{p.nickname}</td>
                          <td className="py-3 px-3 text-indigo-300 font-black">{p.score}</td>
                          <td className="py-3 px-3 text-emerald-300">
                            {p.correctCount} / {selectedReport.totalQuestions}
                          </td>
                          <td className="py-3 px-3">{p.accuracyPercent}%</td>
                          <td className="py-3 px-3 text-fuchsia-300">{p.maxStreak}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* All Question Accuracy Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-3">
                <h3 className="text-base font-black uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Thống Kê Độ Chính Xác Theo Từng Câu Hỏi
                </h3>
                <div className="space-y-2.5">
                  {selectedReport.questionStats.map((q, idx) => (
                    <div
                      key={q.questionId || idx}
                      className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2 text-xs sm:text-sm font-bold">
                        <span>
                          Câu {idx + 1}: <MathText text={q.questionText} />
                        </span>
                        <span className="text-emerald-300 shrink-0">
                          {q.accuracyPercent}% đúng ({q.correctAttempts}/{q.totalAttempts})
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full ${
                            q.accuracyPercent >= 70
                              ? 'bg-emerald-500'
                              : q.accuracyPercent >= 40
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                          style={{ width: `${q.accuracyPercent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 text-center text-slate-400 font-bold">
              Chọn một phiên chơi ở cột bên trái để xem báo cáo phân tích và tải file Excel.
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
