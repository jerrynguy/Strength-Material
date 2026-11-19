/**
 * Kiểm tra thanh chịu nén – uốn đồng thời (uốn dọc – uốn ngang).
 *
 * Ba cách kiểm tra (đều hiển thị để đối chiếu):
 *  (1) Bền theo phân tích bậc hai (P-Δ) với tải trọng thực:  σ_max = N/A + M_II/W ≤ [σ]
 *  (2) Theo giáo trình SBVL: vì quan hệ tải – ứng suất phi tuyến, kiểm tra với tải tăng n lần
 *      (n = hệ số an toàn, thường σ_ch/[σ]):  σ_max(n·tải) ≤ σ_ch
 *  (3) Công thức tương tác gần đúng (thiên về an toàn):
 *      N/(φ_min·A) + M_z/(W_z(1 − N/N_th,z)) + M_y/(W_y(1 − N/N_th,y)) ≤ [σ]
 * Lực tới hạn N_th từng mặt phẳng lấy từ bài toán trị riêng (đúng với mọi liên kết),
 * từ đó suy ra μ tương đương và độ mảnh λ.
 */
import { analyze } from './analysis';
import { aeffIfClass4, weffZ } from './effective';
import { analyzeFrame, type FrameModel, type FrameResult } from './frame';
import type { SectionProps } from './section';
import { phiOf, type BucklingParams } from './stability';
import { fmt, maxNormalOnSection } from './stress';
import type { InternalForces, Model } from './types';

export interface PlaneBC {
  key: 'z' | 'y';
  label: string;
  /** Lực tới hạn (kN) hoặc null nếu không xác định */
  Ncr: number | null;
  mu: number | null;
  lambda: number | null;
  /** Mô men lớn nhất bậc một / bậc hai (kN·m) */
  M1: number;
  M2: number;
  W: number; // mm³
}

export interface BeamColumnResult {
  Nc: number;
  planes: PlaneBC[];
  sigma1: number;
  sigma2: number | null;
  ok2: boolean;
  n: number;
  sigmaY: number;
  sigmaN: number | null;
  okN: boolean;
  phi: number | null;
  lambdaMax: number | null;
  sigmaInter: number | null;
  okInter: boolean;
  allowable: number;
  steps: string[];
  errors: string[];
}

const W = (I: number, cmax: number) => I / Math.max(cmax, 1e-9);
const maxAbs = (vals: number[]) => vals.reduce((a, v) => (Math.abs(v) > Math.abs(a) ? v : a), 0);

function sigmaMax(sec: SectionProps, list: InternalForces[]): number {
  let s = 0;
  for (const F of list) {
    const m = maxNormalOnSection(sec, F);
    const v = Math.abs(m.max) > Math.abs(m.min) ? m.max : m.min;
    if (Math.abs(v) > Math.abs(s)) s = v;
  }
  return Math.abs(s);
}

interface CoreInput {
  sec: SectionProps;
  E: number; // GPa
  allowable: number;
  params: BucklingParams;
  n: number;
  Nc: number;
  planes: PlaneBC[];
  sigma1: number;
  sigma2: number | null;
  sigmaN: number | null;
  errors: string[];
  /** Tiết diện loại 4 */
  Aeff?: number;
}

