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
import { MOD_TYPES, analyzeModular, defaultModular, type ModularInput, type ModularResult } from './modular';

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
  /** hệ số an toàn chằng vắt qua nóc theo phương tiến (EN 12195-1: 1,25) */
  fsFwd: number;
  /** hệ số an toàn chằng vắt qua nóc theo phương lùi (EN 12195-1: 1,1) */
  fsRear: number;
  /** hệ số an toàn chằng vắt qua nóc theo phương ngang (EN 12195-1: 1,1) */
  fsTrans: number;
  /** hệ số chuyển đổi ma sát khi chằng trực tiếp (EN 12195-1: 0,75); chặn dùng μ */
  fmu: number;
}

/** EN 12195-1:2010, vận chuyển đường bộ */
export const EN12195_ROAD: Coefficients = { cxF: 0.8, cxR: 0.5, cy: 0.5, cyTip: 0.5, cz: 1.0, fsFwd: 1.25, fsRear: 1.1, fsTrans: 1.1, fmu: 0.75 };

/**
 * Hệ số đã lưu ở phiên bản cũ có một f_s chung cho phương dọc (fsLong, dùng cho cả tiến và lùi):
 * giữ giá trị đó cho phương tiến, phương lùi lấy theo EN 12195-1 (1,1).
 */
export function migrateCoef(saved: (Partial<Coefficients> & { fsLong?: number }) | undefined, d: Coefficients = EN12195_ROAD): Coefficients {
  if (!saved) return { ...d };
  const { fsLong, ...rest } = saved;
  return { ...d, ...(fsLong !== undefined && rest.fsFwd === undefined ? { fsFwd: fsLong } : {}), ...rest };
}

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
  /** cách nhập tự trọng xe: tách từng phần (mặc định) hay một con số tổng phân bổ theo tỉ lệ */
  tareMode?: TareMode;
  /** tự trọng cả tổ hợp (t) khi tareMode = 'total' */
  tareTotal?: number;
  /** tỉ lệ phân bổ tự trọng tổng về trục trước / cụm sau đầu kéo / cụm sơ mi rơ moóc (%) */
  tareShare?: { front: number; tractorRear: number; trailer: number };
}

export type TareMode = 'split' | 'total';

/** Tải khác trên xe (vật tư kê chèn, gỗ kê...): vào tải trục và áp lực nền, không vào kiểm tra chằng buộc hàng */
export interface OtherLoad {
  name: string;
  /** khối lượng (t) và vị trí tính từ mép trước sàn (m) */
  mass: number;
  x: number;
}

/** Tỉ lệ phân bổ chia đều theo số trục */
export function equalShare(v: Vehicle) {
  const nr = Math.max(1, Math.round(v.tractorRearAxles)), nt = v.axles.length, n = 1 + nr + nt;
  const r = (k: number) => Math.round((k / n) * 1000) / 10;
  return { front: r(1), tractorRear: r(nr), trailer: Math.round((100 - r(1) - r(nr)) * 10) / 10 };
}

export interface Limits {
  frontAxle: number;
  tractorGroup: number;
  trailerGroup: number;
  gross: number;
  height: number;
  width: number;
}

export type BrakeMode = 'accel' | 'time' | 'distance';

export interface Road {
  /** độ dốc dọc θ (°) */
  slope: number;
  /** độ dốc ngang β (°) — cộng thêm m·g·sinβ theo phương ngang khi vào cua */
  crossSlope: number;
  /** vận tốc chạy thẳng (m/s) — dùng để tính gia tốc phanh theo thời gian hoặc quãng đường */
  vStraight: number;
  /** vận tốc khi vào cua (m/s) và bán kính cua (m) */
  vCurve: number;
  radius: number;
  /** cách nhập phanh: gia tốc trực tiếp, thời gian phanh, hay quãng đường phanh */
  brakeMode: BrakeMode;
  /** gia tốc phanh (m/s²), thời gian phanh (s), quãng đường phanh (m) */
  brake: number;
  brakeTime: number;
  brakeDist: number;
  /** ma sát tính bằng f·Q·cosθ (true) hay f·Q như nhiều hồ sơ (false) */
  frictionCos: boolean;
}

export const BRAKE_MODES: { value: BrakeMode; label: string }[] = [
  { value: 'accel', label: 'Nhập gia tốc phanh a' },
  { value: 'time', label: 'Từ vận tốc và thời gian phanh: a = v/t' },
  { value: 'distance', label: 'Từ vận tốc và quãng đường phanh: a = v²/(2s)' },
];

