import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core/analysis';
import { forceMethod, reactionEquations, unitLoadDisplacement } from '../src/core/classical';
import { STEEL, dist, force, moment, support, uid } from '../src/core/presets';
import { computeSection } from '../src/core/section';
import { NO_SPRINGS, type Load, type Model, type SectionSpec, type Support } from '../src/core/types';

const spec: SectionSpec = { kind: 'I', bt: 200, tt: 12, hw: 400, tw: 8, bb: 200, tb: 12 };
const sec = computeSection(spec);
const EI = (200e9 * sec.Iz * 1e-12) / 1e3;
const rel = (a: number, b: number) => Math.abs(a / b - 1);
const mk = (L: number, supports: Support[], loads: Load[], hinges: Model['hinges'] = []): Model => ({ title: '', length: L, material: { ...STEEL }, section: spec, supports, hinges, loads });
const val = (r: ReturnType<typeof reactionEquations>, name: string) => r.values.find((v) => v.u.name === name)!.value;

describe('1. Phản lực bằng phương trình cân bằng', () => {
  it('dầm đơn giản lực tập trung: V_B = Pa/L, V_A = Pb/L', () => {
    const m = mk(9, [support('A', 0, 'pin'), support('B', 9, 'roller')], [force('P', 2, -30), dist('q', 4, 9, -10)]);
    const r = reactionEquations(m, analyze(m));
    expect(r.ok).toBe(true);
    expect(val(r, 'V_B')).toBeCloseTo((30 * 2 + 50 * 6.5) / 9, 9);
    expect(val(r, 'V_A')).toBeCloseTo(80 - (30 * 2 + 50 * 6.5) / 9, 9);
    expect(val(r, 'H_A')).toBeCloseTo(0, 12);
    expect(r.steps.some((s) => s.startsWith('ΣM_A = 0'))).toBe(true);
    for (const v of r.values) expect(v.value).toBeCloseTo(v.fem, 6);
  });
  it('công-xôn có mô men: M_A, V_A từ một phương trình mỗi ẩn', () => {
    const m = mk(4, [support('A', 0, 'fixed')], [force('P', 4, -10), moment('M', 2, 5)]);
    const r = reactionEquations(m, analyze(m));
    expect(val(r, 'V_A')).toBeCloseTo(10, 9);
    expect(val(r, 'M_A')).toBeCloseTo(40 - 5, 9);
    // lời giải số có sai số làm tròn ~1e-8; phương trình cân bằng cho giá trị đúng
    for (const v of r.values) expect(Math.abs(v.value - v.fem)).toBeLessThan(1e-5);
  });
  it('dầm ghép có khớp: dùng phương trình M = 0 tại khớp', () => {
    const m = mk(9, [support('A', 0, 'fixed'), support('B', 9, 'roller')], [force('P', 2, -30), dist('q', 4, 9, -10)], [{ id: uid('h'), name: 'K', x: 4 }]);
    const r = reactionEquations(m, analyze(m));
    expect(r.ok).toBe(true);
    expect(val(r, 'V_B')).toBeCloseTo(25, 9); // phần KB: q·5·2.5/5
    expect(r.steps[1]).toContain('ΣM_K (phần bên phải');
    for (const v of r.values) expect(v.value).toBeCloseTo(v.fem, 6);
  });
  it('hệ siêu tĩnh: chuyển sang phương pháp lực', () => {
    const m = mk(6, [support('A', 0, 'fixed'), support('B', 6, 'roller')], [dist('q', 0, 6, -10)]);
    expect(reactionEquations(m, analyze(m)).ok).toBe(false);
  });
});

describe('2. Chuyển vị bằng Mohr – Maxwell / Vereshchagin', () => {
  it('dầm đơn giản: lực giữa nhịp v = −PL³/48EI; tải phân bố v = −5qL⁴/384EI', () => {
    const L = 6;
    const m1 = mk(L, [support('A', 0, 'pin'), support('B', L, 'roller')], [force('P', L / 2, -20)]);
    const d1 = unitLoadDisplacement(m1, analyze(m1), L / 2, 'v');
    expect(rel(d1.value, ((-20 * L ** 3) / (48 * EI)) * 1e3)).toBeLessThan(1e-7);
    expect(rel(d1.value, d1.fem)).toBeLessThan(1e-6);
    expect(d1.steps.some((s) => s.includes('Ω = ') && s.includes('ȳ = m̄(x_c)'))).toBe(true);
    const m2 = mk(L, [support('A', 0, 'pin'), support('B', L, 'roller')], [dist('q', 0, L, -10)]);
    const d2 = unitLoadDisplacement(m2, analyze(m2), L / 2, 'v');
    expect(rel(d2.value, ((-5 * 10 * L ** 4) / (384 * EI)) * 1e3)).toBeLessThan(1e-7);
  });
  it('công-xôn: v đầu = −PL³/3EI, θ đầu = −PL²/2EI', () => {
    const L = 3;
    const m = mk(L, [support('A', 0, 'fixed')], [force('P', L, -10)]);
    const r = analyze(m);
    expect(rel(unitLoadDisplacement(m, r, L, 'v').value, ((-10 * L ** 3) / (3 * EI)) * 1e3)).toBeLessThan(1e-7);
    expect(rel(unitLoadDisplacement(m, r, L, 'theta').value, (-10 * L ** 2) / (2 * EI))).toBeLessThan(1e-7);
  });
  it('nhiệt độ, lún gối và lò xo trong hệ tĩnh định khớp lời giải số', () => {
    const L = 6;
    const m = mk(L, [support('A', 0, 'pin'), { ...support('B', L, 'roller'), settle: { dy: -12 } }],
      [force('P', 2, -15), { id: 't', type: 'temp', name: 't', x1: 0, x2: L, Ttop: 30, Tbot: 5 }]);
    const r = analyze(m);
    for (const x of [1.5, 3, 4.5]) {
      const d = unitLoadDisplacement(m, r, x, 'v');
      expect(Math.abs(d.value - d.fem)).toBeLessThan(1e-6 * Math.max(1, Math.abs(d.fem)));
    }
    const ms = mk(L, [support('A', 0, 'pin'), { ...support('B', L, 'spring'), springs: { ...NO_SPRINGS, ky: 3000 } }], [dist('q', 0, L, -10)]);
    const rs = analyze(ms);
    const ds = unitLoadDisplacement(ms, rs, L / 2, 'v');
    expect(Math.abs(ds.value - ds.fem)).toBeLessThan(1e-6 * Math.abs(ds.fem));
  });
  it('hệ siêu tĩnh (định lý rút gọn): ngàm – di động, tải phân bố, khớp lời giải số', () => {
    const L = 6;
    const m = mk(L, [support('A', 0, 'fixed'), support('B', L, 'roller')], [dist('q', 0, L, -10)]);
    const r = analyze(m);
    const d = unitLoadDisplacement(m, r, L / 2, 'v');
    expect(rel(d.value, d.fem)).toBeLessThan(1e-6);
    // v(L/2) = −qL⁴/(192EI)
    expect(rel(d.value, ((-10 * L ** 4) / (192 * EI)) * 1e3)).toBeLessThan(1e-6);
  });
});

