/**
 * Đặc trưng hình học của mặt cắt ngang.
 *
 * Toạ độ trong mặt cắt: z nằm ngang, y thẳng đứng hướng lên (mm).
 * Các đại lượng trả về lấy đối với hệ trục trung tâm (gốc tại trọng tâm C).
 *
 * Mặt cắt dạng đa giác (kể cả có lỗ rỗng) được tính tổng quát bằng công thức Green,
 * nên mọi hình (I, hộp rỗng, T, U, L, tự vẽ...) đều dùng chung một thuật toán.
 * Tròn đặc / ống tròn được tính giải tích để tránh sai số rời rạc hoá.
 */
import type { SectionSpec } from './types';

export type Pt = [number, number]; // [z, y]

export interface Ring {
  pts: Pt[];
  hole: boolean;
}

export interface TorsionInfo {
  /** Mô men quán tính xoắn J (mm⁴). 0 nếu không hỗ trợ. */
  J: number;
  /** Mô tả mô hình tính */
  model: string;
  /** τ_max (MPa) do mô men xoắn T (N·mm) */
  tauMax(T: number): number;
  /** τ tại điểm (y, z so với trọng tâm) — chỉ có với mặt cắt tròn */
  tauAt?(y: number, z: number, T: number): number;
}

export interface SectionProps {
  label: string;
  /** Diện tích (mm²) */
  A: number;
  /** Mô men quán tính với trục trung tâm nằm ngang z: ∫y²dA (mm⁴) — dùng cho uốn trong mặt phẳng đứng */
  Iz: number;
  /** ∫z²dA (mm⁴) — dùng cho uốn trong mặt phẳng ngang */
  Iy: number;
  /** Mô men quán tính ly tâm ∫yz dA (mm⁴) */
  Iyz: number;
  /** Toạ độ trọng tâm trong hệ toạ độ vẽ (mm) */
  centroid: Pt;
  /** Giới hạn mặt cắt so với trọng tâm */
  yMin: number;
  yMax: number;
  zMin: number;
  zMax: number;
  /** Đường bao để vẽ (toạ độ vẽ, mm) */
  rings: Ring[];
  /** Bề rộng mặt cắt tại cao độ y (so với trọng tâm) */
  widthAtY(y: number): number;
  /** Mô men tĩnh với trục z của phần diện tích phía trên đường y = const */
  firstMomentAboveY(y: number): number;
  /** Chiều cao mặt cắt tại toạ độ z */
  heightAtZ(z: number): number;
  /** Mô men tĩnh với trục y của phần diện tích phía z' > z */
  firstMomentBeyondZ(z: number): number;
  /** Có chứa điểm (y, z) so với trọng tâm không */
  contains(y: number, z: number): boolean;
  /** Các điểm biên dùng để dò ứng suất pháp lớn nhất (so với trọng tâm) [z, y] */
  checkPoints: Pt[];
  torsion: TorsionInfo;
}

// ───────────────────────── Đa giác ─────────────────────────

interface RawProps {
  A: number;
  Sz: number; // ∫y dA
  Sy: number; // ∫z dA
  Iyy0: number; // ∫y² dA (quanh gốc)
  Izz0: number; // ∫z² dA
  Iyz0: number; // ∫yz dA
}

function ringRaw(pts: Pt[]): RawProps {
  let A = 0, Sz = 0, Sy = 0, Iyy0 = 0, Izz0 = 0, Iyz0 = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [z1, y1] = pts[i];
    const [z2, y2] = pts[(i + 1) % n];
    const c = z1 * y2 - z2 * y1;
    A += c;
    Sy += (z1 + z2) * c;
    Sz += (y1 + y2) * c;
    Iyy0 += (y1 * y1 + y1 * y2 + y2 * y2) * c;
    Izz0 += (z1 * z1 + z1 * z2 + z2 * z2) * c;
    Iyz0 += (z1 * y2 + 2 * z1 * y1 + 2 * z2 * y2 + z2 * y1) * c;
  }
  const r: RawProps = { A: A / 2, Sy: Sy / 6, Sz: Sz / 6, Iyy0: Iyy0 / 12, Izz0: Izz0 / 12, Iyz0: Iyz0 / 24 };
  if (r.A < 0) {
    r.A = -r.A; r.Sy = -r.Sy; r.Sz = -r.Sz; r.Iyy0 = -r.Iyy0; r.Izz0 = -r.Izz0; r.Iyz0 = -r.Iyz0;
  }
  return r;
}

