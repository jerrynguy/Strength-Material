/**
 * Khung phẳng / dầm nghiêng.
 *
 * Hệ trục tổng thể: X nằm ngang (phải +), Y thẳng đứng (lên +). Mô men ↺ dương.
 * Mỗi thanh i → j có hệ trục địa phương: x' dọc thanh từ i đến j, y' quay +90° so với x'.
 * Quy ước nội lực trên thanh (nhìn từ đầu i về đầu j):
 *  - N > 0 kéo
 *  - Q > 0 khi hợp lực phía đầu i (của phần thanh) hướng theo +y'
 *  - M > 0 khi căng thớ phía −y' (với thanh nằm ngang trái → phải: căng thớ dưới)
 *
 * Thuật toán:
 *  1. Cấu tạo hình học: ma trận cân bằng B (ẩn = 3 nội lực đầu mỗi thanh + các phản lực;
 *     phương trình = cân bằng nút + điều kiện khớp). Bất biến hình ⇔ hạng B = số phương trình;
 *     bậc siêu tĩnh n = số ẩn − hạng B.
 *  2. Phương pháp ma trận độ cứng (phần tử khung phẳng, chia nhỏ mỗi thanh), liên kết gối
 *     nghiêng đưa vào bằng nhân tử Lagrange.
 *  3. Nội lực dọc thanh bằng phương pháp mặt cắt từ lực đầu thanh và tải trên thanh.
 */
import { sectionForces, type PointAction } from './analysis';
import { luFactor, rank, smallestEigen, solve, zeros, type Matrix } from './linalg';
import { computeSection, validateSection, type SectionProps } from './section';
import type { DistributedLoad, Material, SectionSpec } from './types';

export interface FNode {
  id: string;
  name: string;
  x: number;
  y: number;
}

export type FSupportKind = 'fixed' | 'pin' | 'roller' | 'custom';

export interface FSupport {
  id: string;
  nodeId: string;
  kind: FSupportKind;
  /** Góc nghiêng mặt tựa so với phương ngang (độ). Gối di động chặn chuyển vị vuông góc mặt tựa. */
  angle: number;
  /** Dùng khi kind = 'custom' — theo hệ trục của mặt tựa: t (dọc mặt tựa), n (vuông góc), xoay */
  restraints: { t: boolean; n: boolean; r: boolean };
}

export interface FMember {
  id: string;
  name: string;
  i: string;
  j: string;
  sectionId: string;
  /** Khớp (giải phóng mô men) ở đầu i / đầu j */
  releaseI: boolean;
  releaseJ: boolean;
  /** Khoảng cách sườn ngang riêng của thanh (mm); bỏ trống = dùng giá trị chung của khung; 0 = không có sườn ngang */
  stiffenerSpacing?: number;
  /** Giới hạn chảy riêng của thanh (MPa); bỏ trống = dùng f_y chung của khung */
  fy?: number;
}

/** Thông số ổn định cục bộ áp cho một thanh: f_y chung, khoảng cách sườn ngang riêng (nếu có). */
export function memberLocal(local: { fy: number; stiffenerSpacing: number }, m?: { stiffenerSpacing?: number; fy?: number } | null): { fy: number; stiffenerSpacing: number } {
  const has = (v: number | undefined | null) => v !== undefined && v !== null && Number.isFinite(v);
  return {
    fy: m && has(m.fy) && (m.fy as number) > 0 ? (m.fy as number) : local.fy,
    stiffenerSpacing: m && has(m.stiffenerSpacing) ? (m.stiffenerSpacing as number) : local.stiffenerSpacing,
  };
}

/** Tham số ổn định của vật liệu với giới hạn chảy σ_ch thay bằng f_y của thanh (nếu bảng có σ_ch). */
export function withYield<T extends { sigmaY: number }>(params: T, fy: number): T {
  return params.sigmaY > 0 ? { ...params, sigmaY: fy } : params;
}

export interface FSection {
  id: string;
  name: string;
  spec: SectionSpec;
}

export type FDistDir = 'gy' | 'gyp' | 'gx' | 'gxp' | 'ly' | 'lx';

export const DIST_DIR_LABELS: Record<FDistDir, string> = {
  gy: 'Đứng (Y), trên 1 m chiều dài thanh',
  gyp: 'Đứng (Y), trên 1 m hình chiếu ngang',
  gx: 'Ngang (X), trên 1 m chiều dài thanh',
  gxp: 'Ngang (X), trên 1 m hình chiếu đứng',
  ly: 'Vuông góc thanh (y′)',
  lx: 'Dọc trục thanh (x′)',
};

export type FLoad =
  | { id: string; type: 'node'; name: string; nodeId: string; Fx: number; Fy: number; M: number }
  | {
      id: string; type: 'mpoint'; name: string; memberId: string; a: number;
      /** true: Fx, Fy theo hệ trục địa phương (dọc, vuông góc thanh) */
      local: boolean; Fx: number; Fy: number; M: number;
    }
  | { id: string; type: 'mdist'; name: string; memberId: string; a: number; b: number; q1: number; q2: number; dir: FDistDir };

