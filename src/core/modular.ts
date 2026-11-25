/**
 * Xe module thủy lực (hydraulic platform transporter): SPMT và pull type.
 * Công thức và số liệu theo thẻ tham khảo "Hydraulic Platform Transporters – Reference Card"
 * (The Works International / Industrial Training International), các trang 1–8:
 *  - Trang 3: số trục dòng cần = tải / tải trọng một trục dòng (SPMT 30 t, pull type 25 t), làm tròn lên. Chưa kể hệ số động.
 *  - Trang 4: lực kéo cần = (cản lăn % + dốc %) × tổng trọng lượng (hàng, xe module, gối kê, mâm xoay, dầm, PPU, xe kéo);
 *    SPMT: số trục chủ động = lực kéo / lực đẩy một trục (5–7 t); PPU = số trục dòng / 10 × 100 HP;
 *    pull type: lực kéo tối đa của xe kéo = 80% trọng lượng trên các trục chủ động.
 *  - Trang 2: hiệu ứng cân bằng — độ nghiêng = độ sâu hố / số trục trong nhóm treo.
 *  - Trang 5: ổn định thủy lực — góc từ trọng tâm chung tới cạnh lật của vùng ổn định (treo 4 điểm / 3 điểm).
 *  - Trang 6: ổn định kết cấu — độ dời trọng tâm để tải trục đạt khả năng trục A_C; góc khuyến nghị S_HSA = 8°, S_SSA = 5°.
 *  - Trang 8: dầm sống — mô men do các trục dòng thò ra ngoài hàng, số trục dòng được phép thò ra.
 *  - Trang 9: áp lực nền theo diện tích bóng xe — cách 1: (W_T + W_L)/(T_L·T_W); cách 2 (lan truyền 45° tới độ sâu D_AS/2): (W_T + W_L)/(T_L·(T_W + D_AS)).
 *  - Trang 10–12: ngoại lực — ly tâm khi vào cua, gió, tăng tốc / phanh, độ dốc chưa bù — quy ra lực treo F_SUSPENSION = F·cánh tay đòn / (0,5·T_L hoặc D_AB)
 *    và lực trục F_AXLE = F_SUSPENSION / số trục của nhóm treo.
 *  - Trang 13–14: chằng buộc — lực giữ thẳng đứng F_V, lực ngang cần F_H, ma sát lớn nhất F_W, lực chằng cần = max(0, F_H − F_W);
 *    các lực tác dụng lên hàng tính theo trọng lượng hàng W_L; thành phần lực chằng Cc_X, Cc_Y, Cc_Z theo góc φ (đứng), Ω (ngang).
 *  - Trang 15: cổ ngỗng (goose neck) — lực trục khi có / không có cổ ngỗng, lực lên mâm kéo.
 *  - Trang 16: thang gió Beaufort (áp lực gió kg/m²); chọn treo 3 điểm hay 4 điểm.
 * Đơn vị: khối lượng và lực theo tấn (t, tấn lực), chiều dài m, mô men t·m, độ sâu mm, góc độ.
 */
import { fmt } from './stress';

export type ModType = 'spmt' | 'pull';
export type Suspension = '3' | '4';

export interface ModTypeSpec {
  label: string;
  /** tải trọng một trục dòng (t) */
  payload: number;
  /** số lốp mỗi trục dòng */
  tires: number;
  /** khoảng cách tâm hai cụm bánh D_AB — module đơn / đôi (m) */
  axleBaseSingle: number;
  axleBaseDouble: number;
  /** khoảng cách các trục dòng D_AS (m) */
  axleSpacing: number;
  /** chiều cao sàn danh định và hành trình ± (m) */
  deckH: number;
  stroke: number;
  /** cao độ vùng ổn định (tâm xoay trục) so với mặt đường (m) — trang 5 */
  stabilityElev: number;
}

/** Thông số theo trang 3 và 5 của thẻ tham khảo */
export const MOD_TYPES: Record<ModType, ModTypeSpec> = {
  spmt: { label: 'SPMT (tự hành)', payload: 30, tires: 4, axleBaseSingle: 1.45, axleBaseDouble: 2.9, axleSpacing: 1.4, deckH: 1.5, stroke: 0.3, stabilityElev: 0.363 },
  pull: { label: 'Pull type (kéo bằng xe đầu kéo)', payload: 25, tires: 8, axleBaseSingle: 1.8, axleBaseDouble: 3.3, axleSpacing: 1.5, deckH: 1.2, stroke: 0.3, stabilityElev: 0.381 },
};

/** Số trục chủ động của một module SPMT theo số trục dòng (trang 4): 4 trục dòng → 4; 6 trục dòng → 4; "super 6" → 6 */
export const DRIVE_AXLES_DEFAULT: Record<number, number> = { 4: 4, 6: 4 };

/** Mô men uốn cho phép của dầm sống, giá trị trung bình nhiều hãng (trang 8), t·m */
export const SPINE_MOMENTS: { key: string; label: string; type: ModType; m: number }[] = [
  { key: 'pull-early', label: 'Pull type đời cũ', type: 'pull', m: 560 },
  { key: 'pull-recent', label: 'Pull type đời mới', type: 'pull', m: 725 },
  { key: 'spmt-early', label: 'SPMT đời cũ', type: 'spmt', m: 650 },
  { key: 'spmt-recent', label: 'SPMT đời mới', type: 'spmt', m: 775 },
];

/** Góc ổn định an toàn khuyến nghị (trang 6) */
export const SAFE_HSA = 8;
export const SAFE_SSA = 5;

export interface ModUnit {
  /** số trục dòng của module (theo chiều dài xe) */
  lines: number;
  /** số trục chủ động (chỉ SPMT) */
  drive: number;
}

