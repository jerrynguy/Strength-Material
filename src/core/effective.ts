/**
 * Tiết diện hữu hiệu cho tiết diện loại 4 (EN 1993-1-5 §4.3, 4.4).
 *
 * Mỗi tấm chịu nén có ρ < 1 bị khoét vùng không hữu hiệu (hình chữ nhật c_ineff × t) khỏi hình học thật:
 *  - Tấm tựa hai mép (bảng 4.1):
 *      ψ ≥ 0: b_eff = ρ·b̄,  b_e1 = 2b_eff/(5 − ψ) (phía mép nén lớn), b_e2 = b_eff − b_e1
 *      ψ < 0: b_c = b̄/(1 − ψ), b_eff = ρ·b_c, b_e1 = 0.4b_eff, b_e2 = 0.6b_eff (sát vùng kéo)
 *  - Tấm vươn (bảng 4.2): b_eff = ρ·c (hoặc ρ·b_c khi có vùng kéo), phần bị khoét ở phía mép tự do
 *    (hoặc phía xa chân khi chân nén lớn hơn).
 * ρ tính với σ_com = f_y (EN 4.4(4)), nên tiết diện hữu hiệu chỉ phụ thuộc dạng phân bố ứng suất:
 *  - A_eff, e_N: tiết diện hữu hiệu khi chỉ chịu nén đều
 *  - W_eff: tiết diện hữu hiệu khi chỉ chịu uốn (theo từng chiều mô men)
 * Vì khoét cánh làm dịch trục trung hoà, bài toán được lặp đến khi vùng khoét hội tụ (EN 4.4(3)).
 * Kiểm tra (EN 1993-1-1 6.2.9.3, dạng ứng suất cho phép):
 *   σ = N/A_eff + (|M_z| + |N|·|e_N,y|)/W_eff,z + (|M_y| + |N|·|e_N,z|)/W_eff,y ≤ [σ]
 */
import { geometry, kInternal, kOutstand, type PlateDef } from './localBuckling';
import { computeSection, polygonSection, type Ring, type SectionProps } from './section';
import { neutralAxisCoeffs, fmt } from './stress';
import type { InternalForces, Material, SectionSpec } from './types';

type P = [number, number];

export interface EffPlate {
  name: string;
  kind: 'internal' | 'outstand';
  c: number;
  t: number;
  psi: number;
  k: number;
  lambdaP: number;
  rho: number;
  /** chiều rộng hữu hiệu (mm) và vùng bị khoét [s_a, s_b] tính từ mép p1 */
  beff: number;
  removed: [number, number] | null;
}

export interface EffState {
  sec: SectionProps;
  plates: EffPlate[];
  iterations: number;
}

export interface EffectiveResult {
  applicable: boolean;
  reason?: string;
  gross: SectionProps;
  /** nén đều */
  N?: EffState & { Aeff: number; eNy: number; eNz: number };
  /** uốn quanh z, M > 0 (thớ trên nén) và M < 0 */
  MzPos?: EffState & { Weff: number };
  MzNeg?: EffState & { Weff: number };
  MyPos?: EffState & { Weff: number };
  MyNeg?: EffState & { Weff: number };
  steps: string[];
}

function rhoOf(kind: 'internal' | 'outstand', lambdaP: number, psi: number): number {
  if (kind === 'internal') {
    if (lambdaP <= 0.5 + Math.sqrt(Math.max(0.085 - 0.055 * psi, 0))) return 1;
    return Math.min(1, (lambdaP - 0.055 * (3 + psi)) / (lambdaP * lambdaP));
  }
  if (lambdaP <= 0.748) return 1;
  return Math.min(1, (lambdaP - 0.188) / (lambdaP * lambdaP));
}

