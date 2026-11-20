/**
 * Ổn định uốn – xoắn (mất ổn định ngang) của dầm chịu uốn trong mặt phẳng đứng.
 *
 * Mô men tới hạn đàn hồi M_cr tính bằng phần tử hữu hạn (ẩn: chuyển vị ngang u và góc xoắn φ,
 * hàm dạng Hermite bậc 3) từ thế năng toàn phần:
 *   Π = ½∫(EI_y u″² + GI_t φ′² + EI_w φ″²)dx + α[∫ M(x)·u″·φ dx − ½ Σ P·e·φ² − ½∫ q·e·φ² dx]
 * trong đó M(x) là biểu đồ mô men thực, e là khoảng cách điểm đặt tải phía trên tâm cắt
 * (tải hướng xuống đặt trên tâm cắt làm giảm M_cr). Trị riêng α nhỏ nhất: M_cr = α·M_max.
 *
 * Kiểm tra bền theo phương pháp tổng quát EN 1993-1-1 §6.3.2.2:
 *   λ̄_LT = √(W·f_y / M_cr), Φ = 0.5[1 + α_LT(λ̄ − 0.2) + λ̄²], χ_LT = 1/(Φ + √(Φ² − λ̄²)) ≤ 1
 *   M_max ≤ χ_LT·W·[σ]   ([σ] dùng thay cho f_y/γ_M1 để thống nhất với phần còn lại của ứng dụng)
 *
 * Giả thiết: gối tựa chặn chuyển vị ngang và xoắn (gối chạc); ngàm chặn cả u′, φ′ (kiềm chế vênh).
 * Mặt cắt chỉ đối xứng một trục: kể hiệu ứng Wagner bằng số hạng ½∫(−M·β_y)φ′²dx, với
 *   β_y = (1/I_z)∫_A y(y² + z²)dA − 2y_0   (y, z so với trọng tâm, y_0 — toạ độ tâm cắt; M > 0 nén thớ trên)
 * (ứng suất pháp σ = −M·y/I_z tác dụng lên thớ xoay quanh tâm cắt: ∫σ·r²dA = −M·β_y).
 * Cánh nén lớn hơn cánh kéo → −M·β_y > 0 → M_cr tăng.
 *
 * Thanh khung: dùng cùng lời giải cho từng thanh với biểu đồ mô men, tải ngang và lực tập trung trong hệ địa phương;
 * hai đầu thanh coi là gối chạc (chặn chuyển vị ngang và xoắn, vênh tự do) trừ đầu công-xôn tự do; có thể thêm giằng trong nhịp.
 */
import type { AnalysisResult } from './analysis';
import { aeffIfClass4, weffZ } from './effective';
import { luFactor, luSolve, zeros } from './linalg';

/** Số pivot âm khi khử Gauss không hoán vị (= số trị riêng âm của ma trận đối xứng) */
function negativePivots(A: number[][]): number {
  const n = A.length;
  const M = A.map((r) => r.slice());
  let neg = 0;
  const scale = Math.max(1e-300, ...M.map((r, i) => Math.abs(r[i])));
  for (let k = 0; k < n; k++) {
    let p = M[k][k];
    if (Math.abs(p) < 1e-14 * scale) p = M[k][k] = -1e-14 * scale;
    if (p < 0) neg++;
    const rk = M[k];
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / p;
      if (!f) continue;
      const ri = M[i];
      for (let j = k + 1; j < n; j++) ri[j] -= f * rk[j];
    }
  }
  return neg;
}
import { fmt } from './stress';
import type { FrameModel, FrameResult } from './frame';
import type { LtbProps, SectionProps } from './section';
import { effectiveRestraints, type DistributedLoad, type Material, type Model, type SectionSpec } from './types';

export type LoadHeight = 'top' | 'sc' | 'bottom';
export type LtbCurve = 'a' | 'b' | 'c' | 'd';

export const LTB_CURVES: Record<LtbCurve, number> = { a: 0.21, b: 0.34, c: 0.49, d: 0.76 };

export interface LtbBrace {
  id: string;
  x: number;
  /** chặn chuyển vị ngang tại tâm cắt */
  lateral: boolean;
  /** chặn xoắn */
  twist: boolean;
}

export interface LtbOptions {
  loadHeight: LoadHeight;
  braces: LtbBrace[];
  fy: number; // MPa
  curve: 'auto' | LtbCurve;
  /** khoảng cách sườn ngang (chỉ dùng cho tiết diện hữu hiệu có sườn dọc) */
  stiffenerSpacing?: number;
}

export interface LtbResult {
  applicable: boolean;
  reason?: string;
  Mmax: number; // kN·m
  xMax: number;
  Mcr: number; // kN·m
  alpha: number;
  Iw: number; // mm⁶
  It: number; // mm⁴
  Iweak: number; // mm⁴
  W: number; // mm³
  lambdaLT: number;
  curve: LtbCurve;
  chi: number;
  Mrd: number; // kN·m = χ·W·[σ]
  Mel: number; // kN·m = W·[σ]
  util: number;
  ok: boolean;
  mode: { x: number; u: number; phi: number }[];
  /** hệ số Wagner β_y (mm); 0 với mặt cắt đối xứng hai trục */
  betaY: number;
  steps: string[];
  warnings: string[];
}