export interface ModularInput {
  type: ModType;
  /** tải trọng một trục dòng (t) */
  payloadPerLine: number;
  /** tự trọng một trục dòng (t) */
  selfPerLine: number;
  /** khối lượng hàng (t) */
  load: number;
  /** gối kê, mâm xoay, dầm vận chuyển đặt trên xe (t) — tính vào tải đặt lên xe và tổng trọng lượng */
  accessories: number;
  /** PPU (t) — chỉ tính vào tổng trọng lượng khi tính lực kéo */
  ppu: number;
  /** cấu hình module theo chiều dài xe; rỗng = tự lấy số trục dòng cần */
  units: ModUnit[];
  /** số hàng module ghép song song: 1 = module đơn, 2 = module đôi (double wide) */
  wide?: 1 | 2;
  /** khoảng cách tâm hai cụm bánh D_AB (m) — bề rộng vùng ổn định */
  axleBase?: number;
  /** lực cản lăn (%) — đường nhựa khô 3% — và độ dốc (%) */
  rolling: number;
  grade: number;
  /** SPMT: lực đẩy một trục chủ động (t), 5,0–7,0 */
  propulsion: number;
  /** SPMT: công suất PPU cho mỗi 10 trục dòng (HP) */
  hpPer10: number;
  /** pull type: số xe kéo, trọng lượng trên các trục chủ động của mỗi xe kéo (t), tự trọng mỗi xe kéo (t) */
  trucks: number;
  truckDriveWeight: number;
  truckWeight: number;
  /** hiệu ứng cân bằng: độ sâu hố (mm) và số trục trong nhóm treo đi qua hố */
  pothole: number;
  axlesPerGroup: number;
  /** ổn định: kiểu treo (3 hoặc 4 điểm) */
  suspension?: Suspension;
  /** cách lấy chiều cao trọng tâm chung trên vùng ổn định: nhập tay, hoặc tính từ hàng (bỏ qua xe module — thiên về an toàn) */
  cogMode?: 'manual' | 'load';
  /** chiều cao trọng tâm chung trên vùng ổn định (m) khi nhập tay */
  cog?: number;
  /** góc ổn định an toàn yêu cầu (°) */
  hsa?: number;
  ssa?: number;
  /** dầm sống: số trục dòng thò ra ngoài hàng ở đầu trước / đầu sau; mô men cho phép (t·m) */
  overhangFront?: number;
  overhangRear?: number;
  spineM?: number;
  /** áp lực nền (trang 9): bề rộng xe T_W (m), áp lực cho phép (t/m², 0 = bỏ qua), cách dùng để kết luận */
  tw?: number;
  pAllow?: number;
  gpMethod?: 1 | 2;
  /** ngoại lực (trang 10–12) — vận tốc vào cua V0 (m/s), bán kính cua r (m), gia tốc tăng tốc / phanh (m/s²), góc lệch φ của lực quán tính (°) */
  vCurve?: number;
  radius?: number;
  accel?: number;
  accPhi?: number;
  /** gió: áp lực gió W_P (kg/m², theo thang Beaufort trang 16), diện tích chắn gió mặt trước (gió dọc) và mặt bên (gió ngang) (m²),
   *  hệ số hình dạng S_f, góc φ (0° = dọc xe), chiều cao tâm mặt chắn gió trên vùng ổn định CoW (m) */
  windP?: number;
  beaufort?: number;
  windAFront?: number;
  windASide?: number;
  windSf?: number;
  windPhi?: number;
  cow?: number;
  /** góc dốc chưa bù của xe (sau khi xe tự cân bằng), dọc α_GL và ngang β_GT (°) */
  alphaGL?: number;
  betaGT?: number;
  /** chằng buộc (trang 13–14): hệ số ma sát hàng – sàn xe; các nhóm dây chằng */
  mu?: number;
  lashings?: ModLashing[];
  /** cổ ngỗng (trang 15): dùng hay không; đường kính xi lanh trục và xi lanh cổ ngỗng (mm, phía đẩy); cánh tay đòn L1, L2 (m); tự trọng cổ ngỗng (t);
   *  gnSquare: dùng tỉ số diện tích (D_g/D_a)² thay cho tỉ số đường kính như trên thẻ */
  gooseneck?: boolean;
  gnDAxle?: number;
  gnDNeck?: number;
  gnL1?: number;
  gnL2?: number;
  gnWeight?: number;
  gnSquare?: boolean;
}

/** Một nhóm dây chằng: góc phần tư Q1 (X+, Y+), Q2 (X−, Y+), Q3 (X−, Y−), Q4 (X+, Y−); số dây; khả năng Cc (t); góc φ so với phương đứng, Ω trong mặt bằng so với trục X (°) */
export interface ModLashing {
  q: 1 | 2 | 3 | 4;
  n: number;
  cc: number;
  phi: number;
  omega: number;
}

/** Thang gió Beaufort (trang 16): cấp, mô tả, vận tốc (m/s), áp lực gió (kg/m²) */
export const BEAUFORT: { n: number; label: string; v: string; p: number }[] = [
  { n: 0, label: 'Lặng gió (calm)', v: '< 0,3', p: 0 },
  { n: 1, label: 'Gió rất nhẹ (light air)', v: '0,3–1,5', p: 0.14 },
  { n: 2, label: 'Gió nhẹ (light breeze)', v: '1,6–3,4', p: 0.68 },
  { n: 3, label: 'Gió yếu (gentle breeze)', v: '3,4–5,4', p: 1.82 },
  { n: 4, label: 'Gió vừa (moderate breeze)', v: '5,5–7,9', p: 3.9 },
  { n: 5, label: 'Gió khá mạnh (fresh breeze)', v: '8,0–10,7', p: 7.1 },
  { n: 6, label: 'Gió mạnh (strong breeze)', v: '10,8–13,8', p: 11.8 },
  { n: 7, label: 'Gió rất mạnh (moderate gale)', v: '13,9–17,1', p: 18.2 },
  { n: 8, label: 'Gió bão (gale)', v: '17,2–20,7', p: 26.7 },
  { n: 9, label: 'Gió bão mạnh (strong gale)', v: '20,8–24,4', p: 37.1 },
  { n: 10, label: 'Bão (storm)', v: '24,5–28,4', p: 50.2 },
  { n: 11, label: 'Bão rất mạnh (violent storm)', v: '28,5–32,6', p: 66.2 },
  { n: 12, label: 'Cuồng phong (hurricane)', v: '≥ 32,7', p: 66.2 },
];

export interface SecuringResult {
  /** lực tác dụng lên hàng (t) */
  curve: number;
  windL: number;
  windT: number;
  accL: number;
  accT: number;
  gradL: number;
  gradT: number;
  /** F_V, F_H-L, F_H-T, F_W-L, F_W-T (t) */
  Fv: number;
  FhL: number;
  FhT: number;
  FwL: number;
  FwT: number;
  /** lực chằng cần theo X, Y, Z (t) */
  reqX: number;
  reqY: number;
  reqZ: number;
  /** khả năng của dây chằng theo X+, X−, Y+, Y−, Z (t); null khi chưa khai báo dây */
  cap: { xp: number; xn: number; yp: number; yn: number; z: number } | null;
  rows: { force: string; dir: string; req: number; fric: number | null; apply: number; cap: number | null; ok: boolean | null }[];
  steps: string[];
}

export interface GooseneckResult {
  Fsusp: number;
  n: number;
  Faxle1: number;
  Faxle2: number;
  F5th: number;
  ratio: number;
  steps: string[];
}

export interface SuspensionAdvice {
  /** kiểu treo đề xuất và lý do */
  pick: Suspension | null;
  ok3: boolean;
  ok4: boolean;
  reason: string;
}

export const defaultModular = (type: ModType = 'spmt'): ModularInput => ({
  type,
  payloadPerLine: MOD_TYPES[type].payload,
  selfPerLine: 3.5,
  load: 350,
  accessories: 0,
  ppu: 0,
  units: type === 'spmt' ? [{ lines: 6, drive: 4 }, { lines: 4, drive: 4 }, { lines: 4, drive: 4 }] : [],
  wide: 1,
  axleBase: MOD_TYPES[type].axleBaseSingle,
  rolling: 3,
  grade: 8,
  propulsion: 5,
  hpPer10: 100,
  trucks: 1,
  truckDriveWeight: 18,
  truckWeight: 25,
  pothole: 300,
  axlesPerGroup: 2,
  suspension: '3',
  cogMode: 'load',
  cog: 3,
  hsa: SAFE_HSA,
  ssa: SAFE_SSA,
  overhangFront: 0,
  overhangRear: 0,
  spineM: type === 'spmt' ? 650 : 560,
  pAllow: 0,
  gpMethod: 1,
  accPhi: 0,
  windP: 0,
  beaufort: 0,
  windAFront: 0,
  windASide: 0,
  windSf: 1,
  windPhi: 0,
  cow: 0,
  alphaGL: 0,
  betaGT: 0,
  lashings: [],
  gooseneck: false,
  gnDAxle: 0,
  gnDNeck: 0,
  gnL1: 0,
  gnL2: 0,
  gnWeight: 0,
  gnSquare: false,
});

