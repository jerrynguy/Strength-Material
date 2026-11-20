/**
 * Phân tích thanh thẳng:
 *  1. Phân tích cấu tạo hình học (động học) → tĩnh định / siêu tĩnh (bậc n) / biến hình.
 *  2. Giải phản lực bằng phương pháp ma trận độ cứng (phần tử hữu hạn dầm Euler–Bernoulli),
 *     áp dụng được cho cả hệ tĩnh định lẫn siêu tĩnh.
 *  3. Nội lực tại mọi mặt cắt bằng phương pháp mặt cắt (cân bằng phần bên trái) — chính xác.
 *  4. Chuyển vị (độ võng, góc xoay, dãn dài, góc xoắn).
 *
 * Bài toán thanh thẳng tách thành 4 hệ con độc lập:
 *  - Kéo/nén dọc trục (u)            — độ cứng EA
 *  - Uốn trong mặt phẳng đứng xy (v)  — độ cứng EI_z
 *  - Uốn trong mặt phẳng ngang xz (w) — độ cứng EI_y
 *  - Xoắn (φ)                         — độ cứng GJ
 */
import { luFactor, rank, smallestEigen, solve, zeros, type Matrix } from './linalg';
import { computeSection, validateSection, type SectionProps } from './section';
import {
  alphaTOf, effectiveRestraints, isSpring, selfWeightPerM, springOf, type DistributedLoad, type InternalForces, type Model, type Restraints,
} from './types';

export type SubKey = 'axial' | 'bendY' | 'bendZ' | 'torsion';

export const SUB_LABELS: Record<SubKey, string> = {
  axial: 'Kéo/nén dọc trục',
  bendY: 'Uốn trong mặt phẳng đứng (xy)',
  bendZ: 'Uốn trong mặt phẳng ngang (xz)',
  torsion: 'Xoắn',
};

export interface SubsystemInfo {
  key: SubKey;
  label: string;
  /** Có tải trọng tác dụng lên hệ con này không */
  loaded: boolean;
  /** Có được tính vào kết luận tĩnh định/siêu tĩnh không */
  considered: boolean;
  /** Số liên kết (thanh liên kết tựa + liên kết khớp nội) */
  constraints: number;
  /** Số bậc tự do khi coi các đoạn là cứng tuyệt đối */
  dof: number;
  rank: number;
  /** Bậc siêu tĩnh = số liên kết − số liên kết độc lập cần thiết */
  degree: number;
  /** Bất biến hình */
  stable: boolean;
  /** Hệ tự cân bằng (không có liên kết nhưng tải tự cân bằng) */
  selfEquilibrated: boolean;
}

export type Status = 'tinh-dinh' | 'sieu-tinh' | 'bien-hinh';

export interface Reaction {
  supportId: string;
  name: string;
  x: number;
  Fx: number;
  Fy: number;
  Fz: number;
  Mx: number;
  My: number;
  Mz: number;
}

/** Tác động tập trung (tải hoặc phản lực) dùng cho phương pháp mặt cắt, đơn vị kN, kN·m */
export interface PointAction {
  x: number;
  Fx: number;
  Fy: number;
  Fz: number;
  Mx: number;
  My: number;
  Mz: number;
  label: string;
  source: 'load' | 'reaction';
}

export interface DispSample {
  x: number;
  /** chuyển vị dọc trục (mm) */
  u: number;
  /** độ võng theo y (mm) */
  v: number;
  /** độ võng theo z (mm) */
  w: number;
  /** góc xoay dv/dx (rad) */
  thetaZ: number;
  /** góc xoay dw/dx (rad) */
  thetaY: number;
  /** góc xoắn (rad) */
  phi: number;
}

export type ForceSample = { x: number } & InternalForces;

export interface AnalysisResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  status: Status;
  degree: number;
  subsystems: SubsystemInfo[];
  section: SectionProps | null;
  /** Độ cứng (SI) */
  rigidity: { EA: number; EIz: number; EIy: number; GJ: number };
  reactions: Reaction[];
  actions: PointAction[];
  distributed: DistributedLoad[];
  keyPoints: number[];
  forceSamples: ForceSample[];
  dispSamples: DispSample[];
  internalAt(x: number, side: 'left' | 'right'): InternalForces;
  displacementAt(x: number): DispSample;
  /** Phần dư cân bằng toàn hệ (phải ≈ 0) */
  equilibriumResidual: InternalForces;
  secondOrder: boolean;
  buckling: { bendY?: BucklingPlane; bendZ?: BucklingPlane };
}

const KN = 1e3; // kN → N

function emptyResult(model: Model, errors: string[], section: SectionProps | null): AnalysisResult {
  return {
    ok: false, errors, warnings: [], status: 'bien-hinh', degree: 0, subsystems: [], section,
    rigidity: { EA: 0, EIz: 0, EIy: 0, GJ: 0 }, reactions: [], actions: [], distributed: [],
    keyPoints: [0, model.length], forceSamples: [], dispSamples: [],
    internalAt: () => ({ N: 0, Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0 }),
    displacementAt: (x) => ({ x, u: 0, v: 0, w: 0, thetaZ: 0, thetaY: 0, phi: 0 }),
    equilibriumResidual: { N: 0, Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0 },
    secondOrder: false,
    buckling: {},
  };
}

function uniqueSorted(xs: number[], tol: number): number[] {
  const s = [...xs].sort((a, b) => a - b);
  const out: number[] = [];
  for (const x of s) if (out.length === 0 || x - out[out.length - 1] > tol) out.push(x);
  return out;
}

function qAt(d: DistributedLoad, x: number): number {
  if (d.x2 === d.x1) return d.q1;
  return d.q1 + ((d.q2 - d.q1) * (x - d.x1)) / (d.x2 - d.x1);
}

// ───────────────────── Phân tích cấu tạo hình học ─────────────────────

interface SubSpec {
  key: SubKey;
  kind: 'bar' | 'beam';
  /** Liên kết tịnh tiến của gối ứng với hệ con */
  trans: keyof Restraints;
  /** Liên kết xoay (chỉ với dầm) */
  rot?: keyof Restraints;
}

