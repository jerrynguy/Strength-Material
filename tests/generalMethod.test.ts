import { describe, expect, it } from 'vitest';
import { analyzeFrame, type FrameModel } from '../src/core/frame';
import { fmember, fnode, fnodeLoad, fsupport } from '../src/core/framePresets';
import { checkFrameMemberLTB, checkFrameMemberOp, type FrameLtbOptions } from '../src/core/ltb';
import { STEEL } from '../src/core/presets';
import { computeSection, plasticProps } from '../src/core/section';
import type { SectionSpec } from '../src/core/types';

const spec: SectionSpec = { kind: 'catalog', family: 'IPE', name: 'IPE 300', rotate: false };
const sec = computeSection(spec);
const L = 5;
const E = 200e9, G = E / 2.6;
const EIy = E * sec.Iy * 1e-12, GJ = G * sec.torsion.J * 1e-12, EIw = E * sec.ltb!.Iw * 1e-18;
const r02 = ((sec.Iy + sec.Iz) / sec.A) * 1e-6;
const Py = (Math.PI ** 2 * EIy) / (L * L);
const PT = (GJ + (Math.PI ** 2 * EIw) / (L * L)) / r02;
const opt: FrameLtbOptions = { loadHeight: 'sc', curve: 'auto', braces: {} };
const fy = 235;

/** thanh ngang khớp – di động, lực dọc P ở đầu B và mô men đều M (mô men nút hai đầu) */
function member(P: number, M: number): FrameModel {
  const A = fnode('A', 0, 0), B = fnode('B', L, 0);
  const m = fmember('AB', A, B, 's');
  const loads = [];
  if (P) loads.push(fnodeLoad('P', B, -P, 0));
  if (M) { loads.push(fnodeLoad('MA', A, 0, 0, M)); loads.push(fnodeLoad('MB', B, 0, 0, -M)); }
  return {
    title: '', material: { ...STEEL }, sections: [{ id: 's', name: 'S', spec }], nodes: [A, B], members: [m],
    supports: [fsupport(A, 'pin'), fsupport(B, 'roller')], loads,
  };
}
const run = (fr: FrameModel) => checkFrameMemberOp(fr, analyzeFrame(fr), fr.members[0].id, opt, fy);

describe('Phương pháp tổng quát EN 1993-1-1 §6.3.4 (α_ult,k, α_cr,op)', () => {
  it('nén thuần: α_cr,op·P = min(N_cr,z, N_cr,T); α_ult,k = A·f_y/P', () => {
    const P = 300;
    const r = run(member(P, 0));
    expect(r.applicable).toBe(true);
    expect(r.alphaUlt).toBeCloseTo((sec.A * fy) / (P * 1e3), 6);
    expect(Math.abs((r.alphaCrOp * P * 1e3) / Math.min(Py, PT) - 1)).toBeLessThan(1e-3);
    expect(r.chiLT).toBe(1);
    expect(r.chiOp).toBeCloseTo(r.chiZ, 12);
  });
  it('uốn thuần: α_cr,op = M_cr/M như thẻ uốn – xoắn', () => {
    const fr = member(0, 50);
    const res = analyzeFrame(fr);
    const op = checkFrameMemberOp(fr, res, fr.members[0].id, opt, fy);
    const lt = checkFrameMemberLTB(fr, res, fr.members[0].id, opt, fy);
    expect(Math.abs(op.alphaCrOp / lt.alpha - 1)).toBeLessThan(1e-6);
    // IPE 300 loại 1 khi uốn → bền dẻo: α_ult,k = W_pl·f_y/M
    expect(op.sectionClass).toBe(1);
    expect(op.plastic).toBe(true);
    expect(op.alphaUlt).toBeCloseTo((plasticProps(sec).Wpl * fy) / 50e6, 6);
  });
  it('nén + mô men đều: (P_y − αP)(P_T − αP) = α²M²/r₀² (gối chạc, đối xứng hai trục)', () => {
    const P = 200, M = 40;
    const r = run(member(P, M));
    const p = P * 1e3, m = M * 1e3;
    const a2 = p * p - (m * m) / r02, a1 = -p * (Py + PT), a0 = Py * PT;
    const roots = [(-a1 - Math.sqrt(a1 * a1 - 4 * a2 * a0)) / (2 * a2), (-a1 + Math.sqrt(a1 * a1 - 4 * a2 * a0)) / (2 * a2)].filter((x) => x > 0);
    const exact = Math.min(...roots);
    expect(Math.abs(r.alphaCrOp / exact - 1)).toBeLessThan(2e-3);
    // nhỏ hơn cả hai trường hợp riêng lẻ
    expect(r.alphaCrOp).toBeLessThan(run(member(P, 0)).alphaCrOp);
    expect(r.alphaCrOp).toBeLessThan(run(member(0, M)).alphaCrOp);
    // λ̄_op, χ_op và hệ số sử dụng
    expect(r.lambdaOp).toBeCloseTo(Math.sqrt(r.alphaUlt / r.alphaCrOp), 12);
    expect(r.chiOp).toBeCloseTo(Math.min(r.chiZ, r.chiLT), 12);
    expect(r.util).toBeCloseTo(fy / (STEEL.allowable * r.chiOp * r.alphaUlt), 12);
  });
  it('giằng giữa nhịp làm tăng α_cr,op', () => {
    const fr = member(200, 40);
    const res = analyzeFrame(fr);
    const a = checkFrameMemberOp(fr, res, fr.members[0].id, opt, fy);
    const b = checkFrameMemberOp(fr, res, fr.members[0].id, { ...opt, braces: { [fr.members[0].id]: 1 } }, fy);
    expect(b.alphaCrOp).toBeGreaterThan(2 * a.alphaCrOp);
    expect(b.util).toBeLessThan(a.util);
  });
});