const NA = (reason: string): LtbResult => ({
  applicable: false, reason, Mmax: 0, xMax: 0, Mcr: 0, alpha: 0, Iw: 0, It: 0, Iweak: 0, W: 0, lambdaLT: 0, curve: 'd', chi: 1,
  Mrd: 0, Mel: 0, util: 0, ok: true, mode: [], betaY: 0, steps: [], warnings: [],
});

/** Ma trận phần tử dầm Hermite: ∫ N″ᵢ N″ⱼ dx (nhân EI) */
const kBend = (l: number) => {
  const c = 1 / l ** 3;
  return [
    [12 * c, 6 * l * c, -12 * c, 6 * l * c],
    [6 * l * c, 4 * l * l * c, -6 * l * c, 2 * l * l * c],
    [-12 * c, -6 * l * c, 12 * c, -6 * l * c],
    [6 * l * c, 2 * l * l * c, -6 * l * c, 4 * l * l * c],
  ];
};
/** ∫ N′ᵢ N′ⱼ dx (nhân GI_t) */
const kString = (l: number) => {
  const c = 1 / (30 * l);
  return [
    [36 * c, 3 * l * c, -36 * c, 3 * l * c],
    [3 * l * c, 4 * l * l * c, -3 * l * c, -l * l * c],
    [-36 * c, -3 * l * c, 36 * c, -3 * l * c],
    [3 * l * c, -l * l * c, -3 * l * c, 4 * l * l * c],
  ];
};
const N = (t: number, l: number) => [1 - 3 * t * t + 2 * t ** 3, l * (t - 2 * t * t + t ** 3), 3 * t * t - 2 * t ** 3, l * (-t * t + t ** 3)];
const N1 = (t: number, l: number) => [(-6 * t + 6 * t * t) / l, 1 - 4 * t + 3 * t * t, (6 * t - 6 * t * t) / l, -2 * t + 3 * t * t];
const N2 = (t: number, l: number) => [(-6 + 12 * t) / (l * l), (-4 + 6 * t) / l, (6 - 12 * t) / (l * l), (-2 + 6 * t) / l];
const GAUSS: [number, number][] = [
  [0.0694318442029737, 0.1739274225687269], [0.3300094782075719, 0.3260725774312731],
  [0.6699905217924281, 0.3260725774312731], [0.9305681557970263, 0.1739274225687269],
];

/**
 * Hệ số Wagner β_y = (1/I_z)∫y(y² + z²)dA − 2y_0 (mm), tích phân chính xác trên các vòng đa giác của mặt cắt
 * (định lý Green: ∫∫y³dA = ∮z·y³dy, ∫∫z²y dA = ∮(z³/3)·y dy; Gauss 3 điểm chính xác cho đa thức bậc 5).
 */
export function wagnerBeta(sec: SectionProps, lp: LtbProps): number {
  const [zc, yc] = sec.centroid;
  const G3: [number, number][] = [[0.1127016653792583, 5 / 18], [0.5, 8 / 18], [0.8872983346207417, 5 / 18]];
  let I = 0;
  for (const r of sec.rings) {
    if (r.pts.length < 3) continue;
    let area = 0, acc = 0;
    const n = r.pts.length;
    for (let i = 0; i < n; i++) {
      const [z1, y1] = r.pts[i], [z2, y2] = r.pts[(i + 1) % n];
      const a1 = z1 - zc, b1 = y1 - yc, a2 = z2 - zc, b2 = y2 - yc;
      area += 0.5 * (a1 * b2 - a2 * b1);
      const dy = b2 - b1;
      for (const [t, w] of G3) {
        const z = a1 + (a2 - a1) * t, y = b1 + dy * t;
        acc += w * (z * y ** 3 + (z ** 3 / 3) * y) * dy;
      }
    }
    const orient = area >= 0 ? 1 : -1;
    I += (r.hole ? -1 : 1) * orient * acc;
  }
  return I / sec.Iz - 2 * lp.ySc;
}

export interface LtbRestraint {
  x: number;
  lateral: boolean;
  twist: boolean;
  /** chặn u′ và φ′ (ngàm, kiềm chế vênh) */
  warp?: boolean;
}

/** Bài toán mất ổn định uốn – xoắn tổng quát của một thanh thẳng (dầm hoặc một thanh khung) */
export interface LtbProblem {
  L: number;
  spec: SectionSpec;
  sec: SectionProps;
  material: Material;
  /** mô men uốn trong mặt phẳng tại x (kN·m), M > 0 nén thớ trên (+y) */
  M: (x: number) => number;
  /** các điểm cần chia lưới (gối, giằng, điểm đặt lực...) */
  keyPoints: number[];
  /** mô men lớn nhất (kN·m) và vị trí */
  Mmax: number;
  xMax: number;
  dists: DistributedLoad[];
  /** lực tập trung ngang (kN, theo +y) */
  points: { x: number; Fy: number }[];
  restraints: LtbRestraint[];
  /** có giằng trong nhịp (để ghi chú C1) */
  braced: boolean;
  /** lực dọc tại x (kN, kéo +) — chỉ dùng cho α_cr,op (phương pháp tổng quát) */
  N?: (x: number) => number;
  opt: LtbOptions;
}

