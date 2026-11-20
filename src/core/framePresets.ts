import type { FLoad, FMember, FNode, FrameModel, FSupport, FSupportKind, FDistDir } from './frame';
import { STEEL, uid } from './presets';
import type { SectionSpec } from './types';

export const fnode = (name: string, x: number, y: number): FNode => ({ id: uid('n'), name, x, y });
export const fmember = (name: string, i: FNode, j: FNode, sectionId: string, releaseI = false, releaseJ = false): FMember => ({
  id: uid('b'), name, i: i.id, j: j.id, sectionId, releaseI, releaseJ,
});
export const fsupport = (n: FNode, kind: FSupportKind, angle = 0): FSupport => ({
  id: uid('s'), nodeId: n.id, kind, angle, restraints: { t: true, n: true, r: false },
});
export const fnodeLoad = (name: string, n: FNode, Fx: number, Fy: number, M = 0): FLoad => ({ id: uid('f'), type: 'node', name, nodeId: n.id, Fx, Fy, M });
export const fdist = (name: string, m: FMember, a: number, b: number, q1: number, q2 = q1, dir: FDistDir = 'gy'): FLoad => ({
  id: uid('q'), type: 'mdist', name, memberId: m.id, a, b, q1, q2, dir,
});
export const fpoint = (name: string, m: FMember, a: number, Fx: number, Fy: number, M = 0, local = false): FLoad => ({
  id: uid('p'), type: 'mpoint', name, memberId: m.id, a, Fx, Fy, M, local,
});

const sec = (name: string, spec: SectionSpec) => ({ id: uid('sec'), name, spec });

export interface FramePreset { key: string; label: string; build: () => FrameModel }

/** Dầm nghiêng đơn giản: nhịp ngang l, chênh cao h */
export function inclinedBeam(opts: {
  l: number; h: number; q: number; dir: FDistDir; bottom: FSupportKind; top: FSupportKind; topAngle: number; spec?: SectionSpec;
}): FrameModel {
  const s = sec('Tiết diện dầm', opts.spec ?? { kind: 'I', bt: 150, tt: 12, hw: 276, tw: 8, bb: 150, tb: 12 });
  const A = fnode('A', 0, 0);
  const B = fnode('B', opts.l, opts.h);
  const m = fmember('AB', A, B, s.id);
  const L = Math.hypot(opts.l, opts.h);
  return {
    title: `Dầm nghiêng nhịp ${opts.l} m, chênh cao ${opts.h} m`,
    material: { ...STEEL },
    sections: [s],
    nodes: [A, B],
    members: [m],
    supports: [fsupport(A, opts.bottom), fsupport(B, opts.top, opts.topAngle)],
    loads: opts.q ? [fdist('q', m, 0, L, opts.q, opts.q, opts.dir)] : [],
  };
}

