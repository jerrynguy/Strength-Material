# Sức bền vật liệu — Bộ giải thanh & khung phẳng

Ứng dụng web tính toán Sức bền vật liệu cho **thanh thẳng** (dầm, trục, cột) và **khung phẳng / dầm nghiêng** với sơ đồ do người dùng tự dựng: nút, thanh, gối, khớp, tải trọng, tiết diện đều tuỳ chỉnh được.
Bộ giải là **tất định**: tính bằng công thức và phương pháp số, không dùng AI để "đoán" đáp số.

## Tính năng

| Nhóm | Nội dung |
|---|---|
| **Cấu tạo hình học** | Phân loại **tĩnh định / siêu tĩnh (bậc n) / biến hình** bằng hạng ma trận liên kết; tách theo hệ con: kéo-nén, uốn đứng, uốn ngang, xoắn |
| **Liên kết** | Ngàm, gối cố định, gối di động, liên kết tuỳ chỉnh (chọn từng u_x, u_y, u_z, θ_x, θ_y, θ_z), khớp nối trong (dầm ghép) |
| **Tải trọng** | Lực tập trung theo phương bất kỳ (nhập thành phần hoặc độ lớn + góc), mô men uốn, mô men xoắn, lực phân bố đều / tam giác / hình thang theo x, y, z |
| **Nội lực** | Phản lực; biểu đồ N, Qy, Mz, Qz, My, T; giá trị tại mọi mặt cắt (cả hai phía bước nhảy); lời giải từng bước theo phương pháp mặt cắt |
| **Dạng chịu lực** | Tự nhận biết từng đoạn: kéo/nén đúng tâm, uốn thuần tuý, uốn ngang phẳng, uốn xiên, xoắn, uốn + kéo/nén, uốn + xoắn... (đơn giản / phức tạp) |
| **Tiết diện** | Chữ nhật, hộp rỗng, tròn, ống, I (cánh không đều), T, U, L, đa giác tuỳ ý có lỗ rỗng; A, I, W, J |
| **Ứng suất** | σ (Navier, kể cả uốn không đối xứng), τ (Jurapxki), τ xoắn (tròn / Bredt / thành mỏng hở / chữ nhật); σ₁, σ₃, vòng Mohr; thuyết bền 3 và 4; biểu đồ σ, τ theo chiều cao |
| **Biến dạng** | Độ võng v, w; góc xoay; chuyển vị dọc trục, ΔL; góc xoắn; ε, γ tại điểm |
| **Khác** | Bài mẫu, lưu/mở bài toán (.json), tự lưu trên trình duyệt, chạy được trên điện thoại |

## Khung phẳng / dầm nghiêng

| Nhóm | Nội dung |
|---|---|
| **Hình học** | Nút (X, Y) bất kỳ, thanh nối hai nút, mỗi thanh có tiết diện riêng; khớp ở đầu thanh (khung ba khớp, dầm ghép, dàn) |
| **Gối** | Ngàm, gối cố định, gối di động; **mặt tựa nghiêng** góc bất kỳ (phản lực vuông góc mặt nghiêng); liên kết tuỳ chỉnh |
| **Tải** | Lực/mô men tại nút; lực tập trung trên thanh (hệ tổng thể hoặc địa phương); tải phân bố đều/hình thang theo phương đứng, ngang, vuông góc hoặc dọc thanh. Tải đứng/ngang tính **trên 1 m chiều dài thanh** (trọng lượng bản thân) hoặc **trên 1 m hình chiếu** (tải sàn, mái, tuyết) |
| **Kết quả** | Tĩnh định / siêu tĩnh (bậc n) / biến hình, kể cả biến hình tức thời; phản lực (kể cả thành phần vuông góc/song song mặt tựa); biểu đồ N, Q, M vẽ trên khung (M về phía thớ căng); hình dạng biến dạng; chuyển vị và góc xoay nút; dạng chịu lực từng thanh; ứng suất tại điểm bất kỳ trên mọi thanh |
| **Tạo nhanh** | Dầm nghiêng từ nhịp ngang, chênh cao, loại gối, góc mặt tựa; bài mẫu: cầu thang gãy khúc, khung cổng, khung ba khớp, khung mái dốc, khung chữ L |

Khung phẳng tính bằng **ma trận cân bằng** (cấu tạo hình học) và **phương pháp ma trận độ cứng** với phần tử khung phẳng. Gối nghiêng đưa vào bằng nhân tử Lagrange. Nội lực dọc thanh tính chính xác theo phương pháp mặt cắt từ lực đầu thanh.

## Thép hình tiêu chuẩn

| Họ | Tiêu chuẩn | Số hiệu |
|---|---|---|
| I cán nóng (cánh dốc 12%) | GOST 8239-89 | I10 – I60 |
| U / C cán nóng (cánh dốc 10%) | GOST 8240-89 | U5 – U40 |
| L đều cạnh | GOST 8509-93 | L20×3 – L200×16 |
| H cán nóng | JIS G3192 | H100×100 – H600×200 |
| IPE, HEA, HEB | EN 10365 | IPE 80 – 600, HEA/HEB 100 – 500 |
| Ống tròn, hộp vuông, hộp chữ nhật | EN 10219 / kích thước thương mại | Ø21.3 – Ø406.4, □20 – □300, ▭40×20 – ▭300×200 |