export function checkLTB(model: Model, res: AnalysisResult, opt: LtbOptions): LtbResult {
  if (!res.ok || !res.section) return NA('Chưa có kết quả tính dầm.');
  let Mmax = 0, xMax = 0;
  for (const s of res.forceSamples) if (Math.abs(s.Mz) > Math.abs(Mmax)) { Mmax = s.Mz; xMax = s.x; }
  const restraints: LtbRestraint[] = [];
  for (const s of model.supports) {
    const r = effectiveRestraints(s);
    if (!r.uy && !r.uz) continue;
    restraints.push({ x: s.x, lateral: true, twist: true, warp: r.rz && (s.kind === 'fixed' || r.ry) });
  }
  for (const b of opt.braces) restraints.push({ x: b.x, lateral: b.lateral, twist: b.twist });
  return solveLTB({
    L: model.length, spec: model.section, sec: res.section, material: model.material, M: (x) => res.internalAt(x, 'right').Mz,
    keyPoints: [...model.supports.map((s) => s.x), ...opt.braces.map((b) => b.x), ...res.keyPoints], Mmax, xMax,
    dists: res.distributed, points: res.actions.filter((a) => a.source === 'load' && a.Fy).map((a) => ({ x: a.x, Fy: a.Fy })),
    restraints, braced: opt.braces.length > 0, opt,
  });
}

export interface FrameLtbOptions {
  loadHeight: LoadHeight;
  curve: 'auto' | LtbCurve;
  /** số giằng (chặn ngang + xoắn) chia đều trong nhịp từng thanh */
  braces: Record<string, number>;
}

/** Liên kết ngoài mặt phẳng của một thanh khung: gối chạc ở hai đầu (trừ đầu tự do của công-xôn) và giằng chia đều */
function memberRestraints(model: FrameModel, fm: FrameModel['members'][number], L: number, opt: FrameLtbOptions): LtbRestraint[] {
  const free = (nodeId: string) => !model.supports.some((s) => s.nodeId === nodeId) && model.members.filter((m) => m.i === nodeId || m.j === nodeId).length <= 1;
  const restraints: LtbRestraint[] = [];
  if (!free(fm.i)) restraints.push({ x: 0, lateral: true, twist: true });
  if (!free(fm.j)) restraints.push({ x: L, lateral: true, twist: true });
  const nb = Math.max(0, Math.round(opt.braces[fm.id] ?? 0));
  for (let k = 1; k <= nb; k++) restraints.push({ x: (L * k) / (nb + 1), lateral: true, twist: true });
  // đầu tự do của công-xôn: đầu còn lại cần ngàm cả vênh để thanh ổn định
  if (restraints.length === 1) restraints[0].warp = true;
  return restraints;
}

/**
 * Ổn định uốn – xoắn của một thanh khung (EN 1993-1-1 §6.3.2.2 như chế độ dầm).
 * Trục địa phương y của thanh vuông góc thanh (trái chiều i→j); "cánh trên" là phía +y.
 * Đầu thanh là gối chạc, trừ đầu tự do của công-xôn (nút không có gối và chỉ nối một thanh).
 */
export function checkFrameMemberLTB(model: FrameModel, res: FrameResult, memberId: string, opt: FrameLtbOptions, fy: number, stiffenerSpacing = 0): LtbResult {
  if (!res.ok) return NA('Chưa có kết quả tính khung.');
  const mr = res.members.find((m) => m.id === memberId);
  const fm = model.members.find((m) => m.id === memberId);
  if (!mr || !fm) return NA('Không tìm thấy thanh.');
  let Mmax = 0, xMax = 0;
  for (const s of mr.samples) if (Math.abs(s.M) > Math.abs(Mmax)) { Mmax = s.M; xMax = s.s; }
  const restraints = memberRestraints(model, fm, mr.L, opt);
  const nb = Math.max(0, Math.round(opt.braces[memberId] ?? 0));
  if (!restraints.length) return NA('Thanh không có liên kết chống xoắn.');
  return solveLTB({
    L: mr.L, spec: mr.sectionSpec, sec: mr.section, material: mr.material, M: (x) => mr.internalAt(x, 'right').M,
    keyPoints: [...mr.keyS, ...restraints.map((r) => r.x)], Mmax, xMax,
    dists: mr.dists, points: mr.actions.filter((a) => a.source === 'load' && a.Fy).map((a) => ({ x: a.x, Fy: a.Fy })),
    restraints, braced: nb > 0, opt: { loadHeight: opt.loadHeight, curve: opt.curve, braces: [], fy, stiffenerSpacing },
  });
}

/**
 * Bài toán trị riêng ngoài mặt phẳng (u, φ) bằng phần tử hữu hạn Hermite: K_E + α·K_G = 0.
 * K_G gồm mô men (∫M·u″φ, Wagner ½∫−Mβ_yφ′²), tải ngang lệch tâm cắt và — nếu có — lực dọc ½∫N[u′² − 2y₀u′φ′ + r₀²φ′²].
 * alpha0: ước lượng để chọn dịch chuyển; checkLowest: kiểm tra quán tính Sylvester để chắc là trị riêng dương nhỏ nhất.
 */
/** khoảng cách điểm đặt tải ngang so với tâm cắt (m, dương: phía +y) */
const loadEccentricity = (sec: SectionProps, lp: LtbProps, h: LoadHeight) =>
  ((h === 'top' ? sec.yMax : h === 'bottom' ? sec.yMin : lp.ySc) - lp.ySc) / 1e3;

