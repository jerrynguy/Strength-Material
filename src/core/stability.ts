/**
 * Ổn định thanh thẳng chịu nén đúng tâm.
 *
 *  - Độ mảnh λ = μ·L / i, i = √(I/A)
 *  - λ ≥ λ₀: công thức Euler  σ_th = π²E/λ², P_th = π²EI/(μL)²
 *  - λ₁ ≤ λ < λ₀: công thức thực nghiệm Iasinski  σ_th = a − b·λ (gang: a − bλ + cλ²)
 *  - λ < λ₁: thanh ngắn, σ_th = σ_ch (tính theo bền)
 *  - Điều kiện ổn định theo hệ số giảm ứng suất cho phép: σ = N/A ≤ φ·[σ]
 *  - Điều kiện theo hệ số an toàn: n_ôđ = P_th / N ≥ [n_ôđ]
 *
 * Bảng φ(λ) và các hệ số a, b lấy theo bảng tra thường dùng trong giáo trình SBVL ở Việt Nam
 * (giá trị tham khảo — có thể sửa trực tiếp trên giao diện).
 */
import { analyze } from './analysis';
import type { SectionProps } from './section';
import { densityOf, selfWeightPerM, type Material, type Model, type SectionSpec, type Support } from './types';

export type BucklingMaterial = 'CT3' | 'castIron' | 'wood';

export interface BucklingParams {
  label: string;
  /** Bảng φ theo λ (λ = 0, 10, 20, ...) */
  phi: number[];
  lambda0: number;
  a: number; // MPa
  b: number; // MPa
  c: number; // MPa (chỉ gang)
  /** Giới hạn chảy (MPa) — 0 nếu không có */
  sigmaY: number;
}

export const BUCKLING_MATERIALS: Record<BucklingMaterial, BucklingParams> = {
  CT3: {
    label: 'Thép CT3 (thép số 2, 3, 4)',
    phi: [1.0, 0.99, 0.96, 0.94, 0.92, 0.89, 0.86, 0.81, 0.75, 0.69, 0.6, 0.52, 0.45, 0.4, 0.36, 0.32, 0.29, 0.26, 0.23, 0.21, 0.19],
    lambda0: 100, a: 310, b: 1.14, c: 0, sigmaY: 240,
  },
  castIron: {
    label: 'Gang',
    phi: [1.0, 0.97, 0.91, 0.81, 0.69, 0.57, 0.44, 0.34, 0.26, 0.2, 0.16],
    lambda0: 80, a: 776, b: 12, c: 0.053, sigmaY: 0,
  },
  wood: {
    label: 'Gỗ',
    phi: [1.0, 0.99, 0.97, 0.93, 0.87, 0.8, 0.71, 0.6, 0.48, 0.38, 0.31, 0.25, 0.22, 0.18, 0.16, 0.14, 0.12, 0.11, 0.1, 0.09, 0.08],
    lambda0: 110, a: 29.3, b: 0.194, c: 0, sigmaY: 0,
  },
};

export interface EndCondition {
  key: string;
  label: string;
  mu: number;
}

export const END_CONDITIONS: EndCondition[] = [
  { key: 'pp', label: 'Khớp – khớp (μ = 1)', mu: 1 },
  { key: 'fp', label: 'Ngàm – khớp (μ = 0.7)', mu: 0.7 },
  { key: 'ff', label: 'Ngàm – ngàm (μ = 0.5)', mu: 0.5 },
  { key: 'f0', label: 'Ngàm – tự do (μ = 2)', mu: 2 },
  { key: 'fs', label: 'Ngàm – ngàm trượt ngang (μ = 1)', mu: 1 },
];

/** φ(λ) nội suy tuyến tính trong bảng; ngoài bảng trả về null */
export function phiOf(p: BucklingParams, lambda: number): number | null {
  if (lambda < 0) return 1;
  const max = (p.phi.length - 1) * 10;
  if (lambda > max) return null;
  const i = Math.min(Math.floor(lambda / 10), p.phi.length - 2);
  const t = (lambda - i * 10) / 10;
  return p.phi[i] + (p.phi[i + 1] - p.phi[i]) * t;
}

export type Regime = 'euler' | 'empirical' | 'short';

/** Ứng suất tới hạn (MPa) theo λ */
export function criticalStress(p: BucklingParams, E: number, lambda: number): { sigma: number; regime: Regime } {
  if (lambda >= p.lambda0) return { sigma: (Math.PI ** 2 * E) / (lambda * lambda), regime: 'euler' };
  const emp = p.a - p.b * lambda + p.c * lambda * lambda;
  if (p.sigmaY > 0 && emp >= p.sigmaY) return { sigma: p.sigmaY, regime: 'short' };
  return { sigma: emp, regime: 'empirical' };
}

