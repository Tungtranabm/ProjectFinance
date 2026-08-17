// =============================================================
//  Project Finance - app.js
//  Toàn bộ logic: đăng nhập Google, tạo/đọc/ghi Google Sheet,
//  cache local + hàng đợi đồng bộ khi mất mạng.
//  (Tên hiển thị + số phiên bản lấy từ CONFIG trong config.js)
//
//  Mô hình dữ liệu (Ver 1.02):
//   - GiaoDich: ID, Ngay, Loai, SoTien, Nhom, HangMuc, NhaThauID, GhiChu
//   - NhaThau : ID, Ten, GhiChu            (nhà thầu / đội thi công)
//   - DanhMuc : ID, Nhom, HangMuc, Loai, NganSachDuKien, GhiChu
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
// ---------------------------------------------------------------
const DEFAULT_CATEGORIES = [
  { nhom: "Xây dựng cơ bản (XDCB)", items: [
    ["Phá dỡ, dọn mặt bằng", "Chi", 8000000],
    ["Đào móng / ép cọc (nếu có)", "Chi", 0],
    ["Xây thô (xây tường, cột)", "Chi", 0],
    ["Cán nền, đổ sàn", "Chi", 0],
    ["Tô trát tường", "Chi", 0],
    ["Bả matit", "Chi", 0],
    ["Chống thấm (sàn, tường, sân thượng)", "Chi", 0],
    ["Đi đường điện âm tường", "Chi", 0],
    ["Đi đường nước âm tường (cấp thoát nước)", "Chi", 0],
    ["Lắp đặt khung bao cửa", "Chi", 0],
  ]},
  { nhom: "Hoàn thiện", items: [
    ["Sơn lót", "Chi", 0],
    ["Sơn phủ hoàn thiện", "Chi", 0],
    ["Trần thạch cao", "Chi", 0],
    ["Cửa đi (gỗ/nhôm/kính)", "Chi", 0],
    ["Cửa sổ", "Chi", 0],
    ["Lan can, tay vịn cầu thang", "Chi", 0],
    ["Lắp đặt thiết bị điện (công tắc, ổ cắm, đèn)", "Chi", 0],
    ["Lắp đặt thiết bị vệ sinh (bồn cầu, lavabo, vòi sen)", "Chi", 0],
    ["Lắp đặt máy nước nóng", "Chi", 0],
  ]},
  { nhom: "Ốp lát", items: [
    ["Gạch nền phòng khách / phòng ngủ", "Chi", 0],
    ["Gạch ốp tường", "Chi", 0],
    ["Gạch/đá ốp khu vệ sinh", "Chi", 0],
    ["Đá ốp bậc cầu thang", "Chi", 0],
    ["Ốp lát khu bếp (backsplash)", "Chi", 0],
    ["Gạch/đá ngoại thất, sân vườn", "Chi", 0],
  ]},
  { nhom: "Nội thất", items: [
    ["Nội thất phòng khách (sofa, bàn trà, kệ tivi)", "Chi", 0],
    ["Nội thất phòng bếp (tủ bếp, bàn ăn)", "Chi", 0],
    ["Nội thất phòng ngủ (giường, tủ quần áo, bàn trang điểm)", "Chi", 0],
    ["Nội thất phòng vệ sinh (tủ lavabo, gương, kệ)", "Chi", 0],
    ["Rèm cửa, thảm trải sàn", "Chi", 0],
    ["Đèn trang trí", "Chi", 0],
    ["Thiết bị điện gia dụng (máy lạnh, máy giặt, tủ lạnh, bếp từ...)", "Chi", 0],
  ]},
  { nhom: "Cơ điện (M&E)", items: [
    ["Hệ thống điện tổng (tủ điện, aptomat, CB)", "Chi", 0],
    ["Hệ thống mạng, camera an ninh", "Chi", 0],
    ["Hệ thống điều hoà trung tâm (nếu có)", "Chi", 0],
    ["Máy bơm nước, bồn nước", "Chi", 0],
  ]},
  { nhom: "Chi phí quản lý & khác", items: [
    ["Thiết kế phí", "Chi", 0],
    ["Giám sát thi công", "Chi", 0],
    ["Xin phép sửa chữa / xây dựng", "Chi", 0],
    ["Vận chuyển, bốc xếp vật liệu", "Chi", 0],
    ["Dọn dẹp vệ sinh công nghiệp", "Chi", 0],
    ["Phát sinh / dự phòng", "Chi", 0],
  ]},
  { nhom: "Nguồn vốn (Thu)", items: [
    ["Tạm ứng đợt 1 từ chủ đầu tư", "Thu", 0],
    ["Tạm ứng đợt 2", "Thu", 0],
    ["Tạm ứng đợt 3", "Thu", 0],
    ["Vay / ứng thêm", "Thu", 0],
    ["Hoàn ứng / hoàn tiền thừa", "Thu", 0],
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
  sheetIds: {}, // { GiaoDich, NhaThau, DanhMuc } -> numeric sheetId
  nhaThauList: [],
  categories: [],
  transactions: [],
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

  showScreen("app");
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
    return;
  }

  // Không tìm thấy -> tạo mới kèm 3 sheet
  const created = await apiFetch(SHEETS_API, {
    method: "POST",
    body: JSON.stringify({
      properties: { title: CONFIG.SPREADSHEET_NAME },
      sheets: [
        { properties: { title: "GiaoDich" } },
        { properties: { title: "NhaThau" } },
        { properties: { title: "DanhMuc" } },
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
  // Headers
  await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "USER_ENTERED",
      data: [
        { range: "GiaoDich!A1:H1", values: [["ID", "Ngay", "Loai", "SoTien", "Nhom", "HangMuc", "NhaThauID", "GhiChu"]] },
        { range: "NhaThau!A1:C1", values: [["ID", "Ten", "GhiChu"]] },
        { range: "DanhMuc!A1:F1", values: [["ID", "Nhom", "HangMuc", "Loai", "NganSachDuKien", "GhiChu"]] },
      ],
    }),
  });

  // Nhà thầu / đội thi công mặc định
  const nhaThauRows = DEFAULT_NHATHAU.map(([ten, ghiChu]) => [genId(), ten, ghiChu]);
  await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/NhaThau!A2:C2:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({ values: nhaThauRows }),
  });

  // Danh mục Nhóm/Hạng mục mặc định (khớp bản nháp Excel đã gửi)
  const catRows = [];
  DEFAULT_CATEGORIES.forEach(({ nhom, items }) => {
    items.forEach(([ten, loai, budget]) => {
      catRows.push([genId(), nhom, ten, loai, budget, ""]);
    });
  });
  await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/DanhMuc!A2:F2:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({ values: catRows }),
  });
}

