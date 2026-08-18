// =============================================================
//  CẤU HÌNH - Bạn PHẢI chỉnh sửa file này trước khi dùng app
// =============================================================
//
// 1. Tạo OAuth Client ID trên Google Cloud Console (xem hướng dẫn
//    trong README.md) rồi dán vào CLIENT_ID bên dưới.
//
// 2. (Tuỳ chọn) đổi tên file Google Sheet sẽ được app tự tạo trên
//    Drive của bạn.
//
const CONFIG = {
  // Tên app hiển thị trong giao diện + số phiên bản.
  // QUY ƯỚC: mỗi lần sửa/nâng cấp app, tăng thêm 1 vào 2 số cuối của
  // APP_VERSION (1.01 -> 1.02 -> 1.03 ...) để tiện theo dõi. Nhớ cập nhật
  // cùng lúc với CACHE_NAME trong service-worker.js và CHANGELOG.md.
  APP_NAME: "Project Finance",
  APP_VERSION: "1.02",

  // Dán OAuth Client ID (dạng "xxxx.apps.googleusercontent.com") vào đây
  CLIENT_ID: "721535080990-8ihjtp88nalf5f55jv5d2g4lqpn2mp32.apps.googleusercontent.com",

  // Tên file Google Sheet sẽ được tạo tự động trong Drive của bạn
  SPREADSHEET_NAME: "Project Finance Data",

  // Quyền truy cập cần thiết:
  // - spreadsheets: đọc/ghi nội dung Google Sheet
  // - drive.file: chỉ cho phép app truy cập file DO CHÍNH APP TẠO RA
  //   (không đụng tới các file khác trong Drive của bạn)
  SCOPES: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
  ].join(" "),
};
