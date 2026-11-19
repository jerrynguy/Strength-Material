import { describe, expect, it } from 'vitest';
import { checkEffective, effectiveSection } from '../src/core/effective';
import { STEEL } from '../src/core/presets';
import { computeSection } from '../src/core/section';
import type { SectionSpec } from '../src/core/types';

const E = 200e3, nu = 0.3;
const sigE = (t: number, c: number) => (Math.PI ** 2 * E * t * t) / (12 * (1 - nu * nu) * c * c);
const rel = (a: number, b: number) => Math.abs(a / b - 1);

describe('Tiết diện hữu hiệu (EN 1993-1-5)', () => {
  it('IPE 600 chịu nén: khoét giữa bụng c(1 − ρ), ρ = (λ̄p − 0.22)/λ̄p²', () => {
    const spec: SectionSpec = { kind: 'catalog', family: 'IPE', name: 'IPE 600', rotate: false };
    const eff = effectiveSection(spec, STEEL, 235);
    const c = 600 - 2 * 19 - 2 * 24, t = 12;
    const lp = Math.sqrt(235 / (4 * sigE(t, c)));
    const rho = (lp - 0.055 * 4) / (lp * lp);
    const A = computeSection(spec).A;
    expect(rho).toBeLessThan(1);
    expect(rel(eff.N!.Aeff, A - c * (1 - rho) * t)).toBeLessThan(1e-6);
    // đối xứng: trọng tâm không dịch
    expect(Math.abs(eff.N!.eNy)).toBeLessThan(1e-6);
  });

  it('cánh vươn mảnh (hàn): khoét ở mép tự do, A_eff = A − 4(1 − ρ)c·t', () => {
    const spec: SectionSpec = { kind: 'I', bt: 400, tt: 8, hw: 200, tw: 10, bb: 400, tb: 8 };
    const eff = effectiveSection(spec, STEEL, 235);
    const c = (400 - 10) / 2, t = 8;
    const lp = Math.sqrt(235 / (0.43 * sigE(t, c)));
    const rho = (lp - 0.188) / (lp * lp);
    const A = computeSection(spec).A;
    expect(rel(eff.N!.Aeff, A - 4 * (1 - rho) * c * t)).toBeLessThan(1e-6);
    const fl = eff.N!.plates.find((p) => p.name === 'Cánh trên – phải')!;
    expect(fl.removed![1]).toBeCloseTo(c, 6);
  });

  it('dầm hàn bụng mảnh chịu uốn: hội tụ, b_e1 = 0.4·b_eff, W_eff < W_el', () => {
    const spec: SectionSpec = { kind: 'I', bt: 320, tt: 18, hw: 1400, tw: 8, bb: 320, tb: 18 };
    const eff = effectiveSection(spec, STEEL, 235);
    const st = eff.MzPos!;
    const web = st.plates.find((p) => p.name === 'Bản bụng')!;
    expect(web.rho).toBeLessThan(1);
    expect(st.iterations).toBeLessThan(12);
    // vùng nén ở phía trên (p2), b_e1 = 0.4 b_eff đo từ mép trên
    expect(web.removed![1]).toBeCloseTo(web.c - 0.4 * web.beff, 6);
    const g = computeSection(spec);
    expect(st.Weff).toBeLessThan(g.Iz / Math.max(g.yMax, -g.yMin));
    // M < 0 đối xứng với M > 0 (tiết diện đối xứng)
    expect(rel(eff.MzNeg!.Weff, st.Weff)).toBeLessThan(1e-6);
  });

  it('kiểm tra σ = N/A_eff + M/W_eff', () => {
    const spec: SectionSpec = { kind: 'catalog', family: 'IPE', name: 'IPE 600', rotate: false };
    const eff = effectiveSection(spec, STEEL, 235);
    const r = checkEffective(eff, [{ N: -1000, Qy: 0, Qz: 0, T: 0, Mz: 100, My: 0 }], 160)!;
    expect(r.sigma).toBeCloseTo(1e6 / eff.N!.Aeff + 100e6 / eff.MzPos!.Weff, 6);
  });

  it('mặt cắt ống / đặc: không áp dụng', () => {
    expect(effectiveSection({ kind: 'tube', D: 500, t: 5 }, STEEL, 235).applicable).toBe(false);
  });
});

import { analyze } from '../src/core/analysis';
import { checkLTB } from '../src/core/ltb';
import { dist, support } from '../src/core/presets';
import { checkStability, BUCKLING_MATERIALS } from '../src/core/stability';
import { aeffIfClass4 } from '../src/core/effective';

describe('Dùng tiết diện hữu hiệu trong kiểm tra ổn định', () => {
  it('cột loại 4: σ = N/A_eff', () => {
    const spec: SectionSpec = { kind: 'catalog', family: 'IPE', name: 'IPE 600', rotate: false };
    const sec = computeSection(spec);
    const Aeff = aeffIfClass4(spec, STEEL, 240)!;
    expect(Aeff).toBeLessThan(sec.A);
    const r = checkStability(sec, { N: 500, Lz: 3, Ly: 3, muZ: 1, muY: 1, E: 200, allowable: 160, params: BUCKLING_MATERIALS.CT3, nRequired: 1, Aeff });
    expect(r.sigma).toBeCloseTo(500e3 / Aeff, 9);
  });
  it('tiết diện loại 1 không có A_eff', () => {
    expect(aeffIfClass4({ kind: 'catalog', family: 'IPE', name: 'IPE 300', rotate: false }, STEEL, 240)).toBeUndefined();
  });
  it('uốn – xoắn dầm bụng mảnh dùng W_eff < W_el', () => {
    const m = {
      title: '', length: 12, material: { ...STEEL }, section: { kind: 'I', bt: 320, tt: 18, hw: 1400, tw: 8, bb: 320, tb: 18 } as SectionSpec,
      supports: [support('A', 0, 'pin'), support('B', 12, 'roller')], hinges: [], loads: [dist('q', 0, 12, -40)],
    };
    const r = checkLTB(m, analyze(m), { loadHeight: 'sc', braces: [], fy: 240, curve: 'auto' });
    const g = computeSection(m.section);
    expect(r.W).toBeLessThan(g.Iz / Math.max(g.yMax, -g.yMin));
  });
});