describe('3. Phương pháp lực', () => {
  it('ngàm – di động, tải phân bố: X₁ = V_B = 3qL/8', () => {
    const L = 6, q = 10;
    const m = mk(L, [support('A', 0, 'fixed'), support('B', L, 'roller')], [dist('q', 0, L, -q)]);
    const f = forceMethod(m, analyze(m));
    expect(f.ok).toBe(true);
    expect(f.degree).toBe(1);
    expect(f.redundants[0].name).toBe('V_B');
    expect(rel(f.X[0], (3 * q * L) / 8)).toBeLessThan(1e-7);
    expect(rel(f.delta[0][0], L ** 3 / (3 * EI))).toBeLessThan(1e-7);
    expect(f.maxDiffM).toBeLessThan(1e-6);
  });
  it('dầm liên tục hai nhịp: V_giữa = 1.25qL; chọn ẩn thừa khác cho cùng kết quả', () => {
    const L = 5, q = 8;
    const m = mk(2 * L, [support('A', 0, 'pin'), support('B', L, 'roller'), support('C', 2 * L, 'roller')], [dist('q', 0, 2 * L, -q)]);
    const r = analyze(m);
    const f = forceMethod(m, r);
    expect(f.redundants[0].name).toBe('V_B');
    expect(rel(f.X[0], 1.25 * q * L)).toBeLessThan(1e-7);
    const keyC = f.candidates.find((u) => u.name === 'V_C')!.key;
    const g = forceMethod(m, r, [keyC]);
    expect(g.redundants[0].name).toBe('V_C');
    expect(rel(g.X[0], (3 * q * L) / 8)).toBeLessThan(1e-7);
    expect(g.maxDiffM).toBeLessThan(1e-6);
  });
  it('ngàm hai đầu (bậc 3 kể cả dọc trục): M_A = −qL²/12, khớp lời giải số', () => {
    const L = 6, q = 10;
    const m = mk(L, [support('A', 0, 'fixed'), support('B', L, 'fixed')], [dist('q', 0, L, -q)]);
    const f = forceMethod(m, analyze(m));
    expect(f.ok).toBe(true);
    expect(f.degree).toBe(3);
    const MA = f.reactions.find((x) => x.u.name === 'M_A')!;
    expect(Math.abs(MA.value)).toBeCloseTo((q * L * L) / 12, 6);
    for (const x of f.reactions) expect(x.value).toBeCloseTo(x.fem, 5);
  });
  it('lún gối, nhiệt độ, lò xo: khớp lời giải số', () => {
    const L = 6;
    const m = mk(2 * L, [support('A', 0, 'pin'), { ...support('B', L, 'roller'), settle: { dy: -10 } }, support('C', 2 * L, 'roller')],
      [dist('q', 0, 2 * L, -10), { id: 't', type: 'temp', name: 't', x1: 0, x2: 2 * L, Ttop: 30, Tbot: 10 }]);
    const f = forceMethod(m, analyze(m));
    expect(f.ok).toBe(true);
    expect(f.c[0]).toBeCloseTo(-0.01, 12);
    for (const x of f.reactions) expect(x.value).toBeCloseTo(x.fem, 5);
    expect(f.maxDiffM).toBeLessThan(1e-5);
    const ms = mk(L, [support('A', 0, 'fixed'), { ...support('B', L, 'spring'), springs: { ...NO_SPRINGS, ky: 2000 } }], [force('P', L, -50)]);
    const fs = forceMethod(ms, analyze(ms));
    expect(fs.ok).toBe(true);
    expect(fs.X[0]).toBeCloseTo((50 * 2000) / (2000 + (3 * EI) / L ** 3), 6);
  });
});
