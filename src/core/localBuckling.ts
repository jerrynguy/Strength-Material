/**
 * Ổn định cục bộ bản cánh, bản bụng.
 *
 * Mặt cắt được tách thành các tấm phẳng:
 *  - tấm vươn (outstand): một mép tựa, một mép tự do — cánh chữ I/U/T, cánh thép góc, sườn chữ T
 *  - tấm trong (internal): tựa hai mép — bản bụng chữ I/U, thành hộp
 * Ứng suất ở hai mép mỗi tấm tính từ nội lực thực (N, M_z, M_y) → tỉ số ψ.
 *
 *  σ_cr = k_σ · π²E / (12(1 − ν²)) · (t/c)²         (k_σ theo EN 1993-1-5 bảng 4.1, 4.2)
 *  λ̄_p = √(f_y/σ_cr);  ρ = (λ̄_p − 0.055(3 + ψ))/λ̄_p² (tấm trong), (λ̄_p − 0.188)/λ̄_p² (tấm vươn)
 *  Phân loại tiết diện 1–4 theo giới hạn c/t của EN 1993-1-1 bảng 5.2, ε = √(235/f_y)
 *  Ổn định bản bụng chịu cắt (EN 1993-1-5 §5): τ_cr = k_τ·σ_E, λ̄_w = 0.76√(f_y/τ_cr), χ_w
 * Với ứng suất cho phép: tấm loại 4 kiểm tra gần đúng σ_nén ≤ ρ·[σ]; cắt: τ_tb ≤ χ_w·[σ]/√3.
 */
import { computeSection, type SectionProps } from './section';
import { findProfile } from './steelTables';
import { neutralAxisCoeffs } from './stress';
import type { InternalForces, Material, SectionSpec } from './types';

type P = [number, number]; // [z, y] toạ độ vẽ (mm)

export interface PlateDef {
  name: string;
  kind: 'internal' | 'outstand';
  c: number;
  t: number;
  /** mép 1 (tấm vươn: mép tựa / chân), mép 2 (tấm vươn: mép tự do) */
  p1: P;
  p2: P;
  /** là bản bụng chịu cắt theo phương y */
  web?: boolean;
}

interface Geometry {
  plates: PlateDef[];
  /** Chiều cao bản bụng tính cắt h_w và bề dày (tổng các bụng) */
  shear?: { hw: number; tw: number; count: number };
  tube?: { D: number; t: number };
  angle?: { b: number; h: number; t: number };
  note?: string;
}