export function lambda1(p: BucklingParams): number {
  if (!(p.sigmaY > 0) || p.c) return 0;
  return Math.max(0, (p.a - p.sigmaY) / p.b);
}

export interface PlaneResult {
  plane: string;
  mu: number;
  L: number; // m
  I: number; // mm⁴
  i: number; // mm
  lambda: number;
}

export interface StabilityInput {
  /** Lực nén (kN, dương) */
  N: number;
  /** Chiều dài tính toán theo hai mặt phẳng (m) */
  Lz: number;
  Ly: number;
  muZ: number;
  muY: number;
  /** E (GPa) */
  E: number;
  allowable: number; // MPa
  params: BucklingParams;
  /** Hệ số an toàn ổn định yêu cầu */
  nRequired: number;
  /** Diện tích hữu hiệu (tiết diện loại 4) — dùng thay A khi tính σ = N/A */
  Aeff?: number;
}

export interface StabilityResult {
  planes: PlaneResult[];
  governing: PlaneResult;
  lambdaMax: number;
  principal: boolean;
  regime: Regime;
  sigmaCr: number; // MPa
  Pcr: number; // kN
  nActual: number;
  phi: number | null;
  sigma: number; // MPa = N/A
  allowPhi: number; // φ[σ]
  okPhi: boolean;
  okN: boolean;
  /** Tải trọng cho phép theo điều kiện φ (kN) */
  Nallow: number;
  steps: string[];
  warnings: string[];
}

const f = (v: number, d = 3) => (Number.isFinite(v) ? (Math.abs(v) >= 1e6 ? v.toExponential(4) : (+v.toFixed(d)).toString()) : '—');

