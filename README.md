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
- **Chọn số hiệu có kể ổn định:** khi chọn số hiệu thép có thể bật kiểm tra ổn định thanh nén (φ, μL). Có thể bật thêm ổn định cục bộ và uốn – xoắn (dầm và thanh khung). Kích thước lấy theo tiêu chuẩn, nên cần đối chiếu catalogue của nhà sản xuất khi lập hồ sơ thiết kế.

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
- **Giới hạn:** ổn định cục bộ và uốn – xoắn có ở các mục riêng bên dưới.

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
- **Hiệu ứng Wagner** (mặt cắt đối xứng một trục: chữ I khác cánh, chữ T, thép góc): thêm số hạng ½∫(GI_t − M·β_y)φ′²dx với β_y = (1/I_z)∫y(y² + z²)dA − 2y_0, tích phân chính xác trên đa giác mặt cắt. Cánh lớn chịu nén làm tăng M_cr, cánh nhỏ chịu nén làm giảm. Vì phổ trị riêng không còn đối xứng ±, app kiểm tra bằng quán tính Sylvester để chắc chắn lấy trị riêng dương nhỏ nhất. Kiểm chứng: mô men đều, gối chạc M_cr = P_y[∓β/2 + √(β²/4 + I_w/I_y + GI_tL²/(π²EI_y))].
- **Thanh khung:** thẻ “Ổn định uốn – xoắn các thanh khung” giải cho từng thanh với biểu đồ mô men, tải ngang và lực tập trung thực của thanh (hệ địa phương).
  - Hai đầu thanh là gối chạc; đầu tự do của công-xôn không có liên kết và đầu còn lại kiềm chế vênh.
  - Nhập số giằng chia đều nhịp cho từng thanh; f_y và a sườn ngang theo từng thanh.
  - Có trong báo cáo PDF và chọn số hiệu thép cho khung. Kiểm chứng: dầm đơn giản và công-xôn mô hình bằng khung cho cùng M_cr như chế độ dầm.
- **Phương pháp tổng quát cho thanh khung (EN 1993-1-1 §6.3.4):** cùng thẻ uốn – xoắn khung, có thêm bảng riêng.
  - α_ult,k = 1/max[|N|/(A·f_y) + |M|/(W·f_y)] dọc thanh, nội lực trong mặt phẳng lấy từ phân tích bậc hai P-Δ; tiết diện loại 4 dùng A_eff, W_eff.
  - α_cr,op: bài toán trị riêng ngoài mặt phẳng khi tăng đồng thời N(x) và M(x) thực của thanh. K_G gồm ∫M·u″φ, ½∫N[u′² − 2y₀u′φ′ + r₀²φ′²], Wagner và tải lệch tâm cắt. Bao gồm uốn ngang quanh trục yếu, xoắn và uốn – xoắn.
  - λ̄_op = √(α_ult,k/α_cr,op); χ_op = min(χ_z, χ_LT) (6.3.4(4)a; χ_z theo bảng 6.2 trục z–z); điều kiện χ_op·α_ult,k ≥ f_y/[σ].
  - Có trong báo cáo PDF và chọn số hiệu thép cho khung (lấy hệ số sử dụng lớn hơn của §6.3.2 và §6.3.4).
  - Kiểm chứng: nén thuần α_cr,op·P = min(N_cr,z, N_cr,T); uốn thuần trùng M_cr của thẻ uốn – xoắn; nén + mô men đều khớp nghiệm (P_y − αP)(P_T − αP) = α²M²/r₀².
  - Giới hạn: thép chữ U, góc bỏ qua độ lệch tâm cắt theo phương z.

## Khung: nhiệt độ, lún gối, gối đàn hồi

- **Nhiệt độ trên thanh** (tải “Nhiệt độ”): nhập độ tăng nhiệt thớ trên (phía +y′) và thớ dưới, phân bố tuyến tính theo chiều cao h.
  - Biến dạng ban đầu ε₀ = α_t·ΔT tại trục trọng tâm (nội suy theo vị trí trọng tâm), độ cong κ₀ = α_t(T_dưới − T_trên)/h.
  - Quy về lực nút tương đương EA·ε₀ (dọc trục) và EI·κ₀ (mô men) trên từng phần tử; nội lực N = EA(ε − ε₀), M = EI(κ − κ₀).
  - Hệ số giãn nở α_t nhập cho vật liệu chung và từng vật liệu trong thư viện (thép 12, bê tông 10, gỗ dọc thớ ~5 ×10⁻⁶/°C).
