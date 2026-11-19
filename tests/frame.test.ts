import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core/analysis';
import { analyzeFrame, type FrameModel } from '../src/core/frame';
import { FRAME_PRESETS, fdist, fmember, fnode, fnodeLoad, fpoint, fsupport, inclinedBeam } from '../src/core/framePresets';
import { PRESETS, STEEL } from '../src/core/presets';

const close = (a: number, b: number, rel = 1e-6) =>
  expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));
const preset = (k: string) => FRAME_PRESETS.find((p) => p.key === k)!.build();
const S = { id: 'sec', name: 's', spec: { kind: 'rect', b: 200, h: 300 } as const };

describe('Dầm nghiêng', () => {
  // nhịp ngang l = 4, chênh cao h = 3 → L = 5, cosα = 0.8, sinα = 0.6
  const r = analyzeFrame(inclinedBeam({ l: 4, h: 3, q: -10, dir: 'gyp', bottom: 'pin', top: 'roller', topAngle: 0 }));
  const m = r.members[0];
  it('tĩnh định, phản lực đứng ql/2', () => {
    expect(r.status).toBe('tinh-dinh');
    close(r.reactions[0].Ry, 20);
    close(r.reactions[1].Ry, 20);
    close(r.reactions[0].Rx, 0);
  });
  it('Mmax = ql²/8 (theo nhịp ngang) tại giữa', () => {
    close(m.internalAt(2.5, 'left').M, (10 * 16) / 8);
  });
  it('N = −V·sinα, Q = V·cosα tại chân', () => {
    const F = m.internalAt(0, 'right');
    close(F.N, -20 * 0.6);
    close(F.Q, 20 * 0.8);
    const Ft = m.internalAt(5, 'left');
    close(Ft.N, 20 * 0.6);
    close(Ft.Q, -20 * 0.8);
  });
  it('gối di động trên mặt nghiêng: phản lực vuông góc mặt tựa', () => {
    const a = (Math.atan2(3, 4) * 180) / Math.PI;
    const r2 = analyzeFrame(inclinedBeam({ l: 4, h: 3, q: -10, dir: 'ly', bottom: 'pin', top: 'roller', topAngle: a }));
    expect(r2.status).toBe('tinh-dinh');
    // tải vuông góc thanh, tổng 50 kN → mỗi gối 25 kN theo phương pháp tuyến
    close(r2.reactions[1].Rn, 25);
    close(r2.reactions[1].Rt, 0);
    close(r2.members[0].internalAt(2.5, 'left').M, (10 * 25) / 8);
    // gối di động song song thanh → không có lực dọc
    expect(Math.abs(r2.members[0].internalAt(4, 'left').N)).toBeLessThan(1e-6);
  });
  it('tải trọng bản thân theo chiều dài: q·L·cos²... tổng hợp đúng', () => {
    const r3 = analyzeFrame(inclinedBeam({ l: 4, h: 3, q: -10, dir: 'gy', bottom: 'pin', top: 'roller', topAngle: 0 }));
    close(r3.reactions[0].Ry + r3.reactions[1].Ry, 50);
    close(r3.members[0].internalAt(2.5, 'left').M, (10 * 5 * 4) / 8);
  });
});