const SUBS: SubSpec[] = [
  { key: 'axial', kind: 'bar', trans: 'ux' },
  { key: 'bendY', kind: 'beam', trans: 'uy', rot: 'rz' },
  { key: 'bendZ', kind: 'beam', trans: 'uz', rot: 'ry' },
  { key: 'torsion', kind: 'bar', trans: 'rx' },
];

function kinematic(model: Model, sub: SubSpec, hingeXs: number[], tol: number) {
  const nSeg = hingeXs.length + 1;
  const k = sub.kind === 'beam' ? 2 : 1;
  const ndof = nSeg * k;
  const starts = [0, ...hingeXs];
  const segOf = (x: number) => {
    let s = 0;
    for (const h of hingeXs) if (x > h + tol) s++;
    return s;
  };
  const rows: Matrix = [];
  for (const s of model.supports) {
    const r = effectiveRestraints(s);
    const seg = segOf(s.x);
    if (r[sub.trans]) {
      const row = new Array<number>(ndof).fill(0);
      if (sub.kind === 'beam') {
        row[2 * seg] = 1;
        row[2 * seg + 1] = s.x - starts[seg];
      } else row[seg] = 1;
      rows.push(row);
    }
    if (sub.rot && r[sub.rot]) {
      const row = new Array<number>(ndof).fill(0);
      row[2 * seg + 1] = 1;
      // Ngàm đặt ngay tại khớp: chặn xoay cả hai phía
      const atHinge = hingeXs.findIndex((h) => Math.abs(h - s.x) <= tol);
      if (atHinge >= 0) row[2 * (atHinge + 1) + 1] = 1;
      rows.push(row);
    }
  }
  hingeXs.forEach((h, i) => {
    const row = new Array<number>(ndof).fill(0);
    if (sub.kind === 'beam') {
      row[2 * i] = 1;
      row[2 * i + 1] = h - starts[i];
      row[2 * (i + 1)] = -1;
    } else {
      row[i] = 1;
      row[i + 1] = -1;
    }
    rows.push(row);
  });
  const rk = rank(rows, ndof);
  return { constraints: rows.length, dof: ndof, rank: rk, degree: rows.length - rk, stable: rk === ndof };
}

// ───────────────────── Phần tử hữu hạn ─────────────────────

interface SubLoads {
  /** lực/mô men tập trung tại nút (SI) */
  nodeF: number[];
  /** ngẫu lực tại nút (chỉ dầm), áp vào phía trái của khớp */
  nodeC: number[];
  /** cường độ phân bố tại hai đầu mỗi phần tử */
  elemQ: [number, number][];
  /** biến dạng ban đầu của phần tử do nhiệt độ: ε₀ (thanh) hoặc độ cong κ₀ (dầm, 1/m) */
  elemInit?: number[];
  /** chuyển vị cưỡng bức tại nút bị chặn (lún gối): tịnh tiến (m) và xoay (rad) */
  prescT?: Map<number, number>;
  prescR?: Map<number, number>;
  /** lò xo (gối đàn hồi) tại nút: tịnh tiến (N/m) và xoay (N·m/rad) */
  springT?: Map<number, number>;
  springR?: Map<number, number>;
}

interface SubSolution {
  /** giá trị chuyển vị tại nút (bar) hoặc độ võng (beam) */
  d: number[];
  /** góc xoay phía trái/phải nút (beam) */
  thL: number[];
  thR: number[];
  /** phản lực tại nút: [lực, mô men] */
  reac: [number, number][];
}

interface Assembled {
  K: Matrix;
  KG: Matrix | null;
  Fnode: number[];
  vIdx: number[];
  tL: number[];
  tR: number[];
  ndof: number;
  fixed: Set<number>;
  free: number[];
}

/** Ma trận độ cứng hình học phần tử dầm với lực dọc N (kéo dương) */
function geoMatrix(N: number, l: number): number[][] {
  const c = N / (30 * l);
  return [
    [36 * c, 3 * l * c, -36 * c, 3 * l * c],
    [3 * l * c, 4 * l * l * c, -3 * l * c, -l * l * c],
    [-36 * c, -3 * l * c, 36 * c, -3 * l * c],
    [3 * l * c, -l * l * c, -3 * l * c, 4 * l * l * c],
  ];
}

function solveSub(
  kind: 'bar' | 'beam', xs: number[], hingeNodes: Set<number>, EI: number,
  restrT: Set<number>, restrR: Set<number>, loads: SubLoads, Ne?: number[],
): SubSolution | null {
  const a = assembleSub(kind, xs, hingeNodes, EI, restrT, restrR, loads, Ne);
  const { K, KG, Fnode, vIdx, tL, tR, ndof, fixed, free } = a;
  if (KG) for (let i = 0; i < ndof; i++) for (let j = 0; j < ndof; j++) K[i][j] += KG[i][j];
  // chuyển vị cưỡng bức tại các bậc tự do bị chặn (lún gối)
  const u = new Array<number>(ndof).fill(0);
  for (const [i, v] of loads.prescT ?? []) if (fixed.has(a.vIdx[i])) u[a.vIdx[i]] = v;
  if (kind === 'beam') for (const [i, v] of loads.prescR ?? []) { if (fixed.has(tL[i])) u[tL[i]] = v; if (fixed.has(tR[i])) u[tR[i]] = v; }
  const Kff = free.map((r) => free.map((c) => K[r][c]));
  const rhs = free.map((d) => Fnode[d] - K[d].reduce((s, kij, j) => (fixed.has(j) ? s + kij * u[j] : s), 0));
  const sol = free.length ? solve(Kff, rhs) : [];
  if (!sol) return null;
  free.forEach((d, i) => (u[d] = sol[i]));
  const R = K.map((row, i) => row.reduce((s, kij, j) => s + kij * u[j], 0) - Fnode[i]);
  const reac: [number, number][] = xs.map((_, i) => {
    // phản lực của liên kết cứng; lò xo tính riêng theo chuyển vị (R = −k·u) — R ở đây trừ phần lò xo
    const kt = loads.springT?.get(i) ?? 0;
    const f = fixed.has(vIdx[i]) ? R[vIdx[i]] - kt * u[vIdx[i]] : 0;
    let m = 0;
    if (kind === 'beam') {
      const kr = loads.springR?.get(i) ?? 0;
      if (fixed.has(tL[i])) m += R[tL[i]] - kr * u[tL[i]];
      if (tR[i] !== tL[i] && fixed.has(tR[i])) m += R[tR[i]] - kr * u[tR[i]];
    }
    return [f, m];
  });
  return {
    d: vIdx.map((d) => u[d]),
    thL: kind === 'beam' ? tL.map((d) => u[d]) : [],
    thR: kind === 'beam' ? tR.map((d) => u[d]) : [],
    reac,
  };
}

