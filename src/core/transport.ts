/**
 * Kiểm tra vận chuyển hàng trên xe đầu kéo + sơ mi rơ moóc.
 *
 *  - Chằng buộc hàng theo EN 12195-1:2010 (vận chuyển đường bộ): trượt và lật theo phương tiến, lùi, ngang;
 *    chằng vắt qua nóc (top-over / frictional lashing), chằng trực tiếp (chéo, direct lashing), chặn (blocking).
 *  - Tải trọng trục: tĩnh học, cụm trục có hệ treo cân bằng tải (các trục trong cụm chịu như nhau).
 *  - Kích thước bao so với giới hạn.
 *  - Đối chiếu điều kiện đường (dốc, vào cua, phanh) theo cách tính tĩnh học thường gặp trong hồ sơ.
 *
 * Đơn vị: khối lượng t; chiều dài m; lực kN (hiển thị kèm tấn lực, 1 t = 9.81 kN); LC, STF của dây theo daN (nhãn EN 12195-2).
 */
import { fmt } from './stress';

export const G = 9.81;
const rad = (deg: number) => (deg * Math.PI) / 180;
/** kN → tấn lực */
export const toT = (kN: number) => kN / G;

export interface Coefficients {
  /** gia tốc theo phương tiến (phanh), đơn vị g */
  cxF: number;
  /** theo phương lùi */
  cxR: number;
  /** theo phương ngang (trượt) */
  cy: number;
  /** theo phương ngang dùng cho kiểm tra lật */
  cyTip: number;
  /** thành phần thẳng đứng hướng xuống */
  cz: number;
  /** hệ số an toàn chằng vắt qua nóc, phương dọc */
  fsLong: number;
  /** hệ số an toàn chằng vắt qua nóc, phương ngang */
  fsTrans: number;
  /** hệ số chuyển đổi ma sát khi chằng trực tiếp / chặn */
  fmu: number;
}

/** EN 12195-1:2010, vận chuyển đường bộ */
export const EN12195_ROAD: Coefficients = { cxF: 0.8, cxR: 0.5, cy: 0.5, cyTip: 0.5, cz: 1.0, fsLong: 1.25, fsTrans: 1.1, fmu: 0.75 };

/** Hệ số ma sát tham khảo (EN 12195-1 phụ lục B, mặt tiếp xúc khô, sạch) */
export const FRICTION_PRESETS: { label: string; mu: number }[] = [
  { label: 'Gỗ xẻ / gỗ dán – gỗ xẻ', mu: 0.45 },
  { label: 'Gỗ xẻ – nhôm có gân', mu: 0.4 },
  { label: 'Gỗ xẻ – thép tấm', mu: 0.3 },
  { label: 'Gỗ xẻ – màng co', mu: 0.3 },
  { label: 'Thép tấm – gỗ xẻ', mu: 0.3 },
  { label: 'Thép (thô) – gỗ xẻ', mu: 0.4 },
  { label: 'Thép – thép (thô)', mu: 0.2 },
  { label: 'Thùng thép – gỗ xẻ', mu: 0.35 },
  { label: 'Tấm chống trượt cao su', mu: 0.6 },
  { label: 'Bê tông – gỗ xẻ', mu: 0.5 },
];

export interface Cargo {
  name: string;
  /** khối lượng hàng (t) */
  mass: number;
  /** chiều dài, rộng, cao bao của hàng (m) */
  length: number;
  width: number;
  height: number;
  /** khoảng cách giữa các mép lật theo phương dọc / ngang (chân đế, m) — trọng tâm coi như ở giữa chân đế */
  footL: number;
  footW: number;
  /** chiều cao trọng tâm hàng tính từ sàn xe (m) */
  cgH: number;
  /** vị trí trọng tâm hàng theo phương dọc, tính từ mép trước sàn (m) */
  cgX: number;
}

export interface TopOver {
  /** số dây vắt qua nóc */
  n: number;
  /** góc dây với mặt sàn (°) */
  alpha: number;
  /** lực căng tiêu chuẩn STF (daN) */
  stf: number;
  /** khả năng chịu lực LC (daN) — dùng kiểm tra STF ≤ 0,5·LC */
  lc: number;
}

