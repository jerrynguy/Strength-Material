import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core/analysis';
import { STEEL, force, support } from '../src/core/presets';
import { computeSection } from '../src/core/section';
import { stressAt } from '../src/core/stress';
import type { Load, Model, SectionSpec, Support } from '../src/core/types';

const spec: SectionSpec = { kind: 'I', bt: 200, tt: 12, hw: 400, tw: 8, bb: 200, tb: 12 };
const sec = computeSection(spec);
const E = 200e9;
const EA = (E * sec.A * 1e-6) / 1e3;
const EI = (E * sec.Iz * 1e-12) / 1e3;
const h = (sec.yMax - sec.yMin) / 1e3;
const aT = 1.2e-5;
const L = 6;
const rel = (a: number, b: number) => Math.abs(a / b - 1);
const temp = (Ttop: number, Tbot: number, x1 = 0, x2 = L): Load => ({ id: 't', type: 'temp', name: 't', x1, x2, Ttop, Tbot });
const model = (supports: Support[], loads: Load[] = []): Model => ({ title: '', length: supports.reduce((m, s) => Math.max(m, s.x), L), material: { ...STEEL }, section: spec, supports, hinges: [], loads });

describe('Chế độ thanh thẳng — nhiệt độ', () => {
  it('ngàm – ngàm tăng nhiệt đều: N = −EA·α·ΔT, không uốn', () => {
    const r = analyze(model([support('A', 0, 'fixed'), support('B', L, 'fixed')], [temp(30, 30)]));
    expect(r.ok).toBe(true);
    expect(rel(r.internalAt(L / 2, 'left').N, -EA * aT * 30)).toBeLessThan(1e-6);
    expect(Math.abs(r.internalAt(L / 2, 'left').Mz)).toBeLessThan(1e-6);
  });
  it('ngàm – ngàm chênh nhiệt: M_z = −EI·α(T_d − T_t)/h', () => {
    const r = analyze(model([support('A', 0, 'fixed'), support('B', L, 'fixed')], [temp(-10, 10)]));
    expect(rel(r.internalAt(L / 2, 'left').Mz, (-EI * aT * 20) / h)).toBeLessThan(1e-6);
    expect(Math.abs(r.internalAt(L / 2, 'left').N)).toBeLessThan(1e-6);
  });
  it('nung nóng một nửa thanh (ngàm – ngàm): N = −EA·α·ΔT/2', () => {
    const r = analyze(model([support('A', 0, 'fixed'), support('B', L, 'fixed')], [temp(30, 30, 0, L / 2)]));
    expect(rel(r.internalAt(L / 4, 'left').N, (-EA * aT * 30) / 2)).toBeLessThan(1e-6);
  });
  it('dầm đơn giản: giãn tự do α·ΔT·L, võng κ₀L²/8, không nội lực', () => {
    const r = analyze(model([support('A', 0, 'pin'), support('B', L, 'roller')], [temp(30, 30)]));
    expect(Math.abs(r.internalAt(L / 2, 'left').N)).toBeLessThan(1e-9);
    const end = r.dispSamples[r.dispSamples.length - 1];
    expect(rel(end.u, aT * 30 * L * 1e3)).toBeLessThan(1e-6);
    const g = analyze(model([support('A', 0, 'pin'), support('B', L, 'roller')], [temp(-10, 10)]));
    expect(Math.abs(g.internalAt(L / 2, 'left').Mz)).toBeLessThan(1e-9);
    const mid = g.dispSamples.find((d) => Math.abs(d.x - L / 2) < 1e-9)!;
    expect(rel(mid.v, ((-aT * 20) / h) * (L * L) / 8 * 1e3)).toBeLessThan(1e-6);
  });
  it('phân tích bậc hai: lực dọc do nhiệt dùng EA(ε − ε₀)', () => {
    const m = model([support('A', 0, 'fixed'), support('B', L, 'fixed')], [temp(30, 30), force('P', L / 2, -10)]);
    const r = analyze(m, { secondOrder: true });
    expect(r.ok).toBe(true);
    // lực nén do nhiệt làm mô men giữa nhịp lớn hơn phân tích bậc nhất
    expect(Math.abs(r.internalAt(L / 2, 'left').Mz)).toBeGreaterThan(Math.abs(analyze(m).internalAt(L / 2, 'left').Mz));
  });
});

