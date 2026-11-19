/**
 * Chọn số hiệu thép hình: duyệt toàn bộ họ thép, tính lại kết cấu với từng tiết diện
 * (đúng cho cả hệ siêu tĩnh — nội lực phụ thuộc độ cứng) và kiểm tra:
 *  - Bền theo ứng suất pháp: |σ|max ≤ [σ]
 *  - Bền theo ứng suất tiếp: τmax ≤ [τ] = [σ]/√3 (thuyết bền 4)
 *  - Độ cứng: độ võng lớn nhất ≤ L/n (nếu có yêu cầu)
 *  - Ổn định thanh chịu nén (tuỳ chọn): σ_nén = N/A ≤ φ[σ] (bảng φ thép CT3, chiều dài tính toán μL)
 * Chưa xét ổn định cục bộ bản cánh/bụng và mất ổn định uốn–xoắn của dầm.
 */
import { analyze } from './analysis';
import { analyzeFrame, type FrameModel } from './frame';
import { computeSection, type SectionProps } from './section';
import { STEEL_DENSITY, STEEL_FAMILIES } from './steelTables';
import { BUCKLING_MATERIALS, checkStability } from './stability';
import { maxNormalOnSection, stressAt } from './stress';
import type { InternalForces, Model, SectionSpec } from './types';

export interface DesignOptions {
  family: string;
  rotate: boolean;
  /** Tỉ số độ võng cho phép n (f ≤ L/n); 0 = không kiểm tra */
  deflRatio: number;
  /** Kể đến trọng lượng bản thân */
  selfWeight: boolean;
  /** Kiểm tra ổn định thanh chịu nén theo φ (thép CT3) */
  stability: boolean;
  /** Hệ số chiều dài tính toán μ (dầm/cột); với khung: μ mặc định cho mọi thanh */
  mu: number;
  /** μ riêng cho từng thanh khung */
  memberMu?: Record<string, number>;
}

export interface Candidate {
  name: string;
  spec: SectionSpec;
  A: number; // mm²
  mass: number; // kg/m
  sigma: number; // MPa
  tau: number; // MPa
  defl: number; // mm
  deflLimit: number; // mm (0 nếu không kiểm tra)
  /** Tỉ số σ_nén / (φ[σ]) lớn nhất; 0 nếu không kiểm tra / không có nén */
  stabUtil: number;
  lambda: number;
  /** Hệ số sử dụng lớn nhất (≤ 1 là đạt) */
  util: number;
  ok: boolean;
  error?: string;
}

const massOf = (sec: SectionProps) => sec.A * 1e-6 * STEEL_DENSITY;
const selfWeightQ = (sec: SectionProps) => -(massOf(sec) * 9.81) / 1000; // kN/m

function tauMax(sec: SectionProps, F: InternalForces, mat: Model['material']): number {
  const shear = stressAt(sec, { ...F, N: 0, Mz: 0, My: 0, T: 0 }, mat, 0, 0);
  const tq = Math.hypot(shear.tauQy, shear.tauQz);
  const tt = F.T ? sec.torsion.tauMax(F.T * 1e6) : 0;
  return tq + (Number.isFinite(tt) ? tt : 0);
}

/** Hệ số sử dụng theo ổn định cho lực nén Nc (kN, dương) */
function stabUtilOf(sec: SectionProps, Nc: number, L: number, mu: number, E: number, allowable: number): { util: number; lambda: number } {
  if (!(Nc > 0)) return { util: 0, lambda: 0 };
  const r = checkStability(sec, { N: Nc, Lz: L, Ly: L, muZ: mu, muY: mu, E, allowable, params: BUCKLING_MATERIALS.CT3, nRequired: 1 });
  return { util: r.phi === null ? Infinity : r.sigma / r.allowPhi, lambda: r.lambdaMax };
}

function finish(c: Omit<Candidate, 'util' | 'ok'>, allowable: number): Candidate {
  const tauAllow = allowable / Math.sqrt(3);
  const util = Math.max(Math.abs(c.sigma) / allowable, c.tau / tauAllow, c.deflLimit > 0 ? c.defl / c.deflLimit : 0, c.stabUtil);
  return { ...c, util, ok: !c.error && util <= 1 };
}

