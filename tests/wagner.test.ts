import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core/analysis';
import { analyzeFrame, type FrameModel } from '../src/core/frame';
import { fdist, fmember, fnode, fsupport } from '../src/core/framePresets';
import { checkFrameMemberLTB, checkLTB, solveLTB, wagnerBeta, type LtbProblem } from '../src/core/ltb';
import { STEEL, dist, support } from '../src/core/presets';
import { computeSection } from '../src/core/section';
import type { Model, SectionSpec } from '../src/core/types';

// I đối xứng một trục, cánh trên lớn (các bản đủ dày để không phải tiết diện loại 4)
const mono: SectionSpec = { kind: 'I', bt: 300, tt: 20, hw: 400, tw: 12, bb: 150, tb: 14 };
const sym: SectionSpec = { kind: 'I', bt: 200, tt: 16, hw: 400, tw: 10, bb: 200, tb: 16 };

/** ∫y(y² + z²)dA của các chữ nhật, tính giải tích */
function rectsBeta(rs: [number, number, number, number][], yc: number, Iz: number, ySc: number) {
  let I = 0;
  for (const [z1, z2, y1a, y2a] of rs) {
    const y1 = y1a - yc, y2 = y2a - yc;
    I += ((z2 - z1) * (y2 ** 4 - y1 ** 4)) / 4 + ((z2 ** 3 - z1 ** 3) / 3) * ((y2 ** 2 - y1 ** 2) / 2);
  }
  return I / Iz - 2 * ySc;
}

const problem = (spec: SectionSpec, M: number, L: number): LtbProblem => ({
  L, spec, sec: computeSection(spec), material: { ...STEEL }, M: () => M, keyPoints: [], Mmax: M, xMax: 0, dists: [], points: [],
  restraints: [{ x: 0, lateral: true, twist: true }, { x: L, lateral: true, twist: true }], braced: false,
  opt: { loadHeight: 'sc', braces: [], fy: 235, curve: 'auto' },
});

describe('Hiệu ứng Wagner (mặt cắt đối xứng một trục)', () => {
  it('β_y tích phân trên đa giác khớp tính giải tích cho chữ I ba chữ nhật', () => {
    const sec = computeSection(mono);
    const yc = sec.centroid[1];
    const rs: [number, number, number, number][] = [
      [-75, 75, 0, 14], [-6, 6, 14, 414], [-150, 150, 414, 434],
    ];
    // toạ độ z của mặt cắt vẽ có thể lệch: dời về trọng tâm
    const zc = sec.centroid[0];
    const shifted = rs.map(([z1, z2, y1, y2]) => [z1 + zc - zc, z2, y1, y2] as [number, number, number, number]);
    const b = wagnerBeta(sec, sec.ltb!);
    expect(b).toBeCloseTo(rectsBeta(shifted, yc, sec.Iz, sec.ltb!.ySc), 6);
    expect(b).toBeLessThan(0); // cánh trên lớn → β_y < 0
    const s = computeSection(sym);
    expect(Math.abs(wagnerBeta(s, s.ltb!))).toBeLessThan(1e-6);
  });
  it('mô men đều, gối chạc: M_cr = P_y[∓β/2 + √(β²/4 + I_w/I_y + GI_tL²/(π²EI_y))]', () => {
    const L = 8;
    const sec = computeSection(mono);
    const E = 200e9, G = E / 2.6;
    const Py = (Math.PI ** 2 * E * sec.Iy * 1e-12) / (L * L);
    const beta = wagnerBeta(sec, sec.ltb!) / 1e3;
    const root = Math.sqrt(beta ** 2 / 4 + (sec.ltb!.Iw * 1e-6) / sec.Iy + (G * sec.torsion.J * 1e-12 * L * L) / (Math.PI ** 2 * E * sec.Iy * 1e-12));
    const McrPos = (Py * (-beta / 2 + root)) / 1e3; // cánh lớn chịu nén
    const McrNeg = (Py * (beta / 2 + root)) / 1e3; // cánh nhỏ chịu nén
    const rp = solveLTB(problem(mono, 100, L));
    const rn = solveLTB(problem(mono, -100, L));
    expect(Math.abs(rp.Mcr / McrPos - 1)).toBeLessThan(2e-3);
    expect(Math.abs(rn.Mcr / McrNeg - 1)).toBeLessThan(2e-3);
    expect(rp.Mcr).toBeGreaterThan(rn.Mcr);
  });
  it('đối xứng hai trục: M_cr không đổi khi đổi chiều mô men', () => {
    const a = solveLTB(problem(sym, 100, 6)), b = solveLTB(problem(sym, -100, 6));
    expect(Math.abs(a.Mcr / b.Mcr - 1)).toBeLessThan(1e-6);
    expect(a.betaY).toBe(0);
  });
});