/** Bài toán ổn định: K_E·x = α·(−K_G)·x → hệ số tới hạn α nhỏ nhất và dạng mất ổn định */
function bucklingSub(
  xs: number[], hingeNodes: Set<number>, EI: number, restrT: Set<number>, restrR: Set<number>, Ne: number[], springs?: Pick<SubLoads, 'springT' | 'springR'>,
): { alpha: number; mode: number[] } | null {
  if (!Ne.some((n) => n < 0)) return null;
  const empty: SubLoads = { nodeF: new Array(xs.length).fill(0), nodeC: new Array(xs.length).fill(0), elemQ: xs.slice(1).map(() => [0, 0] as [number, number]), ...springs };
  const a = assembleSub('beam', xs, hingeNodes, EI, restrT, restrR, empty, Ne);
  const { K, KG, free, vIdx } = a;
  if (!KG || !free.length) return null;
  const lu = luFactor(free.map((r) => free.map((c) => K[r][c])));
  if (!lu) return null;
  const G = free.map((r) => free.map((c) => -KG[r][c]));
  const applyG = (y: number[]) => G.map((row) => row.reduce((s, g, j) => s + g * y[j], 0));
  // vectơ khởi đầu: tổ hợp nhiều nửa sóng sin (cả đối xứng lẫn phản đối xứng) để không bỏ sót dạng mất ổn định thấp nhất
  // khi kết cấu đối xứng (gối/lò xo giữa nhịp: dạng thấp nhất là phản đối xứng)
  const start = free.map((d) => {
    const i = vIdx.indexOf(d);
    if (i < 0) return 0.01;
    const t = (xs[i] - xs[0]) / (xs[xs.length - 1] - xs[0]);
    return Math.sin(Math.PI * t) + 0.7 * Math.sin(2 * Math.PI * t) + 0.4 * Math.sin(3 * Math.PI * t) + 0.25 * Math.sin(4 * Math.PI * t) + 0.1;
  });
  const r = smallestEigen(lu, applyG, free.length, start);
  if (!r || !(r.lambda > 0)) return null;
  const u = new Array<number>(a.ndof).fill(0);
  free.forEach((d, i) => (u[d] = r.x[i]));
  const mode = vIdx.map((d) => u[d]);
  const m = Math.max(...mode.map(Math.abs)) || 1;
  return { alpha: r.lambda, mode: mode.map((v) => v / m) };
}

function assembleSub(
  kind: 'bar' | 'beam', xs: number[], hingeNodes: Set<number>, EI: number,
  restrT: Set<number>, restrR: Set<number>, loads: SubLoads, Ne?: number[],
): Assembled {
  const n = xs.length;
  const vIdx: number[] = [];
  const tL: number[] = [];
  const tR: number[] = [];
  let ndof = 0;
  for (let i = 0; i < n; i++) {
    vIdx.push(ndof++);
    if (kind === 'beam') {
      tL.push(ndof++);
      tR.push(hingeNodes.has(i) ? ndof++ : tL[i]);
    }
  }
  const K = zeros(ndof, ndof);
  const F = new Array<number>(ndof).fill(0);
  for (let e = 0; e < n - 1; e++) {
    const l = xs[e + 1] - xs[e];
    const [qa, qb] = loads.elemQ[e];
    if (kind === 'bar') {
      const k = EI / l;
      const ids = [vIdx[e], vIdx[e + 1]];
      const ke = [[k, -k], [-k, k]];
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) K[ids[a]][ids[b]] += ke[a][b];
      F[ids[0]] += (l * (2 * qa + qb)) / 6;
      F[ids[1]] += (l * (qa + 2 * qb)) / 6;
      const e0 = loads.elemInit?.[e] ?? 0;
      if (e0) { F[ids[0]] -= EI * e0; F[ids[1]] += EI * e0; }
    } else {
      const c = EI / l ** 3;
      const ids = [vIdx[e], tR[e], vIdx[e + 1], tL[e + 1]];
      const ke = [
        [12, 6 * l, -12, 6 * l],
        [6 * l, 4 * l * l, -6 * l, 2 * l * l],
        [-12, -6 * l, 12, -6 * l],
        [6 * l, 2 * l * l, -6 * l, 4 * l * l],
      ];
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) K[ids[a]][ids[b]] += c * ke[a][b];
      F[ids[0]] += (l * (7 * qa + 3 * qb)) / 20;
      F[ids[1]] += (l * l * (3 * qa + 2 * qb)) / 60;
      F[ids[2]] += (l * (3 * qa + 7 * qb)) / 20;
      F[ids[3]] -= (l * l * (2 * qa + 3 * qb)) / 60;
      const k0 = loads.elemInit?.[e] ?? 0;
      if (k0) { F[ids[1]] -= EI * k0; F[ids[3]] += EI * k0; }
    }
  }
  for (const [i, k] of loads.springT ?? []) K[vIdx[i]][vIdx[i]] += k;
  if (kind === 'beam') for (const [i, k] of loads.springR ?? []) { K[tL[i]][tL[i]] += k; if (tR[i] !== tL[i]) K[tR[i]][tR[i]] += k; }
  const Fnode = [...F];
  for (let i = 0; i < n; i++) {
    Fnode[vIdx[i]] += loads.nodeF[i];
    if (kind === 'beam') Fnode[tL[i]] += loads.nodeC[i];
  }
  const fixed = new Set<number>();
  for (const i of restrT) fixed.add(vIdx[i]);
  if (kind === 'beam') for (const i of restrR) { fixed.add(tL[i]); fixed.add(tR[i]); }
  const free = [...Array(ndof).keys()].filter((d) => !fixed.has(d));
  let KG: Matrix | null = null;
  if (kind === 'beam' && Ne && Ne.some((v) => v !== 0)) {
    KG = zeros(ndof, ndof);
    for (let e = 0; e < n - 1; e++) {
      if (!Ne[e]) continue;
      const g = geoMatrix(Ne[e], xs[e + 1] - xs[e]);
      const ids = [vIdx[e], tR[e], vIdx[e + 1], tL[e + 1]];
      for (let p = 0; p < 4; p++) for (let q = 0; q < 4; q++) KG[ids[p]][ids[q]] += g[p][q];
    }
  }
  return { K, KG, Fnode, vIdx, tL, tR, ndof, fixed, free };
}

