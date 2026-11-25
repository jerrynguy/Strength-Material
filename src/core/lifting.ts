/**
 * Kiểm tra phương án nâng hạ bằng cẩu (xe cẩu bánh lốp / cẩu bánh xích), theo cách lập bảng trong hồ sơ
 * "Lifting arrangement" (PTSC — Block B – Ô Môn gas pipeline):
 *
 *  - Cẩu: tải nâng tính toán = (tải trên móc·CF·COG·TF·YF·SKL + khối lượng phụ kiện) · DAF; UC = tải tính toán / sức nâng
 *    theo bảng tải (load chart) tại chiều dài cần và bán kính làm việc.
 *  - Cáp, dây vải, ma ní, thanh gánh (spreader bar): tải lớn nhất = T·CF·COG·TF·YF·SKL + khối lượng phụ kiện·DAF;
 *    hệ số an toàn = SWL·hệ số giảm / tải lớn nhất ≥ 1. T = W / (n·sinα), α là góc nhánh với phương ngang.
 *  - Áp lực nền dưới chân chống (outrigger) có tấm kê; dưới bánh xích (trung bình và lệch tâm).
 *  - Áp lực nền bãi xếp ống nhiều tầng (xếp lồng, mỗi tầng ít hơn tầng dưới một ống).
 *
 * Đơn vị: khối lượng, tải t (tấn lực); chiều dài m; áp lực t/m² (1 t/m² ≈ 9,81 kPa).
 */
import { fmt } from './stress';

const rad = (deg: number) => (deg * Math.PI) / 180;
const num = (x: number) => (Number.isFinite(x) ? x : 0);

/* ------------------------------------------------------------------ */
/* Bảng tải cẩu                                                         */
/* ------------------------------------------------------------------ */

export interface LoadChart {
  key: string;
  name: string;
  kind: 'mobile' | 'crawler';
  /** chiều dài cần các cột (m) */
  booms: number[];
  /** mỗi dòng: bán kính (m) và sức nâng (t) theo từng cột; null = ngoài phạm vi */
  rows: { r: number; cap: (number | null)[] }[];
  note?: string;
}

const _ = null;

