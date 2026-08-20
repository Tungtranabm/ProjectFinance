# Changelog — Project Finance

Ghi lại các thay đổi qua từng phiên bản để tiện theo dõi.

## Ver 1.05 — 2026-08-18
- **Ô nhập Số tiền (giao dịch) và Ngân sách dự kiến:**
  - Cho phép nhập số tiền = 0 (trước đây bắt buộc > 0, và do ô nhập kiểu
    số có bước nhảy cố định - 1.000 cho giao dịch, 100.000 cho ngân sách -
    nên gõ số không tròn theo bước nhảy đó cũng bị chặn không cho lưu).
    Nay chỉ cần số tiền ≥ 0 là lưu được, không còn giới hạn phải chia hết
    cho mốc nào cả.
  - Ô nhập tự thêm dấu "." phân cách hàng nghìn ngay khi gõ (VD: gõ
    `6500000` sẽ hiện `6.500.000`) để dễ đọc hơn, giống cách hiển thị số
    tiền ở các nơi khác trong app.

## Ver 1.04 — 2026-08-18
- **Sửa tên dự án:** trên màn hình "Dự án của bạn", bấm biểu tượng ✎ trên
  mỗi thẻ dự án để đổi tên/ghi chú (không mở dự án khi bấm nút này).
- **Sửa nhà thầu / đội thi công:** trong dashboard 1 dự án, mục "Nhà thầu
  / Đội thi công" nay có biểu tượng ✎ trên mỗi thẻ để đổi tên/ghi chú —
  form trong ⚙ Cài đặt tự chuyển sang chế độ "Sửa", có nút "Huỷ sửa" để
  quay lại chế độ thêm mới.
- Cả hai thao tác sửa đều ghi thẳng vào đúng dòng trong Google Sheet (theo
  ID), không tạo dòng trùng, áp dụng ngay cho mọi giao dịch/ngân sách đã
  có liên quan (vì các bảng tham chiếu theo ID, không theo tên).
- Xoá dự án / xoá nhà thầu / sửa-xoá Nhóm-Hạng mục CHƯA có trong bản này —
  sẽ bổ sung sau nếu cần.

## Ver 1.03 — 2026-08-18
- **Quản lý nhiều dự án trong 1 app** (thay vì chỉ 1 dự án tổng chung như
  trước):
  - Thêm màn hình **"Dự án của bạn"** làm màn hình chính sau khi đăng
    nhập — liệt kê tất cả dự án dạng thẻ, mỗi thẻ hiện nhanh Ngân sách /
    Đã chi / Còn lại của dự án đó. Bấm "+ Thêm dự án" để tạo dự án mới,
    bấm vào thẻ để mở dashboard chi tiết của dự án đó.
  - Trong dashboard 1 dự án, có nút "←" ở góc trên để quay lại màn hình
    tổng quan tất cả dự án.
  - **Nhóm/Hạng mục** và **Nhà thầu/Đội thi công** dùng CHUNG cho mọi dự
    án (đỡ phải nhập lại danh mục cho từng dự án).
  - **Ngân sách dự kiến** nay đặt RIÊNG cho từng dự án: vào ⚙ Cài đặt khi
    đang ở trong 1 dự án, mục "Đặt ngân sách cho dự án..." cho chọn
    Nhóm + Hạng mục + số tiền — chỉ Hạng mục nào được đặt ngân sách ở đây
    mới hiện trong mục "Ngân sách theo nhóm" của dự án đó. Có thể nhập
    lại cùng Nhóm + Hạng mục để cập nhật số tiền mới.
  - Mọi giao dịch, tổng ngân sách/đã chi, bộ lọc tháng/nhà thầu... đều tự
    lọc theo đúng dự án đang mở, không lẫn giữa các dự án.
- Sheet đổi cấu trúc: thêm 2 sheet mới `DuAn` (ID, Tên, Ghi chú, Ngày tạo)
  và `NganSach` (ID, DuAnID, Nhóm, Hạng mục, Ngân sách dự kiến, Ghi chú).
  `GiaoDich` thêm cột `DuAnID`. `DanhMuc` bỏ cột `NganSachDuKien` (ngân
  sách nay nằm ở sheet `NganSach`, gắn theo từng dự án).
- **Tự động nâng cấp file Google Sheet cũ:** nếu bạn đã dùng app từ bản
  1.02, lần đăng nhập đầu tiên trên bản 1.03 app sẽ tự thêm 2 sheet mới,
  gom toàn bộ giao dịch/ngân sách cũ vào 1 dự án tên "Dự án 1" — không
  cần xoá hay tạo lại file, dữ liệu cũ không mất.

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
