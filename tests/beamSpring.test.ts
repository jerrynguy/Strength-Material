import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core/analysis';
import { STEEL, dist, force, moment, support } from '../src/core/presets';
import { computeSection } from '../src/core/section';
import { NO_SPRINGS, type Load, type Model, type SectionSpec, type Springs, type Support } from '../src/core/types';

const spec: SectionSpec = { kind: 'I', bt: 200, tt: 12, hw: 400, tw: 8, bb: 200, tb: 12 };
const sec = computeSection(spec);
const E = 200e9, G = E / 2.6;
const EA = (E * sec.A * 1e-6) / 1e3, EI = (E * sec.Iz * 1e-12) / 1e3, GJ = (G * sec.torsion.J * 1e-12) / 1e3;
const L = 6;
const rel = (a: number, b: number) => Math.abs(a / b - 1);
const spring = (name: string, x: number, k: Partial<Springs>): Support => ({ ...support(name, x, 'spring'), springs: { ...NO_SPRINGS, ...k } });
const model = (supports: Support[], loads: Load[], length = L): Model => ({ title: '', length, material: { ...STEEL }, section: spec, supports, hinges: [], loads });

describe('Chế độ thanh thẳng — gối đàn hồi', () => {
  it('công-xôn tựa lò xo đầu tự do: R = P·k/(k + 3EI/L³), hệ siêu tĩnh bậc 1', () => {
    const k = 2000, P = 50;
    const r = analyze(model([support('A', 0, 'fixed'), spring('B', L, { ky: k })], [force('P', L, -P)]));
    expect(r.ok).toBe(true);
    const kb = (3 * EI) / L ** 3;
    expect(rel(r.reactions[1].Fy, (P * k) / (k + kb))).toBeLessThan(1e-6);
    expect(rel(r.dispSamples[r.dispSamples.length - 1].v, (-P / (k + kb)) * 1e3)).toBeLessThan(1e-6);
    expect(r.status).toBe('sieu-tinh');
    expect(r.degree).toBe(1);
  });
  it('dầm đơn giản có lò xo giữa nhịp, tải phân bố: R = (5qL⁴/384EI)/(1/k + L³/48EI)', () => {
    const k = 5000, q = 10;
    const r = analyze(model([support('A', 0, 'pin'), spring('S', L / 2, { ky: k }), support('B', L, 'roller')], [dist('q', 0, L, -q)]));
    const exp = ((5 * q * L ** 4) / (384 * EI)) / (1 / k + L ** 3 / (48 * EI));
    expect(rel(r.reactions[1].Fy, exp)).toBeLessThan(1e-6);
  });
  it('khớp + lò xo xoay k_φz (ngàm đàn hồi): M_A = θ₀/(L/3EI + 1/k); k → ∞ thì M_A → qL²/8', () => {
    const q = 10, k = 20000;
    const r = analyze(model([support('A', 0, 'pin'), spring('Ak', 0, { krz: k }), support('B', L, 'roller')], [dist('q', 0, L, -q)]));
    const th0 = (q * L ** 3) / (24 * EI);
    const MA = th0 / (L / (3 * EI) + 1 / k);
    const Mk = r.reactions.find((x) => x.name === 'Ak')!.Mz;
    expect(rel(Math.abs(Mk), MA)).toBeLessThan(1e-6);
    const rig = analyze(model([support('A', 0, 'pin'), spring('Ak', 0, { krz: 1e12 }), support('B', L, 'roller')], [dist('q', 0, L, -q)]));
    expect(rel(Math.abs(rig.reactions.find((x) => x.name === 'Ak')!.Mz), (q * L * L) / 8)).toBeLessThan(1e-4);
  });
  it('lò xo dọc trục k_x và lò xo xoắn k_φx: phân phối theo độ cứng', () => {
    const k = 1e5, P = 100;
    const a = analyze(model([support('A', 0, 'fixed'), spring('B', L, { kx: k })], [force('P', L, 0, -P)]));
    expect(rel(Math.abs(a.reactions[1].Fx), (P * k) / (k + EA / L))).toBeLessThan(1e-6);
    const kt = 50, T = 2;
    const t = analyze(model([support('A', 0, 'fixed'), spring('B', L, { krx: kt })], [moment('T', L, 0, T)]));
    expect(rel(Math.abs(t.reactions[1].Mx), (T * kt) / (kt + GJ / L))).toBeLessThan(1e-6);
  });
  it('ổn định: cột khớp hai đầu có lò xo ngang giữa cột rất cứng → N_th = 4π²EI/L²', () => {
    const P = 100;
    const base = [support('A', 0, 'pin'), support('B', L, 'roller')];
    const loads = [force('P', L, 0, -P)];
    const r0 = analyze(model(base, loads), { buckling: true });
    expect(rel(r0.buckling.bendY!.alpha * P, (Math.PI ** 2 * EI) / L ** 2)).toBeLessThan(1e-3);
    const r1 = analyze(model([...base, spring('S', L / 2, { ky: 1e9 })], loads), { buckling: true });
    expect(rel(r1.buckling.bendY!.alpha * P, (4 * Math.PI ** 2 * EI) / L ** 2)).toBeLessThan(2e-3);
  });
  it('hồi quy: gối cứng giữa cột (đối xứng) — tìm được dạng phản đối xứng N_th = 4π²EI/L²', () => {
    const P = 100;
    const r = analyze(model([support('A', 0, 'pin'), support('S', L / 2, 'roller'), support('B', L, 'roller')], [force('P', L, 0, -P)]), { buckling: true });
    expect(rel(r.buckling.bendY!.alpha * P, (4 * Math.PI ** 2 * EI) / L ** 2)).toBeLessThan(2e-3);
  });
});