- **Lún gối / chuyển vị cưỡng bức:** mỗi gối cứng nhập Δx, Δy (mm, hệ tổng thể) và góc xoay φ (‰ rad); chỉ có tác dụng theo các phương gối chặn. Đưa vào vế phải của các ràng buộc Lagrange.
- **Gối đàn hồi:** lò xo k_x, k_y (kN/m) và k_φ (kN·m/rad), cộng thẳng vào ma trận độ cứng; phản lực R = −k·u. Có thể đặt cùng nút với gối khác (ví dụ khớp + lò xo xoay = ngàm đàn hồi). Lò xo được tính là liên kết khi phân tích cấu tạo hình học.
- Hệ tĩnh định: nhiệt độ và lún gối chỉ gây chuyển vị, không gây nội lực; hệ siêu tĩnh phát sinh nội lực. Bài mẫu “Khung siêu tĩnh: nhiệt độ, lún gối, gối đàn hồi”.
- Hệ số tải (phân tích bậc hai, kiểm tra nén – uốn với n·tải) nhân cả nhiệt độ và lún gối.
- **Kiểm chứng:** ngàm – ngàm tăng nhiệt đều N = −EAα_tΔT; chênh nhiệt M = −EIα_tΔT/h; dầm đơn giản giãn α_tΔTL, võng κ₀L²/8 không có nội lực; lún gối ngàm – ngàm R = 12EIΔ/L³, M = 6EIΔ/L²; ngàm – di động R = 3EIΔ/L³; xoay cưỡng bức M = 4EIθ/L; công-xôn tựa lò xo R = P·k/(k + 3EI/L³); lò xo xoay chân cột φ = H·h/k_φ.

## Chế độ thanh thẳng: nhiệt độ, lún gối

- **Nhiệt độ** (tải “+ Nhiệt độ”): đoạn [x₁, x₂], độ tăng nhiệt thớ trên (+y) và thớ dưới. ε₀ = α_t·ΔT tại trọng tâm vào hệ con kéo/nén (lực nút EA·ε₀); κ₀ = α_t(T_dưới − T_trên)/h vào hệ con uốn đứng (mô men nút EI·κ₀). α_t nhập ở phần vật liệu.
- **Lún gối:** mỗi gối nhập Δx, Δy, Δz (mm) và góc xoay φ_z, φ_y (‰ rad) theo các phương gối chặn (ô chỉ hiện với phương bị chặn). Bậc tự do bị chặn nhận giá trị cưỡng bức, giải K_ff·u_f = F_f − K_fp·u_p, phản lực R = K·u − F.
- **Chênh nhiệt hai bên** ΔT_z = T(+z) − T(−z): độ cong ngang κ₀,w = −α_t·ΔT_z/b (b — bề rộng theo z) vào hệ con uốn ngang; thanh cong vồng về phía nóng hơn. Kiểm chứng: ngàm – ngàm |M_y| = EI_y·α_t·ΔT_z/b, thớ phía nóng bị nén; dầm đơn giản võng ngang α_t·ΔT_z·L²/(8b) không nội lực. (Chế độ khung là hệ phẳng nên không có uốn ngang.)
- Lực dọc dùng cho phân tích bậc hai lấy EA(ε − ε₀); thanh ngàm hai đầu bị nung nóng chịu nén và tự kể hiệu ứng P-Δ, ổn định.
- Có trong hình vẽ, báo cáo PDF (bảng liên kết có cột lún gối, bảng tải có dòng nhiệt độ), bài mẫu “Dầm liên tục: lún gối và nhiệt độ”.
- **Kiểm chứng:** ngàm – ngàm N = −EAα_tΔT (cả khi nung nửa thanh: −EAα_tΔT/2), M = −EIα_tΔT/h; dầm đơn giản giãn α_tΔTL, võng κ₀L²/8 không nội lực; lún gối ngàm – ngàm R = 12EIΔ/L³, M = 6EIΔ/L²; dầm liên tục hai nhịp gối giữa lún R = 6EIΔ/L³; xoay cưỡng bức M = 4EIθ/L; lún theo phương tự do không có tác dụng.

## Chế độ thanh thẳng: gối đàn hồi

