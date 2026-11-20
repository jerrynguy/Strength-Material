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
- **Chọn số hiệu có kể ổn định:** khi chọn số hiệu thép có thể bật kiểm tra ổn định thanh nén (φ, μL). Chưa xét ổn định cục bộ và mất ổn định uốn–xoắn. Kích thước lấy theo tiêu chuẩn, nên cần đối chiếu catalogue của nhà sản xuất khi lập hồ sơ thiết kế.

## Ổn định thanh chịu nén

- **Độ mảnh:** λ = μL/i theo hai mặt phẳng. Mỗi phương có thể có liên kết (μ) và chiều dài khác nhau, ví dụ cột có giằng theo phương yếu. Với thép góc (mặt cắt không đối xứng), dùng **trục quán tính chính** (i_min).
- **Ứng suất tới hạn:** λ ≥ λ₀ dùng Euler σ_th = π²E/λ²; λ₁ ≤ λ < λ₀ dùng Iasinski σ_th = a − bλ (+ cλ² với gang); λ < λ₁ là thanh ngắn, σ_th = σ_ch.
- **Hai điều kiện kiểm tra:**
  - Theo hệ số an toàn: n_ôđ = P_th/N ≥ [n_ôđ].
  - Theo hệ số giảm ứng suất: σ = N/A ≤ φ[σ], với φ(λ) tra bảng có nội suy (thép CT3, gang, gỗ — theo bảng giáo trình SBVL, tham khảo; λ₀, a, b, c, σ_ch sửa được trên giao diện).
- **Chọn tiết diện theo phương pháp thử dần:** bắt đầu với φ₀ = 0.5 → A_yc → chọn số hiệu → tính λ, tra φ′ → lặp với φ₁ = (φ₀ + φ′)/2, rồi kiểm tra lại. App hiện lời giải từng lần thử.
- **Đồ thị** φ(λ) và σ_th(λ), đánh dấu điểm đang xét.
- **Tích hợp sẵn:**
  - Chế độ dầm/cột tự kiểm tra khi có lực nén, μ đoán từ liên kết hai đầu.
  - Chế độ khung kiểm tra từng thanh chịu nén, μ nhập riêng cho từng thanh.
  - Chọn số hiệu thép có thể kể thêm điều kiện ổn định.
- **Giới hạn:** ổn định cục bộ và ổn định uốn – xoắn của dầm chưa được kiểm tra.

## Nén – uốn đồng thời, phân tích bậc hai

- **Phân tích bậc hai (P-Δ):** dùng ma trận độ cứng hình học cho cả dầm và khung (khung lặp đến hội tụ lực dọc). Cân bằng được lập trên hình dạng đã biến dạng, có kể mô men phụ N·v. Bật bằng ô “Bậc hai (P-Δ)”.
- **Bài toán ổn định (trị riêng):**
  - Cho ra hệ số tới hạn α_th: tải tới hạn = α_th × tải hiện tại.
  - Cho ra dạng mất ổn định; với khung có xem trực quan.
  - Cho ra μ tương đương thật của từng thanh, kể cả cột khung không giằng.
  - Dùng được cho mọi liên kết.
- **Kiểm tra thanh nén – uốn theo 3 cách:**
  1. Bền bậc hai với tải thực: σ_max ≤ [σ].
  2. Theo giáo trình: tải nhân n, phân tích bậc hai, σ_max ≤ σ_ch.
  3. Công thức tương tác: N/(φA) + M/(W(1 − N/N_th)) ≤ [σ].
- **Kiểm chứng:**
  - Lực Euler cho 4 kiểu liên kết.
  - Khung cổng chân ngàm (μ = 1) và chân khớp (μ = 2).
  - Mô men dầm-cột khớp Timoshenko (qL²/8)·2(sec u − 1)/u².
  - Cột công-xôn: M = H·tan(kL)/k.

## Ổn định uốn – xoắn của dầm