/** Xác định vùng khoét của một tấm từ ứng suất nén ở hai mép (dương là nén). */
function plateEff(pl: PlateDef, c1: number, c2: number, E: number, nu: number, fy: number): EffPlate {
  const base = { name: pl.name, kind: pl.kind, c: pl.c, t: pl.t };
  const none = { ...base, psi: 0, k: 0, lambdaP: 0, rho: 1, beff: pl.c, removed: null };
  if (Math.max(c1, c2) <= 1e-9) return none;
  const sigmaE = (Math.PI ** 2 * E * pl.t * pl.t) / (12 * (1 - nu * nu) * pl.c * pl.c);
  const c = pl.c;
  if (pl.kind === 'internal') {
    const firstMax = c1 >= c2; // mép nén lớn E1
    const smax = Math.max(c1, c2), smin = Math.min(c1, c2);
    const psi = smin / smax;
    const k = kInternal(psi);
    const lambdaP = Math.sqrt(fy / (k * sigmaE));
    const rho = rhoOf('internal', lambdaP, psi);
    if (rho >= 1) return { ...base, psi, k, lambdaP, rho, beff: c, removed: null };
    let a: number, b: number, beff: number;
    if (psi >= 0) {
      beff = rho * c;
      const be1 = (2 * beff) / (5 - psi);
      const be2 = beff - be1;
      a = be1; b = c - be2;
    } else {
      const bc = c / (1 - psi);
      beff = rho * bc;
      a = 0.4 * beff; b = bc - 0.6 * beff;
    }
    const removed: [number, number] = firstMax ? [a, b] : [c - b, c - a];
    return { ...base, psi, k, lambdaP, rho, beff, removed };
  }
  // tấm vươn: p1 = chân, p2 = mép tự do
  const tipMax = c2 >= c1;
  const smax = tipMax ? c2 : c1, other = tipMax ? c1 : c2;
  const psi = other / smax;
  const k = kOutstand(psi, tipMax);
  const lambdaP = Math.sqrt(fy / (k * sigmaE));
  const rho = rhoOf('outstand', lambdaP, psi);
  if (rho >= 1) return { ...base, psi, k, lambdaP, rho, beff: c, removed: null };
  let removed: [number, number];
  let beff: number;
  if (psi >= 0) {
    beff = rho * c;
    removed = [beff, c];
  } else {
    const bc = c / (1 - psi);
    beff = rho * bc;
    removed = tipMax ? [c - bc + beff, c] : [beff, bc];
  }
  return { ...base, psi, k, lambdaP, rho, beff, removed };
}

function rectRing(pl: PlateDef, sa: number, sb: number, rotate: boolean): Ring {
  const [z1, y1] = pl.p1, [z2, y2] = pl.p2;
  const L = Math.hypot(z2 - z1, y2 - y1) || 1;
  const u: P = [(z2 - z1) / L, (y2 - y1) / L];
  const nrm: P = [-u[1], u[0]];
  const h = pl.t / 2;
  const at = (s: number, d: number): P => [z1 + u[0] * s + nrm[0] * d, y1 + u[1] * s + nrm[1] * d];
  let pts: P[] = [at(sa, -h), at(sb, -h), at(sb, h), at(sa, h)];
  if (rotate) pts = pts.map(([z, y]) => [-y, z] as P);
  return { pts, hole: true, ineffective: true };
}

/** Lặp tìm tiết diện hữu hiệu cho dạng nội lực F (chỉ dùng hướng, không dùng độ lớn). */
function iterate(spec: SectionSpec, F: InternalForces, mat: Material, fy: number): EffState | null {
  const geo = geometry(spec);
  if (!geo || !geo.plates.length) return null;
  const gross = computeSection(spec);
  const rotate = spec.kind === 'catalog' && spec.rotate;
  const E = mat.E * 1e3;
  let sec = gross;
  let plates: EffPlate[] = [];
  let prev = '';
  let it = 0;
  for (it = 1; it <= 12; it++) {
    const [zc, yc] = sec.centroid;
    const [s0, a, b] = neutralAxisCoeffs(sec, F);
    const sig = ([z, y]: P) => {
      const [zz, yy] = rotate ? [-y, z] : [z, y];
      return s0 + a * (yy - yc) + b * (zz - zc);
    };
    plates = geo.plates.map((pl) => plateEff(pl, -sig(pl.p1), -sig(pl.p2), E, mat.nu, fy));
    const key = plates.map((p) => (p.removed ? `${p.removed[0].toFixed(2)}:${p.removed[1].toFixed(2)}` : '-')).join('|');
    const holes = geo.plates.flatMap((pl, i) => (plates[i].removed ? [rectRing(pl, plates[i].removed![0], plates[i].removed![1], rotate)] : []));
    sec = holes.length ? polygonSection(`${gross.label} — hữu hiệu`, [...gross.rings, ...holes], gross.torsion) : gross;
    if (key === prev) break;
    prev = key;
  }
  return { sec, plates, iterations: it };
}

