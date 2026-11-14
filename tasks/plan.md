# Implementation Plan: Kahoot-Style Multimedia & Educational Quiz Platform (`kahoot-app`)

## 1. Overview
Xây dựng ứng dụng Web Fullstack đố vui tương tác đa phương tiện theo phong cách **Kahoot! Pro (Educational & Event Edition)** trong thư mục `e:\03_Ghi_Chu_Ca_Nhan\TSH\kahoot-app\`. Hệ thống bao gồm 4 phân hệ tích hợp chặt chẽ:
1. **`quiz-studio`:** Quản lý bộ đề, câu hỏi (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `TRUE_FALSE`), hiển thị công thức Toán `KaTeX`, lời giải thích đáp án (`explanation`), tải lên Audio / Hình ảnh / Video ≤ 100MB (phát qua HTTP Range `206 Partial Content`), nhúng link YouTube (`startTime`–`endTime`), và Nhập/Xuất đề qua Excel/CSV/JSON.
2. **`live-arena`:** Phòng thi đấu thời gian thực (Socket.io) với Mã PIN 6 số + QR Code, quản trị sảnh chờ (Kick, Lock PIN, Biệt danh vui), công tắc phân phối Media (**Lớp học tiết kiệm Wi-Fi** vs **Online đồng bộ mọi máy**), 2 nhịp đếm ngược (**Xem Media trước → Đếm ngược sau** vs **Đếm ngược ngay**), chống nhìn bài (đảo câu/đảo đáp án/ẩn chữ), `Auto-Reconnect` qua `playerSessionToken`, tính điểm theo tốc độ + Streak bonus, khung giải thích sau mỗi câu, Leaderboard, Podium Top 3 và nhạc nền/SFX.
3. **`self-paced-mode`:** Chế độ tự luyện (Homework Mode) cho phép học sinh tự làm bài, xem media và lời giải thích trực tiếp trên thiết bị cá nhân, chấm điểm tức thì.
4. **`analytics-reporting`:** Lưu trữ toàn bộ lịch sử trận đấu (Live & Tự luyện) vào SQLite, thống kê **Top câu hỏi sai nhiều nhất (Hardest Questions)**, tỷ lệ đúng từng câu và Xuất bảng điểm ra file Excel (`.xlsx`) / CSV.

---

## 2. Architecture Decisions & Dependency Graph

### Dependency Graph
```text
[Task 1: Project Scaffolding & SQLite Schema + Seed Data]
   │
   ├──► [Task 2: Core Domain Services (Scoring, YouTube Parser, Media Upload <=100MB & HTTP Range)]
   │       │
   │       ├──► [Task 3: Quiz Studio Backend API & Excel/CSV/JSON Import-Export]
   │       │       │
   │       │       ├──► [Task 4: Frontend Shared Components (KaTeX MathText, MediaStage, SoundBar, AnswerGrid)]
   │       │       │       │
   │       │       │       └──► [Task 5: Quiz Studio & Question Editor UI (Upload <=100MB, YouTube, KaTeX, Import/Export)]
   │       │       │
   │       │       └──► [Task 6: Live Arena Socket.io Engine (PIN, Pacing, Projector/Sync Mode, Auto-Reconnect, Anti-Cheat)]
   │       │               │
   │       │               └──► [Task 7: Live Host Arena & Mobile Player Arena UI (QR Lobby, Pacing, Explanation, Podium)]
   │       │
   │       └──► [Task 8: Self-Paced Homework Mode & Post-Game Analytics + Excel Report Export (API & UI)]
