// =============================================================
//  Project Finance - app.js
//  Toàn bộ logic: đăng nhập Google, tạo/đọc/ghi Google Sheet,
//  cache local + hàng đợi đồng bộ khi mất mạng.
//  (Tên hiển thị + số phiên bản lấy từ CONFIG trong config.js)
//
//  Mô hình dữ liệu (Ver 1.03 - nhiều dự án):
//   - GiaoDich: ID, Ngay, Loai, SoTien, Nhom, HangMuc, NhaThauID, GhiChu, DuAnID
//   - NhaThau : ID, Ten, GhiChu                        (dùng chung mọi dự án)
//   - DanhMuc : ID, Nhom, HangMuc, Loai, GhiChu         (dùng chung mọi dự án)
//   - NganSach: ID, DuAnID, Nhom, HangMuc, NganSachDuKien, GhiChu  (riêng từng dự án)
//   - DuAn    : ID, Ten, GhiChu, NgayTao
//
//  Sheet cũ (Ver 1.02, chỉ có GiaoDich/NhaThau/DanhMuc) sẽ được TỰ ĐỘNG
//  nâng cấp khi phát hiện thiếu sheet DuAn/NganSach - xem migrateLegacyIfNeeded().
// =============================================================

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API = "https://www.googleapis.com/drive/v3/files";

const LS_KEYS = {
  SPREADSHEET_ID: "pf_spreadsheetId",
  SHEET_IDS: "pf_sheetIds",
  CACHE: "pf_cache",
  QUEUE: "pf_pendingQueue",
  HAS_LOGGED_IN: "pf_hasLoggedInBefore",
};

// ---------------------------------------------------------------
// Danh mục mặc định (Nhóm > Hạng mục), dùng để tạo dữ liệu lần đầu.
// Khớp với bản nháp Excel đã gửi cho người dùng review trước.
// Ngân sách KHÔNG còn nằm ở đây từ Ver 1.03 - ngân sách nay đặt riêng
// cho từng dự án (xem NganSach), nên danh mục mặc định chỉ còn tên.
// ---------------------------------------------------------------
const DEFAULT_CATEGORIES = [
  { nhom: "Xây dựng cơ bản (XDCB)", items: [
    ["Phá dỡ, dọn mặt bằng", "Chi"],
    ["Đào móng / ép cọc (nếu có)", "Chi"],
    ["Xây thô (xây tường, cột)", "Chi"],
    ["Cán nền, đổ sàn", "Chi"],
    ["Tô trát tường", "Chi"],
    ["Bả matit", "Chi"],
    ["Chống thấm (sàn, tường, sân thượng)", "Chi"],
    ["Đi đường điện âm tường", "Chi"],
    ["Đi đường nước âm tường (cấp thoát nước)", "Chi"],
    ["Lắp đặt khung bao cửa", "Chi"],
  ]},
  { nhom: "Hoàn thiện", items: [
    ["Sơn lót", "Chi"],
    ["Sơn phủ hoàn thiện", "Chi"],
    ["Trần thạch cao", "Chi"],
    ["Cửa đi (gỗ/nhôm/kính)", "Chi"],
    ["Cửa sổ", "Chi"],
    ["Lan can, tay vịn cầu thang", "Chi"],
    ["Lắp đặt thiết bị điện (công tắc, ổ cắm, đèn)", "Chi"],
    ["Lắp đặt thiết bị vệ sinh (bồn cầu, lavabo, vòi sen)", "Chi"],
    ["Lắp đặt máy nước nóng", "Chi"],
  ]},
  { nhom: "Ốp lát", items: [
    ["Gạch nền phòng khách / phòng ngủ", "Chi"],
    ["Gạch ốp tường", "Chi"],
    ["Gạch/đá ốp khu vệ sinh", "Chi"],
    ["Đá ốp bậc cầu thang", "Chi"],
    ["Ốp lát khu bếp (backsplash)", "Chi"],
    ["Gạch/đá ngoại thất, sân vườn", "Chi"],
  ]},
  { nhom: "Nội thất", items: [
    ["Nội thất phòng khách (sofa, bàn trà, kệ tivi)", "Chi"],
    ["Nội thất phòng bếp (tủ bếp, bàn ăn)", "Chi"],
    ["Nội thất phòng ngủ (giường, tủ quần áo, bàn trang điểm)", "Chi"],
    ["Nội thất phòng vệ sinh (tủ lavabo, gương, kệ)", "Chi"],
    ["Rèm cửa, thảm trải sàn", "Chi"],
    ["Đèn trang trí", "Chi"],
    ["Thiết bị điện gia dụng (máy lạnh, máy giặt, tủ lạnh, bếp từ...)", "Chi"],
  ]},
  { nhom: "Cơ điện (M&E)", items: [
    ["Hệ thống điện tổng (tủ điện, aptomat, CB)", "Chi"],
    ["Hệ thống mạng, camera an ninh", "Chi"],
    ["Hệ thống điều hoà trung tâm (nếu có)", "Chi"],
    ["Máy bơm nước, bồn nước", "Chi"],
  ]},
  { nhom: "Chi phí quản lý & khác", items: [
    ["Thiết kế phí", "Chi"],
    ["Giám sát thi công", "Chi"],
    ["Xin phép sửa chữa / xây dựng", "Chi"],
    ["Vận chuyển, bốc xếp vật liệu", "Chi"],
    ["Dọn dẹp vệ sinh công nghiệp", "Chi"],
    ["Phát sinh / dự phòng", "Chi"],
  ]},
  { nhom: "Nguồn vốn (Thu)", items: [
    ["Tạm ứng đợt 1 từ chủ đầu tư", "Thu"],
    ["Tạm ứng đợt 2", "Thu"],
    ["Tạm ứng đợt 3", "Thu"],
    ["Vay / ứng thêm", "Thu"],
    ["Hoàn ứng / hoàn tiền thừa", "Thu"],
  ]},
];

const DEFAULT_NHATHAU = [
  ["Đội thi công chính", ""],
  ["Chủ đầu tư / Nguồn vốn", "Dùng khi ghi nhận các khoản tạm ứng, thu vào"],
];

// ---------------------------------------------------------------
// State
// ---------------------------------------------------------------
const state = {
  accessToken: null,
  tokenExpiresAt: 0,
  spreadsheetId: null,
  sheetIds: {}, // { GiaoDich, NhaThau, DanhMuc, NganSach, DuAn } -> numeric sheetId
  nhaThauList: [],
  categories: [],
  transactions: [],
  projects: [],
  budgets: [],
  currentProjectId: null,
  pendingQueue: [],
  editingType: "Chi",
};

let tokenClient = null;

// ---------------------------------------------------------------
// Small utils
// ---------------------------------------------------------------
function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatMoney(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("vi-VN") + " ₫";
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function monthKey(dateStr) {
  return (dateStr || "").slice(0, 7); // yyyy-mm
}

function showToast(msg, ms = 2600) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.add("hidden"), ms);
}

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---------------------------------------------------------------
// Local persistence (cache + offline queue)
// ---------------------------------------------------------------
function saveLocalCache() {
  localStorage.setItem(
    LS_KEYS.CACHE,
    JSON.stringify({
      nhaThauList: state.nhaThauList,
      categories: state.categories,
      transactions: state.transactions,
      projects: state.projects,
      budgets: state.budgets,
    })
  );
}