// ───────────────────── Phương pháp mặt cắt ─────────────────────

/** ∫ q(s) ds và ∫ q(s)(x − s) ds trên [a, c] (Simpson — chính xác với đa thức bậc 2) */
function distIntegrals(d: DistributedLoad, x: number): [number, number] {
  const a = d.x1;
  if (a >= x) return [0, 0];
  const c = Math.min(d.x2, x);
  if (c <= a) return [0, 0];
  const m = (a + c) / 2;
  const h = c - a;
  const R = (h / 6) * (qAt(d, a) + 4 * qAt(d, m) + qAt(d, c));
  const Mo = (h / 6) * (qAt(d, a) * (x - a) + 4 * qAt(d, m) * (x - m) + qAt(d, c) * (x - c));
  return [R, Mo];
}

export function sectionForces(
  actions: PointAction[], dists: DistributedLoad[], x: number, side: 'left' | 'right', tol: number,
): InternalForces {
  let sFx = 0, sFy = 0, sFz = 0, sMx = 0, sMy = 0, sMz = 0;
  for (const a of actions) {
    const inc = a.x < x - tol || (side === 'right' && Math.abs(a.x - x) <= tol);
    if (!inc) continue;
    sFx += a.Fx;
    sFy += a.Fy;
    sFz += a.Fz;
    sMx += a.Mx;
    // Mz nội lực = Σ Fy·(x − xi) − Σ Mz_ngoài ; My = Σ Fz·(x − xi) + Σ My_ngoài
    sMz += a.Fy * (x - a.x) - a.Mz;
    sMy += a.Fz * (x - a.x) + a.My;
  }
  for (const d of dists) {
    const [R, Mo] = distIntegrals(d, x);
    if (d.dir === 'x') sFx += R;
    if (d.dir === 'y') { sFy += R; sMz += Mo; }
    if (d.dir === 'z') { sFz += R; sMy += Mo; }
  }
  return { N: -sFx, Qy: sFy, Qz: sFz, T: -sMx, Mz: sMz, My: sMy };
}

// ───────────────────── Phân tích chính ─────────────────────

export interface AnalyzeOptions {
  /** Phân tích bậc hai (P-Δ): kể ảnh hưởng của lực dọc lên uốn */
  secondOrder?: boolean;
  /** Tính hệ số tới hạn (bài toán ổn định) */
  buckling?: boolean;
  /** Nhân toàn bộ tải trọng với hệ số này */
  loadFactor?: number;
  /** Tính thêm lực tới hạn khi lực nén đều toàn chiều dài (cùng gối tựa) — để quy đổi N_tđ, μ */
  bucklingUniform?: boolean;
}

export interface BucklingPlane {
  /** Hệ số tới hạn: tải tới hạn = α × tải hiện tại */
  alpha: number;
  /** Dạng mất ổn định tại các nút lưới (chuẩn hoá max = 1) */
  mode: { x: number; v: number }[];
  /** Lực tới hạn khi nén đều toàn chiều dài với cùng gối tựa (kN) — chỉ khi bucklingUniform */
  NcrUniform?: number;
}

function scaleLoads(m: Model, f: number): Model {
  return {
    ...m,
    loads: m.loads.map((l) =>
      l.type === 'force' ? { ...l, Fx: l.Fx * f, Fy: l.Fy * f, Fz: l.Fz * f }
        : l.type === 'moment' ? { ...l, Mx: l.Mx * f, My: l.My * f, Mz: l.Mz * f }
          : l.type === 'temp' ? { ...l, Ttop: l.Ttop * f, Tbot: l.Tbot * f, ...(l.dTz ? { dTz: l.dTz * f } : {}) }
            : { ...l, q1: l.q1 * f, q2: l.q2 * f }),
    supports: m.supports.map((s) => (s.settle ? { ...s, settle: Object.fromEntries(Object.entries(s.settle).map(([k, v]) => [k, (v ?? 0) * f])) } : s)),
  };
}

/** Thêm tải trọng bản thân (nếu bật) thành một tải phân bố đều trên toàn thanh. */
export function withSelfWeight(m: Model): Model {
  if (!m.selfWeight || validateSection(m.section)) return m;
  const q = selfWeightPerM(m.material, computeSection(m.section).A);
  if (!(q > 0) || !(m.length > 0)) return m;
  const ld: DistributedLoad = { id: '__selfweight', type: 'distributed', name: 'g (bản thân)', x1: 0, x2: m.length, dir: m.selfWeight, q1: -q, q2: -q };
  return { ...m, loads: [...m.loads, ld] };
}

