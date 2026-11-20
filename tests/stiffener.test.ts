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

import { memberLocal, type FrameModel } from '../src/core/frame';
import { designFrame } from '../src/core/design';
import { fmember, fnode, fnodeLoad, fsupport, fdist } from '../src/core/framePresets';
import { checkFrameMember, frameAnalyses } from '../src/core/beamColumn';

describe('Khoảng cách sườn ngang riêng từng thanh khung', () => {
  it('memberLocal: bỏ trống → dùng giá trị chung; 0 → không có sườn ngang', () => {
    const g = { fy: 235, stiffenerSpacing: 1500 };
    expect(memberLocal(g, {}).stiffenerSpacing).toBe(1500);
    expect(memberLocal(g, { stiffenerSpacing: 0 }).stiffenerSpacing).toBe(0);
    expect(memberLocal(g, { stiffenerSpacing: 900 })).toEqual({ fy: 235, stiffenerSpacing: 900 });
  });
  const frame = (aAC?: number): FrameModel => {
    const A = fnode('A', 0, 0), C = fnode('C', 0, 6), D = fnode('D', 10, 6), B = fnode('B', 10, 0);
    const col = { id: 'c', name: 'Cột', spec: { kind: 'I', bt: 300, tt: 16, hw: 1000, tw: 6, bb: 300, tb: 16, stiffeners: [{ pos: 500, b: 80, t: 8, sides: 2 }] } as SectionSpec };
    const beam = { id: 'd', name: 'Dầm', spec: { kind: 'catalog', family: 'H_JIS', name: 'H500×200×10×16', rotate: false } as SectionSpec };
    const ac = { ...fmember('AC', A, C, 'c'), stiffenerSpacing: aAC };
    const cd = fmember('CD', C, D, 'd');
    return {
      title: '', material: { ...STEEL }, sections: [col, beam], nodes: [A, C, D, B],
      members: [ac, cd, fmember('BD', B, D, 'c')],
      supports: [fsupport(A, 'fixed'), fsupport(B, 'fixed')],
      loads: [fdist('q', cd, 0, 10, -80), fnodeLoad('W', C, 20, 0)],
    };
  };
  it('thanh có a riêng nhỏ cho kết quả nén – uốn tốt hơn thanh dùng a chung = ∞', () => {
    const m = frame(1000);
    const a = frameAnalyses(m, 1.5);
    const g = { fy: 235, stiffenerSpacing: 0 };
    const ac = m.members[0], bd = m.members[2];
    const rAC = checkFrameMember(a, ac.id, 1, m, BUCKLING_MATERIALS.CT3, memberLocal(g, ac))!;
    const rACinf = checkFrameMember(a, ac.id, 1, m, BUCKLING_MATERIALS.CT3, memberLocal(g, bd))!;
    expect(rAC.sigmaInter!).toBeLessThan(rACinf.sigmaInter!);
  });
  it('chọn tiết diện khung dùng a riêng của từng thanh', () => {
    const opt = { family: 'H_JIS', rotate: false, deflRatio: 0, selfWeight: false, stability: false, mu: 1, local: { fy: 235, stiffenerSpacing: 0 } };
    const m0 = frame(undefined), m1 = frame(1000);
    // đổi tiết diện dầm, cột giữ nguyên → chỉ so sánh để đảm bảo chạy được với a riêng
    expect(designFrame(m1, 'd', opt).length).toBe(designFrame(m0, 'd', opt).length);
  });
});

import { withYield } from '../src/core/frame';

describe('f_y riêng từng thanh khung', () => {
  const frame = (aAC?: number): FrameModel => {
    const A = fnode('A', 0, 0), C = fnode('C', 0, 6), D = fnode('D', 10, 6), B = fnode('B', 10, 0);
    const col = { id: 'c', name: 'Cột', spec: { kind: 'I', bt: 300, tt: 16, hw: 1000, tw: 6, bb: 300, tb: 16, stiffeners: [{ pos: 500, b: 80, t: 8, sides: 2 }] } as SectionSpec };
    const beam = { id: 'd', name: 'Dầm', spec: { kind: 'catalog', family: 'H_JIS', name: 'H500×200×10×16', rotate: false } as SectionSpec };
    const ac = { ...fmember('AC', A, C, 'c'), stiffenerSpacing: aAC };
    const cd = fmember('CD', C, D, 'd');
    return {
      title: '', material: { ...STEEL }, sections: [col, beam], nodes: [A, C, D, B],
      members: [ac, cd, fmember('BD', B, D, 'c')],
      supports: [fsupport(A, 'fixed'), fsupport(B, 'fixed')],
      loads: [fdist('q', cd, 0, 10, -80), fnodeLoad('W', C, 20, 0)],
    };
  };

  it('memberLocal: f_y riêng ghi đè f_y chung, bỏ trống thì dùng chung', () => {
    const g = { fy: 235, stiffenerSpacing: 0 };
    expect(memberLocal(g, { fy: 355 }).fy).toBe(355);
    expect(memberLocal(g, {}).fy).toBe(235);
    expect(memberLocal(g, { fy: 355, stiffenerSpacing: 800 })).toEqual({ fy: 355, stiffenerSpacing: 800 });
  });
  it('withYield thay σ_ch (chỉ khi bảng có σ_ch)', () => {
    expect(withYield(BUCKLING_MATERIALS.CT3, 355).sigmaY).toBe(355);
    expect(withYield(BUCKLING_MATERIALS.wood, 355).sigmaY).toBe(0);
  });
  it('f_y lớn hơn → ε nhỏ hơn → giới hạn c/t chặt hơn', () => {
    const r235 = checkLocal(girder(false), STEEL, [F({ N: -100 })], { fy: 235, stiffenerSpacing: 0 });
    const r355 = checkLocal(girder(false), STEEL, [F({ N: -100 })], { fy: 355, stiffenerSpacing: 0 });
    const fl = (r: typeof r235) => r.plates.find((p) => p.name === 'Cánh trên – phải')!.limits[2];
    expect(fl(r355)).toBeLessThan(fl(r235));
  });
  it('kiểm tra nén – uốn của thanh dùng f_y riêng làm σ_ch', () => {
    const m = frame(undefined);
    m.members[0].fy = 355;
    const a = frameAnalyses(m, 1.5);
    const g = { fy: 235, stiffenerSpacing: 0 };
    const ml = memberLocal(g, m.members[0]);
    const r = checkFrameMember(a, m.members[0].id, 1, m, withYield(BUCKLING_MATERIALS.CT3, ml.fy), ml)!;
    expect(r.sigmaY).toBe(355);
    const rb = checkFrameMember(a, m.members[2].id, 1, m, withYield(BUCKLING_MATERIALS.CT3, memberLocal(g, m.members[2]).fy), memberLocal(g, m.members[2]))!;
    expect(rb.sigmaY).toBe(235);
  });
});
