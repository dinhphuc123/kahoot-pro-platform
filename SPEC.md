# Spec: Kahoot-Style Multimedia & Educational Quiz Platform (`SPEC.md`)

> **Tài liệu Ý định Gốc (Confirmed Intent):** [docs/intent/kahoot-pro.md](file:///e:/03_Ghi_Chu_Ca_Nhan/TSH/kahoot-app/docs/intent/kahoot-pro.md)

## 1. Objective
Xây dựng nền tảng Web Fullstack tổ chức thi đấu và ôn tập tương tác thời gian thực theo phong cách **Kahoot! Pro (Educational & Event Edition)**, giải quyết 4 bài toán thực chiến trong lớp học/sự kiện:
1. **Đa phương tiện & Bảo vệ Băng thông Mạng (`quiz-studio` & `live-arena`):**
   - Hỗ trợ đính kèm **Âm thanh** (`.mp3`, `.wav`, `.ogg`, `.m4a`), **Video tải lên trực tiếp tối đa 100MB** (`.mp4`, `.webm`, `.mov` phát qua giao thức HTTP Range `206 Partial Content` giúp tua mượt mà), **Link YouTube** (hỗ trợ cắt đoạn `startTime` – `endTime`), và **Hình ảnh**.
   - **Công tắc Phân phối Media (Media Delivery Mode):**
     - `PROJECTOR_FIRST` (*Chế độ Lớp học / Hội trường* - Mặc định): Màn hình Host tự động phát Video 100MB/YouTube chất lượng cao; máy điện thoại người chơi chỉ hiện khung điều khiển nhẹ và nút *"Mở xem video trên máy tôi"* (On-demand) để tránh 40 máy tải cùng lúc làm sập Wi-Fi lớp học.
     - `SYNC_ALL_DEVICES` (*Chế độ Online từ xa*): Tự động phát đồng bộ Video/YouTube/Audio trên cả màn hình Host lẫn tất cả thiết bị người chơi.
2. **Nhịp độ Trò chơi Thông minh (Game Pacing Mode):**
   - `MEDIA_FIRST` (*Xem Media trước → Đếm ngược trả lời sau* - Mặc định): Hiển thị câu hỏi và phát đoạn Video/Audio (hoặc cho Host bấm "Bắt đầu tính giờ") rồi mới bung 4 ô đáp án và kích hoạt đồng hồ đếm ngược tính điểm.
   - `IMMEDIATE_COUNTDOWN` (*Vừa phát Media vừa đếm ngược ngay*): Mở 4 đáp án và chạy đồng hồ ngay từ giây đầu tiên (phù hợp trò chơi "Nghe nhạc đoán tên", "Đuổi hình bắt chữ").
3. **Vũ khí Sư phạm, Toán học, Chống gian lận & Độ bền Kết nối:**
   - **Công thức Toán học & Khoa học (`KaTeX`):** Tự động render ký hiệu LaTeX (`$...$` hoặc `$$...$$`) trong nội dung câu hỏi, 4 đáp án và phần giải thích.
   - **Giải thích đáp án (`explanation`):** Sau khi khóa sổ mỗi câu hỏi và hiện đáp án đúng, hiển thị khung *Giải thích chi tiết / Ghi chú bài học* để Giáo viên/Host phân tích.
   - **Chống nhìn bài (Anti-Cheat):** Tuỳ chọn đảo ngẫu nhiên thứ tự câu hỏi (`shuffleQuestions`), đảo vị trí 4 đáp án (`shuffleOptions`), và tuỳ chọn ẩn chữ đáp án trên màn hình điện thoại (chỉ hiện 4 hình khối màu sắc).
   - **Quản trị Sảnh chờ (Lobby Moderation):** Host có thể Kick người chơi đặt tên không hợp lệ, Khóa phòng (`Lock Room PIN`), hoặc bật gợi ý biệt danh vui nhộn.
   - **Tự động kết nối lại (`Auto-Reconnect`):** Cấp `playerSessionToken` lưu tại `localStorage`. Khi học sinh lỡ tay F5 hoặc rớt mạng tạm thời, tự động nối lại đúng phòng, giữ nguyên điểm số, chuỗi Streak và trạng thái câu hiện tại.
4. **Chế độ Tự luyện (`self-paced-mode`) & Báo cáo Phân tích Sau trận (`analytics-reporting`):**
   - Chia sẻ link Tự luyện (Homework Mode) để học sinh làm bài bất cứ lúc nào.
   - Lưu lịch sử toàn bộ các trận đấu (Live & Tự luyện) vào SQLite, thống kê **Top câu hỏi sai nhiều nhất (Hardest Questions)**, tỷ lệ % chính xác từng câu, bảng điểm từng người chơi và **Xuất báo cáo ra file Excel (`.xlsx`) / CSV**.

---

## 2. Tech Stack
- **Monorepo / Workspace:** Quản lý tại `e:\03_Ghi_Chu_Ca_Nhan\TSH\kahoot-app\` với `concurrently`.
- **Backend (`server/`):**
  - **Node.js (v18+)** + **TypeScript** (`tsx`) + **Express 4.x**
  - **Socket.io 4.x:** Quản lý phòng Live PIN, đồng bộ trạng thái câu hỏi/media/timer, `Auto-Reconnect` bằng `playerSessionToken`.
  - **SQLite (`better-sqlite3`):** Lưu trữ bền vững tại `server/data/kahoot.db` (bảng `quizzes`, `questions`, `game_sessions`, `session_players`, `player_answers`).
  - **Upload & Data Parsing:** `multer` (giới hạn cứng `100 * 1024 * 1024` bytes = 100MB), `xlsx` (Nhập/Xuất Excel & CSV cho cả Bộ câu hỏi và Bảng điểm báo cáo), `zod` (validation).
- **Frontend (`client/`):**
  - **React 18** + **TypeScript** + **Vite** + **React Router v6**
  - **UI & Hiệu ứng:** **Tailwind CSS**, **Framer Motion**, **Lucide React**, `canvas-confetti`, `qrcode.react`
  - **Toán học (`KaTeX`):** Render công thức toán học tức thì qua `katex`.
  - **Âm thanh (`Web Audio API` + HTML5 Audio):** Nhạc nền sảnh chờ (Lobby BGM), nhạc đếm ngược kịch tính (Suspense Timer BGM), SFX trả lời đúng/sai/lên hạng/Podium (có nút Bật/Tắt & chỉnh âm lượng).
- **Testing:**
  - **Vitest** + **Supertest** + `socket.io-client`

---

## 3. Commands
```bash
# Cài đặt toàn bộ dependencies
npm run install:all

# Chạy đồng thời Backend (port 3001) và Frontend (port 5173)
npm run dev

# Build bản Production cho Server & Client
npm run build

# Chạy toàn bộ Unit, API, Upload & Socket Integration Tests
npm test

# Kiểm tra lỗi kiểu dữ liệu TypeScript (Typecheck / Lint)
npm run lint
```

---

## 4. Project Structure
```text
e:\03_Ghi_Chu_Ca_Nhan\TSH\kahoot-app\
├── CAPABILITY-MAP.md          → Bản đồ phân rã 4 module năng lực
├── SPEC.md                    → Tài liệu đặc tả kỹ thuật tổng thể
├── docs/intent/kahoot-pro.md  → Tuyên bố ý định đã xác nhận qua /grill-me
├── tasks/
│   ├── plan.md                → Kế hoạch kiến trúc & lộ trình triển khai
│   └── todo.md                → Danh sách các Task chi tiết kèm tiêu chí kiểm thử
├── package.json               → Scripts điều phối chung
├── server/                    → Backend Express + Socket.io + SQLite
│   ├── data/                  → Chứa file SQLite (kahoot.db)
│   ├── uploads/               → Lưu trữ file Audio, Image và Video upload (≤ 100MB)
│   ├── src/
│   │   ├── index.ts           → Khởi tạo Express + HTTP Range Video Stream + Socket.io
│   │   ├── db/
│   │   │   ├── database.ts    → Khởi tạo bảng SQLite & truy vấn
│   │   │   └── seed.ts        → Bộ câu hỏi mẫu (Toán KaTeX + Âm thanh + YouTube + Video)
│   │   ├── routes/
│   │   │   ├── quizzes.ts     → CRUD bộ đề, câu hỏi, Import/Export bộ đề (JSON/Excel/CSV)
│   │   │   ├── media.ts       → Upload file ≤ 100MB (Multer) & HTTP Range streaming
│   │   │   ├── selfPaced.ts   → API làm bài tự luyện (Homework Mode)
│   │   │   └── reports.ts     → API lịch sử trận đấu, thống kê câu khó & Xuất bảng điểm Excel
│   │   ├── socket/
│   │   │   └── arenaManager.ts→ Quản lý phòng Live PIN, Auto-Reconnect, Pacing, Anti-Cheat, Moderation
│   │   └── services/
│   │       ├── scoring.ts     → Công thức tính điểm tốc độ + Streak bonus + chấm điểm đa lựa chọn
│   │       └── youtube.ts     → Bóc tách YouTube ID & chuẩn hóa tham số start/end
│   └── tests/                 → Bộ kiểm thử tự động (Vitest)
└── client/                    → Frontend React + Vite + Tailwind + KaTeX
    └── src/
        ├── components/
        │   ├── MathText.tsx       → Render văn bản kết hợp công thức Toán học KaTeX ($...$)
        │   ├── MediaStage.tsx     → Trình phát Video ≤100MB, Audio, Ảnh & YouTube (hỗ trợ Projector-First / Sync-All)
        │   ├── SoundBar.tsx       → Điều khiển nhạc nền BGM & hiệu ứng âm thanh SFX
        │   └── AnswerGrid.tsx     → 4 ô đáp án chuẩn Kahoot (Đỏ-Tam giác, Xanh-Thoi, Vàng-Tròn, Lá-Vuông)
        ├── pages/
        │   ├── Home.tsx           → Nhập mã PIN 6 số vào chơi + Nút vào Studio & Báo cáo
        │   ├── Studio.tsx         → Quản lý bộ đề, Nhập/Xuất Excel/JSON, Mở phòng Live hoặc Tự luyện
        │   ├── QuizEditor.tsx     → Soạn câu hỏi, gõ thử KaTeX, upload Video ≤100MB/Audio/YouTube, nhập Explanation
        │   ├── HostArena.tsx      → Màn hình Host (Lobby QR, Moderation, Media Stage, Pacing, Explanation, Leaderboard, Podium)
        │   ├── PlayerArena.tsx    → Màn hình Điện thoại người chơi (Auto-Reconnect, On-demand Media, Chọn đáp án, Xem Streak)
        │   ├── SelfPaced.tsx      → Làm bài tự luyện (Homework Mode) có giải thích chi tiết từng câu
        │   └── Reports.tsx        → Lịch sử trận đấu, Top câu hỏi sai nhiều nhất & Xuất bảng điểm Excel/CSV
        └── utils/
```

---

## 5. Code Style & Core Data Contracts

```typescript
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
export type MediaType = 'NONE' | 'IMAGE' | 'AUDIO' | 'VIDEO_UPLOAD' | 'YOUTUBE';
export type MediaDeliveryMode = 'PROJECTOR_FIRST' | 'SYNC_ALL_DEVICES';
export type GamePacingMode = 'MEDIA_FIRST' | 'IMMEDIATE_COUNTDOWN';

export interface RoomSettings {
  mediaDeliveryMode: MediaDeliveryMode; // Chế độ Lớp học (tiết kiệm Wi-Fi) vs Online
  pacingMode: GamePacingMode;           // Xem Media xong mới đếm ngược vs Đếm ngược ngay
  shuffleQuestions: boolean;            // Đảo thứ tự câu hỏi
  shuffleOptions: boolean;              // Đảo vị trí 4 đáp án
  showOptionTextOnPlayer: boolean;      // Hiện chữ đáp án trên điện thoại người chơi
  isLocked: boolean;                    // Khóa phòng không cho người lạ vào thêm
}

export interface Question {
  id: string;
  quizId: string;
  type: QuestionType;
  text: string;                         // Hỗ trợ cú pháp LaTeX $x^2 + 1$
  explanation?: string;                 // Giải thích đáp án hiện sau khi hết giờ (hỗ trợ LaTeX)
  timeLimitSec: number;                 // 5s - 240s
  pointsMultiplier: 1 | 2;              // Điểm chuẩn (1x) hoặc Nhân đôi (2x)
  mediaType: MediaType;
  mediaUrl?: string;
  mediaStartTime?: number;              // Giây bắt đầu (YouTube / Video / Audio)
  mediaEndTime?: number;                // Giây kết thúc
  options: Array<{
    id: string;
    text: string;                       // Hỗ trợ cú pháp LaTeX
    isCorrect: boolean;
    color: 'RED' | 'BLUE' | 'YELLOW' | 'GREEN';
  }>;
}
```

---

## 6. Testing Strategy
- **Unit Tests (`server/tests/scoring.test.ts`, `youtube.test.ts`):**
  - Kiểm chứng hàm `calculateScore` (tốc độ phản hồi ms, hệ số 1x/2x, Streak bonus +100 đến +500) và hàm ` evaluateAnswer` cho cả 3 loại câu hỏi (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `TRUE_FALSE`).
  - Kiểm chứng hàm phân tích mọi dạng link YouTube (`watch?v=`, `youtu.be/`, `shorts/`, `embed/`) kèm `startTime` và `endTime`.
- **API & Upload Tests (`server/tests/api.test.ts`):**
  - Kiểm chứng CRUD bộ đề, Import/Export JSON & Excel, lưu lịch sử trận đấu + thống kê câu hỏi khó nhất (`Hardest Questions`).
  - Kiểm chứng upload file hợp lệ ≤ 100MB, chặn file > 100MB (`413 Payload Too Large`), và phản hồi HTTP Range (`206 Partial Content`) khi stream video.
- **Realtime Socket & Reconnect Tests (`server/tests/socket.test.ts`):**
  - Kiểm chứng luồng: Host tạo phòng -> Player join nhận `playerSessionToken` -> Chuyển trạng thái `MEDIA_FIRST` sang `ANSWERING` -> Player rớt mạng và kết nối lại bằng `playerSessionToken` vẫn giữ nguyên điểm & Streak -> Kết thúc trận đấu tự động lưu báo cáo vào SQLite.

---

## 7. Boundaries
- **Always do:**
  - Giới hạn cứng kích thước file upload ở mức `100 * 1024 * 1024` bytes (100MB) trên cả Client và Server.
  - Phục vụ file Video/Audio upload qua HTTP Range requests (`Accept-Ranges: bytes`, `206 Partial Content`).
  - Loại bỏ trường `isCorrect` khỏi payload câu hỏi gửi xuống máy Player khi câu hỏi đang ở trạng thái đọc đề hoặc đếm ngược.
  - Tạo sẵn dữ liệu mẫu (Seed Quiz) có đủ câu hỏi Toán học (`KaTeX`), Âm thanh, YouTube và Giải thích đáp án để dùng thử ngay.
- **Ask first:**
  - Thay đổi schema xóa dữ liệu cũ hoặc tích hợp dịch vụ lưu trữ đám mây trả phí.
- **Never do:**
  - Không lưu nội dung nhị phân của Video/Audio vào trong bảng SQLite.
  - Không để việc người chơi F5 trình duyệt làm mất điểm số trong trận đấu đang diễn ra.

---

## 8. Success Criteria
1. **Soạn thảo & Đa phương tiện (`quiz-studio`):** Tạo/sửa/xóa câu hỏi (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `TRUE_FALSE`), hiển thị công thức Toán `KaTeX`, nhập lời giải thích (`explanation`), upload Audio & Video ≤ 100MB (chặn > 100MB), nhúng link YouTube có `startTime`/`endTime`, và Import/Export đề qua Excel/CSV/JSON.
2. **Phòng chơi Trực tiếp (`live-arena`):**
   - Tạo phòng Mã PIN 6 số + QR Code; quản trị phòng chờ (Kick người chơi, Khóa phòng, Gợi ý biệt danh).
   - Bật/tắt chế độ **Lớp học (Tiết kiệm Wi-Fi)** vs **Online (Đồng bộ mọi máy)**, và chế độ **Xem Media trước → Đếm ngược sau** vs **Đếm ngược ngay**.
   - Hỗ trợ đảo câu hỏi, đảo đáp án, `Auto-Reconnect` bằng `playerSessionToken`, hiển thị khung **Giải thích đáp án** sau mỗi câu, Bảng xếp hạng (Leaderboard) và Bục vinh danh Top 3 (Podium) kèm nhạc nền/SFX.
3. **Tự luyện & Báo cáo Phân tích (`self-paced-mode` & `analytics-reporting`):**
   - Chơi chế độ Tự luyện (Homework) không cần Host, xem giải thích từng câu.
   - Lưu lịch sử mọi trận đấu (Live & Tự luyện), hiển thị trang Phân tích chi tiết (Tỷ lệ đúng từng câu, **Top câu hỏi sai nhiều nhất**) và tải xuống bảng điểm file **Excel (`.xlsx`) / CSV**.