function outOfPlaneEigen(pb: LtbProblem, alpha0: number, checkLowest: boolean): { alpha: number; mode: { x: number; u: number; phi: number }[] } | null {
  const { sec, opt, L } = pb;
  const lp = sec.ltb!;
  const E = pb.material.E * 1e9;
  const G = E / (2 * (1 + pb.material.nu));
  const EIy = E * sec.Iy * 1e-12;
  const GIt = G * sec.torsion.J * 1e-12;
  const EIw = E * lp.Iw * 1e-18;
  const beta = lp.monosym ? wagnerBeta(sec, lp) / 1e3 : 0; // m
  const y0 = lp.ySc / 1e3; // m
  const r02 = ((sec.Iy + sec.Iz) / sec.A + lp.ySc ** 2) * 1e-6; // m²
  // Lưới
  const tol = 1e-9 * Math.max(1, L);
  const keys = new Set<number>([0, L, ...pb.keyPoints]);
  const kp = [...keys].filter((x) => x >= -tol && x <= L + tol).sort((a, b) => a - b).filter((x, i, a) => i === 0 || x - a[i - 1] > tol);
  const xs: number[] = [];
  for (let i = 0; i + 1 < kp.length; i++) {
    const n = Math.max(1, Math.ceil(((kp[i + 1] - kp[i]) / L) * 80));
    for (let j = 0; j < n; j++) xs.push(kp[i] + ((kp[i + 1] - kp[i]) * j) / n);
  }
  xs.push(L);
  const nn = xs.length;
  const nd = 4 * nn; // u, u′, φ, φ′
  const KE = zeros(nd, nd);
  const KG = zeros(nd, nd);
  const e = loadEccentricity(sec, lp, opt.loadHeight); // m, dương: phía trên tâm cắt
  for (let k = 0; k + 1 < nn; k++) {
    const l = xs[k + 1] - xs[k];
    const iu = [4 * k, 4 * k + 1, 4 * k + 4, 4 * k + 5];
    const ip = [4 * k + 2, 4 * k + 3, 4 * k + 6, 4 * k + 7];
    const kb = kBend(l), ks = kString(l);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      KE[iu[a]][iu[b]] += EIy * kb[a][b];
      KE[ip[a]][ip[b]] += EIw * kb[a][b] + GIt * ks[a][b];
    }
    for (const [t, w] of GAUSS) {
      const x = xs[k] + t * l;
      const M = pb.M(x) * 1e3; // N·m
      const Nx = pb.N ? pb.N(x) * 1e3 : 0; // N
      const n0 = N(t, l), n1 = N1(t, l), n2 = N2(t, l);
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        const v = w * l * M * n2[a] * n0[b];
        KG[iu[a]][ip[b]] += v;
        KG[ip[b]][iu[a]] += v;
        // hiệu ứng Wagner: ½∫(−M·β_y)φ′²
        if (beta) KG[ip[a]][ip[b]] += w * l * -M * beta * n1[a] * n1[b];
        // lực dọc (kéo +): ½∫N[u′² − 2y₀u′φ′ + r₀²φ′²]
        if (Nx) {
          const c = w * l * Nx * n1[a] * n1[b];
          KG[iu[a]][iu[b]] += c;
          KG[ip[a]][ip[b]] += c * r02;
          KG[iu[a]][ip[b]] -= c * y0;
          KG[ip[b]][iu[a]] -= c * y0;
        }
      }
      // tải phân bố đặt lệch tâm cắt
      let q = 0;
      for (const d of pb.dists) {
        if (d.dir !== 'y' || x < d.x1 || x > d.x2) continue;
        q += (d.q1 + ((d.q2 - d.q1) * (x - d.x1)) / (d.x2 - d.x1)) * 1e3;
      }
      if (q && e) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) KG[ip[a]][ip[b]] += w * l * q * e * n0[a] * n0[b];
    }
  }
  const nodeAt = (x: number) => {
    let k = 0;
    while (k < nn - 1 && xs[k] < x - tol) k++;
    return k;
  };
  // Lực tập trung đặt lệch tâm cắt: P hướng xuống (Fy < 0) đặt trên tâm cắt → −P·e·φ²  (Fy·e·φ²)
  if (e) for (const a of pb.points) KG[4 * nodeAt(a.x) + 2][4 * nodeAt(a.x) + 2] += a.Fy * 1e3 * e;
  // Liên kết
  const fixed = new Set<number>();
  for (const r of pb.restraints) {
    const k = nodeAt(r.x);
    if (r.lateral) fixed.add(4 * k);
    if (r.twist) fixed.add(4 * k + 2);
    if (r.warp) { fixed.add(4 * k + 1); fixed.add(4 * k + 3); }
  }
  const free = [...Array(nd).keys()].filter((d) => !fixed.has(d));
  const Gm = free.map((r) => free.map((c) => -KG[r][c]));
  const guess = () => free.map((d) => {
    const node = Math.floor(d / 4);
    return d % 4 === 0 || d % 4 === 2 ? Math.sin((Math.PI * xs[node]) / L) + 0.05 : 0;
  });
  /** lặp ngược có dịch chuyển: trị riêng gần sft nhất */
  const inverseIter = (sft: number): { a: number; x: number[] } | null => {
    const A = free.map((r, i) => free.map((c, j) => KE[r][c] - sft * Gm[i][j]));
    const lu = luFactor(A);
    if (!lu) return null;
    let x = guess();
    let mu = 0;
    for (let it = 0; it < 300; it++) {
      const g = Gm.map((row) => row.reduce((acc, v, j) => acc + v * x[j], 0));
      const y = luSolve(lu, g);
      let xy = 0, xx = 0, nrm = 0;
      for (let i = 0; i < y.length; i++) { xy += x[i] * y[i]; xx += x[i] * x[i]; nrm = Math.max(nrm, Math.abs(y[i])); }
      if (!(nrm > 0)) break;
      const muNew = xy / xx;
      x = y.map((v) => v / nrm);
      if (it > 3 && Math.abs(muNew - mu) <= 1e-10 * Math.abs(muNew)) { mu = muNew; break; }
      mu = muNew;
    }
    if (!mu) return null;
    const a = sft + 1 / mu;
    return Number.isFinite(a) ? { a, x } : null;
  };
  /** số trị riêng α trong (0, σ) — quán tính Sylvester của K_E − σ·G (K_E xác định dương) */
  const countBelow = (sig: number) => negativePivots(free.map((r, i) => free.map((c, j) => KE[r][c] - sig * Gm[i][j])));
  let alpha = NaN;
  let vec: number[] = [];
  for (const shiftFrac of [0.25, 0.05, 0.6]) {
    const r = inverseIter(shiftFrac * alpha0);
    if (r && r.a > 0) { alpha = r.a; vec = r.x; break; }
  }
  // Mặt cắt đối xứng một trục (Wagner): phổ không đối xứng ± — kiểm tra đây đúng là trị riêng dương nhỏ nhất
  if (checkLowest || !Number.isFinite(alpha)) {
    const ok = Number.isFinite(alpha) && countBelow(alpha * (1 - 1e-6)) === 0;
    if (!ok) {
      let hi = Number.isFinite(alpha) ? alpha : 2 * alpha0;
      for (let g = 0; g < 40 && countBelow(hi) === 0; g++) hi *= 2;
      if (countBelow(hi) > 0) {
        let lo = hi / 2;
        for (let g = 0; g < 60 && countBelow(lo) > 0; g++) { hi = lo; lo /= 2; }
        for (let g = 0; g < 40 && hi / lo > 1.02; g++) {
          const mid = Math.sqrt(lo * hi);
          if (countBelow(mid) > 0) hi = mid; else lo = mid;
        }
        const r = inverseIter(lo);
        if (r && r.a > 0) { alpha = r.a; vec = r.x; }
      }
    }
  }
  if (!Number.isFinite(alpha)) return null;
  const full = new Array<number>(nd).fill(0);
  free.forEach((d, i) => (full[d] = vec[i]));
  let mu = 0, mp = 0;
  for (let k = 0; k < nn; k++) { mu = Math.max(mu, Math.abs(full[4 * k])); mp = Math.max(mp, Math.abs(full[4 * k + 2])); }
  const mode = xs.map((x, k) => ({ x, u: full[4 * k] / (mu || 1), phi: full[4 * k + 2] / (mp || 1) }));
  return { alpha, mode };
}

