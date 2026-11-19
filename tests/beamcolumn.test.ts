import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core/analysis';
import { STEEL, dist, force, support } from '../src/core/presets';
import type { Model, Support } from '../src/core/types';

const D = 100;
const L = 4;
const EI = 200e9 * ((Math.PI * D ** 4) / 64) * 1e-12; // N·m²
const P = 100; // kN nén
const col = (supports: Support[], extra: Model['loads'] = []): Model => ({
  title: '', length: L, material: { ...STEEL }, section: { kind: 'circle', D },
  supports, hinges: [], loads: [force('P', L, 0, -P), ...extra],
});
const rel = (a: number, b: number) => Math.abs(a / b - 1);
const slider = (name: string, x: number): Support => {
  const s = support(name, x, 'custom');
  s.restraints = { ux: false, uy: true, uz: true, rx: false, ry: true, rz: true };
  return s;
};

describe('Hệ số tới hạn (bài toán trị riêng) — lực Euler', () => {
  const cases: [string, Support[], number][] = [
    ['khớp – khớp (μ = 1)', [support('A', 0, 'pin'), support('B', L, 'roller')], 1],
    ['ngàm – tự do (μ = 2)', [support('A', 0, 'fixed')], 2],
    ['ngàm – khớp (μ = 0.699)', [support('A', 0, 'fixed'), support('B', L, 'roller')], 0.6992],
    ['ngàm – ngàm trượt dọc (μ = 0.5)', [support('A', 0, 'fixed'), slider('B', L)], 0.5],
  ];
  for (const [name, sup, mu] of cases) {
    it(name, () => {
      const r = analyze(col(sup), { buckling: true });
      const Ncr = (Math.PI ** 2 * EI) / (mu * L) ** 2 / 1e3;
      expect(r.buckling.bendY).toBeDefined();
      expect(rel(r.buckling.bendY!.alpha * P, Ncr)).toBeLessThan(2e-3);
      // tiết diện tròn: hai mặt phẳng như nhau
      expect(rel(r.buckling.bendZ!.alpha, r.buckling.bendY!.alpha)).toBeLessThan(1e-6);
    });
  }
});

describe('Phân tích bậc hai (P-Δ)', () => {
  const q = 5; // kN/m
  const m = col([support('A', 0, 'pin'), support('B', L, 'roller')], [dist('q', 0, L, -q)]);
  const r1 = analyze(m);
  const r2 = analyze(m, { secondOrder: true });
  it('mô men giữa nhịp khớp lời giải Timoshenko M = (qL²/8)·2(sec u − 1)/u²', () => {
    const k = Math.sqrt((P * 1e3) / EI);
    const u = (k * L) / 2;
    const psi = (2 * (1 / Math.cos(u) - 1)) / (u * u);
    const M0 = (q * L * L) / 8;
    expect(rel(r1.internalAt(L / 2, "left").Mz, M0)).toBeLessThan(1e-6);
    expect(rel(r2.internalAt(L / 2, 'left').Mz, M0 * psi)).toBeLessThan(3e-3);
  });
  it('độ võng khuếch đại xấp xỉ 1/(1 − N/N_E)', () => {
    const NE = (Math.PI ** 2 * EI) / L ** 2 / 1e3;
    const amp = r2.displacementAt(L / 2).v / r1.displacementAt(L / 2).v;
    expect(rel(amp, 1 / (1 - P / NE))).toBeLessThan(0.01);
  });
  it('cân bằng ở cuối thanh (kể P-Δ) ≈ 0 và mô men tại gối = 0', () => {
    expect(Math.abs(r2.internalAt(L, 'left').Mz)).toBeLessThan(1e-6);
  });
  it('lực nén vượt tới hạn → báo mất ổn định', () => {
    const big = col([support('A', 0, 'pin'), support('B', L, 'roller')]);
    big.loads = [force('P', L, 0, -5000)];
    const r = analyze(big, { secondOrder: true });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('vượt lực tới hạn');
  });
});

import { analyzeFrame, type FrameModel } from '../src/core/frame';
import { fdist, fmember, fnode, fnodeLoad, fsupport } from '../src/core/framePresets';

