# Capability Map: Kahoot-Style Multimedia & Educational Quiz Platform (`kahoot-app`)

| Module id | Responsibility | Depends on |
|---|---|---|
| `quiz-studio` | Quản lý bộ đề (Quiz CRUD), soạn câu hỏi (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `TRUE_FALSE`), công thức Toán học (`KaTeX`), khung Giải thích đáp án (`explanation`), tải lên & lưu trữ Media qua HTTP Range (Audio, Video ≤ 100MB, Hình ảnh), nhúng link YouTube (`startTime`–`endTime`), và Nhập/Xuất bộ câu hỏi (JSON, CSV/Excel). | — |
| `live-arena` | Phòng chơi trực tiếp thời gian thực (Socket.io), sinh mã PIN 6 số & QR Code, quản trị sảnh chờ (Kick, Lock PIN, Biệt danh vui), công tắc phân phối Media (**Lớp học tiết kiệm Wi-Fi** vs **Online đồng bộ**), 2 nhịp đếm ngược (**Xem Media trước → Đếm ngược sau** vs **Đếm ngược ngay**), chống nhìn bài (đảo câu/đảo đáp án/ẩn chữ), `Auto-Reconnect` qua `playerSessionToken`, tính điểm tốc độ + Streak bonus, giải thích sau câu hỏi, Leaderboard & Podium Top 3 kèm BGM/SFX. | `quiz-studio` |
| `self-paced-mode` | Chế độ tự luyện (Homework / Self-paced link) cho phép người chơi tự làm bài không cần Host điều khiển thời gian thực, xem media câu hỏi và lời giải thích trực tiếp trên thiết bị cá nhân, chấm điểm tức thì. | `quiz-studio` |
| `analytics-reporting` | Lưu trữ lịch sử toàn bộ trận đấu (Live & Tự luyện) vào SQLite, trang báo cáo phân tích sau trận (Bảng điểm từng người, tỷ lệ % đúng từng câu, Top câu hỏi sai nhiều nhất - Hardest Questions) và xuất bảng điểm chi tiết ra file Excel/CSV. | `quiz-studio`, `live-arena`, `self-paced-mode` |

Build order: `quiz-studio` → `live-arena`, `self-paced-mode` → `analytics-reporting`