export interface Direct {
  /** số nhánh làm việc theo mỗi phương (chằng chéo 4 nhánh đối xứng: 2 nhánh/phương) */
  nLong: number;
  nTrans: number;
  /** khả năng chịu lực LC của mỗi nhánh (daN) */
  lc: number;
  /** góc nhánh với mặt sàn (°) */
  alpha: number;
  /** góc giữa hình chiếu bằng của nhánh với trục dọc xe (°) */
  beta: number;
}

export interface Blocking {
  /** khả năng chặn BC (kN) theo phương tiến, lùi, ngang */
  fwd: number;
  rear: number;
  side: number;
}

export interface Axle {
  /** vị trí trục tính từ mép trước sàn sơ mi rơ moóc (m) */
  x: number;
}

export interface Vehicle {
  /** chiều dài sàn (m), chiều cao mặt sàn so với mặt đường (m), bề rộng xe (m) */
  deckL: number;
  deckH: number;
  width: number;
  /** vị trí chốt kéo tính từ mép trước sàn (m) */
  kingpinX: number;
  /** các trục của sơ mi rơ moóc */
  axles: Axle[];
  /** tự trọng sơ mi rơ moóc (t) và vị trí trọng tâm tính từ mép trước sàn (m) */
  trailerTare: number;
  trailerCgX: number;
  /** đầu kéo: tải trục trước và cụm trục sau khi không kéo (t) */
  tractorFront: number;
  tractorRear: number;
  /** số trục cụm sau của đầu kéo */
  tractorRearAxles: number;
  /** chiều dài cơ sở: trục trước → tâm cụm trục sau (m) */
  wheelbase: number;
  /** mâm kéo nằm trước tâm cụm trục sau (m) */
  fifthWheelOffset: number;
}

export interface Limits {
  frontAxle: number;
  tractorGroup: number;
  trailerGroup: number;
  gross: number;
  height: number;
  width: number;
}

export interface Road {
  /** độ dốc dọc (°) */
  slope: number;
  /** vận tốc khi vào cua (km/h) và bán kính cua (m) */
  vCurve: number;
  radius: number;
  /** gia tốc phanh (m/s²) */
  brake: number;
}

export interface TransportModel {
  title: string;
  cargo: Cargo;
  mu: number;
  coef: Coefficients;
  topOver: TopOver;
  direct: Direct;
  blocking: Blocking;
  vehicle: Vehicle;
  limits: Limits;
  road: Road;
}

export type Dir = 'fwd' | 'rear' | 'side';
export const DIR_LABEL: Record<Dir, string> = { fwd: 'Tiến (phanh)', rear: 'Lùi', side: 'Ngang' };

export interface SlideResult {
  dir: Dir;
  c: number;
  /** lực quán tính c·m·g (kN) */
  demand: number;
  /** ma sát nền μ_tt·c_z·m·g (kN) */
  friction: number;
  muUsed: number;
  topOver: number;
  direct: number;
  block: number;
  capacity: number;
  /** tỉ số sử dụng = lực quán tính / khả năng giữ */
  uc: number;
  ok: boolean;
  /** chỉ riêng ma sát nền đã đủ giữ */
  frictionAlone: boolean;
  /** số dây vắt qua nóc cần nếu chỉ dùng biện pháp này (cùng ma sát) */
  nTopOverReq: number | null;
  /** LC cần cho mỗi nhánh chằng trực tiếp nếu chỉ dùng biện pháp này (daN) */
  lcDirectReq: number | null;
  steps: string[];
}

export interface TipResult {
  dir: Dir;
  c: number;
  /** cánh tay đòn chống lật b (m) và chiều cao trọng tâm d (m) */
  b: number;
  d: number;
  /** mô men gây lật / chống lật (kN·m) */
  mOver: number;
  mStab: number;
  stable: boolean;
  /** mô men chống lật thêm do dây vắt qua nóc (kN·m) — chỉ phương ngang */
  mLash: number;
  nTopOverReq: number | null;
  ok: boolean;
  steps: string[];
}

export interface AxleResult {
  kingpin: number;
  trailerGroup: number;
  perTrailerAxle: number;
  tractorFront: number;
  tractorGroup: number;
  perTractorAxle: number;
  gross: number;
  checks: { label: string; value: number; limit: number; ok: boolean }[];
  ok: boolean;
  steps: string[];
  error?: string;
}

export interface DimResult {
  height: number;
  width: number;
  checks: { label: string; value: number; limit: number; ok: boolean }[];
  ok: boolean;
}

