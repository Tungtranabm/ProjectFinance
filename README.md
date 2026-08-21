# Project Finance — PWA theo dõi thu chi nhiều dự án, lưu trên Google Sheets

**Phiên bản hiện tại: Ver 1.07** (xem chi tiết từng lần cập nhật trong `CHANGELOG.md`)

Ứng dụng web (PWA) chạy hoàn toàn ở phía trình duyệt — không có server riêng.
Khi bạn đăng nhập bằng Google, app sẽ tự tạo (hoặc tìm lại) **một file
Google Sheet duy nhất** trong Drive của bạn, tên là `Project Finance Data`,
và đọc/ghi dữ liệu trực tiếp vào đó.

App được thiết kế để theo dõi thu chi cho **nhiều dự án hoàn thiện nội
thất cùng lúc** (mỗi dự án là một công trình/căn hộ riêng). Sau khi đăng
nhập, bạn sẽ thấy màn hình **"Dự án của bạn"** — tạo bao nhiêu dự án tuỳ
ý, bấm vào một dự án để xem dashboard riêng của nó. Trong mỗi dự án, mỗi
giao dịch được gắn vào một **Nhóm** (VD: Xây dựng cơ bản, Hoàn thiện, Ốp
lát, Nội thất...) và **Hạng mục** con bên trong nhóm đó (VD: Xây, Tô,
Bả...) qua dropdown 2 tầng, kèm **Nhà cung cấp** (vật tư, vật liệu...)
hoặc **Đội thi công** thực hiện. Nhóm/Hạng mục và danh sách Nhà cung
cấp/Đội thi công dùng chung cho mọi dự án, còn **Ngân sách dự kiến** thì
đặt riêng cho từng dự án để app tự so sánh với số tiền đã chi thực tế
theo từng Nhóm của đúng dự án đó.

Vì không có server, bạn cần tự làm 2 việc **một lần duy nhất** trước khi
dùng được:

1. Tạo "OAuth Client ID" trên Google Cloud Console (để app được phép xin
   quyền đăng nhập Google của bạn).
2. Đưa các file này lên một địa chỉ HTTPS (GitHub Pages, Netlify... đều
   miễn phí) để cài lên điện thoại như một app thật.

Làm theo từng bước dưới đây, mất khoảng 10–15 phút cho lần đầu.

---

## Bước 1 — Tạo project trên Google Cloud Console

1. Vào https://console.cloud.google.com/ , đăng nhập bằng tài khoản Google
   bạn muốn dùng để lưu dữ liệu thu chi.
2. Góc trên bên trái, bấm vào tên project hiện tại → **New Project**.
3. Đặt tên bất kỳ, ví dụ `Project Finance`, bấm **Create**. Đợi vài giây rồi
   chọn project vừa tạo (góc trên trái).

## Bước 2 — Bật Google Sheets API và Google Drive API

1. Vào menu ☰ → **APIs & Services** → **Library**.
2. Tìm **Google Sheets API** → bấm vào → bấm **Enable**.
3. Quay lại Library, tìm **Google Drive API** → bấm vào → bấm **Enable**.

## Bước 3 — Cấu hình Google Auth Platform (xin quyền truy cập)