// ---------------------------------------------------------------
// Load all data from the sheet
// ---------------------------------------------------------------
async function loadAllData() {
  const ranges = ["GiaoDich!A2:H100000", "NhaThau!A2:C10000", "DanhMuc!A2:F10000"]
    .map((r) => "ranges=" + encodeURIComponent(r))
    .join("&");
  const data = await apiFetch(
    `${SHEETS_API}/${state.spreadsheetId}/values:batchGet?${ranges}`
  );
  const [txRange, nhaThauRange, catRange] = data.valueRanges;

  state.transactions = (txRange.values || []).map((row, i) => ({
    id: row[0],
    ngay: row[1] || "",
    loai: row[2] || "Chi",
    soTien: Number(row[3]) || 0,
    nhom: row[4] || "",
    hangMuc: row[5] || "",
    nhaThauId: row[6] || "",
    ghiChu: row[7] || "",
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
    nganSachDuKien: Number(row[4]) || 0,
    ghiChu: row[5] || "",
    _row: i + 2,
  }));

  saveLocalCache();
}

// ---------------------------------------------------------------
// Ngân sách / chi tiêu helpers
// ---------------------------------------------------------------
function allTransactionsSorted() {
  const merged = [
    ...state.transactions,
    ...state.pendingQueue.map((q) => ({ ...q, _pending: true })),
  ];
  return merged.sort((a, b) => (b.ngay || "").localeCompare(a.ngay || ""));
}

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