export interface ModCheck {
  label: string;
  value: string;
  ok: boolean | null;
}

export interface StabilityAngles {
  suspension: Suspension;
  /** chiều dài xe T_L, bề rộng D_AB, chiều cao trọng tâm chung trên vùng ổn định (m) */
  TL: number;
  DAB: number;
  cog: number;
  /** khoảng cách từ trọng tâm tới cạnh lật của vùng ổn định thủy lực (m) */
  hLong: number;
  hTrans: number;
  /** góc ổn định thủy lực α (dọc), β (ngang), độ */
  Ha: number;
  Hb: number;
  /** số trục (cụm bánh), tải một trục, khả năng trục A_C (t) */
  axles: number;
  Waxle: number;
  Ac: number;
  /** độ dời trọng tâm tới giới hạn kết cấu (m) */
  sLong: number;
  sTrans: number;
  /** góc ổn định kết cấu (độ) — âm nghĩa là đã quá tải */
  Sa: number;
  Sb: number;
  /** tổng trọng lượng trên xe W_TOT = W_T + W_L và khả năng của xe (t) */
  Wtot: number;
  capacity: number;
  steps: string[];
}

export interface SpineEnd {
  label: string;
  /** số trục dòng thò ra ngoài hàng */
  n: number;
  /** mô men tại mép hàng (t·m) */
  M: number;
}

export interface SpineResult {
  /** tải một trục dòng W_axleline = W_L / số trục dòng (t) */
  wLine: number;
  ends: SpineEnd[];
  Mmax: number;
  Mallow: number;
  /** M_cho phép / (A_C·2·D_AS) và số trục dòng tối đa được thò ra */
  ratio: number;
  nMax: number;
  ok: boolean;
  steps: string[];
}

export interface GroundPressureM {
  Wtot: number;
  TL: number;
  TW: number;
  DAS: number;
  /** áp lực theo cách 1 và cách 2 (t/m²) */
  p1: number;
  p2: number;
  method: 1 | 2;
  allow: number;
  ok: boolean | null;
  steps: string[];
}

export interface ExtForce {
  label: string;
  /** phương: T ngang, L dọc */
  dir: 'T' | 'L';
  /** ngoại lực (t), lực treo (t), số trục của nhóm chịu, lực thêm trên mỗi trục (t) */
  F: number;
  Fs: number;
  n: number;
  Faxle: number;
  formula: string;
}

export interface ExtResult {
  forces: ExtForce[];
  /** tổng lực thêm trên mỗi trục theo phương ngang / dọc nếu các ngoại lực xảy ra đồng thời (t) */
  axleT: number;
  axleL: number;
  /** tải trục lớn nhất W_axle + lực thêm, so với A_C */
  Waxle: number;
  Ac: number;
  steps: string[];
}

export interface ModularResult {
  spec: ModTypeSpec;
  /** tải đặt lên xe = hàng + gối kê/dầm (t) */
  payload: number;
  linesReq: number;
  /** tổng số trục dòng (cả hai hàng nếu module đôi) và số trục dòng theo chiều dài */
  lines: number;
  linesLong: number;
  wide: 1 | 2;
  /** tỉ lệ tải trên các trục dòng */
  uc: number;
  /** tải trung bình một trục dòng (t) */
  perLine: number;
  /** tổng trọng lượng khi tính lực kéo (t) */
  gvw: number;
  /** lực kéo cần (tấn lực) */
  effort: number;
  driveReq: number | null;
  driveAvail: number | null;
  ppuHp: number | null;
  ppuKw: number | null;
  /** pull type: lực kéo tối đa của các xe kéo (tấn lực) và số xe kéo cần */
  pullAvail: number | null;
  trucksReq: number | null;
  /** độ nghiêng khi một nhóm treo đi qua hố (mm) */
  lean: number;
  /** chiều dài xe T_L (m) */
  length: number;
  stab: StabilityAngles | null;
  spine: SpineResult;
  ground: GroundPressureM;
  ext: ExtResult | null;
  securing: SecuringResult;
  gooseneck: GooseneckResult | null;
  advice: SuspensionAdvice | null;
  checks: ModCheck[];
  notes: string[];
  ok: boolean;
  steps: string[];
}

const deg = (r: number) => (r * 180) / Math.PI;
const atanDeg = (a: number, b: number) => deg(Math.atan2(a, b));

/**
 * Góc ổn định thủy lực và kết cấu (trang 5, 6). Giả thiết của thẻ: trọng tâm ở trọng tâm vùng ổn định;
 * cách tính kết cấu chỉ đúng khi các trục cách đều nhau.
 */