function geometry(spec: SectionSpec): Geometry | null {
  switch (spec.kind) {
    case 'I': {
      const H = spec.tb + spec.hw + spec.tt;
      return {
        plates: [
          { name: 'Cánh trên – phải', kind: 'outstand', c: (spec.bt - spec.tw) / 2, t: spec.tt, p1: [spec.tw / 2, H - spec.tt / 2], p2: [spec.bt / 2, H - spec.tt / 2] },
          { name: 'Cánh trên – trái', kind: 'outstand', c: (spec.bt - spec.tw) / 2, t: spec.tt, p1: [-spec.tw / 2, H - spec.tt / 2], p2: [-spec.bt / 2, H - spec.tt / 2] },
          { name: 'Bản bụng', kind: 'internal', c: spec.hw, t: spec.tw, p1: [0, spec.tb], p2: [0, spec.tb + spec.hw], web: true },
          { name: 'Cánh dưới – phải', kind: 'outstand', c: (spec.bb - spec.tw) / 2, t: spec.tb, p1: [spec.tw / 2, spec.tb / 2], p2: [spec.bb / 2, spec.tb / 2] },
          { name: 'Cánh dưới – trái', kind: 'outstand', c: (spec.bb - spec.tw) / 2, t: spec.tb, p1: [-spec.tw / 2, spec.tb / 2], p2: [-spec.bb / 2, spec.tb / 2] },
        ],
        shear: { hw: spec.hw, tw: spec.tw, count: 1 },
        note: 'Tiết diện tổ hợp hàn: bỏ qua đường hàn khi tính c.',
      };
    }
    case 'T':
      return {
        plates: [
          { name: 'Cánh – phải', kind: 'outstand', c: (spec.b - spec.tw) / 2, t: spec.tf, p1: [spec.tw / 2, spec.hw + spec.tf / 2], p2: [spec.b / 2, spec.hw + spec.tf / 2] },
          { name: 'Cánh – trái', kind: 'outstand', c: (spec.b - spec.tw) / 2, t: spec.tf, p1: [-spec.tw / 2, spec.hw + spec.tf / 2], p2: [-spec.b / 2, spec.hw + spec.tf / 2] },
          { name: 'Sườn (bụng)', kind: 'outstand', c: spec.hw, t: spec.tw, p1: [0, spec.hw], p2: [0, 0] },
        ],
      };
    case 'U':
      return {
        plates: [
          { name: 'Cánh trên', kind: 'outstand', c: spec.b - spec.tw, t: spec.tf, p1: [spec.tw, spec.h - spec.tf / 2], p2: [spec.b, spec.h - spec.tf / 2] },
          { name: 'Bản bụng', kind: 'internal', c: spec.h - 2 * spec.tf, t: spec.tw, p1: [spec.tw / 2, spec.tf], p2: [spec.tw / 2, spec.h - spec.tf], web: true },
          { name: 'Cánh dưới', kind: 'outstand', c: spec.b - spec.tw, t: spec.tf, p1: [spec.tw, spec.tf / 2], p2: [spec.b, spec.tf / 2] },
        ],
        shear: { hw: spec.h - 2 * spec.tf, tw: spec.tw, count: 1 },
      };
    case 'L':
      return {
        plates: [
          { name: 'Cánh ngang', kind: 'outstand', c: spec.b - spec.t, t: spec.t, p1: [spec.t, spec.t / 2], p2: [spec.b, spec.t / 2] },
          { name: 'Cánh đứng', kind: 'outstand', c: spec.h - spec.t, t: spec.t, p1: [spec.t / 2, spec.t], p2: [spec.t / 2, spec.h] },
        ],
        angle: { b: spec.b, h: spec.h, t: spec.t },
      };
    case 'box': {
      const { B, H, tw, tf } = spec;
      return {
        plates: [
          { name: 'Cánh trên', kind: 'internal', c: B - 2 * tw, t: tf, p1: [-B / 2 + tw, H - tf / 2], p2: [B / 2 - tw, H - tf / 2] },
          { name: 'Thành bên phải', kind: 'internal', c: H - 2 * tf, t: tw, p1: [B / 2 - tw / 2, tf], p2: [B / 2 - tw / 2, H - tf], web: true },
          { name: 'Thành bên trái', kind: 'internal', c: H - 2 * tf, t: tw, p1: [-B / 2 + tw / 2, tf], p2: [-B / 2 + tw / 2, H - tf], web: true },
          { name: 'Cánh dưới', kind: 'internal', c: B - 2 * tw, t: tf, p1: [-B / 2 + tw, tf / 2], p2: [B / 2 - tw, tf / 2] },
        ],
        shear: { hw: H - 2 * tf, tw, count: 2 },
      };
    }
    case 'tube':
      return { plates: [], tube: { D: spec.D, t: spec.t } };
    case 'catalog': {
      const f = findProfile(spec.family, spec.name);
      const g = f?.profile.geom;
      if (!g) return null;
      if (g.type === 'I') {
        const c = (g.b - g.tw - 2 * g.r) / 2;
        return {
          plates: [
            { name: 'Cánh trên – phải', kind: 'outstand', c, t: g.tf, p1: [g.tw / 2 + g.r, g.h - g.tf / 2], p2: [g.b / 2, g.h - g.tf / 2] },
            { name: 'Cánh trên – trái', kind: 'outstand', c, t: g.tf, p1: [-g.tw / 2 - g.r, g.h - g.tf / 2], p2: [-g.b / 2, g.h - g.tf / 2] },
            { name: 'Bản bụng', kind: 'internal', c: g.h - 2 * g.tf - 2 * g.r, t: g.tw, p1: [0, g.tf + g.r], p2: [0, g.h - g.tf - g.r], web: true },
            { name: 'Cánh dưới – phải', kind: 'outstand', c, t: g.tf, p1: [g.tw / 2 + g.r, g.tf / 2], p2: [g.b / 2, g.tf / 2] },
            { name: 'Cánh dưới – trái', kind: 'outstand', c, t: g.tf, p1: [-g.tw / 2 - g.r, g.tf / 2], p2: [-g.b / 2, g.tf / 2] },
          ],
          shear: { hw: g.h - 2 * g.tf, tw: g.tw, count: 1 },
        };
      }
      if (g.type === 'U') {
        return {
          plates: [
            { name: 'Cánh trên', kind: 'outstand', c: g.b - g.tw - g.r, t: g.tf, p1: [g.tw + g.r, g.h - g.tf / 2], p2: [g.b, g.h - g.tf / 2] },
            { name: 'Bản bụng', kind: 'internal', c: g.h - 2 * g.tf - 2 * g.r, t: g.tw, p1: [g.tw / 2, g.tf + g.r], p2: [g.tw / 2, g.h - g.tf - g.r], web: true },
            { name: 'Cánh dưới', kind: 'outstand', c: g.b - g.tw - g.r, t: g.tf, p1: [g.tw + g.r, g.tf / 2], p2: [g.b, g.tf / 2] },
          ],
          shear: { hw: g.h - 2 * g.tf, tw: g.tw, count: 1 },
        };
      }
      if (g.type === 'L') {
        return {
          plates: [
            { name: 'Cánh ngang', kind: 'outstand', c: g.b - g.t - g.r, t: g.t, p1: [g.t + g.r, g.t / 2], p2: [g.b, g.t / 2] },
            { name: 'Cánh đứng', kind: 'outstand', c: g.b - g.t - g.r, t: g.t, p1: [g.t / 2, g.t + g.r], p2: [g.t / 2, g.b] },
          ],
          angle: { b: g.b, h: g.b, t: g.t },
        };
      }
      if (g.type === 'RHS') {
        const { B, H, t } = g;
        return {
          plates: [
            { name: 'Cánh trên', kind: 'internal', c: B - 3 * t, t, p1: [-B / 2 + 1.5 * t, H - t / 2], p2: [B / 2 - 1.5 * t, H - t / 2] },
            { name: 'Thành bên phải', kind: 'internal', c: H - 3 * t, t, p1: [B / 2 - t / 2, 1.5 * t], p2: [B / 2 - t / 2, H - 1.5 * t], web: true },
            { name: 'Thành bên trái', kind: 'internal', c: H - 3 * t, t, p1: [-B / 2 + t / 2, 1.5 * t], p2: [-B / 2 + t / 2, H - 1.5 * t], web: true },
            { name: 'Cánh dưới', kind: 'internal', c: B - 3 * t, t, p1: [-B / 2 + 1.5 * t, t / 2], p2: [B / 2 - 1.5 * t, t / 2] },
          ],
          shear: { hw: H - 2 * t, tw: t, count: 2 },
        };
      }
      if (g.type === 'CHS') return { plates: [], tube: { D: g.D, t: g.t } };
      return null;
    }
    default:
      return null;
  }
}