export function checkStability(sec: SectionProps, inp: StabilityInput): StabilityResult {
  const warnings: string[] = [];
  const steps: string[] = [];
  const A = sec.A;
  const E = inp.E * 1e3; // MPa
  // Mặt cắt không đối xứng (thép góc...): dùng trục quán tính chính nếu hai mặt phẳng có cùng μL
  const sameLen = Math.abs(inp.muZ * inp.Lz - inp.muY * inp.Ly) < 1e-9;
  let planes: PlaneResult[];
  let principal = false;
  if (sec.Iyz !== 0 && sameLen) {
    const avg = (sec.Iz + sec.Iy) / 2;
    const R = Math.hypot((sec.Iz - sec.Iy) / 2, sec.Iyz);
    const Imax = avg + R, Imin = avg - R;
    principal = true;
    planes = [
      { plane: 'trục chính u (I_max)', mu: inp.muZ, L: inp.Lz, I: Imax, i: Math.sqrt(Imax / A), lambda: 0 },
      { plane: 'trục chính v (I_min)', mu: inp.muZ, L: inp.Lz, I: Imin, i: Math.sqrt(Imin / A), lambda: 0 },
    ];
    steps.push(`Mặt cắt không đối xứng: I_max,min = (Iz + Iy)/2 ± √(((Iz − Iy)/2)² + Iyz²) = ${f(Imax, 0)} ; ${f(Imin, 0)} mm⁴`);
  } else {
    if (sec.Iyz !== 0) warnings.push('Mặt cắt không đối xứng nhưng chiều dài tính toán hai phương khác nhau — đang dùng trục hình học (gần đúng).');
    planes = [
      { plane: 'uốn quanh trục z (trong mặt phẳng đứng)', mu: inp.muZ, L: inp.Lz, I: sec.Iz, i: Math.sqrt(sec.Iz / A), lambda: 0 },
      { plane: 'uốn quanh trục y (ngoài mặt phẳng)', mu: inp.muY, L: inp.Ly, I: sec.Iy, i: Math.sqrt(sec.Iy / A), lambda: 0 },
    ];
  }
  for (const p of planes) {
    p.lambda = (p.mu * p.L * 1e3) / p.i;
    steps.push(`${p.plane}: i = √(I/A) = √(${f(p.I, 0)}/${f(A, 1)}) = ${f(p.i, 2)} mm; λ = μL/i = ${p.mu}·${f(p.L * 1e3, 1)}/${f(p.i, 2)} = ${f(p.lambda, 2)}`);
  }
  const governing = planes.reduce((a, b) => (b.lambda > a.lambda ? b : a));
  const lambdaMax = governing.lambda;
  const { sigma: sigmaCr, regime } = criticalStress(inp.params, E, lambdaMax);
  const l1 = lambda1(inp.params);
  steps.push(`λ_max = ${f(lambdaMax, 2)} (${governing.plane}); λ₀ = ${inp.params.lambda0}${l1 ? `, λ₁ = ${f(l1, 1)}` : ''}`);
  if (regime === 'euler') steps.push(`λ ≥ λ₀ → thanh mảnh, dùng Euler: σ_th = π²E/λ² = π²·${f(E, 0)}/${f(lambdaMax, 2)}² = ${f(sigmaCr, 2)} MPa`);
  else if (regime === 'empirical')
    steps.push(`λ < λ₀ → dùng công thức Iasinski: σ_th = a − bλ${inp.params.c ? ' + cλ²' : ''} = ${inp.params.a} − ${inp.params.b}·${f(lambdaMax, 2)}${inp.params.c ? ` + ${inp.params.c}·${f(lambdaMax, 2)}²` : ''} = ${f(sigmaCr, 2)} MPa`);
  else steps.push(`λ < λ₁ → thanh ngắn, mất ổn định không xảy ra trước khi chảy: σ_th = σ_ch = ${f(sigmaCr, 1)} MPa`);
  const Pcr = (sigmaCr * A) / 1e3;
  steps.push(`P_th = σ_th·A = ${f(sigmaCr, 2)}·${f(A, 1)} = ${f(Pcr, 2)} kN`);
  const nActual = inp.N > 0 ? Pcr / inp.N : Infinity;
  steps.push(`n_ôđ = P_th/N = ${f(Pcr, 2)}/${f(inp.N, 2)} = ${f(nActual, 3)} ${nActual >= inp.nRequired ? '≥' : '<'} [n_ôđ] = ${inp.nRequired}`);
  const phi = phiOf(inp.params, lambdaMax);
  const Ause = inp.Aeff && inp.Aeff < A ? inp.Aeff : A;
  if (Ause < A) steps.push(`Tiết diện loại 4 khi nén: dùng diện tích hữu hiệu A_eff = ${f(Ause, 1)} mm² (A = ${f(A, 1)} mm²)`);
  const sigma = (inp.N * 1e3) / Ause;
  const allowPhi = phi !== null ? phi * inp.allowable : 0;
  if (phi === null) warnings.push(`λ = ${f(lambdaMax, 1)} vượt ngoài bảng φ (λ ≤ ${(inp.params.phi.length - 1) * 10}) — thanh quá mảnh, không nên dùng.`);
  else {
    steps.push(`Tra bảng φ(λ = ${f(lambdaMax, 2)}) = ${f(phi, 4)} (nội suy tuyến tính)`);
    steps.push(`σ = N/${Ause < A ? 'A_eff' : 'A'} = ${f(inp.N * 1e3, 0)}/${f(Ause, 1)} = ${f(sigma, 2)} MPa ${sigma <= allowPhi ? '≤' : '>'} φ[σ] = ${f(phi, 4)}·${inp.allowable} = ${f(allowPhi, 2)} MPa`);
  }
  return {
    planes, governing, lambdaMax, principal, regime, sigmaCr, Pcr, nActual, phi, sigma, allowPhi,
    okPhi: phi !== null && sigma <= allowPhi + 1e-9,
    okN: nActual >= inp.nRequired,
    Nallow: (allowPhi * Ause) / 1e3,
    steps, warnings,
  };
}