export function analyze(modelIn: Model, opts: AnalyzeOptions = {}): AnalysisResult {
  const withSW = withSelfWeight(modelIn);
  const model = opts.loadFactor !== undefined && opts.loadFactor !== 1 ? scaleLoads(withSW, opts.loadFactor) : withSW;
  const secondOrder = !!opts.secondOrder;
  const wantBuckling = secondOrder || !!opts.buckling;
  const L = model.length;
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!(L > 0)) return emptyResult(model, ['Chiều dài thanh phải dương'], null);
  const tol = 1e-9 * Math.max(1, L);

  const secErr = validateSection(model.section);
  if (secErr) return emptyResult(model, [`Tiết diện: ${secErr}`], null);
  const sec = computeSection(model.section);
  if (!(model.material.E > 0)) errors.push('Mô đun đàn hồi E phải dương');

  const inRange = (x: number) => Number.isFinite(x) && x >= -tol && x <= L + tol;
  for (const s of model.supports) if (!inRange(s.x)) errors.push(`Gối ${s.name}: vị trí x = ${s.x} nằm ngoài thanh`);
  for (const h of model.hinges) {
    if (!(h.x > tol && h.x < L - tol)) errors.push(`Khớp ${h.name}: phải nằm bên trong thanh (0 < x < L)`);
  }
  for (const ld of model.loads) {
    if (ld.type === 'distributed') {
      if (!(inRange(ld.x1) && inRange(ld.x2) && ld.x2 > ld.x1 + tol))
        errors.push(`Tải phân bố ${ld.name}: cần 0 ≤ x1 < x2 ≤ L`);
    } else if (ld.type === 'temp') {
      if (!(inRange(ld.x1) && inRange(ld.x2) && ld.x2 > ld.x1 + tol)) errors.push(`Nhiệt độ ${ld.name}: cần 0 ≤ x1 < x2 ≤ L`);
      if (!(Number.isFinite(ld.Ttop) && Number.isFinite(ld.Tbot))) errors.push(`Nhiệt độ ${ld.name}: giá trị không hợp lệ`);
    } else if (!inRange(ld.x)) errors.push(`Tải ${ld.name}: vị trí nằm ngoài thanh`);
  }
  if (errors.length) return emptyResult(model, errors, sec);

  const E = model.material.E * 1e9;
  const G = E / (2 * (1 + model.material.nu));
  const rigidity = {
    EA: E * sec.A * 1e-6,
    EIz: E * sec.Iz * 1e-12,
    EIy: E * sec.Iy * 1e-12,
    GJ: G * sec.torsion.J * 1e-12,
  };
  if (sec.Iyz !== 0) {
    warnings.push(
      'Mặt cắt không đối xứng (I_yz ≠ 0): chuyển vị được tính theo hai mặt phẳng độc lập (gần đúng); ứng suất pháp dùng công thức uốn không đối xứng tổng quát.',
    );
  }

  // Lưới nút
  const hingeXs = uniqueSorted(model.hinges.map((h) => h.x), tol);
  const keyPoints = uniqueSorted(
    [
      0, L,
      ...model.supports.map((s) => Math.min(Math.max(s.x, 0), L)),
      ...hingeXs,
      ...model.loads.flatMap((l) => (l.type === 'distributed' || l.type === 'temp' ? [l.x1, l.x2] : [l.x])),
    ].map((x) => Math.min(Math.max(x, 0), L)),
    tol,
  );
  const xs: number[] = [];
  const hTarget = L / 160;
  for (let i = 0; i + 1 < keyPoints.length; i++) {
    const a = keyPoints[i], b = keyPoints[i + 1];
    const m = Math.max(1, Math.ceil((b - a) / hTarget));
    for (let j = 0; j < m; j++) xs.push(a + ((b - a) * j) / m);
  }
  xs.push(L);
  const nodeAt = (x: number) => {
    let lo = 0, hi = xs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] < x - tol) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const hingeNodes = new Set(hingeXs.map(nodeAt));

  // Tải trọng cho từng hệ con (đơn vị SI)
  const mkLoads = (): SubLoads => ({
    nodeF: new Array(xs.length).fill(0),
    nodeC: new Array(xs.length).fill(0),
    elemQ: Array.from({ length: xs.length - 1 }, () => [0, 0] as [number, number]),
  });
  const subLoads: Record<SubKey, SubLoads> = { axial: mkLoads(), bendY: mkLoads(), bendZ: mkLoads(), torsion: mkLoads() };
  const loaded: Record<SubKey, boolean> = { axial: false, bendY: false, bendZ: false, torsion: false };
  const sumLoad: Record<SubKey, number> = { axial: 0, bendY: 0, bendZ: 0, torsion: 0 };
  const scaleLoad: Record<SubKey, number> = { axial: 0, bendY: 0, bendZ: 0, torsion: 0 };
  const addF = (k: SubKey, node: number, v: number) => {
    if (v === 0) return;
    subLoads[k].nodeF[node] += v * KN; loaded[k] = true; sumLoad[k] += v; scaleLoad[k] += Math.abs(v);
  };
  const addC = (k: SubKey, node: number, v: number) => {
    if (v === 0) return;
    subLoads[k].nodeC[node] += v * KN; loaded[k] = true; scaleLoad[k] += Math.abs(v);
  };
  const distributed: DistributedLoad[] = [];
  const at = alphaTOf(model.material);
  let thermalScale = 0;
  for (const ld of model.loads) {
    if (ld.type === 'force') {
      const n = nodeAt(ld.x);
      addF('axial', n, ld.Fx); addF('bendY', n, ld.Fy); addF('bendZ', n, ld.Fz);
    } else if (ld.type === 'moment') {
      const n = nodeAt(ld.x);
      addF('torsion', n, ld.Mx); addC('bendY', n, ld.Mz); addC('bendZ', n, -ld.My);
    } else if (ld.type === 'temp') {
      // ε₀ = α_t·T(trọng tâm), κ₀ = α_t(T_dưới − T_trên)/h (uốn trong mặt phẳng đứng)
      const h = (sec.yMax - sec.yMin) / 1e3;
      const Tc = ld.Tbot + ((ld.Ttop - ld.Tbot) * (-sec.yMin / 1e3)) / h;
      const eps0 = at * Tc, kap0 = (at * (ld.Tbot - ld.Ttop)) / h;
      // chênh nhiệt hai bên: ε₀(z) tăng theo z → độ cong trong mặt phẳng xz w″ = −α_t·ΔT_z/b
      const b = (sec.zMax - sec.zMin) / 1e3;
      const kapW = ld.dTz && b > 0 ? (-at * ld.dTz) / b : 0;
      for (let e = 0; e + 1 < xs.length; e++) {
        if (xs[e] >= ld.x1 - tol && xs[e + 1] <= ld.x2 + tol) {
          if (eps0) { (subLoads.axial.elemInit ??= new Array(xs.length - 1).fill(0))[e] += eps0; loaded.axial = true; }
          if (kap0) { (subLoads.bendY.elemInit ??= new Array(xs.length - 1).fill(0))[e] += kap0; loaded.bendY = true; }
          if (kapW) { (subLoads.bendZ.elemInit ??= new Array(xs.length - 1).fill(0))[e] += kapW; loaded.bendZ = true; }
        }
      }
      thermalScale = Math.max(thermalScale, (Math.abs(eps0) * rigidity.EA) / KN, (Math.abs(kap0) * rigidity.EIz) / KN, (Math.abs(kapW) * rigidity.EIy) / KN);
    } else {
      if (ld.q1 === 0 && ld.q2 === 0) continue;
      distributed.push(ld);
      const k: SubKey = ld.dir === 'x' ? 'axial' : ld.dir === 'y' ? 'bendY' : 'bendZ';
      loaded[k] = true;
      sumLoad[k] += ((ld.q1 + ld.q2) / 2) * (ld.x2 - ld.x1);
      scaleLoad[k] += ((Math.abs(ld.q1) + Math.abs(ld.q2)) / 2) * (ld.x2 - ld.x1);
      for (let e = 0; e + 1 < xs.length; e++) {
        if (xs[e] >= ld.x1 - tol && xs[e + 1] <= ld.x2 + tol) {
          subLoads[k].elemQ[e][0] += qAt(ld, xs[e]) * KN;
          subLoads[k].elemQ[e][1] += qAt(ld, xs[e + 1]) * KN;
        }
      }
    }
  }

  // Lún gối: chuyển vị cưỡng bức theo các phương gối chặn
  let settleScale = 0;
  for (const s of model.supports) {
    const st = s.settle;
    if (!st || isSpring(s)) continue;
    settleScale = Math.max(settleScale,
      (rigidity.EA * Math.abs(st.dx ?? 0)) / 1e3 / L / KN,
      (12 * Math.max(rigidity.EIz, rigidity.EIy) * Math.max(Math.abs(st.dy ?? 0), Math.abs(st.dz ?? 0))) / 1e3 / L ** 3 / KN,
      (4 * Math.max(rigidity.EIz, rigidity.EIy) * Math.max(Math.abs(st.rz ?? 0), Math.abs(st.ry ?? 0))) / 1e3 / L / KN);
    const r = effectiveRestraints(s);
    const n = nodeAt(s.x);
    const put = (k: SubKey, which: 'prescT' | 'prescR', on: boolean, v: number | undefined) => {
      if (!on || !v) return;
      (subLoads[k][which] ??= new Map()).set(n, v);
      loaded[k] = true;
    };
    put('axial', 'prescT', r.ux, st.dx !== undefined ? st.dx / 1e3 : undefined);
    put('bendY', 'prescT', r.uy, st.dy !== undefined ? st.dy / 1e3 : undefined);
    put('bendZ', 'prescT', r.uz, st.dz !== undefined ? st.dz / 1e3 : undefined);
    put('bendY', 'prescR', r.rz, st.rz !== undefined ? st.rz / 1e3 : undefined);
    // hệ con uốn z dùng góc θ = −r_y (mô men M_y được đưa vào với dấu trừ)
    put('bendZ', 'prescR', r.ry, st.ry !== undefined ? -st.ry / 1e3 : undefined);
  }

  // Phân tích cấu tạo hình học
  const subsystems: SubsystemInfo[] = [];
  const solutions: Partial<Record<SubKey, SubSolution>> = {};
  const rig: Record<SubKey, number> = { axial: rigidity.EA, bendY: rigidity.EIz, bendZ: rigidity.EIy, torsion: rigidity.GJ };
  let Ne: number[] = new Array(xs.length - 1).fill(0);
  const buckling: { bendY?: BucklingPlane; bendZ?: BucklingPlane } = {};
  for (const sub of SUBS) {
    const kin = kinematic(model, sub, hingeXs, tol);
    const isLoaded = loaded[sub.key];
    const info: SubsystemInfo = {
      key: sub.key, label: SUB_LABELS[sub.key], loaded: isLoaded, considered: false,
      ...kin, selfEquilibrated: false,
    };
    const planar = sub.key === 'axial' || sub.key === 'bendY';
    if (!kin.stable) {
      if (!isLoaded) {
        if (planar) {
          warnings.push(
            `${info.label}: hệ biến hình (thiếu liên kết${sub.key === 'axial' ? ' ngăn chuyển vị dọc trục' : ''}). ` +
              'Vì không có tải tác dụng theo phương này nên vẫn giải được phần còn lại; theo định nghĩa chặt chẽ, hệ phẳng này là biến hình.',
          );
        }
      } else if (
        sub.kind === 'bar' && kin.constraints - hingeXs.length === 0 &&
        Math.abs(sumLoad[sub.key]) <= 1e-9 * Math.max(1, scaleLoad[sub.key])
      ) {
        info.selfEquilibrated = true;
        info.considered = true;
        warnings.push(`${info.label}: không có liên kết nhưng tải tự cân bằng — chuyển vị tính tương đối so với đầu trái.`);
      } else {
        info.considered = true;
        errors.push(
          `${info.label}: hệ biến hình — không đủ liên kết hoặc liên kết bố trí không hợp lý (khớp/gối làm hệ thành cơ cấu). Hãy thêm hoặc đổi loại gối.`,
        );
      }
    } else {
      info.considered = planar || isLoaded;
    }
    subsystems.push(info);

    if ((kin.stable || info.selfEquilibrated) && errors.length === 0) {
      if (rig[sub.key] <= 0 || !Number.isFinite(rig[sub.key])) {
        if (isLoaded) errors.push(`${info.label}: không xác định được độ cứng (ví dụ J của đa giác tự do).`);
        continue;
      }
      const restrT = new Set<number>();
      const restrR = new Set<number>();
      for (const s of model.supports) {
        const n = nodeAt(s.x);
        if (isSpring(s)) {
          // gối đàn hồi: lò xo cộng vào độ cứng, không chặn cứng
          const k = springOf(s);
          const sl = subLoads[sub.key];
          if (k[sub.trans] > 0) (sl.springT ??= new Map()).set(n, (sl.springT.get(n) ?? 0) + k[sub.trans] * KN);
          if (sub.rot && k[sub.rot] > 0) (sl.springR ??= new Map()).set(n, (sl.springR.get(n) ?? 0) + k[sub.rot] * KN);
          continue;
        }
        const r = effectiveRestraints(s);
        if (r[sub.trans]) restrT.add(n);
        if (sub.rot && r[sub.rot]) restrR.add(n);
      }
      if (info.selfEquilibrated) restrT.add(0);
      const bend = sub.key === 'bendY' || sub.key === 'bendZ';
      if (bend && wantBuckling && Ne.some((v) => v < 0)) {
        const b = bucklingSub(xs, hingeNodes, rig[sub.key], restrT, restrR, Ne, subLoads[sub.key]);
        if (b) {
          const bp: BucklingPlane = { alpha: b.alpha, mode: xs.map((x, i) => ({ x, v: b.mode[i] })) };
          if (opts.bucklingUniform) {
            const u = bucklingSub(xs, hingeNodes, rig[sub.key], restrT, restrR, Ne.map(() => -1), subLoads[sub.key]);
            if (u) bp.NcrUniform = u.alpha / KN;
          }
          buckling[sub.key as 'bendY' | 'bendZ'] = bp;
        }
        if (secondOrder && b && b.alpha <= 1) {
          errors.push(`${info.label}: lực nén vượt lực tới hạn (α_th = ${b.alpha.toFixed(3)} ≤ 1) — thanh mất ổn định, không tồn tại trạng thái cân bằng uốn bậc hai.`);
          continue;
        }
      }
      const sol = solveSub(sub.kind, xs, hingeNodes, rig[sub.key], restrT, restrR, subLoads[sub.key], secondOrder && bend ? Ne : undefined);
      if (!sol) errors.push(`${info.label}: ma trận độ cứng suy biến — hệ biến hình.`);
      else {
        solutions[sub.key] = sol;
        if (sub.key === 'axial') Ne = Ne.map((_, e) => rig.axial * ((sol.d[e + 1] - sol.d[e]) / (xs[e + 1] - xs[e]) - (subLoads.axial.elemInit?.[e] ?? 0)));
      }
    }
  }

  const degree = subsystems.filter((s) => s.considered && s.stable).reduce((a, s) => a + s.degree, 0);
  if (errors.length) {
    const r = emptyResult(model, errors, sec);
    return { ...r, warnings, subsystems, keyPoints, buckling };
  }

  // Phản lực
  const reactions: Reaction[] = [];
  const usedNodes = new Set<number>();
  for (const s of model.supports) {
    const n = nodeAt(s.x);
    const r: Reaction = { supportId: s.id, name: s.name, x: s.x, Fx: 0, Fy: 0, Fz: 0, Mx: 0, My: 0, Mz: 0 };
    if (isSpring(s)) {
      // gối đàn hồi: R = −k·u (góc xoay: cộng hai phía nếu nút là khớp nối)
      const k = springOf(s);
      const d = (key: SubKey) => solutions[key]?.d[n] ?? 0;
      const th = (key: SubKey) => { const so = solutions[key]; if (!so) return 0; return hingeNodes.has(n) ? so.thL[n] + so.thR[n] : so.thL[n]; };
      r.Fx = -k.ux * d('axial');
      r.Fy = -k.uy * d('bendY');
      r.Fz = -k.uz * d('bendZ');
      r.Mx = -k.rx * d('torsion');
      r.Mz = -k.rz * th('bendY');
      r.My = k.ry * th('bendZ'); // hệ con uốn z dùng θ = −r_y
      reactions.push(r);
      continue;
    }
    if (!usedNodes.has(n)) {
      usedNodes.add(n);
      const get = (k: SubKey) => solutions[k]?.reac[n] ?? [0, 0];
      r.Fx = get('axial')[0] / KN;
      r.Mx = get('torsion')[0] / KN;
      r.Fy = get('bendY')[0] / KN;
      r.Mz = get('bendY')[1] / KN;
      r.Fz = get('bendZ')[0] / KN;
      r.My = -get('bendZ')[1] / KN;
      const clean = (v: number) => (Math.abs(v) < Math.max(1e-9, 1e-8 * Math.max(thermalScale, settleScale)) ? 0 : v);
      r.Fx = clean(r.Fx); r.Fy = clean(r.Fy); r.Fz = clean(r.Fz); r.Mx = clean(r.Mx); r.My = clean(r.My); r.Mz = clean(r.Mz);
    }
    reactions.push(r);
  }

  const actions: PointAction[] = [];
  for (const ld of model.loads) {
    if (ld.type === 'force') actions.push({ x: ld.x, Fx: ld.Fx, Fy: ld.Fy, Fz: ld.Fz, Mx: 0, My: 0, Mz: 0, label: ld.name, source: 'load' });
    if (ld.type === 'moment') actions.push({ x: ld.x, Fx: 0, Fy: 0, Fz: 0, Mx: ld.Mx, My: ld.My, Mz: ld.Mz, label: ld.name, source: 'load' });
  }
  for (const r of reactions) {
    if (r.Fx || r.Fy || r.Fz || r.Mx || r.My || r.Mz) {
      actions.push({ x: r.x, Fx: r.Fx, Fy: r.Fy, Fz: r.Fz, Mx: r.Mx, My: r.My, Mz: r.Mz, label: `Phản lực ${r.name}`, source: 'reaction' });
    }
  }

  // Chuyển vị
  const sAx = solutions.axial, sY = solutions.bendY, sZ = solutions.bendZ, sT = solutions.torsion;
  const displacementAt = (x: number): DispSample => {
    const xc = Math.min(Math.max(x, 0), L);
    let e = 0;
    while (e < xs.length - 2 && xc > xs[e + 1]) e++;
    const l = xs[e + 1] - xs[e];
    const t = (xc - xs[e]) / l;
    const lin = (s?: SubSolution) => (s ? s.d[e] * (1 - t) + s.d[e + 1] * t : 0);
    const herm = (s?: SubSolution): [number, number] => {
      if (!s) return [0, 0];
      const v1 = s.d[e], t1 = s.thR[e], v2 = s.d[e + 1], t2 = s.thL[e + 1];
      const N1 = 1 - 3 * t * t + 2 * t ** 3, N2 = l * (t - 2 * t * t + t ** 3), N3 = 3 * t * t - 2 * t ** 3, N4 = l * (-t * t + t ** 3);
      const d1 = (-6 * t + 6 * t * t) / l, d2 = 1 - 4 * t + 3 * t * t, d3 = (6 * t - 6 * t * t) / l, d4 = -2 * t + 3 * t * t;
      return [N1 * v1 + N2 * t1 + N3 * v2 + N4 * t2, d1 * v1 + d2 * t1 + d3 * v2 + d4 * t2];
    };
    const [v, thz] = herm(sY);
    const [w, thy] = herm(sZ);
    return { x: xc, u: lin(sAx) * 1e3, v: v * 1e3, w: w * 1e3, thetaZ: thz, thetaY: thy, phi: lin(sT) };
  };
  const dispSamples: DispSample[] = [];
  for (let i = 0; i < xs.length; i++) {
    const base = displacementAt(xs[i]);
    const pick = (s: SubSolution | undefined, side: 'L' | 'R') => (s ? (side === 'L' ? s.thL[i] : s.thR[i]) : 0);
    const d = (side: 'L' | 'R') => ({
      ...base,
      u: (sAx?.d[i] ?? 0) * 1e3, v: (sY?.d[i] ?? 0) * 1e3, w: (sZ?.d[i] ?? 0) * 1e3, phi: sT?.d[i] ?? 0,
      thetaZ: pick(sY, side), thetaY: pick(sZ, side),
    });
    if (hingeNodes.has(i)) dispSamples.push(d('L'), d('R'));
    else dispSamples.push(d(i === 0 ? 'R' : 'L'));
  }

  // Thang đo để làm sạch số rất nhỏ
  let fScale = Math.max(1e-12, thermalScale, settleScale);
  for (const a of actions) fScale = Math.max(fScale, Math.abs(a.Fx), Math.abs(a.Fy), Math.abs(a.Fz), Math.abs(a.Mx), Math.abs(a.My), Math.abs(a.Mz));
  for (const d of distributed) fScale = Math.max(fScale, Math.abs(d.q1) * L, Math.abs(d.q2) * L);
  const mScale = fScale * Math.max(1, L);
  const cleanF = (f: InternalForces): InternalForces => {
    const c = (v: number, s: number) => (Math.abs(v) < 1e-9 * s ? 0 : v);
    return { N: c(f.N, fScale), Qy: c(f.Qy, fScale), Qz: c(f.Qz, fScale), T: c(f.T, fScale), Mz: c(f.Mz, mScale), My: c(f.My, mScale) };
  };
  /** Mô men phụ do lực dọc trên chuyển vị (P-Δ), kN·m */
  const pDelta = (x: number, side: 'left' | 'right'): [number, number] => {
    if (!secondOrder) return [0, 0];
    const dv = (xx: number) => displacementAt(xx);
    const here = dv(x);
    let mz = 0, my = 0;
    for (const a of actions) {
      if (!a.Fx) continue;
      const inc = a.x < x - tol || (side === 'right' && Math.abs(a.x - x) <= tol);
      if (!inc) continue;
      const p = dv(a.x);
      mz += (a.Fx * (p.v - here.v)) / 1e3;
      my += (a.Fx * (p.w - here.w)) / 1e3;
    }
    for (const d of distributed) {
      if (d.dir !== 'x' || d.x1 >= x) continue;
      const c = Math.min(d.x2, x);
      const n = 16;
      const h = (c - d.x1) / n;
      for (let k = 0; k <= n; k++) {
        const sx = d.x1 + k * h;
        const wgt = (k === 0 || k === n ? 1 : k % 2 ? 4 : 2) * (h / 3);
        const p = dv(sx);
        mz += (wgt * qAt(d, sx) * (p.v - here.v)) / 1e3;
        my += (wgt * qAt(d, sx) * (p.w - here.w)) / 1e3;
      }
    }
    return [mz, my];
  };
  const internalAt = (x: number, side: 'left' | 'right') => {
    const f = sectionForces(actions, distributed, x, side, tol);
    if (secondOrder) {
      const [mz, my] = pDelta(x, side);
      f.Mz += mz;
      f.My += my;
    }
    return cleanF(f);
  };
  const equilibriumResidual = sectionForces(actions, distributed, L, 'right', tol);

  const forceSamples: ForceSample[] = [];
  for (let i = 0; i + 1 < keyPoints.length; i++) {
    const a = keyPoints[i], b = keyPoints[i + 1];
    const m = 48;
    for (let j = 0; j <= m; j++) {
      const x = a + ((b - a) * j) / m;
      const side = j === m ? 'left' : 'right';
      forceSamples.push({ x, ...internalAt(x, side) });
    }
  }

  const status: Status = degree === 0 ? 'tinh-dinh' : 'sieu-tinh';
  return {
    ok: true, errors, warnings, status, degree, subsystems, section: sec, rigidity, reactions, actions,
    distributed, keyPoints, forceSamples, dispSamples, internalAt, displacementAt, equilibriumResidual,
    secondOrder, buckling,
  };
}