- Loại gối “Gối đàn hồi (lò xo)” với k_x, k_y, k_z (kN/m) và k_φx (xoắn), k_φy, k_φz (kN·m/rad); k = 0 là tự do theo phương đó.
- Mỗi lò xo cộng vào ma trận độ cứng của hệ con tương ứng (kéo/nén, uốn đứng, uốn ngang, xoắn); phản lực R = −k·u, báo riêng cho từng gối kể cả khi đặt trùng vị trí với gối khác (ví dụ gối khớp + lò xo xoay = ngàm đàn hồi).
- Khi phân tích cấu tạo hình học, lò xo được tính là một liên kết (công-xôn + lò xo ở đầu tự do là siêu tĩnh bậc 1).
- Bài toán ổn định (hệ số tới hạn, μ tự động, N_tđ) có kể lò xo. Đồng thời sửa vectơ khởi đầu của phép lặp trị riêng (thêm các nửa sóng phản đối xứng) — trước đây dầm/cột đối xứng có gối giữa nhịp có thể bỏ sót dạng mất ổn định thấp nhất.
- Bài mẫu “Dầm trên các gối đàn hồi (lò xo)”.
- **Kiểm chứng:** công-xôn tựa lò xo R = P·k/(k + 3EI/L³); dầm đơn giản có lò xo giữa nhịp R = (5qL⁴/384EI)/(1/k + L³/48EI); khớp + lò xo xoay M_A = θ₀/(L/3EI + 1/k) → qL²/8 khi k → ∞; lò xo dọc trục và xoắn phân phối theo độ cứng; cột khớp hai đầu có lò xo ngang giữa cột rất cứng N_th = 4π²EI/L².

## Tâm cắt lệch theo z (thép U, thép góc) — mất ổn định xoắn và uốn – xoắn

- **Tâm cắt:** thép U nằm phía ngoài bụng, cách đường tim bụng e = 3b²t_f/(6bt_f + ht_w); thép góc tại giao điểm đường tim hai cánh. Lưu cả y₀ và z₀ so với trọng tâm.
- **Thanh chịu nén đúng tâm (mọi chế độ dùng hệ số φ):** thêm kiểm tra mất ổn định xoắn / uốn – xoắn cho mặt cắt hở, theo hệ trục quán tính chính:
  (N₁ − P)(N₂ − P)·i₀²(N_T − P) − (N₁ − P)·P²c₁² − (N₂ − P)·P²c₂² = 0, i₀² = (I₁ + I₂)/A + c₁² + c₂², N_T = (GI_t + π²EI_w/(μ_T L)²)/i₀².
  Nghiệm nhỏ nhất N_TF đổi thành độ mảnh tương đương λ_TF = π√(EA/N_TF) và đưa vào bảng các phương; nếu lớn hơn λ uốn thì quyết định φ. μ_T·L lấy giá trị lớn hơn của hai phương (an toàn).
- **Phương pháp tổng quát (thanh khung):** r₀² trong số hạng lực dọc có thêm z₀² (chuyển vị trong mặt phẳng giữ bằng 0 — α_cr,op chỉ xét ngoài mặt phẳng).
- **Uốn – xoắn của thép U uốn quanh trục mạnh:** U đối xứng qua trục mạnh nên β_y = 0, M_cr không đổi; tải đặt qua bụng (không qua tâm cắt) gây xoắn — là vấn đề bền, không phải ổn định.
- **Kiểm chứng:** thép góc đều cạnh và thép U khớp công thức cổ điển N_TF = [(N + N_T) − √((N + N_T)² − 4βN·N_T)]/(2β), β = 1 − (c/i₀)²; mặt cắt đối xứng hai trục cho min(N₁, N₂, N_T); thép góc ngắn do uốn – xoắn quyết định, thép góc dài do uốn quanh trục yếu.

## Lời giải theo phương pháp giáo trình (chế độ thanh thẳng, mặt phẳng xy)

Thẻ “Lời giải theo phương pháp giáo trình” (và mục tương ứng trong báo cáo PDF) trình bày cách giải bằng tay; mọi kết quả được đối chiếu với lời giải số.

- **Phản lực bằng phương trình cân bằng (hệ tĩnh định):** lập ΣM quanh từng gối, điều kiện M = 0 của từng phần quanh khớp nối, ΣY, ΣX; mỗi bước chọn phương trình chỉ còn một ẩn để giải (như khi làm tay), phần còn lại giải đồng thời; cuối cùng kiểm tra bằng một phương trình chưa dùng.
- **Chuyển vị bằng lực đơn vị (Mohr – Maxwell, nhân biểu đồ Vereshchagin):** chọn điểm x và đại lượng (độ võng v, góc xoay θ, chuyển vị dọc u); vẽ biểu đồ m̄ của trạng thái đơn vị; trên mỗi đoạn mà m̄ là đường thẳng tính Ω·ȳ (biểu đồ đổi dấu thì tách thành các phần cùng dấu); kể cả số hạng nhiệt độ ∫(m̄κ₀ + n̄ε₀), lò xo Σr̄R/k và lún gối −Σr̄c. Hệ siêu tĩnh dùng định lý rút gọn (đặt lực đơn vị trên hệ cơ bản).
- **Phương pháp lực (hệ siêu tĩnh):** tự chọn ẩn thừa (bạn đánh dấu để đổi), hệ cơ bản, biểu đồ M_P và mᵢ; δᵢⱼ, Δᵢₚ bằng nhân biểu đồ (có lò xo, nhiệt độ, lún gối); hệ phương trình chính tắc Σδᵢⱼ·Xⱼ + Δᵢₚ = cᵢ; nghiệm Xᵢ, phản lực cuối và sai khác mô men so với lời giải số.
- **Kiểm chứng:** dầm đơn giản V_B = Pa/L; dầm ghép dùng điều kiện khớp; v = PL³/48EI, 5qL⁴/384EI, PL³/3EI, θ = PL²/2EI; ngàm – di động X₁ = 3qL/8, δ₁₁ = L³/3EI, v(L/2) = qL⁴/192EI theo định lý rút gọn; dầm liên tục V_giữa = 1.25qL (chọn V_C làm ẩn thừa cho cùng kết quả); ngàm hai đầu M = qL²/12; lún gối, nhiệt độ, lò xo khớp lời giải số.