function loadLocalCache() {
  try {
    const raw = localStorage.getItem(LS_KEYS.CACHE);
    if (!raw) return false;
    const data = JSON.parse(raw);
    state.nhaThauList = data.nhaThauList || [];
    state.categories = data.categories || [];
    state.transactions = data.transactions || [];
    state.projects = data.projects || [];
    state.budgets = data.budgets || [];
    return true;
  } catch (e) {
    return false;
  }
}

function saveQueue() {
  localStorage.setItem(LS_KEYS.QUEUE, JSON.stringify(state.pendingQueue));
}

function loadQueue() {
  try {
    state.pendingQueue = JSON.parse(localStorage.getItem(LS_KEYS.QUEUE) || "[]");
  } catch (e) {
    state.pendingQueue = [];
  }
}

// ---------------------------------------------------------------
// Google Identity Services (OAuth)
// ---------------------------------------------------------------
function initGisWhenReady() {
  if (typeof google === "undefined" || !google.accounts || !google.accounts.oauth2) {
    setTimeout(initGisWhenReady, 200);
    return;
  }
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CONFIG.CLIENT_ID,
    scope: CONFIG.SCOPES,
    callback: onTokenResponse,
    error_callback: (err) => {
      console.warn("GIS error", err);
      if (err && err.type !== "popup_closed") {
        $("loginError").textContent =
          "Đăng nhập thất bại: " + (err.message || err.type || "lỗi không xác định");
        $("loginError").classList.remove("hidden");
      }
    },
  });

  // Thử đăng nhập im lặng nếu trước đây đã từng đăng nhập thành công
  if (localStorage.getItem(LS_KEYS.HAS_LOGGED_IN) === "1") {
    try {
      tokenClient.requestAccessToken({ prompt: "" });
    } catch (e) {
      /* ignore, người dùng sẽ bấm nút đăng nhập */
    }
  }
}

async function onTokenResponse(resp) {
  if (!resp || !resp.access_token) {
    $("loginError").textContent = "Không nhận được token từ Google.";
    $("loginError").classList.remove("hidden");
    return;
  }
  state.accessToken = resp.access_token;
  state.tokenExpiresAt = Date.now() + (Number(resp.expires_in) || 3500) * 1000;
  localStorage.setItem(LS_KEYS.HAS_LOGGED_IN, "1");

  showScreen("projects");
  await bootstrapAfterLogin();
}

function ensureFreshToken() {
  return new Promise((resolve, reject) => {
    if (state.accessToken && Date.now() < state.tokenExpiresAt - 30000) {
      resolve(state.accessToken);
      return;
    }
    if (!navigator.onLine) {
      reject(new Error("offline"));
      return;
    }
    if (!tokenClient) {
      reject(new Error("Google Identity chưa sẵn sàng"));
      return;
    }
    const prevCallback = tokenClient.callback;
    const prevErrorCallback = tokenClient.error_callback;
    let settled = false;

    const restore = () => {
      tokenClient.callback = prevCallback;
      tokenClient.error_callback = prevErrorCallback;
    };

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      restore();
      reject(new Error("Hết thời gian chờ đăng nhập lại. Vui lòng bấm Đăng nhập với Google."));
    }, 12000);

    tokenClient.callback = (resp) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      restore();
      if (resp && resp.access_token) {
        state.accessToken = resp.access_token;
        state.tokenExpiresAt = Date.now() + (Number(resp.expires_in) || 3500) * 1000;
        resolve(state.accessToken);
      } else {
        reject(new Error("Không lấy được access token"));
      }
    };
    tokenClient.error_callback = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      restore();
      reject(new Error("Phiên đăng nhập hết hạn, vui lòng đăng nhập lại."));
    };
    tokenClient.requestAccessToken({ prompt: "" });
  });
}

function logout() {
  if (state.accessToken) {
    try {
      google.accounts.oauth2.revoke(state.accessToken, () => {});
    } catch (e) {}
  }
  state.accessToken = null;
  state.tokenExpiresAt = 0;
  state.currentProjectId = null;
  localStorage.removeItem(LS_KEYS.HAS_LOGGED_IN);
  showScreen("login");
}

// ---------------------------------------------------------------
// Generic Google API fetch wrapper
// ---------------------------------------------------------------
async function apiFetch(url, options = {}) {
  const token = await ensureFreshToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ---------------------------------------------------------------
// Spreadsheet bootstrap: find existing or create new
// ---------------------------------------------------------------
async function ensureSpreadsheet() {
  const cachedId = localStorage.getItem(LS_KEYS.SPREADSHEET_ID);
  if (cachedId) {
    try {
      const meta = await apiFetch(
        `${SHEETS_API}/${cachedId}?fields=spreadsheetId,sheets.properties`
      );
      state.spreadsheetId = cachedId;
      applySheetIdsFromMeta(meta);
      await migrateLegacyIfNeeded();
      return;
    } catch (e) {
      // file có thể đã bị xoá / mất quyền -> tìm lại hoặc tạo mới
      localStorage.removeItem(LS_KEYS.SPREADSHEET_ID);
    }
  }

  // Tìm file đã tồn tại (do app tạo trước đó, ví dụ ở thiết bị khác)
  const q = encodeURIComponent(
    `name='${CONFIG.SPREADSHEET_NAME}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`
  );
  const found = await apiFetch(`${DRIVE_API}?q=${q}&fields=files(id,name)&spaces=drive`);
  if (found && found.files && found.files.length > 0) {
    const id = found.files[0].id;
    const meta = await apiFetch(`${SHEETS_API}/${id}?fields=spreadsheetId,sheets.properties`);
    state.spreadsheetId = id;
    applySheetIdsFromMeta(meta);
    localStorage.setItem(LS_KEYS.SPREADSHEET_ID, id);
    await migrateLegacyIfNeeded();
    return;
  }

  // Không tìm thấy -> tạo mới kèm đủ 5 sheet của mô hình Ver 1.03
  const created = await apiFetch(SHEETS_API, {
    method: "POST",
    body: JSON.stringify({
      properties: { title: CONFIG.SPREADSHEET_NAME },
      sheets: [
        { properties: { title: "GiaoDich" } },
        { properties: { title: "NhaThau" } },
        { properties: { title: "DanhMuc" } },
        { properties: { title: "NganSach" } },
        { properties: { title: "DuAn" } },
      ],
    }),
  });
  state.spreadsheetId = created.spreadsheetId;
  applySheetIdsFromMeta(created);
  localStorage.setItem(LS_KEYS.SPREADSHEET_ID, state.spreadsheetId);

  await seedInitialData();
}

function applySheetIdsFromMeta(meta) {
  state.sheetIds = {};
  (meta.sheets || []).forEach((s) => {
    state.sheetIds[s.properties.title] = s.properties.sheetId;
  });
  localStorage.setItem(LS_KEYS.SHEET_IDS, JSON.stringify(state.sheetIds));
}

async function seedInitialData() {
  // Headers cho cả 5 sheet
  await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: [
        { range: "GiaoDich!A1:I1", values: [["ID", "Ngay", "Loai", "SoTien", "Nhom", "HangMuc", "NhaThauID", "GhiChu", "DuAnID"]] },
        { range: "NhaThau!A1:C1", values: [["ID", "Ten", "GhiChu"]] },
        { range: "DanhMuc!A1:E1", values: [["ID", "Nhom", "HangMuc", "Loai", "GhiChu"]] },
        { range: "NganSach!A1:F1", values: [["ID", "DuAnID", "Nhom", "HangMuc", "NganSachDuKien", "GhiChu"]] },
        { range: "DuAn!A1:D1", values: [["ID", "Ten", "GhiChu", "NgayTao"]] },
      ],
    }),
  });

  // Nhà thầu / đội thi công mặc định (dùng chung mọi dự án)
  const nhaThauRows = DEFAULT_NHATHAU.map(([ten, ghiChu]) => [genId(), ten, ghiChu]);
  await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/NhaThau!A2:C2:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({ values: nhaThauRows }),
  });

  // Danh mục Nhóm/Hạng mục mặc định (dùng chung mọi dự án, không kèm ngân sách)
  const catRows = [];
  DEFAULT_CATEGORIES.forEach(({ nhom, items }) => {
    items.forEach(([ten, loai]) => {
      catRows.push([genId(), nhom, ten, loai, ""]);
    });
  });
  await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/DanhMuc!A2:E2:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({ values: catRows }),
  });

  // Không tạo sẵn dự án nào - người dùng bấm "+ Thêm dự án" để bắt đầu.
}

