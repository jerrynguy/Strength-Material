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

export type SupportKind = 'fixed' | 'pin' | 'roller' | 'custom';

export interface Support {
  id: string;
  name: string;
  x: number;
  kind: SupportKind;
  /** Chỉ dùng khi kind = 'custom'. Với các loại khác, lấy theo mặc định. */
  restraints: Restraints;
}

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

export type Load = PointForce | PointMoment | DistributedLoad;

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
}

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
}

export const SUPPORT_DEFAULTS: Record<Exclude<SupportKind, 'custom'>, Restraints> = {
  fixed: { ux: true, uy: true, uz: true, rx: true, ry: true, rz: true },
  pin: { ux: true, uy: true, uz: true, rx: false, ry: false, rz: false },
  roller: { ux: false, uy: true, uz: true, rx: false, ry: false, rz: false },
};

export const SUPPORT_LABELS: Record<SupportKind, string> = {
  fixed: 'Ngàm',
  pin: 'Gối cố định (khớp)',
  roller: 'Gối di động',
  custom: 'Tuỳ chỉnh',
};

export function effectiveRestraints(s: Support): Restraints {
  return s.kind === 'custom' ? s.restraints : SUPPORT_DEFAULTS[s.kind];
}

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