## Bền dẻo: W_pl cho tiết diện loại 1, 2

- **W_pl và trục trung hoà dẻo** tính số trên đa giác thật của mặt cắt (cả lượn, lỗ, sườn): tìm trục chia đôi diện tích bằng chia đôi khoảng, rồi W_pl = S_trên + S_dưới. Hiện ở bảng đặc trưng mặt cắt và báo cáo (W_pl,z, W_pl,y, hệ số hình dạng W_pl/W_el).
- **Đường tương tác dẻo N–M chính xác** (EN 1993-1-1 6.2.9.1) cho mặt cắt bất kỳ: ứng suất ±f_y hai phía trục trung hoà, N = f_y(A_kéo − A_nén), M quanh trọng tâm; lập bảng 41 điểm cho mỗi chiều mô men (mặt cắt đối xứng một trục có hai nhánh khác nhau).
- **Áp dụng:**
  - Uốn – xoắn (§6.3.2, dầm và thanh khung): loại 1, 2 dùng W_pl; loại 3 dùng W_el; loại 4 dùng W_eff — cho λ̄_LT và χ_LT·W·[σ]. Loại tiết diện xác định khi uốn.
  - Phương pháp tổng quát (§6.3.4): loại 1, 2 lấy α_ult,k là giao của tia (αN, αM) với đường tương tác dẻo; loại 3 dùng N/A + M/W_el; loại 4 dùng A_eff, W_eff. Loại tiết diện xác định theo nội lực thực của thanh (N và M đồng thời).
  - Chọn số hiệu thép (dầm, khung) theo các kiểm tra trên.
- **Giữ đàn hồi:** kiểm tra bền theo [σ] kiểu giáo trình, công thức nén – uốn của giáo trình và ổn định cục bộ.
- **Kiểm chứng:** chữ nhật W_pl = bh²/4, M_N = M_pl(1 − n²); chữ I hàn W_pl = b·t_f(h_w + t_f) + t_w·h_w²/4; chữ T trục trung hoà dẻo chia đôi diện tích; tròn đặc D³/6; α dẻo của chữ nhật với (N, M) khớp nghiệm α²n² + αm = 1.

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
- **Giới hạn:** với thép GOST cánh dốc, phần khoét lấy theo bề dày trung bình. Ống tròn loại 4 không dùng tiết diện hữu hiệu mà kiểm tra theo vỏ trụ (mục dưới).

## Ống tròn loại 4 — mất ổn định vỏ trụ (EN 1993-1-6)

- Áp dụng khi D/t > 90ε², ứng suất dọc trục do N và M (phụ lục D.1.2, cấp chế tạo B, Q = 25).
- ω = l/√(rt), l lấy bằng chiều dài thanh (khung: chiều dài từng thanh). Trụ ngắn C_x = 1,36 − 1,83/ω + 2,07/ω²; trụ trung bình C_x = 1; trụ dài C_x,N = 1 + (0,2/C_xb)(1 − 2ωt/r) ≥ 0,6 với C_xb = 3, khi có uốn lấy trung bình theo phần ứng suất do N.
- σ_x,Rcr = 0,605·E·C_x·t/r; Δw_k = (1/Q)√(r/t)·t; α_x = 0,62/(1 + 1,91(Δw_k/t)^1,44); λ̄_0 = 0,2, β = 0,6, η = 1, λ̄_p = √(α/(1 − β)); χ_x theo ba miền.
- Điều kiện σ_x,Ed ≤ χ_x[σ]. Có trong thẻ ổn định cục bộ, báo cáo PDF và chọn số hiệu thép; ống loại 1–3 chỉ hiện để tham khảo.