> Lưu ý: Google đã đổi giao diện bước này. Không còn gọi là "OAuth consent
> screen" theo dạng wizard 1 trang nữa - giờ gọi là **Google Auth
> Platform**, chia thành nhiều mục riêng ở thanh bên trái: **Overview,
> Branding, Audience, Clients, Data Access, Verification Center,
> Settings**. Nếu bạn thấy giao diện này (thay vì màn "OAuth consent
> screen" như mô tả cũ) thì làm theo đúng các mục bên dưới, chỉ khác cách
> gọi tên.

1. Vào menu ☰ → **APIs & Services**, hoặc gõ "Google Auth Platform" ở ô
   tìm kiếm trên cùng.
2. Vào mục **Branding** (thanh bên trái): điền
   - App name: `Project Finance`
   - User support email: email của bạn
   - Developer contact information: email của bạn
   Bấm **Save**.
3. Vào mục **Audience**: nếu được hỏi User Type, chọn **External**. Ở
   phần **Test users**, bấm **Add users**, nhập chính email Google của bạn
   → **Save**.
   > Vì app ở chế độ "Testing", chỉ những email được thêm ở đây mới đăng
   > nhập được. Muốn dùng thêm tài khoản khác (vd vợ/chồng) thì thêm email
   > đó vào danh sách này.
4. Vào mục **Data Access** (đây chính là nơi cấu hình "Scopes" - quyền
   truy cập): bấm **Add or remove scopes**, tìm và tick 2 quyền:
   - `.../auth/spreadsheets`
   - `.../auth/drive.file`
   Bấm **Update** → **Save**.

## Bước 4 — Tạo OAuth Client ID

1. Vào mục **Clients** (thanh bên trái, cùng khu vực Google Auth Platform
   với Branding/Audience/Data Access ở Bước 3). Nếu không thấy mục này,
   vào **APIs & Services** → **Credentials** rồi bấm **Create Credentials**
   → **OAuth client ID** - cả hai đường đều dẫn tới cùng một chỗ.
2. Bấm **Create client** (hoặc **Create Credentials** → **OAuth client ID**
   nếu bạn vào từ trang Credentials).
3. Application type: **Web application**.
4. Name: `Project Finance Web`.
5. Ở mục **Authorized JavaScript origins**, bấm **Add URI** và thêm địa chỉ
   HTTPS bạn sẽ dùng để mở app (xem Bước 5 để biết địa chỉ này trước, rồi
   quay lại đây điền — hoặc điền tạm rồi sửa lại sau):
   - Nếu dùng GitHub Pages: `https://<ten-tai-khoan>.github.io`
   - Nếu dùng Netlify: `https://<ten-app-ngau-nhien>.netlify.app`
   - Nếu chỉ test trên máy tính: `http://localhost:5500` (hoặc cổng bạn dùng)
   Bạn có thể thêm nhiều origin cùng lúc (vừa localhost để test, vừa domain
   thật để dùng hàng ngày).
6. Bấm **Create**. Một cửa sổ hiện ra với **Client ID** dạng:
   `123456789-abc...xyz.apps.googleusercontent.com`
   → Copy lại chuỗi này.

## Bước 5 — Điền Client ID vào app

Mở file `config.js` trong bộ file app, thay dòng:

```js
CLIENT_ID: "YOUR_CLIENT_ID.apps.googleusercontent.com",
```

bằng Client ID bạn vừa copy ở Bước 4, ví dụ:

```js
CLIENT_ID: "123456789-abc...xyz.apps.googleusercontent.com",
```

Lưu file lại.

## Bước 6 — Đưa app lên mạng (chọn 1 trong 2 cách)

### Cách A — GitHub Pages (khuyên dùng, miễn phí, ổn định)

1. Tạo một repository mới trên GitHub (public hoặc private đều được),
   ví dụ tên `project-finance`.
2. Tải toàn bộ nội dung thư mục này lên repo đó (kéo-thả trên giao diện
   web GitHub, hoặc dùng `git push` nếu quen dùng git).
3. Vào **Settings** → **Pages** của repo → ở mục **Source**, chọn nhánh
   `main` và thư mục `/ (root)` → **Save**.
4. Sau khoảng 1 phút, GitHub cho bạn địa chỉ dạng
   `https://<ten-tai-khoan>.github.io/project-finance/`.
5. Quay lại **Bước 4**, vào Credentials → sửa OAuth Client → đảm bảo
   **Authorized JavaScript origins** có đúng
   `https://<ten-tai-khoan>.github.io` (không cần thêm `/project-finance`,
   chỉ cần domain gốc).

### Cách B — Netlify Drop (nhanh nhất, kéo-thả)

1. Vào https://app.netlify.com/drop
2. Kéo thả cả thư mục `project-finance` vào trang đó.
3. Netlify cho bạn ngay một địa chỉ `https://<ten-ngau-nhien>.netlify.app`.
4. Quay lại Bước 4, thêm chính xác domain này vào **Authorized JavaScript
   origins**.

> ⚠️ Sau khi đổi Authorized JavaScript origins, đợi khoảng 5 phút để Google
> cập nhật rồi hãy thử đăng nhập.

## Bước 7 — Cài lên điện thoại như một app thật (PWA)

1. Mở địa chỉ HTTPS ở trên bằng trình duyệt trên điện thoại.
2. **iPhone (Safari):** bấm nút Share (hình vuông mũi tên lên) → **Add to
   Home Screen**.
3. **Android (Chrome):** bấm menu ⋮ → **Add to Home screen** / **Install
   app**.
4. Icon app sẽ xuất hiện ở màn hình chính, mở lên chạy toàn màn hình như
   app thường.

## Bước 8 — Đăng nhập lần đầu

1. Mở app, bấm **Đăng nhập với Google**.
2. Vì app đang ở chế độ "Testing" (chưa nộp Google duyệt công khai), bạn
   sẽ thấy cảnh báo **"Google hasn't verified this app"**. Đây là app do
   chính bạn tạo và chỉ bạn dùng, nên cứ bấm **Advanced** → **Go to
   Project Finance (unsafe)** → **Continue**/**Allow**. Cảnh báo này là bình
   thường với app tự làm cho cá nhân, không phải lỗi.
3. App sẽ tự tạo file `Project Finance Data` trong Drive của bạn, kèm sẵn
   2 đơn vị mẫu ("Đội thi công chính" - Đội thi công, "Chủ đầu tư / Nguồn
   vốn" - Nhà cung cấp) và bộ Nhóm/Hạng mục mẫu cho dự án nội thất (giống
   bản Excel nháp đã gửi bạn review trước đó) — dùng chung cho mọi dự án
   bạn sẽ tạo. Màn hình đầu tiên sẽ trống, bấm **"+ Thêm dự án"** để tạo
   dự án đầu tiên (VD: tên công trình/căn hộ), rồi vào ⚙ Cài đặt của dự
   án đó để đặt ngân sách dự kiến cho từng Hạng mục. Có thể thêm giao
   dịch, Nhà cung cấp/Đội thi công, Nhóm/Hạng mục mới thoải mái trong mục
   ⚙ Cài đặt bất cứ lúc nào.
4. Bạn có thể mở file Google Sheet gốc bất cứ lúc nào bằng nút **⚙ → Mở
   file Google Sheet ↗** trong app, hoặc tìm trực tiếp trong Google Drive.

---

## Cách hoạt động / giới hạn cần biết

- **Lưu trữ:** 5 sheet trong 1 file —
  - `DuAn` (danh sách dự án): ID, Tên, Ghi chú, Ngày tạo, **HoanTat**
    (`TRUE` nếu dự án đã đánh dấu hoàn tất, để trống nếu chưa).
  - `GiaoDich` (giao dịch): ID, Ngày, Loại (Thu/Chi), Số tiền, Nhóm, Hạng
    mục, NhaThauID, Ghi chú, **DuAnID** (dự án nào).
  - `NhaThau` (Nhà cung cấp/Đội thi công — dùng chung mọi dự án): ID,
    Tên, **Loai** (`NhaCungCap` hoặc `DoiThiCong`), Ghi chú.
  - `DanhMuc` (danh sách Nhóm/Hạng mục để chọn qua dropdown — dùng chung
    mọi dự án): ID, Nhóm, Hạng mục, Loại, Ghi chú.
  - `NganSach` (ngân sách dự kiến, riêng theo từng dự án): ID, **DuAnID**,
    Nhóm, Hạng mục, Ngân sách dự kiến, Ghi chú.
- **Nhiều dự án:** Màn hình "Dự án của bạn" là màn hình chính sau khi
  đăng nhập, liệt kê tất cả dự án kèm Tổng thu/Đã chi/Còn lại (hoặc "Chi
  vượt thu" nếu chi nhiều hơn thu) của từng dự án, cùng **Ngày bắt đầu**
  (ngày sớm nhất có giao dịch), **Ngày kết thúc** (ngày muộn nhất có giao
  dịch) và **Tổng số ngày** (tính cả ngày đầu, ngày cuối) — dự án chưa có
  giao dịch nào thì 2 mốc ngày hiện "—". Mở 1 dự án để vào dashboard chi
  tiết (chỉ lọc theo đúng dự án đó); bấm nút "←" ở góc trên để quay lại
  danh sách dự án. Nhóm/Hạng mục và danh sách Nhà cung cấp/Đội thi công
  dùng chung cho mọi dự án, còn Ngân sách dự kiến đặt riêng theo từng dự
  án.
- **Đánh dấu dự án "Hoàn tất":** mỗi thẻ dự án (màn hình "Dự án của bạn")
  có ô chọn **Hoàn tất** ngay trên thẻ, không cần vào sửa dự án. Bấm chọn
  khi công trình đã xong: dự án tự xếp xuống **cuối danh sách**, thẻ hiển
  thị mờ đi, và bên trong dự án đó nút "+" thêm giao dịch bị ẩn — mọi thao
  tác thêm/sửa/xoá giao dịch hoặc thêm/sửa ngân sách của dự án đó đều bị
  chặn (kèm thông báo), dữ liệu cũ vẫn xem lại bình thường. Tên/ghi chú
  của dự án vẫn sửa được như trước (bấm ✎) vì không phải "dữ liệu bên
  trong". Có thể bỏ đánh dấu bất cứ lúc nào để mở lại việc thêm/sửa.
- **Sửa tên dự án / Nhà cung cấp / Đội thi công:** bấm biểu tượng ✎ trên
  thẻ dự án (màn hình "Dự án của bạn") hoặc trên từng đơn vị (mục "Nhà
  cung cấp / Đội thi công" trong 1 dự án) để đổi tên/loại/ghi chú. **Xoá**
  dự án hoặc đơn vị thì app chưa có nút riêng — nếu thật sự cần xoá, làm
  trực tiếp trong Google Sheet (xoá dòng tương ứng ở sheet `DuAn` hoặc
  `NhaThau`), nhưng nhớ xoá luôn các dòng `GiaoDich`/`NganSach` liên quan
  tới ID đó, nếu không các dòng này sẽ bị "mồ côi" (vẫn còn trong Sheet
  nhưng app không hiển thị).
- **Sửa Nhóm/Hạng mục:** app cũng chưa có nút sửa/xoá cho mục này. Có thể
  sửa trực tiếp cột `HangMuc`/`GhiChu` trong sheet `DanhMuc`, nhưng **lưu
  ý:** cột `Nhom`/`HangMuc` trong `GiaoDich` và `NganSach` lưu theo TÊN
  CHỮ chứ không theo ID, nên nếu đổi tên 1 Nhóm/Hạng mục đã có giao dịch
  hoặc ngân sách, các dòng cũ sẽ KHÔNG tự cập nhật theo tên mới (số liệu
  cũ vẫn đúng nhưng bị tách riêng khỏi tên mới) — nếu chỉ đổi lỗi chính tả
  nhỏ thì có thể tự sửa thủ công cả những dòng cũ đó trong Sheet; nếu
  không chắc, nên thêm Hạng mục mới thay vì đổi tên cái cũ.
- **Ngân sách dự kiến vs thực chi:** Trong 1 dự án, vào ⚙ Cài đặt → mục
  "Đặt ngân sách cho dự án..." → chọn Nhóm + Hạng mục + số tiền → Lưu.
  Chỉ Hạng mục nào được đặt ngân sách ở đây mới hiện trong mục "Ngân sách
  theo nhóm" của dự án đó — thanh tiến độ chuyển vàng khi đạt 80% và đỏ
  khi vượt 100%. Nhập lại cùng Nhóm + Hạng mục để cập nhật số tiền mới
  (không tạo dòng trùng).
- **Nhà cung cấp / Đội thi công:** Mỗi giao dịch gắn với 1 đơn vị để biết
  đã thanh toán cho ai bao nhiêu. Khi thêm mới ở ⚙ Cài đặt, chọn đơn vị
  đó là **Nhà cung cấp** (vật tư, vật liệu, cửa hàng...) hay **Đội thi
  công** — 2 loại lưu tách riêng. Mục "Nhà cung cấp / Đội thi công" trên
  dashboard hiển thị dạng danh sách **2 cột song song** (Nhà cung cấp bên
  trái, Đội thi công bên phải), và **chỉ liệt kê những đơn vị đã thật sự
  phát sinh giao dịch trong dự án đang xem** (để đỡ rối khi bạn có nhiều
  dự án dùng chung 1 danh sách), **sắp xếp theo tổng đã chi từ nhiều đến
  ít** — mỗi cột hiện tối đa 5 đơn vị, nhiều hơn thì tự chuyển sang dạng
  cuộn (scroll) bên trong cột đó. Khi thêm giao dịch mới thì dropdown chọn
  đơn vị vẫn hiện đầy đủ toàn bộ danh sách dùng chung, kể cả đơn vị chưa
  từng dùng ở dự án này. Với các khoản Thu (VD: tạm ứng từ chủ đầu tư),
  bạn có thể chọn đơn vị mẫu "Chủ đầu tư / Nguồn vốn" hoặc tự thêm nguồn
  khác.
- **Ngoại tuyến:** Thêm giao dịch mới vẫn hoạt động khi mất mạng — được
  lưu tạm trên máy và tự đồng bộ lên Sheet khi có mạng lại (xem huy hiệu
  chấm tròn ở góc trên: xanh = đã đồng bộ, vàng = đang chờ, xám = ngoại
  tuyến). **Sửa/xoá** giao dịch, thêm Nhà cung cấp/Đội thi công/Nhóm/Hạng
  mục mới cần có mạng để tránh xung đột dữ liệu.
- **Đang dùng bản trước 1.07?** Không cần làm gì thêm — lần đăng nhập đầu
  tiên trên bản 1.07, app tự thêm cột `HoanTat` vào sheet `DuAn`. Toàn bộ
  dự án hiện có mặc định là **chưa hoàn tất**, không mất dữ liệu.
- **Đang dùng bản trước 1.06?** Không cần làm gì thêm — lần đăng nhập đầu
  tiên trên bản 1.06, app tự thêm cột phân loại vào sheet `NhaThau`. Các
  đơn vị đã có sẵn từ trước sẽ tạm thời được xếp vào nhóm "Nhà cung cấp"
  cho tới khi bạn bấm ✎ sửa lại đúng loại (Nhà cung cấp / Đội thi công)
  cho từng đơn vị.
- **Đang dùng bản cũ (1.02 trở về trước)?** Không cần làm gì thêm — lần
  đăng nhập đầu tiên trên bản 1.03, app tự phát hiện file Sheet cũ (chưa
  có sheet `DuAn`/`NganSach`) và tự nâng cấp: thêm 2 sheet mới, gom toàn
  bộ giao dịch và ngân sách cũ vào một dự án tên **"Dự án 1"**. Dữ liệu cũ
  không mất, bạn chỉ cần đổi tên dự án đó nếu muốn (hoặc tạo thêm dự án
  mới cho các công trình khác).
- **Nhiều thiết bị:** Vì dữ liệu nằm trên Google Sheet, bạn có thể đăng
  nhập cùng tài khoản trên nhiều điện thoại/máy tính, tất cả đều đọc/ghi
  chung 1 file.
- **Quyền truy cập:** App chỉ xin quyền `drive.file` (chỉ truy cập file do
  chính app tạo ra) và `spreadsheets` (đọc/ghi nội dung sheet) — không
  đụng tới các file khác trong Drive của bạn.
- **Xoá quyền truy cập:** Bất cứ lúc nào cũng có thể vào
  https://myaccount.google.com/permissions để thu hồi quyền của app.

## Muốn sửa/nâng cấp thêm?

Toàn bộ code nằm trong `index.html`, `style.css`, `app.js`, `config.js` —
là HTML/CSS/JS thuần, không cần build tool gì cả, sửa xong chỉ cần tải lại
trang là thấy thay đổi (hoặc push lại lên GitHub Pages/Netlify).

## Theo dõi phiên bản

Số phiên bản hiển thị ở màn hình đăng nhập và trong mục ⚙ Cài đặt. Mỗi lần
app được chỉnh sửa, số phiên bản sẽ tăng thêm 1 ở 2 số cuối (1.01 → 1.02 →
1.03 ...) và mô tả thay đổi được ghi lại trong `CHANGELOG.md` để dễ theo
dõi lịch sử. Nếu bạn tự sửa code, nhớ cập nhật cả 3 chỗ để đồng bộ:

1. `config.js` → `APP_VERSION`
2. `service-worker.js` → `CACHE_NAME` (để trình duyệt biết có bản mới cần
   tải lại, không dùng bản cache cũ)
3. `CHANGELOG.md` → thêm 1 dòng mô tả thay đổi
