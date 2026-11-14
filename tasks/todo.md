# Task Breakdown (`tasks/todo.md`)

> Kế hoạch chi tiết xem tại: [tasks/plan.md](file:///e:/03_Ghi_Chu_Ca_Nhan/TSH/kahoot-app/tasks/plan.md)  
> Tài liệu đặc tả xem tại: [SPEC.md](file:///e:/03_Ghi_Chu_Ca_Nhan/TSH/kahoot-app/SPEC.md)

---

## Phase 1: Foundation & Media/Quiz Core (`quiz-studio` Backend)

### Task 1: Khởi tạo Monorepo, SQLite Schema & Dữ liệu mẫu (Seed Data)
- [x] **Task 1: Project Scaffolding, Database Schema & Seed Quiz**
  - **Acceptance criteria:**
    - [x] Chạy khởi tạo DB tự động tạo file `server/data/kahoot.db` và nạp bộ đề mẫu nếu DB trống.
    - [x] Schema hỗ trợ lưu đầy đủ `explanation`, `mediaType`, `mediaUrl`, `mediaStartTime`, `mediaEndTime` và lịch sử phiên chơi.
  - **Verification:**
    - [x] Build/Typecheck server: `npm --prefix server run build`
    - [x] Kiểm tra tạo bảng và seed data qua `tests/db.test.ts`.

### Task 2: Core Domain Services (Scoring, YouTube Parser & Media Upload ≤ 100MB + HTTP Range)
- [x] **Task 2: Scoring Engine, YouTube Parser & Media Streaming API (≤ 100MB)**
  - **Acceptance criteria:**
    - [x] Hàm `calculateScore` và `evaluateAnswer` tính chính xác điểm tốc độ, Streak bonus và đáp án đa lựa chọn.
    - [x] Hàm `parseYouTubeUrl` trích xuất đúng `videoId` 11 ký tự từ mọi dạng URL YouTube.
    - [x] Upload file Audio/Image/Video ≤ 100MB thành công; file > 100MB bị chặn ngay với mã lỗi `413 Payload Too Large`; stream video trả về `206 Partial Content` khi có header `Range`.
  - **Verification:**
    - [x] Tests pass: `tests/scoring.test.ts` & `tests/media.test.ts`.

### Task 3: Quiz Studio REST API & Nhập/Xuất đề (Excel / CSV / JSON)
- [x] **Task 3: Quiz CRUD API & Excel/CSV/JSON Import-Export**
  - **Acceptance criteria:**
    - [x] CRUD bộ đề và danh sách câu hỏi hoạt động đầy đủ, lưu/đọc chính xác các trường `options`, `explanation` và `media`.
    - [x] Export bộ đề ra JSON và Excel (`.xlsx`) tải về hợp lệ; Import file JSON/Excel/CSV tạo mới bộ đề với đầy đủ câu hỏi và đáp án.
  - **Verification:**
    - [x] Tests pass: `tests/quizzes.test.ts`.

### Checkpoint 1: After Tasks 1–3 (Backend Core & Media)
- [x] Tất cả Unit & API tests ở `server/` chạy PASS (`npm --prefix server test`).
- [x] Upload Video ≤ 100MB, chặn file > 100MB, HTTP Range stream và Import/Export Excel/JSON hoạt động trơn tru.

---

## Phase 2: Shared UI & Quiz Studio Frontend (`quiz-studio` UI)

### Task 4: Bộ Component Nền tảng (`MathText`, `MediaStage`, `SoundBar`, `AnswerGrid`)
- [x] **Task 4: Frontend Shared Components (KaTeX, Multimedia Stage, Web Audio BGM/SFX, Kahoot Shapes)**
  - **Acceptance criteria:**
    - [x] Công thức Toán học hiển thị sắc nét bằng KaTeX (`MathText.tsx`).
    - [x] `MediaStage.tsx` phát đúng khoảng `[startTime, endTime]` và hiển thị nút tải theo yêu cầu khi ở chế độ `PROJECTOR_FIRST` trên máy người chơi.
  - **Verification:**
    - [x] Build client: `npm --prefix client run build`

### Task 5: Giao diện Trang chủ (`Home.tsx`), Quản lý Bộ đề (`Studio.tsx`) & Trình soạn thảo (`QuizEditor.tsx`)
- [x] **Task 5: Home, Quiz Studio Dashboard & Multimedia Question Editor UI**
  - **Acceptance criteria:**
    - [x] Cảnh báo ngay trên giao diện nếu người dùng chọn file Video/Audio vượt quá `100MB`.
    - [x] Xem trước (Live Preview) được câu hỏi, công thức Toán `KaTeX`, đoạn cắt YouTube và Video/Audio vừa tải lên ngay trong trình soạn thảo.
    - [x] Nút Import/Export Excel & JSON hoạt động trực tiếp trên giao diện.
  - **Verification:**
    - [x] Build client thành công không lỗi TypeScript: `npm --prefix client run build`

### Checkpoint 2: After Tasks 4–5 (Quiz Studio End-to-End)
- [x] Frontend + Backend chạy kết nối thành công; tạo/chỉnh sửa câu hỏi có Toán `KaTeX`, Audio, Video ≤100MB, YouTube và Import/Export Excel hoạt động hoàn chỉnh.

---

## Phase 3: Live Arena Realtime Engine & UI (`live-arena`)

### Task 6: Socket.io Live Arena Engine (`arenaManager.ts`) & Realtime Tests
- [x] **Task 6: Socket.io Room State Machine, Pacing Modes, Anti-Cheat & Auto-Reconnect**
  - **Acceptance criteria:**
    - [x] Không bao giờ gửi trường `isCorrect` xuống máy Player khi ở trạng thái `QUESTION_PREVIEW` hoặc `QUESTION_ACTIVE`.
    - [x] Khi ở chế độ `MEDIA_FIRST`, điểm tốc độ chỉ tính từ thời điểm chuyển sang `QUESTION_ACTIVE`.
    - [x] Người chơi kết nối lại bằng `playerSessionToken` giữ nguyên 100% điểm số, chuỗi Streak và trạng thái đã trả lời.
  - **Verification:**
    - [x] Tests pass: `tests/socket.test.ts`

### Task 7: Giao diện Phòng chiếu Host (`HostArena.tsx`) & Máy Người chơi (`PlayerArena.tsx`)
- [x] **Task 7: Live Host Projector Screen & Mobile Player Controller UI**
  - **Acceptance criteria:**
    - [x] Host và nhiều tab/điện thoại Player chơi trọn vẹn từ Lobby đến Podium không lỗi đồng bộ.
    - [x] F5 trang `PlayerArena` giữa trận đấu tự động vào lại đúng câu hỏi hiện tại với nguyên vẹn điểm số.
  - **Verification:**
    - [x] Build client: `npm --prefix client run build`

### Checkpoint 3: After Tasks 6–7 (Live Arena Complete)
- [x] Toàn bộ kiểm thử Socket.io chạy PASS; luồng chơi Live nhiều người hoạt động đầy đủ cả 2 chế độ Media, 2 nhịp đếm ngược, có giải thích đáp án và Auto-Reconnect.

---

## Phase 4: Self-Paced Mode & Post-Game Analytics (`self-paced-mode` & `analytics-reporting`)

### Task 8: Chế độ Tự luyện (`SelfPaced`) & Báo cáo Phân tích + Xuất Excel (`Reports`)
- [x] **Task 8: Self-Paced Homework Mode & Post-Game Analytics + Excel Export**
  - **Acceptance criteria:**
    - [x] Hoàn thành bài Tự luyện lưu đầy đủ điểm và chi tiết từng câu trả lời vào SQLite.
    - [x] Trang Báo cáo tính đúng tỷ lệ % chính xác của từng câu, chỉ ra các câu hỏi có tỷ lệ đúng thấp nhất (`Hardest Questions`), và tải xuống được file `.xlsx` / `.csv` bảng điểm người chơi.
  - **Verification:**
    - [x] Tests pass: `npm test` (14/14 tests PASS)
    - [x] Full build pass: `npm run build`

### Checkpoint 4: Final Release Readiness
- [x] Tất cả Unit, API & Socket Integration Tests chạy PASS (`npm test`).
- [x] Cả `server` và `client` build sạch sẽ (`npm run build`).
- [x] Đáp ứng 100% Success Criteria trong `SPEC.md`.