// ───────── Hệ số ổn định tấm ─────────

/** k_σ tấm trong (EN 1993-1-5 bảng 4.1), ψ = σ₂/σ₁ (σ₁ nén lớn nhất) */
export function kInternal(psi: number): number {
  if (psi >= 1) return 4;
  if (psi > 0) return 8.2 / (1.05 + psi);
  if (psi === 0) return 7.81;
  if (psi > -1) return 7.81 - 6.29 * psi + 9.78 * psi * psi;
  if (psi === -1) return 23.9;
  return 5.98 * (1 - psi) ** 2;
}

/** k_σ tấm vươn (bảng 4.2). tipMax: nén lớn nhất ở mép tự do. */
export function kOutstand(psi: number, tipMax: boolean): number {
  if (tipMax) return 0.57 - 0.21 * psi + 0.07 * psi * psi;
  if (psi >= 1) return 0.43;
  if (psi > 0) return 0.578 / (psi + 0.34);
  if (psi === 0) return 1.7;
  if (psi > -1) return 1.7 - 5 * psi + 17.1 * psi * psi;
  return 23.8;
}

export interface PlateResult {
  name: string;
  kind: 'internal' | 'outstand';
  c: number;
  t: number;
  ct: number;
  /** ứng suất nén ở hai mép (MPa, dương là nén) */
  s1: number;
  s2: number;
  psi: number;
  tipMax: boolean;
  k: number;
  sigmaE: number;
  sigmaCr: number;
  lambdaP: number;
  rho: number;
  /** 0: không chịu nén; 1–4 */
  cls: 0 | 1 | 2 | 3 | 4;
  limits: [number, number, number];
  /** hệ số an toàn đàn hồi σ_cr/σ_nén */
  n: number;
  /** hệ số sử dụng (chỉ tấm loại 4: σ/(ρ[σ])) */
  util: number;
  x?: number;
}