/** Gia tốc phanh (m/s²) theo cách nhập */
export function brakeAccel(r: Road): number {
  if (r.brakeMode === 'time') return r.brakeTime > 0 ? r.vStraight / r.brakeTime : 0;
  if (r.brakeMode === 'distance') return r.brakeDist > 0 ? (r.vStraight * r.vStraight) / (2 * r.brakeDist) : 0;
  return r.brake;
}

/** Bổ sung trường còn thiếu cho dữ liệu đường đã lưu ở phiên bản cũ (vCurve trước đây tính bằng km/h) */
export function migrateRoad(saved: Partial<Road> | undefined, d: Road): Road {
  if (!saved) return d;
  const old = saved.vStraight === undefined && saved.brakeMode === undefined;
  return { ...d, ...saved, ...(old && typeof saved.vCurve === 'number' ? { vCurve: saved.vCurve / 3.6 } : {}) };
}

export interface Ground {
  /** chiều dày lớp phân bố dưới bánh (tấm thép, đá dăm, nền đường; m) và góc lan truyền so với phương đứng (°) */
  layerH: number;
  angle: number;
  /** áp lực cho phép của nền (t/m²) */
  allow: number;
  /** vệt lốp theo phương dọc (m) và bề rộng một cụm bánh (một bên xe, m) */
  tyreL: number;
  setW: number;
  /** vệt chịu tải dưới một cụm bánh nhập tay (dọc × ngang, m): 0 = tự tính vệt lốp + 2·h·tanθ */
  patchL: number;
  patchB: number;
}

export interface BargeItem {
  name: string;
  /** khối lượng (t) */
  mass: number;
}

export interface Barge {
  name: string;
  /** trọng tải (DWT, t) */
  dwt: number;
  /** tỉ lệ tải cho phép (%) */
  ucLimit: number;
  items: BargeItem[];
}

/** Khoảng cách giữa các trục trong cụm sau của đầu kéo (m) — giả định khi tính diện tích tiếp xúc */
export const TRACTOR_AXLE_SPACING = 1.3;

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
  /** tải khác trên xe (không phải hàng được chằng) */
  others?: OtherLoad[];
  /** loại xe: đầu kéo + sơ mi rơ moóc (mặc định) hay xe module thủy lực (SPMT / pull type) */
  vehicleKind?: VehicleKind;
  modular?: ModularInput;
  ground: Ground;
  barges: Barge[];
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

export interface RoadCheckRow {
  label: string;
  /** lực gây trượt và lực ma sát (kN) */
  force: number;
  friction: number;
  ok: boolean;
  formula: string;
}

export interface RoadResult {
  /** lực (kN) */
  slope: number;
  cross: number;
  centrifugal: number;
  braking: number;
  /** gia tốc phanh dùng tính (m/s²) */
  accel: number;
  /** ma sát theo phương dọc và ngang (kN) */
  frictionLong: number;
  frictionLat: number;
  /** hệ số gia tốc tương đương (g) */
  cxRoad: number;
  cyRoad: number;
  coveredX: boolean;
  coveredY: boolean;
  /** các kiểm tra trượt kiểu hồ sơ (chỉ ma sát, chưa kể dây chằng) */
  checks: RoadCheckRow[];
  steps: string[];
}

export interface GroundPatch {
  label: string;
  /** tải (t) và số trục */
  load: number;
  axles: number;
  /** vệt chịu tải dưới một cụm bánh (dọc × ngang, m) và tổng diện tích (m²) = số trục × 2 bên × L × B */
  L: number;
  B: number;
  area: number;
  /** áp lực (t/m²) */
  p: number;
  ok: boolean;
}

export interface GroundResult {
  /** cách tính trong hồ sơ: tổng tải / tổng diện tích các vệt */
  whole: GroundPatch;
  groups: GroundPatch[];
  /** cụm trục bất lợi nhất */
  worst: GroundPatch | null;
  ok: boolean;
  /** vệt hai trục kề nhau chồng lên nhau */
  overlap: boolean;
  steps: string[];
}

export interface BargeResult {
  name: string;
  total: number;
  dwt: number;
  uc: number;
  limit: number;
  ok: boolean;
  steps: string[];
}

export type VehicleKind = 'trailer' | 'modular';