function finish(c: CoreInput): BeamColumnResult {
  const { sec, Nc, planes } = c;
  const steps: string[] = [];
  const Emp = c.E * 1e3;
  for (const p of planes) {
    if (p.Ncr && p.Ncr > 0) {
      p.lambda = Math.PI * Math.sqrt((Emp * sec.A) / (p.Ncr * 1e3));
    }
  }
  steps.push(`Lực nén lớn nhất N = ${fmt(Nc, 2)} kN; A = ${fmt(sec.A, 1)} mm²`);
  for (const p of planes) {
    steps.push(
      `${p.label}: N_th = ${p.Ncr ? fmt(p.Ncr, 1) + ' kN' : '—'}${p.mu ? `, μ tương đương = ${fmt(p.mu, 3)}` : ''}${p.lambda ? `, λ = π√(EA/N_th) = ${fmt(p.lambda, 1)}` : ''}; ` +
        `M_I = ${fmt(p.M1, 3)} kN·m → M_II = ${fmt(p.M2, 3)} kN·m${p.M1 ? ` (khuếch đại ×${fmt(p.M2 / p.M1, 3)}` + (p.Ncr ? `, lý thuyết 1/(1 − N/N_th) = ${fmt(1 / (1 - Nc / p.Ncr), 3)})` : ')') : ''}`,
    );
  }
  const ok2 = c.sigma2 !== null && c.sigma2 <= c.allowable;
  steps.push(`(1) Phân tích bậc nhất: σ_max = ${fmt(c.sigma1, 2)} MPa; bậc hai (P-Δ): σ_max = ${c.sigma2 === null ? '—' : fmt(c.sigma2, 2)} MPa ${ok2 ? '≤' : '>'} [σ] = ${c.allowable} MPa`);
  const sigmaY = c.params.sigmaY > 0 ? c.params.sigmaY : c.n * c.allowable;
  const okN = c.sigmaN !== null && c.sigmaN <= sigmaY;
  steps.push(`(2) Tải tăng n = ${c.n} lần, phân tích bậc hai: σ_max = ${c.sigmaN === null ? 'mất ổn định' : fmt(c.sigmaN, 2) + ' MPa'} ${okN ? '≤' : '>'} σ_ch = ${sigmaY} MPa`);
  const lams = planes.map((p) => p.lambda).filter((v): v is number => v !== null);
  const lambdaMax = lams.length ? Math.max(...lams) : null;
  const phi = lambdaMax !== null ? phiOf(c.params, lambdaMax) : null;
  let sigmaInter: number | null = null;
  if (phi !== null && planes.every((p) => !p.M1 || (p.Ncr && p.Ncr > Nc))) {
    const Ause = c.Aeff ?? sec.A;
    const parts: string[] = [`${fmt(Nc * 1e3, 0)}/(${fmt(phi, 3)}·${fmt(Ause, 1)}${c.Aeff ? ' [A_eff]' : ''})`];
    sigmaInter = (Nc * 1e3) / (phi * Ause);
    for (const p of planes) {
      if (!p.M1) continue;
      const amp = 1 - Nc / (p.Ncr as number);
      sigmaInter += (Math.abs(p.M1) * 1e6) / (p.W * amp);
      parts.push(`${fmt(Math.abs(p.M1) * 1e6, 0)}/(${fmt(p.W, 0)}·${fmt(amp, 4)})`);
    }
    steps.push(`(3) Tương tác: φ(λ_max = ${fmt(lambdaMax as number, 1)}) = ${fmt(phi, 3)}; σ = ${parts.join(' + ')} = ${fmt(sigmaInter, 2)} MPa ${sigmaInter <= c.allowable ? '≤' : '>'} [σ]`);
  } else {
    steps.push('(3) Tương tác: không áp dụng được (λ ngoài bảng φ hoặc N ≥ N_th).');
  }
  return {
    Nc, planes, sigma1: c.sigma1, sigma2: c.sigma2, ok2, n: c.n, sigmaY, sigmaN: c.sigmaN, okN, phi, lambdaMax,
    sigmaInter, okInter: sigmaInter !== null && sigmaInter <= c.allowable, allowable: c.allowable, steps, errors: c.errors,
  };
}

/** Kiểm tra cho chế độ thanh thẳng */
export function checkBeamColumn(model: Model, n: number, params: BucklingParams): BeamColumnResult | null {
  const r1 = analyze(model, { buckling: true });
  if (!r1.ok || !r1.section) return null;
  const sec = r1.section;
  let Nc = 0;
  for (const s of r1.forceSamples) Nc = Math.max(Nc, -s.N);
  if (!(Nc > 0)) return null;
  const errors: string[] = [];
  const r2 = analyze(model, { secondOrder: true });
  if (!r2.ok) errors.push(...r2.errors);
  const rn = analyze(model, { secondOrder: true, loadFactor: n });
  const L = model.length;
  const EIz = r1.rigidity.EIz, EIy = r1.rigidity.EIy;
  const mk = (key: 'z' | 'y', b: { alpha: number } | undefined, EI: number, I: number, comp: 'Mz' | 'My'): PlaneBC => {
    const Ncr = b ? b.alpha * Nc : null;
    return {
      key,
      label: key === 'z' ? 'Uốn quanh trục z (mặt phẳng đứng)' : 'Uốn quanh trục y (mặt phẳng ngang)',
      Ncr,
      mu: Ncr ? (Math.PI / L) * Math.sqrt(EI / (Ncr * 1e3)) : null,
      lambda: null,
      M1: Math.abs(maxAbs(r1.forceSamples.map((s) => s[comp]))),
      M2: r2.ok ? Math.abs(maxAbs(r2.forceSamples.map((s) => s[comp]))) : NaN,
      W: W(I, key === 'z' ? Math.max(sec.yMax, -sec.yMin) : Math.max(sec.zMax, -sec.zMin)),
    };
  };
  const planes = [
    mk('z', r1.buckling.bendY, EIz, sec.Iz, 'Mz'),
    mk('y', r1.buckling.bendZ, EIy, sec.Iy, 'My'),
  ];
  const Aeff = aeffIfClass4(model.section, model.material, 240);
  const Mz1 = maxAbs(r1.forceSamples.map((s) => s.Mz));
  const Wz = weffZ(model.section, model.material, 240, Math.sign(Mz1) || 1);
  if (Wz && Wz < planes[0].W) planes[0].W = Wz;
  return finish({
    sec, E: model.material.E, allowable: model.material.allowable, params, n, Nc, planes,
    sigma1: sigmaMax(sec, r1.forceSamples),
    sigma2: r2.ok ? sigmaMax(sec, r2.forceSamples) : null,
    sigmaN: rn.ok ? sigmaMax(sec, rn.forceSamples) : null,
    errors, Aeff,
  });
}