describe('Chế độ thanh thẳng — lún gối', () => {
  const D = 10; // mm
  it('ngàm – ngàm, B lún Δ: R = 12EIΔ/L³, M = 6EIΔ/L²', () => {
    const r = analyze(model([support('A', 0, 'fixed'), { ...support('B', L, 'fixed'), settle: { dy: -D } }]));
    expect(r.ok).toBe(true);
    expect(rel(Math.abs(r.reactions[1].Fy), (12 * EI * D * 1e-3) / L ** 3)).toBeLessThan(1e-6);
    expect(rel(Math.abs(r.reactions[0].Mz), (6 * EI * D * 1e-3) / L ** 2)).toBeLessThan(1e-6);
    const end = r.dispSamples[r.dispSamples.length - 1];
    expect(end.v).toBeCloseTo(-D, 9);
  });
  it('dầm liên tục hai nhịp, gối giữa lún Δ: R_giữa = 6EIΔ/L³', () => {
    const r = analyze(model([support('A', 0, 'pin'), { ...support('B', L, 'roller'), settle: { dy: -D } }, support('C', 2 * L, 'roller')]));
    expect(r.ok).toBe(true);
    expect(rel(Math.abs(r.reactions[1].Fy), (6 * EI * D * 1e-3) / L ** 3)).toBeLessThan(1e-6);
  });
  it('ngàm xoay cưỡng bức θ: M = 4EIθ/L', () => {
    const th = 2; // ‰ rad
    const r = analyze(model([{ ...support('A', 0, 'fixed'), settle: { rz: th } }, support('B', L, 'fixed')]));
    expect(rel(Math.abs(r.reactions[0].Mz), (4 * EI * th * 1e-3) / L)).toBeLessThan(1e-6);
  });
  it('dầm tĩnh định: lún gối không gây nội lực', () => {
    const r = analyze(model([support('A', 0, 'pin'), { ...support('B', L, 'roller'), settle: { dy: -D } }]));
    expect(Math.abs(r.internalAt(L / 2, 'left').Mz)).toBeLessThan(1e-9);
    expect(rel(r.dispSamples.find((d) => Math.abs(d.x - L / 2) < 1e-9)!.v, -D / 2)).toBeLessThan(1e-6);
  });
  it('lún theo phương bị tự do không có tác dụng', () => {
    const r = analyze(model([support('A', 0, 'pin'), { ...support('B', L, 'roller'), settle: { dx: 5 } }]));
    expect(r.ok).toBe(true);
    expect(Math.abs(r.dispSamples[r.dispSamples.length - 1].u)).toBeLessThan(1e-9);
  });
});

describe('Chế độ thanh thẳng — chênh nhiệt hai bên (uốn ngang)', () => {
  const EIy = (E * sec.Iy * 1e-12) / 1e3;
  const b = (sec.zMax - sec.zMin) / 1e3;
  const tz = (dTz: number): Load => ({ id: 't', type: 'temp', name: 't', x1: 0, x2: L, Ttop: 0, Tbot: 0, dTz });
  it('ngàm – ngàm: |M_y| = EI_y·α·ΔT_z/b không đổi, không có N, M_z', () => {
    const r = analyze(model([support('A', 0, 'fixed'), support('B', L, 'fixed')], [tz(20)]));
    expect(r.ok).toBe(true);
    const f = r.internalAt(L / 2, 'left'), f2 = r.internalAt(0.4, 'right');
    expect(rel(Math.abs(f.My), (EIy * aT * 20) / b)).toBeLessThan(1e-6);
    expect(rel(f2.My, f.My)).toBeLessThan(1e-6);
    expect(Math.abs(f.N) + Math.abs(f.Mz)).toBeLessThan(1e-9);
  });
  it('dầm đơn giản: không nội lực; võng ngang w = α·ΔT_z·L²/(8b) về phía nóng hơn (+z)', () => {
    const r = analyze(model([support('A', 0, 'pin'), support('B', L, 'roller')], [tz(20)]));
    expect(Math.abs(r.internalAt(L / 2, 'left').My)).toBeLessThan(1e-9);
    const mid = r.dispSamples.find((d) => Math.abs(d.x - L / 2) < 1e-9)!;
    expect(rel(mid.w, ((aT * 20 * L * L) / (8 * b)) * 1e3)).toBeLessThan(1e-6);
    expect(mid.w).toBeGreaterThan(0);
  });
  it('ứng suất: thớ phía nóng (+z) bị nén, phía lạnh bị kéo khi hai đầu ngàm', () => {
    const r = analyze(model([support('A', 0, 'fixed'), support('B', L, 'fixed')], [tz(20)]));
    const F = r.internalAt(L / 2, 'left');
    const hot = stressAt(sec, F, STEEL, 0, sec.zMax).sigma;
    const cold = stressAt(sec, F, STEEL, 0, sec.zMin).sigma;
    expect(hot).toBeLessThan(0);
    expect(cold).toBeGreaterThan(0);
    // độ lớn: E·α·ΔT_z/b·z
    expect(rel(-hot, 200e3 * aT * 20 * (sec.zMax / (b * 1e3)))).toBeLessThan(1e-6);
  });
});
