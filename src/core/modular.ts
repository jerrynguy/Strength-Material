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
    length: TL, stab, spine, checks, notes, ok: checks.every((c) => c.ok !== false), steps,
  };
}