export interface TransportResult {
  kind: VehicleKind;
  /** kết quả xe module thủy lực (khi kind = 'modular') */
  modular: ModularResult | null;
  ground: GroundResult;
  barges: BargeResult[];
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
  const fs = dir === 'fwd' ? coef.fsFwd : dir === 'rear' ? coef.fsRear : coef.fsTrans;
  const BC = Math.max(0, dir === 'fwd' ? blocking.fwd : dir === 'rear' ? blocking.rear : blocking.side);
  const nD = Math.max(0, long ? dl.nLong : dl.nTrans);
  const useDirect = nD > 0 && dl.lc > 0;
  const useTop = to.n > 0 && to.stf > 0;
  // EN 12195-1: f_μ chỉ áp dụng cho chằng trực tiếp; chặn và chằng vắt qua nóc dùng μ.
  // Khi kết hợp chằng trực tiếp với cách khác, ma sát nền lấy μ·f_μ cho mọi thành phần (lựa chọn thiên về an toàn, không phải nguyên văn EN).
  const muUsed = useDirect ? m.mu * coef.fmu : m.mu;
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
  const total = v.tareMode === 'total';
  // Mô men quanh chốt kéo (t·m)
  const items = [
    ...(total ? [] : [{ name: 'tự trọng sơ mi rơ moóc', m: v.trailerTare, x: v.trailerCgX }]),
    { name: cg.name || 'hàng', m: cg.mass, x: cg.cgX },
    ...(m.others ?? []).filter((o) => o.mass !== 0).map((o) => ({ name: o.name, m: o.mass, x: o.x })),
  ];
  const sumM = items.reduce((s, i) => s + i.m, 0);
  const mom = items.reduce((s, i) => s + i.m * (i.x - v.kingpinX), 0);
  const group0 = mom / arm;
  const kingpin = sumM - group0;
  steps.push(`Tâm cụm trục sơ mi rơ moóc: x_g = ${fmt(xg, 3)} m; cánh tay đòn tới chốt kéo a = ${fmt(xg, 3)} − ${fmt(v.kingpinX, 3)} = ${fmt(arm, 3)} m`);
  steps.push(`ΣM quanh chốt kéo (${items.map((i) => i.name).join(', ')}): R_g·a = ${items.map((i) => `${fmt(i.m, 3)}·(${fmt(i.x, 3)} − ${fmt(v.kingpinX, 3)})`).join(' + ')} = ${fmt(mom, 3)} t·m → R_g = ${fmt(group0, 3)} t`);
  steps.push(`ΣY: R_chốt = ${fmt(sumM, 3)} − ${fmt(group0, 3)} = ${fmt(kingpin, 3)} t`);
  const e = v.fifthWheelOffset, wb = v.wheelbase;
  const dFront = (kingpin * e) / wb;
  const nr = Math.max(1, Math.round(v.tractorRearAxles));
  let tf: number, tr: number, group: number;
  if (total) {
    const T = v.tareTotal ?? 0;
    const sh = v.tareShare ?? equalShare(v);
    const sum = sh.front + sh.tractorRear + sh.trailer || 1;
    const tF = (T * sh.front) / sum, tR = (T * sh.tractorRear) / sum, tT = (T * sh.trailer) / sum;
    steps.push(`Tự trọng tổ hợp ${fmt(T, 3)} t phân bổ ${fmt(sh.front, 1)} / ${fmt(sh.tractorRear, 1)} / ${fmt(sh.trailer, 1)} %: trục trước ${fmt(tF, 3)} t; cụm sau đầu kéo ${fmt(tR, 3)} t; cụm sơ mi rơ moóc ${fmt(tT, 3)} t`);
    tf = tF + dFront;
    tr = tR + kingpin - dFront;
    group = group0 + tT;
    steps.push(`Tải chốt chia về trục trước R_chốt·e/WB = ${fmt(kingpin, 3)}·${fmt(e, 3)}/${fmt(wb, 3)} = ${fmt(dFront, 3)} t → trục trước ${fmt(tf, 3)} t; cụm sau ${fmt(tr, 3)} t (${nr} trục); cụm sơ mi rơ moóc ${fmt(group0, 3)} + ${fmt(tT, 3)} = ${fmt(group, 3)} t`);
  } else {
    tf = v.tractorFront + dFront;
    tr = v.tractorRear + kingpin - dFront;
    group = group0;
    steps.push(`Đầu kéo: tải chốt chia về trục trước R_chốt·e/WB = ${fmt(kingpin, 3)}·${fmt(e, 3)}/${fmt(wb, 3)} = ${fmt(dFront, 3)} t → trục trước ${fmt(v.tractorFront, 3)} + ${fmt(dFront, 3)} = ${fmt(tf, 3)} t; cụm sau ${fmt(v.tractorRear, 3)} + ${fmt(kingpin - dFront, 3)} = ${fmt(tr, 3)} t (${nr} trục, ${fmt(tr / nr, 3)} t/trục)`);
  }
  steps.push(`Mỗi trục sơ mi rơ moóc (hệ treo cân bằng) = ${fmt(group / v.axles.length, 3)} t`);
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
  const th = rad(r.slope), be = rad(r.crossSlope);
  const v = r.vCurve;
  const accel = brakeAccel(r);
  const slope = W * Math.sin(th);
  const cross = W * Math.sin(be);
  const centrifugal = r.radius > 0 ? (m.cargo.mass * v * v) / r.radius : 0;
  const braking = m.cargo.mass * accel;
  const cxRoad = Math.sin(th) + accel / G;
  const cyRoad = (r.radius > 0 ? (v * v) / (G * r.radius) : 0) + Math.sin(be);
  const frictionLong = m.mu * W * (r.frictionCos ? Math.cos(th) : 1);
  const frictionLat = m.mu * W * (r.frictionCos ? Math.cos(be) : 1);
  const steps: string[] = [];
  const aTxt = r.brakeMode === 'time'
    ? `a = v/t = ${fmt(r.vStraight, 3)}/${fmt(r.brakeTime, 3)} = ${fmt(accel, 3)} m/s²`
    : r.brakeMode === 'distance'
      ? `a = v²/(2s) = ${fmt(r.vStraight, 3)}²/(2·${fmt(r.brakeDist, 3)}) = ${fmt(accel, 3)} m/s²`
      : `a = ${fmt(accel, 3)} m/s² (nhập trực tiếp)`;
  steps.push(`Gia tốc phanh: ${aTxt}`);
  steps.push(`Thành phần trọng lượng theo dốc dọc θ = ${fmt(r.slope, 2)}°: Q·sinθ = ${t(slope)}`);
  steps.push(`Thành phần trọng lượng theo dốc ngang β = ${fmt(r.crossSlope, 2)}°: Q·sinβ = ${t(cross)}`);
  steps.push(`Lực ly tâm khi vào cua R = ${fmt(r.radius, 2)} m, v = ${fmt(v, 3)} m/s: m·v²/R = ${t(centrifugal)}`);
  steps.push(`Lực quán tính khi phanh: m·a = ${fmt(m.cargo.mass, 3)}·${fmt(accel, 3)} = ${t(braking)}`);
  steps.push(r.frictionCos
    ? `Ma sát: phương dọc f·Q·cosθ = ${t(frictionLong)}; phương ngang f·Q·cosβ = ${t(frictionLat)}`
    : `Ma sát (như hồ sơ, không nhân cos): f·Q = ${fmt(m.mu, 3)}·${fmt(W, 2)} = ${t(frictionLong)}`);
  const row = (label: string, force: number, friction: number, formula: string): RoadCheckRow => {
    const ok = force <= friction * (1 + 1e-9);
    steps.push(`${label}: ${formula} = ${t(force)} ${ok ? '≤' : '>'} F_ms = ${t(friction)} → ${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`);
    return { label, force, friction, ok, formula };
  };
  const checks = [
    row('Dốc dọc (đứng trên dốc)', slope, frictionLong, 'Q·sinθ'),
    row('Phanh khi xuống dốc', slope + braking, frictionLong, 'Q·sinθ + m·a'),
    row('Vào cua trên dốc ngang', centrifugal + cross, frictionLat, 'm·v²/R + Q·sinβ'),
  ];
  steps.push(`Quy ra hệ số gia tốc: c_x = sinθ + a/g = ${fmt(cxRoad, 3)} g ${cxRoad <= m.coef.cxF ? '≤' : '>'} c_x EN = ${fmt(m.coef.cxF, 2)} g; c_y = v²/(g·R) + sinβ = ${fmt(cyRoad, 3)} g ${cyRoad <= m.coef.cy ? '≤' : '>'} c_y EN = ${fmt(m.coef.cy, 2)} g`);
  return {
    slope, cross, centrifugal, braking, accel, frictionLong, frictionLat, cxRoad, cyRoad,
    coveredX: cxRoad <= m.coef.cxF + 1e-9, coveredY: cyRoad <= m.coef.cy + 1e-9, checks, steps,
  };
}

