import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core/analysis';
import { checkLTB, type LtbOptions } from '../src/core/ltb';
import { STEEL, dist, force, moment, support } from '../src/core/presets';
import { computeSection } from '../src/core/section';
import type { Model } from '../src/core/types';

const spec = { kind: 'catalog', family: 'IPE', name: 'IPE 300', rotate: false } as const;
const sec = computeSection(spec);
const L = 6;
const E = 200e9, G = E / 2.6;
const EIy = E * sec.Iy * 1e-12, GIt = G * sec.torsion.J * 1e-12, EIw = E * sec.ltb!.Iw * 1e-18;
const Mcr0 = ((Math.PI ** 2 * EIy) / L ** 2) * Math.sqrt(EIw / EIy + (L ** 2 * GIt) / (Math.PI ** 2 * EIy)) / 1e3;
const opt = (o: Partial<LtbOptions> = {}): LtbOptions => ({ loadHeight: 'sc', braces: [], fy: 240, curve: 'auto', ...o });
const beam = (loads: Model['loads']): Model => ({
  title: '', length: L, material: { ...STEEL }, section: spec,
  supports: [support('A', 0, 'pin'), support('B', L, 'roller')], hinges: [], loads,
});
const run = (m: Model, o?: Partial<LtbOptions>) => checkLTB(m, analyze(m), opt(o));
const rel = (a: number, b: number) => Math.abs(a / b - 1);

describe('Ổn định uốn – xoắn', () => {
  it('I_w của IPE 300 ≈ 125.9·10⁹ mm⁶ (bảng EN)', () => {
    expect(rel(sec.ltb!.Iw, 125.9e9)).toBeLessThan(0.03);
  });
  it('I_t của IPE 300 ≈ 20.12 cm⁴, HEB 300 ≈ 185 cm⁴ (bảng EN, kể góc lượn)', () => {
    expect(rel(sec.torsion.J / 1e4, 20.12)).toBeLessThan(0.02);
    expect(rel(computeSection({ kind: 'catalog', family: 'HEB', name: 'HEB 300', rotate: false }).torsion.J / 1e4, 185)).toBeLessThan(0.03);
  });
  it('mô men đều, gối chạc: M_cr khớp công thức giải tích', () => {
    const r = run(beam([moment('M1', 0, -50), moment('M2', L, 50)]));
    expect(r.applicable).toBe(true);
    expect(rel(r.Mcr, Mcr0)).toBeLessThan(2e-3);
  });
  it('tải phân bố đều tại tâm cắt: C1 ≈ 1.13', () => {
    const r = run(beam([dist('q', 0, L, -10)]));
    expect(Math.abs(r.Mcr / Mcr0 - 1.13)).toBeLessThan(0.02);
  });
  it('lực tập trung giữa nhịp tại tâm cắt: C1 ≈ 1.35', () => {
    const r = run(beam([force('P', L / 2, -30)]));
    expect(Math.abs(r.Mcr / Mcr0 - 1.35)).toBeLessThan(0.025);
  });
  it('tải đặt cánh trên làm giảm M_cr, cánh dưới làm tăng', () => {
    const m = beam([dist('q', 0, L, -10)]);
    const top = run(m, { loadHeight: 'top' }).Mcr, mid = run(m).Mcr, bot = run(m, { loadHeight: 'bottom' }).Mcr;
    expect(top).toBeLessThan(mid * 0.95);
    expect(bot).toBeGreaterThan(mid * 1.05);
  });
  it('giằng ngang + chống xoắn giữa nhịp (mô men đều): như dầm nhịp L/2', () => {
    const r = run(beam([moment('M1', 0, -50), moment('M2', L, 50)]), { braces: [{ id: 'b', x: L / 2, lateral: true, twist: true }] });
    const h = L / 2;
    const ref = ((Math.PI ** 2 * EIy) / h ** 2) * Math.sqrt(EIw / EIy + (h ** 2 * GIt) / (Math.PI ** 2 * EIy)) / 1e3;
    expect(rel(r.Mcr, ref)).toBeLessThan(3e-3);
  });
  it('χ_LT theo EN: IPE (cán, h/b ≤ 2) dùng đường cong a', () => {
    const r = run(beam([dist('q', 0, L, -10)]));
    expect(r.curve).toBe('a');
    expect(r.chi).toBeGreaterThan(0);
    expect(r.chi).toBeLessThanOrEqual(1);
    expect(r.Mrd).toBeCloseTo(r.chi * r.Mel, 9);
  });
  it('hộp rỗng: không đáng kể; uốn trục yếu: không áp dụng', () => {
    const box = { ...beam([dist('q', 0, L, -10)]), section: { kind: 'catalog', family: 'SHS', name: '□100×100×5', rotate: false } as const };
    const rb = run(box);
    expect(rb.chi).toBeGreaterThan(0.95);
    const weak = { ...beam([dist('q', 0, L, -10)]), section: { ...spec, rotate: true } };
    expect(run(weak).applicable).toBe(false);
  });
});