/** Thử dần chọn tiết diện theo φ (cách làm trong giáo trình): φ₀ = 0.5 → A_yc → chọn → φ′ → φ₁ = (φ₀ + φ′)/2 ... */
export function trialDesign(
  candidates: { name: string; sec: SectionProps }[],
  inpBase: StabilityInput,
  /** lực nén tương đương theo từng tiết diện (vd. có kể trọng lượng bản thân) */
  nFor?: (c: { name: string; sec: SectionProps }) => number,
): { steps: string[]; chosen: string | null } {
  const inpOf = (c: { name: string; sec: SectionProps }) => (nFor ? { ...inpBase, N: nFor(c) } : inpBase);
  let inp = inpBase;
  const steps: string[] = [];
  const sorted = [...candidates].sort((a, b) => a.sec.A - b.sec.A);
  let phi0 = 0.5;
  let pick: (typeof sorted)[number] | undefined;
  for (let it = 1; it <= 12; it++) {
    const Areq = (inp.N * 1e3) / (phi0 * inp.allowable);
    let idx = sorted.findIndex((c) => c.sec.A >= Areq);
    if (idx < 0) idx = sorted.length - 1;
    pick = sorted[idx];
    inp = inpOf(pick);
    let r = checkStability(pick.sec, inp);
    const head = `Lần ${it}: φ = ${f(phi0, 3)} → A_yc = N/(φ[σ]) = ${f(Areq, 1)} mm² → chọn ${pick.name} (A = ${f(pick.sec.A, 1)} mm²) → λ = ${f(r.lambdaMax, 1)}`;
    if (r.phi === null) {
      // quá mảnh: tăng dần đến khi λ nằm trong bảng φ
      let j = idx + 1;
      while (j < sorted.length && checkStability(sorted[j].sec, inpOf(sorted[j])).phi === null) j++;
      if (j >= sorted.length) {
        steps.push(`${head} vượt bảng φ (thanh quá mảnh); mọi số hiệu lớn hơn cũng vượt bảng.`);
        steps.push('Không có tiết diện nào trong họ thoả điều kiện ổn định — hãy giảm chiều dài tính toán (thêm giằng) hoặc chọn họ có bán kính quán tính lớn hơn (ống, hộp, H rộng bản).');
        return { steps, chosen: null };
      }
      pick = sorted[j];
      inp = inpOf(pick);
      r = checkStability(pick.sec, inp);
      steps.push(`${head} vượt bảng φ → tăng lên ${pick.name} (λ = ${f(r.lambdaMax, 1)}, φ′ = ${f(r.phi ?? 0, 3)})`);
    } else {
      steps.push(`${head}, φ′ = ${f(r.phi, 3)}; σ = ${f(r.sigma, 1)} MPa so với φ′[σ] = ${f(r.allowPhi, 1)} MPa`);
    }
    const phi1 = r.phi ?? 0;
    if (Math.abs(phi1 - phi0) <= 0.02 || (it > 1 && r.okPhi && Math.abs(phi1 - phi0) <= 0.05)) break;
    phi0 = (phi0 + phi1) / 2;
  }
  if (!pick) return { steps, chosen: null };
  // Kiểm tra lại và tăng dần nếu chưa đạt
  let idx = sorted.indexOf(pick);
  while (idx < sorted.length && !checkStability(sorted[idx].sec, inpOf(sorted[idx])).okPhi) idx++;
  if (idx >= sorted.length) {
    steps.push('Không có tiết diện nào trong họ thoả điều kiện ổn định.');
    return { steps, chosen: null };
  }
  if (sorted[idx] !== pick) steps.push(`${pick.name} chưa đạt → tăng lên ${sorted[idx].name}.`);
  const r = checkStability(sorted[idx].sec, inpOf(sorted[idx]));
  steps.push(`Kết luận: chọn ${sorted[idx].name}: σ = ${f(r.sigma, 2)} MPa ≤ φ[σ] = ${f(r.allowPhi, 2)} MPa (sử dụng ${f((r.sigma / r.allowPhi) * 100, 1)}%).`);
  return { steps, chosen: sorted[idx].name };
}

// ───────── Trọng lượng bản thân của cột ─────────

/** Liên kết hai đầu (chân tại x = 0, đỉnh tại x = L) ứng với các giá trị μ chuẩn */
type EndKind = { base: 'pin' | 'fixed'; top: 'free' | 'pin' | 'slide' | 'sway' };
function endsFromMu(mu: number): EndKind | null {
  const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
  if (near(mu, 1)) return { base: 'pin', top: 'pin' };
  if (near(mu, 0.7)) return { base: 'fixed', top: 'pin' };
  if (near(mu, 0.5)) return { base: 'fixed', top: 'slide' };
  if (near(mu, 2)) return { base: 'fixed', top: 'free' };
  return null;
}

export interface SelfWeightPlane {
  plane: 'z' | 'y';
  mu: number;
  exact: boolean;
  /** hệ số tới hạn của tổ hợp (N đỉnh + G) */
  alpha: number | null;
  /** lực tới hạn Euler khi chỉ có lực ở đỉnh (kN) */
  NcrTop: number;
  /** lực nén tương đương đặt ở đỉnh (kN) */
  Ntd: number;
}

export interface SelfWeightResult {
  /** trọng lượng cột (kN) */
  G: number;
  q: number; // kN/m
  /** lực nén tại chân = N + G */
  Nbase: number;
  /** lực nén tương đương dùng cho kiểm tra ổn định (kN) */
  Ntd: number;
  planes: SelfWeightPlane[];
  steps: string[];
}

/**
 * Cột chịu lực N ở đỉnh và trọng lượng bản thân phân bố đều (lực dọc tăng dần về chân).
 * Hệ số tới hạn α tính bằng bài toán trị riêng (phần tử hữu hạn) với liên kết ứng với μ chuẩn;
 * quy về lực tương đương ở đỉnh: N_tđ = N_th,đỉnh / α (cùng hệ số an toàn với tổ hợp thực).
 * μ không chuẩn hoặc chiều dài tính toán khác nhau giữa hai phương: N_tđ = N + G (thiên về an toàn).
 */
