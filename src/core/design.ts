/**
 * Chọn số hiệu thép hình: duyệt toàn bộ họ thép, tính lại kết cấu với từng tiết diện
 * (đúng cho cả hệ siêu tĩnh — nội lực phụ thuộc độ cứng) và kiểm tra:
 *  - Bền theo ứng suất pháp: |σ|max ≤ [σ]
 *  - Bền theo ứng suất tiếp: τmax ≤ [τ] = [σ]/√3 (thuyết bền 4)
 *  - Độ cứng: độ võng lớn nhất ≤ L/n (nếu có yêu cầu)
 * Chưa kiểm tra ổn định (mất ổn định tổng thể / cục bộ) — cần kiểm tra riêng với cấu kiện chịu nén.
 */
import { analyze } from './analysis';
import { analyzeFrame, type FrameModel } from './frame';
import { computeSection, type SectionProps } from './section';
import { STEEL_DENSITY, STEEL_FAMILIES } from './steelTables';
import { maxNormalOnSection, stressAt } from './stress';
import type { InternalForces, Model, SectionSpec } from './types';

export interface DesignOptions {
  family: string;
  rotate: boolean;
  /** Tỉ số độ võng cho phép n (f ≤ L/n); 0 = không kiểm tra */
  deflRatio: number;
  /** Kể đến trọng lượng bản thân */
  selfWeight: boolean;
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

function finish(c: Omit<Candidate, 'util' | 'ok'>, allowable: number): Candidate {
  const tauAllow = allowable / Math.sqrt(3);
  const util = Math.max(Math.abs(c.sigma) / allowable, c.tau / tauAllow, c.deflLimit > 0 ? c.defl / c.deflLimit : 0);
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
      out.push(finish({ ...base, sigma: 0, tau: 0, defl: 0, deflLimit: 0, error: res.errors[0] }, model.material.allowable));
      continue;
    }
    let sigma = 0, tau = 0;
    for (const s of res.forceSamples) {
      const m = maxNormalOnSection(sec, s);
      const v = Math.abs(m.max) > Math.abs(m.min) ? m.max : m.min;
      if (Math.abs(v) > Math.abs(sigma)) sigma = v;
      tau = Math.max(tau, tauMax(sec, s, model.material));
    }
    let defl = 0;
    for (const d of res.dispSamples) defl = Math.max(defl, Math.hypot(d.v, d.w));
    const deflLimit = opt.deflRatio > 0 ? (model.length * 1e3) / opt.deflRatio : 0;
    out.push(finish({ ...base, sigma, tau, defl, deflLimit }, model.material.allowable));
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
      out.push(finish({ ...base, sigma: 0, tau: 0, defl: 0, deflLimit: 0, error: res.errors[0] }, model.material.allowable));
      continue;
    }
    let sigma = 0, tau = 0, util = 0, defl = 0, deflLimit = 0;
    for (const mr of res.members) {
      if (!memberIds.has(mr.id)) continue;
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
    out.push(finish({ ...base, sigma, tau, defl, deflLimit }, model.material.allowable));
  }
  return out.sort((a, b) => a.mass - b.mass);
}