## Sườn dọc bản bụng

- **Khai báo:** thêm sườn dọc dạng bản phẳng cho tiết diện chữ I tổ hợp hàn (vị trí tính từ mép trên bụng, bề rộng, bề dày, một hoặc hai phía). A, I, W có kể sườn.
- **Ổn định cục bộ:** bản bụng được chia thành các ô giữa các sườn; mỗi ô và từng sườn (tấm vươn) được phân loại và tính b_eff riêng.
- **Mất ổn định tổng thể của bụng có sườn** (EN 1993-1-5 §4.5, phụ lục A):
  - Sườn cùng dải bụng góp hai bên (theo phân bố b_eff) tạo thành thanh có A_sl, I_sl.
  - **Làm việc kiểu tấm:**
    - Một hoặc hai sườn: thanh trên nền đàn hồi A.2.2 (a_c; σ_cr,sl với a ≥ a_c và a < a_c), các sườn khác là gối cứng.
    - **Hai sườn kề nhau gộp chung** (A.2.1(4)): A = A₁ + A₂, I = I₁ + I₂, đặt tại hợp lực của hai sườn; b1, b2 đo từ đó đến các mép ô.
    - ≥ 3 sườn trong vùng nén và ψ ≥ 0,5: **tấm trực hướng A.1**. γ = I_sl/I_p, δ = ΣA_sl/A_p, α = a/b. k_σ,p = 2[(1 + α²)² + γ − 1]/[α²(ψ + 1)(1 + δ)] khi α ≤ γ^¼, ngược lại 4(1 + √γ)/[(ψ + 1)(1 + δ)].
    - σ_cr,p lấy nhỏ nhất, quy về mép nén lớn nhất. λ̄_p = √(f_y/σ_cr,p) → ρ (4.2, ψ của cả bụng; β_A,c = 1).
  - **Làm việc kiểu thanh** (4.5.3): σ_cr,sl = π²EI_sl/(A_sl·a²) → σ_cr,c ở mép; λ̄_c, α_e = 0.49 + 0.09/(i/e), χ_c.
  - **Nội suy** (4.5.4): ξ = σ_cr,p/σ_cr,c − 1 ∈ [0, 1]; ρ_c = (ρ − χ_c)·ξ(2 − ξ) + χ_c. Không có sườn ngang (a = ∞): ξ = 1, ρ_c = ρ.
  - ρ_c giảm bề dày vùng nén của bụng (trừ dải biên sát cánh) và của sườn (EN §4.5.1).
- **Ổn định cắt** (EN 1993-1-5 A.3): k_τ có thêm k_τsl từ I_sl, đồng thời kiểm tra ô bụng lớn nhất.
- **Kiểm chứng:** A_sl, σ_cr,sl, k_σ,p (A.1), trường hợp gộp và công thức nội suy khớp công thức; sườn khoẻ cho χ_c và ρ_c lớn hơn sườn yếu; sườn làm tăng W_eff và τ_cr. Ví dụ bụng 1400×8 thêm sườn 120×12 tại 0,2h_w: σ khi uốn giảm từ 154,7 xuống 141,1 MPa; τ_cr tăng từ 31,5 lên 49,2 MPa.

## Vận chuyển & chằng buộc hàng (EN 12195-1)

Tab **Vận chuyển & chằng buộc** kiểm tra phương án chở hàng trên xe đầu kéo + sơ mi rơ moóc:

- **Chống trượt** theo phương tiến, lùi, ngang với hệ số đường bộ của EN 12195-1:2010 (c_x = 0,8 / 0,5; c_y = 0,5; c_z = 1,0):
  - chằng vắt qua nóc: n ≥ (c − μ·c_z)·m·g·f_s / (2·μ·sinα·F_T), f_s = 1,25 (tiến) / 1,1 (lùi) / 1,1 (ngang);
  - chằng trực tiếp (chéo): n·LC·(cosα·cosβ + μ·f_μ·sinα) ≥ (c − μ·f_μ·c_z)·m·g, f_μ = 0,75;
  - chặn (blocking) theo khả năng BC, ma sát dùng μ; nhiều biện pháp kết hợp thì cộng khả năng giữ (có chằng trực tiếp thì dùng μ·f_μ cho mọi thành phần, thiên về an toàn).
