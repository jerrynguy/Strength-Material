import { describe, expect, it } from 'vitest';
import { analyzeFrame, type FLoad, type FrameModel, type FSupport } from '../src/core/frame';
import { fmember, fnode, fnodeLoad, fsupport } from '../src/core/framePresets';
import { STEEL } from '../src/core/presets';
import { computeSection } from '../src/core/section';
import type { SectionSpec } from '../src/core/types';

const spec: SectionSpec = { kind: 'I', bt: 200, tt: 12, hw: 400, tw: 8, bb: 200, tb: 12 };
const sec = computeSection(spec);
const E = 200e9;
const EA = (E * sec.A * 1e-6) / 1e3; // kN
const EI = (E * sec.Iz * 1e-12) / 1e3; // kN·m²
const h = (sec.yMax - sec.yMin) / 1e3;
const aT = 1.2e-5;
const L = 6;
const rel = (a: number, b: number) => Math.abs(a / b - 1);

function beam(ka: FSupport['kind'], kb: FSupport['kind'], loads: (m: ReturnType<typeof fmember>, A: ReturnType<typeof fnode>, B: ReturnType<typeof fnode>) => FLoad[], patchB: Partial<FSupport> = {}): FrameModel {
  const A = fnode('A', 0, 0), B = fnode('B', L, 0);
  const m = fmember('AB', A, B, 's');
  return {
    title: '', material: { ...STEEL }, sections: [{ id: 's', name: 'S', spec }], nodes: [A, B], members: [m],
    supports: [fsupport(A, ka), { ...fsupport(B, kb), ...patchB }], loads: loads(m, A, B),
  };
}
const temp = (memberId: string, Ttop: number, Tbot: number): FLoad => ({ id: 't', type: 'mtemp', name: 't', memberId, Ttop, Tbot });
const Mmid = (r: ReturnType<typeof analyzeFrame>) => r.members[0].internalAt(L / 2, 'left');

describe('Nhiệt độ trên thanh', () => {
  it('ngàm – ngàm, tăng nhiệt đều ΔT: N = −EA·α·ΔT, M = 0', () => {
    const r = analyzeFrame(beam('fixed', 'fixed', (m) => [temp(m.id, 30, 30)]));
    expect(r.ok).toBe(true);
    expect(rel(Mmid(r).N, -EA * aT * 30)).toBeLessThan(1e-6);
    expect(Math.abs(Mmid(r).M)).toBeLessThan(1e-6);
    expect(r.status).toBe('sieu-tinh');
  });
  it('ngàm – ngàm, chênh nhiệt (mặt dưới nóng hơn): M = −EI·α(T_d − T_t)/h không đổi, N = 0', () => {
    const r = analyzeFrame(beam('fixed', 'fixed', (m) => [temp(m.id, -10, 10)]));
    const M = -EI * aT * 20 / h;
    expect(rel(Mmid(r).M, M)).toBeLessThan(1e-6);
    expect(rel(r.members[0].internalAt(0.3, 'right').M, M)).toBeLessThan(1e-6);
    expect(Math.abs(Mmid(r).N)).toBeLessThan(1e-6);
  });
  it('dầm đơn giản (tĩnh định): nhiệt độ không gây nội lực, chỉ gây chuyển vị', () => {
    const r = analyzeFrame(beam('pin', 'roller', (m) => [temp(m.id, 30, 30)]));
    expect(Math.abs(Mmid(r).N)).toBeLessThan(1e-9);
    const dB = r.nodeDisp[1].ux; // mm
    expect(rel(dB, aT * 30 * L * 1e3)).toBeLessThan(1e-6);
    const g = analyzeFrame(beam('pin', 'roller', (m) => [temp(m.id, -10, 10)]));
    expect(Math.abs(Mmid(g).M)).toBeLessThan(1e-9);
    const mid = g.members[0].disp.find((d) => Math.abs(d.s - L / 2) < 1e-9)!;
    // κ₀ = α·20/h, v(L/2) = −κ₀L²/8 (võng xuống khi mặt dưới nóng)
    expect(rel(mid.uy, ((-aT * 20) / h) * (L * L) / 8 * 1e3)).toBeLessThan(1e-6);
  });
});