export interface RoadResult {
  /** lực (kN) */
  slope: number;
  centrifugal: number;
  braking: number;
  /** hệ số gia tốc tương đương (g) */
  cxRoad: number;
  cyRoad: number;
  coveredX: boolean;
  coveredY: boolean;
  /** kiểm tra trượt kiểu tĩnh học: lực tổng / ma sát μ·m·g·cosθ */
  frictionRoad: number;
  steps: string[];
}

export interface TransportResult {
  slide: SlideResult[];
  tip: TipResult[];
  axle: AxleResult;
  dim: DimResult;
  road: RoadResult;
  warnings: string[];
  ok: boolean;
}

const t = (kN: number, d = 2) => `${fmt(kN, 2)} kN (${fmt(toT(kN), d)} t)`;

function coefOf(c: Coefficients, d: Dir) {
  return d === 'fwd' ? c.cxF : d === 'rear' ? c.cxR : c.cy;
}

export function checkSliding(m: TransportModel, dir: Dir): SlideResult {
  const { cargo, coef, topOver: to, direct: dl, blocking } = m;
  const W = cargo.mass * G;
  const c = coefOf(coef, dir);
  const long = dir !== 'side';
  const fs = long ? coef.fsLong : coef.fsTrans;
  const BC = Math.max(0, dir === 'fwd' ? blocking.fwd : dir === 'rear' ? blocking.rear : blocking.side);
  const nD = Math.max(0, long ? dl.nLong : dl.nTrans);
  const useDirect = nD > 0 && dl.lc > 0;
  const useTop = to.n > 0 && to.stf > 0;
  // Khi có chằng trực tiếp hoặc chặn, hàng được phép dịch chuyển nhỏ → dùng ma sát động μ·f_μ (cũng dùng cho dây vắt qua nóc khi kết hợp — thiên về an toàn)
  const muUsed = useDirect || BC > 0 ? m.mu * coef.fmu : m.mu;
  const steps: string[] = [];
  const demand = c * W;
  const friction = muUsed * coef.cz * W;
  steps.push(`Lực quán tính: F = c·m·g = ${fmt(c, 2)}·${fmt(cargo.mass, 3)}·${G} = ${t(demand)}`);
  steps.push(`Ma sát nền: μ${muUsed !== m.mu ? '·f_μ' : ''}·c_z·m·g = ${fmt(muUsed, 3)}·${fmt(coef.cz, 2)}·${fmt(cargo.mass, 3)}·${G} = ${t(friction)}`);
  const sa = Math.sin(rad(to.alpha));
  const FT = (to.stf * 10) / 1000; // daN → kN
  const topOverCap = useTop ? (2 * to.n * muUsed * sa * FT) / fs : 0;
  if (useTop) steps.push(`Dây vắt qua nóc: 2·n·μ·sinα·F_T / f_s = 2·${to.n}·${fmt(muUsed, 3)}·sin${fmt(to.alpha, 1)}°·${fmt(FT, 2)} / ${fmt(fs, 2)} = ${t(topOverCap)}`);
  const ca = Math.cos(rad(dl.alpha)), sb = Math.sin(rad(dl.beta)), cb = Math.cos(rad(dl.beta));
  const geo = (long ? ca * cb : ca * sb) + m.mu * coef.fmu * Math.sin(rad(dl.alpha));
  const LC = (dl.lc * 10) / 1000;
  const directCap = useDirect ? nD * LC * Math.max(0, geo) : 0;
  if (useDirect)
    steps.push(`Chằng trực tiếp: n·LC·(cosα·${long ? 'cosβ' : 'sinβ'} + μ·f_μ·sinα) = ${nD}·${fmt(LC, 2)}·(${fmt(ca, 3)}·${fmt(long ? cb : sb, 3)} + ${fmt(m.mu * coef.fmu, 3)}·${fmt(Math.sin(rad(dl.alpha)), 3)}) = ${t(directCap)}`);
  if (BC > 0) steps.push(`Chặn (blocking): BC = ${t(BC)}`);
  const capacity = friction + topOverCap + directCap + BC;
  const uc = capacity > 0 ? demand / capacity : Infinity;
  const ok = demand <= capacity * (1 + 1e-9);
  steps.push(`Khả năng giữ: ${t(capacity)}; tỉ số sử dụng F / khả năng = ${fmt(uc, 3)} → ${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`);
  const frictionAlone = m.mu * coef.cz >= c;
  // Số dây vắt qua nóc cần (chỉ dùng ma sát tĩnh μ, công thức EN 12195-1)
  let nTopOverReq: number | null = null;
  if (to.stf > 0 && sa > 0 && m.mu > 0) {
    const need = ((c - m.mu * coef.cz) * W * fs) / (2 * m.mu * sa * FT);
    nTopOverReq = Math.max(0, Math.ceil(need - 1e-9));
    steps.push(`Nếu chỉ chằng vắt qua nóc: n ≥ (c − μ·c_z)·m·g·f_s / (2·μ·sinα·F_T) = (${fmt(c, 2)} − ${fmt(m.mu, 3)}·${fmt(coef.cz, 2)})·${fmt(W, 2)}·${fmt(fs, 2)} / (2·${fmt(m.mu, 3)}·${fmt(sa, 3)}·${fmt(FT, 2)}) = ${fmt(need, 2)} → ${nTopOverReq} dây`);
  }
  let lcDirectReq: number | null = null;
  if (nD > 0 && geo > 0) {
    const need = ((c - m.mu * coef.fmu * coef.cz) * W) / (nD * geo);
    lcDirectReq = Math.max(0, (need * 1000) / 10);
    steps.push(`Nếu chỉ chằng trực tiếp (${nD} nhánh làm việc): LC ≥ (c − μ·f_μ·c_z)·m·g / (n·(cosα·${long ? 'cosβ' : 'sinβ'} + μ·f_μ·sinα)) = ${fmt(Math.max(0, need), 2)} kN = ${fmt(lcDirectReq, 0)} daN mỗi nhánh`);
  }
  return { dir, c, demand, friction, muUsed, topOver: topOverCap, direct: directCap, block: BC, capacity, uc, ok, frictionAlone, nTopOverReq, lcDirectReq, steps };
}