- **Hình học thật:** mặt cắt dựng theo kích thước danh nghĩa, có góc lượn chân, lượn mép và cánh dốc (thép GOST). Hộp có góc lượn theo EN 10219. Mọi đặc trưng (A, I, W, S, i) và ứng suất đều tính từ cùng một hình học.
- **Kiểm chứng:** A và Iₓ tính được sai lệch < 1% so với bảng tra cho toàn bộ hơn 120 số hiệu có số liệu đối chiếu (`tests/steel.test.ts`).
- **Xoay 90°:** cho trường hợp uốn quanh trục yếu.
- **Chọn số hiệu thép:** duyệt cả họ thép, tính lại kết cấu với từng tiết diện (đúng cả cho hệ siêu tĩnh) rồi chọn tiết diện nhẹ nhất thoả cả ba điều kiện |σ| ≤ [σ], τ ≤ [σ]/√3, f ≤ L/n. Có tuỳ chọn kể trọng lượng bản thân. Dùng được cho dầm và cho từng nhóm tiết diện trong khung.
- **Chưa kiểm tra ổn định:** chưa có kiểm tra ổn định tổng thể và cục bộ. Kích thước lấy theo tiêu chuẩn, nên cần đối chiếu catalogue của nhà sản xuất khi lập hồ sơ thiết kế.

## Phương pháp

1. **Cấu tạo hình học:** mỗi đoạn giữa các khớp nối được coi là cứng tuyệt đối. Ma trận liên kết có hạng bằng số bậc tự do thì hệ bất biến hình; bậc siêu tĩnh = số liên kết − hạng.
2. **Phản lực:** phương pháp ma trận độ cứng (phần tử dầm Euler–Bernoulli Hermite bậc 3, phần tử thanh, phần tử xoắn) với tải phân bố quy về nút tương đương. Kết quả tại nút là chính xác, đúng cho cả hệ tĩnh định lẫn siêu tĩnh.
3. **Nội lực:** phương pháp mặt cắt (cân bằng phần bên trái) từ tải và phản lực, tính chính xác tại mọi x.
4. **Ứng suất:** σ = N/A − [(Mz·Iy − My·Iyz)·y + (My·Iz − Mz·Iyz)·z]/(Iy·Iz − Iyz²); τ = Q·S/(I·b).

## Quy ước dấu

- Trục x dọc thanh (trái → phải), y hướng lên, z vuông góc mặt phẳng hình vẽ.
- Tải nhập theo trục tổng thể: Fy < 0 và q < 0 (phương y) là **hướng xuống**; Mz > 0 ngược chiều kim đồng hồ.
- Nội lực: N > 0 kéo; Q > 0 khi làm phân tố quay thuận chiều kim đồng hồ; Mz > 0 căng thớ dưới (biểu đồ M vẽ về phía thớ căng).

## Chạy

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # kiểm chứng với các bài toán giải tích
npm run build    # bản tĩnh trong dist/
```

Mỗi lần push lên `main`, GitHub Actions chạy test rồi deploy lên GitHub Pages. Lần đầu cần bật: **Settings → Pages → Source: GitHub Actions**.

## Kiểm chứng

`tests/core.test.ts` so kết quả với lời giải giải tích:

- Đề mẫu Hình 1: Q_C = −30 kN, M_C = −70 kN·m.
- Đề mẫu Hình 2: σ_tđ (TB4) tại chân bản bụng = 11.369 MPa.
- Công-xôn: f = PL³/3EI.
- Dầm đơn giản: M = qL²/8, f = 5qL⁴/384EI.
- Hai đầu ngàm: M = qL²/12, siêu tĩnh bậc 3.
- Ngàm + gối di động: R = 3qL/8.
- Dầm ghép có khớp; thanh hai đầu ngàm chịu lực dọc.
- Chữ nhật: τ_max = 1.5Q/A; ống tròn xoắn; nhận biết dạng chịu lực.

`tests/frame.test.ts`:

- Dầm nghiêng: M = ql²/8 theo nhịp ngang; N = −V·sinα, Q = V·cosα; gối di động trên mặt nghiêng.
- Khung ba khớp: H = ql²/(8f), M tại khớp = 0.
- Khung cổng chân ngàm: siêu tĩnh bậc 3.
- Công-xôn: f = PL³/3EI.
- Khung chữ L.
- Dầm liên tục dựng bằng khung khớp với bộ giải dầm.
- Dàn tam giác.
- Phát hiện biến hình và biến hình tức thời (ba khớp thẳng hàng).

## Lộ trình

- [x] Khung phẳng / dầm nghiêng, dàn
- [ ] Lực nhiệt / lún gối cho khung
- [x] Bảng thép hình tiêu chuẩn (GOST, JIS, EN) + chọn số hiệu thép
- [ ] Ổn định thanh chịu nén (Euler, hệ số φ)
- [ ] Lún gối, gối đàn hồi, nhiệt độ
- [ ] Xuất báo cáo PDF