/** Trích bảng tải trên bản vẽ (chỉ phần in trên bản vẽ — dùng bảng đầy đủ của nhà sản xuất khi tra ngoài phạm vi này) */
export const LOAD_CHARTS: LoadChart[] = [
  {
    key: 'ltm1080', name: 'Liebherr LTM 1080/1', kind: 'mobile',
    booms: [10.8, 14.2, 17.6, 21.1, 24.5, 27.9, 31.3],
    rows: [
      { r: 3, cap: [62, 62, 57, _, _, _, _] },
      { r: 3.5, cap: [56, 56, 53, 46, _, _, _] },
      { r: 4, cap: [52, 52, 49.5, 44, _, _, _] },
      { r: 4.5, cap: [47.5, 47.5, 46, 42, 35, _, _] },
      { r: 5, cap: [44, 44, 43, 40, 33.5, 27.9, _] },
      { r: 6, cap: [38, 37.5, 37, 36.5, 30.5, 26.1, 22.6] },
      { r: 7, cap: [33, 32.5, 32.5, 32, 28, 24.5, 21.2] },
      { r: 8, cap: [28.5, 28.3, 27.7, 27.5, 25.6, 22.9, 19.9] },
      { r: 9, cap: [_, 24.6, 24.1, 23.8, 22.9, 21, 18.7] },
      { r: 10, cap: [_, 21.6, 21.1, 20.6, 19.9, 19.5, 17.5] },
      { r: 12, cap: [_, 16.1, 15.7, 15.5, 15.5, 15.3, 15.2] },
      { r: 14, cap: [_, _, 12.1, 12, 12.1, 12.2, 12.3] },
    ],
    note: 'Trích bản vẽ PTSC-PL-LA-DW-004 (cột 10,8 m không đánh dấu *).',
  },
  {
    key: 'att1354', name: 'Terex ATT 1354', kind: 'mobile',
    booms: [12.32, 16.15, 19.9, 24, 28, 31.7],
    rows: [
      { r: 3, cap: [87.2, 65.2, 63.8, _, _, _] },
      { r: 4, cap: [72.6, 62.75, 57.4, 41.45, 42.2, _] },
      { r: 5, cap: [61.65, 59.6, 49.8, 40.85, 41.3, _] },
      { r: 6, cap: [53.2, 52, 43.55, 39.75, 37.9, 35.8] },
      { r: 7, cap: [45.2, 43.8, 38.75, 35.85, 33.75, 31.9] },
      { r: 8, cap: [38.75, 37.25, 34.55, 31.9, 30.1, 28.7] },
      { r: 9, cap: [33.6, 32.15, 31.1, 29, 27.1, 25.85] },
      { r: 10, cap: [_, 28.1, 27.2, 26.1, 24.6, 23.45] },
      { r: 12, cap: [_, 22, 21.1, 21.3, 20.7, 19.75] },
      { r: 14, cap: [_, _, 16.55, 16.95, 17.05, 16.85] },
      { r: 16, cap: [_, _, 13.5, 13.7, 13.8, 14.25] },
    ],
    note: 'Trích bản vẽ PTSC-PL-LA-DW-004 (bỏ cột 12,32⁽¹⁾ m), đối trọng 23 t.',
  },
  {
    key: 'ls248', name: 'Sumitomo LS-248RH-5', kind: 'crawler',
    booms: [18.3, 21.35, 24.4, 27.45, 30.5],
    rows: [
      { r: 5, cap: [150, _, _, _, _] },
      { r: 6, cap: [140, 128.1, 116.8, _, _] },
      { r: 7, cap: [118.8, 117, 111.5, 102.5, 94.4] },
      { r: 8, cap: [99.2, 98.9, 98.8, 96.2, 90.7] },
      { r: 9, cap: [79.4, 79.2, 79.1, 78.9, 78.8] },
      { r: 10, cap: [67.9, 67.7, 67.6, 67.5, 67.4] },
      { r: 12, cap: [52.6, 52.3, 52.2, 52, 51.8] },
      { r: 14, cap: [42.9, 42.6, 42.4, 42.3, 42] },
      { r: 16, cap: [36.2, 35.8, 35.7, 35.5, 35.2] },
      { r: 18, cap: [_, 30.9, 30.7, 30.5, 30.2] },
      { r: 20, cap: [_, 26.9, 26.8, 26.6, 26.3] },
    ],
    note: 'Trích bản vẽ PTSC-PL-LA-DW-004. Ô ghi kèm bán kính khác (133,6/5,5; 104,3/6,5; 33,2/17,0) để trống.',
  },
];

export type ChartMode = 'step' | 'linear';

export interface ChartLookup {
  cap: number | null;
  /** chỉ số cột dùng, dòng dùng (dòng trên / dưới khi nội suy) */
  col: number;
  rowLo: number;
  rowHi: number;
  text: string;
}

/**
 * Tra sức nâng theo bảng tải. Chiều dài cần phải trùng một cột (sai số 0,05 m).
 * step: lấy dòng có bán kính ≥ R gần nhất (thiên về an toàn, cách thường dùng).
 * linear: nội suy tuyến tính giữa hai dòng kề nhau.
 */
export function lookupChart(ch: LoadChart, boom: number, r: number, mode: ChartMode = 'step'): ChartLookup {
  const col = ch.booms.findIndex((b) => Math.abs(b - boom) <= 0.05);
  const none = (text: string): ChartLookup => ({ cap: null, col, rowLo: -1, rowHi: -1, text });
  if (col < 0) return none(`Chiều dài cần ${fmt(boom, 2)} m không có trong bảng (${ch.booms.join('; ')} m).`);
  const rows = ch.rows;
  const hi = rows.findIndex((x) => x.r >= r - 1e-9);
  if (hi < 0) return none(`Bán kính ${fmt(r, 2)} m vượt phạm vi bảng (lớn nhất ${rows.at(-1)?.r} m).`);
  const cHi = rows[hi].cap[col];
  if (Math.abs(rows[hi].r - r) < 1e-9 || mode === 'step' || hi === 0) {
    if (cHi == null) return none(`Ô tra (R = ${rows[hi].r} m, cần ${ch.booms[col]} m) ngoài phạm vi làm việc.`);
    const exact = Math.abs(rows[hi].r - r) < 1e-9;
    return { cap: cHi, col, rowLo: hi, rowHi: hi, text: exact ? `Bảng tải: cần ${ch.booms[col]} m, R = ${rows[hi].r} m → ${cHi} t` : `Bảng tải: cần ${ch.booms[col]} m, R = ${fmt(r, 2)} m → lấy dòng R = ${rows[hi].r} m (lớn hơn kề) → ${cHi} t` };
  }
  const lo = hi - 1;
  const cLo = rows[lo].cap[col];
  if (cHi == null || cLo == null) return none(`Ô tra quanh R = ${fmt(r, 2)} m, cần ${ch.booms[col]} m ngoài phạm vi làm việc.`);
  const t = (r - rows[lo].r) / (rows[hi].r - rows[lo].r);
  const cap = cLo + (cHi - cLo) * t;
  return { cap, col, rowLo: lo, rowHi: hi, text: `Bảng tải: cần ${ch.booms[col]} m, nội suy giữa R = ${rows[lo].r} m (${cLo} t) và ${rows[hi].r} m (${cHi} t) → ${fmt(cap, 3)} t` };
}

