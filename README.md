# Kahoot! Pro — Multimedia, Math & Preschool Edition

Nền tảng Web App Fullstack tạo và tổ chức trò chơi đố vui tương tác thời gian thực theo phong cách **Kahoot! Creator (`create.kahoot.it`)**, tích hợp chuyên sâu cho cả **Giáo viên Phổ thông / Toán học (KaTeX)** lẫn **Giáo viên Mầm non (Preschool 3–6 tuổi)**.

## Tính năng nổi bật

1. **Đa phương tiện mạnh mẽ (`Quiz Studio` 3 cột chuẩn `create.kahoot.it`):**
   - Hỗ trợ 6 loại câu hỏi & trang trình chiếu: `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `TRUE_FALSE`, `TYPE_ANSWER` (Điền đáp án ngắn), `POLL` (Khảo sát 0 điểm), và `SLIDE` (Trang bài giảng).
   - Đính kèm **Âm thanh (MP3/WAV/OGG)**, **Thu âm trực tiếp giọng Cô giáo bằng Micro**, **Video tải lên trực tiếp ≤ 100MB** (streaming qua HTTP Range `206 Partial Content`), **Link YouTube** (chọn giây bắt đầu/kết thúc), và **Hình ảnh** (hỗ trợ hiệu ứng **Mở ảnh bí ẩn `Image Reveal` 3×3 & 5×5**).
   - Tích hợp **Toán học `KaTeX`** (`$...$`), khung **Giải thích đáp án (`explanation`)**, **Kho Chủ đề (`Visual Themes`)**, **Dán nhanh đề thi (`Quick Paste`)**, và **Nhập/Xuất Excel (`.xlsx`) / CSV / JSON**.
2. **Chế độ Mầm Non Chuyên Nghiệp (`Preschool Mode`):**
   - **Kho Sticker Mầm Non 1-click** gắn trực tiếp lên 4 ô đáp án + **Đọc câu hỏi & đáp án tự động bằng Giọng Tiếng Việt (TTS)** cho trẻ chưa biết đọc chữ.
   - **Màn hình Tivi Tương tác 1-Chạm tại lớp:** Chia 4 Đội Con Vật (*🐰 Thỏ Trắng, 🐻 Gấu Nâu, 🐱 Mèo Con, 🐶 Cún Cưng*), tích hợp **Vòng Quay Kỳ Diệu** gọi đội lên chạm trực tiếp trên Tivi và thưởng Sao vàng kèm lời khen.
   - **Vào phòng 1-chạm bằng Hình Avatar Con Vật** và chế độ **Tâm lý Mầm non (Không áp lực thời gian, cho phép bé thử chọn lại nếu nhầm)**.
3. **Phòng Chơi Trực Tiếp (`Live Arena`) & Tự Luyện (`Self-Paced`) + Báo Cáo Phân Tích (`Reports`):**
   - Mở phòng với **Mã PIN 6 số + QR Code**, công tắc bảo vệ băng thông Wi-Fi lớp học (`PROJECTOR_FIRST` vs `SYNC_ALL_DEVICES`), 2 nhịp đếm ngược (`MEDIA_FIRST` vs `IMMEDIATE_COUNTDOWN`), và `Auto-Reconnect` giữ nguyên điểm khi F5.
   - Lưu lịch sử mọi trận đấu vào SQLite, thống kê **Top câu hỏi nhiều người sai nhất (`Hardest Questions`)** và xuất sổ điểm ra file **Excel (`.xlsx`) / CSV**.

## Khởi chạy nhanh

```bash
npm run install:all
npm run dev
```

- **Frontend Web App:** http://localhost:5173
- **Backend API & Socket.io Server:** http://localhost:3001