export function stabilityAngles(o: { suspension: Suspension; TL: number; DAB: number; cog: number; axles: number; Ac: number; Wtot: number }): StabilityAngles {
  const { suspension: s, TL, DAB, cog, axles, Ac, Wtot } = o;
  const steps: string[] = [];
  const Waxle = axles > 0 ? Wtot / axles : 0;
  let hLong: number, hTrans: number, sLong: number, sTrans: number;
  steps.push(`Tải hiện tại một trục: W_axle = W_TOT / số trục = ${fmt(Wtot, 3)} / ${axles} = ${fmt(Waxle, 4)} t; khả năng trục A_C = ${fmt(Ac, 3)} t`);
  if (s === '4') {
    hLong = TL / 4; hTrans = DAB / 2;
    steps.push(`Treo 4 điểm, vùng ổn định chữ nhật: CoG–P1/P2 = T_L/4 = ${fmt(TL, 3)}/4 = ${fmt(hLong, 4)} m; CoG–P3/P4 = D_AB/2 = ${fmt(DAB, 3)}/2 = ${fmt(hTrans, 4)} m`);
    sLong = (Ac / (Waxle * 2)) * (TL / 2) - TL / 4;
    sTrans = (Ac / (Waxle * 2)) * DAB - DAB / 2;
    steps.push(`CoG_shift-S1/S2 = (A_C/(W_axle·2))·T_L/2 − T_L/4 = (${fmt(Ac, 3)}/(${fmt(Waxle, 4)}·2))·${fmt(TL, 3)}/2 − ${fmt(TL, 3)}/4 = ${fmt(sLong, 4)} m`);
    steps.push(`CoG_shift-S3/S4 = (A_C/(W_axle·2))·D_AB − D_AB/2 = (${fmt(Ac, 3)}/(${fmt(Waxle, 4)}·2))·${fmt(DAB, 3)} − ${fmt(DAB, 3)}/2 = ${fmt(sTrans, 4)} m`);
  } else {
    hLong = TL / 6; hTrans = DAB / 3;
    steps.push(`Treo 3 điểm, vùng ổn định tam giác: CoG–P1 = T_L/6 = ${fmt(TL, 3)}/6 = ${fmt(hLong, 4)} m; CoG–P2/P3 = D_AB/3 = ${fmt(DAB, 3)}/3 = ${fmt(hTrans, 4)} m`);
    sLong = (TL / 3) * ((axles * Ac) / Wtot) - TL / 3;
    sTrans = (Ac / Waxle) * (DAB / 3) - DAB / 3;
    steps.push(`CoG_shift-S1 = (T_L/3)·((số trục·A_C)/W_TOT) − T_L/3 = (${fmt(TL, 3)}/3)·((${axles}·${fmt(Ac, 3)})/${fmt(Wtot, 3)}) − ${fmt(TL, 3)}/3 = ${fmt(sLong, 4)} m`);
    steps.push(`CoG_shift-S2/S3 = (A_C/W_axle)·(D_AB/3) − D_AB/3 = (${fmt(Ac, 3)}/${fmt(Waxle, 4)})·(${fmt(DAB, 3)}/3) − ${fmt(DAB, 3)}/3 = ${fmt(sTrans, 4)} m`);
  }
  const Ha = atanDeg(hLong, cog), Hb = atanDeg(hTrans, cog);
  const Sa = atanDeg(sLong, cog), Sb = atanDeg(sTrans, cog);
  steps.push(`Ổn định thủy lực: Hα = arctan(${fmt(hLong, 4)}/${fmt(cog, 3)}) = ${fmt(Ha, 2)}°; Hβ = arctan(${fmt(hTrans, 4)}/${fmt(cog, 3)}) = ${fmt(Hb, 2)}°`);
  steps.push(`Ổn định kết cấu: Sα = arctan(${fmt(sLong, 4)}/${fmt(cog, 3)}) = ${fmt(Sa, 2)}°; Sβ = arctan(${fmt(sTrans, 4)}/${fmt(cog, 3)}) = ${fmt(Sb, 2)}°`);
  return { suspension: s, TL, DAB, cog, hLong, hTrans, Ha, Hb, axles, Waxle, Ac, sLong, sTrans, Sa, Sb, Wtot, capacity: 0, steps };
}

/** Dầm sống (trang 8): M = Σ W_axleline·D_AS·i với i = 1…n trục dòng thò ra ngoài hàng */
export function spineBeam(o: { wLine: number; DAS: number; Ac: number; Mallow: number; front: number; rear: number }): SpineResult {
  const { wLine, DAS, Ac, Mallow } = o;
  const steps: string[] = [];
  const end = (label: string, n: number): SpineEnd => {
    const k = Math.max(0, Math.round(n));
    const sum = (k * (k + 1)) / 2;
    const M = wLine * DAS * sum;
    if (k > 0) steps.push(`${label}: ${k} trục dòng thò ra — M = W_axleline·D_AS·(1 + … + ${k}) = ${fmt(wLine, 4)}·${fmt(DAS, 3)}·${sum} = ${fmt(M, 2)} t·m`);
    return { label, n: k, M };
  };
  const ends = [end('Đầu trước', o.front), end('Đầu sau', o.rear)];
  const Mmax = Math.max(...ends.map((e) => e.M));
  const ratio = Ac > 0 && DAS > 0 ? Mallow / (Ac * 2 * DAS) : 0;
  let nMax = 0;
  while (((nMax + 1) * (nMax + 2)) / 2 <= ratio + 1e-9) nMax++;
  steps.push(`Số trục dòng được thò ra: M_cho phép / (A_C·2·D_AS) = ${fmt(Mallow, 1)} / (${fmt(Ac, 3)}·2·${fmt(DAS, 3)}) = ${fmt(ratio, 3)} ≥ 1 + … + n → n = ${nMax}`);
  const ok = Mmax <= Mallow + 1e-9;
  steps.push(`Mô men lớn nhất ${fmt(Mmax, 2)} t·m ${ok ? '≤' : '>'} M_cho phép ${fmt(Mallow, 1)} t·m → ${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`);
  return { wLine, ends, Mmax, Mallow, ratio, nMax, ok, steps };
}