export interface FrameModel {
  title: string;
  material: Material;
  sections: FSection[];
  nodes: FNode[];
  members: FMember[];
  supports: FSupport[];
  loads: FLoad[];
}

export interface FrameDeterminacy {
  memberUnknowns: number;
  reactionUnknowns: number;
  nodeEquations: number;
  releaseEquations: number;
  unknowns: number;
  equations: number;
  rank: number;
  degree: number;
  stable: boolean;
}

export interface FrameReaction {
  supportId: string;
  nodeId: string;
  name: string;
  Rx: number;
  Ry: number;
  M: number;
  /** Thành phần theo hệ trục mặt tựa */
  Rt: number;
  Rn: number;
}

export interface MemberForces {
  N: number;
  Q: number;
  M: number;
}

export interface MemberResult {
  id: string;
  name: string;
  L: number;
  c: number;
  s: number;
  section: SectionProps;
  sectionSpec: SectionSpec;
  /** Lực đầu i và đầu j (tác dụng lên thanh, hệ địa phương) */
  endI: [number, number, number];
  endJ: [number, number, number];
  keyS: number[];
  samples: ({ s: number } & MemberForces)[];
  /** chuyển vị tổng thể các điểm chia (mm) */
  disp: { s: number; ux: number; uy: number }[];
  internalAt(s: number, side: 'left' | 'right'): MemberForces;
  /** Các tác động dùng cho lời giải từng bước */
  actions: PointAction[];
  dists: DistributedLoad[];
}

export interface FrameResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  status: 'tinh-dinh' | 'sieu-tinh' | 'bien-hinh';
  degree: number;
  det: FrameDeterminacy | null;
  reactions: FrameReaction[];
  members: MemberResult[];
  nodeDisp: { nodeId: string; name: string; ux: number; uy: number; rz: number | null }[];
  residual: { X: number; Y: number; M: number };
  secondOrder: boolean;
  /** Phân tích ổn định: α_th và dạng mất ổn định (chuẩn hoá) */
  buckling: { alpha: number; mode: { id: string; pts: { s: number; ux: number; uy: number }[] }[] } | null;
}

export interface FrameAnalyzeOptions {
  secondOrder?: boolean;
  buckling?: boolean;
  loadFactor?: number;
}

function scaleFrameLoads(m: FrameModel, f: number): FrameModel {
  return {
    ...m,
    loads: m.loads.map((l) => (l.type === 'mdist' ? { ...l, q1: l.q1 * f, q2: l.q2 * f } : { ...l, Fx: l.Fx * f, Fy: l.Fy * f, M: l.M * f })),
  };
}

const KN = 1e3;

function fail(errors: string[], det: FrameDeterminacy | null = null, warnings: string[] = []): FrameResult {
  return {
    ok: false, errors, warnings, status: 'bien-hinh', degree: 0, det, reactions: [], members: [], nodeDisp: [],
    residual: { X: 0, Y: 0, M: 0 }, secondOrder: false, buckling: null,
  };
}

/** Hướng các liên kết của gối (trong hệ tổng thể): [dx, dy, quay] */
export function supportDirections(s: FSupport): { d: [number, number, number]; label: 't' | 'n' | 'r' }[] {
  const a = (s.angle * Math.PI) / 180;
  const t: [number, number, number] = [Math.cos(a), Math.sin(a), 0];
  const n: [number, number, number] = [-Math.sin(a), Math.cos(a), 0];
  const r: [number, number, number] = [0, 0, 1];
  const R =
    s.kind === 'fixed' ? { t: true, n: true, r: true }
      : s.kind === 'pin' ? { t: true, n: true, r: false }
        : s.kind === 'roller' ? { t: false, n: true, r: false }
          : s.restraints;
  const out: { d: [number, number, number]; label: 't' | 'n' | 'r' }[] = [];
  if (R.t) out.push({ d: t, label: 't' });
  if (R.n) out.push({ d: n, label: 'n' });
  if (R.r) out.push({ d: r, label: 'r' });
  return out;
}

/** Quy tải trên thanh về hệ địa phương. */
function localDist(ld: Extract<FLoad, { type: 'mdist' }>, c: number, s: number): { qx: number; qy: number } {
  // trả về hệ số nhân với q
  switch (ld.dir) {
    case 'gy': return { qx: s, qy: c };
    case 'gyp': return { qx: s * Math.abs(c), qy: c * Math.abs(c) };
    case 'gx': return { qx: c, qy: -s };
    case 'gxp': return { qx: c * Math.abs(s), qy: -s * Math.abs(s) };
    case 'ly': return { qx: 0, qy: 1 };
    case 'lx': return { qx: 1, qy: 0 };
  }
}

function uniq(xs: number[], tol: number): number[] {
  const s = [...xs].sort((a, b) => a - b);
  const o: number[] = [];
  for (const x of s) if (!o.length || x - o[o.length - 1] > tol) o.push(x);
  return o;
}