function ringsRaw(rings: Ring[]): RawProps {
  const t: RawProps = { A: 0, Sz: 0, Sy: 0, Iyy0: 0, Izz0: 0, Iyz0: 0 };
  for (const r of rings) {
    if (r.pts.length < 3) continue;
    const p = ringRaw(r.pts);
    const s = r.hole ? -1 : 1;
    t.A += s * p.A; t.Sz += s * p.Sz; t.Sy += s * p.Sy;
    t.Iyy0 += s * p.Iyy0; t.Izz0 += s * p.Izz0; t.Iyz0 += s * p.Iyz0;
  }
  return t;
}

/** Cắt đa giác, giữ phần có toạ độ (axis) ≥ v (Sutherland–Hodgman). axis 0 = z, 1 = y */
function clipHalf(pts: Pt[], axis: 0 | 1, v: number): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const P = pts[i];
    const Q = pts[(i + 1) % n];
    const pin = P[axis] >= v;
    const qin = Q[axis] >= v;
    if (pin && qin) out.push(Q);
    else if (pin && !qin) out.push(intersect(P, Q, axis, v));
    else if (!pin && qin) { out.push(intersect(P, Q, axis, v)); out.push(Q); }
  }
  return out;
}

function intersect(P: Pt, Q: Pt, axis: 0 | 1, v: number): Pt {
  const t = (v - P[axis]) / (Q[axis] - P[axis]);
  return [P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])];
}

/** Tổng độ dài giao của đường thẳng (axis = v) với đa giác. */
function chordLength(pts: Pt[], axis: 0 | 1, v: number): number {
  const other = axis === 0 ? 1 : 0;
  const xs: number[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const P = pts[i];
    const Q = pts[(i + 1) % n];
    const a = P[axis], b = Q[axis];
    if ((a <= v && b > v) || (b <= v && a > v)) {
      const t = (v - a) / (b - a);
      xs.push(P[other] + t * (Q[other] - P[other]));
    }
  }
  xs.sort((p, q) => p - q);
  let L = 0;
  for (let i = 0; i + 1 < xs.length; i += 2) L += xs[i + 1] - xs[i];
  return L;
}

function pointInRing(pts: Pt[], z: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [zi, yi] = pts[i];
    const [zj, yj] = pts[j];
    if (yi > y !== yj > y && z < ((zj - zi) * (y - yi)) / (yj - yi) + zi) inside = !inside;
  }
  return inside;
}

function polygonSection(label: string, rings: Ring[], torsion: TorsionInfo): SectionProps {
  const raw = ringsRaw(rings);
  const A = raw.A;
  const zc = raw.Sy / A;
  const yc = raw.Sz / A;
  const Iz = raw.Iyy0 - A * yc * yc;
  const Iy = raw.Izz0 - A * zc * zc;
  const Iyz = raw.Iyz0 - A * zc * yc;
  let yMin = Infinity, yMax = -Infinity, zMin = Infinity, zMax = -Infinity;
  const checkPoints: Pt[] = [];
  for (const r of rings) {
    for (const [z, y] of r.pts) {
      yMin = Math.min(yMin, y - yc); yMax = Math.max(yMax, y - yc);
      zMin = Math.min(zMin, z - zc); zMax = Math.max(zMax, z - zc);
      checkPoints.push([z - zc, y - yc]);
    }
  }
  const sum = (f: (r: Ring) => number) => rings.reduce((s, r) => s + (r.hole ? -1 : 1) * f(r), 0);
  return {
    label, A, Iz, Iy, Iyz: Math.abs(Iyz) < 1e-9 * Math.max(Iz, Iy) ? 0 : Iyz,
    centroid: [zc, yc], yMin, yMax, zMin, zMax, rings, checkPoints, torsion,
    widthAtY: (y) => Math.max(0, sum((r) => chordLength(r.pts, 1, y + yc))),
    heightAtZ: (z) => Math.max(0, sum((r) => chordLength(r.pts, 0, z + zc))),
    firstMomentAboveY: (y) =>
      sum((r) => {
        const c = clipHalf(r.pts, 1, y + yc);
        if (c.length < 3) return 0;
        const p = ringRaw(c);
        return p.Sz - p.A * yc;
      }),
    firstMomentBeyondZ: (z) =>
      sum((r) => {
        const c = clipHalf(r.pts, 0, z + zc);
        if (c.length < 3) return 0;
        const p = ringRaw(c);
        return p.Sy - p.A * zc;
      }),
    contains: (y, z) => {
      let inOuter = false;
      for (const r of rings) {
        const inside = pointInRing(r.pts, z + zc, y + yc);
        if (r.hole && inside) return false;
        if (!r.hole && inside) inOuter = true;
      }
      return inOuter;
    },
  };
}