export function analyzeModular(mi: ModularInput): ModularResult {
  const spec = MOD_TYPES[mi.type];
  const spmt = mi.type === 'spmt';
  const wide: 1 | 2 = mi.wide === 2 ? 2 : 1;
  const steps: string[] = [];
  const notes: string[] = [];
  const payload = mi.load + mi.accessories;
  const pl = mi.payloadPerLine > 0 ? mi.payloadPerLine : spec.payload;
  const raw = payload / pl;
  const linesReq = Math.max(1, Math.ceil(raw - 1e-9));
  steps.push(`Tải đặt lên xe: hàng ${fmt(mi.load, 3)} + gối kê / dầm ${fmt(mi.accessories, 3)} = ${fmt(payload, 3)} t`);
  steps.push(`Số trục dòng cần: ${fmt(payload, 3)} / ${fmt(pl, 2)} t/trục dòng = ${fmt(raw, 3)} → ${linesReq} trục dòng (chưa kể hệ số động)`);
  const unitLines = mi.units.reduce((s, u) => s + Math.max(0, Math.round(u.lines)), 0);
  const linesLong = unitLines > 0 ? unitLines : Math.ceil(linesReq / wide);
  const lines = linesLong * wide;
  if (unitLines > 0) steps.push(`Cấu hình module: ${mi.units.map((u) => u.lines).join(' + ')} = ${linesLong} trục dòng theo chiều dài${wide === 2 ? ` × 2 hàng (module đôi) = ${lines} trục dòng` : ''}`);
  else if (wide === 2) steps.push(`Module đôi: ${linesLong} trục dòng theo chiều dài × 2 hàng = ${lines} trục dòng`);
  const perLine = payload / lines;
  const uc = perLine / pl;
  steps.push(`Tải trung bình một trục dòng: ${fmt(payload, 3)} / ${lines} = ${fmt(perLine, 3)} t; tỉ lệ ${fmt(uc * 100, 1)}% của ${fmt(pl, 2)} t`);
  const WT = lines * mi.selfPerLine;
  const trucksW = spmt ? 0 : Math.max(0, mi.trucks) * mi.truckWeight;
  const gvw = payload + WT + mi.ppu + trucksW;
  steps.push(`Tổng trọng lượng khi tính lực kéo: tải ${fmt(payload, 3)} + xe module ${lines}·${fmt(mi.selfPerLine, 3)} = ${fmt(WT, 3)} + PPU ${fmt(mi.ppu, 3)}${spmt ? '' : ` + xe kéo ${fmt(trucksW, 3)}`} = ${fmt(gvw, 3)} t`);
  const effort = ((mi.rolling + mi.grade) / 100) * gvw;
  steps.push(`Lực kéo cần: (${fmt(mi.rolling, 2)}% + ${fmt(mi.grade, 2)}%)·${fmt(gvw, 3)} = ${fmt(effort, 3)} t`);
  let driveReq: number | null = null, driveAvail: number | null = null, ppuHp: number | null = null, ppuKw: number | null = null;
  let pullAvail: number | null = null, trucksReq: number | null = null;
  const checks: ModCheck[] = [{ label: 'Tải trên trục dòng', value: `${fmt(perLine, 2)} / ${fmt(pl, 2)} t (${fmt(uc * 100, 1)}%)`, ok: perLine <= pl + 1e-9 }];
  if (spmt) {
    driveReq = mi.propulsion > 0 ? Math.ceil(effort / mi.propulsion - 1e-9) : null;
    if (driveReq !== null) steps.push(`Số trục chủ động cần: ${fmt(effort, 3)} / ${fmt(mi.propulsion, 2)} t/trục = ${fmt(effort / mi.propulsion, 3)} → ${driveReq}`);
    if (unitLines > 0) {
      driveAvail = mi.units.reduce((s, u) => s + Math.max(0, Math.round(u.drive)), 0) * wide;
      steps.push(`Trục chủ động có: (${mi.units.map((u) => u.drive).join(' + ')})${wide === 2 ? ' × 2 hàng' : ''} = ${driveAvail}`);
      if (driveReq !== null) checks.push({ label: 'Trục chủ động (lực kéo)', value: `có ${driveAvail} / cần ${driveReq}`, ok: driveAvail >= driveReq });
    }
    ppuHp = (lines / 10) * mi.hpPer10;
    ppuKw = ppuHp * 0.7457;
    steps.push(`Công suất PPU: ${lines} / 10 × ${fmt(mi.hpPer10, 1)} HP = ${fmt(ppuHp, 1)} HP (${fmt(ppuKw, 1)} kW)`);
  } else {
    const per = 0.8 * mi.truckDriveWeight;
    pullAvail = Math.max(0, mi.trucks) * per;
    trucksReq = per > 0 ? Math.ceil(effort / per - 1e-9) : null;
    steps.push(`Lực kéo tối đa mỗi xe kéo: 80% × ${fmt(mi.truckDriveWeight, 3)} t trên trục chủ động = ${fmt(per, 3)} t; ${mi.trucks} xe = ${fmt(pullAvail, 3)} t`);
    if (trucksReq !== null) steps.push(`Số xe kéo cần: ${fmt(effort, 3)} / ${fmt(per, 3)} = ${fmt(effort / per, 3)} → ${trucksReq}`);
    checks.push({ label: 'Lực kéo của xe kéo', value: `${fmt(pullAvail, 2)} t so với cần ${fmt(effort, 2)} t`, ok: pullAvail >= effort - 1e-9 });
  }
  const nG = Math.max(1, Math.round(mi.axlesPerGroup));
  const lean = mi.pothole / nG;
  steps.push(`Hiệu ứng cân bằng: độ nghiêng = độ sâu hố / số trục trong nhóm = ${fmt(mi.pothole, 1)} / ${nG} = ${fmt(lean, 1)} mm (về phía nhóm đi qua hố)`);

  // Ổn định (trang 5–7)
  const TL = linesLong * spec.axleSpacing;
  const DAB = mi.axleBase && mi.axleBase > 0 ? mi.axleBase : wide === 2 ? spec.axleBaseDouble : spec.axleBaseSingle;
  const axles = lines * 2;
  const Ac = pl / 2;
  const Wtot = WT + payload;
  const capacity = lines * pl;
  const susp: Suspension = mi.suspension === '4' ? '4' : '3';
  let stab: StabilityAngles | null = null;
  const cog = mi.cog ?? 0;
  if (cog > 0) {
    stab = { ...stabilityAngles({ suspension: susp, TL, DAB, cog, axles, Ac, Wtot }), capacity };
    stab.steps.unshift(`T_L = ${linesLong}·${fmt(spec.axleSpacing, 2)} = ${fmt(TL, 3)} m; D_AB = ${fmt(DAB, 3)} m; số trục = ${lines} trục dòng × 2 = ${axles}; W_TOT = W_T + W_L = ${fmt(WT, 3)} + ${fmt(payload, 3)} = ${fmt(Wtot, 3)} t; A_C = 0,5·${fmt(pl, 2)} = ${fmt(Ac, 3)} t; trọng tâm chung cao ${fmt(cog, 3)} m trên vùng ổn định`);
    const hsa = mi.hsa ?? SAFE_HSA, ssa = mi.ssa ?? SAFE_SSA;
    checks.push({ label: 'Ổn định thủy lực dọc Hα', value: `${fmt(stab.Ha, 2)}° (yêu cầu ≥ ${hsa}°)`, ok: stab.Ha >= hsa - 1e-9 });
    checks.push({ label: 'Ổn định thủy lực ngang Hβ', value: `${fmt(stab.Hb, 2)}° (yêu cầu ≥ ${hsa}°)`, ok: stab.Hb >= hsa - 1e-9 });
    checks.push({ label: 'Ổn định kết cấu dọc Sα', value: `${fmt(stab.Sa, 2)}° (yêu cầu ≥ ${ssa}°)`, ok: stab.Sa >= ssa - 1e-9 });
    checks.push({ label: 'Ổn định kết cấu ngang Sβ', value: `${fmt(stab.Sb, 2)}° (yêu cầu ≥ ${ssa}°)`, ok: stab.Sb >= ssa - 1e-9 });
    if (susp === '4' && Wtot > 0.5 * capacity) notes.push(`Treo 4 điểm với W_TOT = ${fmt(Wtot, 1)} t > 0,5 × khả năng xe (${fmt(0.5 * capacity, 1)} t): nên tránh hoặc rất thận trọng vì có thể quá tải xe; ổn định kết cấu là yếu tố giới hạn theo cả hai phương.`);
    if (susp === '3' && Wtot > 0.5 * capacity) notes.push(`Treo 3 điểm với W_TOT > 0,5 × khả năng xe: ổn định kết cấu là yếu tố giới hạn theo phương ngang${Wtot > (2 / 3) * capacity ? ', và cả phương dọc vì W_TOT > 2/3 khả năng xe' : ''}.`);
  } else {
    notes.push('Chưa có chiều cao trọng tâm chung: chưa tính góc ổn định.');
  }

  // Áp lực nền (trang 9)
  const TW = mi.tw && mi.tw > 0 ? mi.tw : DAB;
  const DAS = spec.axleSpacing;
  const gSteps: string[] = [];
  const p1 = Wtot / (TL * TW);
  const p2 = Wtot / (TL * (TW + DAS));
  gSteps.push(`Cách 1 (bóng xe bằng mặt sàn): P = (W_T + W_L)/(T_L·T_W) = ${fmt(Wtot, 3)}/(${fmt(TL, 3)}·${fmt(TW, 3)}) = ${fmt(p1, 3)} t/m² (${fmt(p1 * 9.81, 1)} kPa)`);
  gSteps.push(`Cách 2 (lan truyền 45°, đều ở độ sâu D_AS/2): P = (W_T + W_L)/(T_L·(T_W + D_AS)) = ${fmt(Wtot, 3)}/(${fmt(TL, 3)}·(${fmt(TW, 3)} + ${fmt(DAS, 2)})) = ${fmt(p2, 3)} t/m² (${fmt(p2 * 9.81, 1)} kPa)`);
  const gpMethod: 1 | 2 = mi.gpMethod === 2 ? 2 : 1;
  const pAllow = mi.pAllow ?? 0;
  const pUse = gpMethod === 1 ? p1 : p2;
  const gOk = pAllow > 0 ? pUse <= pAllow + 1e-9 : null;
  if (pAllow > 0) {
    gSteps.push(`Kết luận theo cách ${gpMethod}: ${fmt(pUse, 3)} ${gOk ? '≤' : '>'} [p] = ${fmt(pAllow, 2)} t/m² → ${gOk ? 'ĐẠT' : 'KHÔNG ĐẠT'}`);
    checks.push({ label: `Áp lực nền (cách ${gpMethod})`, value: `${fmt(pUse, 3)} / ${fmt(pAllow, 2)} t/m²`, ok: gOk });
  }
  const ground: GroundPressureM = { Wtot, TL, TW, DAS, p1, p2, method: gpMethod, allow: pAllow, ok: gOk, steps: gSteps };

  // Ngoại lực (trang 10–12)
  let ext: ExtResult | null = null;
  if (stab) {
    const G = 9.81;
    const eSteps: string[] = [];
    const n4 = axles / 2;
    // số trục của nhóm chịu: treo 4 điểm — nhóm 2+3 (ngang) và 1+2 (dọc) đều bằng nửa số trục;
    // treo 3 điểm — nhóm 2 (ngang) bằng 1/4 số trục; nhóm 1 và nhóm 2+3 (dọc) đều bằng nửa số trục
    const nT = susp === '4' ? n4 : axles / 4;
    const nL = n4;
    eSteps.push(susp === '4'
      ? `Treo 4 điểm: 4 nhóm, mỗi nhóm ${axles / 4} trục; ngang dùng nhóm 2+3 (${nT} trục), dọc dùng nhóm 1+2 (${nL} trục)`
      : `Treo 3 điểm: nhóm 1 có ${axles / 2} trục, nhóm 2 và 3 mỗi nhóm ${axles / 4} trục; ngang dùng nhóm 2 (${nT} trục), dọc dùng nhóm 1 hoặc 2+3 (${nL} trục)`);
    const forces: ExtForce[] = [];
    const add = (label: string, dir: 'T' | 'L', F: number, arm: number, armName: string, formula: string) => {
      if (!(Math.abs(F) > 1e-12)) return;
      const lever = dir === 'T' ? DAB : 0.5 * TL;
      const Fs = (F * arm) / lever;
      const n = dir === 'T' ? nT : nL;
      const Faxle = Fs / n;
      forces.push({ label, dir, F, Fs, n, Faxle, formula });
      eSteps.push(`${label}: ${formula} = ${fmt(F, 4)} t; F_SUSP-${dir} = F·${armName}/${dir === 'T' ? 'D_AB' : '(0,5·T_L)'} = ${fmt(F, 4)}·${fmt(arm, 3)}/${fmt(lever, 3)} = ${fmt(Fs, 4)} t; F_AXLE = ${fmt(Fs, 4)}/${n} = ${fmt(Faxle, 4)} t`);
    };
    const v0 = mi.vCurve ?? 0, r = mi.radius ?? 0;
    if (v0 > 0 && r > 0) {
      const a = (v0 * v0) / r;
      add('Ly tâm khi vào cua', 'T', (Wtot / G) * a, cog, 'CoG', `W_TOT/g·V0²/r = ${fmt(Wtot, 3)}/${G}·${fmt(v0, 3)}²/${fmt(r, 3)}`);
    }
    const wp = (mi.windP ?? 0) / 1000; // kg/m² → t/m²
    const wf = mi.windAFront ?? 0, ws = mi.windASide ?? 0, sf = mi.windSf ?? 1, wphi = ((mi.windPhi ?? 0) * Math.PI) / 180, cow = mi.cow && mi.cow > 0 ? mi.cow : cog;
    if (wp > 0) {
      add('Gió (dọc)', 'L', Math.cos(wphi) * wp * wf * sf, cow, 'CoW', `cos φ·W_P·A_FRONT·S_f = ${fmt(Math.cos(wphi), 4)}·${fmt(wp, 5)}·${fmt(wf, 2)}·${fmt(sf, 2)}`);
      add('Gió (ngang)', 'T', Math.sin(wphi) * wp * ws * sf, cow, 'CoW', `sin φ·W_P·A_SIDE·S_f = ${fmt(Math.sin(wphi), 4)}·${fmt(wp, 5)}·${fmt(ws, 2)}·${fmt(sf, 2)}`);
    }
    const acc = Math.abs(mi.accel ?? 0), aphi = ((mi.accPhi ?? 0) * Math.PI) / 180;
    if (acc > 0) {
      add('Tăng tốc / phanh (dọc)', 'L', (Wtot / G) * Math.cos(aphi) * acc, cog, 'CoG', `W_TOT/g·cos φ·a = ${fmt(Wtot, 3)}/${G}·${fmt(Math.cos(aphi), 4)}·${fmt(acc, 3)}`);
      add('Tăng tốc / phanh (ngang)', 'T', (Wtot / G) * Math.sin(aphi) * acc, cog, 'CoG', `W_TOT/g·sin φ·a = ${fmt(Wtot, 3)}/${G}·${fmt(Math.sin(aphi), 4)}·${fmt(acc, 3)}`);
    }
    const aGL = ((mi.alphaGL ?? 0) * Math.PI) / 180, bGT = ((mi.betaGT ?? 0) * Math.PI) / 180;
    add('Dốc dọc chưa bù', 'L', Math.sin(aGL) * Wtot, cog, 'CoG', `sin α_GL·W_TOT = ${fmt(Math.sin(aGL), 4)}·${fmt(Wtot, 3)}`);
    add('Dốc ngang chưa bù', 'T', Math.sin(bGT) * Wtot, cog, 'CoG', `sin β_GT·W_TOT = ${fmt(Math.sin(bGT), 4)}·${fmt(Wtot, 3)}`);
    const axleT = forces.filter((f) => f.dir === 'T').reduce((s, f) => s + f.Faxle, 0);
    const axleL = forces.filter((f) => f.dir === 'L').reduce((s, f) => s + f.Faxle, 0);
    const Wmax = stab.Waxle + Math.max(axleT, axleL);
    if (forces.length) {
      eSteps.push(`Cộng các ngoại lực như xảy ra đồng thời (thiên về an toàn): thêm ${fmt(axleT, 4)} t/trục (ngang), ${fmt(axleL, 4)} t/trục (dọc)`);
      eSteps.push(`Tải trục lớn nhất: W_axle + ${fmt(Math.max(axleT, axleL), 4)} = ${fmt(stab.Waxle, 4)} + ${fmt(Math.max(axleT, axleL), 4)} = ${fmt(Wmax, 4)} t ${Wmax <= Ac + 1e-9 ? '≤' : '>'} A_C = ${fmt(Ac, 3)} t`);
      checks.push({ label: 'Tải trục kể ngoại lực', value: `${fmt(Wmax, 3)} / ${fmt(Ac, 3)} t`, ok: Wmax <= Ac + 1e-9 });
      if ((mi.alphaGL ?? 0) !== 0 || (mi.betaGT ?? 0) !== 0) notes.push('Dốc chưa bù làm dời trọng tâm nên ảnh hưởng cả ổn định thủy lực (thẻ trang 12); góc ổn định thủy lực ở trên tính khi xe nằm ngang.');
    }
    ext = { forces, axleT, axleL, Waxle: Wmax, Ac, steps: eSteps };
  }

  // Chằng buộc (trang 13–14) — các lực tác dụng lên hàng tính theo trọng lượng hàng W_L
  const securing = securingCheck(mi, WT);
  if (securing.cap) {
    for (const r of securing.rows) checks.push({ label: `Chằng buộc ${r.dir}`, value: `dây ${fmt(r.cap ?? 0, 2)} t / cần ${fmt(r.apply, 2)} t`, ok: r.ok });
  } else if (mi.load > 0) {
    notes.push(`Chằng buộc theo thẻ trang 13: cần ${fmt(securing.reqZ, 2)} t theo phương đứng, ${fmt(securing.reqX, 2)} t theo phương dọc, ${fmt(securing.reqY, 2)} t theo phương ngang — chưa khai báo dây chằng.`);
  }

  // Cổ ngỗng (trang 15)
  let gooseneck: GooseneckResult | null = null;
  if (mi.gooseneck) {
    const gSt: string[] = [];
    const n = axles / 2; // nhóm đơn (nhóm 1) của treo 3 điểm
    const Fsusp = mi.load / 3;
    const Faxle1 = Fsusp / n;
    const da = mi.gnDAxle ?? 0, dg = mi.gnDNeck ?? 0, L1 = mi.gnL1 ?? 0, L2 = mi.gnL2 ?? 0;
    const dr = da > 0 ? (mi.gnSquare ? (dg / da) ** 2 : dg / da) : 0;
    const ratio = L1 > 0 ? dr * 2 * (L2 / L1) : 0;
    const Faxle2 = Fsusp / (n + ratio);
    const F5th = (Faxle1 - Faxle2) * n + (mi.gnWeight ?? 0);
    if (susp !== '3') notes.push('Cổ ngỗng chỉ dùng được khi xe ở cấu hình treo 3 điểm (thẻ trang 15).');
    gSt.push(`Không cổ ngỗng: F_SUSPENSION = W_L / số nhóm = ${fmt(mi.load, 3)} / 3 = ${fmt(Fsusp, 4)} t; F_AXLE-1 = F_SUSPENSION / số trục nhóm đơn = ${fmt(Fsusp, 4)} / ${n} = ${fmt(Faxle1, 4)} t`);
    gSt.push(`Có cổ ngỗng (2 xi lanh): F_AXLE-2 = F_SUSPENSION / (số trục + (D_GOOSENECK/D_AXLE)${mi.gnSquare ? '²' : ''}·2·(L2/L1)) = ${fmt(Fsusp, 4)} / (${n} + ${fmt(dr, 4)}·2·(${fmt(L2, 3)}/${fmt(L1, 3)})) = ${fmt(Faxle2, 4)} t`);
    gSt.push(`Lực lên mâm kéo: F_5th = (F_AXLE-1 − F_AXLE-2)·số trục + Neck_W = (${fmt(Faxle1, 4)} − ${fmt(Faxle2, 4)})·${n} + ${fmt(mi.gnWeight ?? 0, 3)} = ${fmt(F5th, 3)} t`);
    gooseneck = { Fsusp, n, Faxle1, Faxle2, F5th, ratio, steps: gSt };
  }

  // Chọn treo 3 hay 4 điểm (trang 16)
  let advice: SuspensionAdvice | null = null;
  if (cog > 0) {
    const hsa = mi.hsa ?? SAFE_HSA, ssa = mi.ssa ?? SAFE_SSA;
    const okOf = (sp: Suspension) => {
      const a = stabilityAngles({ suspension: sp, TL, DAB, cog, axles, Ac, Wtot });
      return Math.min(a.Ha, a.Hb) >= hsa - 1e-9 && Math.min(a.Sa, a.Sb) >= ssa - 1e-9;
    };
    const ok3 = okOf('3'), ok4 = okOf('4');
    const heavy = Wtot > 0.5 * capacity;
    let pick: Suspension | null, reason: string;
    if (ok3) { pick = '3'; reason = 'Treo 3 điểm đủ ổn định → dùng treo 3 điểm (dễ điều khiển, phân bố tải đều).'; }
    else if (ok4 && !heavy) { pick = '4'; reason = 'Treo 3 điểm không đủ ổn định, treo 4 điểm đủ → dùng treo 4 điểm.'; }
    else if (ok4 && heavy) { pick = null; reason = `Treo 3 điểm không đủ ổn định; treo 4 điểm đủ nhưng W_TOT > 50% khả năng xe nên tránh treo 4 điểm → cần đổi cấu hình (thêm trục dòng, module đôi, hạ trọng tâm).`; }
    else { pick = null; reason = 'Cả treo 3 điểm và 4 điểm đều không đủ ổn định → cần đổi cấu hình (thêm trục dòng, module đôi, hạ trọng tâm).'; }
    advice = { pick, ok3, ok4, reason };
  }

  // Dầm sống (trang 8)
  const Mallow = mi.spineM && mi.spineM > 0 ? mi.spineM : spmt ? 650 : 560;
  const wLine = mi.load / lines;
  const spine = spineBeam({ wLine, DAS: spec.axleSpacing, Ac, Mallow, front: mi.overhangFront ?? 0, rear: mi.overhangRear ?? 0 });
  spine.steps.unshift(`Tải một trục dòng: W_axleline = W_L / số trục dòng = ${fmt(mi.load, 3)} / ${lines} = ${fmt(wLine, 4)} t`);
  if (spine.ends.some((e) => e.n > 0)) {
    checks.push({ label: 'Dầm sống — mô men', value: `${fmt(spine.Mmax, 1)} / ${fmt(Mallow, 0)} t·m`, ok: spine.ok });
  }
  const over = Math.max(...spine.ends.map((e) => e.n));
  if (over > spine.nMax) notes.push(`Số trục dòng thò ra (${over}) vượt số cho phép theo khả năng trục (${spine.nMax}).`);
  if (over > 5) notes.push('Kinh nghiệm: không nên để quá 5 trục dòng thò ra ngoài hàng ở tải tối đa.');

  return {
    spec, payload, linesReq, lines, linesLong, wide, uc, perLine, gvw, effort, driveReq, driveAvail, ppuHp, ppuKw, pullAvail, trucksReq, lean,
    length: TL, stab, spine, ground, ext, securing, gooseneck, advice, checks, notes, ok: checks.every((c) => c.ok !== false), steps,
  };
}