export function checkTipping(m: TransportModel, dir: Dir): TipResult {
  const { cargo, coef, topOver: to } = m;
  const W = cargo.mass * G;
  const c = dir === 'side' ? coef.cyTip : coefOf(coef, dir);
  const b = (dir === 'side' ? cargo.footW : cargo.footL) / 2;
  const d = cargo.cgH;
  const mOver = c * W * d;
  const mStab = coef.cz * W * b;
  const stable = mOver <= mStab * (1 + 1e-9);
  const steps: string[] = [];
  steps.push(`Mô men gây lật quanh mép chân đế: c·m·g·d = ${fmt(c, 2)}·${fmt(W, 2)}·${fmt(d, 3)} = ${fmt(mOver, 2)} kN·m`);
  steps.push(`Mô men chống lật: c_z·m·g·b = ${fmt(coef.cz, 2)}·${fmt(W, 2)}·${fmt(b, 3)} = ${fmt(mStab, 2)} kN·m (b = ${dir === 'side' ? 'bề rộng' : 'chiều dài'} chân đế / 2)`);
  steps.push(`Điều kiện tự ổn định: b/d = ${fmt(d > 0 ? b / d : Infinity, 3)} ${stable ? '≥' : '<'} c/c_z = ${fmt(c / coef.cz, 3)} → ${stable ? 'hàng không tự lật' : 'hàng có thể lật, cần chằng chống lật'}`);
  let mLash = 0;
  let nTopOverReq: number | null = null;
  const sa = Math.sin(rad(to.alpha));
  const FT = (to.stf * 10) / 1000;
  if (dir === 'side') {
    const fs = coef.fsTrans;
    const w = cargo.width;
    if (to.n > 0 && to.stf > 0) {
      mLash = (to.n * FT * w * sa) / fs;
      steps.push(`Dây vắt qua nóc chống lật ngang: n·F_T·w·sinα / f_s = ${to.n}·${fmt(FT, 2)}·${fmt(w, 3)}·${fmt(sa, 3)} / ${fmt(fs, 2)} = ${fmt(mLash, 2)} kN·m`);
    }
    if (!stable && FT > 0 && sa > 0 && w > 0) {
      const need = ((mOver - mStab) * fs) / (FT * w * sa);
      nTopOverReq = Math.ceil(need - 1e-9);
      steps.push(`Số dây vắt qua nóc cần: n ≥ (c_y·d − c_z·b)·m·g·f_s / (F_T·w·sinα) = ${fmt(need, 2)} → ${nTopOverReq} dây`);
    }
  } else if (!stable) {
    steps.push('Dây vắt qua nóc nằm ngang thân xe, không chống lật theo phương dọc — cần chặn hoặc chằng trực tiếp ở cao độ đủ lớn (kiểm tra riêng).');
  }
  const ok = mOver <= (mStab + mLash) * (1 + 1e-9);
  steps.push(`Kết luận: ${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'} (gây lật ${fmt(mOver, 2)} so với chống lật ${fmt(mStab + mLash, 2)} kN·m)`);
  return { dir, c, b, d, mOver, mStab, stable, mLash, nTopOverReq, ok, steps };
}