// ───────────────────────── Xoắn ─────────────────────────

const RECT_ALPHA: [number, number][] = [
  [1, 0.208], [1.5, 0.231], [2, 0.246], [2.5, 0.258], [3, 0.267], [4, 0.282], [6, 0.299], [10, 0.312], [1e9, 0.333],
];

function interp(table: [number, number][], x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    if (x <= table[i][0]) {
      const [x0, y0] = table[i - 1];
      const [x1, y1] = table[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

function rectTorsion(b: number, h: number): TorsionInfo {
  const a = Math.max(b, h);
  const c = Math.min(b, h);
  const J = a * c ** 3 * (1 / 3 - 0.21 * (c / a) * (1 - c ** 4 / (12 * a ** 4)));
  const alpha = interp(RECT_ALPHA, a / c);
  return {
    J,
    model: `Chữ nhật (Saint-Venant): τmax = T/(α·h·b²), α = ${alpha.toFixed(3)}`,
    tauMax: (T) => Math.abs(T) / (alpha * a * c * c),
  };
}

function openThinTorsion(parts: [number, number][]): TorsionInfo {
  const J = parts.reduce((s, [len, t]) => s + (len * t ** 3) / 3, 0);
  const tmax = Math.max(...parts.map((p) => p[1]));
  return {
    J,
    model: 'Thành mỏng hở: J = Σ b·t³/3, τmax = T·t_max/J',
    tauMax: (T) => (Math.abs(T) * tmax) / J,
  };
}

// ───────────────────────── Hình tròn ─────────────────────────

function circularSection(D: number, d: number): SectionProps {
  const R = D / 2;
  const r = d / 2;
  const A = Math.PI * (R * R - r * r);
  const I = (Math.PI * (R ** 4 - r ** 4)) / 4;
  const Ip = 2 * I;
  const circle = (rad: number, hole: boolean): Ring => ({
    hole,
    pts: Array.from({ length: 96 }, (_, i) => {
      const t = (2 * Math.PI * i) / 96;
      return [R + rad * Math.cos(t), R + rad * Math.sin(t)] as Pt;
    }),
  });
  const chord = (rad: number, y: number) => (Math.abs(y) < rad ? 2 * Math.sqrt(rad * rad - y * y) : 0);
  const sAbove = (rad: number, y: number) =>
    Math.abs(y) < rad ? (2 / 3) * (rad * rad - y * y) ** 1.5 : 0;
  const rings = [circle(R, false)];
  if (r > 0) rings.push(circle(r, true));
  const checkPoints: Pt[] = Array.from({ length: 72 }, (_, i) => {
    const t = (2 * Math.PI * i) / 72;
    return [R * Math.cos(t), R * Math.sin(t)] as Pt;
  });
  return {
    label: r > 0 ? `Ống tròn D=${D}, t=${(D - d) / 2} mm` : `Tròn đặc D=${D} mm`,
    A, Iz: I, Iy: I, Iyz: 0,
    centroid: [R, R], yMin: -R, yMax: R, zMin: -R, zMax: R, rings, checkPoints,
    widthAtY: (y) => chord(R, y) - chord(r, y),
    heightAtZ: (z) => chord(R, z) - chord(r, z),
    firstMomentAboveY: (y) => sAbove(R, y) - sAbove(r, y),
    firstMomentBeyondZ: (z) => sAbove(R, z) - sAbove(r, z),
    contains: (y, z) => {
      const rho = Math.hypot(y, z);
      return rho <= R && rho >= r;
    },
    torsion: {
      J: Ip,
      model: 'Tròn: τ = T·ρ/Ip, J = Ip',
      tauMax: (T) => (Math.abs(T) * R) / Ip,
      tauAt: (y, z, T) => (Math.abs(T) * Math.hypot(y, z)) / Ip,
    },
  };
}

// ───────────────────────── Bộ dựng ─────────────────────────

const rect = (z0: number, y0: number, w: number, h: number): Pt[] => [
  [z0, y0], [z0 + w, y0], [z0 + w, y0 + h], [z0, y0 + h],
];

export function validateSection(s: SectionSpec): string | null {
  const pos = (...v: number[]) => v.every((x) => Number.isFinite(x) && x > 0);
  switch (s.kind) {
    case 'rect': return pos(s.b, s.h) ? null : 'Kích thước phải dương';
    case 'box':
      if (!pos(s.B, s.H, s.tw, s.tf)) return 'Kích thước phải dương';
      return 2 * s.tw < s.B && 2 * s.tf < s.H ? null : 'Chiều dày thành quá lớn so với kích thước ngoài';
    case 'circle': return pos(s.D) ? null : 'Đường kính phải dương';
    case 'tube':
      if (!pos(s.D, s.t)) return 'Kích thước phải dương';
      return 2 * s.t < s.D ? null : 'Chiều dày ống phải nhỏ hơn D/2';
    case 'I':
      if (!pos(s.bt, s.tt, s.hw, s.tw, s.bb, s.tb)) return 'Kích thước phải dương';
      return s.tw <= Math.min(s.bt, s.bb) ? null : 'Bản bụng rộng hơn bản cánh';
    case 'T':
      if (!pos(s.b, s.tf, s.hw, s.tw)) return 'Kích thước phải dương';
      return s.tw <= s.b ? null : 'Bản bụng rộng hơn bản cánh';
    case 'U':
      if (!pos(s.h, s.b, s.tw, s.tf)) return 'Kích thước phải dương';
      return 2 * s.tf < s.h && s.tw < s.b ? null : 'Chiều dày quá lớn';
    case 'L':
      if (!pos(s.b, s.h, s.t)) return 'Kích thước phải dương';
      return s.t < Math.min(s.b, s.h) ? null : 'Chiều dày quá lớn';
    case 'polygon': {
      if (s.outer.length < 3) return 'Đa giác cần ít nhất 3 đỉnh';
      const p = ringsRaw([{ pts: s.outer, hole: false }, ...s.holes.map((h) => ({ pts: h, hole: true }))]);
      return p.A > 0 ? null : 'Diện tích không hợp lệ';
    }
  }
}

export function computeSection(s: SectionSpec): SectionProps {
  switch (s.kind) {
    case 'rect':
      return polygonSection(`Chữ nhật ${s.b}×${s.h} mm`, [{ pts: rect(-s.b / 2, 0, s.b, s.h), hole: false }], rectTorsion(s.b, s.h));
    case 'box': {
      const bm = s.B - s.tw;
      const hm = s.H - s.tf;
      const A0 = bm * hm;
      const loop = (2 * bm) / s.tf + (2 * hm) / s.tw;
      const tmin = Math.min(s.tw, s.tf);
      return polygonSection(
        `Hộp rỗng ${s.B}×${s.H}, thành ${s.tw}/${s.tf} mm`,
        [
          { pts: rect(-s.B / 2, 0, s.B, s.H), hole: false },
          { pts: rect(-s.B / 2 + s.tw, s.tf, s.B - 2 * s.tw, s.H - 2 * s.tf), hole: true },
        ],
        {
          J: (4 * A0 * A0) / loop,
          model: 'Thành mỏng kín (Bredt): τ = T/(2·A₀·t), J = 4A₀²/∮ds/t',
          tauMax: (T) => Math.abs(T) / (2 * A0 * tmin),
        },
      );
    }
    case 'circle':
      return circularSection(s.D, 0);
    case 'tube':
      return circularSection(s.D, s.D - 2 * s.t);
    case 'I': {
      const H = s.tb + s.hw + s.tt;
      const pts: Pt[] = [
        [-s.bb / 2, 0], [s.bb / 2, 0], [s.bb / 2, s.tb], [s.tw / 2, s.tb], [s.tw / 2, s.tb + s.hw],
        [s.bt / 2, s.tb + s.hw], [s.bt / 2, H], [-s.bt / 2, H], [-s.bt / 2, s.tb + s.hw],
        [-s.tw / 2, s.tb + s.hw], [-s.tw / 2, s.tb], [-s.bb / 2, s.tb],
      ];
      return polygonSection(
        `Chữ I (cánh ${s.bt}×${s.tt}, bụng ${s.hw}×${s.tw}, cánh ${s.bb}×${s.tb} mm)`,
        [{ pts, hole: false }],
        openThinTorsion([[s.bt, s.tt], [s.bb, s.tb], [s.hw, s.tw]]),
      );
    }
    case 'T': {
      const pts: Pt[] = [
        [-s.tw / 2, 0], [s.tw / 2, 0], [s.tw / 2, s.hw], [s.b / 2, s.hw], [s.b / 2, s.hw + s.tf],
        [-s.b / 2, s.hw + s.tf], [-s.b / 2, s.hw], [-s.tw / 2, s.hw],
      ];
      return polygonSection(`Chữ T (cánh ${s.b}×${s.tf}, bụng ${s.hw}×${s.tw} mm)`, [{ pts, hole: false }],
        openThinTorsion([[s.b, s.tf], [s.hw, s.tw]]));
    }
    case 'U': {
      const pts: Pt[] = [
        [0, 0], [s.b, 0], [s.b, s.tf], [s.tw, s.tf], [s.tw, s.h - s.tf], [s.b, s.h - s.tf], [s.b, s.h], [0, s.h],
      ];
      return polygonSection(`Chữ U ${s.h}×${s.b} (bụng ${s.tw}, cánh ${s.tf} mm)`, [{ pts, hole: false }],
        openThinTorsion([[s.b, s.tf], [s.b, s.tf], [s.h - 2 * s.tf, s.tw]]));
    }
    case 'L': {
      const pts: Pt[] = [[0, 0], [s.b, 0], [s.b, s.t], [s.t, s.t], [s.t, s.h], [0, s.h]];
      return polygonSection(`Chữ L ${s.b}×${s.h}×${s.t} mm`, [{ pts, hole: false }],
        openThinTorsion([[s.b, s.t], [s.h - s.t, s.t]]));
    }
    case 'polygon':
      return polygonSection(
        'Đa giác tự định nghĩa',
        [{ pts: s.outer, hole: false }, ...s.holes.map((h) => ({ pts: h, hole: true }))],
        { J: 0, model: 'Chưa hỗ trợ xoắn cho đa giác tự do', tauMax: () => NaN },
      );
  }
}

export const SECTION_LABELS: Record<SectionSpec['kind'], string> = {
  rect: 'Chữ nhật đặc',
  box: 'Hộp chữ nhật rỗng',
  circle: 'Tròn đặc',
  tube: 'Ống tròn',
  I: 'Chữ I',
  T: 'Chữ T',
  U: 'Chữ U (máng)',
  L: 'Chữ L (thép góc)',
  polygon: 'Đa giác tuỳ ý',
};

export const SECTION_DEFAULTS: Record<SectionSpec['kind'], SectionSpec> = {
  rect: { kind: 'rect', b: 100, h: 200 },
  box: { kind: 'box', B: 150, H: 150, tw: 8, tf: 8 },
  circle: { kind: 'circle', D: 100 },
  tube: { kind: 'tube', D: 114, t: 6 },
  I: { kind: 'I', bt: 300, tt: 30, hw: 450, tw: 30, bb: 300, tb: 30 },
  T: { kind: 'T', b: 200, tf: 20, hw: 200, tw: 15 },
  U: { kind: 'U', h: 200, b: 80, tw: 8, tf: 12 },
  L: { kind: 'L', b: 100, h: 100, t: 10 },
  polygon: { kind: 'polygon', outer: [[0, 0], [200, 0], [200, 50], [100, 300], [0, 50]], holes: [] },
};