export function analyzeFrame(modelIn: FrameModel, opts: FrameAnalyzeOptions = {}): FrameResult {
  const model = opts.loadFactor !== undefined && opts.loadFactor !== 1 ? scaleFrameLoads(modelIn, opts.loadFactor) : modelIn;
  const secondOrder = !!opts.secondOrder;
  const wantBuckling = secondOrder || !!opts.buckling;
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodeIdx = new Map(model.nodes.map((n, i) => [n.id, i]));
  const secMap = new Map<string, { props: SectionProps; spec: SectionSpec }>();
  for (const s of model.sections) {
    const e = validateSection(s.spec);
    if (e) errors.push(`Tiết diện ${s.name}: ${e}`);
    else secMap.set(s.id, { props: computeSection(s.spec), spec: s.spec });
  }
  if (!(model.material.E > 0)) errors.push('Mô đun đàn hồi E phải dương');
  if (model.members.length === 0) errors.push('Chưa có thanh nào');

  let span = 0;
  for (const a of model.nodes) for (const b of model.nodes) span = Math.max(span, Math.hypot(a.x - b.x, a.y - b.y));
  const tol = 1e-9 * Math.max(1, span);

  interface Geo { m: FMember; i: number; j: number; L: number; c: number; s: number; sec: { props: SectionProps; spec: SectionSpec } }
  const geos: Geo[] = [];
  for (const m of model.members) {
    const i = nodeIdx.get(m.i), j = nodeIdx.get(m.j);
    if (i === undefined || j === undefined) { errors.push(`Thanh ${m.name}: nút không tồn tại`); continue; }
    const ni = model.nodes[i], nj = model.nodes[j];
    const L = Math.hypot(nj.x - ni.x, nj.y - ni.y);
    if (!(L > tol)) { errors.push(`Thanh ${m.name}: chiều dài bằng 0`); continue; }
    const sec = secMap.get(m.sectionId);
    if (!sec) { errors.push(`Thanh ${m.name}: chưa chọn tiết diện hợp lệ`); continue; }
    geos.push({ m, i, j, L, c: (nj.x - ni.x) / L, s: (nj.y - ni.y) / L, sec });
  }
  const geoById = new Map(geos.map((g) => [g.m.id, g]));
  for (const ld of model.loads) {
    if (ld.type === 'node') {
      if (!nodeIdx.has(ld.nodeId)) errors.push(`Tải ${ld.name}: nút không tồn tại`);
    } else {
      const g = geoById.get(ld.memberId);
      if (!g) { errors.push(`Tải ${ld.name}: thanh không tồn tại`); continue; }
      if (ld.type === 'mpoint' && !(ld.a >= -tol && ld.a <= g.L + tol)) errors.push(`Tải ${ld.name}: vị trí a phải nằm trong [0; ${g.L.toFixed(3)}] m`);
      if (ld.type === 'mdist' && !(ld.a >= -tol && ld.b <= g.L + tol && ld.b > ld.a + tol))
        errors.push(`Tải ${ld.name}: cần 0 ≤ a < b ≤ L = ${g.L.toFixed(3)} m`);
    }
  }
  for (const s of model.supports) if (!nodeIdx.has(s.nodeId)) errors.push('Gối đặt tại nút không tồn tại');
  for (const n of model.nodes) {
    const used = geos.some((g) => g.i === nodeIdx.get(n.id) || g.j === nodeIdx.get(n.id));
    if (!used) errors.push(`Nút ${n.name} không nối với thanh nào`);
  }
  if (errors.length) return fail(errors);

  // Nút có "bậc tự do xoay" khi có ít nhất một đầu thanh nối cứng hoặc có liên kết chặn xoay
  const nN = model.nodes.length;
  const rigidConn = new Array(nN).fill(0);
  for (const g of geos) {
    if (!g.m.releaseI) rigidConn[g.i]++;
    if (!g.m.releaseJ) rigidConn[g.j]++;
  }
  const supByNode = new Map<number, FSupport[]>();
  for (const s of model.supports) {
    const k = nodeIdx.get(s.nodeId)!;
    supByNode.set(k, [...(supByNode.get(k) ?? []), s]);
  }
  const rotSup = (k: number) => (supByNode.get(k) ?? []).some((s) => supportDirections(s).some((d) => d.label === 'r'));
  const hasRot = (k: number) => rigidConn[k] > 0 || rotSup(k);
  for (const ld of model.loads) {
    if (ld.type === 'node' && ld.M !== 0 && !hasRot(nodeIdx.get(ld.nodeId)!)) {
      errors.push(`Mô men ${ld.name} đặt tại nút khớp (mọi thanh đều nối khớp) — hãy đặt mô men lên một thanh (tải trên thanh, a = 0).`);
    }
  }
  if (errors.length) return fail(errors);

  // ───────── 1. Cấu tạo hình học: ma trận cân bằng ─────────
  const rowsOfNode: number[][] = [];
  let nEq = 0;
  for (let k = 0; k < nN; k++) {
    const r = [nEq++, nEq++];
    if (hasRot(k)) r.push(nEq++);
    rowsOfNode.push(r);
  }
  const nodeEquations = nEq;
  const releaseRows: { g: Geo; mi: number; end: 'I' | 'J' }[] = [];
  geos.forEach((g, mi) => {
    if (g.m.releaseI) releaseRows.push({ g, mi, end: 'I' });
    if (g.m.releaseJ) releaseRows.push({ g, mi, end: 'J' });
  });
  const supCols: { sup: FSupport; k: number; d: [number, number, number]; label: string }[] = [];
  for (const s of model.supports) {
    const k = nodeIdx.get(s.nodeId)!;
    for (const d of supportDirections(s)) {
      if (d.label === 'r' && !hasRot(k)) continue;
      supCols.push({ sup: s, k, d: d.d, label: d.label });
    }
  }
  const nUnk = 3 * geos.length + supCols.length;
  const nRows = nEq + releaseRows.length;
  const B: Matrix = zeros(nRows, nUnk);
  geos.forEach((g, mi) => {
    const { c, s, L } = g;
    const col = 3 * mi;
    // Đầu i: tác dụng của nút lên thanh = (Fx1, Fy1, M1) địa phương → thanh tác dụng lên nút = −(...)
    const ri = rowsOfNode[g.i];
    B[ri[0]][col] += -c; B[ri[0]][col + 1] += s;
    B[ri[1]][col] += -s; B[ri[1]][col + 1] += -c;
    if (ri[2] !== undefined && !g.m.releaseI) B[ri[2]][col + 2] += -1;
    // Đầu j: lực lên thanh = (−Fx1, −Fy1, M2 = −M1 + Fy1·L)
    const rj = rowsOfNode[g.j];
    B[rj[0]][col] += c; B[rj[0]][col + 1] += -s;
    B[rj[1]][col] += s; B[rj[1]][col + 1] += c;
    if (rj[2] !== undefined && !g.m.releaseJ) { B[rj[2]][col + 2] += 1; B[rj[2]][col + 1] += -L; }
  });
  releaseRows.forEach((r, q) => {
    const row = nEq + q;
    const col = 3 * r.mi;
    if (r.end === 'I') B[row][col + 2] = 1;
    else { B[row][col + 2] = -1; B[row][col + 1] = r.g.L; }
  });
  supCols.forEach((sc, q) => {
    const col = 3 * geos.length + q;
    const r = rowsOfNode[sc.k];
    B[r[0]][col] += sc.d[0];
    B[r[1]][col] += sc.d[1];
    if (sc.d[2] && r[2] !== undefined) B[r[2]][col] += sc.d[2];
  });
  const rk = rank(B, nUnk);
  const det: FrameDeterminacy = {
    memberUnknowns: 3 * geos.length,
    reactionUnknowns: supCols.length,
    nodeEquations,
    releaseEquations: releaseRows.length,
    unknowns: nUnk,
    equations: nRows,
    rank: rk,
    degree: nUnk - rk,
    stable: rk === nRows,
  };
  if (!det.stable) {
    return fail(
      [
        nUnk < nRows
          ? `Hệ biến hình: thiếu ${nRows - nUnk} liên kết (số ẩn ${nUnk} < số phương trình ${nRows}).`
          : 'Hệ biến hình (hoặc biến hình tức thời): liên kết bố trí không hợp lý — ví dụ ba khớp thẳng hàng, các gối di động song song, khung thành cơ cấu.',
      ],
      det,
    );
  }

  // ───────── 2. Phương pháp ma trận độ cứng ─────────
  const E = model.material.E * 1e9;
  let nd = 0;
  const nodeDof: [number, number, number | null][] = [];
  for (let k = 0; k < nN; k++) nodeDof.push([nd++, nd++, hasRot(k) ? nd++ : null]);

  interface SubMesh { g: Geo; ts: number[]; dofs: [number, number, number][]; }
  const meshes: SubMesh[] = [];
  const pointLoadsOf = (g: Geo) => model.loads.filter((l): l is Extract<FLoad, { type: 'mpoint' }> => l.type === 'mpoint' && l.memberId === g.m.id);
  const distLoadsOf = (g: Geo) => model.loads.filter((l): l is Extract<FLoad, { type: 'mdist' }> => l.type === 'mdist' && l.memberId === g.m.id);
  for (const g of geos) {
    const key = uniq([0, g.L, ...pointLoadsOf(g).map((l) => Math.min(Math.max(l.a, 0), g.L)), ...distLoadsOf(g).flatMap((l) => [l.a, l.b])], tol * 10);
    const ts: number[] = [];
    const h = g.L / 12;
    for (let q = 0; q + 1 < key.length; q++) {
      const n = Math.max(1, Math.ceil((key[q + 1] - key[q]) / h));
      for (let r = 0; r < n; r++) ts.push(key[q] + ((key[q + 1] - key[q]) * r) / n);
    }
    ts.push(g.L);
    const dofs: [number, number, number][] = ts.map((_, q) => {
      if (q === 0) return [nodeDof[g.i][0], nodeDof[g.i][1], g.m.releaseI ? nd++ : (nodeDof[g.i][2] as number)];
      if (q === ts.length - 1) return [nodeDof[g.j][0], nodeDof[g.j][1], g.m.releaseJ ? nd++ : (nodeDof[g.j][2] as number)];
      return [nd++, nd++, nd++];
    });
    meshes.push({ g, ts, dofs });
  }
  const K = zeros(nd, nd);
  const F = new Array<number>(nd).fill(0);

  const elemK = (EA: number, EI: number, l: number): Matrix => {
    const a = EA / l, b = (12 * EI) / l ** 3, cc = (6 * EI) / l ** 2, d = (4 * EI) / l, e = (2 * EI) / l;
    return [
      [a, 0, 0, -a, 0, 0],
      [0, b, cc, 0, -b, cc],
      [0, cc, d, 0, -cc, e],
      [-a, 0, 0, a, 0, 0],
      [0, -b, -cc, 0, b, -cc],
      [0, cc, e, 0, -cc, d],
    ];
  };
  const toLocal = (c: number, s: number, v: number[]) => [
    c * v[0] + s * v[1], -s * v[0] + c * v[1], v[2], c * v[3] + s * v[4], -s * v[3] + c * v[4], v[5],
  ];
  const toGlobal = (c: number, s: number, v: number[]) => [
    c * v[0] - s * v[1], s * v[0] + c * v[1], v[2], c * v[3] - s * v[4], s * v[3] + c * v[4], v[5],
  ];

  const memberDists = new Map<string, DistributedLoad[]>();
  const memberPoints = new Map<string, PointAction[]>();
  for (const g of geos) {
    const dl: DistributedLoad[] = [];
    for (const ld of distLoadsOf(g)) {
      const f = localDist(ld, g.c, g.s);
      if (Math.abs(f.qx) > 1e-14) dl.push({ id: ld.id + 'x', type: 'distributed', name: ld.name, x1: ld.a, x2: ld.b, dir: 'x', q1: f.qx * ld.q1, q2: f.qx * ld.q2 });
      if (Math.abs(f.qy) > 1e-14) dl.push({ id: ld.id + 'y', type: 'distributed', name: ld.name, x1: ld.a, x2: ld.b, dir: 'y', q1: f.qy * ld.q1, q2: f.qy * ld.q2 });
    }
    memberDists.set(g.m.id, dl);
    const pa: PointAction[] = [];
    for (const ld of pointLoadsOf(g)) {
      const [lx, ly] = ld.local ? [ld.Fx, ld.Fy] : [g.c * ld.Fx + g.s * ld.Fy, -g.s * ld.Fx + g.c * ld.Fy];
      pa.push({ x: Math.min(Math.max(ld.a, 0), g.L), Fx: lx, Fy: ly, Fz: 0, Mx: 0, My: 0, Mz: ld.M, label: ld.name, source: 'load' });
    }
    memberPoints.set(g.m.id, pa);
  }
  const qAt = (d: DistributedLoad, t: number) => d.q1 + ((d.q2 - d.q1) * (t - d.x1)) / (d.x2 - d.x1);

  const elemFeq: number[][][] = []; // [mesh][elem] → 6 tải nút tương đương (địa phương, N)
  const elems: { mIdx: number; e: number; ids: number[]; c: number; s: number; l: number; EA: number; EI: number }[] = [];
  meshes.forEach((ms, mIdx) => {
    const { g, ts, dofs } = ms;
    const EA = E * g.sec.props.A * 1e-6;
    const EI = E * g.sec.props.Iz * 1e-12;
    const dl = memberDists.get(g.m.id)!;
    elemFeq.push([]);
    for (let e = 0; e + 1 < ts.length; e++) {
      const l = ts[e + 1] - ts[e];
      const kl = elemK(EA, EI, l);
      const { c, s } = g;
      // K_g = Tᵀ k T
      const cols: number[][] = [];
      for (let q = 0; q < 6; q++) {
        const unit = new Array(6).fill(0);
        unit[q] = 1;
        const tu = toLocal(c, s, unit);
        const klu = kl.map((row) => row.reduce((acc, kv, z) => acc + kv * tu[z], 0));
        cols.push(toGlobal(c, s, klu));
      }
      const ids = [...dofs[e], ...dofs[e + 1]];
      elems.push({ mIdx, e, ids, c, s, l, EA, EI });
      for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) K[ids[a]][ids[b]] += cols[b][a];
      const feq = new Array(6).fill(0);
      for (const d of dl) {
        if (ts[e] < d.x1 - tol * 10 || ts[e + 1] > d.x2 + tol * 10) continue;
        const qa = qAt(d, ts[e]) * KN, qb = qAt(d, ts[e + 1]) * KN;
        if (d.dir === 'x') {
          feq[0] += (l * (2 * qa + qb)) / 6;
          feq[3] += (l * (qa + 2 * qb)) / 6;
        } else {
          feq[1] += (l * (7 * qa + 3 * qb)) / 20;
          feq[2] += (l * l * (3 * qa + 2 * qb)) / 60;
          feq[4] += (l * (3 * qa + 7 * qb)) / 20;
          feq[5] -= (l * l * (2 * qa + 3 * qb)) / 60;
        }
      }
      elemFeq[mIdx].push(feq);
      const fg = toGlobal(c, s, feq);
      for (let a = 0; a < 6; a++) F[ids[a]] += fg[a];
    }
    // Lực tập trung trên thanh → nút chia
    for (const p of memberPoints.get(g.m.id)!) {
      let q = 0;
      while (q < ts.length - 1 && ts[q] < p.x - tol * 10) q++;
      const [dx, dy, dr] = dofs[q];
      F[dx] += (g.c * p.Fx - g.s * p.Fy) * KN;
      F[dy] += (g.s * p.Fx + g.c * p.Fy) * KN;
      F[dr] += p.Mz * KN;
    }
  });
  for (const ld of model.loads) {
    if (ld.type !== 'node') continue;
    const [dx, dy, dr] = nodeDof[nodeIdx.get(ld.nodeId)!];
    F[dx] += ld.Fx * KN;
    F[dy] += ld.Fy * KN;
    if (dr !== null) F[dr] += ld.M * KN;
  }

  // Liên kết (nhân tử Lagrange)
  const cons = supCols.map((sc) => {
    const [dx, dy, dr] = nodeDof[sc.k];
    const row = new Map<number, number>();
    if (sc.d[0]) row.set(dx, sc.d[0]);
    if (sc.d[1]) row.set(dy, sc.d[1]);
    if (sc.d[2] && dr !== null) row.set(dr, sc.d[2]);
    return row;
  });
  // Bậc tự do xoay không nối với gì (không độ cứng) → khử bằng cách cho bằng 0
  const used = new Array(nd).fill(false);
  for (let a = 0; a < nd; a++) for (let b = 0; b < nd; b++) if (K[a][b] !== 0) { used[a] = true; break; }
  const nTot = nd + cons.length;
  const A = zeros(nTot, nTot);
  const rhs = new Array<number>(nTot).fill(0);
  let kScale = 0;
  for (let a = 0; a < nd; a++) kScale = Math.max(kScale, Math.abs(K[a][a]));
  for (let a = 0; a < nd; a++) {
    for (let b = 0; b < nd; b++) A[a][b] = K[a][b];
    rhs[a] = F[a];
    if (!used[a]) A[a][a] = kScale || 1;
  }
  cons.forEach((row, q) => {
    // nhân hệ số kScale để cân bằng độ lớn với ma trận độ cứng (tránh sai số khi khử Gauss)
    for (const [d, v] of row) {
      A[nd + q][d] = v * (kScale || 1);
      A[d][nd + q] = v * (kScale || 1);
    }
  });
  let sol = solve(A, rhs);
  if (!sol) return fail(['Ma trận độ cứng suy biến — hệ biến hình.'], det);

  // ── Lực dọc phần tử & ma trận độ cứng hình học ──
  const geoLocal = (N: number, l: number): number[][] => {
    const k = N / (30 * l);
    const g = zeros(6, 6);
    const idx = [1, 2, 4, 5];
    const m = [
      [36, 3 * l, -36, 3 * l],
      [3 * l, 4 * l * l, -3 * l, -l * l],
      [-36, -3 * l, 36, -3 * l],
      [3 * l, -l * l, -3 * l, 4 * l * l],
    ];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) g[idx[a]][idx[b]] = k * m[a][b];
    return g;
  };
  const localEnd = (el: (typeof elems)[number], uu: number[], N: number) => {
    const ul = toLocal(el.c, el.s, el.ids.map((d) => uu[d]));
    const kl = elemK(el.EA, el.EI, el.l);
    const kg = N ? geoLocal(N, el.l) : null;
    const fe = elemFeq[el.mIdx][el.e];
    return kl.map((row, a) => row.reduce((acc, kv, b) => acc + (kv + (kg ? kg[a][b] : 0)) * ul[b], 0) - fe[a]);
  };
  const axialForces = (uu: number[], Nprev: number[]) => elems.map((el, i) => {
    const f = localEnd(el, uu, Nprev[i]);
    return (-f[0] + f[3]) / 2;
  });
  const addGeo = (M: Matrix, Ns: number[], sign = 1) => {
    elems.forEach((el, i) => {
      if (!Ns[i]) return;
      const gl = geoLocal(Ns[i], el.l);
      for (let q = 0; q < 6; q++) {
        const unit = new Array(6).fill(0);
        unit[q] = 1;
        const tu = toLocal(el.c, el.s, unit);
        const col = toGlobal(el.c, el.s, gl.map((row) => row.reduce((acc, kv, z) => acc + kv * tu[z], 0)));
        for (let a = 0; a < 6; a++) M[el.ids[a]][el.ids[q]] += sign * col[a];
      }
    });
  };
  let Ncur = axialForces(sol.slice(0, nd), new Array(elems.length).fill(0));

  let buckling: FrameResult['buckling'] = null;
  if (wantBuckling && Ncur.some((n) => n < 0)) {
    const lu = luFactor(A);
    if (lu) {
      const G = zeros(nd, nd);
      addGeo(G, Ncur, -1);
      const applyG = (y: number[]) => {
        const out = new Array<number>(nTot).fill(0);
        for (let a = 0; a < nd; a++) { let acc = 0; const Ga = G[a]; for (let b = 0; b < nd; b++) acc += Ga[b] * y[b]; out[a] = acc; }
        return out;
      };
      const start = sol.map((v, i) => (i < nd ? v + 1e-6 * Math.sin(i + 1) : 0));
      const ev = smallestEigen(lu, applyG, nTot, start);
      if (ev && ev.lambda > 0) {
        let mx = 0;
        for (let i = 0; i < nd; i++) mx = Math.max(mx, Math.abs(ev.x[i]));
        buckling = {
          alpha: ev.lambda,
          mode: meshes.map((ms) => ({
            id: ms.g.m.id,
            pts: ms.ts.map((t, q) => ({ s: t, ux: ev.x[ms.dofs[q][0]] / (mx || 1), uy: ev.x[ms.dofs[q][1]] / (mx || 1) })),
          })),
        };
      }
    }
  }
  if (secondOrder) {
    if (buckling && buckling.alpha <= 1) {
      return fail([`Tải trọng vượt tải tới hạn của khung (α_th = ${buckling.alpha.toFixed(3)} ≤ 1) — khung mất ổn định.`], det);
    }
    for (let it = 0; it < 8; it++) {
      const A2 = A.map((row) => [...row]);
      addGeo(A2, Ncur);
      const s2 = solve(A2, rhs);
      if (!s2) return fail(['Ma trận độ cứng bậc hai suy biến — khung mất ổn định.'], det);
      sol = s2;
      const Nn = axialForces(sol.slice(0, nd), Ncur);
      const dN = Math.max(...Nn.map((v, i) => Math.abs(v - Ncur[i])));
      const nMax = Math.max(1, ...Nn.map(Math.abs));
      Ncur = Nn;
      if (dN <= 1e-7 * nMax) break;
    }
  }
  const u = sol.slice(0, nd);
  const lam = sol.slice(nd).map((v) => v * (kScale || 1));

  // Phản lực
  const reactions: FrameReaction[] = model.supports.map((s) => {
    const k = nodeIdx.get(s.nodeId)!;
    const r: FrameReaction = { supportId: s.id, nodeId: s.nodeId, name: model.nodes[k].name, Rx: 0, Ry: 0, M: 0, Rt: 0, Rn: 0 };
    supCols.forEach((sc, q) => {
      if (sc.sup.id !== s.id) return;
      const v = -lam[q] / KN;
      r.Rx += v * sc.d[0];
      r.Ry += v * sc.d[1];
      r.M += v * sc.d[2];
      if (sc.label === 't') r.Rt = v;
      if (sc.label === 'n') r.Rn = v;
    });
    const cl = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v);
    r.Rx = cl(r.Rx); r.Ry = cl(r.Ry); r.M = cl(r.M); r.Rt = cl(r.Rt); r.Rn = cl(r.Rn);
    return r;
  });

  // Nội lực thanh
  let fScale = 1e-12;
  for (const r of reactions) fScale = Math.max(fScale, Math.abs(r.Rx), Math.abs(r.Ry), Math.abs(r.M));
  for (const ld of model.loads) {
    if (ld.type === 'mdist') fScale = Math.max(fScale, Math.abs(ld.q1), Math.abs(ld.q2));
    else fScale = Math.max(fScale, Math.abs(ld.Fx), Math.abs(ld.Fy), Math.abs(ld.M));
  }
  const clean = (v: number, sc: number) => (Math.abs(v) < 1e-8 * sc ? 0 : v);

  const members: MemberResult[] = meshes.map((ms, mIdx) => {
    const { g, ts, dofs } = ms;
    const endForces = (e: number) => {
      const k = elems.findIndex((el) => el.mIdx === mIdx && el.e === e);
      return localEnd(elems[k], u, secondOrder ? Ncur[k] : 0).map((v) => v / KN);
    };
    // chuyển vị ngang địa phương v′(s) (m) — nội suy Hermite giữa các nút chia
    const vLoc = (sv: number) => {
      let q = 0;
      while (q < ts.length - 2 && sv > ts[q + 1]) q++;
      const l = ts[q + 1] - ts[q];
      const t = Math.min(Math.max((sv - ts[q]) / l, 0), 1);
      const vv = (k: number) => -g.s * u[dofs[k][0]] + g.c * u[dofs[k][1]];
      const v1 = vv(q), v2 = vv(q + 1), t1 = u[dofs[q][2]], t2 = u[dofs[q + 1][2]];
      return (1 - 3 * t * t + 2 * t ** 3) * v1 + l * (t - 2 * t * t + t ** 3) * t1 + (3 * t * t - 2 * t ** 3) * v2 + l * (-t * t + t ** 3) * t2;
    };
    const f0 = endForces(0);
    const fl = endForces(ts.length - 2);
    const endI: [number, number, number] = [f0[0], f0[1], f0[2]];
    const endJ: [number, number, number] = [fl[3], fl[4], fl[5]];
    const pts = memberPoints.get(g.m.id)!.filter((p) => p.x > tol * 10 && p.x < g.L - tol * 10);
    const actions: PointAction[] = [
      { x: 0, Fx: endI[0], Fy: endI[1], Fz: 0, Mx: 0, My: 0, Mz: endI[2], label: `Lực đầu ${model.nodes[g.i].name}`, source: 'reaction' },
      ...pts,
    ];
    const dists = memberDists.get(g.m.id)!;
    const internalAt = (s: number, side: 'left' | 'right'): MemberForces => {
      const ss = Math.min(Math.max(s, 0), g.L);
      const sd = ss <= 0 ? 'right' : side;
      const fz = sectionForces(actions, dists, ss, sd, tol * 10);
      if (secondOrder) {
        const vh = vLoc(ss);
        for (const a of actions) {
          if (!a.Fx) continue;
          if (!(a.x < ss - tol * 10 || (sd === 'right' && Math.abs(a.x - ss) <= tol * 10))) continue;
          fz.Mz += a.Fx * (vLoc(a.x) - vh);
        }
        for (const d of dists) {
          if (d.dir !== 'x' || d.x1 >= ss) continue;
          const c2 = Math.min(d.x2, ss), n = 12, h = (c2 - d.x1) / n;
          for (let k = 0; k <= n; k++) {
            const sx = d.x1 + k * h;
            fz.Mz += (k === 0 || k === n ? 1 : k % 2 ? 4 : 2) * (h / 3) * qAt(d, sx) * (vLoc(sx) - vh);
          }
        }
      }
      return { N: clean(fz.N, fScale), Q: clean(fz.Qy, fScale), M: clean(fz.Mz, fScale * Math.max(1, g.L)) };
    };
    const keyS = uniq([0, g.L, ...pts.map((p) => p.x), ...dists.flatMap((d) => [d.x1, d.x2])], tol * 10);
    const samples: ({ s: number } & MemberForces)[] = [];
    for (let q = 0; q + 1 < keyS.length; q++) {
      const a = keyS[q], b = keyS[q + 1];
      const n = 32;
      for (let r = 0; r <= n; r++) {
        const sv = a + ((b - a) * r) / n;
        samples.push({ s: sv, ...internalAt(sv, r === n ? 'left' : 'right') });
      }
    }
    const disp = ts.map((t, q) => ({ s: t, ux: u[dofs[q][0]] * 1e3, uy: u[dofs[q][1]] * 1e3 }));
    return {
      id: g.m.id, name: g.m.name, L: g.L, c: g.c, s: g.s, section: g.sec.props, sectionSpec: g.sec.spec,
      endI, endJ, keyS, samples, disp, internalAt, actions, dists,
    };
  });

  const nodeDisp = model.nodes.map((n, k) => ({
    nodeId: n.id, name: n.name,
    ux: u[nodeDof[k][0]] * 1e3, uy: u[nodeDof[k][1]] * 1e3,
    rz: nodeDof[k][2] !== null ? u[nodeDof[k][2] as number] : null,
  }));

  // Kiểm tra cân bằng toàn hệ (quanh gốc toạ độ)
  let X = 0, Y = 0, M = 0;
  const addF = (fx: number, fy: number, x: number, y: number, m = 0) => { X += fx; Y += fy; M += x * fy - y * fx + m; };
  for (const r of reactions) { const n = model.nodes[nodeIdx.get(r.nodeId)!]; addF(r.Rx, r.Ry, n.x, n.y, r.M); }
  for (const ld of model.loads) {
    if (ld.type === 'node') { const n = model.nodes[nodeIdx.get(ld.nodeId)!]; addF(ld.Fx, ld.Fy, n.x, n.y, ld.M); continue; }
    const g = geoById.get(ld.memberId)!;
    const ni = model.nodes[g.i];
    const P = (t: number): [number, number] => [ni.x + g.c * t, ni.y + g.s * t];
    if (ld.type === 'mpoint') {
      const [fx, fy] = ld.local ? [g.c * ld.Fx - g.s * ld.Fy, g.s * ld.Fx + g.c * ld.Fy] : [ld.Fx, ld.Fy];
      const [x, y] = P(ld.a);
      addF(fx, fy, x, y, ld.M);
    } else {
      const f = localDist(ld, g.c, g.s);
      const R = ((ld.q1 + ld.q2) / 2) * (ld.b - ld.a);
      const tc = R !== 0 && ld.q1 + ld.q2 !== 0 ? ld.a + ((ld.b - ld.a) * (ld.q1 + 2 * ld.q2)) / (3 * (ld.q1 + ld.q2)) : (ld.a + ld.b) / 2;
      const [x, y] = P(tc);
      addF(R * (g.c * f.qx - g.s * f.qy), R * (g.s * f.qx + g.c * f.qy), x, y);
    }
  }

  const degree = det.degree;
  if (geos.every((g) => g.m.releaseI && g.m.releaseJ) && model.loads.some((l) => l.type !== 'node')) {
    warnings.push('Mọi thanh đều nối khớp hai đầu (hệ dàn) nhưng có tải trên thanh: thanh sẽ chịu uốn cục bộ.');
  }
  return {
    ok: true, errors, warnings, status: degree === 0 ? 'tinh-dinh' : 'sieu-tinh', degree, det, reactions, members, nodeDisp,
    residual: { X, Y, M }, secondOrder, buckling,
  };
}