// ---------------------------------------------------------------
// Nâng cấp sheet cũ (Ver 1.02, 3 sheet) lên mô hình nhiều dự án (5 sheet).
// An toàn để gọi nhiều lần: nếu đã đủ sheet DuAn + NganSach thì bỏ qua.
// ---------------------------------------------------------------
async function migrateLegacyIfNeeded() {
  const needsDuAn = !("DuAn" in state.sheetIds);
  const needsNganSach = !("NganSach" in state.sheetIds);
  if (!needsDuAn && !needsNganSach) return; // đã là mô hình Ver 1.03

  showToast("Đang nâng cấp dữ liệu lên bản nhiều dự án, vui lòng đợi giây lát...", 4000);

  // 1) Tạo sheet còn thiếu
  const addRequests = [];
  if (needsDuAn) addRequests.push({ addSheet: { properties: { title: "DuAn" } } });
  if (needsNganSach) addRequests.push({ addSheet: { properties: { title: "NganSach" } } });
  if (addRequests.length) {
    const res = await apiFetch(`${SHEETS_API}/${state.spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: addRequests }),
    });
    (res.replies || []).forEach((r) => {
      if (r.addSheet) {
        state.sheetIds[r.addSheet.properties.title] = r.addSheet.properties.sheetId;
      }
    });
    localStorage.setItem(LS_KEYS.SHEET_IDS, JSON.stringify(state.sheetIds));
  }

  // 2) Ghi header (ghi lại vô hại nếu đã có sẵn)
  await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: [
        { range: "DuAn!A1:D1", values: [["ID", "Ten", "GhiChu", "NgayTao"]] },
        { range: "NganSach!A1:F1", values: [["ID", "DuAnID", "Nhom", "HangMuc", "NganSachDuKien", "GhiChu"]] },
      ],
    }),
  });

  // 3) Kiểm tra DanhMuc có đang ở schema cũ (cột E = NganSachDuKien) không
  const oldDanhMuc = await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/DanhMuc!A1:F10000`);
  const dmRows = oldDanhMuc.values || [];
  const dmHeader = dmRows[0] || [];
  const isOldDanhMucSchema = dmHeader[4] === "NganSachDuKien";

  // 4) Đảm bảo có ít nhất 1 dự án để gán dữ liệu cũ vào
  const existingProjects = await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/DuAn!A2:D10000`);
  let defaultProjectId = ((existingProjects.values || [])[0] || [])[0];
  if (!defaultProjectId) {
    defaultProjectId = genId();
    await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/DuAn!A2:D2:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      body: JSON.stringify({
        values: [[defaultProjectId, "Dự án 1", "Dự án được tự động tạo khi nâng cấp app lên bản quản lý nhiều dự án - chứa toàn bộ dữ liệu cũ của bạn.", todayStr()]],
      }),
    });
  }

  // 5) Chuyển ngân sách cũ (trong DanhMuc) sang NganSach, viết lại DanhMuc còn 5 cột
  if (isOldDanhMucSchema && dmRows.length > 1) {
    const dataRows = dmRows.slice(1);
    const budgetRows = [];
    const newDanhMucRows = [];
    dataRows.forEach((row) => {
      const [id, nhom, hangMuc, loai, budget, ghiChu] = row;
      if (!id) return;
      newDanhMucRows.push([id, nhom || "", hangMuc || "", loai || "Chi", ghiChu || ""]);
      const b = Number(budget) || 0;
      if (b > 0) {
        budgetRows.push([genId(), defaultProjectId, nhom || "", hangMuc || "", b, ""]);
      }
    });
    await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/DanhMuc!A1:F10000:clear`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/DanhMuc!A1:E1?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      body: JSON.stringify({ values: [["ID", "Nhom", "HangMuc", "Loai", "GhiChu"]] }),
    });
    if (newDanhMucRows.length) {
      await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/DanhMuc!A2:E2:append?valueInputOption=USER_ENTERED`, {
        method: "POST",
        body: JSON.stringify({ values: newDanhMucRows }),
      });
    }
    if (budgetRows.length) {
      await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/NganSach!A2:F2:append?valueInputOption=USER_ENTERED`, {
        method: "POST",
        body: JSON.stringify({ values: budgetRows }),
      });
    }
  }

  // 6) Thêm cột DuAnID cho GiaoDich nếu chưa có, gán toàn bộ giao dịch cũ vào defaultProjectId
  const gdHeader = await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/GiaoDich!A1:I1`);
  const headerRow = (gdHeader.values || [])[0] || [];
  if (headerRow[8] !== "DuAnID") {
    await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/GiaoDich!A1:I1?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      body: JSON.stringify({ values: [["ID", "Ngay", "Loai", "SoTien", "Nhom", "HangMuc", "NhaThauID", "GhiChu", "DuAnID"]] }),
    });
    const gdData = await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/GiaoDich!A2:A100000`);
    const n = (gdData.values || []).length;
    if (n > 0) {
      const fill = Array.from({ length: n }, () => [defaultProjectId]);
      await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/GiaoDich!I2:I${n + 1}?valueInputOption=USER_ENTERED`, {
        method: "PUT",
        body: JSON.stringify({ values: fill }),
      });
    }
  }

  showToast("Đã nâng cấp xong. Dữ liệu cũ được gộp vào dự án \"Dự án 1\".", 5000);
}

// ---------------------------------------------------------------
// Load all data from the sheet
// ---------------------------------------------------------------
async function loadAllData() {
  const ranges = [
    "GiaoDich!A2:I100000",
    "NhaThau!A2:C10000",
    "DanhMuc!A2:E10000",
    "NganSach!A2:F10000",
    "DuAn!A2:D10000",
  ]
    .map((r) => "ranges=" + encodeURIComponent(r))
    .join("&");
  const data = await apiFetch(
    `${SHEETS_API}/${state.spreadsheetId}/values:batchGet?${ranges}`
  );
  const [txRange, nhaThauRange, catRange, budgetRange, projectRange] = data.valueRanges;

  state.transactions = (txRange.values || []).map((row, i) => ({
    id: row[0],
    ngay: row[1] || "",
    loai: row[2] || "Chi",
    soTien: Number(row[3]) || 0,
    nhom: row[4] || "",
    hangMuc: row[5] || "",
    nhaThauId: row[6] || "",
    ghiChu: row[7] || "",
    duAnId: row[8] || "",
    _row: i + 2,
  }));

  state.nhaThauList = (nhaThauRange.values || []).map((row, i) => ({
    id: row[0],
    ten: row[1] || "",
    ghiChu: row[2] || "",
    _row: i + 2,
  }));

  state.categories = (catRange.values || []).map((row, i) => ({
    id: row[0],
    nhom: row[1] || "",
    hangMuc: row[2] || "",
    loai: row[3] || "Chi",
    ghiChu: row[4] || "",
    _row: i + 2,
  }));

  state.budgets = (budgetRange.values || []).map((row, i) => ({
    id: row[0],
    duAnId: row[1] || "",
    nhom: row[2] || "",
    hangMuc: row[3] || "",
    nganSachDuKien: Number(row[4]) || 0,
    ghiChu: row[5] || "",
    _row: i + 2,
  }));

  state.projects = (projectRange.values || []).map((row, i) => ({
    id: row[0],
    ten: row[1] || "",
    ghiChu: row[2] || "",
    ngayTao: row[3] || "",
    _row: i + 2,
  }));

  saveLocalCache();
}

// ---------------------------------------------------------------
// Danh mục dùng chung (không phụ thuộc dự án)
// ---------------------------------------------------------------
function uniqueGroupsForType(type) {
  const seen = new Set();
  const result = [];
  state.categories.forEach((c) => {
    if (c.loai !== type) return;
    if (seen.has(c.nhom)) return;
    seen.add(c.nhom);
    result.push(c.nhom);
  });
  return result;
}

function uniqueAllGroups() {
  const seen = new Set();
  const result = [];
  state.categories.forEach((c) => {
    if (seen.has(c.nhom)) return;
    seen.add(c.nhom);
    result.push(c.nhom);
  });
  return result;
}

// ---------------------------------------------------------------
// Giao dịch / ngân sách - luôn theo phạm vi 1 dự án (duAnId)
// ---------------------------------------------------------------
function allTransactionsSorted() {
  const merged = [
    ...state.transactions,
    ...state.pendingQueue.map((q) => ({ ...q, _pending: true })),
  ];
  return merged.sort((a, b) => (b.ngay || "").localeCompare(a.ngay || ""));
}

function projectTransactions(duAnId) {
  return allTransactionsSorted().filter((t) => t.duAnId === duAnId);
}

function budgetedGroupsForProject(duAnId) {
  const seen = new Set();
  const result = [];
  state.budgets.forEach((b) => {
    if (b.duAnId !== duAnId) return;
    if (seen.has(b.nhom)) return;
    seen.add(b.nhom);
    result.push(b.nhom);
  });
  return result;
}

function groupBudget(duAnId, nhom) {
  return state.budgets
    .filter((b) => b.duAnId === duAnId && b.nhom === nhom)
    .reduce((sum, b) => sum + (b.nganSachDuKien || 0), 0);
}

function groupSpent(duAnId, nhom) {
  return projectTransactions(duAnId)
    .filter((t) => t.loai === "Chi" && t.nhom === nhom)
    .reduce((sum, t) => sum + (t.soTien || 0), 0);
}

function totalBudget(duAnId) {
  return budgetedGroupsForProject(duAnId).reduce((sum, nhom) => sum + groupBudget(duAnId, nhom), 0);
}

function totalSpent(duAnId) {
  return projectTransactions(duAnId)
    .filter((t) => t.loai === "Chi")
    .reduce((sum, t) => sum + (t.soTien || 0), 0);
}

function nhaThauSpent(duAnId, nhaThauId) {
  return projectTransactions(duAnId)
    .filter((t) => t.loai === "Chi" && t.nhaThauId === nhaThauId)
    .reduce((sum, t) => sum + (t.soTien || 0), 0);
}

function projectMonthIncomeExpense(duAnId) {
  const curMonth = monthKey(todayStr());
  let income = 0, expense = 0;
  projectTransactions(duAnId).forEach((t) => {
    if (monthKey(t.ngay) !== curMonth) return;
    if (t.loai === "Thu") income += t.soTien;
    else expense += t.soTien;
  });
  return { income, expense };
}

// ---------------------------------------------------------------
// Rendering - chung
// ---------------------------------------------------------------
function renderCurrentScreen() {
  if (state.currentProjectId) {
    renderProjectDetail();
  } else {
    renderProjectsOverview();
  }
}

function renderPendingInfo() {
  const n = state.pendingQueue.length;
  $("pendingInfo").textContent =
    n === 0
      ? "Không có giao dịch nào đang chờ đồng bộ."
      : `Có ${n} giao dịch đang chờ đồng bộ lên Google Sheets.`;
  updateSyncBadge();
}

function updateSyncBadge() {
  const badge = $("syncStatus");
  if (!navigator.onLine) {
    badge.classList.remove("pending");
    badge.classList.add("offline");
    badge.title = "Đang ngoại tuyến - dữ liệu mới sẽ tự đồng bộ khi có mạng";
  } else if (state.pendingQueue.length > 0) {
    badge.classList.remove("offline");
    badge.classList.add("pending");
    badge.title = `${state.pendingQueue.length} giao dịch đang chờ đồng bộ`;
  } else {
    badge.classList.remove("offline", "pending");
    badge.title = "Đã đồng bộ";
  }
}

function renderNhomDatalist() {
  const list = $("nhomDatalist");
  list.innerHTML = uniqueAllGroups().map((g) => `<option value="${escapeHtml(g)}"></option>`).join("");
}

// ---------------------------------------------------------------
// Rendering - Màn hình tổng quan tất cả dự án
// ---------------------------------------------------------------
function renderProjectsOverview() {
  const list = $("projectList");
  if (state.projects.length === 0) {
    list.innerHTML = `<p class="empty-hint">Chưa có dự án nào. Bấm "+ Thêm dự án" để bắt đầu.</p>`;
    renderPendingInfo();
    return;
  }
  list.innerHTML = state.projects
    .map((p) => {
      const budget = totalBudget(p.id);
      const spent = totalSpent(p.id);
      const remaining = budget - spent;
      const overBudget = remaining < 0;
      return `
        <div class="project-card" data-id="${p.id}">
          <div class="project-card-head">
            <span class="project-card-name">${escapeHtml(p.ten)}</span>
            <div class="project-card-actions">
              <button type="button" class="card-edit-btn" data-edit-project="${p.id}" title="Sửa dự án">✎</button>
              <span class="project-card-arrow">→</span>
            </div>
          </div>
          ${p.ghiChu ? `<div class="project-card-note">${escapeHtml(p.ghiChu)}</div>` : ""}
          <div class="project-card-stats">
            <div class="project-stat">
              <span>Ngân sách</span>
              <strong>${formatMoney(budget)}</strong>
            </div>
            <div class="project-stat expense">
              <span>Đã chi</span>
              <strong>${formatMoney(spent)}</strong>
            </div>
            <div class="project-stat remaining">
              <span>${overBudget ? "Vượt ngân sách" : "Còn lại"}</span>
              <strong class="${overBudget ? "over-budget" : ""}">${formatMoney(Math.abs(remaining))}</strong>
            </div>
          </div>
        </div>`;
    })
    .join("");
  renderPendingInfo();
}

async function addProject(name, note) {
  if (!navigator.onLine) {
    showToast("Cần có mạng để tạo dự án mới.");
    throw new Error("offline");
  }
  const id = genId();
  await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/DuAn!A2:D2:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({ values: [[id, name, note || "", todayStr()]] }),
  });
  await loadAllData();
  return id;
}

async function updateProject(id, name, note) {
  if (!navigator.onLine) {
    showToast("Cần có mạng để sửa dự án.");
    throw new Error("offline");
  }
  const p = state.projects.find((pr) => pr.id === id);
  if (!p) {
    showToast("Không tìm thấy dự án này.");
    throw new Error("not found");
  }
  await apiFetch(
    `${SHEETS_API}/${state.spreadsheetId}/values/DuAn!A${p._row}:D${p._row}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({ values: [[p.id, name, note || "", p.ngayTao]] }),
    }
  );
  await loadAllData();
  if (state.currentProjectId === id) {
    $("headerTitle").textContent = name;
  }
  showToast("Đã cập nhật dự án: " + name);
}