const W = (s: SectionProps, axis: 'z' | 'y') =>
  axis === 'z' ? s.Iz / Math.max(s.yMax, -s.yMin) : s.Iy / Math.max(s.zMax, -s.zMin);

export function effectiveSection(spec: SectionSpec, mat: Material, fy: number): EffectiveResult {
  const gross = computeSection(spec);
  const steps: string[] = [];
  const geo = geometry(spec);
  if (!geo || !geo.plates.length) {
    return { applicable: false, reason: 'Mặt cắt không gồm các tấm phẳng (tròn, ống, đặc) — không áp dụng tiết diện hữu hiệu theo EN 1993-1-5.', gross, steps };
  }
  const F0: InternalForces = { N: 0, Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0 };
  const n = iterate(spec, { ...F0, N: -1 }, mat, fy)!;
  const eNy = n.sec.centroid[1] - gross.centroid[1];
  const eNz = n.sec.centroid[0] - gross.centroid[0];
  const res: EffectiveResult = { applicable: true, gross, steps };
  res.N = { ...n, Aeff: n.sec.A, eNy, eNz };
  const mzp = iterate(spec, { ...F0, Mz: 1 }, mat, fy)!;
  const mzn = iterate(spec, { ...F0, Mz: -1 }, mat, fy)!;
  res.MzPos = { ...mzp, Weff: W(mzp.sec, 'z') };
  res.MzNeg = { ...mzn, Weff: W(mzn.sec, 'z') };
  const myp = iterate(spec, { ...F0, My: 1 }, mat, fy)!;
  const myn = iterate(spec, { ...F0, My: -1 }, mat, fy)!;
  res.MyPos = { ...myp, Weff: W(myp.sec, 'y') };
  res.MyNeg = { ...myn, Weff: W(myn.sec, 'y') };
  steps.push(`ε = √(235/f_y) = ${fmt(Math.sqrt(235 / fy), 3)}; ρ tính với σ_com = f_y = ${fy} MPa`);
  const describe = (label: string, st: EffState) => {
    const red = st.plates.filter((p) => p.removed);
    if (!red.length) steps.push(`${label}: mọi tấm hữu hiệu toàn bộ (ρ = 1).`);
    for (const p of red) {
      steps.push(
        `${label} — ${p.name}: ψ = ${fmt(p.psi, 3)}, k_σ = ${fmt(p.k, 3)}, λ̄_p = ${fmt(p.lambdaP, 3)}, ρ = ${fmt(p.rho, 4)}, b_eff = ${fmt(p.beff, 1)} mm; khoét ${fmt(p.removed![1] - p.removed![0], 1)} mm (từ ${fmt(p.removed![0], 1)} đến ${fmt(p.removed![1], 1)} mm tính từ ${p.kind === 'outstand' ? 'chân' : 'mép 1'})`,
      );
    }
  };
  describe('Nén đều', n);
  steps.push(`A_eff = ${fmt(res.N.Aeff, 1)} mm² (A = ${fmt(gross.A, 1)}); độ lệch trọng tâm e_N,y = ${fmt(eNy, 2)} mm, e_N,z = ${fmt(eNz, 2)} mm`);
  describe('Uốn M_z > 0', mzp);
  steps.push(`W_eff,z (M > 0) = ${fmt(res.MzPos.Weff, 0)} mm³; (M < 0) = ${fmt(res.MzNeg.Weff, 0)} mm³ (W_el = ${fmt(W(gross, 'z'), 0)})`);
  steps.push(`W_eff,y (M > 0) = ${fmt(res.MyPos.Weff, 0)} mm³; (M < 0) = ${fmt(res.MyNeg.Weff, 0)} mm³ (W_el = ${fmt(W(gross, 'y'), 0)})`);
  return res;
}

