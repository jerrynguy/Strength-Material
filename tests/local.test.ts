import { describe, expect, it } from 'vitest';
import { checkLocal, kInternal, kOutstand } from '../src/core/localBuckling';
import { STEEL } from '../src/core/presets';
import type { InternalForces, SectionSpec } from '../src/core/types';

const F = (o: Partial<InternalForces>): InternalForces => ({ N: 0, Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0, ...o });
const opt = { fy: 235, stiffenerSpacing: 0 };
const cat = (family: string, name: string): SectionSpec => ({ kind: 'catalog', family, name, rotate: false });
const web = (r: ReturnType<typeof checkLocal>) => r.plates.find((p) => p.name === 'Bản bụng')!;
const flange = (r: ReturnType<typeof checkLocal>) => r.plates.find((p) => p.name.startsWith('Cánh trên'))!;

describe('Hệ số k_σ (EN 1993-1-5)', () => {
  it('tấm trong: nén đều 4.0, uốn thuần tuý 23.9', () => {
    expect(kInternal(1)).toBe(4);
    expect(kInternal(-1)).toBe(23.9);
    expect(kInternal(0)).toBeCloseTo(7.81, 9);
  });
  it('tấm vươn: nén đều 0.43', () => {
    expect(kOutstand(1, true)).toBeCloseTo(0.43, 9);
    expect(kOutstand(1, false)).toBeCloseTo(0.43, 9);
  });
});

describe('Phân loại tiết diện (EN 1993-1-1 bảng 5.2, S235)', () => {
  it('IPE 300 chịu nén: bụng c/t = 35.0 → loại 2; cánh loại 1', () => {
    const r = checkLocal(cat('IPE', 'IPE 300'), STEEL, [F({ N: -500 })], opt);
    expect(web(r).ct).toBeCloseTo(35.0, 1);
    expect(web(r).cls).toBe(2);
    expect(flange(r).cls).toBe(1);
    expect(r.sectionClass).toBe(2);
    expect(web(r).k).toBeCloseTo(4, 6);
  });
  it('IPE 300 chịu uốn: bụng loại 1 (c/t ≤ 72ε), ψ = −1', () => {
    const r = checkLocal(cat('IPE', 'IPE 300'), STEEL, [F({ Mz: 50 })], opt);
    expect(web(r).psi).toBeCloseTo(-1, 6);
    expect(Math.abs(web(r).k - 23.9)).toBeLessThan(0.05);
    expect(r.sectionClass).toBe(1);
    // chỉ cánh trên chịu nén khi M > 0 (căng thớ dưới)
    expect(r.plates.find((p) => p.name.startsWith('Cánh dưới'))!.cls).toBe(0);
  });
  it('IPE 600 chịu nén: loại 4 (bụng c/t = 42.8 > 42ε), ρ < 1', () => {
    const r = checkLocal(cat('IPE', 'IPE 600'), STEEL, [F({ N: -1000 })], opt);
    expect(web(r).cls).toBe(4);
    expect(r.sectionClass).toBe(4);
    expect(web(r).rho).toBeLessThan(1);
  });
  it('σ_cr = k·π²E/(12(1−ν²))·(t/c)²', () => {
    const r = checkLocal(cat('IPE', 'IPE 300'), STEEL, [F({ N: -500 })], opt);
    const w = web(r);
    expect(w.sigmaCr).toBeCloseTo((4 * Math.PI ** 2 * 200e3 * w.t ** 2) / (12 * 0.91 * w.c ** 2), 6);
  });
  it('ống tròn: D/t ≤ 50ε² loại 1; D/t = 100 → loại 4', () => {
    expect(checkLocal(cat('CHS', 'Ø114.3×4.5'), STEEL, [F({ N: -100 })], opt).tube!.cls).toBe(1);
    expect(checkLocal({ kind: 'tube', D: 500, t: 5 }, STEEL, [F({ N: -100 })], opt).tube!.cls).toBe(4);
  });
});

describe('Ổn định bản bụng chịu cắt', () => {
  const welded: SectionSpec = { kind: 'I', bt: 300, tt: 20, hw: 1000, tw: 8, bb: 300, tb: 20 };
  it('h_w/t_w = 125 > 72ε/η: λ̄_w = h_w/(86.4·t_w·ε), χ_w = 0.83/λ̄_w', () => {
    // hằng số 86.4 trong EN ứng với E = 210 GPa
    const r = checkLocal(welded, { ...STEEL, E: 210 }, [F({ Qy: 300, Mz: 100 })], opt);
    const s = r.shear!;
    expect(s.needCheck).toBe(true);
    expect(s.lambdaW).toBeCloseTo(1000 / (86.4 * 8), 2);
    expect(s.chiW).toBeCloseTo(0.83 / s.lambdaW, 9);
  });
  it('sườn ngang a = h_w làm tăng k_τ lên 9.34', () => {
    const r = checkLocal(welded, STEEL, [F({ Qy: 300 })], { fy: 235, stiffenerSpacing: 1000 });
    expect(r.shear!.kTau).toBeCloseTo(9.34, 6);
  });
  it('IPE 600: bụng không cần kiểm tra cắt (h_w/t_w ≤ 72ε/η)', () => {
    expect(checkLocal(cat('IPE', 'IPE 600'), STEEL, [F({ Qy: 100 })], opt).shear!.needCheck).toBe(false);
  });
});
