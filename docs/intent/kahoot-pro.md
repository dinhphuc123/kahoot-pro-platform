# Confirmed Statement of Intent: Kahoot-Style Multimedia & Educational Quiz Platform

- **Outcome:** Một nền tảng Web App Fullstack tổ chức thi đấu & ôn tập tương tác như Kahoot! phiên bản chuyên nghiệp (Pro Educational & Event Edition), hỗ trợ câu hỏi trắc nghiệm đa dạng (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `TRUE_FALSE`), công thức Toán học (`KaTeX`), đính kèm Âm thanh, Video tải lên (≤ 100MB, phát qua HTTP Range) và YouTube (cắt giây đầu/cuối `startTime`–`endTime`), chạy mượt cả ở chế độ **Phòng chiếu trực tiếp (Live Arena)** lẫn **Tự luyện tại nhà (Self-Paced Homework)** kèm **Báo cáo phân tích sau trận**.
- **User:**
  - **Host (Giáo viên / Diễn giả / Quản trò):** Quản lý bộ đề (kể cả công thức Toán & lời giải thích đáp án), nhập/xuất đề bằng Excel/CSV/JSON, điều phối phòng chơi (kick người chơi, khóa phòng PIN, gợi ý biệt danh vui, chọn chế độ phát media Lớp học hoặc Online, chọn nhịp đếm ngược), giảng giải đáp án sau mỗi câu và xuất sổ điểm Excel.
  - **Player (Học sinh / Người tham gia):** Quét QR hoặc nhập mã PIN 6 số + Tên vào chơi ngay trên điện thoại/máy tính mà không cần tạo tài khoản; nếu lỡ F5 hoặc rớt mạng tạm thời vẫn tự động kết nối lại (`Auto-Reconnect` qua `playerSessionToken`) giữ nguyên điểm và chuỗi Streak.
- **Why now:** Khắc phục 4 điểm yếu chí mạng của các bản clone Kahoot thông thường:
  1. Nghẽn mạng Wi-Fi khi 30–50 máy cùng tải video 100MB (giải quyết bằng công tắc **Chế độ Lớp học / Hội trường** vs **Chế độ Online từ xa**).
  2. Đồng hồ đếm ngược chạy mất giờ trong lúc người chơi còn đang xem video tình huống (giải quyết bằng chế độ **Xem Media trước → Đếm ngược trả lời sau** và **Vừa phát vừa đếm ngược ngay**).
  3. Học sinh rớt mạng hoặc F5 bị mất trắng điểm số (giải quyết bằng `playerSessionToken` lưu `localStorage`).
  4. Thiếu công cụ sư phạm: gõ công thức Toán `KaTeX`, khung Giải thích đáp án (`explanation`), chống nhìn bài (đảo câu/đảo đáp án, ẩn/hiện chữ đáp án trên máy con), lưu lịch sử trận đấu, thống kê **Top câu hỏi sai nhiều nhất (Hardest Questions)** và xuất điểm Excel/CSV.
- **Success:**
  1. Upload và tua/phát mượt Video ≤ 100MB (chặn file > 100MB), Audio và link YouTube (`startTime` – `endTime`).
  2. Chuyển đổi linh hoạt giữa **Chế độ Lớp học (Tiết kiệm băng thông Wi-Fi)** và **Chế độ Online (Đồng bộ media mọi máy)**; hỗ trợ cả 2 nhịp **"Xem Media xong mới đếm ngược"** và **"Vừa phát Media vừa đếm ngược ngay"**.
  3. Hiển thị đẹp công thức Toán `KaTeX`, hiện khung **Giải thích đáp án (Explanation)** sau khi khóa sổ câu hỏi, hỗ trợ đảo câu/đảo đáp án, và `Auto-Reconnect` giữ nguyên phiên làm bài của người chơi.
  4. Lưu lịch sử mọi trận đấu (Live & Tự luyện) vào SQLite, thống kê **Top câu hỏi sai nhiều nhất (Hardest Questions)** và xuất bảng điểm ra file **Excel/CSV**.
- **Constraint:** Stack **Node.js (Express + Socket.io) + React (Vite + Tailwind + Framer Motion + KaTeX) + SQLite**, lưu trữ file cục bộ trong `e:\03_Ghi_Chu_Ca_Nhan\TSH\kahoot-app`, giới hạn cứng 100MB/file media, chạy local chỉ với 1 lệnh.
- **Out of scope:** Không xây dựng hệ thống thanh toán/thu phí (Billing/Subscription), không tích hợp đăng nhập mạng xã hội phức tạp (OAuth Google/Facebook) cho học sinh, không làm trình biên tập cắt ghép/render hiệu ứng video trên server (chỉ cắt đoạn phát bằng `startTime`/`endTime`).