export interface ShearResult {
  hw: number;
  tw: number;
  ratio: number;
  limit: number;
  needCheck: boolean;
  a: number;
  kTau: number;
  tauCr: number;
  lambdaW: number;
  chiW: number;
  tau: number;
  tauAllow: number;
  util: number;
  ok: boolean;
  Q: number;
}

export interface LocalResult {
  applicable: boolean;
  reason?: string;
  fy: number;
  eps: number;
  plates: PlateResult[];
  sectionClass: 0 | 1 | 2 | 3 | 4;
  shear?: ShearResult;
  tube?: { Dt: number; limits: [number, number, number]; cls: 1 | 2 | 3 | 4; sigmaCr: number };
  angleNote?: string;
  ok: boolean;
  warnings: string[];
}

export interface LocalOptions {
  fy: number;
  /** khoảng cách sườn ngang (mm); 0 = không có sườn */
  stiffenerSpacing: number;
}

function classify(pl: PlateDef, c1: number, c2: number, psi: number, tipMax: boolean, k: number, eps: number): { cls: 0 | 1 | 2 | 3 | 4; limits: [number, number, number] } {
  const ct = pl.c / pl.t;
  let lim: [number, number, number];
  if (pl.kind === 'internal') {
    const alpha = psi >= 0 ? 1 : 1 / (1 - psi);
    const l1 = alpha > 0.5 ? (396 * eps) / (13 * alpha - 1) : (36 * eps) / alpha;
    const l2 = alpha > 0.5 ? (456 * eps) / (13 * alpha - 1) : (41.5 * eps) / alpha;
    const l3 = psi > -1 ? (42 * eps) / (0.67 + 0.33 * psi) : 62 * eps * (1 - psi) * Math.sqrt(-psi);
    lim = [l1, l2, l3];
  } else {
    // α: phần chịu nén của tấm vươn
    const comp = Math.max(c1, 0), other = c2;
    const alpha = other >= 0 ? 1 : comp / (comp - other);
    const tipCompressed = tipMax || other >= 0;
    const f = tipCompressed ? alpha : alpha * Math.sqrt(alpha);
    lim = [(9 * eps) / f, (10 * eps) / f, 21 * eps * Math.sqrt(k)];
  }
  const cls = ct <= lim[0] ? 1 : ct <= lim[1] ? 2 : ct <= lim[2] ? 3 : 4;
  return { cls, limits: lim };
}