/**
 * Áp lực xuống nền theo vệt dưới từng cụm bánh (mỗi trục 2 bên): vệt L × B = (vệt lốp + 2·h·tanθ) × (bề rộng cụm bánh + 2·h·tanθ),
 * hoặc nhập tay. Diện tích = số trục × 2 × L × B.
 *  - Cách trong hồ sơ: tổng tải / tổng diện tích mọi vệt (áp lực trung bình).
 *  - Từng cụm trục: tải cụm / diện tích các vệt của cụm — áp lực lớn nhất là giá trị nền thực sự phải chịu.
 */
export function groundPressure(m: TransportModel, axle: AxleResult = axleLoads(m)): GroundResult {
  const g = m.ground, v = m.vehicle;
  const sp = Math.max(0, g.layerH) * Math.tan(rad(g.angle));
  const steps: string[] = [];
  const L = g.patchL > 0 ? g.patchL : g.tyreL + 2 * sp;
  const B = g.patchB > 0 ? g.patchB : g.setW + 2 * sp;
  if (g.patchL > 0 && g.patchB > 0) steps.push(`Vệt chịu tải dưới một cụm bánh (nhập tay): L × B = ${fmt(L, 3)} × ${fmt(B, 3)} m`);
  else steps.push(`Vệt chịu tải dưới một cụm bánh: lan truyền qua lớp dày h = ${fmt(g.layerH, 3)} m theo góc θ = ${fmt(g.angle, 1)}° (mỗi phía h·tanθ = ${fmt(sp, 3)} m): L = ${g.patchL > 0 ? `${fmt(L, 3)} (nhập tay)` : `${fmt(g.tyreL, 3)} + 2·${fmt(sp, 3)} = ${fmt(L, 3)}`} m; B = ${g.patchB > 0 ? `${fmt(B, 3)} (nhập tay)` : `${fmt(g.setW, 3)} + 2·${fmt(sp, 3)} = ${fmt(B, 3)}`} m`);
  const patch = (label: string, load: number, n: number): GroundPatch => {
    const area = n * 2 * L * B;
    const p = area > 0 ? load / area : Infinity;
    const ok = g.allow <= 0 || p <= g.allow + 1e-9;
    steps.push(`${label}: A = ${n}·2·${fmt(L, 3)}·${fmt(B, 3)} = ${fmt(area, 3)} m²; p = ${fmt(load, 3)} / ${fmt(area, 3)} = ${fmt(p, 3)} t/m² (${fmt(p * G, 1)} kPa)${g.allow > 0 ? ` ${ok ? '≤' : '>'} [p] = ${fmt(g.allow, 2)} t/m²` : ''}`);
    return { label, load, axles: n, L, B, area, p, ok };
  };
  const nr = Math.max(1, Math.round(v.tractorRearAxles));
  const nt = v.axles.length;
  const valid = !(axle.error && axle.gross === 0);
  const whole = patch(`Toàn xe (cách trong hồ sơ: tổng tải / tổng diện tích ${1 + nr + nt} trục)`, axle.gross, 1 + nr + nt);
  const groups = valid ? [
    patch('Trục trước đầu kéo', axle.tractorFront, 1),
    patch(`Cụm ${nr} trục sau đầu kéo`, axle.tractorGroup, nr),
    patch(`Cụm ${nt} trục sơ mi rơ moóc`, axle.trailerGroup, nt),
  ] : [];
  const worst = groups.length ? groups.reduce((a, b) => (b.p > a.p ? b : a)) : null;
  // Chồng vệt giữa các trục kề nhau trong cụm
  const xs = [...v.axles.map((a) => a.x)].sort((a, b) => a - b);
  const minGap = Math.min(...xs.slice(1).map((x, i) => x - xs[i]), nr > 1 ? TRACTOR_AXLE_SPACING : Infinity);
  const overlap = minGap < L - 1e-9;
  if (overlap) steps.push(`Lưu ý: khoảng cách trục nhỏ nhất ${fmt(minGap, 3)} m < chiều dài vệt ${fmt(L, 3)} m — các vệt chồng lên nhau, diện tích thực nhỏ hơn và áp lực lớn hơn giá trị trên.`);
  return { whole, groups, worst, ok: whole.ok && groups.every((x) => x.ok), overlap, steps };
}