export function designBeam(model: Model, opt: DesignOptions): Candidate[] {
  const fam = STEEL_FAMILIES.find((f) => f.key === opt.family);
  if (!fam) return [];
  const out: Candidate[] = [];
  for (const p of fam.profiles) {
    const spec: SectionSpec = { kind: 'catalog', family: fam.key, name: p.name, rotate: opt.rotate };
    const sec = computeSection(spec);
    const loads = opt.selfWeight
      ? [...model.loads, { id: '__sw', type: 'distributed' as const, name: 'g', x1: 0, x2: model.length, dir: 'y' as const, q1: selfWeightQ(sec), q2: selfWeightQ(sec) }]
      : model.loads;
    const res = analyze({ ...model, section: spec, loads });
    const base = { name: p.name, spec, A: sec.A, mass: massOf(sec) };
    if (!res.ok) {
      out.push(finish({ ...base, sigma: 0, tau: 0, defl: 0, deflLimit: 0, stabUtil: 0, lambda: 0, error: res.errors[0] }, model.material.allowable));
      continue;
    }
    let sigma = 0, tau = 0, Nc = 0;
    for (const s of res.forceSamples) {
      Nc = Math.max(Nc, -s.N);
      const m = maxNormalOnSection(sec, s);
      const v = Math.abs(m.max) > Math.abs(m.min) ? m.max : m.min;
      if (Math.abs(v) > Math.abs(sigma)) sigma = v;
      tau = Math.max(tau, tauMax(sec, s, model.material));
    }
    let defl = 0;
    for (const d of res.dispSamples) defl = Math.max(defl, Math.hypot(d.v, d.w));
    const deflLimit = opt.deflRatio > 0 ? (model.length * 1e3) / opt.deflRatio : 0;
    const st = opt.stability ? stabUtilOf(sec, Nc, model.length, opt.mu, model.material.E, model.material.allowable) : { util: 0, lambda: 0 };
    out.push(finish({ ...base, sigma, tau, defl, deflLimit, stabUtil: st.util, lambda: st.lambda }, model.material.allowable));
  }
  return out.sort((a, b) => a.mass - b.mass);
}

export function designFrame(model: FrameModel, sectionId: string, opt: DesignOptions): Candidate[] {
  const fam = STEEL_FAMILIES.find((f) => f.key === opt.family);
  if (!fam) return [];
  const memberIds = new Set(model.members.filter((m) => m.sectionId === sectionId).map((m) => m.id));
  const out: Candidate[] = [];
  for (const p of fam.profiles) {
    const spec: SectionSpec = { kind: 'catalog', family: fam.key, name: p.name, rotate: opt.rotate };
    const sections = model.sections.map((s) => (s.id === sectionId ? { ...s, spec } : s));
    let loads = model.loads;
    if (opt.selfWeight) {
      loads = [...loads];
      for (const m of model.members) {
        const sp = sections.find((s) => s.id === m.sectionId)?.spec;
        const a = model.nodes.find((n) => n.id === m.i), b = model.nodes.find((n) => n.id === m.j);
        if (!sp || !a || !b) continue;
        const q = selfWeightQ(computeSection(sp));
        loads.push({ id: '__sw' + m.id, type: 'mdist', name: 'g', memberId: m.id, a: 0, b: Math.hypot(b.x - a.x, b.y - a.y), q1: q, q2: q, dir: 'gy' });
      }
    }
    const res = analyzeFrame({ ...model, sections, loads });
    const sec = computeSection(spec);
    const base = { name: p.name, spec, A: sec.A, mass: massOf(sec) };
    if (!res.ok) {
      out.push(finish({ ...base, sigma: 0, tau: 0, defl: 0, deflLimit: 0, stabUtil: 0, lambda: 0, error: res.errors[0] }, model.material.allowable));
      continue;
    }
    let sigma = 0, tau = 0, util = 0, defl = 0, deflLimit = 0, stabUtil = 0, lambda = 0;
    for (const mr of res.members) {
      if (!memberIds.has(mr.id)) continue;
      if (opt.stability) {
        let Nc = 0;
        for (const s of mr.samples) Nc = Math.max(Nc, -s.N);
        const st = stabUtilOf(sec, Nc, mr.L, opt.memberMu?.[mr.id] ?? opt.mu, model.material.E, model.material.allowable);
        if (st.util > stabUtil) { stabUtil = st.util; lambda = st.lambda; }
      }
      for (const s of mr.samples) {
        const F: InternalForces = { N: s.N, Qy: s.Q, Qz: 0, T: 0, Mz: s.M, My: 0 };
        const m = maxNormalOnSection(sec, F);
        const v = Math.abs(m.max) > Math.abs(m.min) ? m.max : m.min;
        if (Math.abs(v) > Math.abs(sigma)) sigma = v;
        tau = Math.max(tau, tauMax(sec, F, model.material));
      }
      if (opt.deflRatio > 0) {
        // độ võng tương đối của thanh so với dây cung nối hai đầu
        const d0 = mr.disp[0], d1 = mr.disp[mr.disp.length - 1];
        for (const d of mr.disp) {
          const t = d.s / mr.L;
          const rx = d.ux - (d0.ux + (d1.ux - d0.ux) * t);
          const ry = d.uy - (d0.uy + (d1.uy - d0.uy) * t);
          const perp = Math.abs(-mr.s * rx + mr.c * ry);
          const lim = (mr.L * 1e3) / opt.deflRatio;
          if (perp / lim > util) { util = perp / lim; defl = perp; deflLimit = lim; }
        }
      }
    }
    out.push(finish({ ...base, sigma, tau, defl, deflLimit, stabUtil, lambda }, model.material.allowable));
  }
  return out.sort((a, b) => a.mass - b.mass);
}