describe('Khung so với lời giải giải tích', () => {
  it('khung ba khớp: lực xô H = ql²/(8f)', () => {
    const r = analyzeFrame(preset('portal-3h'));
    expect(r.status).toBe('tinh-dinh');
    close(r.reactions[0].Ry, 40);
    close(Math.abs(r.reactions[0].Rx), (10 * 64) / (8 * 4));
    close(r.reactions[0].Rx, -r.reactions[1].Rx);
    // mô men tại khớp K = 0
    const ck = r.members.find((m) => m.name === 'CK')!;
    expect(Math.abs(ck.internalAt(4, 'left').M)).toBeLessThan(1e-6);
  });
  it('khung cổng chân ngàm: siêu tĩnh bậc 3, cân bằng', () => {
    const r = analyzeFrame(preset('portal-fixed'));
    expect(r.status).toBe('sieu-tinh');
    expect(r.degree).toBe(3);
    expect(Math.abs(r.residual.X) + Math.abs(r.residual.Y) + Math.abs(r.residual.M)).toBeLessThan(1e-6);
  });
  it('khung cổng đối xứng chịu lực ngang: hai chân chia lực ngang', () => {
    const A = fnode('A', 0, 0), C = fnode('C', 0, 4), D = fnode('D', 6, 4), B = fnode('B', 6, 0);
    const m: FrameModel = {
      title: '', material: { ...STEEL }, sections: [S], nodes: [A, C, D, B],
      members: [fmember('AC', A, C, S.id), fmember('CD', C, D, S.id), fmember('BD', B, D, S.id)],
      supports: [fsupport(A, 'fixed'), fsupport(B, 'fixed')], loads: [fnodeLoad('P', C, 10, 0)],
    };
    const r = analyzeFrame(m);
    // Tổng = −P; chia gần đều (lệch nhỏ do biến dạng dọc trục của dầm)
    close(r.reactions[0].Rx + r.reactions[1].Rx, -10);
    close(r.reactions[0].Rx, -5, 0.01);
    // dầm cứng vô cùng theo dọc trục → chia đúng P/2
    const rigid = analyzeFrame({ ...m, sections: [S, { id: 'big', name: 'b', spec: { kind: 'rect', b: 20000, h: 300 } }],
      members: m.members.map((x) => (x.name === 'CD' ? { ...x, sectionId: 'big' } : x)) });
    close(rigid.reactions[0].Rx, rigid.reactions[1].Rx, 1e-3);
  });
  it('công-xôn ngang: độ võng PL³/3EI + kiểm tra mô men ngàm', () => {
    const A = fnode('A', 0, 0), B = fnode('B', 3, 0);
    const m: FrameModel = {
      title: '', material: { ...STEEL }, sections: [S], nodes: [A, B], members: [fmember('AB', A, B, S.id)],
      supports: [fsupport(A, 'fixed')], loads: [fnodeLoad('P', B, 0, -10)],
    };
    const r = analyzeFrame(m);
    const EI = 200e9 * ((200 * 300 ** 3) / 12) * 1e-12;
    close(r.nodeDisp[1].uy, ((-10e3 * 27) / (3 * EI)) * 1e3, 1e-6);
    close(r.reactions[0].M, 30);
    close(r.members[0].internalAt(0, 'right').M, -30);
  });
  it('khung chữ L: mô men chân cột = P·a − H·h', () => {
    const r = analyzeFrame(preset('L'));
    expect(r.status).toBe('tinh-dinh');
    // P = 10 kN xuống tại đầu công-xôn cách cột 2 m; H = 5 kN sang phải tại cao độ 1.5 m
    close(r.reactions[0].M, 10 * 2 + 5 * 1.5);
    close(r.reactions[0].Rx, -5);
    close(r.reactions[0].Ry, 10);
  });
  it('dầm liên tục dựng bằng khung trùng kết quả bộ giải dầm', () => {
    const beam = analyze(PRESETS.find((p) => p.key === 'continuous')!.build());
    const sec = { id: 'I', name: 'I', spec: { kind: 'I', bt: 300, tt: 30, hw: 450, tw: 30, bb: 300, tb: 30 } as const };
    const A = fnode('A', 0, 0), B = fnode('B', 4, 0), C = fnode('C', 8, 0);
    const m1 = fmember('AB', A, B, sec.id), m2 = fmember('BC', B, C, sec.id);
    const r = analyzeFrame({
      title: '', material: { ...STEEL }, sections: [sec], nodes: [A, B, C], members: [m1, m2],
      supports: [fsupport(A, 'pin'), fsupport(B, 'roller'), fsupport(C, 'roller')],
      loads: [fdist('q', m1, 0, 4, -15), fdist('q', m2, 0, 4, -15), fpoint('P', m2, 2, 0, -40)],
    });
    expect(r.degree).toBe(1);
    r.reactions.forEach((rr, i) => close(rr.Ry, beam.reactions[i].Fy, 1e-6));
    close(r.members[1].internalAt(2, 'left').M, beam.internalAt(6, 'left').Mz, 1e-6);
  });
});

describe('Cấu tạo hình học khung', () => {
  it('khung chân khớp: bậc 1', () => {
    expect(analyzeFrame(preset('gable')).degree).toBe(1);
  });
  it('khung chân khớp + khớp hai đầu dầm → biến hình', () => {
    const A = fnode('A', 0, 0), C = fnode('C', 0, 4), D = fnode('D', 6, 4), B = fnode('B', 6, 0);
    const r = analyzeFrame({
      title: '', material: { ...STEEL }, sections: [S], nodes: [A, C, D, B],
      members: [fmember('AC', A, C, S.id), fmember('CD', C, D, S.id, true, true), fmember('BD', B, D, S.id)],
      supports: [fsupport(A, 'pin'), fsupport(B, 'pin')], loads: [fnodeLoad('P', C, 10, 0)],
    });
    expect(r.status).toBe('bien-hinh');
  });
  it('ba khớp thẳng hàng → biến hình tức thời', () => {
    const A = fnode('A', 0, 0), K = fnode('K', 4, 0), B = fnode('B', 8, 0);
    const r = analyzeFrame({
      title: '', material: { ...STEEL }, sections: [S], nodes: [A, K, B],
      members: [fmember('AK', A, K, S.id, false, true), fmember('KB', K, B, S.id)],
      supports: [fsupport(A, 'pin'), fsupport(B, 'pin')], loads: [fnodeLoad('P', K, 0, -10)],
    });
    expect(r.status).toBe('bien-hinh');
  });
  it('dàn tam giác (khớp mọi đầu thanh): tĩnh định', () => {
    const A = fnode('A', 0, 0), B = fnode('B', 4, 0), C = fnode('C', 2, 2);
    const r = analyzeFrame({
      title: '', material: { ...STEEL }, sections: [S], nodes: [A, B, C],
      members: [fmember('AB', A, B, S.id, true, true), fmember('AC', A, C, S.id, true, true), fmember('BC', B, C, S.id, true, true)],
      supports: [fsupport(A, 'pin'), fsupport(B, 'roller')], loads: [fnodeLoad('P', C, 0, -10)],
    });
    expect(r.status).toBe('tinh-dinh');
    // thanh xiên nén N = −P/(2 sin45°)
    close(r.members[1].internalAt(1, 'left').N, -10 / (2 * Math.SQRT1_2));
    close(r.members[0].internalAt(2, 'left').N, 5);
    expect(Math.abs(r.members[1].internalAt(1, 'left').M)).toBeLessThan(1e-6);
  });
  it('mọi bài mẫu khung đều cân bằng', () => {
    for (const p of FRAME_PRESETS) {
      const r = analyzeFrame(p.build());
      expect(r.ok, p.key).toBe(true);
      expect(Math.abs(r.residual.X) + Math.abs(r.residual.Y) + Math.abs(r.residual.M), p.key).toBeLessThan(1e-6);
    }
  });
});