function openAddProjectModal() {
  $("editProjectId").value = "";
  $("newProjectForm").reset();
  $("projectModalTitle").textContent = "Thêm dự án mới";
  $("projectModalSubmitBtn").textContent = "Tạo dự án";
  openModal("projectModal");
}

function openEditProjectModal(id) {
  const p = state.projects.find((pr) => pr.id === id);
  if (!p) return;
  $("editProjectId").value = p.id;
  $("newProjectName").value = p.ten;
  $("newProjectNote").value = p.ghiChu || "";
  $("projectModalTitle").textContent = "Sửa dự án";
  $("projectModalSubmitBtn").textContent = "Lưu thay đổi";
  openModal("projectModal");
}

function openProject(id) {
  const p = state.projects.find((pr) => pr.id === id);
  if (!p) {
    showToast("Không tìm thấy dự án này.");
    return;
  }
  state.currentProjectId = id;
  $("headerTitle").textContent = p.ten;
  $("backToProjectsBtn").classList.remove("hidden");
  showScreen("app");
  renderProjectDetail();
}

function backToProjectsOverview() {
  state.currentProjectId = null;
  $("headerTitle").textContent = CONFIG.APP_NAME;
  $("backToProjectsBtn").classList.add("hidden");
  showScreen("projects");
  renderProjectsOverview();
}

