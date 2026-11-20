import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core/analysis';
import { designBeam } from '../src/core/design';
import { analyzeFrame, type FrameModel } from '../src/core/frame';
import { fmember, fnode, fsupport } from '../src/core/framePresets';
import { STEEL, support } from '../src/core/presets';
import { computeSection } from '../src/core/section';
import { densityOf, selfWeightPerM, type Model } from '../src/core/types';

const spec = { kind: 'rect', b: 200, h: 400 } as const;
const A = computeSection(spec).A; // 80000 mm²
const beam = (o: Partial<Model> = {}): Model => ({
  title: '', length: 6, material: { ...STEEL }, section: spec,
  supports: [support('A', 0, 'pin'), support('B', 6, 'roller')], hinges: [], loads: [], ...o,
});
const rel = (a: number, b: number) => Math.abs(a / b - 1);

describe('Khối lượng riêng và trọng lượng bản thân', () => {
  it('ρ mặc định là thép 7850 kg/m³; q = ρ·g·A', () => {
    expect(densityOf({ name: '', E: 200, nu: 0.3, allowable: 160 })).toBe(7850);
    expect(selfWeightPerM({ ...STEEL, density: 2500 }, A)).toBeCloseTo((2500 * 9.81 * 0.08) / 1000, 9);
  });
  it('dầm nằm ngang: phản lực = qL/2', () => {
    const conc = { name: 'Bê tông', E: 27.5, nu: 0.2, allowable: 11.5, density: 2500 };
    const r = analyze(beam({ material: conc, selfWeight: 'y' }));
    const q = (2500 * 9.81 * 0.08) / 1000;
    expect(rel(r.reactions[0].Fy, (q * 6) / 2)).toBeLessThan(1e-6);
    expect(rel(r.internalAt(3, 'left').Mz, (q * 36) / 8)).toBeLessThan(1e-6);
  });
  it('cột đứng chân tại x = 0: lực dọc chân cột = −qL (nén)', () => {
    const r = analyze(beam({ supports: [support('A', 0, 'fixed')], selfWeight: 'x' }));
    const q = selfWeightPerM(STEEL, A);
    expect(rel(r.internalAt(0, 'right').N, -q * 6)).toBeLessThan(1e-9);
    expect(Math.abs(r.internalAt(6, 'left').N)).toBeLessThan(1e-9);
  });
  it('khung: tổng phản lực đứng = Σ ρ_i·g·A_i·L_i theo vật liệu từng thanh', () => {
    const A1 = fnode('A', 0, 0), C = fnode('C', 0, 4), D = fnode('D', 6, 4), B = fnode('B', 6, 0);
    const conc = { id: 'bt', name: 'Bê tông', E: 27.5, nu: 0.2, allowable: 11.5, density: 2500 };
    const S = { id: 's', name: 's', spec };
    const m: FrameModel = {
      title: '', material: { ...STEEL }, materials: [conc], sections: [S], nodes: [A1, C, D, B],
      members: [fmember('AC', A1, C, 's'), { ...fmember('CD', C, D, 's'), materialId: 'bt' }, fmember('BD', B, D, 's')],
      supports: [fsupport(A1, 'fixed'), fsupport(B, 'fixed')], loads: [], selfWeight: true,
    };
    const r = analyzeFrame(m);
    const sumRy = r.reactions.reduce((a, x) => a + x.Ry, 0);
    const expected = selfWeightPerM(STEEL, A) * 8 + selfWeightPerM(conc, A) * 6;
    expect(rel(sumRy, expected)).toBeLessThan(1e-9);
  });
  it('chọn số hiệu thép không cộng trọng lượng bản thân hai lần', () => {
    const opt = { family: 'I_GOST', rotate: false, deflRatio: 0, selfWeight: true, stability: false, mu: 1 };
    const withLoad = { ...beam(), loads: [{ id: 'q', type: 'distributed' as const, name: 'q', x1: 0, x2: 6, dir: 'y' as const, q1: -10, q2: -10 }] };
    const a = designBeam(withLoad, opt);
    const b = designBeam({ ...withLoad, selfWeight: 'y' }, opt);
    a.forEach((c, i) => expect(rel(b[i].sigma, c.sigma)).toBeLessThan(1e-9));
  });
});

import { beamSelfWeightNtd, selfWeightColumn } from '../src/core/stability';

describe('Thẻ ổn định chế độ dầm dùng N_tđ khi có trọng lượng bản thân', () => {
  const col = (P: number): Model => ({
    title: '', length: 8, material: { ...STEEL }, section: { kind: 'catalog', family: 'CHS', name: 'Ø168.3×6.3', rotate: false },
    supports: [support('A', 0, 'fixed')], hinges: [], selfWeight: 'x',
    loads: [{ id: 'p', type: 'force', name: 'P', x: 8, Fx: -P, Fy: 0, Fz: 0 }],
  });
  it('lực ở đỉnh lấy đúng P; N_tđ trùng với chế độ Ổn định', () => {
    const m = col(120);
    const res = analyze(m);
    const sw = beamSelfWeightNtd(m, res, 2)!;
    expect(sw.Nbase - sw.G).toBeCloseTo(120, 6);
    const ref = selfWeightColumn(m.section, res.section!, m.material, { N: 120, L: 8, Ly: 8, sameL: true, muZ: 2, muY: 2 });
    expect(sw.Ntd).toBeCloseTo(ref.Ntd, 9);
    expect(sw.Ntd).toBeGreaterThan(120);
    expect(sw.Ntd).toBeLessThan(120 + sw.G);
  });
  it('không áp dụng khi trọng lượng bản thân theo −y hoặc không bật', () => {
    const m = { ...col(120), selfWeight: 'y' as const };
    expect(beamSelfWeightNtd(m, analyze(m), 2)).toBeNull();
    const n = { ...col(120), selfWeight: undefined };
    expect(beamSelfWeightNtd(n, analyze(n), 2)).toBeNull();
  });
  it('chọn số hiệu với điều kiện ổn định dùng N_tđ (không thận trọng hơn cách lấy N + G)', () => {
    const opt = { family: 'CHS', rotate: false, deflRatio: 0, selfWeight: false, stability: true, mu: 2 };
    const c = designBeam(col(120), opt);
    const ok = c.find((x) => x.ok)!;
    expect(ok).toBeTruthy();
    expect(ok.stabUtil).toBeGreaterThan(0);
  });
});
