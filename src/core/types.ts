/**
 * Mô hình dữ liệu cho một thanh thẳng đặt dọc trục x.
 *
 * Hệ trục:
 *  - x: trục thanh (từ đầu trái x = 0 đến đầu phải x = L)
 *  - y: phương đứng, hướng lên
 *  - z: phương ngang (vuông góc mặt phẳng hình vẽ, hướng ra phía người nhìn)
 *
 * Đơn vị nhập:
 *  - chiều dài thanh, toạ độ: m
 *  - lực tập trung: kN; lực phân bố: kN/m; mô men: kN·m
 *  - kích thước tiết diện: mm
 *  - E: GPa; [σ]: MPa
 *
 * Quy ước dấu của tải trọng nhập vào (theo hệ trục tổng thể):
 *  - Fx > 0 hướng +x, Fy > 0 hướng lên, Fz > 0 hướng +z
 *  - Mz > 0 ngược chiều kim đồng hồ (nhìn trên mặt phẳng hình vẽ xy)
 *  - Mx là mô men xoắn quanh trục thanh (quy tắc bàn tay phải)
 *  - My là mô men quanh trục y (quy tắc bàn tay phải)
 */

export interface Restraints {
  ux: boolean;
  uy: boolean;
  uz: boolean;
  rx: boolean;
  ry: boolean;
  rz: boolean;
}

export type SupportKind = 'fixed' | 'pin' | 'roller' | 'custom' | 'spring';

export interface Support {
  id: string;
  name: string;
  x: number;
  kind: SupportKind;
  /** Chỉ dùng khi kind = 'custom'. Với các loại khác, lấy theo mặc định. */
  restraints: Restraints;
  /** Gối đàn hồi (kind = 'spring'): lò xo tịnh tiến kx, ky, kz (kN/m) và xoay krx, kry, krz (kN·m/rad); 0 = tự do */
  springs?: Springs;
  /** Lún gối / chuyển vị cưỡng bức theo các phương gối chặn: dx, dy, dz (mm); rz, ry (rad·10⁻³) */
  settle?: { dx?: number; dy?: number; dz?: number; rz?: number; ry?: number };
}

export interface Springs {
  kx: number;
  ky: number;
  kz: number;
  krx: number;
  kry: number;
  krz: number;
}
export const NO_SPRINGS: Springs = { kx: 0, ky: 0, kz: 0, krx: 0, kry: 0, krz: 0 };

/** Độ cứng lò xo theo từng liên kết (kN/m hoặc kN·m/rad) */
export const springOf = (s: Support): Record<keyof Restraints, number> => {
  const k = s.springs ?? NO_SPRINGS;
  return { ux: k.kx, uy: k.ky, uz: k.kz, rx: k.krx, ry: k.kry, rz: k.krz };
};

export interface Hinge {
  id: string;
  name: string;
  x: number;
}

export interface PointForce {
  id: string;
  type: 'force';
  name: string;
  x: number;
  Fx: number;
  Fy: number;
  Fz: number;
}

export interface PointMoment {
  id: string;
  type: 'moment';
  name: string;
  x: number;
  /** Mô men xoắn */
  Mx: number;
  My: number;
  Mz: number;
}

export interface DistributedLoad {
  id: string;
  type: 'distributed';
  name: string;
  x1: number;
  x2: number;
  /** Phương của lực phân bố */
  dir: 'x' | 'y' | 'z';
  /** Cường độ tại x1 và x2 (kN/m), mang dấu theo trục */
  q1: number;
  q2: number;
}

/** Nhiệt độ trên đoạn [x1, x2]: độ tăng nhiệt thớ trên (+y) và thớ dưới (°C), tuyến tính theo chiều cao */
export interface TemperatureLoad {
  id: string;
  type: 'temp';
  name: string;
  x1: number;
  x2: number;
  Ttop: number;
  Tbot: number;
  /** chênh nhiệt hai bên T(+z) − T(−z) (°C), tuyến tính theo bề rộng — gây uốn ngang trong mặt phẳng xz */
  dTz?: number;
}

export type Load = PointForce | PointMoment | DistributedLoad | TemperatureLoad;

export interface Material {
  name: string;
  /** GPa */
  E: number;
  /** Hệ số Poisson */
  nu: number;
  /** Ứng suất cho phép [σ], MPa */
  allowable: number;
  /** Giới hạn chảy f_y (MPa) — tuỳ chọn, dùng cho ổn định cục bộ / σ_ch */
  fy?: number;
  /** Khối lượng riêng ρ (kg/m³) — bỏ trống = thép 7850 */
  density?: number;
  /** Hệ số giãn nở nhiệt α_t (1/°C) — bỏ trống = thép 1.2·10⁻⁵ */
  alphaT?: number;
}