/** Lời giải chung: trị riêng M_cr bằng phần tử hữu hạn (u, φ) và kiểm tra χ_LT */
export function solveLTB(pb: LtbProblem): LtbResult {
  const { sec, opt, L, Mmax, xMax } = pb;
  const lp = sec.ltb;
  if (!lp) return NA('Chưa hỗ trợ mặt cắt này (đa giác tự do hoặc thép hình xoay 90°).');
  if (Math.abs(Mmax) < 1e-9) return NA('Thanh không chịu uốn trong mặt phẳng.');
  if (sec.Iz < sec.Iy * 1.0001) {
    return NA('Thanh uốn quanh trục yếu (I_z ≤ I_y): không xảy ra mất ổn định uốn – xoắn.');
  }
  const Wel = sec.Iz / Math.max(sec.yMax, -sec.yMin);
  const Weff = weffZ(pb.spec, pb.material, opt.fy, Math.sign(Mmax) || 1, opt.stiffenerSpacing ?? 0);
  const W = Weff && Weff < Wel ? Weff : Wel;
  const E = pb.material.E * 1e9;
  const G = E / (2 * (1 + pb.material.nu));
  const EIy = E * sec.Iy * 1e-12;
  const GIt = G * sec.torsion.J * 1e-12;
  const EIw = E * lp.Iw * 1e-18;
  const warnings: string[] = [];
  const steps: string[] = [];
  if (lp.closed) warnings.push('Mặt cắt kín (hộp/ống) có độ cứng xoắn rất lớn — hầu như không mất ổn định uốn – xoắn.');
  if (!(GIt > 0)) return NA('Không xác định được độ cứng xoắn của mặt cắt.');
  const betaY = lp.monosym ? wagnerBeta(sec, lp) : 0; // mm
  const e = loadEccentricity(sec, lp, opt.loadHeight); // m

  // Ước lượng ban đầu (C1 = 1, chiều dài L) để chọn dịch chuyển
  const Mcr0 = ((Math.PI ** 2 * EIy) / (L * L)) * Math.sqrt(EIw / EIy + (L * L * GIt) / (Math.PI ** 2 * EIy));
  const Mabs = Math.abs(Mmax) * 1e3;
  const eg = outOfPlaneEigen({ ...pb, N: undefined }, Mcr0 / Mabs, lp.monosym);
  if (!eg) return NA('Không tìm được mô men tới hạn (dầm không có liên kết chống xoắn?).');
  const { alpha, mode } = eg;
  const Mcr = (alpha * Mabs) / 1e3;
  const curve: LtbCurve = opt.curve !== 'auto' ? opt.curve
    : lp.rolled ? (lp.hOverB <= 2 ? 'a' : 'b') : (lp.hOverB <= 2 ? 'c' : 'd');
  const aLT = LTB_CURVES[curve];
  const lam = Math.sqrt((W * opt.fy) / (Mcr * 1e6));
  const Phi = 0.5 * (1 + aLT * (lam - 0.2) + lam * lam);
  const chi = Math.min(1, 1 / (Phi + Math.sqrt(Math.max(Phi * Phi - lam * lam, 0))));
  const allow = pb.material.allowable;
  const Mel = (W * allow) / 1e6;
  const Mrd = chi * Mel;
  const util = Math.abs(Mmax) / Mrd;

  steps.push(`I_y (trục yếu) = ${fmt(sec.Iy, 0)} mm⁴; I_t = ${fmt(sec.torsion.J, 0)} mm⁴; I_w = ${fmt(lp.Iw, 0)} mm⁶; W = ${fmt(W, 0)} mm³${W < Wel ? ` (tiết diện loại 4: W_eff, W_el = ${fmt(Wel, 0)})` : ''}`);
  if (lp.monosym) steps.push(`Mặt cắt đối xứng một trục — hiệu ứng Wagner: β_y = (1/I_z)∫y(y² + z²)dA − 2y_0 = ${fmt(betaY, 2)} mm (y_0 = ${fmt(lp.ySc, 2)} mm); số hạng ½∫(GI_t − M·β_y)φ′²dx — ${betaY * Mmax < 0 ? 'cánh lớn chịu nén làm tăng' : 'cánh nhỏ chịu nén làm giảm'} M_cr`);
  steps.push(`Tải đặt ${opt.loadHeight === 'top' ? 'ở cánh trên' : opt.loadHeight === 'bottom' ? 'ở cánh dưới' : 'tại tâm cắt'}: e = ${fmt(e * 1e3, 1)} mm so với tâm cắt`);
  steps.push(`Ước lượng (mô men đều, gối chạc, chiều dài L): M_cr,0 = π²EI_y/L²·√(I_w/I_y + L²GI_t/(π²EI_y)) = ${fmt(Mcr0 / 1e3, 2)} kN·m`);
  steps.push(`Bài toán trị riêng với biểu đồ mô men thực: α_cr = ${fmt(alpha, 4)} → M_cr = α·|M|max = ${fmt(alpha, 4)}·${fmt(Math.abs(Mmax), 3)} = ${fmt(Mcr, 3)} kN·m (= ${fmt(Mcr / (Mcr0 / 1e3), 3)} × M_cr,0${pb.braced ? '' : '; với thanh không giằng, tỉ số này chính là hệ số C1'})`);
  steps.push(`λ̄_LT = √(W·f_y/M_cr) = √(${fmt(W, 0)}·${opt.fy}/${fmt(Mcr * 1e6, 0)}) = ${fmt(lam, 3)}; đường cong ${curve} (α_LT = ${aLT})`);
  steps.push(`Φ = 0.5[1 + ${aLT}(${fmt(lam, 3)} − 0.2) + ${fmt(lam, 3)}²] = ${fmt(Phi, 4)}; χ_LT = 1/(Φ + √(Φ² − λ̄²)) = ${fmt(chi, 4)}`);
  steps.push(`M_cho phép = χ_LT·W·[σ] = ${fmt(chi, 4)}·${fmt(W, 0)}·${allow} = ${fmt(Mrd, 2)} kN·m ${util <= 1 ? '≥' : '<'} |M|max = ${fmt(Math.abs(Mmax), 2)} kN·m (${fmt(util * 100, 1)}%)`);
  steps.push(`Hệ số an toàn ổn định uốn – xoắn (đàn hồi): n = M_cr/|M|max = ${fmt(alpha, 3)}`);

  return {
    applicable: true, Mmax, xMax, Mcr, alpha, Iw: lp.Iw, It: sec.torsion.J, Iweak: sec.Iy, W, lambdaLT: lam, curve, chi, Mrd, Mel,
    util, ok: util <= 1, mode, betaY, steps, warnings,
  };
}