// ---------------------------------------------------------------
// Rendering - Chi tiết 1 dự án (dashboard cũ, nay theo phạm vi dự án)
// ---------------------------------------------------------------
function renderNhaThauList() {
  const duAnId = state.currentProjectId;
  const list = $("nhaThauList");
  list.innerHTML = "";
  state.nhaThauList.forEach((nt) => {
    const card = document.createElement("div");
    card.className = "wallet-card";
    card.innerHTML = `
      <div class="wallet-card-head">
        <div class="w-name">${escapeHtml(nt.ten)}</div>
        <button type="button" class="card-edit-btn" data-edit-nhathau="${nt.id}" title="Sửa nhà thầu">✎</button>
      </div>
      <div class="w-balance">Đã chi: ${formatMoney(nhaThauSpent(duAnId, nt.id))}</div>`;
    list.appendChild(card);
  });

  const select = $("txNhaThau");
  const filterSelect = $("filterNhaThau");
  const options = state.nhaThauList.map((nt) => `<option value="${nt.id}">${escapeHtml(nt.ten)}</option>`).join("");
  select.innerHTML = options;
  filterSelect.innerHTML = `<option value="">Tất cả nhà thầu</option>` + options;
}

function renderGroupOptions(type) {
  const select = $("txNhom");
  const groups = uniqueGroupsForType(type);
  select.innerHTML = groups.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  const currentNhom = groups[0] || "";
  renderHangMucOptions(currentNhom, type);
}

function renderHangMucOptions(nhom, type) {
  const select = $("txHangMuc");
  const opts = state.categories.filter((c) => c.loai === type && c.nhom === nhom);
  select.innerHTML = opts
    .map((c) => `<option value="${escapeHtml(c.hangMuc)}">${escapeHtml(c.hangMuc)}</option>`)
    .join("");
}

function renderMonthFilterOptions() {
  const select = $("filterMonth");
  const prevValue = select.value;
  const months = new Set(projectTransactions(state.currentProjectId).map((t) => monthKey(t.ngay)));
  months.add(monthKey(todayStr()));
  const sorted = [...months].filter(Boolean).sort().reverse();
  select.innerHTML = sorted
    .map((m) => `<option value="${m}">Tháng ${m.slice(5, 7)}/${m.slice(0, 4)}</option>`)
    .join("");
  select.value = sorted.includes(prevValue) ? prevValue : monthKey(todayStr());
}

function renderSummary() {
  const duAnId = state.currentProjectId;
  const budget = totalBudget(duAnId);
  const spent = totalSpent(duAnId);
  const remaining = budget - spent;

  $("totalBudget").textContent = formatMoney(budget);
  $("totalSpent").textContent = formatMoney(spent);

  const remainingEl = $("totalRemaining");
  remainingEl.textContent = formatMoney(Math.abs(remaining));
  remainingEl.classList.toggle("over-budget", remaining < 0);
  $("remainingLabel").textContent = remaining < 0 ? "Vượt ngân sách" : "Còn lại so với ngân sách";

  const { income, expense } = projectMonthIncomeExpense(duAnId);
  $("monthIncome").textContent = formatMoney(income);
  $("monthExpense").textContent = formatMoney(expense);
}

function renderBudgetList() {
  const duAnId = state.currentProjectId;
  const groups = budgetedGroupsForProject(duAnId);
  const list = $("budgetList");
  if (groups.length === 0) {
    list.innerHTML = `<p class="empty-hint">Dự án này chưa đặt ngân sách. Vào ⚙ Cài đặt để đặt ngân sách cho từng Nhóm/Hạng mục.</p>`;
    return;
  }
  list.innerHTML = groups
    .map((nhom) => {
      const budget = groupBudget(duAnId, nhom);
      const spent = groupSpent(duAnId, nhom);
      const pct = budget > 0 ? (spent / budget) * 100 : spent > 0 ? 100 : 0;
      const widthPct = Math.min(pct, 100);
      const barClass = pct >= 100 ? "over" : pct >= 80 ? "warn" : "";
      return `
        <div class="budget-item">
          <div class="budget-item-head">
            <span class="budget-item-name">${escapeHtml(nhom)}</span>
            <span class="budget-item-nums">${formatMoney(spent)} / ${formatMoney(budget)}</span>
          </div>
          <div class="budget-bar-track">
            <div class="budget-bar-fill ${barClass}" style="width:${widthPct}%"></div>
          </div>
          <div class="budget-item-pct">${budget > 0 ? pct.toFixed(0) + "%" : "chưa có ngân sách dự kiến"}</div>
        </div>`;
    })
    .join("");
}