describe('Lún gối', () => {
  const D = 0.01; // m
  it('ngàm – ngàm, gối B lún Δ: R = 12EIΔ/L³, M đầu = 6EIΔ/L²', () => {
    const r = analyzeFrame(beam('fixed', 'fixed', () => [], { settle: { dx: 0, dy: -D * 1e3, rz: 0 } }));
    expect(r.ok).toBe(true);
    expect(rel(Math.abs(r.reactions[1].Ry), (12 * EI * D) / L ** 3)).toBeLessThan(1e-6);
    expect(rel(Math.abs(r.reactions[0].M), (6 * EI * D) / L ** 2)).toBeLessThan(1e-6);
    expect(rel(r.nodeDisp[1].uy, -D * 1e3)).toBeLessThan(1e-9);
  });
  it('ngàm – di động, gối B lún Δ: R_B = 3EIΔ/L³', () => {
    const r = analyzeFrame(beam('fixed', 'roller', () => [], { settle: { dx: 0, dy: -D * 1e3, rz: 0 } }));
    expect(rel(Math.abs(r.reactions[1].Ry), (3 * EI * D) / L ** 3)).toBeLessThan(1e-6);
  });
  it('dầm tĩnh định: lún gối không gây nội lực', () => {
    const r = analyzeFrame(beam('pin', 'roller', () => [], { settle: { dx: 0, dy: -D * 1e3, rz: 0 } }));
    expect(Math.abs(Mmid(r).M)).toBeLessThan(1e-9);
    expect(rel(r.members[0].disp.find((d) => Math.abs(d.s - L / 2) < 1e-9)!.uy, (-D * 1e3) / 2)).toBeLessThan(1e-6);
  });
  it('ngàm xoay cưỡng bức θ ở đầu A (ngàm – ngàm): M_A = 4EIθ/L', () => {
    const th = 2e-3;
    const A = fnode('A', 0, 0), B = fnode('B', L, 0);
    const m = fmember('AB', A, B, 's');
    const fr: FrameModel = {
      title: '', material: { ...STEEL }, sections: [{ id: 's', name: 'S', spec }], nodes: [A, B], members: [m],
      supports: [{ ...fsupport(A, 'fixed'), settle: { dx: 0, dy: 0, rz: th * 1e3 } }, fsupport(B, 'fixed')], loads: [],
    };
    const r = analyzeFrame(fr);
    expect(rel(Math.abs(r.reactions[0].M), (4 * EI * th) / L)).toBeLessThan(1e-6);
  });
});

describe('Gối đàn hồi', () => {
  it('công-xôn tựa lò xo ở đầu tự do, lực P: R_lò xo = P·k/(k + 3EI/L³)', () => {
    const k = 2000, P = 50;
    const r = analyzeFrame(beam('fixed', 'spring', (_m, _A, B) => [fnodeLoad('P', B, 0, -P)], { springs: { kx: 0, ky: k, kr: 0 } }));
    expect(r.ok).toBe(true);
    const kb = (3 * EI) / L ** 3;
    expect(rel(r.reactions[1].Ry, (P * k) / (k + kb))).toBeLessThan(1e-6);
    expect(rel(r.nodeDisp[1].uy, (-P / (k + kb)) * 1e3)).toBeLessThan(1e-6);
    expect(r.status).toBe('sieu-tinh');
  });
  it('lò xo rất cứng ≈ gối cứng; lò xo xoay ở chân cột', () => {
    const stiff = analyzeFrame(beam('fixed', 'spring', (_m, _A, B) => [fnodeLoad('P', B, 0, -50)], { springs: { kx: 0, ky: 1e9, kr: 0 } }));
    expect(stiff.nodeDisp[1].uy).toBeCloseTo(0, 3);
    // cột chân lò xo xoay kr và gối cố định, lực ngang H ở đỉnh: góc xoay chân = H·Lc/kr
    const A = fnode('A', 0, 0), B = fnode('B', 0, 4);
    const m = fmember('AB', A, B, 's');
    const kr = 5000, H = 10;
    const fr: FrameModel = {
      title: '', material: { ...STEEL }, sections: [{ id: 's', name: 'S', spec }], nodes: [A, B], members: [m],
      supports: [fsupport(A, 'pin'), { ...fsupport(A, 'spring'), springs: { kx: 0, ky: 0, kr } }], loads: [fnodeLoad('H', B, H, 0)],
    };
    const r = analyzeFrame(fr);
    expect(r.ok).toBe(true);
    expect(rel(Math.abs(r.nodeDisp[0].rz!), (H * 4) / kr)).toBeLessThan(1e-6);
    expect(r.nodeDisp[0].rz!).toBeLessThan(0); // H theo +x làm cột xoay cùng chiều kim đồng hồ
    const reac = r.reactions.find((x) => x.supportId === fr.supports[1].id)!;
    expect(rel(Math.abs(reac.M), H * 4)).toBeLessThan(1e-6);
  });
});