// ───────── Phương pháp tổng quát EN 1993-1-1 §6.3.4 ─────────

/** Đường cong uốn dọc quanh trục yếu z–z (EN 1993-1-1 bảng 6.2) */
const FLEX_CURVES: Record<LtbCurve, number> = { a: 0.21, b: 0.34, c: 0.49, d: 0.76 };
const chiOf = (alpha: number, lam: number) => {
  const Phi = 0.5 * (1 + alpha * (lam - 0.2) + lam * lam);
  return Math.min(1, 1 / (Phi + Math.sqrt(Math.max(Phi * Phi - lam * lam, 0))));
};

export interface OpResult {
  applicable: boolean;
  reason?: string;
  /** hệ số tải đến bền mặt cắt (trong mặt phẳng) và vị trí, nội lực tại đó */
  alphaUlt: number;
  xUlt: number;
  NUlt: number;
  MUlt: number;
  A: number;
  W: number;
  /** hệ số tới hạn ngoài mặt phẳng (uốn ngang + uốn – xoắn, có cả N và M) */
  alphaCrOp: number;
  lambdaOp: number;
  curveZ: LtbCurve;
  chiZ: number;
  curveLT: LtbCurve;
  chiLT: number;
  chiOp: number;
  util: number;
  ok: boolean;
  mode: { x: number; u: number; phi: number }[];
  steps: string[];
  warnings: string[];
}