- **M_cr bằng phần tử hữu hạn:** hai ẩn là chuyển vị ngang u và góc xoắn φ, có EI_y, GI_t, EI_w, tính với biểu đồ mô men thực. Không cần tra C1/C2; áp dụng được với mọi tải, gối, ngàm (kiềm chế vênh) và giằng ngang/chống xoắn trong nhịp. Kể được cao độ đặt tải: cánh trên, tâm cắt, cánh dưới.
- **Đặc trưng mặt cắt:**
  - I_w (hằng số quạt) và tâm cắt cho chữ I (kể cả cánh không đều), U, T, L.
  - I_t của thép cán chữ I/H theo El Darwish – Johnston (kể góc lượn): IPE 300 tính ra 19,9 cm⁴ (bảng 20,12); HEB 300 tính ra 185 cm⁴ (bảng 185).
- **Kiểm tra:** theo EN 1993-1-1 §6.3.2.2 với λ̄_LT, đường cong a–d tự chọn theo loại thép và h/b, χ_LT; điều kiện |M| ≤ χ_LT·W·[σ].
- **Tích hợp vào chọn số hiệu thép:** có thể bật kiểm tra uốn – xoắn khi chọn số hiệu cho dầm.
- **Kiểm chứng:**
  - Mô men đều: khớp công thức giải tích (sai số < 0,2%).
  - Hệ số C1: tải phân bố đều 1,131; lực tập trung giữa nhịp 1,36.
  - Giằng giữa nhịp: bằng dầm nhịp L/2.
  - I_w của IPE 300 khớp bảng EN.
- **Giới hạn:** bỏ qua hiệu ứng Wagner với mặt cắt chỉ đối xứng một trục; chưa xét uốn – xoắn của thanh trong khung.

## Ổn định cục bộ bản cánh, bản bụng

- **Tách mặt cắt thành các tấm:** tấm vươn (cánh I/U/T, cánh thép góc, sườn T) và tấm tựa hai mép (bụng I/U, thành hộp). Thép cán tính c trừ góc lượn.
- **Ứng suất ở hai mép tấm** lấy từ nội lực thực (N, Mz, My), ở mặt cắt bất lợi nhất dọc thanh → ψ, rồi k_σ theo EN 1993-1-5 (bảng 4.1, 4.2).
- **Ứng suất tới hạn:** σ_cr = k_σ·π²E/(12(1−ν²))·(t/c)²; app hiện thêm hệ số an toàn n = σ_cr/σ.
- **Phân loại tiết diện 1–4** theo EN 1993-1-1 bảng 5.2 (ε = √(235/f_y)), gồm các trường hợp riêng cho ống tròn (D/t) và thép góc chịu nén. Tấm loại 4: hệ số ρ, kiểm tra gần đúng σ ≤ ρ[σ].
- **Ổn định bản bụng chịu cắt:** h_w/t_w so với 72ε/η; k_τ (có thể khai báo sườn ngang cách a), λ̄_w, χ_w; điều kiện τ ≤ χ_w[σ]/√3.
- **Tích hợp:**
  - Có mặt ở chế độ dầm, khung (chọn từng thanh) và ổn định (nén đúng tâm).
  - Chọn số hiệu thép có thêm cột loại tiết diện và kiểm tra cục bộ.
- **Kiểm chứng:**
  - IPE 300 chịu nén là loại 2, chịu uốn là loại 1.
  - IPE 600 chịu nén là loại 4.
  - Các hệ số k_σ = 4 / 23,9 / 0,43; k_τ = 9,34 khi a = h_w; λ̄_w khớp công thức EN.

## Tiết diện hữu hiệu (tiết diện loại 4)