/** Tỉ lệ tải sà lan: UC = Σ khối lượng / DWT */
export function bargeCheck(b: Barge): BargeResult {
  const total = b.items.reduce((s, i) => s + (Number.isFinite(i.mass) ? i.mass : 0), 0);
  const uc = b.dwt > 0 ? total / b.dwt : Infinity;
  const limit = b.ucLimit > 0 ? b.ucLimit / 100 : 1;
  const ok = uc <= limit + 1e-9;
  const steps = [
    `Tổng tải: ${b.items.map((i) => `${fmt(i.mass, 3)}`).join(' + ') || '0'} = ${fmt(total, 3)} t`,
    `UC = ${fmt(total, 3)} / ${fmt(b.dwt, 3)} = ${fmt(uc * 100, 2)}% ${ok ? '≤' : '>'} ${fmt(limit * 100, 1)}% → ${ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}`,
  ];
  return { name: b.name, total, dwt: b.dwt, uc, limit, ok, steps };
}

/** Chiều cao trọng tâm hàng trên vùng ổn định (m): cao sàn + trọng tâm hàng − cao độ vùng ổn định. Bỏ qua xe module (trọng tâm thấp hơn) → thiên về an toàn. */
export function loadCogAboveStability(m: TransportModel): number {
  const mi = m.modular ?? defaultModular();
  return m.vehicle.deckH + m.cargo.cgH - MOD_TYPES[mi.type].stabilityElev;
}