export function axleLoads(m: TransportModel): AxleResult {
  const v = m.vehicle, L = m.limits, cg = m.cargo;
  const steps: string[] = [];
  const empty = (error: string): AxleResult => ({ kingpin: 0, trailerGroup: 0, perTrailerAxle: 0, tractorFront: 0, tractorGroup: 0, perTractorAxle: 0, gross: 0, checks: [], ok: false, steps, error });
  if (!v.axles.length) return empty('Sơ mi rơ moóc chưa có trục.');
  const xg = v.axles.reduce((s, a) => s + a.x, 0) / v.axles.length;
  const arm = xg - v.kingpinX;
  if (arm <= 0) return empty('Cụm trục phải nằm sau chốt kéo.');
  if (v.wheelbase <= 0) return empty('Chiều dài cơ sở đầu kéo phải dương.');
  // Mô men quanh chốt kéo (t·m)
  const items = [
    { name: 'tự trọng sơ mi rơ moóc', m: v.trailerTare, x: v.trailerCgX },
    { name: cg.name || 'hàng', m: cg.mass, x: cg.cgX },
  ];
  const sumM = items.reduce((s, i) => s + i.m, 0);
  const mom = items.reduce((s, i) => s + i.m * (i.x - v.kingpinX), 0);
  const group = mom / arm;
  const kingpin = sumM - group;
  steps.push(`Tâm cụm trục sơ mi rơ moóc: x_g = ${fmt(xg, 3)} m; cánh tay đòn tới chốt kéo a = ${fmt(xg, 3)} − ${fmt(v.kingpinX, 3)} = ${fmt(arm, 3)} m`);
  steps.push(`ΣM quanh chốt kéo: R_g·a = ${items.map((i) => `${fmt(i.m, 3)}·(${fmt(i.x, 3)} − ${fmt(v.kingpinX, 3)})`).join(' + ')} = ${fmt(mom, 3)} t·m → R_g = ${fmt(group, 3)} t`);
  steps.push(`ΣY: R_chốt = ${fmt(sumM, 3)} − ${fmt(group, 3)} = ${fmt(kingpin, 3)} t; mỗi trục sơ mi rơ moóc (hệ treo cân bằng) = ${fmt(group / v.axles.length, 3)} t`);
  const e = v.fifthWheelOffset, wb = v.wheelbase;
  const dFront = (kingpin * e) / wb;
  const tf = v.tractorFront + dFront;
  const tr = v.tractorRear + kingpin - dFront;
  const nr = Math.max(1, Math.round(v.tractorRearAxles));
  steps.push(`Đầu kéo: tải chốt chia về trục trước R_chốt·e/WB = ${fmt(kingpin, 3)}·${fmt(e, 3)}/${fmt(wb, 3)} = ${fmt(dFront, 3)} t → trục trước ${fmt(v.tractorFront, 3)} + ${fmt(dFront, 3)} = ${fmt(tf, 3)} t; cụm sau ${fmt(v.tractorRear, 3)} + ${fmt(kingpin - dFront, 3)} = ${fmt(tr, 3)} t (${nr} trục, ${fmt(tr / nr, 3)} t/trục)`);
  const gross = tf + tr + group;
  steps.push(`Tổng trọng lượng tổ hợp: ${fmt(tf, 3)} + ${fmt(tr, 3)} + ${fmt(group, 3)} = ${fmt(gross, 3)} t`);
  const checks = [
    { label: 'Trục trước đầu kéo', value: tf, limit: L.frontAxle },
    { label: `Cụm ${nr} trục sau đầu kéo`, value: tr, limit: L.tractorGroup },
    { label: `Cụm ${v.axles.length} trục sơ mi rơ moóc`, value: group, limit: L.trailerGroup },
    { label: 'Tổng trọng lượng tổ hợp', value: gross, limit: L.gross },
  ].map((c) => ({ ...c, ok: c.limit <= 0 || c.value <= c.limit + 1e-9 }));
  const warn = [kingpin < 0 ? 'Tải chốt kéo âm: trọng tâm nằm sau cụm trục, xe bị bập bênh.' : ''].filter(Boolean);
  return {
    kingpin, trailerGroup: group, perTrailerAxle: group / v.axles.length, tractorFront: tf, tractorGroup: tr, perTractorAxle: tr / nr, gross,
    checks, ok: checks.every((c) => c.ok) && kingpin >= 0, steps, error: warn[0],
  };
}