const NAop = (reason: string): OpResult => ({
  applicable: false, reason, alphaUlt: 0, xUlt: 0, NUlt: 0, MUlt: 0, A: 0, W: 0, alphaCrOp: 0, lambdaOp: 0, curveZ: 'c', chiZ: 1, curveLT: 'd', chiLT: 1,
  chiOp: 1, util: 0, ok: true, mode: [], steps: [], warnings: [],
});

/**
 * Phương pháp tổng quát cho thanh khung (EN 1993-1-1 §6.3.4):
 *   α_ult,k = 1 / max[N/(A·f_y) + |M|/(W·f_y)] từ nội lực trong mặt phẳng (nên dùng phân tích bậc hai P-Δ);
 *   α_cr,op — trị riêng ngoài mặt phẳng với cả N(x) và M(x) của thanh (uốn ngang quanh trục yếu và uốn – xoắn);
 *   λ̄_op = √(α_ult,k/α_cr,op); χ_op = min(χ_z(λ̄_op), χ_LT(λ̄_op)) (6.3.4(4)a);
 *   điều kiện χ_op·α_ult,k ≥ f_y/[σ] (dùng [σ] thay cho f_y/γ_M1) → hệ số sử dụng f_y/([σ]·χ_op·α_ult,k).
 * Tiết diện loại 4 dùng A_eff, W_eff.
 */