function renderTransactions() {
  const duAnId = state.currentProjectId;
  const monthFilter = $("filterMonth").value;
  const nhaThauFilter = $("filterNhaThau").value;
  const list = $("transactionList");
  const items = projectTransactions(duAnId).filter((t) => {
    if (monthFilter && monthKey(t.ngay) !== monthFilter) return false;
    if (nhaThauFilter && t.nhaThauId !== nhaThauFilter) return false;
    return true;
  });

  if (items.length === 0) {
    list.innerHTML = `<p class="empty-hint">Không có giao dịch nào trong khoảng đã chọn.</p>`;
    return;
  }

  list.innerHTML = items
    .map((t) => {
      const nhaThau = state.nhaThauList.find((nt) => nt.id === t.nhaThauId);
      const cls = t.loai === "Thu" ? "income" : "expense";
      const sign = t.loai === "Thu" ? "+" : "-";
      const pendingTag = t._pending ? `<span class="tx-pending">chờ đồng bộ</span>` : "";
      const metaParts = [t.nhom, t.ngay, nhaThau ? nhaThau.ten : "?"];
      if (t.ghiChu) metaParts.push(t.ghiChu);
      return `
        <div class="tx-item ${cls}" data-id="${t.id}" data-pending="${!!t._pending}">
          <div class="tx-icon">${t.loai === "Thu" ? "↑" : "↓"}</div>
          <div class="tx-main">
            <div class="tx-cat">${escapeHtml(t.hangMuc)}${pendingTag}</div>
            <div class="tx-meta">${metaParts.map(escapeHtml).join(" · ")}</div>
          </div>
          <div class="tx-amount">${sign}${formatMoney(t.soTien)}</div>
        </div>`;
    })
    .join("");
}

function renderProjectDetail() {
  renderNhaThauList();
  renderNhomDatalist();
  renderMonthFilterOptions();
  renderSummary();
  renderBudgetList();
  renderTransactions();
  renderPendingInfo();
}

// ---------------------------------------------------------------
// Ngân sách theo dự án (NganSach) - thêm/cập nhật (upsert)
// ---------------------------------------------------------------
function renderBudgetFormOptions() {
  const nhomSelect = $("budgetNhom");
  const groups = uniqueGroupsForType("Chi");
  nhomSelect.innerHTML = groups.map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`).join("");
  renderBudgetHangMucOptions(groups[0] || "");
}

function renderBudgetHangMucOptions(nhom) {
  const select = $("budgetHangMuc");
  const opts = state.categories.filter((c) => c.loai === "Chi" && c.nhom === nhom);
  select.innerHTML = opts.map((c) => `<option value="${escapeHtml(c.hangMuc)}">${escapeHtml(c.hangMuc)}</option>`).join("");
}

async function addOrUpdateBudget(nhom, hangMuc, amount) {
  if (!navigator.onLine) {
    showToast("Cần có mạng để cập nhật ngân sách.");
    return;
  }
  if (!state.currentProjectId) {
    showToast("Vui lòng chọn 1 dự án trước.");
    return;
  }
  const amt = Math.round(Number(amount) || 0);
  const existing = state.budgets.find(
    (b) => b.duAnId === state.currentProjectId && b.nhom === nhom && b.hangMuc === hangMuc
  );
  if (existing) {
    await apiFetch(
      `${SHEETS_API}/${state.spreadsheetId}/values/NganSach!A${existing._row}:F${existing._row}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        body: JSON.stringify({ values: [[existing.id, state.currentProjectId, nhom, hangMuc, amt, existing.ghiChu || ""]] }),
      }
    );
  } else {
    const id = genId();
    await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/NganSach!A2:F2:append?valueInputOption=USER_ENTERED`, {
      method: "POST",
      body: JSON.stringify({ values: [[id, state.currentProjectId, nhom, hangMuc, amt, ""]] }),
    });
  }
  await loadAllData();
  renderCurrentScreen();
  showToast(`Đã lưu ngân sách: ${nhom} · ${hangMuc}`);
}

// ---------------------------------------------------------------
// CRUD: transactions
// ---------------------------------------------------------------
async function addTransactionOnline(tx) {
  await apiFetch(
    `${SHEETS_API}/${state.spreadsheetId}/values/GiaoDich!A2:I2:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      body: JSON.stringify({
        values: [[tx.id, tx.ngay, tx.loai, tx.soTien, tx.nhom, tx.hangMuc, tx.nhaThauId, tx.ghiChu || "", tx.duAnId || ""]],
      }),
    }
  );
}

async function updateTransactionOnline(tx) {
  await apiFetch(
    `${SHEETS_API}/${state.spreadsheetId}/values/GiaoDich!A${tx._row}:I${tx._row}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({
        values: [[tx.id, tx.ngay, tx.loai, tx.soTien, tx.nhom, tx.hangMuc, tx.nhaThauId, tx.ghiChu || "", tx.duAnId || ""]],
      }),
    }
  );
}

async function deleteTransactionOnline(tx) {
  await apiFetch(`${SHEETS_API}/${state.spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: state.sheetIds["GiaoDich"],
              dimension: "ROWS",
              startIndex: tx._row - 1,
              endIndex: tx._row,
            },
          },
        },
      ],
    }),
  });
}

async function submitTransactionForm(evt) {
  evt.preventDefault();
  if (!state.currentProjectId) {
    showToast("Vui lòng chọn 1 dự án trước khi thêm giao dịch.");
    return;
  }
  const id = $("txId").value;
  const tx = {
    id: id || genId(),
    ngay: $("txDate").value || todayStr(),
    loai: state.editingType,
    soTien: Math.round(Number($("txAmount").value)),
    nhom: $("txNhom").value,
    hangMuc: $("txHangMuc").value,
    nhaThauId: $("txNhaThau").value,
    ghiChu: $("txNote").value.trim(),
    duAnId: id ? undefined : state.currentProjectId, // giữ nguyên duAnId cũ khi sửa
  };

  if (!tx.soTien || tx.soTien <= 0) {
    showToast("Số tiền không hợp lệ");
    return;
  }
  if (!tx.nhom || !tx.hangMuc) {
    showToast("Chưa có Nhóm/Hạng mục cho loại này, vào ⚙ Cài đặt để thêm trước.");
    return;
  }
  if (!tx.nhaThauId) {
    showToast("Vui lòng chọn Nhà thầu / Đội thi công");
    return;
  }

  closeModal("txModal");

  if (id) {
    // Sửa giao dịch: cần đang online (đơn giản hoá, tránh xung đột đồng bộ)
    const existing = state.transactions.find((t) => t.id === id);
    if (!existing) {
      showToast("Không thể sửa giao dịch đang chờ đồng bộ, hãy đợi đồng bộ xong.");
      return;
    }
    if (!navigator.onLine) {
      showToast("Cần có mạng để sửa giao dịch.");
      return;
    }
    try {
      tx._row = existing._row;
      tx.duAnId = existing.duAnId;
      await updateTransactionOnline(tx);
      await loadAllData();
      renderCurrentScreen();
      showToast("Đã cập nhật giao dịch");
    } catch (e) {
      console.error(e);
      showToast("Lỗi khi cập nhật: " + e.message);
    }
    return;
  }

  // Thêm mới: hỗ trợ offline qua hàng đợi
  if (navigator.onLine) {
    try {
      await addTransactionOnline(tx);
      await loadAllData();
      renderCurrentScreen();
      showToast("Đã lưu giao dịch");
      return;
    } catch (e) {
      console.warn("Lưu online thất bại, chuyển sang hàng đợi:", e);
    }
  }

  state.pendingQueue.push(tx);
  saveQueue();
  renderCurrentScreen();
  showToast("Đã lưu tạm - sẽ đồng bộ khi có mạng");
}

