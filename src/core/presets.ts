import { SECTION_DEFAULTS } from './section';
import { NO_SPRINGS, SUPPORT_DEFAULTS, type Load, type Material, type Model, type Support, type SupportKind } from './types';

let counter = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}_${(counter++).toString(36)}`;

export const STEEL: Material = { name: 'Thép CT3 / CCT34', E: 200, nu: 0.3, allowable: 160, density: 7850 };

export function support(name: string, x: number, kind: SupportKind): Support {
  return {
    id: uid('s'), name, x, kind,
    restraints: { ...(kind === 'custom' || kind === 'spring' ? SUPPORT_DEFAULTS.pin : SUPPORT_DEFAULTS[kind]) },
    ...(kind === 'spring' ? { springs: { ...NO_SPRINGS, ky: 10000 } } : {}),
  };
}

export const force = (name: string, x: number, Fy: number, Fx = 0, Fz = 0): Load => ({ id: uid('f'), type: 'force', name, x, Fx, Fy, Fz });
export const moment = (name: string, x: number, Mz: number, Mx = 0, My = 0): Load => ({ id: uid('m'), type: 'moment', name, x, Mx, My, Mz });
export const dist = (name: string, x1: number, x2: number, q1: number, q2 = q1, dir: 'x' | 'y' | 'z' = 'y'): Load => ({
  id: uid('q'), type: 'distributed', name, x1, x2, dir, q1, q2,
});

export interface Preset {
  key: string;
  label: string;
  build: () => Model;
}

export const PRESETS: Preset[] = [
  {
    key: 'hinh1',
    label: 'Đề mẫu Hình 1 — dầm mút thừa, lực 20 kN và mô men 100 kN·m',
    build: () => ({
      title: 'Hình 1: Xác định Q, M tại C',
      length: 6,
      material: { ...STEEL },
      section: { ...SECTION_DEFAULTS.I },
      supports: [support('A', 2, 'pin'), support('B', 4, 'roller')],
      hinges: [],
      loads: [force('P', 0, -20), moment('M', 6, -100)],
    }),
  },
  {
    key: 'simple-q',
    label: 'Dầm đơn giản chịu tải phân bố đều',
    build: () => ({
      title: 'Dầm đơn giản, q = 10 kN/m',
      length: 6,
      material: { ...STEEL },
      section: { kind: 'catalog', family: 'I_GOST', name: 'I24', rotate: false },
      supports: [support('A', 0, 'pin'), support('B', 6, 'roller')],
      hinges: [],
      loads: [dist('q', 0, 6, -10)],
    }),
  },
  {
    key: 'ltb',
    label: 'Dầm thép IPE không giằng ngang (kiểm tra uốn – xoắn)',
    build: () => ({
      title: 'Dầm IPE 300 nhịp 6 m, tải trên cánh trên',
      length: 6,
      material: { ...STEEL },
      section: { kind: 'catalog', family: 'IPE', name: 'IPE 300', rotate: false },
      supports: [support('A', 0, 'pin'), support('B', 6, 'roller')],
      hinges: [],
      loads: [dist('q', 0, 6, -12)],
    }),
  },
  {
    key: 'plate-girder',
    label: 'Dầm tổ hợp hàn bản bụng mỏng (ổn định cục bộ)',
    build: () => ({
      title: 'Dầm tổ hợp hàn nhịp 12 m, bụng 1000×8',
      length: 12,
      material: { ...STEEL },
      section: { kind: 'I', bt: 320, tt: 18, hw: 1000, tw: 8, bb: 320, tb: 18 },
      supports: [support('A', 0, 'pin'), support('B', 12, 'roller')],
      hinges: [],
      loads: [dist('q', 0, 12, -45)],
    }),
  },
  {
    key: 'stiff-girder',
    label: 'Dầm tổ hợp hàn bụng cao có sườn dọc',
    build: () => ({
      title: 'Dầm tổ hợp hàn nhịp 16 m, bụng 1400×8 có sườn dọc',
      length: 16,
      material: { ...STEEL },
      section: { kind: 'I', bt: 360, tt: 20, hw: 1400, tw: 8, bb: 360, tb: 20, stiffeners: [{ pos: 280, b: 120, t: 12, sides: 1 }] },
      supports: [support('A', 0, 'pin'), support('B', 16, 'roller')],
      hinges: [],
      loads: [dist('q', 0, 16, -40)],
    }),
  },
  {
    key: 'cantilever',
    label: 'Dầm công-xôn (ngàm một đầu) — tiết diện hộp rỗng',
    build: () => ({
      title: 'Công-xôn, lực tập trung đầu tự do',
      length: 3,
      material: { ...STEEL },
      section: { kind: 'box', B: 150, H: 200, tw: 8, tf: 8 },
      supports: [support('A', 0, 'fixed')],
      hinges: [],
      loads: [force('P', 3, -15)],
    }),
  },
  {
    key: 'fixed-fixed',
    label: 'Dầm hai đầu ngàm (siêu tĩnh bậc 3)',
    build: () => ({
      title: 'Hai đầu ngàm, q = 20 kN/m',
      length: 6,
      material: { ...STEEL },
      section: { kind: 'rect', b: 200, h: 400 },
      supports: [support('A', 0, 'fixed'), support('B', 6, 'fixed')],
      hinges: [],
      loads: [dist('q', 0, 6, -20)],
    }),
  },
  {
    key: 'continuous',
    label: 'Dầm liên tục 3 gối (siêu tĩnh bậc 1)',
    build: () => ({
      title: 'Dầm liên tục 2 nhịp',
      length: 8,
      material: { ...STEEL },
      section: { ...SECTION_DEFAULTS.I },
      supports: [support('A', 0, 'pin'), support('B', 4, 'roller'), support('C', 8, 'roller')],
      hinges: [],
      loads: [dist('q', 0, 8, -15), force('P', 6, -40)],
    }),
  },
  {
    key: 'imposed',
    label: 'Dầm liên tục: lún gối và nhiệt độ (siêu tĩnh)',
    build: () => ({
      title: 'Dầm liên tục hai nhịp — gối giữa lún 10 mm, mặt trên nóng hơn 20 °C',
      length: 12,
      material: { ...STEEL },
      section: { kind: 'I', bt: 200, tt: 12, hw: 400, tw: 8, bb: 200, tb: 12 },
      supports: [support('A', 0, 'pin'), { ...support('B', 6, 'roller'), settle: { dy: -10 } }, support('C', 12, 'roller')],
      hinges: [],
      loads: [dist('q', 0, 12, -10), { id: uid('t'), type: 'temp', name: 't', x1: 0, x2: 12, Ttop: 30, Tbot: 10 }],
    }),
  },
  {
    key: 'springs',
    label: 'Dầm trên các gối đàn hồi (lò xo)',
    build: () => ({
      title: 'Dầm tựa trên 5 lò xo k = 5000 kN/m, đầu trái có lò xo xoay',
      length: 8,
      material: { ...STEEL },
      section: { kind: 'catalog', family: 'I_GOST', name: 'I30', rotate: false },
      supports: [
        { ...support('A', 0, 'pin') },
        { ...support('Aφ', 0, 'spring'), springs: { ...NO_SPRINGS, krz: 20000 } },
        ...[2, 4, 6, 8].map((x, i) => ({ ...support(`S${i + 1}`, x, 'spring'), springs: { ...NO_SPRINGS, ky: 5000 } })),
      ],
      hinges: [],
      loads: [force('P', 3, -60), dist('q', 0, 8, -5)],
    }),
  },
  {
    key: 'gerber',
    label: 'Dầm ghép có khớp nối (tĩnh định)',
    build: () => ({
      title: 'Dầm ghép (Gerber)',
      length: 9,
      material: { ...STEEL },
      section: { ...SECTION_DEFAULTS.I },
      supports: [support('A', 0, 'fixed'), support('B', 9, 'roller')],
      hinges: [{ id: uid('h'), name: 'K', x: 4 }],
      loads: [force('P', 2, -30), dist('q', 4, 9, -10)],
    }),
  },
  {
    key: 'column',
    label: 'Cột chịu nén lệch tâm (nén + uốn)',
    build: () => ({
      title: 'Thanh ngàm chịu nén và lực ngang',
      length: 4,
      material: { ...STEEL },
      section: { kind: 'tube', D: 219, t: 8 },
      supports: [support('A', 0, 'fixed')],
      hinges: [],
      loads: [force('P', 4, -5, -200)],
    }),
  },
  {
    key: 'shaft',
    label: 'Trục truyền động: uốn + xoắn',
    build: () => {
      const A = support('A', 0, 'pin');
      A.kind = 'custom';
      A.restraints = { ux: true, uy: true, uz: true, rx: true, ry: false, rz: false };
      return {
        title: 'Trục chịu uốn và xoắn',
        length: 1.2,
        material: { ...STEEL },
        section: { kind: 'circle', D: 60 },
        supports: [A, support('B', 1.2, 'roller')],
        hinges: [],
        loads: [force('P', 0.4, -8, 0, 3), moment('T', 0.8, 0, 1.5)],
      };
    },
  },
  {
    key: 'bar',
    label: 'Thanh kéo/nén nhiều đoạn (siêu tĩnh — ngàm hai đầu)',
    build: () => ({
      title: 'Thanh hai đầu ngàm chịu lực dọc',
      length: 3,
      material: { ...STEEL },
      section: { kind: 'circle', D: 40 },
      supports: [support('A', 0, 'fixed'), support('B', 3, 'fixed')],
      hinges: [],
      loads: [force('P', 1, 0, 100)],
    }),
  },
];

export const defaultModel = (): Model => PRESETS[0].build();