```

### Key Architectural Decisions
1. **HTTP Range Video Streaming (`206 Partial Content`) cho Video ≤ 100MB:**
   - Thay vì dùng static middleware mặc định hay tải nguyên cục file vào RAM, endpoint `/api/media/stream/:filename` đọc header `Range: bytes=start-end` và dùng `fs.createReadStream(filePath, { start, end })`. Điều này giúp video 100MB phát tức thì và tua (seek) đến `startTime` mượt mà.
2. **Cơ chế 2 Pha cho Nhịp độ Câu hỏi (`MEDIA_FIRST` vs `IMMEDIATE_COUNTDOWN`):**
   - Trong `arenaManager.ts`, mỗi câu hỏi có máy trạng thái (State Machine) rõ ràng:
     - Nếu `pacingMode === 'MEDIA_FIRST'` và câu hỏi có Media: vào trạng thái `QUESTION_PREVIEW` (hiển thị câu hỏi + phát Media, chưa mở khóa chấm điểm và chưa trừ giờ trả lời). Khi hết thời lượng đoạn Media (hoặc khi Host bấm nút *"Bắt đầu đếm ngược"*), phòng chuyển sang `QUESTION_ACTIVE`, ghi nhận mốc `answeringStartedAt = Date.now()`, mở 4 đáp án trên máy Player và đếm ngược `timeLimitSec`.
     - Nếu `pacingMode === 'IMMEDIATE_COUNTDOWN'` (hoặc câu hỏi không có Media): sau 3 giây chuyển cảnh, vào thẳng `QUESTION_ACTIVE`.
3. **Bảo vệ Băng thông Wi-Fi Lớp học (`PROJECTOR_FIRST` vs `SYNC_ALL_DEVICES`):**
   - Khi `mediaDeliveryMode === 'PROJECTOR_FIRST'`, màn hình Host tự động tải và phát Video/YouTube/Audio. Trên máy điện thoại người chơi, component `MediaStage` chỉ hiển thị thông báo *"Đang phát Media trên màn hình chính"* kèm nút **"Bấm để xem/nghe trên máy này"** (chỉ tải luồng video khi học sinh chủ động bấm vì ngồi xa màn chiếu).
   - Khi `mediaDeliveryMode === 'SYNC_ALL_DEVICES'`, cả Host và tất cả máy Player đều tự động tải và phát đồng bộ theo mốc thời gian của phòng.
4. **Độ bền Kết nối Di động (`Auto-Reconnect` qua `playerSessionToken`):**
   - Khi Player tham gia phòng bằng `PIN + Nickname`, server sinh một mã `playerSessionToken` (UUID) trả về cho Client lưu vào `localStorage`. Nếu điện thoại tắt màn hình hoặc F5, Client gửi sự kiện `player:reconnect { pin, token }`. Server khôi phục lại `socket.id` mới vào đúng bản ghi người chơi cũ (giữ nguyên điểm số, chuỗi Streak, thứ hạng và câu hỏi đã trả lời).
5. **Lưu trữ Lịch sử & Báo cáo Phân tích (`analytics-reporting`):**
   - Khi trận đấu Live kết thúc (hoặc khi 1 lượt làm bài Self-paced hoàn tất), toàn bộ kết quả được ghi vào 3 bảng SQLite: `game_sessions`, `session_players`, và `player_answers`. Từ đó dễ dàng truy vấn **Top câu hỏi sai nhiều nhất (`Hardest Questions`)** và xuất bảng điểm chi tiết ra file `.xlsx` / `.csv`.

---

## 3. Implementation Phases & Checkpoints

### Phase 1: Foundation & Media/Quiz Core (`quiz-studio` Backend)
- [ ] **Task 1:** Khởi tạo cấu trúc Monorepo (`server/` + `client/`), cấu hình SQLite (`better-sqlite3`) với đầy đủ bảng (`quizzes`, `questions`, `game_sessions`, `session_players`, `player_answers`) và tạo dữ liệu mẫu (Seed Quiz có câu hỏi Toán `KaTeX`, Audio, YouTube, Giải thích).
- [ ] **Task 2:** Xây dựng bộ Core Services & Media API: Công thức tính điểm `scoring.ts` (Tốc độ + Streak + Multi-choice), bộ phân tích link `youtube.ts` (`startTime`–`endTime`), và API Upload/Stream Media `media.ts` (Multer giới hạn cứng 100MB + HTTP Range `206 Partial Content` + Unit Tests).
- [ ] **Task 3:** Xây dựng REST API Quản lý Bộ đề (`quizzes.ts`): CRUD bộ đề & câu hỏi, xác thực Host Passcode đơn giản, và tính năng **Import / Export bộ câu hỏi** qua file JSON, CSV và Excel (`.xlsx`) kèm API Tests.

#### Checkpoint 1: Backend Core & Media Verification
- [ ] Toàn bộ Unit Tests và API Tests cho Scoring, YouTube Parser, Media Upload (≤100MB & chặn >100MB), HTTP Range Stream và Quiz Import/Export chạy PASS (`npm test`).

### Phase 2: Shared UI & Quiz Studio Frontend (`quiz-studio` UI)
- [ ] **Task 4:** Xây dựng bộ Component nền tảng trên Frontend (`client/`):
  - `MathText.tsx`: Tự động nhận diện và render công thức Toán học LaTeX (`$...$`, `$$...$$`) bằng `KaTeX`.
  - `MediaStage.tsx`: Trình phát đa phương tiện hợp nhất (Video upload ≤100MB, Audio có sóng âm, YouTube IFrame cắt đoạn `startTime`–`endTime`, Hình ảnh) hỗ trợ cả chế độ `PROJECTOR_FIRST` và `SYNC_ALL_DEVICES`.
  - `SoundBar.tsx`: Bộ tổng hợp nhạc nền sảnh chờ (Lobby BGM), nhạc đếm ngược kịch tính và hiệu ứng âm thanh (SFX đúng/sai/lên hạng/vỗ tay) bằng Web Audio API + tuỳ chọn tắt/mở.
  - `AnswerGrid.tsx`: 4 ô đáp án chuẩn Kahoot (Đỏ-Tam giác, Xanh dương-Thoi, Vàng-Tròn, Xanh lá-Vuông) hỗ trợ chọn 1 hoặc chọn nhiều đáp án và render `KaTeX`.
- [ ] **Task 5:** Xây dựng giao diện **Trang chủ (`Home.tsx`)**, **Quản lý Bộ đề (`Studio.tsx`)** và **Trình soạn thảo Câu hỏi (`QuizEditor.tsx`)**:
  - Tạo/sửa câu hỏi trực quan, gõ và xem trước công thức Toán `KaTeX` + lời giải thích (`explanation`).
  - Upload Video ≤100MB / Audio / Ảnh kèm thanh tiến trình (%) và kiểm tra dung lượng ngay tại trình duyệt; dán link YouTube chọn giây bắt đầu/kết thúc.
  - Nhập/Xuất bộ đề bằng file Excel/CSV/JSON chỉ với 1 cú nhấp chuột.

#### Checkpoint 2: Studio End-to-End Verification
- [ ] Frontend build thành công không lỗi TypeScript; tạo/sửa được câu hỏi có công thức Toán, upload thử media và preview mượt mà.

### Phase 3: Live Arena Realtime Engine & UI (`live-arena`)
- [ ] **Task 6:** Xây dựng Socket.io Realtime Engine (`server/src/socket/arenaManager.ts`) & Socket Tests:
  - Tạo phòng với Mã PIN 6 số, cấu hình phòng (`RoomSettings`: `PROJECTOR_FIRST`/`SYNC_ALL_DEVICES`, `MEDIA_FIRST`/`IMMEDIATE_COUNTDOWN`, đảo câu hỏi, đảo đáp án, ẩn chữ trên máy người chơi).
  - Quản trị sảnh chờ (Kick người chơi, Khóa phòng PIN, Gợi ý biệt danh).
  - Máy trạng thái câu hỏi (`LOBBY` → `QUESTION_PREVIEW` → `QUESTION_ACTIVE` → `QUESTION_REVEAL` → `LEADERBOARD` → `PODIUM`), chống lộ đáp án đúng khi đang đếm ngược, và cơ chế `Auto-Reconnect` qua `playerSessionToken`.
- [ ] **Task 7:** Xây dựng giao diện **Màn hình Trình chiếu của Host (`HostArena.tsx`)** và **Màn hình Điện thoại Người chơi (`PlayerArena.tsx`)**:
  - Màn hình Host: Sảnh chờ hiển thị Mã PIN khổng lồ + **QR Code tự động**, danh sách người chơi (có nút Kick/Khóa phòng), bảng công tắc cấu hình nhanh, trình chiếu câu hỏi + Media + Đồng hồ đếm ngược, biểu đồ cột thống kê đáp án, khung **Giải thích đáp án (`explanation`)**, Bảng xếp hạng chuyển động và **Bục vinh danh Top 3 (Podium)** bắn pháo giấy.
  - Màn hình Player: Tự động nhận PIN khi quét QR, tự động lưu & khôi phục phiên bằng `playerSessionToken` khi F5, nút mở xem Media theo yêu cầu (khi ở chế độ Lớp học), 4 nút bấm đáp án lớn nhạy trên cảm ứng, màn hình báo Đúng/Sai + Điểm tốc độ + Chuỗi Streak lửa cháy.

#### Checkpoint 3: Live Arena Verification
- [ ] Kiểm thử tự động luồng Socket.io (Join, Reconnect, Pacing, Scoring, Anti-Cheat) chạy PASS; giao diện Host và Player đồng bộ mượt mà.

### Phase 4: Self-Paced Mode & Post-Game Analytics (`self-paced-mode` & `analytics-reporting`)
- [ ] **Task 8:** Xây dựng **Chế độ Tự luyện (`SelfPaced.tsx` + `selfPaced.ts`)** và **Hệ thống Báo cáo Phân tích & Xuất Excel (`Reports.tsx` + `reports.ts`)**:
  - Chế độ Tự luyện: Người chơi mở link `/self-paced/:quizId`, nhập tên, tự làm qua từng câu hỏi (xem Media và đọc Giải thích ngay sau mỗi câu), lưu điểm vào bảng xếp hạng tự luyện.
  - Trang Báo cáo (`Reports.tsx`): Danh sách lịch sử mọi trận đấu (Live & Tự luyện), xem chi tiết từng trận: Bảng điểm xếp hạng người chơi, thống kê % đúng của từng câu hỏi, bảng cảnh báo **Top câu hỏi sai nhiều nhất (Hardest Questions)** để giáo viên ôn tập lại, và nút **Xuất Bảng điểm ra file Excel (`.xlsx`) / CSV**.

#### Checkpoint 4: Final Verification & Release Readiness
- [ ] Toàn bộ bộ kiểm thử (`npm test`) và lệnh build (`npm run build`) chạy thành công 100% không lỗi.

---

## 4. Risks and Mitigations
| Risk | Impact | Mitigation |
|---|---|---|
| Nghẽn mạng Wi-Fi khi 40 học sinh cùng tải Video 100MB | High | Mặc định bật chế độ `PROJECTOR_FIRST` (Video tự phát trên màn hình Host; trên máy học sinh chỉ tải khi bấm nút xem theo yêu cầu). |
| Học sinh chưa kịp xem hết đoạn Video dài thì đồng hồ đếm ngược đã hết giờ | High | Mặc định bật chế độ `MEDIA_FIRST` (Cho xem Media/Đọc đề trước, sau đó mới mở 4 đáp án và bắt đầu tính thời gian đếm ngược). |
| Điện thoại học sinh bị tắt màn hình hoặc lỡ tay vuốt tải lại trang (F5) | High | Cấp `playerSessionToken` lưu `localStorage`, tự động gửi sự kiện `player:reconnect` để khôi phục điểm số, chuỗi Streak và trạng thái câu hiện tại. |
| Trình duyệt chặn tự động phát âm thanh (Browser Autoplay Policy) | Medium | Trên màn hình Host và Player luôn có nút tương tác đầu tiên ("Mở phòng" / "Tham gia") giúp mở khóa AudioContext và HTML5 Video/Audio hợp lệ. |

---

## 5. Open Questions
- Không còn câu hỏi mở. Tất cả các quyết định thiết kế đã được chốt qua phiên `/grill-me`.
