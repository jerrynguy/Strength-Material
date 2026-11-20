import { describe, expect, it } from 'vitest';
import { analyzeFrame, type FrameModel } from '../src/core/frame';
import { fmember, fnode, fnodeLoad, fsupport } from '../src/core/framePresets';
import { checkFrameMemberOp } from '../src/core/ltb';
import { STEEL } from '../src/core/presets';
import { computeSection } from '../src/core/section';
import { BUCKLING_MATERIALS, checkStability, torsionalBuckling } from '../src/core/stability';
import type { SectionSpec } from '../src/core/types';

const E = 200e3, G = E / 2.6;
const rel = (a: number, b: number) => Math.abs(a / b - 1);
/** công thức cổ điển cho mặt cắt đối xứng một trục: ghép uốn N với xoắn N_T, β = 1 − (c/i₀)² */
const classic = (N: number, NT: number, beta: number) => ((N + NT) - Math.sqrt((N + NT) ** 2 - 4 * beta * N * NT)) / (2 * beta);

describe('Tâm cắt và mất ổn định uốn – xoắn của thép U, thép góc', () => {
  it('tâm cắt thép U nằm ngoài bụng: z₀ = t_w/2 − e − z_c, e = 3b²t_f/(6bt_f + ht_w)', () => {
    const s: SectionSpec = { kind: 'U', h: 200, b: 80, tw: 6, tf: 9 };
    const sec = computeSection(s);
    const b = 80 - 3, h = 200 - 9;
    const e = (3 * b * b * 9) / (6 * b * 9 + h * 6);
    expect(sec.ltb!.zSc!).toBeCloseTo(3 - e - sec.centroid[0], 9);
    expect(sec.ltb!.zSc!).toBeLessThan(-sec.centroid[0]); // phía ngoài bụng (z < 0)
    expect(sec.ltb!.ySc).toBe(0);
  });
  it('thép góc đều cạnh: tâm cắt tại góc, N_TF theo công thức cổ điển (ghép với uốn quanh trục đối xứng)', () => {
    const s: SectionSpec = { kind: 'L', b: 100, h: 100, t: 8 };
    const sec = computeSection(s);
    const L = 1.2;
    const tb = torsionalBuckling(sec, 200, 0.3, () => L, L)!;
    // trục đối xứng: đường phân giác; tâm cắt cách trọng tâm c = √2·(z_c − t/2) dọc trục đó
    const c = Math.SQRT2 * (sec.centroid[0] - 4);
    const Iavg = (sec.Iy + sec.Iz) / 2, R = Math.abs(sec.Iyz);
    const Imax = Iavg + R, Imin = Iavg - R;
    const i02 = (Imax + Imin) / sec.A + c * c;
    const Nmax = (Math.PI ** 2 * E * Imax) / (L * 1e3) ** 2, Nmin = (Math.PI ** 2 * E * Imin) / (L * 1e3) ** 2;
    const NT = (G * sec.torsion.J) / i02;
    const exp = Math.min(Nmin, classic(Nmax, NT, 1 - (c * c) / i02)) / 1e3;
    expect(tb.coupled).toBe(true);
    expect(rel(tb.i0 ** 2, i02)).toBeLessThan(1e-9);
    expect(rel(tb.NTF, exp)).toBeLessThan(1e-6);
  });
  it('thép U: ghép xoắn với uốn quanh trục đối xứng (trục z), β = 1 − (z₀/i₀)²', () => {
    const s: SectionSpec = { kind: 'U', h: 160, b: 64, tw: 5, tf: 8 };
    const sec = computeSection(s);
    const L = 1.0;
    const tb = torsionalBuckling(sec, 200, 0.3, () => L, L)!;
    const z0 = sec.ltb!.zSc!;
    const i02 = (sec.Iy + sec.Iz) / sec.A + z0 * z0;
    const Lm = L * 1e3;
    const Nz = (Math.PI ** 2 * E * sec.Iz) / Lm ** 2; // chuyển vị theo y (vuông góc trục đối xứng z)
    const Ny = (Math.PI ** 2 * E * sec.Iy) / Lm ** 2;
    const NT = (G * sec.torsion.J + (Math.PI ** 2 * E * sec.ltb!.Iw) / Lm ** 2) / i02;
    const exp = Math.min(Ny, classic(Nz, NT, 1 - (z0 * z0) / i02)) / 1e3;
    expect(rel(tb.NTF, exp)).toBeLessThan(1e-6);
  });
  it('mặt cắt đối xứng hai trục: không ghép, N = min(N₁, N₂, N_T)', () => {
    const sec = computeSection({ kind: 'catalog', family: 'IPE', name: 'IPE 200', rotate: false });
    const tb = torsionalBuckling(sec, 200, 0.3, () => 3, 3)!;
    expect(tb.coupled).toBe(false);
    expect(tb.NTF).toBeCloseTo(Math.min(tb.N1, tb.N2, tb.NT), 9);
  });
  it('checkStability: thép góc ngắn — dạng uốn – xoắn quyết định, λ tương đương = π√(EA/N_TF)', () => {
    const sec = computeSection({ kind: 'L', b: 100, h: 100, t: 7 });
    const r = checkStability(sec, { N: 50, Lz: 0.8, Ly: 0.8, muZ: 1, muY: 1, E: 200, allowable: 160, params: BUCKLING_MATERIALS.CT3, nRequired: 1 });
    expect(r.torsional).toBeTruthy();
    expect(r.governing.torsional).toBe(true);
    expect(r.lambdaMax).toBeCloseTo(Math.PI * Math.sqrt((E * sec.A) / (r.torsional!.NTF * 1e3)), 9);
    // thanh dài: uốn quanh trục yếu quyết định
    const long = checkStability(sec, { N: 50, Lz: 4, Ly: 4, muZ: 1, muY: 1, E: 200, allowable: 160, params: BUCKLING_MATERIALS.CT3, nRequired: 1 });
    expect(long.governing.torsional).toBeFalsy();
  });
  it('phương pháp tổng quát: r₀² kể cả z₀² (thép U chịu nén thuần trong khung)', () => {
    const spec: SectionSpec = { kind: 'U', h: 160, b: 64, tw: 5, tf: 8 };
    const sec = computeSection(spec);
    const L = 2;
    const A = fnode('A', 0, 0), B = fnode('B', L, 0);
    const m = fmember('AB', A, B, 's');
    const fr: FrameModel = { title: '', material: { ...STEEL }, sections: [{ id: 's', name: 'S', spec }], nodes: [A, B], members: [m],
      supports: [fsupport(A, 'pin'), fsupport(B, 'roller')], loads: [fnodeLoad('P', B, -100, 0)] };
    const r = checkFrameMemberOp(fr, analyzeFrame(fr), m.id, { loadHeight: 'sc', curve: 'auto', braces: {} }, 235);
    const z0 = sec.ltb!.zSc!;
    const r02 = (sec.Iy + sec.Iz) / sec.A + z0 * z0;
    const NT = (G * sec.torsion.J + (Math.PI ** 2 * E * sec.ltb!.Iw) / (L * 1e3) ** 2) / r02;
    const Ny = (Math.PI ** 2 * E * sec.Iy) / (L * 1e3) ** 2;
    expect(rel(r.alphaCrOp * 100e3, Math.min(Ny, NT))).toBeLessThan(2e-3);
  });
});
