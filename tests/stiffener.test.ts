import { describe, expect, it } from 'vitest';
import { checkEffective, effectiveSection } from '../src/core/effective';
import { checkLocal, geometry, stiffenerColumn } from '../src/core/localBuckling';
import { STEEL } from '../src/core/presets';
import { computeSection } from '../src/core/section';
import type { InternalForces, SectionSpec } from '../src/core/types';

const girder = (stiff: boolean, b = 100, t = 10, sides: 1 | 2 = 1): SectionSpec => ({
  kind: 'I', bt: 320, tt: 18, hw: 1400, tw: 8, bb: 320, tb: 18,
  stiffeners: stiff ? [{ pos: 280, b, t, sides }] : [],
});
const F = (o: Partial<InternalForces>): InternalForces => ({ N: 0, Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0, ...o });

describe('Sườn dọc bản bụng', () => {
  it('đặc trưng mặt cắt có kể sườn', () => {
    const a = computeSection(girder(false)), b = computeSection(girder(true, 100, 10, 2));
    expect(b.A - a.A).toBeCloseTo(2 * 100 * 10, 6);
    expect(b.Iz).toBeGreaterThan(a.Iz);
  });
  it('bụng được chia thành các ô giữa sườn', () => {
    const g = geometry(girder(true))!;
    const webs = g.plates.filter((p) => p.web);
    expect(webs.map((p) => p.c)).toEqual([280, 1120]);
    expect(g.plates.some((p) => p.name.startsWith('Sườn dọc 1'))).toBe(true);
  });
  it('thanh sườn: A_sl khi nén đều = A_s + t_w(b1 + b2)/2; σ_cr,sl theo EN A.2.2', () => {
    const r = effectiveSection(girder(true), STEEL, 235);
    const c = r.N!.columns![0];
    expect(c.b1).toBeCloseTo(280, 6);
    expect(c.b2).toBeCloseTo(1120, 6);
    expect(c.Asl).toBeCloseTo(100 * 10 + 8 * (280 + 1120) / 2, 6);
    const col = stiffenerColumn({ y: 0, b: 100, t: 10, sides: 1 }, 8, 700);
    expect(c.Isl).toBeCloseTo(col.I, 6);
    const E = 200e3, b = 1400;
    expect(c.sigmaCrSl).toBeCloseTo((1.05 * E * Math.sqrt(col.I * 8 ** 3 * b)) / (col.A * 280 * 1120), 6);
    expect(c.chiC).toBeLessThan(1);
  });
  it('sườn dọc làm tăng W_eff và giảm ứng suất khi uốn', () => {
    const forces = [F({ Mz: 1500 })];
    const r0 = checkEffective(effectiveSection(girder(false), STEEL, 235), forces, 160)!;
    const r1 = checkEffective(effectiveSection(girder(true, 120, 12), STEEL, 235), forces, 160)!;
    expect(r1.sigma).toBeLessThan(r0.sigma);
  });
  it('sườn yếu bị giảm nhiều hơn sườn khoẻ (χ_c)', () => {
    const weak = effectiveSection(girder(true, 40, 6), STEEL, 235).N!.columns![0].chiC;
    const strong = effectiveSection(girder(true, 160, 16), STEEL, 235).N!.columns![0].chiC;
    expect(strong).toBeGreaterThan(weak);
  });
  it('cắt: sườn dọc tăng k_τ; ô bụng lớn nhất cũng được kiểm tra', () => {
    const s0 = checkLocal(girder(false), STEEL, [F({ Qy: 500 })], { fy: 235, stiffenerSpacing: 0 }).shear!;
    const s1 = checkLocal(girder(true, 120, 12), STEEL, [F({ Qy: 500 })], { fy: 235, stiffenerSpacing: 0 }).shear!;
    expect(s1.tauCr).toBeGreaterThan(s0.tauCr);
    // ô 1120 mm (không sườn ngang): τ_cr,ô = 5.34·σ_E(1120) là giới hạn trên
    const sigE = (h: number) => (Math.PI ** 2 * 200e3 * 64) / (12 * 0.91 * h * h);
    expect(s1.tauCr).toBeLessThanOrEqual(5.34 * sigE(1120) + 1e-9);
  });
  it('mặt cắt có sườn luôn được tính tiết diện hữu hiệu (kể cả khi các ô không phải loại 4)', () => {
    const r = checkLocal(girder(true, 120, 12), STEEL, [F({ Mz: 800 })], { fy: 235, stiffenerSpacing: 0 });
    expect(r.effective?.applicable).toBe(true);
    expect(r.effCheck).toBeTruthy();
  });
});

import { aeffIfClass4 } from '../src/core/effective';
import { checkBeamColumn } from '../src/core/beamColumn';
import { BUCKLING_MATERIALS } from '../src/core/stability';
import { force, support } from '../src/core/presets';

describe('Khoảng cách sườn ngang a', () => {
  it('a nhỏ hơn a_c làm tăng σ_cr,sl và A_eff', () => {
    const inf = aeffIfClass4(girder(true), STEEL, 235, 0)!;
    const a1 = aeffIfClass4(girder(true), STEEL, 235, 1000)!;
    expect(a1).toBeGreaterThan(inf);
    const r = effectiveSection(girder(true), STEEL, 235, 1000);
    expect(r.N!.columns![0].a).toBe(1000);
    expect(r.N!.columns![0].sigmaCrSl).toBeGreaterThan(effectiveSection(girder(true), STEEL, 235, 0).N!.columns![0].sigmaCrSl);
  });
  it('thông số cục bộ được truyền vào kiểm tra nén – uốn', () => {
    const m = {
      title: '', length: 6, material: { ...STEEL }, section: girder(true),
      supports: [support('A', 0, 'fixed')], hinges: [], loads: [force('P', 6, -20, -800)],
    };
    const r0 = checkBeamColumn(m, 1.5, BUCKLING_MATERIALS.CT3)!;
    const r1 = checkBeamColumn(m, 1.5, BUCKLING_MATERIALS.CT3, { fy: 235, stiffenerSpacing: 1000 })!;
    expect(r1.sigmaInter!).toBeLessThan(r0.sigmaInter!);
  });
});