async function deleteCurrentTransaction() {
  const id = $("txId").value;
  if (!id) return;
  if (!confirm("Xoá giao dịch này?")) return;

  const existing = state.transactions.find((t) => t.id === id);
  closeModal("txModal");

  if (existing) {
    if (!navigator.onLine) {
      showToast("Cần có mạng để xoá giao dịch.");
      return;
    }
    try {
      await deleteTransactionOnline(existing);
      await loadAllData();
      renderCurrentScreen();
      showToast("Đã xoá giao dịch");
    } catch (e) {
      console.error(e);
      showToast("Lỗi khi xoá: " + e.message);
    }
  } else {
    state.pendingQueue = state.pendingQueue.filter((q) => q.id !== id);
    saveQueue();
    renderCurrentScreen();
    showToast("Đã xoá khỏi hàng đợi");
  }
}

// ---------------------------------------------------------------
// Offline queue flush
// ---------------------------------------------------------------
let isFlushing = false;
async function flushQueue() {
  if (isFlushing || !navigator.onLine || state.pendingQueue.length === 0) return;
  if (!state.spreadsheetId) return;
  isFlushing = true;
  try {
    const queue = [...state.pendingQueue];
    for (const tx of queue) {
      await addTransactionOnline(tx);
      state.pendingQueue = state.pendingQueue.filter((q) => q.id !== tx.id);
      saveQueue();
    }
    await loadAllData();
    renderCurrentScreen();
    showToast("Đã đồng bộ xong các giao dịch chờ");
  } catch (e) {
    console.warn("Flush queue lỗi, sẽ thử lại sau:", e);
  } finally {
    isFlushing = false;
    updateSyncBadge();
  }
}

// ---------------------------------------------------------------
// Nhà thầu / danh mục mới (dùng chung mọi dự án)
// ---------------------------------------------------------------
async function addNhaThau(name, note) {
  if (!navigator.onLine) {
    showToast("Cần có mạng để thêm nhà thầu mới.");
    return;
  }
  const id = genId();
  await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/NhaThau!A2:C2:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({ values: [[id, name, note || ""]] }),
  });
  await loadAllData();
  renderCurrentScreen();
  showToast("Đã thêm: " + name);
}