export function checkFrameMemberOp(model: FrameModel, res: FrameResult, memberId: string, opt: FrameLtbOptions, fy: number, stiffenerSpacing = 0): OpResult {
  if (!res.ok) return NAop('Chưa có kết quả tính khung.');
  const mr = res.members.find((m) => m.id === memberId);
  const fm = model.members.find((m) => m.id === memberId);
  if (!mr || !fm) return NAop('Không tìm thấy thanh.');
  const sec = mr.section;
  const lp = sec.ltb;
  if (!lp) return NAop('Chưa hỗ trợ mặt cắt này (đa giác tự do hoặc thép hình xoay 90°).');
  const mat = mr.material;
  const E = mat.E * 1e9, G = E / (2 * (1 + mat.nu));
  const EIy = E * sec.Iy * 1e-12, GIt = G * sec.torsion.J * 1e-12, EIw = E * lp.Iw * 1e-18;
  if (!(GIt > 0)) return NAop('Không xác định được độ cứng xoắn của mặt cắt.');
  let Pmax = 0, Mabs = 0, Mmax = 0, xMax = 0;
  for (const q of mr.samples) {
    Pmax = Math.max(Pmax, -q.N);
    if (Math.abs(q.M) > Mabs) { Mabs = Math.abs(q.M); Mmax = q.M; xMax = q.s; }
  }
  if (!(Pmax > 1e-9) && !(Mabs > 1e-9)) return NAop('Thanh không chịu nén hoặc uốn.');
  const restraints = memberRestraints(model, fm, mr.L, opt);
  if (!restraints.length) return NAop('Thanh không có liên kết chống xoắn.');
  const warnings: string[] = [];
  // α_ult,k (bền mặt cắt, đàn hồi; loại 4 dùng A_eff, W_eff)
  const Wel = sec.Iz / Math.max(sec.yMax, -sec.yMin);
  const Aeff = aeffIfClass4(mr.sectionSpec, mat, fy, stiffenerSpacing);
  const WeffP = weffZ(mr.sectionSpec, mat, fy, 1, stiffenerSpacing), WeffN = weffZ(mr.sectionSpec, mat, fy, -1, stiffenerSpacing);
  let uMax = 0, xUlt = 0, NUlt = 0, MUlt = 0, AUse = sec.A, WUse = Wel;
  for (const q of mr.samples) {
    const A = q.N < 0 && Aeff ? Aeff : sec.A;
    const W = q.M > 0 ? Math.min(Wel, WeffP ?? Wel) : q.M < 0 ? Math.min(Wel, WeffN ?? Wel) : Wel;
    const u = (Math.abs(q.N) * 1e3) / (A * fy) + (Math.abs(q.M) * 1e6) / (W * fy);
    if (u > uMax) { uMax = u; xUlt = q.s; NUlt = q.N; MUlt = q.M; AUse = A; WUse = W; }
  }
  if (!(uMax > 0)) return NAop('Thanh không có nội lực.');
  const alphaUlt = 1 / uMax;
  // α_cr,op
  const L = mr.L;
  const Ncrz = (Math.PI ** 2 * EIy) / (L * L);
  const Mcr0 = Ncrz * Math.sqrt(EIw / EIy + (L * L * GIt) / (Math.PI ** 2 * EIy));
  const alpha0 = Math.min(Mabs > 1e-9 ? Mcr0 / (Mabs * 1e3) : Infinity, Pmax > 1e-9 ? Ncrz / (Pmax * 1e3) : Infinity);
  const pb: LtbProblem = {
    L, spec: mr.sectionSpec, sec, material: mat, M: (x) => mr.internalAt(x, 'right').M, N: (x) => mr.internalAt(x, 'right').N,
    keyPoints: [...mr.keyS, ...restraints.map((r) => r.x)], Mmax, xMax,
    dists: mr.dists, points: mr.actions.filter((a) => a.source === 'load' && a.Fy).map((a) => ({ x: a.x, Fy: a.Fy })),
    restraints, braced: (opt.braces[memberId] ?? 0) > 0, opt: { loadHeight: opt.loadHeight, curve: opt.curve, braces: [], fy, stiffenerSpacing },
  };
  const eg = outOfPlaneEigen(pb, alpha0, true);
  if (!eg) return NAop('Không tìm được hệ số tới hạn ngoài mặt phẳng (thanh không có liên kết chống xoắn hoặc chịu kéo thuần).');
  const alphaCrOp = eg.alpha;
  const lambdaOp = Math.sqrt(alphaUlt / alphaCrOp);
  const curveZ: LtbCurve = lp.closed ? 'c' : lp.rolled && lp.hOverB > 1.2 ? 'b' : 'c';
  const curveLT: LtbCurve = opt.curve !== 'auto' ? opt.curve : lp.rolled ? (lp.hOverB <= 2 ? 'a' : 'b') : (lp.hOverB <= 2 ? 'c' : 'd');
  const chiZ = chiOf(FLEX_CURVES[curveZ], lambdaOp);
  const chiLT = Mabs > 1e-9 && sec.Iz > sec.Iy * 1.0001 ? chiOf(LTB_CURVES[curveLT], lambdaOp) : 1;
  const chiOp = Math.min(chiZ, chiLT);
  const allow = mat.allowable;
  const util = fy / (allow * chiOp * alphaUlt);
  if (lp.closed) warnings.push('Mặt cắt kín: mất ổn định ngoài mặt phẳng chủ yếu là uốn dọc quanh trục yếu.');
  const f = fmt;
  const steps = [
    `Nội lực trong mặt phẳng: mặt cắt bất lợi x = ${f(xUlt, 3)} m, N = ${f(NUlt, 2)} kN, M = ${f(MUlt, 2)} kN·m; A = ${f(AUse, 0)} mm², W = ${f(WUse, 0)} mm³${AUse < sec.A || WUse < Wel ? ' (tiết diện hữu hiệu)' : ''}`,
    `α_ult,k = 1/[|N|/(A·f_y) + |M|/(W·f_y)] = 1/(${f((Math.abs(NUlt) * 1e3) / (AUse * fy), 4)} + ${f((Math.abs(MUlt) * 1e6) / (WUse * fy), 4)}) = ${f(alphaUlt, 4)} (f_y = ${fy} MPa)`,
    `α_cr,op: bài toán trị riêng ngoài mặt phẳng với N(x) và M(x) thực của thanh — K_G gồm ∫M·u″φ, ½∫N[u′² − 2y₀u′φ′ + r₀²φ′²]${lp.monosym ? ', Wagner ½∫−Mβ_yφ′²' : ''}${opt.loadHeight !== 'sc' ? ', tải ngang lệch tâm cắt' : ''} → α_cr,op = ${f(alphaCrOp, 4)}`,
    `Tham khảo: N_cr,z = π²EI_y/L² = ${f(Ncrz / 1e3, 1)} kN${Pmax > 0 ? ` (α = ${f(Ncrz / (Pmax * 1e3), 3)} nếu chỉ nén)` : ''}${Mabs > 0 ? `; M_cr,0 = ${f(Mcr0 / 1e3, 1)} kN·m` : ''}`,
    `λ̄_op = √(α_ult,k/α_cr,op) = √(${f(alphaUlt, 4)}/${f(alphaCrOp, 4)}) = ${f(lambdaOp, 4)}`,
    `χ_z (đường cong ${curveZ}, α = ${FLEX_CURVES[curveZ]}) = ${f(chiZ, 4)}; χ_LT (đường cong ${curveLT}, α_LT = ${LTB_CURVES[curveLT]}) = ${chiLT === 1 && !(Mabs > 1e-9) ? '1 (không uốn)' : f(chiLT, 4)} → χ_op = min = ${f(chiOp, 4)}`,
    `Điều kiện χ_op·α_ult,k ≥ f_y/[σ]: ${f(chiOp * alphaUlt, 4)} ${util <= 1 ? '≥' : '<'} ${f(fy / allow, 4)} → hệ số sử dụng ${f(util * 100, 1)}%`,
  ];
  return {
    applicable: true, alphaUlt, xUlt, NUlt, MUlt, A: AUse, W: WUse, alphaCrOp, lambdaOp, curveZ, chiZ, curveLT, chiLT, chiOp,
    util, ok: util <= 1, mode: eg.mode, steps, warnings,
  };
}