export function dimensions(m: TransportModel): DimResult {
  const height = m.vehicle.deckH + m.cargo.height;
  const width = Math.max(m.vehicle.width, m.cargo.width);
  const checks = [
    { label: 'Chiều cao toàn bộ (sàn + hàng)', value: height, limit: m.limits.height },
    { label: 'Chiều rộng toàn bộ', value: width, limit: m.limits.width },
  ].map((c) => ({ ...c, ok: c.limit <= 0 || c.value <= c.limit + 1e-9 }));
  return { height, width, checks, ok: checks.every((c) => c.ok) };
}

export function roadCheck(m: TransportModel): RoadResult {
  const r = m.road, W = m.cargo.mass * G;
  const th = rad(r.slope);
  const v = r.vCurve / 3.6;
  const slope = W * Math.sin(th);
  const centrifugal = r.radius > 0 ? (m.cargo.mass * v * v) / r.radius : 0;
  const braking = m.cargo.mass * r.brake;
  const cxRoad = Math.sin(th) + r.brake / G;
  const cyRoad = r.radius > 0 ? (v * v) / (G * r.radius) : 0;
  const frictionRoad = m.mu * W * Math.cos(th);
  const steps = [
    `Thành phần trọng lượng theo dốc ${fmt(r.slope, 2)}°: m·g·sinθ = ${t(slope)}`,
    `Lực ly tâm khi vào cua R = ${fmt(r.radius, 2)} m, v = ${fmt(r.vCurve, 2)} km/h (${fmt(v, 3)} m/s): m·v²/R = ${t(centrifugal)}`,
    `Lực quán tính khi phanh a = ${fmt(r.brake, 3)} m/s²: m·a = ${t(braking)}`,
    `Ma sát trên dốc: μ·m·g·cosθ = ${t(frictionRoad)}`,
    `Phương dọc (phanh khi xuống dốc): ${t(slope + braking)} → tương đương c_x = sinθ + a/g = ${fmt(cxRoad, 3)} g ${cxRoad <= m.coef.cxF ? '≤' : '>'} c_x EN = ${fmt(m.coef.cxF, 2)} g`,
    `Phương ngang (vào cua): tương đương c_y = v²/(g·R) = ${fmt(cyRoad, 3)} g ${cyRoad <= m.coef.cy ? '≤' : '>'} c_y EN = ${fmt(m.coef.cy, 2)} g`,
  ];
  return { slope, centrifugal, braking, cxRoad, cyRoad, coveredX: cxRoad <= m.coef.cxF + 1e-9, coveredY: cyRoad <= m.coef.cy + 1e-9, frictionRoad, steps };
}