export interface EffCheck {
  sigma: number;
  util: number;
  ok: boolean;
  F: InternalForces;
  x?: number;
  terms: string;
}

/** Kiểm tra σ = N/A_eff + (M + N·e_N)/W_eff ≤ [σ] cho danh sách mặt cắt, trả về mặt cắt bất lợi nhất. */
export function checkEffective(eff: EffectiveResult, forces: ({ x?: number } & InternalForces)[], allowable: number): EffCheck | null {
  if (!eff.applicable || !eff.N || !eff.MzPos || !eff.MzNeg || !eff.MyPos || !eff.MyNeg) return null;
  let best: EffCheck | null = null;
  for (const F of forces) {
    const Nn = F.N * 1e3; // N
    const comp = Nn < 0;
    const A = comp ? eff.N.Aeff : eff.gross.A;
    const eY = comp ? Math.abs(eff.N.eNy) : 0;
    const eZ = comp ? Math.abs(eff.N.eNz) : 0;
    const Wz = F.Mz >= 0 ? eff.MzPos.Weff : eff.MzNeg.Weff;
    const Wy = F.My >= 0 ? eff.MyPos.Weff : eff.MyNeg.Weff;
    const sN = Math.abs(Nn) / A;
    const sMz = (Math.abs(F.Mz) * 1e6 + Math.abs(Nn) * eY) / Wz;
    const sMy = (Math.abs(F.My) * 1e6 + Math.abs(Nn) * eZ) / Wy;
    const sigma = sN + sMz + sMy;
    if (!best || sigma > best.sigma) {
      best = {
        sigma, util: sigma / allowable, ok: sigma <= allowable, F, x: F.x,
        terms: `σ = ${fmt(Math.abs(Nn), 0)}/${fmt(A, 1)} + (${fmt(Math.abs(F.Mz) * 1e6, 0)} + ${fmt(Math.abs(Nn), 0)}·${fmt(eY, 2)})/${fmt(Wz, 0)}` +
          (F.My || eZ ? ` + (${fmt(Math.abs(F.My) * 1e6, 0)} + ${fmt(Math.abs(Nn), 0)}·${fmt(eZ, 2)})/${fmt(Wy, 0)}` : '') +
          ` = ${fmt(sigma, 2)} MPa`,
      };
    }
  }
  return best;
}

/** A_eff khi tiết diện là loại 4 lúc chịu nén đều; undefined nếu không phải loại 4. */
export function aeffIfClass4(spec: SectionSpec, mat: Material, fy: number): number | undefined {
  const geo = geometry(spec);
  if (!geo || !geo.plates.length) return undefined;
  const st = iterate(spec, { N: -1, Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0 }, mat, fy);
  if (!st || !st.plates.some((p) => p.removed)) return undefined;
  return st.sec.A;
}

/** W_eff,z theo chiều mô men nếu có tấm bị khoét khi uốn; undefined nếu toàn bộ hữu hiệu. */
export function weffZ(spec: SectionSpec, mat: Material, fy: number, sign: number): number | undefined {
  const geo = geometry(spec);
  if (!geo || !geo.plates.length) return undefined;
  const st = iterate(spec, { N: 0, Qy: 0, Qz: 0, T: 0, Mz: sign >= 0 ? 1 : -1, My: 0 }, mat, fy);
  if (!st || !st.plates.some((p) => p.removed)) return undefined;
  return W(st.sec, 'z');
}
