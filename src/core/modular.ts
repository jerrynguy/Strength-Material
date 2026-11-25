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
  /** gió: áp lực gió W_P (kN/m²), diện tích chắn gió (m²), hệ số hình dạng S_f, góc φ, chiều cao tâm mặt chắn gió trên vùng ổn định CoW (m) */
  windP?: number;
  windA?: number;
  windSf?: number;
  windPhi?: number;
  cow?: number;
  /** góc dốc chưa bù của xe (sau khi xe tự cân bằng), dọc α_GL và ngang β_GT (°) */
  alphaGL?: number;
  betaGT?: number;
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
  windA: 0,
  windSf: 1,
  windPhi: 0,
  cow: 0,
  alphaGL: 0,
  betaGT: 0,
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
    const wp = (mi.windP ?? 0) / G; // kN/m² → t/m²
    const wa = mi.windA ?? 0, sf = mi.windSf ?? 1, wphi = ((mi.windPhi ?? 0) * Math.PI) / 180, cow = mi.cow && mi.cow > 0 ? mi.cow : cog;
    if (wp > 0 && wa > 0) {
      add('Gió (dọc)', 'L', Math.cos(wphi) * wp * wa * sf, cow, 'CoW', `cos φ·W_P·A·S_f = ${fmt(Math.cos(wphi), 4)}·${fmt(wp, 4)}·${fmt(wa, 2)}·${fmt(sf, 2)}`);
      add('Gió (ngang)', 'T', Math.sin(wphi) * wp * wa * sf, cow, 'CoW', `sin φ·W_P·A·S_f = ${fmt(Math.sin(wphi), 4)}·${fmt(wp, 4)}·${fmt(wa, 2)}·${fmt(sf, 2)}`);
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
    length: TL, stab, spine, ground, ext, checks, notes, ok: checks.every((c) => c.ok !== false), steps,
  };
}