describe('Ổn định và P-Δ của khung', () => {
  const h = 4, span = 6, Pv = 200;
  const colSec = { id: 'c', name: 'Cột', spec: { kind: 'rect', b: 200, h: 300 } as const };
  const beamSec = { id: 'b', name: 'Dầm', spec: { kind: 'rect', b: 300, h: 3000 } as const };
  const EIc = 200e9 * ((200 * 300 ** 3) / 12) * 1e-12;
  const portal = (base: 'fixed' | 'pin', H = 0): FrameModel => {
    const A = fnode('A', 0, 0), C = fnode('C', 0, h), D = fnode('D', span, h), B = fnode('B', span, 0);
    return {
      title: '', material: { ...STEEL }, sections: [colSec, beamSec], nodes: [A, C, D, B],
      members: [fmember('AC', A, C, 'c'), fmember('CD', C, D, 'b'), fmember('BD', B, D, 'c')],
      supports: [fsupport(A, base), fsupport(B, base)],
      loads: [fnodeLoad('P1', C, H, -Pv), fnodeLoad('P2', D, 0, -Pv)],
    };
  };
  it('khung chân ngàm, dầm rất cứng: cột mất ổn định có chuyển vị ngang, μ = 1', () => {
    const r = analyzeFrame(portal('fixed'), { buckling: true });
    const Ncr = (Math.PI ** 2 * EIc) / h ** 2 / 1e3;
    expect(rel(r.buckling!.alpha * Pv, Ncr)).toBeLessThan(0.01);
  });
  it('khung chân khớp, dầm rất cứng: μ = 2', () => {
    const r = analyzeFrame(portal('pin'), { buckling: true });
    const Ncr = (Math.PI ** 2 * EIc) / (2 * h) ** 2 / 1e3;
    expect(rel(r.buckling!.alpha * Pv, Ncr)).toBeLessThan(0.01);
  });
  it('P-Δ: chuyển vị ngang khuếch đại ≈ 1/(1 − 1/α)', () => {
    const m = portal('fixed', 10);
    const a = analyzeFrame(m, { buckling: true }).buckling!.alpha;
    const u1 = analyzeFrame(m).nodeDisp[1].ux;
    const u2 = analyzeFrame(m, { secondOrder: true }).nodeDisp[1].ux;
    expect(rel(u2 / u1, 1 / (1 - 1 / a))).toBeLessThan(0.03);
  });
  it('cột khớp hai đầu dựng bằng khung: P-Δ trùng bộ giải dầm', () => {
    const A = fnode('A', 0, 0), B = fnode('B', 0, L);
    const sec = { id: 's', name: 's', spec: { kind: 'circle', D } as const };
    const mem = fmember('AB', A, B, 's');
    const fm: FrameModel = {
      title: '', material: { ...STEEL }, sections: [sec], nodes: [A, B], members: [mem],
      supports: [fsupport(A, 'pin'), fsupport(B, 'roller', 90)],
      loads: [fnodeLoad('P', B, 0, -P), fdist('q', mem, 0, L, 5, 5, 'gx')],
    };
    const r = analyzeFrame(fm, { secondOrder: true });
    expect(r.ok).toBe(true);
    const k = Math.sqrt((P * 1e3) / EI);
    const u = (k * L) / 2;
    const psi = (2 * (1 / Math.cos(u) - 1)) / (u * u);
    expect(rel(Math.abs(r.members[0].internalAt(L / 2, 'left').M), ((5 * L * L) / 8) * psi)).toBeLessThan(5e-3);
    const rb = analyzeFrame(fm, { buckling: true });
    expect(rel(rb.buckling!.alpha * P, (Math.PI ** 2 * EI) / L ** 2 / 1e3)).toBeLessThan(2e-3);
  });
});

import { checkBeamColumn, checkFrameMember, frameAnalyses } from '../src/core/beamColumn';
import { BUCKLING_MATERIALS } from '../src/core/stability';
import { FRAME_PRESETS } from '../src/core/framePresets';
import { PRESETS } from '../src/core/presets';

describe('Kiểm tra nén – uốn đồng thời', () => {
  it('cột công-xôn: M chân cột bậc hai = H·tan(kL)/k', () => {
    const m = PRESETS.find((p) => p.key === 'column')!.build(); // ống 219×8, L = 4, P = 200 nén, H = 5
    const r = checkBeamColumn(m, 1.5, BUCKLING_MATERIALS.CT3)!;
    const EIt = 200e9 * ((Math.PI * (219 ** 4 - 203 ** 4)) / 64) * 1e-12;
    const k = Math.sqrt(200e3 / EIt);
    const exact = (5 * Math.tan(k * 4)) / k;
    expect(rel(r.planes[0].M1, 20)).toBeLessThan(1e-6);
    expect(rel(r.planes[0].M2, exact)).toBeLessThan(3e-3);
    expect(r.planes[0].mu).toBeCloseTo(2, 2);
    expect(r.sigma2!).toBeGreaterThan(r.sigma1);
    expect(r.sigmaN!).toBeGreaterThan(1.5 * r.sigma2! * 0.999);
  });
  it('khung: kiểm tra từng cột, μ trong mặt phẳng từ phân tích ổn định', () => {
    const m = FRAME_PRESETS.find((p) => p.key === 'portal-fixed')!.build();
    const a = frameAnalyses(m, 1.5);
    const col = m.members.find((x) => x.name === 'AC')!;
    const r = checkFrameMember(a, col.id, 1, m, BUCKLING_MATERIALS.CT3)!;
    expect(r).not.toBeNull();
    expect(r.planes[0].mu!).toBeGreaterThan(0.5);
    expect(r.planes[0].mu!).toBeLessThan(2);
    expect(r.sigmaInter!).toBeGreaterThan(0);
  });
});
