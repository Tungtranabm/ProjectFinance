# Changelog — Project Finance

Ghi lại các thay đổi qua từng phiên bản để tiện theo dõi.

## Ver 1.02 — 2026-08-17
- Cải tổ toàn bộ mô hình dữ liệu để phù hợp theo dõi thu chi dự án hoàn
  thiện nội thất thay vì thu chi cá nhân đơn thuần:
  - Danh mục nay có 2 cấp **Nhóm > Hạng mục** (VD: Xây dựng cơ bản (XDCB)
    → Xây, Tô, Bả...), chọn qua dropdown 2 tầng khi nhập giao dịch (chọn
    Nhóm trước, Hạng mục lọc theo Nhóm đã chọn).
  - Mỗi Hạng mục có thể gắn **Ngân sách dự kiến**; dashboard thêm mục
    "Ngân sách theo nhóm" so sánh dự kiến vs thực chi kèm thanh tiến độ.
  - Đổi "Ví" thành **Nhà thầu / Đội thi công**, bỏ khái niệm số dư ban
    đầu, thay bằng tổng "Đã chi" cho từng nhà thầu.
  - Thẻ tổng quan đổi từ "Tổng số dư" thành Ngân sách dự kiến / Đã chi /
    Còn lại (hoặc Vượt ngân sách).
- Sheet `Vi` đổi tên thành `NhaThau`; `DanhMuc` thêm cột `Nhom` và
  `NganSachDuKien`; `GiaoDich` thêm cột `Nhom`, đổi `DanhMuc` thành
  `HangMuc`, đổi `ViID` thành `NhaThauID`.
- Seed dữ liệu mặc định lần đầu bằng đúng bộ Nhóm/Hạng mục đã gửi người
  dùng review trước (7 nhóm, 47 hạng mục) và 2 nhà thầu mẫu.
- Đổi khoá localStorage sang tiền tố `pf_` cho gọn gàng, nhất quán với
  tên app mới.

## Ver 1.01 — 2026-08-17
- Đổi tên app từ "Thu Chi Tracker" thành **Project Finance**.
- Thêm hiển thị số phiên bản trong app (màn hình đăng nhập + mục ⚙ Cài đặt).
- Đổi tên file Google Sheet mặc định thành `Project Finance Data`.
- Thêm quy ước tăng số phiên bản sau mỗi lần chỉnh sửa (file này +
  `CACHE_NAME` trong `service-worker.js` + `APP_VERSION` trong `config.js`).

## Ver 1.00 — 2026-08-17
- Phiên bản đầu tiên: PWA theo dõi thu chi, đăng nhập Google, tự tạo và
  đồng bộ dữ liệu (giao dịch, ví, danh mục) vào một Google Sheet trong
  Drive của người dùng. Hỗ trợ nhiều ví, thêm giao dịch ngoại tuyến (tự
  đồng bộ lại khi có mạng), cài đặt lên màn hình chính như app thật (PWA).