/**
 * Chằng buộc theo thẻ trang 13–14. Các lực tác dụng lên hàng dùng trọng lượng hàng W_L (ví dụ trang 14):
 * ly tâm W_L/g·V0²/r; gió cos φ / sin φ·W_P·A·S_f; tăng tốc W_L/g·cos φ / sin φ·a; dốc chưa bù sin α_GL / sin β_GT·W_L.
 */
export function securingCheck(mi: ModularInput, WT: number): SecuringResult {
  const G = 9.81;
  const WL = mi.load;
  const steps: string[] = [];
  const rad = (d: number) => (d * Math.PI) / 180;
  const v0 = mi.vCurve ?? 0, r = mi.radius ?? 0;
  const curve = v0 > 0 && r > 0 ? (WL / G) * (v0 * v0) / r : 0;
  const wp = (mi.windP ?? 0) / 1000, sf = mi.windSf ?? 1, wphi = rad(mi.windPhi ?? 0);
  const windL = Math.cos(wphi) * wp * (mi.windAFront ?? 0) * sf;
  const windT = Math.sin(wphi) * wp * (mi.windASide ?? 0) * sf;
  const acc = Math.abs(mi.accel ?? 0), aphi = rad(mi.accPhi ?? 0);
  const accL = (WL / G) * Math.cos(aphi) * acc;
  const accT = (WL / G) * Math.sin(aphi) * acc;
  const aGL = rad(mi.alphaGL ?? 0), bGT = rad(mi.betaGT ?? 0);
  const gradL = Math.sin(aGL) * WL, gradT = Math.sin(bGT) * WL;
  steps.push(`Ly tâm: W_L/g·V0²/r = ${fmt(WL, 3)}/${G}·${fmt(v0, 3)}²/${fmt(r, 3)} = ${fmt(curve, 3)} t`);
  steps.push(`Gió: dọc cos φ·W_P·A_FRONT·S_f = ${fmt(windL, 3)} t; ngang sin φ·W_P·A_SIDE·S_f = ${fmt(windT, 3)} t (W_P = ${fmt(mi.windP ?? 0, 2)} kg/m², φ = ${fmt(mi.windPhi ?? 0, 1)}°)`);
  steps.push(`Tăng tốc / phanh: W_L/g·a = ${fmt(WL, 3)}/${G}·${fmt(acc, 4)} → dọc ${fmt(accL, 3)} t, ngang ${fmt(accT, 3)} t (φ = ${fmt(mi.accPhi ?? 0, 1)}°)`);
  steps.push(`Dốc chưa bù: sin α_GL·W_L = ${fmt(gradL, 3)} t; sin β_GT·W_L = ${fmt(gradT, 3)} t`);
  const Fv = WL >= WT ? WT : WL;
  steps.push(`Lực giữ thẳng đứng: ${WL >= WT ? `W_L ≥ W_T → F_V = W_T` : `W_T > W_L → F_V = W_L`} = ${fmt(Fv, 3)} t`);
  const FhL = windL + accL + gradL;
  const FhT = curve + windT + accT + gradT;
  steps.push(`F_H-L = F_WIND-L + F_ACC-L + F_2-L = ${fmt(windL, 3)} + ${fmt(accL, 3)} + ${fmt(gradL, 3)} = ${fmt(FhL, 3)} t`);
  steps.push(`F_H-T = F_CURVE + F_WIND-T + F_ACC-T + F_2-T = ${fmt(curve, 3)} + ${fmt(windT, 3)} + ${fmt(accT, 3)} + ${fmt(gradT, 3)} = ${fmt(FhT, 3)} t`);
  const mu = mi.mu ?? 0;
  const FwL = mu * Math.cos(aGL) * (WL + Fv);
  const FwT = mu * Math.cos(bGT) * (WL + Fv);
  steps.push(`Ma sát lớn nhất: F_W-L = μ·cos α_GL·(W_L + F_V) = ${fmt(mu, 3)}·${fmt(Math.cos(aGL), 4)}·${fmt(WL + Fv, 3)} = ${fmt(FwL, 3)} t; F_W-T = μ·cos β_GT·(W_L + F_V) = ${fmt(FwT, 3)} t`);
  const reqX = Math.max(0, FhL - FwL), reqY = Math.max(0, FhT - FwT), reqZ = Fv;
  steps.push(`Lực chằng cần (không nhỏ hơn 0 vì ma sát là phản lực): X = max(0, ${fmt(FhL, 3)} − ${fmt(FwL, 3)}) = ${fmt(reqX, 3)} t; Y = max(0, ${fmt(FhT, 3)} − ${fmt(FwT, 3)}) = ${fmt(reqY, 3)} t; Z = F_V = ${fmt(reqZ, 3)} t`);
  const ls = (mi.lashings ?? []).filter((l) => l.n > 0 && l.cc > 0);
  let cap: SecuringResult['cap'] = null;
  if (ls.length) {
    cap = { xp: 0, xn: 0, yp: 0, yn: 0, z: 0 };
    for (const l of ls) {
      const p = rad(l.phi), o = rad(l.omega);
      const cx = Math.sin(p) * Math.cos(o) * l.cc * l.n, cy = Math.sin(p) * Math.sin(o) * l.cc * l.n, cz = Math.cos(p) * l.cc * l.n;
      if (l.q === 1 || l.q === 4) cap.xp += cx; else cap.xn += cx;
      if (l.q === 1 || l.q === 2) cap.yp += cy; else cap.yn += cy;
      cap.z += cz;
      steps.push(`Q${l.q}: ${l.n} dây × Cc ${fmt(l.cc, 2)} t, φ = ${fmt(l.phi, 1)}°, Ω = ${fmt(l.omega, 1)}° → Cc_X = sin φ·cos Ω·Cc = ${fmt(cx, 3)}; Cc_Y = sin φ·sin Ω·Cc = ${fmt(cy, 3)}; Cc_Z = cos φ·Cc = ${fmt(cz, 3)} t`);
    }
  }
  const ok = (req: number, c: number | null) => (c === null ? null : c >= req - 1e-9);
  const rows = [
    { force: 'F_V', dir: 'Z', req: Fv, fric: null, apply: reqZ, cap: cap ? cap.z : null, ok: ok(reqZ, cap ? cap.z : null) },
    { force: 'F_H-L', dir: 'X (dương)', req: FhL, fric: FwL, apply: reqX, cap: cap ? cap.xp : null, ok: ok(reqX, cap ? cap.xp : null) },
    { force: 'F_H-L', dir: 'X (âm)', req: FhL, fric: FwL, apply: reqX, cap: cap ? cap.xn : null, ok: ok(reqX, cap ? cap.xn : null) },
    { force: 'F_H-T', dir: 'Y (dương)', req: FhT, fric: FwT, apply: reqY, cap: cap ? cap.yp : null, ok: ok(reqY, cap ? cap.yp : null) },
    { force: 'F_H-T', dir: 'Y (âm)', req: FhT, fric: FwT, apply: reqY, cap: cap ? cap.yn : null, ok: ok(reqY, cap ? cap.yn : null) },
  ];
  return { curve, windL, windT, accL, accT, gradL, gradT, Fv, FhL, FhT, FwL, FwT, reqX, reqY, reqZ, cap, rows, steps };
}