- **Chiều rộng hữu hiệu** theo EN 1993-1-5 §4.3 (bảng 4.1, 4.2): b_eff, b_e1, b_e2 theo ψ. Phần không hữu hiệu được khoét khỏi hình học thật của mặt cắt, nên A_eff, I_eff, W_eff, trọng tâm hữu hiệu đều tính lại chính xác; trên hình vẽ, phần này tô đỏ.
- **Tính lặp:** khoét cánh làm trục trung hoà dịch đi và đổi phân bố ứng suất trên bụng (EN 4.4(3)), nên app lặp đến khi vùng khoét hội tụ. ρ tính với σ_com = f_y, nên tiết diện hữu hiệu không phụ thuộc độ lớn nội lực.
- **A_eff và W_eff tính riêng:** A_eff và độ lệch trọng tâm e_N khi chịu nén đều; W_eff,z, W_eff,y khi chịu uốn theo từng chiều mô men.
- **Kiểm tra** theo EN 1993-1-1 6.2.9.3: σ = N/A_eff + (|M| + |N|·e_N)/W_eff ≤ [σ], tại mặt cắt bất lợi nhất dọc thanh.
- **Đưa vào các phần khác:**
  - Ổn định thanh nén dùng σ = N/A_eff.
  - Công thức tương tác nén – uốn dùng A_eff, W_eff; uốn – xoắn dùng W_eff.
  - Chọn số hiệu thép và báo cáo PDF.
- **Kiểm chứng:**
  - IPE 600 chịu nén: A_eff = A − c(1 − ρ)t_w.
  - Cánh vươn mảnh: A_eff = A − 4(1 − ρ)c·t, khoét ở mép tự do.
  - Dầm bụng mảnh chịu uốn: b_e1 = 0.4·b_eff đo từ mép nén, vòng lặp hội tụ.
- **Giới hạn:** chưa có sườn dọc; chưa áp dụng cho vỏ trụ (ống tròn loại 4 theo EN 1993-1-6). Với thép GOST cánh dốc, phần khoét lấy theo bề dày trung bình.

## Sườn dọc bản bụng

- **Khai báo:** thêm sườn dọc dạng bản phẳng cho tiết diện chữ I tổ hợp hàn (vị trí tính từ mép trên bụng, bề rộng, bề dày, một hoặc hai phía). A, I, W có kể sườn.
- **Ổn định cục bộ:** bản bụng được chia thành các ô giữa các sườn; mỗi ô và từng sườn (tấm vươn) được phân loại và tính b_eff riêng.
- **Mất ổn định tổng thể của bụng có sườn** (EN 1993-1-5 A.2.2, mô hình thanh trên nền đàn hồi):
  - Sườn cùng dải bụng góp hai bên (theo phân bố b_eff) tạo thành thanh có A_sl, I_sl.
  - Tính a_c và σ_cr,sl (hai trường hợp a ≥ a_c và a < a_c), rồi ngoại suy thành σ_cr,c ở mép nén.
  - Tính λ̄_c, α_e = 0.49 + 0.09/(i/e) và χ_c.
  - ρ_c = χ_c dùng để giảm bề dày vùng nén của bụng (trừ dải biên sát cánh) và của sườn (EN §4.5.1). Bỏ qua làm việc kiểu tấm nên kết quả thiên về an toàn.
- **Ổn định cắt** (EN 1993-1-5 A.3): k_τ có thêm k_τsl từ I_sl, đồng thời kiểm tra ô bụng lớn nhất.
- **Kiểm chứng:** A_sl, σ_cr,sl khớp công thức; sườn khoẻ cho χ_c lớn hơn sườn yếu; sườn làm tăng W_eff và τ_cr. Ví dụ bụng 1400×8 thêm sườn 120×12 tại 0,2h_w: σ khi uốn giảm từ 154,7 xuống 141,1 MPa; τ_cr tăng từ 31,5 lên 49,2 MPa.

## Xuất báo cáo PDF

Bấm nút **Xuất báo cáo PDF** để mở trang xem trước báo cáo, rồi bấm **In / Lưu PDF** và chọn “Lưu dưới dạng PDF”. App xuất qua chức năng in của trình duyệt: tiếng Việt hiển thị đúng, hình vẽ dạng vector, chữ trong PDF chọn và tìm kiếm được, không cần thư viện ngoài.