export const DEFAULT_DENSITY = 7850;
export const DEFAULT_ALPHA_T = 1.2e-5;
export const alphaTOf = (m: Material) => (m.alphaT && m.alphaT > 0 ? m.alphaT : DEFAULT_ALPHA_T);
export const densityOf = (m: Material) => (m.density && m.density > 0 ? m.density : DEFAULT_DENSITY);
/** Trọng lượng bản thân trên 1 m dài (kN/m) với diện tích A (mm²) */
export const selfWeightPerM = (m: Material, A: number) => (densityOf(m) * 9.81 * A * 1e-6) / 1000;

export type SectionSpec =
  | { kind: 'rect'; b: number; h: number }
  | { kind: 'box'; B: number; H: number; tw: number; tf: number }
  | { kind: 'circle'; D: number }
  | { kind: 'tube'; D: number; t: number }
  | { kind: 'I'; bt: number; tt: number; hw: number; tw: number; bb: number; tb: number; stiffeners?: WebStiffener[] }
  | { kind: 'T'; b: number; tf: number; hw: number; tw: number }
  | { kind: 'U'; h: number; b: number; tw: number; tf: number }
  | { kind: 'L'; b: number; h: number; t: number }
  | { kind: 'polygon'; outer: [number, number][]; holes: [number, number][][] }
  /** Thép hình tra bảng; rotate = xoay 90° (uốn quanh trục yếu) */
  | { kind: 'catalog'; family: string; name: string; rotate: boolean };

/** Sườn dọc bản bụng (bản phẳng hàn vuông góc bụng) */
export interface WebStiffener {
  /** khoảng cách từ mép trên bản bụng đến tâm sườn (mm) */
  pos: number;
  /** bề rộng vươn ra của sườn (mm) */
  b: number;
  /** bề dày sườn (mm) */
  t: number;
  /** đặt một phía hay hai phía bụng */
  sides: 1 | 2;
}

export interface Model {
  title: string;
  length: number;
  material: Material;
  section: SectionSpec;
  supports: Support[];
  hinges: Hinge[];
  loads: Load[];
  /** Tự kể trọng lượng bản thân: 'y' — dầm nằm ngang (tải theo −y); 'x' — cột đứng, chân tại x = 0 (tải dọc trục theo −x) */
  selfWeight?: 'y' | 'x';
}

export const SUPPORT_DEFAULTS: Record<Exclude<SupportKind, 'custom' | 'spring'>, Restraints> = {
  fixed: { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true },
  pin: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
  roller: { ux: false, uy: true, uz: true, rx: false, ry: false, rz: false },
};

export const SUPPORT_LABELS: Record<SupportKind, string> = {
  fixed: 'Ngàm',
  pin: 'Gối cố định (khớp)',
  roller: 'Gối di động',
  custom: 'Tuỳ chỉnh',
  spring: 'Gối đàn hồi (lò xo)',
};

/**
 * Các liên kết của gối. Gối đàn hồi: phương có lò xo (k > 0) được coi là liên kết khi phân tích cấu tạo hình học,
 * nhưng khi giải thì là lò xo (không chặn cứng) — xem isSpring.
 */
export function effectiveRestraints(s: Support): Restraints {
  if (s.kind === 'spring') {
    const k = springOf(s);
    return { ux: k.ux > 0, uy: k.uy > 0, uz: k.uz > 0, rx: k.rx > 0, ry: k.ry > 0, rz: k.rz > 0 };
  }
  return s.kind === 'custom' ? s.restraints : SUPPORT_DEFAULTS[s.kind];
}

export const isSpring = (s: Support) => s.kind === 'spring';

/** Nội lực tại một mặt cắt (đơn vị kN, kN·m). */
export interface InternalForces {
  /** Lực dọc, kéo dương */
  N: number;
  /** Lực cắt theo phương y */
  Qy: number;
  /** Lực cắt theo phương z */
  Qz: number;
  /** Mô men xoắn */
  T: number;
  /** Mô men uốn trong mặt phẳng đứng xy, dương khi căng thớ dưới (y < 0) */
  Mz: number;
  /** Mô men uốn trong mặt phẳng ngang xz, dương khi căng thớ phía z < 0 */
  My: number;
}

export const ZERO_FORCES: InternalForces = { N: 0, Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0 };
