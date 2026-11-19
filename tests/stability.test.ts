import { describe, expect, it } from 'vitest';
import { computeSection } from '../src/core/section';
import { BUCKLING_MATERIALS, checkStability, criticalStress, phiOf, trialDesign } from '../src/core/stability';
import { STEEL_FAMILIES } from '../src/core/steelTables';

const CT3 = BUCKLING_MATERIALS.CT3;
const base = { N: 50, Lz: 2, Ly: 2, muZ: 1, muY: 1, E: 200, allowable: 160, params: CT3, nRequired: 2 };

describe('Ổn định thanh chịu nén', () => {
  it('Euler: thanh tròn D40, L = 2 m, khớp hai đầu → λ = 200, P_th = π²EI/L²', () => {
    const sec = computeSection({ kind: 'circle', D: 40 });
    const r = checkStability(sec, base);
    expect(r.lambdaMax).toBeCloseTo(200, 6);
    expect(r.regime).toBe('euler');
    const I = (Math.PI * 40 ** 4) / 64;
    expect(r.Pcr).toBeCloseTo((Math.PI ** 2 * 200e3 * I) / 2000 ** 2 / 1e3, 6);
    expect(r.phi).toBeCloseTo(0.19, 6);
  });
  it('μ = 2 (công-xôn) nhân đôi chiều dài tính toán', () => {
    const sec = computeSection({ kind: 'circle', D: 80 });
    const a = checkStability(sec, base), b = checkStability(sec, { ...base, muZ: 2, muY: 2 });
    expect(b.lambdaMax).toBeCloseTo(2 * a.lambdaMax, 9);
  });
  it('Iasinski CT3: λ = 80 → σ_th = 310 − 1.14·80; liên tục với Euler tại λ₀', () => {
    expect(criticalStress(CT3, 200e3, 80).sigma).toBeCloseTo(218.8, 6);
    const e = criticalStress(CT3, 200e3, 100).sigma, j = 310 - 114;
    expect(Math.abs(e - j) / e).toBeLessThan(0.01);
    expect(criticalStress(CT3, 200e3, 30)).toEqual({ sigma: 240, regime: 'short' });
  });
  it('nội suy bảng φ', () => {
    expect(phiOf(CT3, 85)).toBeCloseTo(0.72, 9);
    expect(phiOf(CT3, 250)).toBeNull();
  });
  it('thép góc: dùng trục chính, i_min L100×10 ≈ 1.96 cm', () => {
    const sec = computeSection({ kind: 'catalog', family: 'L_GOST', name: 'L100×10', rotate: false });
    const r = checkStability(sec, base);
    expect(r.principal).toBe(true);
    expect(Math.abs(r.governing.i / 19.6 - 1)).toBeLessThan(0.02);
  });
  it('thử dần chọn tiết diện I: kết quả đạt, số hiệu nhỏ hơn liền kề không đạt', () => {
    const fam = STEEL_FAMILIES.find((f) => f.key === 'I_GOST')!;
    const cands = fam.profiles.map((p) => ({ name: p.name, sec: computeSection({ kind: 'catalog', family: 'I_GOST', name: p.name, rotate: false }) }));
    const inp = { ...base, N: 300, Lz: 3, Ly: 3 };
    const d = trialDesign(cands, inp);
    expect(d.chosen).not.toBeNull();
    const i = cands.findIndex((c) => c.name === d.chosen);
    expect(checkStability(cands[i].sec, inp).okPhi).toBe(true);
    expect(checkStability(cands[i - 1].sec, inp).okPhi).toBe(false);
  });
});

it('thử dần: thanh quá mảnh với mọi số hiệu → báo không có, không lặp vô nghĩa', () => {
  const fam = STEEL_FAMILIES.find((f) => f.key === 'I_GOST')!;
  const cands = fam.profiles.map((p) => ({ name: p.name, sec: computeSection({ kind: 'catalog', family: 'I_GOST', name: p.name, rotate: false }) }));
  const d = trialDesign(cands, { ...base, N: 200, Lz: 4, Ly: 4, muZ: 2, muY: 2 });
  expect(d.chosen).toBeNull();
  expect(d.steps.length).toBeLessThanOrEqual(3);
  const ok = trialDesign(cands.map((c) => c), { ...base, N: 200, Lz: 2, Ly: 2, muZ: 2, muY: 2 });
  expect(ok.chosen).not.toBeNull();
});