/* ------------------------------------------------------------------ */
/* Mô hình                                                              */
/* ------------------------------------------------------------------ */

export interface Factors {
  /** hệ số dự phòng khối lượng (weight contingency) */
  cf: number;
  /** hệ số lệch trọng tâm */
  cog: number;
  /** hệ số nghiêng (tilt) */
  tf: number;
  /** hệ số xoay (yaw) */
  yf: number;
  /** hệ số tải lệch (skew load) */
  skl: number;
  /** hệ số động (dynamic amplification) */
  daf: number;
}

export const DEFAULT_FACTORS: Factors = { cf: 1.05, cog: 1, tf: 1, yf: 1, skl: 1, daf: 1.15 };

export interface RigItem {
  name: string;
  /** khối lượng một chiếc (t) */
  mass: number;
  qty: number;
}

export interface CraneSetup {
  name: string;
  kind: 'mobile' | 'crawler';
  /** khoá bảng tải trong LOAD_CHARTS; '' = nhập sức nâng tay */
  chart: string;
  chartMode: ChartMode;
  boom: number;
  counterweight: number;
  /** UC cho phép (%) */
  ucLimit: number;
}

export interface LiftPosition {
  label: string;
  radius: number;
  /** sức nâng nhập tay (t) — dùng khi không có bảng tải hoặc capManual > 0 */
  capManual: number;
}

export type GearType = 'sling' | 'webbing' | 'shackle' | 'spreader' | 'other';
export const GEAR_LABEL: Record<GearType, string> = { sling: 'Cáp thép', webbing: 'Dây vải', shackle: 'Ma ní', spreader: 'Thanh gánh', other: 'Khác' };

export interface Gear {
  type: GearType;
  name: string;
  /** khối lượng do bộ phận này đỡ (t) — thường là khối lượng hàng */
  load: number;
  /** số nhánh chia tải */
  legs: number;
  /** góc nhánh với phương ngang (°): 90 = thẳng đứng */
  angle: number;
  /** chiều dài (m) — chỉ để ghi */
  length: number;
  /** khối lượng bản thân một chiếc (t) — chỉ để ghi */
  self: number;
  /** khối lượng phụ kiện cộng thêm khi tính (t), nhân DAF */
  rigging: number;
  swl: number;
  /** hệ số giảm SWL (ví dụ thắt cổ dê 0,8) */
  reduce: number;
}

export interface Outrigger {
  enabled: boolean;
  /** phản lực chân chống lớn nhất (t) — theo phần mềm / bảng của nhà sản xuất */
  force: number;
  /** tấm kê: dài × rộng × dày (m) */
  matL: number;
  matB: number;
  matT: number;
  /** khối lượng riêng tấm kê (t/m³), 0 = không kể */
  matDensity: number;
  /** góc lan truyền qua tấm kê (°), 0 = chỉ lấy diện tích tấm */
  spread: number;
  /** áp lực nền cho phép (t/m²), 0 = bỏ qua */
  allow: number;
}

export interface Crawler {
  enabled: boolean;
  /** 'calc' = tính từ khối lượng & kích thước xích; 'manual' = nhập áp lực theo nhà sản xuất */
  mode: 'calc' | 'manual';
  pManual: number;
  /** khối lượng bản thân cẩu gồm đối trọng (t) */
  craneMass: number;
  /** chiều dài tiếp đất một bên xích (m) */
  trackL: number;
  /** bề rộng guốc xích (m) */
  shoeB: number;
  /** độ lệch tâm hợp lực theo phương dọc xích (m) */
  ecc: number;
  /** tấm thép kê dưới xích: rộng phân bố thêm theo mỗi phía (m) — 0 = không kê */
  matT: number;
  spread: number;
  allow: number;
}