export function analyzeTransport(m: TransportModel): TransportResult {
  const dirs: Dir[] = ['fwd', 'rear', 'side'];
  const slide = dirs.map((d) => checkSliding(m, d));
  const tip = dirs.map((d) => checkTipping(m, d));
  const axle = axleLoads(m);
  const dim = dimensions(m);
  const road = roadCheck(m);
  const warnings: string[] = [];
  const to = m.topOver;
  if (to.n > 0 && to.lc > 0 && to.stf > 0.5 * to.lc) warnings.push(`STF = ${to.stf} daN lớn hơn 0,5·LC = ${fmt(0.5 * to.lc, 0)} daN: EN 12195-1 giới hạn lực căng dùng trong tính toán ≤ 0,5·LC.`);
  if (to.n > 0 && to.alpha < 30) warnings.push('Góc dây vắt qua nóc nhỏ (< 30°): hiệu quả ép xuống thấp, nên tăng góc.');
  if (slide.some((s) => s.frictionAlone)) warnings.push('Theo EN 12195-1, ma sát đủ giữ ở một phương không có nghĩa là bỏ chằng buộc: vẫn phải chằng tối thiểu vì rung động có thể làm hàng dịch chuyển.');
  if (m.cargo.footW > m.cargo.width + 1e-9 || m.cargo.footL > m.cargo.length + 1e-9) warnings.push('Chân đế lớn hơn kích thước bao của hàng — kiểm tra lại số liệu.');
  if (m.cargo.cgX < 0 || m.cargo.cgX > m.vehicle.deckL) warnings.push('Trọng tâm hàng nằm ngoài chiều dài sàn.');
  if (!road.coveredX || !road.coveredY) warnings.push('Điều kiện đường khai báo cho gia tốc lớn hơn hệ số EN 12195-1 — kiểm tra lại với hệ số lớn hơn.');
  if (axle.error) warnings.push(axle.error);
  const ok = slide.every((s) => s.ok) && tip.every((x) => x.ok) && axle.ok && dim.ok;
  return { slide, tip, axle, dim, road, warnings, ok };
}

export const defaultTransport = (): TransportModel => ({
  title: 'Ống thép trên sơ mi rơ moóc 3 trục',
  cargo: { name: 'Ống thép (3 ống)', mass: 26.1, length: 12, width: 2.48, height: 1.935, footL: 12, footW: 2.0, cgH: 0.65, cgX: 6.5 },
  mu: 0.6,
  coef: { ...EN12195_ROAD },
  topOver: { n: 0, alpha: 60, stf: 500, lc: 2500 },
  direct: { nLong: 2, nTrans: 2, lc: 4900, alpha: 45, beta: 30 },
  blocking: { fwd: 0, rear: 0, side: 0 },
  vehicle: {
    deckL: 12.5, deckH: 1.5, width: 2.5, kingpinX: 1.0, axles: [{ x: 8.9 }, { x: 10.21 }, { x: 11.52 }],
    trailerTare: 7, trailerCgX: 7, tractorFront: 5.5, tractorRear: 3.5, tractorRearAxles: 2, wheelbase: 3.9, fifthWheelOffset: 0.5,
  },
  limits: { frontAxle: 10, tractorGroup: 18, trailerGroup: 24, gross: 48, height: 4.2, width: 2.5 },
  road: { slope: 5, vCurve: 5, radius: 7.87, brake: 4.16 },
});

export const TRANSPORT_PRESETS: { key: string; label: string; build: () => TransportModel }[] = [
  { key: 'pipe', label: 'Ống thép 26,1 t, chằng chéo xích 5 t (theo bản vẽ; kích thước xe, trọng tâm giả định)', build: defaultTransport },
  {
    key: 'crate', label: 'Kiện gỗ 10 t trên sàn gỗ, chằng vắt qua nóc',
    build: () => ({
      ...defaultTransport(),
      title: 'Kiện gỗ 10 t, chằng vắt qua nóc',
      cargo: { name: 'Kiện gỗ', mass: 10, length: 4, width: 2.2, height: 2, footL: 4, footW: 2.2, cgH: 1, cgX: 4 },
      mu: 0.45,
      topOver: { n: 6, alpha: 70, stf: 500, lc: 2500 },
      direct: { nLong: 0, nTrans: 0, lc: 0, alpha: 45, beta: 30 },
      blocking: { fwd: 0, rear: 0, side: 0 },
    }),
  },
  {
    key: 'tall', label: 'Máy biến áp 20 t cao, chân đế hẹp (nguy cơ lật) + chặn phía trước',
    build: () => ({
      ...defaultTransport(),
      title: 'Máy biến áp 20 t',
      cargo: { name: 'Máy biến áp', mass: 20, length: 3, width: 2.2, height: 2.6, footL: 2.4, footW: 1.6, cgH: 1.4, cgX: 6 },
      mu: 0.3,
      topOver: { n: 4, alpha: 75, stf: 500, lc: 2500 },
      direct: { nLong: 2, nTrans: 2, lc: 5000, alpha: 40, beta: 35 },
      blocking: { fwd: 60, rear: 0, side: 0 },
    }),
  },
];