/** Dữ liệu xe module lấy từ tab: hàng từ thẻ Hàng hoá, gối kê / dầm / mâm xoay từ thẻ Tải khác trên xe */
export function modularInputOf(m: TransportModel): ModularInput {
  const mi = m.modular ?? defaultModular();
  return {
    ...mi,
    load: m.cargo.mass,
    accessories: (m.others ?? []).reduce((s, o) => s + o.mass, 0),
    cog: (mi.cogMode ?? 'load') === 'load' ? loadCogAboveStability(m) : mi.cog,
  };
}

export function analyzeTransport(m: TransportModel): TransportResult {
  const dirs: Dir[] = ['fwd', 'rear', 'side'];
  const slide = dirs.map((d) => checkSliding(m, d));
  const tip = dirs.map((d) => checkTipping(m, d));
  const axle = axleLoads(m);
  const dim = dimensions(m);
  const road = roadCheck(m);
  const ground = groundPressure(m, axle);
  const barges = m.barges.map(bargeCheck);
  const kind: VehicleKind = m.vehicleKind ?? 'trailer';
  // Xe module: tải hàng lấy từ thẻ Hàng hoá, gối kê / dầm / mâm xoay lấy từ thẻ Tải khác trên xe
  const modular = kind === 'modular' ? analyzeModular(modularInputOf(m)) : null;
  const warnings: string[] = [];
  const to = m.topOver;
  if (to.n > 0 && to.lc > 0 && to.stf > 0.5 * to.lc) warnings.push(`STF = ${to.stf} daN lớn hơn 0,5·LC = ${fmt(0.5 * to.lc, 0)} daN: EN 12195-1 giới hạn lực căng dùng trong tính toán ≤ 0,5·LC.`);
  if (to.n > 0 && to.alpha < 30) warnings.push('Góc dây vắt qua nóc nhỏ (< 30°): hiệu quả ép xuống thấp, nên tăng góc.');
  if (slide.some((s) => s.frictionAlone)) warnings.push('Theo EN 12195-1, ma sát đủ giữ ở một phương không có nghĩa là bỏ chằng buộc: vẫn phải chằng tối thiểu vì rung động có thể làm hàng dịch chuyển.');
  if (m.cargo.footW > m.cargo.width + 1e-9 || m.cargo.footL > m.cargo.length + 1e-9) warnings.push('Chân đế lớn hơn kích thước bao của hàng — kiểm tra lại số liệu.');
  if (m.cargo.cgX < 0 || m.cargo.cgX > m.vehicle.deckL) warnings.push('Trọng tâm hàng nằm ngoài chiều dài sàn.');
  if (!road.coveredX || !road.coveredY) warnings.push('Điều kiện đường khai báo cho gia tốc lớn hơn hệ số EN 12195-1 — kiểm tra lại với hệ số lớn hơn.');
  if (axle.error) warnings.push(axle.error);
  if (ground.worst && ground.worst.p > ground.whole.p * 1.05) warnings.push(`Áp lực dưới ${ground.worst.label.toLowerCase()} (${fmt(ground.worst.p, 2)} t/m²) lớn hơn cách chia đều cho toàn xe (${fmt(ground.whole.p, 2)} t/m²): nền chịu áp lực theo từng cụm trục, nên dùng giá trị lớn nhất.`);
  if (ground.overlap) warnings.push('Vệt chịu tải của các trục kề nhau chồng lên nhau: áp lực nền thực tế lớn hơn giá trị tính.');
  if (barges.length) warnings.push('Tỉ lệ tải sà lan chỉ so khối lượng với trọng tải; chưa kiểm tra ổn định nổi, mớn nước và sức bền boong sà lan.');
  const vehicleOk = modular ? modular.ok : axle.ok && ground.ok;
  if (modular) warnings.push('Xe module: tính theo thẻ tham khảo (cách gần đúng, trọng tâm ở trọng tâm vùng ổn định, trục cách đều), chưa kể hệ số động.');
  const shown = modular ? warnings.filter((w) => !/cụm trục|Vệt chịu tải|chốt kéo|bập bênh|Sơ mi rơ moóc chưa có trục|Cụm trục phải|Chiều dài cơ sở/.test(w)) : warnings;
  const ok = slide.every((s) => s.ok) && tip.every((x) => x.ok) && vehicleOk && dim.ok && barges.every((b) => b.ok) && road.checks.every((c) => c.ok);
  return { kind, modular, ground, barges, slide, tip, axle, dim, road, warnings: shown, ok };
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
  road: { slope: 5, crossSlope: 5, vStraight: 8.3, vCurve: 1.38, radius: 7.87, brakeMode: 'accel', brake: 4.16, brakeTime: 2, brakeDist: 8.3, frictionCos: false },
  others: [],
  ground: { layerH: 0.5, angle: 45, allow: 10, tyreL: 0.3, setW: 0.6, patchL: 0, patchB: 0 },
  barges: [
    { name: 'Sà lan 158 DWT', dwt: 158, ucLimit: 100, items: [{ name: 'Ống thép', mass: 74.133 }, { name: 'Hạng mục phụ 1', mass: 0.5 }, { name: 'Hạng mục phụ 2', mass: 0.5 }] },
  ],
});