export interface PipeStack {
  enabled: boolean;
  name: string;
  /** khối lượng một ống (t) */
  unit: number;
  /** đường kính ngoài (m) */
  od: number;
  /** số ống tầng dưới cùng */
  nBottom: number;
  /** số tầng */
  tiers: number;
  /** diện tích chịu tải: dài × rộng (m) */
  areaL: number;
  areaB: number;
  allow: number;
}

export interface LiftModel {
  title: string;
  loadName: string;
  /** khối lượng hàng (t) */
  net: number;
  factors: Factors;
  rigging: RigItem[];
  crane: CraneSetup;
  positions: LiftPosition[];
  gear: Gear[];
  outrigger: Outrigger;
  crawler: Crawler;
  stack: PipeStack;
}

/* ------------------------------------------------------------------ */
/* Tính                                                                 */
/* ------------------------------------------------------------------ */

export const factorProduct = (f: Factors) => f.cf * f.cog * f.tf * f.yf * f.skl;
export const riggingTotal = (m: LiftModel) => m.rigging.reduce((s, r) => s + num(r.mass) * num(r.qty), 0);

export interface CraneRow {
  label: string;
  radius: number;
  cap: number | null;
  capText: string;
  uc: number;
  ok: boolean;
}

export interface CraneResult {
  factored: number;
  rigging: number;
  rows: CraneRow[];
  steps: string[];
  ok: boolean;
  limit: number;
}

export function craneCheck(m: LiftModel): CraneResult {
  const f = m.factors;
  const rig = riggingTotal(m);
  const k = factorProduct(f);
  const factored = (m.net * k + rig) * f.daf;
  const limit = (m.crane.ucLimit > 0 ? m.crane.ucLimit : 100) / 100;
  const chart = LOAD_CHARTS.find((c) => c.key === m.crane.chart);
  const rows: CraneRow[] = m.positions.map((p) => {
    let cap: number | null = null;
    let capText = '';
    if (p.capManual > 0) {
      cap = p.capManual;
      capText = `Sức nâng nhập tay: ${fmt(cap, 3)} t`;
    } else if (chart) {
      const l = lookupChart(chart, m.crane.boom, p.radius, m.crane.chartMode);
      cap = l.cap;
      capText = l.text;
    } else capText = 'Chưa có sức nâng (chọn bảng tải hoặc nhập tay).';
    const uc = cap && cap > 0 ? factored / cap : Infinity;
    return { label: p.label, radius: p.radius, cap, capText, uc, ok: uc <= limit + 1e-9 };
  });
  const steps = [
    `Khối lượng phụ kiện (móc, thanh gánh, cáp, ma ní…): ${m.rigging.map((r) => `${r.qty > 1 ? `${r.qty}×` : ''}${fmt(r.mass, 3)}`).join(' + ') || '0'} = ${fmt(rig, 3)} t`,
    `Tải nâng tính toán = (tải trên móc·CF·COG·TF·YF·SKL + phụ kiện)·DAF = (${fmt(m.net, 3)}·${f.cf}·${f.cog}·${f.tf}·${f.yf}·${f.skl} + ${fmt(rig, 3)})·${f.daf} = ${fmt(factored, 3)} t`,
    ...rows.map((r) => `${r.label} (R = ${fmt(r.radius, 2)} m): ${r.capText}; UC = ${fmt(factored, 3)} / ${r.cap != null ? fmt(r.cap, 3) : '—'} = ${Number.isFinite(r.uc) ? `${fmt(r.uc * 100, 2)}%` : '—'} ${r.ok ? '≤' : '>'} ${fmt(limit * 100, 0)}% → ${r.ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`),
  ];
  return { factored, rigging: rig, rows, steps, ok: rows.length > 0 && rows.every((r) => r.ok), limit };
}

export interface GearResult {
  gear: Gear;
  /** lực một nhánh chưa nhân hệ số (t) */
  tension: number;
  /** tải lớn nhất tính toán (t) */
  max: number;
  swlEff: number;
  sf: number;
  ok: boolean;
  steps: string[];
}