export const FRAME_PRESETS: FramePreset[] = [
  {
    key: 'incl',
    label: 'Dầm nghiêng — gối cố định dưới, gối di động trên (tải theo hình chiếu ngang)',
    build: () => inclinedBeam({ l: 4, h: 3, q: -10, dir: 'gyp', bottom: 'pin', top: 'roller', topAngle: 0 }),
  },
  {
    key: 'incl-perp',
    label: 'Dầm nghiêng — gối di động trên mặt nghiêng song song với dầm',
    build: () => inclinedBeam({ l: 4, h: 3, q: -10, dir: 'gy', bottom: 'pin', top: 'roller', topAngle: (Math.atan2(3, 4) * 180) / Math.PI }),
  },
  {
    key: 'stair',
    label: 'Cầu thang / dầm gãy khúc: đoạn ngang + đoạn nghiêng',
    build: () => {
      const s = sec('Bản thang', { kind: 'rect', b: 1000, h: 120 });
      const A = fnode('A', 0, 0), C = fnode('C', 3, 1.8), B = fnode('B', 4.5, 1.8);
      const m1 = fmember('AC', A, C, s.id), m2 = fmember('CB', C, B, s.id);
      return {
        title: 'Dầm gãy khúc (cầu thang)', material: { name: 'Bê tông B20', E: 27.5, nu: 0.2, allowable: 11.5, density: 2500 }, sections: [s],
        nodes: [A, C, B], members: [m1, m2],
        supports: [fsupport(A, 'pin'), fsupport(B, 'roller')],
        loads: [fdist('q1', m1, 0, Math.hypot(3, 1.8), -8, -8, 'gyp'), fdist('q2', m2, 0, 1.5, -6)],
      };
    },
  },
  {
    key: 'portal-fixed',
    label: 'Khung cổng chân ngàm (siêu tĩnh bậc 3)',
    build: () => {
      const c = sec('Cột', { kind: 'I', bt: 200, tt: 12, hw: 276, tw: 8, bb: 200, tb: 12 });
      const b = sec('Dầm', { kind: 'I', bt: 200, tt: 14, hw: 372, tw: 9, bb: 200, tb: 14 });
      const A = fnode('A', 0, 0), C = fnode('C', 0, 4), D = fnode('D', 6, 4), B = fnode('B', 6, 0);
      const m1 = fmember('AC', A, C, c.id), m2 = fmember('CD', C, D, b.id), m3 = fmember('BD', B, D, c.id);
      return {
        title: 'Khung cổng chân ngàm', material: { ...STEEL }, sections: [c, b], nodes: [A, C, D, B], members: [m1, m2, m3],
        supports: [fsupport(A, 'fixed'), fsupport(B, 'fixed')],
        loads: [fdist('q', m2, 0, 6, -20), fnodeLoad('P', C, 15, 0)],
      };
    },
  },
  {
    key: 'portal-3h',
    label: 'Khung ba khớp (tĩnh định)',
    build: () => {
      const s = sec('Thanh', { kind: 'I', bt: 200, tt: 12, hw: 376, tw: 8, bb: 200, tb: 12 });
      const A = fnode('A', 0, 0), C = fnode('C', 0, 4), K = fnode('K', 4, 4), D = fnode('D', 8, 4), B = fnode('B', 8, 0);
      const m1 = fmember('AC', A, C, s.id), m2 = fmember('CK', C, K, s.id, false, true), m3 = fmember('KD', K, D, s.id), m4 = fmember('BD', B, D, s.id);
      return {
        title: 'Khung ba khớp A – K – B', material: { ...STEEL }, sections: [s], nodes: [A, C, K, D, B], members: [m1, m2, m3, m4],
        supports: [fsupport(A, 'pin'), fsupport(B, 'pin')],
        loads: [fdist('q', m2, 0, 4, -10), fdist('q', m3, 0, 4, -10)],
      };
    },
  },
  {
    key: 'gable',
    label: 'Khung mái dốc (nhà công nghiệp) chân khớp',
    build: () => {
      const c = sec('Cột', { kind: 'I', bt: 200, tt: 10, hw: 330, tw: 8, bb: 200, tb: 10 });
      const r = sec('Kèo', { kind: 'I', bt: 180, tt: 10, hw: 280, tw: 6, bb: 180, tb: 10 });
      const A = fnode('A', 0, 0), C = fnode('C', 0, 6), E = fnode('E', 9, 7.5), D = fnode('D', 18, 6), B = fnode('B', 18, 0);
      const m1 = fmember('AC', A, C, c.id), m2 = fmember('CE', C, E, r.id), m3 = fmember('ED', E, D, r.id), m4 = fmember('BD', B, D, c.id);
      const Lr = Math.hypot(9, 1.5);
      return {
        title: 'Khung nhà mái dốc 18 m', material: { ...STEEL }, sections: [c, r], nodes: [A, C, E, D, B], members: [m1, m2, m3, m4],
        supports: [fsupport(A, 'pin'), fsupport(B, 'pin')],
        loads: [fdist('mái', m2, 0, Lr, -6, -6, 'gyp'), fdist('mái', m3, 0, Lr, -6, -6, 'gyp'), fdist('gió', m1, 0, 6, 3, 3, 'gx')],
      };
    },
  },
  {
    key: 'L',
    label: 'Khung chữ L công-xôn (ngàm chân cột)',
    build: () => {
      const s = sec('Ống hộp', { kind: 'box', B: 150, H: 150, tw: 6, tf: 6 });
      const A = fnode('A', 0, 0), C = fnode('C', 0, 3), D = fnode('D', 2, 3);
      const m1 = fmember('AC', A, C, s.id), m2 = fmember('CD', C, D, s.id);
      return {
        title: 'Khung chữ L', material: { ...STEEL }, sections: [s], nodes: [A, C, D], members: [m1, m2],
        supports: [fsupport(A, 'fixed')],
        loads: [fnodeLoad('P', D, 0, -10), fpoint('H', m1, 1.5, 5, 0)],
      };
    },
  },
];