/**
 * Ống loại 2 theo bản vẽ áp lực nền: 3 ống 8 690 kg xếp 2 dưới 1 trên, xích vắt qua đỉnh xuống hai bên sàn (4 dây),
 * 6 trục cách nhau 1,3 m, vệt chịu tải 1,3 × 1,11 m mỗi cụm bánh; xe 16,49 t, vật tư kê chèn 0,24 t; cao toàn bộ 3,435 m.
 * Giả định tạm (đo gần đúng trên hình vẽ hoặc giá trị điển hình): đường kính ống ≈ 1,0 m; STF = 500 daN; góc dây 70°;
 * vị trí chốt kéo, các trục, chiều dài cơ sở; tự trọng phân bổ 32 / 34 / 34 % (trục trước / cụm sau đầu kéo / cụm sơ mi rơ moóc).
 */
export function pipeType2(): TransportModel {
  const D = 1.0;
  const saddle = 0.1;
  const cargoH = saddle + D * (1 + Math.sqrt(3) / 2);
  const vehicle: Vehicle = {
    ...defaultTransport().vehicle,
    deckL: 11.6, deckH: 3.435 - cargoH, width: 2.5,
    kingpinX: 0.65, fifthWheelOffset: 0.1, wheelbase: 4.3,
    axles: [{ x: 7.45 }, { x: 8.75 }, { x: 10.05 }],
    tractorRearAxles: 2,
    tareMode: 'total',
    tareTotal: 16.49,
    tareShare: { front: 32, tractorRear: 34, trailer: 34 },
  };
  return {
    ...defaultTransport(),
    title: 'Ống loại 2 — 3 × 8,69 t, chằng vắt nóc, áp lực nền',
    cargo: {
      name: 'Ống loại 2 (3 ống × 8,69 t)', mass: 26.1, length: 11.1, width: 2 * D, height: cargoH,
      footL: 11.1, footW: D, cgH: saddle + D / 2 + (D * Math.sqrt(3)) / 6, cgX: 5.9,
    },
    mu: 0.6,
    topOver: { n: 4, alpha: 70, stf: 500, lc: 4900 },
    direct: { nLong: 0, nTrans: 0, lc: 4900, alpha: 45, beta: 30 },
    blocking: { fwd: 0, rear: 0, side: 0 },
    vehicle,
    others: [{ name: 'Vật tư kê chèn an toàn', mass: 0.24, x: 5.9 }],
    ground: { layerH: 0.5, angle: 45, allow: 10, tyreL: 0.3, setW: 0.11, patchL: 1.3, patchB: 1.11 },
    barges: [],
  };
}