export function selfWeightColumn(
  spec: SectionSpec, sec: SectionProps, mat: Material,
  o: { N: number; L: number; Ly: number; sameL: boolean; muZ: number; muY: number },
): SelfWeightResult {
  const q = selfWeightPerM(mat, sec.A);
  const G = q * o.L;
  const steps: string[] = [`Trọng lượng bản thân: q = ρ·g·A = ${f(densityOf(mat), 0)}·9.81·${f(sec.A, 1)}·10⁻⁶ = ${f(q, 4)} kN/m; G = q·L = ${f(G, 3)} kN`];
  steps.push(`Lực nén tại chân cột N + G = ${f(o.N + G, 3)} kN (dùng kiểm tra bền và ổn định cục bộ)`);
  const E = mat.E * 1e9;
  const planes: SelfWeightPlane[] = [];
  const ez = endsFromMu(o.muZ), ey = endsFromMu(o.muY);
  const canExact = !!(ez && ey) && o.sameL;
  let alphas: { z: number | null; y: number | null } = { z: null, y: null };
  if (canExact && G > 0) {
    const rBase = (k: EndKind) => ({ trans: true, rot: k.base === 'fixed' });
    const rTop = (k: EndKind) => ({ trans: k.top === 'pin' || k.top === 'slide', rot: k.top === 'slide' || k.top === 'sway' });
    const bz = rBase(ez!), by = rBase(ey!), tz = rTop(ez!), ty = rTop(ey!);
    const base: Support = { id: 'b', name: 'Chân', x: 0, kind: 'custom', restraints: { ux: true, uy: bz.trans, uz: by.trans, rx: true, ry: by.rot, rz: bz.rot } };
    const top: Support = { id: 't', name: 'Đỉnh', x: o.L, kind: 'custom', restraints: { ux: false, uy: tz.trans, uz: ty.trans, rx: false, ry: ty.rot, rz: tz.rot } };
    const model: Model = {
      title: '', length: o.L, material: mat, section: spec, hinges: [],
      supports: [base, top].filter((s) => Object.values(s.restraints).some(Boolean)),
      loads: [
        ...(o.N > 0 ? [{ id: 'N', type: 'force' as const, name: 'N', x: o.L, Fx: -o.N, Fy: 0, Fz: 0 }] : []),
        { id: 'g', type: 'distributed' as const, name: 'g', x1: 0, x2: o.L, dir: 'x' as const, q1: -q, q2: -q },
      ],
    };
    const r = analyze(model, { buckling: true });
    alphas = { z: r.buckling.bendY?.alpha ?? null, y: r.buckling.bendZ?.alpha ?? null };
  }
  for (const [plane, mu, I, Lp] of [['z', o.muZ, sec.Iz, o.L], ['y', o.muY, sec.Iy, o.sameL ? o.L : o.Ly]] as const) {
    const NcrTop = (Math.PI ** 2 * E * I * 1e-12) / (mu * Lp) ** 2 / 1e3;
    const alpha = plane === 'z' ? alphas.z : alphas.y;
    const exact = canExact && alpha !== null && G > 0;
    const Ntd = G <= 0 ? o.N : exact ? NcrTop / alpha! : o.N + G;
    planes.push({ plane, mu, exact, alpha: exact ? alpha : null, NcrTop, Ntd });
    if (G > 0) {
      steps.push(exact
        ? `Phương ${plane === 'z' ? 'uốn quanh z' : 'uốn quanh y'} (μ = ${mu}): bài toán trị riêng với N ở đỉnh + G phân bố → α_th = ${f(alpha!, 4)}; N_th,đỉnh = π²EI/(μL)² = ${f(NcrTop, 2)} kN → N_tđ = N_th,đỉnh/α_th = ${f(Ntd, 3)} kN (tương đương N + ${f((Ntd - o.N) / G, 3)}·G)`
        : `Phương ${plane === 'z' ? 'uốn quanh z' : 'uốn quanh y'} (μ = ${mu}): liên kết không thuộc dạng chuẩn hoặc có giằng → lấy N_tđ = N + G = ${f(Ntd, 3)} kN (thiên về an toàn)`);
    }
  }
  const Ntd = Math.max(...planes.map((p) => p.Ntd));
  if (G > 0) steps.push(`Lực nén tương đương dùng kiểm tra ổn định: N_tđ = ${f(Ntd, 3)} kN`);
  return { G, q, Nbase: o.N + G, Ntd, planes, steps };
}