function groupBudget(nhom) {
  return state.categories
    .filter((c) => c.nhom === nhom && c.loai === "Chi")
    .reduce((sum, c) => sum + (c.nganSachDuKien || 0), 0);
}

function groupSpent(nhom) {
  const all = allTransactionsSorted();
  return all
    .filter((t) => t.loai === "Chi" && t.nhom === nhom)
    .reduce((sum, t) => sum + (t.soTien || 0), 0);
}

function totalBudget() {
  return uniqueGroupsForType("Chi").reduce((sum, nhom) => sum + groupBudget(nhom), 0);
}

function totalSpent() {
  const all = allTransactionsSorted();
  return all.filter((t) => t.loai === "Chi").reduce((sum, t) => sum + (t.soTien || 0), 0);
}

function nhaThauSpent(nhaThauId) {
  const all = allTransactionsSorted();
  return all
    .filter((t) => t.loai === "Chi" && t.nhaThauId === nhaThauId)
    .reduce((sum, t) => sum + (t.soTien || 0), 0);
}

// ---------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------
function renderNhaThauList() {
  const list = $("nhaThauList");
  list.innerHTML = "";
  state.nhaThauList.forEach((nt) => {
    const card = document.createElement("div");
    card.className = "wallet-card";
    card.innerHTML = `<div class="w-name">${escapeHtml(nt.ten)}</div><div class="w-balance">Đã chi: ${formatMoney(nhaThauSpent(nt.id))}</div>`;
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

function renderNhomDatalist() {
  const list = $("nhomDatalist");
  list.innerHTML = uniqueAllGroups().map((g) => `<option value="${escapeHtml(g)}"></option>`).join("");
}

function renderMonthFilterOptions() {
  const select = $("filterMonth");
  const prevValue = select.value;
  const months = new Set(allTransactionsSorted().map((t) => monthKey(t.ngay)));
  months.add(monthKey(todayStr()));
  const sorted = [...months].filter(Boolean).sort().reverse();
  select.innerHTML = sorted
    .map((m) => `<option value="${m}">Tháng ${m.slice(5, 7)}/${m.slice(0, 4)}</option>`)
    .join("");
  select.value = sorted.includes(prevValue) ? prevValue : monthKey(todayStr());
}

function renderSummary() {
  const budget = totalBudget();
  const spent = totalSpent();
  const remaining = budget - spent;

  $("totalBudget").textContent = formatMoney(budget);
  $("totalSpent").textContent = formatMoney(spent);

  const remainingEl = $("totalRemaining");
  remainingEl.textContent = formatMoney(Math.abs(remaining));
  remainingEl.classList.toggle("over-budget", remaining < 0);
  $("remainingLabel").textContent = remaining < 0 ? "Vượt ngân sách" : "Còn lại so với ngân sách";

  const curMonth = monthKey(todayStr());
  let income = 0, expense = 0;
  allTransactionsSorted().forEach((t) => {
    if (monthKey(t.ngay) !== curMonth) return;
    if (t.loai === "Thu") income += t.soTien;
    else expense += t.soTien;
  });
  $("monthIncome").textContent = formatMoney(income);
  $("monthExpense").textContent = formatMoney(expense);
}

function renderBudgetList() {
  const groups = uniqueGroupsForType("Chi");
  const list = $("budgetList");
  if (groups.length === 0) {
    list.innerHTML = `<p class="empty-hint">Chưa có Nhóm/Hạng mục nào. Thêm trong mục ⚙ Cài đặt.</p>`;
    return;
  }
  list.innerHTML = groups
    .map((nhom) => {
      const budget = groupBudget(nhom);
      const spent = groupSpent(nhom);
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
  const monthFilter = $("filterMonth").value;
  const nhaThauFilter = $("filterNhaThau").value;
  const list = $("transactionList");
  const items = allTransactionsSorted().filter((t) => {
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

function renderAll() {
  renderNhaThauList();
  renderNhomDatalist();
  renderMonthFilterOptions();
  renderSummary();
  renderBudgetList();
  renderTransactions();
  renderPendingInfo();
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

// ---------------------------------------------------------------
// CRUD: transactions
// ---------------------------------------------------------------
async function addTransactionOnline(tx) {
  await apiFetch(
    `${SHEETS_API}/${state.spreadsheetId}/values/GiaoDich!A2:H2:append?valueInputOption=USER_ENTERED`,
    {
      method: "POST",
      body: JSON.stringify({
        values: [[tx.id, tx.ngay, tx.loai, tx.soTien, tx.nhom, tx.hangMuc, tx.nhaThauId, tx.ghiChu || ""]],
      }),
    }
  );
}

async function updateTransactionOnline(tx) {
  await apiFetch(
    `${SHEETS_API}/${state.spreadsheetId}/values/GiaoDich!A${tx._row}:H${tx._row}?valueInputOption=USER_ENTERED`,
    {
      method: "PUT",
      body: JSON.stringify({
        values: [[tx.id, tx.ngay, tx.loai, tx.soTien, tx.nhom, tx.hangMuc, tx.nhaThauId, tx.ghiChu || ""]],
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
      await updateTransactionOnline(tx);
      await loadAllData();
      renderAll();
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
      renderAll();
      showToast("Đã lưu giao dịch");
      return;
    } catch (e) {
      console.warn("Lưu online thất bại, chuyển sang hàng đợi:", e);
    }
  }

  state.pendingQueue.push(tx);
  saveQueue();
  renderAll();
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
      renderAll();
      showToast("Đã xoá giao dịch");
    } catch (e) {
      console.error(e);
      showToast("Lỗi khi xoá: " + e.message);
    }
  } else {
    state.pendingQueue = state.pendingQueue.filter((q) => q.id !== id);
    saveQueue();
    renderAll();
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
    renderAll();
    showToast("Đã đồng bộ xong các giao dịch chờ");
  } catch (e) {
    console.warn("Flush queue lỗi, sẽ thử lại sau:", e);
  } finally {
    isFlushing = false;
    updateSyncBadge();
  }
}

// ---------------------------------------------------------------
// Nhà thầu / danh mục mới
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
  renderAll();
  showToast("Đã thêm: " + name);
}

async function addCategory(nhom, name, type, budget) {
  if (!navigator.onLine) {
    showToast("Cần có mạng để thêm Nhóm/Hạng mục mới.");
    return;
  }
  const id = genId();
  await apiFetch(`${SHEETS_API}/${state.spreadsheetId}/values/DanhMuc!A2:F2:append?valueInputOption=USER_ENTERED`, {
    method: "POST",
    body: JSON.stringify({ values: [[id, nhom, name, type, Math.round(Number(budget) || 0), ""]] }),
  });
  await loadAllData();
  renderAll();
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

function openAddTransactionModal() {
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
    renderAll();
  } catch (e) {
    console.error(e);
    if (loadLocalCache()) {
      showToast("Không kết nối được Google Sheets, đang hiển thị dữ liệu đã lưu tạm.");
      renderAll();
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

  $("settingsBtn").addEventListener("click", () => openModal("settingsModal"));
  $("addNhaThauBtn").addEventListener("click", () => openModal("settingsModal"));

  $("newNhaThauForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = $("newNhaThauName").value.trim();
    const note = $("newNhaThauNote").value.trim();
    if (!name) return;
    try {
      await addNhaThau(name, note);
      $("newNhaThauForm").reset();
    } catch (err) {
      showToast("Lỗi: " + err.message);
    }
  });

  $("newCategoryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nhom = $("newCategoryNhom").value.trim();
    const name = $("newCategoryName").value.trim();
    const type = $("newCategoryType").value;
    const budget = $("newCategoryBudget").value;
    if (!nhom || !name) return;
    try {
      await addCategory(nhom, name, type, budget);
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
      renderAll();
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
  const titleTopEl = $("appTitleTop");
  const versionLoginEl = $("appVersionLogin");
  const versionSettingsEl = $("appVersionSettings");
  if (titleEl) titleEl.textContent = CONFIG.APP_NAME;
  if (titleTopEl) titleTopEl.textContent = CONFIG.APP_NAME;
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