/**
 * Ví dụ trang 4 thẻ tham khảo xe module thủy lực: động cơ diesel 350 t trên SPMT 14 trục dòng (6 + 4 + 4), dốc 8%.
 * Kích thước, trọng tâm, ma sát và chằng buộc của hàng là giả định để minh hoạ — thẻ tham khảo không cho.
 */
export function spmtDieselEngine(): TransportModel {
  const d = defaultTransport();
  return {
    ...d,
    title: 'SPMT 14 trục dòng — động cơ diesel 350 t (ví dụ thẻ tham khảo)',
    cargo: { name: 'Động cơ diesel', mass: 350, length: 8, width: 4.5, height: 5, footL: 7, footW: 4, cgH: 2.2, cgX: 9.8 },
    mu: 0.45,
    topOver: { n: 0, alpha: 60, stf: 500, lc: 2500 },
    direct: { nLong: 2, nTrans: 2, lc: 20000, alpha: 40, beta: 30 },
    blocking: { fwd: 0, rear: 0, side: 0 },
    vehicle: { ...d.vehicle, deckL: 19.6, deckH: 1.5, width: 2.43 },
    limits: { ...d.limits, height: 0, width: 0 },
    others: [],
    vehicleKind: 'modular',
    modular: defaultModular('spmt'),
    barges: [],
  };
}

/** Ví dụ trang 7 thẻ tham khảo: bồn 400 t trên pull type module đôi 2 × 16 trục dòng, dốc 3%, treo 3 điểm, xe kéo 50 t */
export function pullTypeTank400(): TransportModel {
  const d = spmtDieselEngine();
  return {
    ...d,
    title: 'Pull type 2 × 16 trục dòng — bồn 400 t (ví dụ ổn định, thẻ tham khảo trang 7)',
    cargo: { name: 'Bồn', mass: 400, length: 22, width: 6, height: 6, footL: 20, footW: 3, cgH: 4, cgX: 12 },
    vehicle: { ...d.vehicle, deckL: 24, deckH: 1.2, width: 6 },
    modular: {
      ...defaultModular('pull'), units: [{ lines: 16, drive: 0 }], wide: 2, axleBase: 3.3, rolling: 3, grade: 3,
      trucks: 1, truckDriveWeight: 50, truckWeight: 50, suspension: '3', cogMode: 'manual', cog: 4.85, spineM: 560,
    },
  };
}

/** Ví dụ trang 8 thẻ tham khảo: máy biến áp 280 t, pull type đời cũ 12 trục dòng, 4 trục dòng thò ra ngoài hàng */
export function pullTypeTransformer280(): TransportModel {
  const d = spmtDieselEngine();
  return {
    ...d,
    title: 'Pull type 12 trục dòng — máy biến áp 280 t (ví dụ dầm sống, thẻ tham khảo trang 8)',
    cargo: { name: 'Máy biến áp', mass: 280, length: 12, width: 3.5, height: 4.5, footL: 11, footW: 3, cgH: 2.2, cgX: 9 },
    vehicle: { ...d.vehicle, deckL: 18, deckH: 1.2, width: 3 },
    modular: {
      ...defaultModular('pull'), units: [{ lines: 6, drive: 0 }, { lines: 6, drive: 0 }], wide: 1, axleBase: 1.8, rolling: 3, grade: 3,
      trucks: 1, truckDriveWeight: 50, truckWeight: 50, suspension: '3', cogMode: 'load', overhangFront: 4, overhangRear: 0, spineM: 560,
    },
  };
}

export const TRANSPORT_PRESETS: { key: string; label: string; build: () => TransportModel }[] = [
  { key: 'pipe', label: 'Ống thép 26,1 t — bảng lực tác dụng lên hàng (kích thước xe, trọng tâm giả định)', build: defaultTransport },
  { key: 'spmt', label: 'Xe module SPMT 14 trục dòng — động cơ 350 t, dốc 8% (ví dụ thẻ tham khảo)', build: spmtDieselEngine },
  { key: 'pull400', label: 'Xe module pull type 2 × 16 trục dòng — bồn 400 t, góc ổn định (ví dụ thẻ trang 7)', build: pullTypeTank400 },
  { key: 'pull280', label: 'Xe module pull type 12 trục dòng — máy biến áp 280 t, dầm sống (ví dụ thẻ trang 8)', build: pullTypeTransformer280 },
  { key: 'pipe2', label: 'Ống loại 2: 3 × 8,69 t, chằng vắt nóc 4 dây — áp lực nền theo bản vẽ (STF, đường kính ống tạm)', build: pipeType2 },
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
      barges: [],
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
      barges: [],
    }),
  },
];