async function updateNhaThau(id, name, note) {
  if (!navigator.onLine) {
    showToast("Cần có mạng để sửa nhà thầu.");
    return;
  }
  const nt = state.nhaThauList.find((n) => n.id === id);
  if (!nt) {
    showToast("Không tìm thấy nhà thầu này.");
    return;
  }
  await apiFetch(
    `${SHEETS_API}/${state.spreadsheetId}/values/NhaThau!A${nt._row}:C${nt._row}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({ values: [[nt.id, name, note || ""]] }),
    }
  );
  await loadAllData();
  renderCurrentScreen();
  showToast("Đã cập nhật: " + name);
}

function resetNhaThauFormToAddMode() {
  $("newNhaThauForm").reset();
  $("editNhaThauId").value = "";
  $("nhaThauFormHeading").textContent = "Thêm nhà thầu / đội thi công mới";
  $("nhaThauSubmitBtn").textContent = "Thêm";
  $("nhaThauCancelEditBtn").classList.add("hidden");
}

function openEditNhaThauModal(id) {
  const nt = state.nhaThauList.find((n) => n.id === id);
  if (!nt) return;
  openSettingsModal();
  $("editNhaThauId").value = nt.id;
  $("newNhaThauName").value = nt.ten;
  $("newNhaThauNote").value = nt.ghiChu || "";
  $("nhaThauFormHeading").textContent = "Sửa nhà thầu / đội thi công";
  $("nhaThauSubmitBtn").textContent = "Lưu thay đổi";
  $("nhaThauCancelEditBtn").classList.remove("hidden");
}

async function addCategory(nhom, name, type) {
  if (!navigator.onLine) {
    showToast("Cần có mạng để thêm Nhóm/Hạng mục mới.");
    return;
  }
  const id = genId();
  await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/DanhMuc!A2:E2:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({ values: [[id, nhom, name, type, ""]] }),
  });
  await loadAllData();
  renderNhomDatalist();
  if (state.currentProjectId) {
    renderBudgetFormOptions();
    renderCurrentScreen();
  }
  showToast(`Đã thêm hạng mục: ${nhom} · ${name}`);
}

// ---------------------------------------------------------------
// Modal helpers
// ---------------------------------------------------------------
function openModal(id) {
  $(id).classList.remove("hidden");
}
function closeModal(id) {
  $(id).classList.add("hidden");
}

function openSettingsModal() {
  const block = $("budgetSettingsBlock");
  if (state.currentProjectId) {
    const p = state.projects.find((pr) => pr.id === state.currentProjectId);
    block.classList.remove("hidden");
    $("budgetSettingsProjectName").textContent = p ? p.ten : "";
    renderBudgetFormOptions();
  } else {
    block.classList.add("hidden");
  }
  resetNhaThauFormToAddMode();
  openModal("settingsModal");
}

function openAddTransactionModal() {
  if (!state.currentProjectId) {
    showToast("Vui lòng chọn 1 dự án trước khi thêm giao dịch.");
    return;
  }
  $("txModalTitle").textContent = "Thêm giao dịch";
  $("txId").value = "";
  $("txAmount").value = "";
  $("txDate").value = todayStr();
  $("txNote").value = "";
  $("txDeleteBtn").classList.add("hidden");
  setTxType("Chi");
  openModal("txModal");
}

function openEditTransactionModal(tx) {
  $("txModalTitle").textContent = "Sửa giao dịch";
  $("txId").value = tx.id;
  $("txAmount").value = tx.soTien;
  $("txDate").value = tx.ngay;
  $("txNote").value = tx.ghiChu || "";
  $("txDeleteBtn").classList.remove("hidden");
  setTxType(tx.loai);
  $("txNhom").value = tx.nhom;
  renderHangMucOptions(tx.nhom, tx.loai);
  $("txHangMuc").value = tx.hangMuc;
  $("txNhaThau").value = tx.nhaThauId;
  openModal("txModal");
}

function setTxType(type) {
  state.editingType = type;
  document.querySelectorAll(".type-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.type === type);
  });
  renderGroupOptions(type);
}

function showScreen(which) {
  $("loginScreen").classList.toggle("hidden", which !== "login");
  $("appHeader").classList.toggle("hidden", which === "login");
  $("projectsScreen").classList.toggle("hidden", which !== "projects");
  $("appScreen").classList.toggle("hidden", which !== "app");
}

// ---------------------------------------------------------------
// Bootstrap after successful login
// ---------------------------------------------------------------
async function bootstrapAfterLogin() {
  loadQueue();
  try {
    await ensureSpreadsheet();
    await loadAllData();
    await flushQueue();
    showScreen("projects");
    renderProjectsOverview();
  } catch (e) {
    console.error(e);
    if (loadLocalCache()) {
      showToast("Không kết nối được Google Sheets, đang hiển thị dữ liệu đã lưu tạm.");
      showScreen("projects");
      renderProjectsOverview();
    } else {
      showToast("Lỗi kết nối: " + e.message);
    }
  }
}

// ---------------------------------------------------------------
// Wire up events
// ---------------------------------------------------------------
function wireEvents() {
  $("loginBtn").addEventListener("click", () => {
    $("loginError").classList.add("hidden");
    if (!tokenClient) {
      $("loginError").textContent = "Đang tải Google Identity, vui lòng thử lại sau vài giây.";
      $("loginError").classList.remove("hidden");
      return;
    }
    tokenClient.requestAccessToken({ prompt: "consent" });
  });

  $("logoutBtn").addEventListener("click", logout);

  $("addProjectBtn").addEventListener("click", openAddProjectModal);

  $("newProjectForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const editId = $("editProjectId").value;
    const name = $("newProjectName").value.trim();
    const note = $("newProjectNote").value.trim();
    if (!name) return;
    try {
      if (editId) {
        await updateProject(editId, name, note);
        closeModal("projectModal");
        $("newProjectForm").reset();
        $("editProjectId").value = "";
        renderCurrentScreen();
      } else {
        const id = await addProject(name, note);
        closeModal("projectModal");
        $("newProjectForm").reset();
        openProject(id);
      }
    } catch (err) {
      showToast("Lỗi: " + err.message);
    }
  });

  $("backToProjectsBtn").addEventListener("click", backToProjectsOverview);

  $("projectList").addEventListener("click", (e) => {
    const editBtn = e.target.closest("[data-edit-project]");
    if (editBtn) {
      openEditProjectModal(editBtn.dataset.editProject);
      return;
    }
    const card = e.target.closest(".project-card");
    if (!card) return;
    openProject(card.dataset.id);
  });

  $("addTransactionBtn").addEventListener("click", openAddTransactionModal);

  document.querySelectorAll("[data-close-modal]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const overlay = e.target.closest(".modal-overlay");
      overlay.classList.add("hidden");
    });
  });

  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.classList.add("hidden");
    });
  });

  document.querySelectorAll(".type-btn").forEach((btn) => {
    btn.addEventListener("click", () => setTxType(btn.dataset.type));
  });

  $("txNhom").addEventListener("change", (e) => {
    renderHangMucOptions(e.target.value, state.editingType);
  });

  $("txForm").addEventListener("submit", submitTransactionForm);
  $("txDeleteBtn").addEventListener("click", deleteCurrentTransaction);

  $("transactionList").addEventListener("click", (e) => {
    const item = e.target.closest(".tx-item");
    if (!item) return;
    const id = item.dataset.id;
    const tx = allTransactionsSorted().find((t) => t.id === id);
    if (tx) openEditTransactionModal(tx);
  });

  $("filterMonth").addEventListener("change", renderTransactions);
  $("filterNhaThau").addEventListener("change", renderTransactions);

  $("settingsBtn").addEventListener("click", openSettingsModal);
  $("addNhaThauBtn").addEventListener("click", openSettingsModal);

  $("budgetNhom").addEventListener("change", (e) => {
    renderBudgetHangMucOptions(e.target.value);
  });

  $("newBudgetForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nhom = $("budgetNhom").value;
    const hangMuc = $("budgetHangMuc").value;
    const amount = $("budgetAmount").value;
    if (!nhom || !hangMuc) {
      showToast("Chưa có Nhóm/Hạng mục nào, thêm ở mục bên dưới trước.");
      return;
    }
    try {
      await addOrUpdateBudget(nhom, hangMuc, amount);
      $("newBudgetForm").reset();
      renderBudgetFormOptions();
    } catch (err) {
      showToast("Lỗi: " + err.message);
    }
  });

  $("newNhaThauForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const editId = $("editNhaThauId").value;
    const name = $("newNhaThauName").value.trim();
    const note = $("newNhaThauNote").value.trim();
    if (!name) return;
    try {
      if (editId) {
        await updateNhaThau(editId, name, note);
        resetNhaThauFormToAddMode();
      } else {
        await addNhaThau(name, note);
        $("newNhaThauForm").reset();
      }
    } catch (err) {
      showToast("Lỗi: " + err.message);
    }
  });

  $("nhaThauCancelEditBtn").addEventListener("click", resetNhaThauFormToAddMode);

  $("nhaThauList").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-edit-nhathau]");
    if (btn) openEditNhaThauModal(btn.dataset.editNhathau);
  });

  $("newCategoryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nhom = $("newCategoryNhom").value.trim();
    const name = $("newCategoryName").value.trim();
    const type = $("newCategoryType").value;
    if (!nhom || !name) return;
    try {
      await addCategory(nhom, name, type);
      $("newCategoryForm").reset();
    } catch (err) {
      showToast("Lỗi: " + err.message);
    }
  });

  $("forceSyncBtn").addEventListener("click", async () => {
    if (!navigator.onLine) {
      showToast("Đang ngoại tuyến, không thể đồng bộ.");
      return;
    }
    await flushQueue();
    try {
      await loadAllData();
      renderCurrentScreen();
      showToast("Đã đồng bộ");
    } catch (e) {
      showToast("Lỗi đồng bộ: " + e.message);
    }
  });

  $("openSheetBtn").addEventListener("click", () => {
    if (!state.spreadsheetId) return;
    window.open(`https://docs.google.com/spreadsheets/d/${state.spreadsheetId}/edit`, "_blank");
  });

  window.addEventListener("online", () => {
    updateSyncBadge();
    flushQueue();
  });
  window.addEventListener("offline", updateSyncBadge);
}

// ---------------------------------------------------------------
// Branding (tên app + số phiên bản, lấy từ CONFIG)
// ---------------------------------------------------------------
function applyBranding() {
  const versionLabel = `${CONFIG.APP_NAME} Ver ${CONFIG.APP_VERSION}`;
  document.title = versionLabel;
  const titleEl = $("appTitle");
  const headerTitleEl = $("headerTitle");
  const versionLoginEl = $("appVersionLogin");
  const versionSettingsEl = $("appVersionSettings");
  if (titleEl) titleEl.textContent = CONFIG.APP_NAME;
  // Giá trị mặc định ban đầu - openProject()/backToProjectsOverview() sẽ
  // ghi đè thành tên dự án hoặc tên app tuỳ màn hình đang xem.
  if (headerTitleEl) headerTitleEl.textContent = CONFIG.APP_NAME;
  if (versionLoginEl) versionLoginEl.textContent = versionLabel;
  if (versionSettingsEl) versionSettingsEl.textContent = versionLabel;
}

// ---------------------------------------------------------------
// Init
// ---------------------------------------------------------------
function init() {
  applyBranding();
  wireEvents();
  loadQueue();
  loadLocalCache();
  updateSyncBadge();
  initGisWhenReady();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch((e) => {
        console.warn("Service worker registration failed:", e);
      });
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