- **Chống lật**: hàng tự ổn định khi b/d ≥ c/c_z; nếu không, tính số dây vắt qua nóc cần (mô men n·F_T·w·sinα / f_s).
- **Tải trọng trục**: cân bằng mô men quanh chốt kéo, các trục trong cụm chịu như nhau; tải chốt chia về trục trước và cụm sau đầu kéo; so với giới hạn nhập vào.
- **Kích thước bao** (cao = cao sàn + cao hàng, rộng) so với giới hạn.
- **Áp lực nền** theo vệt dưới từng cụm bánh: mỗi trục 2 vệt (2 bên xe), vệt = (vệt lốp + 2·h·tanθ) × (rộng cụm bánh + 2·h·tanθ)
  hoặc nhập tay (ví dụ 1,3 × 1,11 m); diện tích = số trục × 2 × dọc × ngang. Ra cả cách tính trong hồ sơ (tổng tải / tổng diện tích)
  và áp lực dưới từng cụm trục (giá trị lớn nhất nền phải chịu); cảnh báo khi vệt các trục kề nhau chồng lên nhau.
- **Tải khác trên xe** (vật tư kê chèn, gỗ kê…): tính vào tải trục và áp lực nền, không tính vào chằng buộc.
- **Tự trọng xe** nhập tách (đầu kéo / sơ mi rơ moóc) hoặc một con số tổng phân bổ theo % về trục trước, cụm sau đầu kéo, cụm sơ mi rơ moóc.
- **Tỉ lệ tải sà lan**: nhiều sà lan, mỗi sà lan một danh sách hạng mục; UC = Σ khối lượng / DWT so với UC cho phép
  (chưa gồm ổn định nổi, mớn nước, sức bền boong).
- **Kiểm tra theo hồ sơ** (bảng "Force effects to cargo"): dốc dọc θ, dốc ngang β, vận tốc vào cua (m/s) và bán kính,
  vận tốc chạy thẳng với gia tốc phanh nhập trực tiếp hoặc tính từ thời gian (a = v/t) / quãng đường (a = v²/2s);
  ma sát f·Q (như hồ sơ) hoặc f·Q·cosθ. Ba trường hợp PASS/FAIL chỉ dùng ma sát: dốc dọc Q·sinθ; phanh khi xuống dốc
  Q·sinθ + m·a; vào cua trên dốc ngang m·v²/R + Q·sinβ. Quy ra hệ số gia tốc tương đương để so với EN.