function plateAt(pl: PlateDef, sigmaAt: (p: P) => number, E: number, nu: number, eps: number, fy: number, allow: number): PlateResult {
  const a = -sigmaAt(pl.p1); // nén dương
  const b = -sigmaAt(pl.p2);
  const sigmaE = (Math.PI ** 2 * E * pl.t * pl.t) / (12 * (1 - nu * nu) * pl.c * pl.c);
  const base = { name: pl.name, kind: pl.kind, c: pl.c, t: pl.t, ct: pl.c / pl.t, sigmaE };
  if (Math.max(a, b) <= 1e-9) {
    return { ...base, s1: a, s2: b, psi: 0, tipMax: false, k: 0, sigmaCr: 0, lambdaP: 0, rho: 1, cls: 0, limits: [0, 0, 0], n: Infinity, util: 0 };
  }
  let s1: number, s2: number, tipMax = false, k: number;
  if (pl.kind === 'internal') {
    s1 = Math.max(a, b); s2 = a >= b ? b : a;
    const psi = s2 / s1;
    k = kInternal(psi);
    s2 = s1 * psi;
  } else {
    // p1: chân (tựa), p2: mép tự do
    tipMax = b >= a;
    s1 = tipMax ? b : a;
    s2 = tipMax ? a : b;
    k = kOutstand(s2 / s1, tipMax);
  }
  const psi = s2 / s1;
  const sigmaCr = k * sigmaE;
  const lambdaP = Math.sqrt(fy / sigmaCr);
  let rho = 1;
  if (pl.kind === 'internal') {
    if (lambdaP > 0.5 + Math.sqrt(Math.max(0.085 - 0.055 * psi, 0))) rho = Math.min(1, (lambdaP - 0.055 * (3 + psi)) / (lambdaP * lambdaP));
  } else if (lambdaP > 0.748) rho = Math.min(1, (lambdaP - 0.188) / (lambdaP * lambdaP));
  const { cls, limits } = classify(pl, s1, s2, psi, tipMax, k, eps);
  return {
    ...base, s1, s2, psi, tipMax, k, sigmaCr, lambdaP, rho, cls, limits, n: sigmaCr / s1,
    util: cls === 4 ? s1 / (rho * allow) : 0,
  };
}

/**
 * Kiểm tra ổn định cục bộ cho một tiết diện với danh sách nội lực (các mặt cắt dọc thanh).
 * Mỗi tấm lấy trạng thái bất lợi nhất (σ_nén / ρ lớn nhất).
 */