- **Khung báo cáo chung:** đầu báo cáo (tên bài toán, loại bài toán, ngày, người lập), mục kết luận chung dạng ĐẠT / KHÔNG ĐẠT, và phần ghi phương pháp, quy ước dấu ở cuối.
- **Thanh thẳng:**
  - Sơ đồ tính, vật liệu, mặt cắt, liên kết, tải trọng.
  - Cấu tạo hình học, phản lực kèm kiểm tra cân bằng, dạng chịu lực, biểu đồ nội lực, chuyển vị.
  - Ứng suất tại điểm nguy hiểm nhất, và tại chỗ tiếp giáp bụng – cánh theo thuyết bền 4.
  - Ổn định nén, nén – uốn, uốn – xoắn, ổn định cục bộ.
- **Khung:**
  - Dữ liệu nút, thanh, tiết diện, gối, tải.
  - Phản lực, nội lực đầu thanh, biểu đồ N/Q/M trên khung, biến dạng, bền từng thanh.
  - Hệ số tới hạn α_th và dạng mất ổn định; ổn định, nén – uốn, cục bộ từng thanh.
- **Ổn định:** dữ liệu, kết quả, đồ thị φ(λ) và σ_th(λ), lời giải, ổn định cục bộ.
- **Sườn dọc bản bụng** (cả ba loại báo cáo):
  - Phần đầu vào: bảng sườn (vị trí, b_s × t_s, phía, diện tích) và cách chia ô bụng.
  - Phần ổn định: bảng thanh sườn (b1/b2, A_sl, I_sl, a_c, σ_cr,sl → σ_cr,c, λ̄_c, α_e, χ_c, ρ_c), ổn định cắt có sườn dọc (k_τ, τ_cr, χ_w), lời giải.
  - Báo cáo khung có phần riêng cho từng thanh có sườn.
- **Thông số ổn định cục bộ trong báo cáo:** f_y và khoảng cách sườn ngang a lấy đúng theo giá trị đang nhập trong thẻ “Ổn định cục bộ” của từng chế độ (lưu trên trình duyệt). Các giá trị này cũng được dùng cho chọn số hiệu thép, tiết diện hữu hiệu trong kiểm tra ổn định nén, nén – uốn và uốn – xoắn.
- **Khối lượng riêng và trọng lượng bản thân:**
  - Vật liệu có ρ (kg/m³, mặc định thép 7850; mẫu bê tông 2500, gỗ khoảng 600).
  - Ô “Kể trọng lượng bản thân” trong phần tải trọng: thanh thẳng chọn dầm nằm ngang (−y) hoặc cột đứng chân tại x = 0 (dọc trục −x); khung tự cộng ρ·g·A cho từng thanh theo vật liệu và tiết diện của thanh, phương đứng.
  - Tải này được cộng vào mọi phép tính, kể cả khi nhân tải × n.
  - Khối lượng kg/m của mặt cắt và của các số hiệu khi chọn thép tính theo ρ. Chọn số hiệu không cộng trọng lượng bản thân hai lần khi mô hình đã bật ô này.
  - Báo cáo có ρ và dòng tải “g (bản thân)”.
- **Trọng lượng bản thân trong chế độ ổn định:**
  - Ô “Kể trọng lượng bản thân cột”: G = ρ·g·A·L, lực dọc tăng dần về chân cột.
  - Kiểm tra ổn định dùng lực tương đương ở đỉnh N_tđ = N_th,đỉnh/α_th, với α_th từ bài toán trị riêng có cả N và G, cho các liên kết chuẩn μ = 1; 0,7; 0,5; 2. Với μ khác hoặc cột có giằng, lấy N_tđ = N + G (an toàn).
  - Kiểm tra thêm bền tại chân cột (N + G)/A ≤ [σ]; ổn định cục bộ dùng N + G.
  - Chọn tiết diện thử dần tính G theo từng số hiệu.
  - Kiểm chứng Greenhill: công-xôn (qL)_th = 7,837EI/L²; hai đầu khớp 18,6EI/L².
  - Áp dụng cả trong chế độ thanh thẳng: với cột bật trọng lượng bản thân dọc trục, thẻ “Kiểm tra ổn định”, báo cáo và chọn số hiệu thép dùng N_tđ (lực ở đỉnh lấy tại x = L⁻), kèm kiểm tra bền tại chân cột.
