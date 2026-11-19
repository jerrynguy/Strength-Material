# Sức bền vật liệu — Bộ giải thanh

Ứng dụng web tính toán Sức bền vật liệu cho **thanh thẳng** với sơ đồ do người dùng tự dựng: gối, khớp, tải trọng, tiết diện đều tuỳ chỉnh được.
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

## Lộ trình

- [ ] Khung phẳng / dầm nghiêng, dàn
- [ ] Bảng thép hình tiêu chuẩn (TCVN / JIS)
- [ ] Ổn định thanh chịu nén (Euler, hệ số φ)
- [ ] Lún gối, gối đàn hồi, nhiệt độ
- [ ] Xuất báo cáo PDF