describe('Ổn định uốn – xoắn của thanh khung', () => {
  const L = 6;
  const beamModel = (): Model => ({
    title: '', length: L, material: { ...STEEL }, section: sym,
    supports: [support('A', 0, 'pin'), support('B', L, 'roller')], hinges: [], loads: [dist('q', 0, L, -20)],
  });
  const frameModel = (): FrameModel => {
    const A = fnode('A', 0, 0), B = fnode('B', L, 0);
    const m = fmember('AB', A, B, 's');
    return {
      title: '', material: { ...STEEL }, sections: [{ id: 's', name: 'S', spec: sym }], nodes: [A, B], members: [m],
      supports: [fsupport(A, 'pin'), fsupport(B, 'roller')], loads: [fdist('q', m, 0, L, -20)],
    };
  };
  it('dầm đơn giản mô hình bằng khung cho cùng M_cr như chế độ dầm (cả tải ở cánh trên)', () => {
    const bm = beamModel();
    const fr = frameModel();
    const fres = analyzeFrame(fr);
    for (const lh of ['sc', 'top'] as const) {
      const b = checkLTB(bm, analyze(bm), { loadHeight: lh, braces: [], fy: 235, curve: 'auto' });
      const f = checkFrameMemberLTB(fr, fres, fr.members[0].id, { loadHeight: lh, curve: 'auto', braces: {} }, 235);
      expect(f.applicable).toBe(true);
      expect(Math.abs(f.Mcr / b.Mcr - 1)).toBeLessThan(1e-3);
      expect(Math.abs(f.util / b.util - 1)).toBeLessThan(1e-3);
    }
  });
  it('giằng giữa nhịp làm tăng M_cr', () => {
    const fr = frameModel();
    const fres = analyzeFrame(fr);
    const id = fr.members[0].id;
    const a = checkFrameMemberLTB(fr, fres, id, { loadHeight: 'sc', curve: 'auto', braces: {} }, 235);
    const b = checkFrameMemberLTB(fr, fres, id, { loadHeight: 'sc', curve: 'auto', braces: { [id]: 1 } }, 235);
    expect(b.Mcr).toBeGreaterThan(2 * a.Mcr);
  });
  it('công-xôn trong khung: đầu tự do không có liên kết chống xoắn, đầu ngàm kiềm chế vênh', () => {
    const A = fnode('A', 0, 0), B = fnode('B', 3, 0);
    const m = fmember('AB', A, B, 's');
    const fr: FrameModel = {
      title: '', material: { ...STEEL }, sections: [{ id: 's', name: 'S', spec: sym }], nodes: [A, B], members: [m],
      supports: [fsupport(A, 'fixed')], loads: [fdist('q', m, 0, 3, -10)],
    };
    const r = checkFrameMemberLTB(fr, analyzeFrame(fr), m.id, { loadHeight: 'sc', curve: 'auto', braces: {} }, 235);
    expect(r.applicable).toBe(true);
    const bm: Model = { title: '', length: 3, material: { ...STEEL }, section: sym, supports: [support('A', 0, 'fixed')], hinges: [], loads: [dist('q', 0, 3, -10)] };
    const b = checkLTB(bm, analyze(bm), { loadHeight: 'sc', braces: [], fy: 235, curve: 'auto' });
    expect(Math.abs(r.Mcr / b.Mcr - 1)).toBeLessThan(1e-3);
  });
});