- **Khung: mỗi thanh một vật liệu riêng.**
  - Thẻ “Thư viện vật liệu” có các mẫu (thép CT3, S355/Q345, bê tông B20, gỗ — giá trị [σ] chỉ để tham khảo); mỗi thanh chọn vật liệu ở mục “Thanh”, bỏ trống thì dùng vật liệu chung.
  - E của từng thanh được dùng khi giải khung (độ cứng, P-Δ, bài toán ổn định); [σ], ν, f_y của vật liệu thanh được dùng cho kiểm tra bền, ổn định, nén – uốn, cục bộ và chọn số hiệu thép (hệ số sử dụng theo [σ] từng thanh).
  - Báo cáo có bảng vật liệu và vật liệu của từng thanh.
  - f_y của thanh lấy theo thứ tự: f_y riêng của thanh → f_y của vật liệu → f_y chung của khung.
- **Khung: mỗi thanh một f_y riêng.** Ô “f_y riêng” trong danh sách thanh, hoặc ô f_y của thanh trong thẻ ổn định cục bộ. Bỏ trống thì thanh dùng f_y chung của khung. f_y riêng được dùng cho ổn định cục bộ (ε), tiết diện hữu hiệu, và làm σ_ch của thanh trong kiểm tra nén – uốn và công thức Iasinski cho thanh ngắn. Báo cáo có cột “f_y (MPa)” đánh dấu “(riêng)”. Ứng suất cho phép [σ] lấy theo vật liệu của thanh.
- **Khung: mỗi thanh một khoảng cách sườn ngang.**
  - Nhập trong danh sách thanh (ô “a sườn ngang riêng”) hoặc ngay trong thẻ ổn định cục bộ của thanh; lưu cùng mô hình (.json).
  - Thanh không đặt giá trị riêng thì dùng giá trị chung của khung; 0 nghĩa là không có sườn ngang.
  - Báo cáo khung có cột “Sườn ngang a” cho từng thanh, đánh dấu “(riêng)”.
- **Bật/tắt từng phần:** dữ liệu đầu vào, biểu đồ, ứng suất, ổn định, lời giải từng bước.

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

`tests/stability.test.ts`:

- Euler: P_th = π²EI/(μL)².
- Iasinski CT3 liên tục với đường Euler tại λ₀.
- Nội suy bảng φ.
- Thép góc dùng trục chính: i_min của L100×10 ≈ 1,96 cm, khớp bảng GOST.
- Thử dần chọn tiết diện.

## Lộ trình

- [x] Khung phẳng / dầm nghiêng, dàn
- [ ] Lực nhiệt / lún gối cho khung
- [x] Bảng thép hình tiêu chuẩn (GOST, JIS, EN) + chọn số hiệu thép
- [x] Ổn định thanh chịu nén (Euler, Iasinski, hệ số φ)
- [x] Nén – uốn đồng thời, phân tích bậc hai P-Δ, hệ số tới hạn khung
- [x] Ổn định uốn – xoắn của dầm (M_cr bằng phần tử hữu hạn, χ_LT theo EN 1993-1-1)
- [x] Ổn định cục bộ bản cánh / bản bụng, phân loại tiết diện, ổn định bụng chịu cắt
- [x] Tiết diện hữu hiệu đầy đủ cho loại 4 (A_eff, W_eff, e_N, tính lặp)
- [x] Sườn dọc bản bụng (EN 1993-1-5 A.2, A.3)
- [ ] Làm việc kiểu tấm của bản có sườn (A.1), vỏ trụ loại 4
- [ ] Lún gối, gối đàn hồi, nhiệt độ
- [x] Xuất báo cáo PDF (thanh thẳng, khung, ổn định)