- **Xe module thủy lực (SPMT / pull type)** — chọn ở ô "Loại xe", theo thẻ tham khảo *Hydraulic Platform Transporters*
  (The Works International / ITI):
  - số trục dòng cần = (hàng + gối kê / dầm / mâm xoay) / tải trọng một trục dòng (SPMT 30 t, pull type 25 t), làm tròn lên; chưa kể hệ số động;
  - lực kéo cần = (cản lăn % + dốc %) × tổng trọng lượng (hàng, gối kê, xe module, PPU, xe kéo);
  - SPMT: trục chủ động cần = lực kéo / lực đẩy một trục (5–7 t), so với số trục chủ động của cấu hình (module 4 → 4; 6 → 4; super 6 → 6);
    PPU = số trục dòng / 10 × 100 HP;
  - pull type: lực kéo tối đa = 80% trọng lượng trên trục chủ động của xe kéo;
  - hiệu ứng cân bằng: độ nghiêng = độ sâu hố / số trục trong nhóm treo.
  - module đơn / đôi (2 hàng song song): tổng số trục dòng, tự trọng và trục chủ động nhân theo số hàng;
  - **ổn định thủy lực** (trang 5): treo 4 điểm Hα = arctan((T_L/4)/CoG), Hβ = arctan((D_AB/2)/CoG);
    treo 3 điểm Hα = arctan((T_L/6)/CoG), Hβ = arctan((D_AB/3)/CoG); yêu cầu ≥ S_HSA = 8°;
  - **ổn định kết cấu** (trang 6): W_axle = (W_T + W_L) / số trục, A_C = 0,5 × tải trọng trục dòng; độ dời trọng tâm
    CoG_shift theo công thức treo 4 / 3 điểm; Sα, Sβ = arctan(CoG_shift / CoG); yêu cầu ≥ S_SSA = 5°;
    cảnh báo khi W_TOT > 0,5 (hoặc 2/3) khả năng xe;
  - chiều cao trọng tâm chung trên vùng ổn định nhập tay, hoặc tính từ hàng (cao sàn + trọng tâm hàng − cao độ vùng ổn định
    0,363 m SPMT / 0,381 m pull type), bỏ qua xe module nên thiên về an toàn;
  - **dầm sống** (trang 8): M = W_axleline·D_AS·(1 + 2 + … + n) với n trục dòng thò ra ngoài hàng ở mỗi đầu, so với mô men cho phép
    (pull type 560 / 725, SPMT 650 / 775 t·m); số trục dòng được thò ra từ M_cho phép / (A_C·2·D_AS) ≥ 1 + … + n.
  - **áp lực nền** (trang 9): cách 1 P = (W_T + W_L)/(T_L·T_W); cách 2 (lan truyền 45° tới độ sâu D_AS/2) P = (W_T + W_L)/(T_L·(T_W + D_AS));
    chọn cách để kết luận so với áp lực cho phép;
  - **ngoại lực** (trang 10–12): ly tâm F = W_TOT/g·V0²/r; gió F = cos φ·W_P·A_FRONT·S_f (dọc) / sin φ·W_P·A_SIDE·S_f (ngang), W_P theo kg/m²; tăng tốc / phanh F = W_TOT/g·cos φ / sin φ·a;
    dốc chưa bù F = sin α_GL / sin β_GT·W_TOT. Lực treo F_SUSP = F·CoG (hoặc CoW)/(0,5·T_L) theo phương dọc, /D_AB theo phương ngang;
    lực trục F_AXLE = F_SUSP / số trục của nhóm treo (treo 4 điểm: nhóm 2+3 và 1+2; treo 3 điểm: nhóm 2 và nhóm 1 / 2+3).
    Vận tốc vào cua, bán kính, gia tốc phanh lấy từ thẻ Điều kiện đường. Tải trục kể ngoại lực = W_axle + tổng F_AXLE (cộng như xảy ra đồng thời) so với A_C.
  - **chằng buộc** (trang 13–14): lực tác dụng lên hàng tính theo W_L; F_V = W_T nếu W_L ≥ W_T, ngược lại W_L;
    F_H-L = F_WIND-L + F_ACC-L + F_2-L; F_H-T = F_CURVE + F_WIND-T + F_ACC-T + F_2-T; ma sát lớn nhất F_W = μ·cos(góc dốc)·(W_L + F_V);
    lực chằng cần = max(0, F_H − F_W) theo X±, Y±, và F_V theo Z; dây chằng theo góc phần tư Q1–Q4 với Cc_X = sin φ·cos Ω·Cc,
    Cc_Y = sin φ·sin Ω·Cc, Cc_Z = cos φ·Cc;
  - **cổ ngỗng** (trang 15, treo 3 điểm, 2 xi lanh): F_SUSP = W_L/3; F_AXLE-1 = F_SUSP / số trục nhóm đơn;
    F_AXLE-2 = F_SUSP / (số trục + (D_GN/D_AXLE)·2·(L2/L1)) — có tuỳ chọn dùng (D_GN/D_AXLE)²; F_5th = (F_AXLE-1 − F_AXLE-2)·số trục + Neck_W;
  - **thang gió Beaufort** (trang 16) chọn áp lực gió; **chọn treo 3 / 4 điểm** theo trình tự của thẻ.
  Các công thức là cách gần đúng của thẻ: trọng tâm ở trọng tâm vùng ổn định, các trục cách đều.

Mọi hệ số (c, f_s, f_μ, μ, giới hạn tải trục) đều sửa được để theo quy trình riêng. Có lời giải từng bước và báo cáo PDF.

## Nâng hạ bằng cẩu (lifting arrangement)

Tab **Nâng hạ (cẩu)** lập các bảng kiểm tra như hồ sơ "Lifting arrangement" (bản vẽ PTSC-PL-LA-DW-004, PTSC-PL-PLA-DW-005):

- **Check crane**: tải nâng tính toán = (tải trên móc·CF·COG·TF·YF·SKL + phụ kiện)·DAF (mặc định CF = 1,05; DAF = 1,15);
  UC = tải tính toán / sức nâng ≤ UC cho phép. Sức nâng tra bảng tải theo chiều dài cần và bán kính (lấy dòng bán kính lớn hơn kề
  hoặc nội suy), hoặc nhập tay; kiểm tra nhiều vị trí làm việc (nhấc khỏi sà lan, đặt lên xe…).
  Có sẵn phần bảng tải trích trên bản vẽ: Liebherr LTM 1080/1, Terex ATT 1354, Sumitomo LS-248RH-5.
- **Check sling / shackles**: tải một nhánh T = W/(n·sinα); tải lớn nhất = T·CF·COG·TF·YF·SKL + phụ kiện·DAF;
  hệ số an toàn = SWL·hệ số giảm / tải lớn nhất ≥ 1. Áp dụng cho cáp thép, dây vải, ma ní, thanh gánh.
- **Check ground pressure**: chân chống p = (F + tự trọng tấm kê) / diện tích (có thể kể lan truyền qua tấm kê);
  bánh xích nhập áp lực theo nhà sản xuất hoặc tính p_tb = W/(2·L·B), p_max theo lệch tâm (hình thang / tam giác).