export interface FrameBCAnalyses {
  r1: FrameResult;
  r2: FrameResult;
  rn: FrameResult;
  n: number;
}

export function frameAnalyses(model: FrameModel, n: number): FrameBCAnalyses {
  return {
    r1: analyzeFrame(model, { buckling: true }),
    r2: analyzeFrame(model, { secondOrder: true }),
    rn: analyzeFrame(model, { secondOrder: true, loadFactor: n }),
    n,
  };
}

const toIF = (s: { N: number; Q: number; M: number }): InternalForces => ({ N: s.N, Qy: s.Q, Qz: 0, T: 0, Mz: s.M, My: 0 });

/** Kiểm tra một thanh khung chịu nén – uốn. muOut: μ ngoài mặt phẳng khung. */
export function checkFrameMember(
  a: FrameBCAnalyses, memberId: string, muOut: number, model: FrameModel, params: BucklingParams,
): BeamColumnResult | null {
  const m1 = a.r1.members.find((m) => m.id === memberId);
  if (!m1) return null;
  const sec = m1.section;
  let Nc = 0;
  for (const s of m1.samples) Nc = Math.max(Nc, -s.N);
  if (!(Nc > 0)) return null;
  const m2 = a.r2.ok ? a.r2.members.find((m) => m.id === memberId) : undefined;
  const mn = a.rn.ok ? a.rn.members.find((m) => m.id === memberId) : undefined;
  const E = model.material.E * 1e9;
  const alpha = a.r1.buckling?.alpha;
  const NcrIn = alpha ? alpha * Nc : null;
  const EIy = E * sec.Iy * 1e-12;
  const NcrOut = (Math.PI ** 2 * EIy) / (muOut * m1.L) ** 2 / 1e3;
  const planes: PlaneBC[] = [
    {
      key: 'z', label: 'Trong mặt phẳng khung (trục z)', Ncr: NcrIn,
      mu: NcrIn ? (Math.PI / m1.L) * Math.sqrt((E * sec.Iz * 1e-12) / (NcrIn * 1e3)) : null, lambda: null,
      M1: Math.abs(maxAbs(m1.samples.map((s) => s.M))),
      M2: m2 ? Math.abs(maxAbs(m2.samples.map((s) => s.M))) : NaN,
      W: W(sec.Iz, Math.max(sec.yMax, -sec.yMin)),
    },
    {
      key: 'y', label: 'Ngoài mặt phẳng khung (trục y)', Ncr: NcrOut, mu: muOut, lambda: null, M1: 0, M2: 0,
      W: W(sec.Iy, Math.max(sec.zMax, -sec.zMin)),
    },
  ];
  const Wz = weffZ(m1.sectionSpec, model.material, 240, Math.sign(maxAbs(m1.samples.map((s) => s.M))) || 1);
  if (Wz && Wz < planes[0].W) planes[0].W = Wz;
  return finish({
    Aeff: aeffIfClass4(m1.sectionSpec, model.material, 240),
    sec, E: model.material.E, allowable: model.material.allowable, params, n: a.n, Nc, planes,
    sigma1: sigmaMax(sec, m1.samples.map(toIF)),
    sigma2: m2 ? sigmaMax(sec, m2.samples.map(toIF)) : null,
    sigmaN: mn ? sigmaMax(sec, mn.samples.map(toIF)) : null,
    errors: a.r2.ok ? [] : a.r2.errors,
  });
}
