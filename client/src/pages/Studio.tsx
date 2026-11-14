import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Play,
  Edit3,
  Trash2,
  Download,
  Upload,
  Copy,
  BookOpen,
  BarChart3,
  Home as HomeIcon,
  FileSpreadsheet,
  FileJson,
  Sparkles,
} from 'lucide-react';
import type { Quiz } from '../types.ts';
import { API_BASE } from '../utils/api.ts';

export const Studio: React.FC = () => {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const fetchQuizzes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/quizzes`);
      const data = await res.json();
      setQuizzes(Array.isArray(data) ? data : []);
    } catch {
      showToast('Không thể tải danh sách bộ đề.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuizzes();
  }, []);

  const handleCreateNew = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Bộ câu hỏi Đa phương tiện mới',
          description: 'Nhập mô tả cho bộ câu hỏi của bạn...',
          questions: [
            {
              type: 'SINGLE_CHOICE',
              text: 'Câu hỏi mẫu: Giá trị của biểu thức $2^3 + \\sqrt{16}$ bằng bao nhiêu?',
              explanation: 'Ta có $2^3 = 8$ và $\\sqrt{16} = 4$, suy ra $8 + 4 = 12$.',
              timeLimitSec: 20,
              pointsMultiplier: 1,
              mediaType: 'NONE',
              options: [
                { id: '1', text: '$12$', isCorrect: true, color: 'RED' },
                { id: '2', text: '$10$', isCorrect: false, color: 'BLUE' },
                { id: '3', text: '$14$', isCorrect: false, color: 'YELLOW' },
                { id: '4', text: '$8$', isCorrect: false, color: 'GREEN' },
              ],
            },
          ],
        }),
      });
      const created = await res.json();
      if (created?.id) {
        navigate(`/studio/${created.id}`);
      }
    } catch {
      showToast('Lỗi tạo bộ đề mới.');
    }
  };

  const handleDuplicate = async (quizId: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/quizzes/${quizId}/duplicate`, {
        method: 'POST',
      });
      if (res.ok) {
        showToast('Đã nhân bản bộ đề thành công!');
        fetchQuizzes();
      }
    } catch {
      showToast('Lỗi nhân bản bộ đề.');
    }
  };

  const handleDelete = async (quizId: string, title: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa bộ đề "${title}"?`)) return;
    try {
      await fetch(`${API_BASE}/api/quizzes/${quizId}`, { method: 'DELETE' });
      showToast('Đã xóa bộ đề.');
      fetchQuizzes();
    } catch {
      showToast('Lỗi xóa bộ đề.');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/quizzes/import-file`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Import thất bại');
      }
      showToast(`Đã nhập thành công bộ đề "${data.title}" (${data.questions?.length || 0} câu)!`);
      fetchQuizzes();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lỗi nhập file.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copySelfPacedLink = (quizId: string) => {
    const link = `${window.location.origin}/self-paced/${quizId}`;
    navigator.clipboard?.writeText(link);
    showToast(`Đã sao chép link Tự luyện: ${link}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
              title="Về trang chủ"
            >
              <HomeIcon className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-black flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                Quiz Studio — Quản Lý Bộ Câu Hỏi
              </h1>
              <p className="text-xs text-slate-400">
                Soạn câu hỏi Toán KaTeX, đính kèm Âm thanh, Video ≤ 100MB, YouTube hoặc Nhập/Xuất Excel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.json"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              type="button"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-bold flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4 text-amber-400" />
              <span>{importing ? 'Đang nhập...' : 'Nhập từ Excel / CSV / JSON'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/reports')}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-bold flex items-center gap-1.5"
            >
              <BarChart3 className="w-4 h-4 text-emerald-400" />
              <span>Báo cáo trận đấu</span>
            </button>

            <button
              type="button"
              onClick={handleCreateNew}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-black flex items-center gap-1.5 shadow-lg shadow-indigo-600/30"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Tạo Bộ Câu Hỏi Mới</span>
            </button>
          </div>
        </div>
      </header>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl bg-indigo-600 text-white font-bold text-sm shadow-2xl border border-indigo-400">
          {toast}
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 mt-8">
        {loading ? (
          <div className="text-center py-16 text-slate-400 font-bold">Đang tải danh sách bộ đề...</div>
        ) : quizzes.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/50 rounded-3xl border border-slate-800 p-8">
            <p className="text-lg font-bold text-slate-300">Chưa có bộ đề nào.</p>
            <button
              type="button"
              onClick={handleCreateNew}
              className="mt-4 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-black text-sm"
            >
              + Tạo bộ đề đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="rounded-3xl bg-slate-900/90 border border-slate-800 hover:border-indigo-500/50 p-6 flex flex-col justify-between gap-5 shadow-xl transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-xl font-black text-white leading-snug">{quiz.title}</h2>
                    <span className="px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-extrabold shrink-0">
                      {quiz.questionCount ?? quiz.questions?.length ?? 0} câu hỏi
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 mt-2 line-clamp-2">
                    {quiz.description || 'Không có mô tả.'}
                  </p>
                </div>

                <div className="space-y-3 pt-3 border-t border-slate-800/80">
                  {/* Primary Play Actions */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => navigate(`/host/${quiz.id}`)}
                      className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20"
                    >
                      <Play className="w-4 h-4 fill-current" /> Mở Phòng Live (PIN)
                    </button>

                    <button
                      type="button"
                      onClick={() => navigate(`/self-paced/${quiz.id}`)}
                      className="py-2.5 px-3 rounded-xl bg-indigo-600/90 hover:bg-indigo-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5"
                    >
                      <BookOpen className="w-4 h-4" /> Tự Luyện (Homework)
                    </button>
                  </div>

                  {/* Secondary Management Actions */}
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-bold">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => navigate(`/studio/${quiz.id}`)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-indigo-400" /> Sửa câu hỏi
                      </button>

                      <button
                        type="button"
                        onClick={() => copySelfPacedLink(quiz.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1"
                        title="Copy link giao bài về nhà"
                      >
                        <Copy className="w-3.5 h-3.5" /> Link bài tập
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(quiz.id)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="Nhân bản bộ đề"
                      >
                        Nhân bản
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={`${API_BASE}/api/quizzes/${quiz.id}/export?format=xlsx`}
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/50 text-emerald-300 flex items-center gap-1"
                        title="Tải bộ đề ra file Excel (.xlsx)"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
                      </a>
                      <a
                        href={`${API_BASE}/api/quizzes/${quiz.id}/export?format=json`}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 flex items-center gap-1"
                        title="Tải bộ đề ra file JSON"
                      >
                        <FileJson className="w-3.5 h-3.5" /> JSON
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDelete(quiz.id, quiz.title)}
                        className="p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 text-rose-300"
                        title="Xóa bộ đề"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