- **Bãi xếp ống**: xếp lồng, mỗi tầng ít hơn tầng dưới 1 ống; p = số ống × khối lượng / diện tích chịu tải.

Bài mẫu theo bản vẽ (khớp số liệu hồ sơ): LTM 1080/1 R = 12 m — 12,528 t, UC 81,88%; ATT 1354 R = 14 m — 12,758 t, UC 75,71%;
LS-248RH-5 R = 18 m — 14,701 t, UC 48,20%; sling 5,77 t, hệ số 1,30; ma ní 4,58 t, hệ số 1,64; bãi ống 2/3/4/5 tầng
= 4,10 / 6,02 / 7,86 / 9,62 t/m². Riêng áp lực chân chống, hồ sơ ghi 8,11 và 9,07 t/m² trong khi F/A = 33,6/4 = 8,40 và
37,6/4 = 9,40 t/m² — app dùng F/A. `tests/lifting.test.ts` kiểm chứng các số trên.

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
  - Phần ổn định: bảng thanh sườn (b1/b2, A_sl, I_sl, a_c, kiểu tấm σ_cr,sl → σ_cr,p, kiểu thanh σ_cr,c, χ_c), bảng ứng xử bụng (A.1/A.2, ρ, χ_c, ξ, ρ_c), ổn định cắt có sườn dọc (k_τ, τ_cr, χ_w), lời giải.
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
- **Lực dọc thay đổi dọc thanh (chế độ thanh thẳng):** lực đặt giữa thân cột, tải phân bố dọc trục, trọng lượng bản thân, hoặc kết hợp.
  - Quy về lực nén đều tương đương N_tđ = N_th,đều/α_th. α_th là hệ số tới hạn của mô hình thật (đúng gối tựa, đủ mọi tải dọc trục). N_th,đều là lực tới hạn khi nén đều toàn chiều dài trên cùng gối tựa.
  - μ tự động = (π/L)·√(EI/N_th,đều), tính riêng cho hai phương, đúng cả với gối giữa nhịp. Vẫn có thể chọn “nhập tay” (có nút đoán μ từ liên kết hai đầu).
  - Kiểm tra thêm bền tại mặt cắt nén lớn nhất N_max/A ≤ [σ].
  - Dùng chung cho thẻ “Kiểm tra ổn định”, báo cáo PDF và chọn số hiệu thép (ô “μ tự động theo gối tựa”).
  - Kiểm chứng: N không đổi → N_tđ = N, μ = 1; công-xôn có lực giữa thân → N_tđ = P/4, μ = 2; công-xôn chỉ có trọng lượng bản thân → N_tđ ≈ 0,315·G (Greenhill).
- **Báo cáo dùng đúng thông số trên giao diện:**
  - Chế độ dầm: μ, bảng φ, [n_ôđ] của thẻ ổn định; n và bảng φ của thẻ nén – uốn.
  - Chế độ khung: μ trong mặt phẳng nhập ở thẻ ổn định (chưa nhập thì suy từ α_th), μ ngoài mặt phẳng ở thẻ nén – uốn.
  - f_y của thẻ uốn – xoắn và thẻ ổn định cục bộ là một giá trị chung.
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
- [x] Nhiệt độ, lún gối, gối đàn hồi cho khung
- [x] Bảng thép hình tiêu chuẩn (GOST, JIS, EN) + chọn số hiệu thép
- [x] Ổn định thanh chịu nén (Euler, Iasinski, hệ số φ)
- [x] Nén – uốn đồng thời, phân tích bậc hai P-Δ, hệ số tới hạn khung
- [x] Ổn định uốn – xoắn của dầm và từng thanh khung (M_cr bằng phần tử hữu hạn, có hiệu ứng Wagner, χ_LT theo EN 1993-1-1)
- [x] Ổn định cục bộ bản cánh / bản bụng, phân loại tiết diện, ổn định bụng chịu cắt
- [x] Tiết diện hữu hiệu đầy đủ cho loại 4 (A_eff, W_eff, e_N, tính lặp)
- [x] Sườn dọc bản bụng (EN 1993-1-5 A.2, A.3)
- [x] Làm việc kiểu tấm / kiểu thanh của bản có sườn (A.1, hai sườn gộp, nội suy ρ_c), vỏ trụ loại 4
- [x] Xuất báo cáo PDF (thanh thẳng, khung, ổn định)
- [x] Nâng hạ bằng cẩu: bảng tải, cáp / ma ní, áp lực nền chân chống, bánh xích, bãi xếp ống