export function gearCheck(g: Gear, f: Factors): GearResult {
  const k = factorProduct(f);
  const legs = Math.max(1, Math.round(g.legs));
  const sinA = Math.sin(rad(Math.min(90, Math.max(1, g.angle))));
  const tension = g.load / (legs * sinA);
  const max = tension * k + g.rigging * f.daf;
  const swlEff = g.swl * (g.reduce > 0 ? g.reduce : 1);
  const sf = max > 0 ? swlEff / max : Infinity;
  const ok = sf >= 1 - 1e-9;
  const steps = [
    `Tải một nhánh T = W / (n·sinα) = ${fmt(g.load, 3)} / (${legs}·sin${fmt(g.angle, 1)}°) = ${fmt(tension, 3)} t`,
    `Tải lớn nhất = T·CF·COG·TF·YF·SKL + phụ kiện·DAF = ${fmt(tension, 3)}·${fmt(k, 4)} + ${fmt(g.rigging, 3)}·${f.daf} = ${fmt(max, 3)} t`,
    `Hệ số an toàn = SWL·hệ số giảm / tải lớn nhất = ${fmt(g.swl, 3)}·${g.reduce} / ${fmt(max, 3)} = ${fmt(sf, 3)} ${ok ? '≥' : '<'} 1 → ${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`,
  ];
  return { gear: g, tension, max, swlEff, sf, ok, steps };
}

export interface PressureResult {
  enabled: boolean;
  p: number;
  area: number;
  load: number;
  allow: number;
  ok: boolean | null;
  steps: string[];
  /** áp lực trung bình (bánh xích) */
  pAvg?: number;
}