export function checkLocal(spec: SectionSpec, mat: Material, forces: ({ x?: number } & InternalForces)[], opt: LocalOptions): LocalResult {
  const geo = geometry(spec);
  const fy = opt.fy;
  const eps = Math.sqrt(235 / fy);
  const base = { fy, eps, plates: [], sectionClass: 0 as const, ok: true, warnings: [] };
  if (!geo) return { ...base, applicable: false, reason: 'Mặt cắt đặc hoặc đa giác tự do: không kiểm tra ổn định cục bộ (tấm dày).' };
  const rotate = spec.kind === 'catalog' && spec.rotate;
  const sec: SectionProps = computeSection(spec);
  const [zc, yc] = sec.centroid;
  const toRel = ([z, y]: P): P => (rotate ? [-y - zc, z - yc] : [z - zc, y - yc]);
  const E = mat.E * 1e3;
  const warnings: string[] = [];
  if (geo.note) warnings.push(geo.note);

  const plates: PlateResult[] = [];
  for (const pl of geo.plates) {
    let worst: PlateResult | null = null;
    for (const F of forces) {
      const [s0, a, b] = neutralAxisCoeffs(sec, F);
      const sigmaAt = (p: P) => {
        const [z, y] = toRel(p);
        return s0 + a * y + b * z;
      };
      const r = plateAt(pl, sigmaAt, E, mat.nu, eps, fy, mat.allowable);
      r.x = F.x;
      const score = (x: PlateResult) => (x.cls === 0 ? -1 : x.s1 / x.rho);
      if (!worst || score(r) > score(worst)) worst = r;
    }
    if (worst) plates.push(worst);
  }
  const compressed = plates.filter((p) => p.cls > 0);
  let sectionClass = (compressed.length ? Math.max(...compressed.map((p) => p.cls)) : 0) as LocalResult['sectionClass'];

  let tube: LocalResult['tube'];
  if (geo.tube) {
    const Dt = geo.tube.D / geo.tube.t;
    const lim: [number, number, number] = [50 * eps * eps, 70 * eps * eps, 90 * eps * eps];
    const cls = (Dt <= lim[0] ? 1 : Dt <= lim[1] ? 2 : Dt <= lim[2] ? 3 : 4) as 1 | 2 | 3 | 4;
    const R = (geo.tube.D - geo.tube.t) / 2;
    tube = { Dt, limits: lim, cls, sigmaCr: (0.605 * E * geo.tube.t) / R };
    if (forces.some((F) => F.N < 0 || F.Mz || F.My)) sectionClass = cls;
  }
  let angleNote: string | undefined;
  if (geo.angle && forces.some((F) => F.N < 0)) {
    const { b, h, t } = geo.angle;
    const ok3 = h / t <= 15 * eps && (b + h) / (2 * t) <= 11.5 * eps;
    angleNote = `Thép góc chịu nén (EN bảng 5.2): h/t = ${(h / t).toFixed(1)} ${h / t <= 15 * eps ? '≤' : '>'} 15ε = ${(15 * eps).toFixed(1)}; (b + h)/2t = ${((b + h) / (2 * t)).toFixed(1)} ${(b + h) / (2 * t) <= 11.5 * eps ? '≤' : '>'} 11.5ε = ${(11.5 * eps).toFixed(1)} → ${ok3 ? 'loại 3' : 'loại 4'}`;
    if (!ok3) sectionClass = 4;
  }

  // Ổn định bản bụng khi chịu cắt
  let shear: ShearResult | undefined;
  if (geo.shear && !rotate) {
    const { hw, tw, count } = geo.shear;
    const eta = 1.2;
    const ratio = hw / tw;
    const limit = (72 * eps) / eta;
    const a = opt.stiffenerSpacing > 0 ? opt.stiffenerSpacing : Infinity;
    const ah = a / hw;
    const kTau = !Number.isFinite(a) ? 5.34 : ah >= 1 ? 5.34 + 4 / (ah * ah) : 4 + 5.34 / (ah * ah);
    const sigmaE = (Math.PI ** 2 * E * tw * tw) / (12 * (1 - mat.nu * mat.nu) * hw * hw);
    const tauCr = kTau * sigmaE;
    const lambdaW = 0.76 * Math.sqrt(fy / tauCr);
    const chiW = Math.min(1, lambdaW < 0.83 / eta ? eta : 0.83 / lambdaW);
    let Q = 0;
    for (const F of forces) Q = Math.max(Q, Math.abs(F.Qy));
    const tau = (Q * 1e3) / (count * hw * tw);
    const needCheck = ratio > limit;
    const tauAllow = (needCheck ? chiW : 1) * mat.allowable / Math.sqrt(3);
    shear = { hw, tw, ratio, limit, needCheck, a: Number.isFinite(a) ? a : 0, kTau, tauCr, lambdaW, chiW, tau, tauAllow, util: tau / tauAllow, ok: tau <= tauAllow, Q };
  }

  const ok = plates.every((p) => p.cls < 4 || p.util <= 1) && (!shear || shear.ok);
  if (sectionClass === 4) warnings.push('Tiết diện loại 4: mất ổn định cục bộ xảy ra trước khi đạt giới hạn chảy — cần dùng tiết diện hữu hiệu (ρ) khi kiểm tra bền.');
  return { applicable: true, fy, eps, plates, sectionClass, shear, tube, angleNote, ok, warnings };
}