export function outriggerPressure(o: Outrigger): PressureResult {
  const d = o.matT * Math.tan(rad(o.spread));
  const L = o.matL + 2 * d, B = o.matB + 2 * d;
  const area = L * B;
  const matW = o.matDensity > 0 ? o.matL * o.matB * o.matT * o.matDensity : 0;
  const load = o.force + matW;
  const p = area > 0 ? load / area : Infinity;
  const ok = o.allow > 0 ? p <= o.allow + 1e-9 : null;
  const steps = [
    `Phản lực chân chống lớn nhất F = ${fmt(o.force, 3)} t`,
    ...(matW > 0 ? [`Tự trọng tấm kê = ${fmt(o.matL, 3)}·${fmt(o.matB, 3)}·${fmt(o.matT, 3)}·${fmt(o.matDensity, 3)} = ${fmt(matW, 3)} t`] : []),
    d > 0
      ? `Diện tích chịu tải (lan truyền ${o.spread}° qua tấm dày ${fmt(o.matT, 3)} m): (${fmt(o.matL, 3)} + 2·${fmt(d, 3)})·(${fmt(o.matB, 3)} + 2·${fmt(d, 3)}) = ${fmt(area, 3)} m²`
      : `Diện tích tấm kê A = ${fmt(o.matL, 3)}·${fmt(o.matB, 3)} = ${fmt(area, 3)} m²`,
    `p = ${fmt(load, 3)} / ${fmt(area, 3)} = ${fmt(p, 3)} t/m² (${fmt(p * 9.81, 1)} kPa)${ok === null ? '' : ` ${ok ? '≤' : '>'} [p] = ${o.allow} t/m² → ${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`}`,
  ];
  return { enabled: o.enabled, p, area, load, allow: o.allow, ok, steps };
}

export function crawlerPressure(c: Crawler, liftLoad: number): PressureResult {
  if (c.mode === 'manual') {
    const ok = c.allow > 0 ? c.pManual <= c.allow + 1e-9 : null;
    return {
      enabled: c.enabled, p: c.pManual, area: 0, load: 0, allow: c.allow, ok,
      steps: [`Áp lực dưới xích theo nhà sản xuất / tính riêng: p = ${fmt(c.pManual, 3)} t/m²${ok === null ? '' : ` ${ok ? '≤' : '>'} [p] = ${c.allow} t/m² → ${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`}`],
    };
  }
  const d = c.matT * Math.tan(rad(c.spread));
  const L = c.trackL + 2 * d, B = c.shoeB + 2 * d;
  const W = c.craneMass + liftLoad;
  const area = 2 * L * B;
  const pAvg = area > 0 ? W / area : Infinity;
  const e = Math.abs(c.ecc);
  let p: number;
  let shape: string;
  if (e <= L / 6) {
    p = pAvg * (1 + (6 * e) / L);
    shape = `e = ${fmt(e, 3)} m ≤ L/6 = ${fmt(L / 6, 3)} m → phân bố hình thang: p_max = p_tb·(1 + 6e/L) = ${fmt(p, 3)} t/m²`;
  } else if (e < L / 2) {
    p = (2 * W) / (2 * B * 3 * (L / 2 - e));
    shape = `e = ${fmt(e, 3)} m > L/6 → phân bố tam giác trên chiều dài 3·(L/2 − e) = ${fmt(3 * (L / 2 - e), 3)} m: p_max = 2W / (2·B·3(L/2 − e)) = ${fmt(p, 3)} t/m²`;
  } else {
    p = Infinity;
    shape = 'e ≥ L/2: hợp lực ra ngoài chiều dài xích — cẩu mất ổn định.';
  }
  const ok = c.allow > 0 ? p <= c.allow + 1e-9 : null;
  const steps = [
    `Tổng tải xuống nền W = khối lượng cẩu + tải nâng = ${fmt(c.craneMass, 3)} + ${fmt(liftLoad, 3)} = ${fmt(W, 3)} t`,
    d > 0
      ? `Vệt mỗi bên xích (lan truyền ${c.spread}° qua lớp kê ${fmt(c.matT, 3)} m): L = ${fmt(L, 3)} m, B = ${fmt(B, 3)} m`
      : `Vệt mỗi bên xích: L = ${fmt(L, 3)} m, B = ${fmt(B, 3)} m`,
    `Áp lực trung bình p_tb = W / (2·L·B) = ${fmt(W, 3)} / ${fmt(area, 3)} = ${fmt(pAvg, 3)} t/m²`,
    shape,
    ...(ok === null ? [] : [`p_max = ${fmt(p, 3)} t/m² ${ok ? '≤' : '>'} [p] = ${c.allow} t/m² → ${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`]),
  ];
  return { enabled: c.enabled, p, pAvg, area, load: W, allow: c.allow, ok, steps };
}

export interface StackTier {
  tiers: number;
  count: number;
  weight: number;
  height: number;
  p: number;
  ok: boolean | null;
}

export interface StackResult {
  enabled: boolean;
  area: number;
  rows: StackTier[];
  steps: string[];
  ok: boolean | null;
}

/** Bãi xếp ống: xếp lồng, tầng i có (n₁ − i + 1) ống; p = n·m / (dài·rộng) */
export function stackPressure(s: PipeStack): StackResult {
  const area = s.areaL * s.areaB;
  const T = Math.max(1, Math.round(s.tiers));
  const rows: StackTier[] = [];
  let count = 0;
  for (let k = 1; k <= T; k++) {
    count += Math.max(0, Math.round(s.nBottom) - (k - 1));
    const weight = count * s.unit;
    const p = area > 0 ? weight / area : Infinity;
    rows.push({ tiers: k, count, weight, height: s.od * (1 + ((k - 1) * Math.sqrt(3)) / 2), p, ok: s.allow > 0 ? p <= s.allow + 1e-9 : null });
  }
  const last = rows[rows.length - 1];
  const steps = [
    `Số ống: tầng dưới ${Math.round(s.nBottom)} ống, mỗi tầng trên ít hơn 1 ống (xếp lồng) → ${T} tầng: ${rows.map((r) => r.count).join(' / ')} ống (cộng dồn)`,
    `Diện tích chịu tải F_a = ${fmt(s.areaL, 3)} × ${fmt(s.areaB, 3)} = ${fmt(area, 3)} m²`,
    `${T} tầng: tổng khối lượng = ${last.count} × ${fmt(s.unit, 3)} = ${fmt(last.weight, 3)} t; p = ${fmt(last.weight, 3)} / ${fmt(area, 3)} = ${fmt(last.p, 3)} t/m²${last.ok === null ? '' : ` ${last.ok ? '≤' : '>'} [p] = ${s.allow} t/m²`}`,
    `Chiều cao chồng (lý thuyết, chưa kể gối kê) = D·(1 + (k − 1)·√3/2) = ${fmt(last.height, 3)} m`,
  ];
  return { enabled: s.enabled, area, rows, steps, ok: last.ok };
}

export interface LiftResult {
  crane: CraneResult;
  gear: GearResult[];
  outrigger: PressureResult;
  crawler: PressureResult;
  stack: StackResult;
  warnings: string[];
  ok: boolean;
}

export function analyzeLift(m: LiftModel): LiftResult {
  const crane = craneCheck(m);
  const gear = m.gear.map((g) => gearCheck(g, m.factors));
  const outrigger = outriggerPressure(m.outrigger);
  const crawler = crawlerPressure(m.crawler, crane.factored);
  const stack = stackPressure(m.stack);
  const warnings: string[] = [];
  const chart = LOAD_CHARTS.find((c) => c.key === m.crane.chart);
  if (chart && chart.kind !== m.crane.kind) warnings.push(`Bảng tải ${chart.name} là cẩu ${chart.kind === 'crawler' ? 'bánh xích' : 'bánh lốp'}, khác loại cẩu đã chọn.`);
  if (m.crane.ucLimit > 100) warnings.push('UC cho phép lớn hơn 100% sức nâng.');
  if (m.gear.some((g) => g.angle < 45)) warnings.push('Có nhánh cáp nghiêng dưới 45° so với phương ngang: lực nhánh tăng mạnh, nên tăng góc hoặc dùng thanh gánh.');
  if (m.outrigger.enabled && m.outrigger.allow <= 0) warnings.push('Chưa nhập áp lực nền cho phép dưới chân chống — chỉ tính, không kết luận.');
  if (m.crawler.enabled && m.crawler.allow <= 0) warnings.push('Chưa nhập áp lực nền cho phép dưới bánh xích — chỉ tính, không kết luận.');
  if (m.stack.enabled && m.stack.allow <= 0) warnings.push('Chưa nhập sức chịu tải của bãi xếp ống — chỉ tính, không kết luận.');
  if (m.positions.some((p) => p.capManual <= 0) && !chart) warnings.push('Có vị trí chưa có sức nâng.');
  warnings.push('Sức nâng trong bảng tải thường đã trừ móc chính; kiểm tra ghi chú của nhà sản xuất về khối lượng móc, cáp phụ, cần phụ, và điều kiện gió.');
  const pres = [m.outrigger.enabled ? outrigger.ok : null, m.crawler.enabled ? crawler.ok : null, m.stack.enabled ? stack.ok : null];
  const ok = crane.ok && gear.every((g) => g.ok) && pres.every((x) => x !== false);
  return { crane, gear, outrigger, crawler, stack, warnings, ok };
}

/* ------------------------------------------------------------------ */
/* Bài mẫu (bản vẽ PTSC-PL-LA-DW-004 / PTSC-PL-PLA-DW-005)              */
/* ------------------------------------------------------------------ */

/** Cáp, dây vải, ma ní theo bảng "Check sling", "Check shackles" (tải trên móc chia 2 điểm nâng, nhánh thẳng đứng) */
const docGear = (net: number): Gear[] => [
  { type: 'sling', name: '#1 Cáp thép 7,5 t / 10 m', load: net, legs: 2, angle: 90, length: 10, self: 0.0192, rigging: 1.042, swl: 7.5, reduce: 1 },
  { type: 'webbing', name: '#2 Dây vải 7,5 t / 6 m', load: net, legs: 2, angle: 90, length: 6, self: 0.0171, rigging: 1.042, swl: 7.5, reduce: 1 },
  { type: 'shackle', name: '#1 Ma ní SWL 7,5 t', load: net, legs: 2, angle: 90, length: 0, self: 0.00258, rigging: 0.01, swl: 7.5, reduce: 1 },
];

const docStack = (enabled: boolean): PipeStack => ({ enabled, name: 'Ống loại 2', unit: 8.696, od: 0.788, nBottom: 25, tiers: 5, areaL: 26, areaB: 4, allow: 0 });

const offOutrigger: Outrigger = { enabled: false, force: 0, matL: 2, matB: 2, matT: 0.25, matDensity: 0, spread: 0, allow: 0 };
const offCrawler: Crawler = { enabled: false, mode: 'manual', pManual: 0, craneMass: 0, trackL: 5.5, shoeB: 0.76, ecc: 0, matT: 0, spread: 45, allow: 0 };

/**
 * Xe cẩu LTM 1080/1, cần 27,9 m, R = 12 m, ống loại 2 (8,696 t, hồ sơ làm tròn 8,7 t).
 * Hồ sơ: tải tính toán 12,528 t, UC 81,88%; sling 5,77 t, SF 1,300; ma ní 4,58 t, SF 1,64;
 * chân chống 33,6 t trên tấm gỗ 2 × 2 × 0,25 m (hồ sơ ghi 8,11 t/m², F/A = 8,40 t/m²).
 */
export function liftLtm1080(): LiftModel {
  return {
    title: 'Nâng ống loại 2 từ sà lan lên xe — LTM 1080/1, R = 12 m',
    loadName: 'Ống loại 2 (OD 788, L = 12 m)',
    net: 8.7,
    factors: { ...DEFAULT_FACTORS },
    rigging: [{ name: 'Phụ kiện (thanh gánh, cáp, ma ní, móc) theo hồ sơ', mass: 1.759, qty: 1 }],
    crane: { name: 'LTM 1080/1', kind: 'mobile', chart: 'ltm1080', chartMode: 'step', boom: 27.9, counterweight: 16, ucLimit: 100 },
    positions: [
      { label: 'Nhấc khỏi sà lan', radius: 12, capManual: 0 },
      { label: 'Đặt lên sơ mi rơ moóc', radius: 12, capManual: 0 },
    ],
    gear: docGear(8.7),
    outrigger: { enabled: true, force: 33.6, matL: 2, matB: 2, matT: 0.25, matDensity: 0, spread: 0, allow: 0 },
    crawler: offCrawler,
    stack: docStack(true),
  };
}

/** Xe cẩu ATT 1354, cần 31,7 m, R = 14 m. Hồ sơ: 12,758 t, UC 75,71%; chân chống 37,6 t (hồ sơ ghi 9,07 t/m²). */
export function liftAtt1354(): LiftModel {
  return {
    ...liftLtm1080(),
    title: 'Nâng ống loại 2 từ sà lan lên xe — ATT 1354, R = 14 m',
    rigging: [{ name: 'Phụ kiện (thanh gánh, cáp, ma ní, móc) theo hồ sơ', mass: 1.959, qty: 1 }],
    crane: { name: 'ATT 1354', kind: 'mobile', chart: 'att1354', chartMode: 'step', boom: 31.7, counterweight: 23, ucLimit: 100 },
    positions: [
      { label: 'Nhấc khỏi sà lan', radius: 14, capManual: 0 },
      { label: 'Đặt lên sơ mi rơ moóc', radius: 14, capManual: 0 },
    ],
    outrigger: { enabled: true, force: 37.6, matL: 2, matB: 2, matT: 0.25, matDensity: 0, spread: 0, allow: 0 },
    stack: docStack(false),
  };
}

/**
 * Cẩu xích LS-248RH-5, cần 27,45 m: nhấc ở R = 18 m (30,5 t), quay về R = 14 m (42,3 t).
 * Hồ sơ: 14,701 t, UC 48,20%; áp lực dưới xích 15,70 t/m² (nhập theo hồ sơ, tấm thép 4 × 1,5 × 0,25 m).
 */
export function liftLs248(): LiftModel {
  return {
    ...liftLtm1080(),
    title: 'Nâng ống loại 2 từ sà lan lên xe — cẩu xích LS-248RH-5, R = 18 → 14 m',
    rigging: [{ name: 'Phụ kiện (thanh gánh, cáp, ma ní, móc) theo hồ sơ', mass: 3.649, qty: 1 }],
    crane: { name: 'LS-248RH-5', kind: 'crawler', chart: 'ls248', chartMode: 'step', boom: 27.45, counterweight: 55.8, ucLimit: 100 },
    positions: [
      { label: 'Nhấc khỏi sà lan', radius: 18, capManual: 0 },
      { label: 'Đặt lên sơ mi rơ moóc', radius: 14, capManual: 0 },
    ],
    outrigger: offOutrigger,
    crawler: { ...offCrawler, enabled: true, mode: 'manual', pManual: 15.7 },
    stack: docStack(false),
  };
}

export const defaultLift = liftLtm1080;

export const LIFT_PRESETS: { key: string; label: string; build: () => LiftModel }[] = [
  { key: 'ltm1080', label: 'Ống loại 2 — xe cẩu LTM 1080/1, cần 27,9 m, R = 12 m + bãi xếp ống 5 tầng (theo bản vẽ)', build: liftLtm1080 },
  { key: 'att1354', label: 'Ống loại 2 — xe cẩu ATT 1354, cần 31,7 m, R = 14 m (theo bản vẽ)', build: liftAtt1354 },
  { key: 'ls248', label: 'Ống loại 2 — cẩu xích LS-248RH-5, cần 27,45 m, R = 18 → 14 m (theo bản vẽ)', build: liftLs248 },
];
