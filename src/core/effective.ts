/**
 * Tiết diện hữu hiệu cho tiết diện loại 4 (EN 1993-1-5 §4.3, 4.4).
 *
 * Mỗi tấm chịu nén có ρ < 1 bị khoét vùng không hữu hiệu (hình chữ nhật c_ineff × t) khỏi hình học thật:
 *  - Tấm tựa hai mép (bảng 4.1):
 *      ψ ≥ 0: b_eff = ρ·b̄,  b_e1 = 2b_eff/(5 − ψ) (phía mép nén lớn), b_e2 = b_eff − b_e1
 *      ψ < 0: b_c = b̄/(1 − ψ), b_eff = ρ·b_c, b_e1 = 0.4b_eff, b_e2 = 0.6b_eff (sát vùng kéo)
 *  - Tấm vươn (bảng 4.2): b_eff = ρ·c (hoặc ρ·b_c khi có vùng kéo), phần bị khoét ở phía mép tự do
 *    (hoặc phía xa chân khi chân nén lớn hơn).
 * ρ tính với σ_com = f_y (EN 4.4(4)), nên tiết diện hữu hiệu chỉ phụ thuộc dạng phân bố ứng suất:
 *  - A_eff, e_N: tiết diện hữu hiệu khi chỉ chịu nén đều
 *  - W_eff: tiết diện hữu hiệu khi chỉ chịu uốn (theo từng chiều mô men)
 * Vì khoét cánh làm dịch trục trung hoà, bài toán được lặp đến khi vùng khoét hội tụ (EN 4.4(3)).
 * Kiểm tra (EN 1993-1-1 6.2.9.3, dạng ứng suất cho phép):
 *   σ = N/A_eff + (|M_z| + |N|·|e_N,y|)/W_eff,z + (|M_y| + |N|·|e_N,z|)/W_eff,y ≤ [σ]
 */
import { geometry, kInternal, kOutstand, stiffenerColumn, type Geometry, type PlateDef } from './localBuckling';
import { computeSection, polygonSection, type Ring, type SectionProps } from './section';
import { neutralAxisCoeffs, fmt } from './stress';
import type { InternalForces, Material, SectionSpec } from './types';

type P = [number, number];

export interface EffPlate {
  name: string;
  kind: 'internal' | 'outstand';
  c: number;
  t: number;
  psi: number;
  k: number;
  lambdaP: number;
  rho: number;
  /** chiều rộng hữu hiệu (mm) và vùng bị khoét [s_a, s_b] tính từ mép p1 */
  beff: number;
  removed: [number, number] | null;
}

/** Sườn dọc làm việc như thanh trên nền đàn hồi (EN 1993-1-5 A.2) */
export interface StiffColumn {
  name: string;
  /** khoảng cách từ mép trên bụng đến sườn (mm) */
  pos: number;
  b1: number;
  b2: number;
  Asl: number;
  Isl: number;
  ac: number;
  a: number;
  sigmaCrSl: number;
  sigmaCrC: number;
  lambdaC: number;
  alphaE: number;
  chiC: number;
}

export interface EffState {
  sec: SectionProps;
  plates: EffPlate[];
  iterations: number;
  /** sườn dọc trong vùng nén và hệ số giảm tổng thể ρ_c (= χ_c nhỏ nhất) */
  columns?: StiffColumn[];
  rhoC?: number;
}

export interface EffectiveResult {
  applicable: boolean;
  reason?: string;
  gross: SectionProps;
  /** nén đều */
  N?: EffState & { Aeff: number; eNy: number; eNz: number };
  /** uốn quanh z, M > 0 (thớ trên nén) và M < 0 */
  MzPos?: EffState & { Weff: number };
  MzNeg?: EffState & { Weff: number };
  MyPos?: EffState & { Weff: number };
  MyNeg?: EffState & { Weff: number };
  steps: string[];
}

function rhoOf(kind: 'internal' | 'outstand', lambdaP: number, psi: number): number {
  if (kind === 'internal') {
    if (lambdaP <= 0.5 + Math.sqrt(Math.max(0.085 - 0.055 * psi, 0))) return 1;
    return Math.min(1, (lambdaP - 0.055 * (3 + psi)) / (lambdaP * lambdaP));
  }
  if (lambdaP <= 0.748) return 1;
  return Math.min(1, (lambdaP - 0.188) / (lambdaP * lambdaP));
}

/** Xác định vùng khoét của một tấm từ ứng suất nén ở hai mép (dương là nén). */
function plateEff(pl: PlateDef, c1: number, c2: number, E: number, nu: number, fy: number): EffPlate {
  const base = { name: pl.name, kind: pl.kind, c: pl.c, t: pl.t };
  const none = { ...base, psi: 0, k: 0, lambdaP: 0, rho: 1, beff: pl.c, removed: null };
  if (Math.max(c1, c2) <= 1e-9) return none;
  const sigmaE = (Math.PI ** 2 * E * pl.t * pl.t) / (12 * (1 - nu * nu) * pl.c * pl.c);
  const c = pl.c;
  if (pl.kind === 'internal') {
    const firstMax = c1 >= c2; // mép nén lớn E1
    const smax = Math.max(c1, c2), smin = Math.min(c1, c2);
    const psi = smin / smax;
    const k = kInternal(psi);
    const lambdaP = Math.sqrt(fy / (k * sigmaE));
    const rho = rhoOf('internal', lambdaP, psi);
    if (rho >= 1) return { ...base, psi, k, lambdaP, rho, beff: c, removed: null };
    let a: number, b: number, beff: number;
    if (psi >= 0) {
      beff = rho * c;
      const be1 = (2 * beff) / (5 - psi);
      const be2 = beff - be1;
      a = be1; b = c - be2;
    } else {
      const bc = c / (1 - psi);
      beff = rho * bc;
      a = 0.4 * beff; b = bc - 0.6 * beff;
    }
    const removed: [number, number] = firstMax ? [a, b] : [c - b, c - a];
    return { ...base, psi, k, lambdaP, rho, beff, removed };
  }
  // tấm vươn: p1 = chân, p2 = mép tự do
  const tipMax = c2 >= c1;
  const smax = tipMax ? c2 : c1, other = tipMax ? c1 : c2;
  const psi = other / smax;
  const k = kOutstand(psi, tipMax);
  const lambdaP = Math.sqrt(fy / (k * sigmaE));
  const rho = rhoOf('outstand', lambdaP, psi);
  if (rho >= 1) return { ...base, psi, k, lambdaP, rho, beff: c, removed: null };
  let removed: [number, number];
  let beff: number;
  if (psi >= 0) {
    beff = rho * c;
    removed = [beff, c];
  } else {
    const bc = c / (1 - psi);
    beff = rho * bc;
    removed = tipMax ? [c - bc + beff, c] : [beff, bc];
  }
  return { ...base, psi, k, lambdaP, rho, beff, removed };
}

function rectRing(pl: PlateDef, sa: number, sb: number, rotate: boolean): Ring {
  const [z1, y1] = pl.p1, [z2, y2] = pl.p2;
  const L = Math.hypot(z2 - z1, y2 - y1) || 1;
  const u: P = [(z2 - z1) / L, (y2 - y1) / L];
  const nrm: P = [-u[1], u[0]];
  const h = pl.t / 2;
  const at = (s: number, d: number): P => [z1 + u[0] * s + nrm[0] * d, y1 + u[1] * s + nrm[1] * d];
  let pts: P[] = [at(sa, -h), at(sb, -h), at(sb, h), at(sa, h)];
  if (rotate) pts = pts.map(([z, y]) => [-y, z] as P);
  return { pts, hole: true, ineffective: true };
}

function rectRingT(pl: PlateDef, sa: number, sb: number, thick: number, rotate: boolean): Ring {
  const r = rectRing({ ...pl, t: thick }, sa, sb, rotate);
  return r;
}

/** Chiều rộng bụng góp vào thanh sườn từ một ô (theo dạng phân bố b_eff của EN, dùng bề rộng nguyên) */
function share(bi: number, sStiff: number, sOther: number): number {
  if (sStiff <= 0) return 0;
  if (sStiff >= sOther) {
    const psi = sOther / sStiff;
    return psi >= 0 ? (2 / (5 - psi)) * bi : (0.4 * bi) / (1 - psi);
  }
  const psi = sStiff / sOther;
  return ((3 - psi) / (5 - psi)) * bi;
}

/**
 * Mất ổn định tổng thể của bụng có sườn dọc — mô hình thanh trên nền đàn hồi (EN 1993-1-5 A.2.2),
 * coi các sườn khác là gối cứng; ρ_c = χ_c nhỏ nhất (thiên về an toàn: bỏ qua làm việc kiểu tấm).
 */
function stiffenerColumns(geo: Geometry, sigY: (y: number) => number, E: number, nu: number, fy: number, eps: number, aSpacing: number): StiffColumn[] {
  const sg = geo.stiffened!;
  const tw = sg.tw;
  const ys = [sg.yTop, ...sg.list.map((k) => k.y), sg.yBot];
  const cAt = (y: number) => -sigY(y); // nén dương
  const out: StiffColumn[] = [];
  const edgeMax = Math.max(cAt(sg.yTop), cAt(sg.yBot));
  sg.list.forEach((k, i) => {
    const sS = cAt(k.y);
    // sườn nằm trong vùng kéo hoặc sát trục trung hoà (nén < 5% mép nén lớn nhất): không làm việc như thanh chịu nén
    if (sS <= 0.05 * edgeMax) return;
    const yUp = ys[i], yDn = ys[i + 2];
    const b1 = yUp - k.y, b2 = k.y - yDn, b = b1 + b2;
    const w = share(b1, sS, cAt(yUp)) + share(b2, sS, cAt(yDn));
    const col = stiffenerColumn(k, tw, w);
    const Asl = col.A, Isl = col.I;
    const ac = 4.33 * Math.pow((Isl * b1 * b1 * b2 * b2) / (tw ** 3 * b), 0.25);
    const a = aSpacing > 0 ? aSpacing : Infinity;
    const sigmaCrSl = a >= ac
      ? (1.05 * E * Math.sqrt(Isl * tw ** 3 * b)) / (Asl * b1 * b2)
      : (Math.PI ** 2 * E * Isl) / (Asl * a * a) + (E * tw ** 3 * b * a * a) / (4 * Math.PI ** 2 * (1 - nu * nu) * Asl * b1 * b1 * b2 * b2);
    const sigmaCrC = sigmaCrSl * (edgeMax / sS);
    const lambdaC = Math.sqrt(fy / sigmaCrC);
    const alphaE = 0.49 + 0.09 / (col.i / Math.max(col.e, 1e-9));
    const Phi = 0.5 * (1 + alphaE * (lambdaC - 0.2) + lambdaC * lambdaC);
    const chiC = Math.min(1, 1 / (Phi + Math.sqrt(Math.max(Phi * Phi - lambdaC * lambdaC, 0))));
    out.push({ name: `Sườn dọc ${i + 1}`, pos: sg.yTop - k.y, b1, b2, Asl, Isl, ac, a, sigmaCrSl, sigmaCrC, lambdaC, alphaE, chiC });
  });
  void eps;
  return out;
}

/** Trừ các khoảng đã khoét khỏi [a, b] */
function subtract(a: number, b: number, cuts: [number, number][]): [number, number][] {
  let parts: [number, number][] = [[a, b]];
  for (const [c, d] of cuts) {
    const next: [number, number][] = [];
    for (const [x, y] of parts) {
      if (d <= x || c >= y) { next.push([x, y]); continue; }
      if (c > x) next.push([x, c]);
      if (d < y) next.push([d, y]);
    }
    parts = next;
  }
  return parts.filter(([x, y]) => y - x > 1e-6);
}

/** Lặp tìm tiết diện hữu hiệu cho dạng nội lực F (chỉ dùng hướng, không dùng độ lớn). */
function iterate(spec: SectionSpec, F: InternalForces, mat: Material, fy: number, aSpacing = 0): EffState | null {
  const geo = geometry(spec);
  if (!geo || !geo.plates.length) return null;
  const gross = computeSection(spec);
  const rotate = spec.kind === 'catalog' && spec.rotate;
  const E = mat.E * 1e3;
  let sec = gross;
  let plates: EffPlate[] = [];
  let prev = '';
  let it = 0;
  let columns: StiffColumn[] | undefined;
  let rhoC = 1;
  for (it = 1; it <= 15; it++) {
    const [zc, yc] = sec.centroid;
    const [s0, a, b] = neutralAxisCoeffs(sec, F);
    const sig = ([z, y]: P) => {
      const [zz, yy] = rotate ? [-y, z] : [z, y];
      return s0 + a * (yy - yc) + b * (zz - zc);
    };
    plates = geo.plates.map((pl) => plateEff(pl, -sig(pl.p1), -sig(pl.p2), E, mat.nu, fy));
    const holes = geo.plates.flatMap((pl, i) => (plates[i].removed ? [rectRing(pl, plates[i].removed![0], plates[i].removed![1], rotate)] : []));
    // Mất ổn định tổng thể của bụng có sườn dọc → giảm bề dày vùng nén theo ρ_c (EN 4.5.1(7))
    columns = undefined;
    rhoC = 1;
    if (geo.stiffened && !rotate) {
      const sg = geo.stiffened;
      columns = stiffenerColumns(geo, (y) => sig([0, y]), E, mat.nu, fy, Math.sqrt(235 / fy), aSpacing);
      if (columns.length) rhoC = Math.min(...columns.map((c) => c.chiC));
      if (rhoC < 1) {
        const cAt = (y: number) => -sig([0, y]);
        // vùng nén của bụng
        const cTop = cAt(sg.yTop), cBot = cAt(sg.yBot);
        let za = sg.yBot, zb = sg.yTop;
        if (cTop > 0 && cBot <= 0) za = sg.yBot + ((sg.yTop - sg.yBot) * -cBot) / (cTop - cBot);
        else if (cBot > 0 && cTop <= 0) zb = sg.yBot + ((sg.yTop - sg.yBot) * cBot) / (cBot - cTop);
        // trừ dải biên sát cánh (b_edge,eff) và các phần đã khoét cục bộ
        const webIdx = geo.plates.map((p, i) => (p.web ? i : -1)).filter((i) => i >= 0);
        const cuts: [number, number][] = [];
        for (const i of webIdx) {
          const pl = geo.plates[i], pe = plates[i];
          if (pe.removed) cuts.push([pl.p1[1] + pe.removed[0], pl.p1[1] + pe.removed[1]]);
          const atTop = Math.abs(pl.p2[1] - sg.yTop) < 1e-6, atBot = Math.abs(pl.p1[1] - sg.yBot) < 1e-6;
          const c1 = cAt(pl.p1[1]), c2 = cAt(pl.p2[1]);
          const edge = (sEdge: number, sOther: number) => {
            if (sEdge <= 0) return 0;
            if (pe.removed) return 0; // phần biên đã nằm ngoài vùng khoét — xử lý bên dưới
            return share(pl.c, sEdge, sOther);
          };
          if (atTop && c2 > 0) cuts.push([sg.yTop - (pe.removed ? sg.yTop - (pl.p1[1] + pe.removed[1]) : edge(c2, c1)), sg.yTop]);
          if (atBot && c1 > 0) cuts.push([sg.yBot, sg.yBot + (pe.removed ? pe.removed[0] : edge(c1, c2))]);
        }
        const tw = sg.tw;
        for (const [y1, y2] of subtract(za, zb, cuts)) {
          let pts: P[] = [[-(tw * (1 - rhoC)) / 2, y1], [(tw * (1 - rhoC)) / 2, y1], [(tw * (1 - rhoC)) / 2, y2], [-(tw * (1 - rhoC)) / 2, y2]];
          if (rotate) pts = pts.map(([z, y]) => [-y, z] as P);
          holes.push({ pts, hole: true, ineffective: true });
        }
        // giảm bề dày sườn trong vùng nén
        geo.plates.forEach((pl, i) => {
          if (!pl.name.startsWith('Sườn dọc')) return;
          if (cAt(pl.p1[1]) <= 0) return;
          const pe = plates[i];
          for (const [s1, s2] of subtract(0, pl.c, pe.removed ? [pe.removed] : [])) {
            holes.push(rectRingT(pl, s1, s2, pl.t * (1 - rhoC), rotate));
          }
        });
      }
    }
    const key = plates.map((p) => (p.removed ? `${p.removed[0].toFixed(2)}:${p.removed[1].toFixed(2)}` : '-')).join('|') + `|${rhoC.toFixed(4)}`;
    sec = holes.length ? polygonSection(`${gross.label} — hữu hiệu`, [...gross.rings, ...holes], gross.torsion) : gross;
    if (key === prev) break;
    prev = key;
  }
  return { sec, plates, iterations: it, columns, rhoC };
}

const W = (s: SectionProps, axis: 'z' | 'y') =>
  axis === 'z' ? s.Iz / Math.max(s.yMax, -s.yMin) : s.Iy / Math.max(s.zMax, -s.zMin);

export function effectiveSection(spec: SectionSpec, mat: Material, fy: number, aSpacing = 0): EffectiveResult {
  const gross = computeSection(spec);
  const steps: string[] = [];
  const geo = geometry(spec);
  if (!geo || !geo.plates.length) {
    return { applicable: false, reason: 'Mặt cắt không gồm các tấm phẳng (tròn, ống, đặc) — không áp dụng tiết diện hữu hiệu theo EN 1993-1-5.', gross, steps };
  }
  const F0: InternalForces = { N: 0, Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0 };
  const n = iterate(spec, { ...F0, N: -1 }, mat, fy, aSpacing)!;
  const eNy = n.sec.centroid[1] - gross.centroid[1];
  const eNz = n.sec.centroid[0] - gross.centroid[0];
  const res: EffectiveResult = { applicable: true, gross, steps };
  res.N = { ...n, Aeff: n.sec.A, eNy, eNz };
  const mzp = iterate(spec, { ...F0, Mz: 1 }, mat, fy, aSpacing)!;
  const mzn = iterate(spec, { ...F0, Mz: -1 }, mat, fy, aSpacing)!;
  res.MzPos = { ...mzp, Weff: W(mzp.sec, 'z') };
  res.MzNeg = { ...mzn, Weff: W(mzn.sec, 'z') };
  const myp = iterate(spec, { ...F0, My: 1 }, mat, fy, aSpacing)!;
  const myn = iterate(spec, { ...F0, My: -1 }, mat, fy, aSpacing)!;
  res.MyPos = { ...myp, Weff: W(myp.sec, 'y') };
  res.MyNeg = { ...myn, Weff: W(myn.sec, 'y') };
  steps.push(`ε = √(235/f_y) = ${fmt(Math.sqrt(235 / fy), 3)}; ρ tính với σ_com = f_y = ${fy} MPa`);
  const describe = (label: string, st: EffState) => {
    const red = st.plates.filter((p) => p.removed);
    if (!red.length) steps.push(`${label}: mọi tấm hữu hiệu toàn bộ (ρ = 1).`);
    for (const p of red) {
      steps.push(
        `${label} — ${p.name}: ψ = ${fmt(p.psi, 3)}, k_σ = ${fmt(p.k, 3)}, λ̄_p = ${fmt(p.lambdaP, 3)}, ρ = ${fmt(p.rho, 4)}, b_eff = ${fmt(p.beff, 1)} mm; khoét ${fmt(p.removed![1] - p.removed![0], 1)} mm (từ ${fmt(p.removed![0], 1)} đến ${fmt(p.removed![1], 1)} mm tính từ ${p.kind === 'outstand' ? 'chân' : 'mép 1'})`,
      );
    }
  };
  const describeCols = (label: string, st: EffState) => {
    for (const c of st.columns ?? []) {
      steps.push(
        `${label} — ${c.name} (cách mép trên bụng ${fmt(c.pos, 0)} mm): b1 = ${fmt(c.b1, 0)}, b2 = ${fmt(c.b2, 0)} mm; A_sl = ${fmt(c.Asl, 0)} mm², I_sl = ${fmt(c.Isl, 0)} mm⁴; ` +
          `a_c = ${fmt(c.ac, 0)} mm (a = ${Number.isFinite(c.a) ? fmt(c.a, 0) : '∞'}); σ_cr,sl = ${fmt(c.sigmaCrSl, 1)} MPa → σ_cr,c = ${fmt(c.sigmaCrC, 1)} MPa; ` +
          `λ̄_c = ${fmt(c.lambdaC, 3)}, α_e = ${fmt(c.alphaE, 3)}, χ_c = ${fmt(c.chiC, 4)}`,
      );
    }
    if (st.rhoC !== undefined && st.rhoC < 1) steps.push(`${label}: ρ_c = ${fmt(st.rhoC, 4)} — giảm bề dày vùng nén của bụng (trừ dải biên sát cánh) và sườn dọc.`);
  };
  describe('Nén đều', n);
  describeCols('Nén đều', n);
  steps.push(`A_eff = ${fmt(res.N.Aeff, 1)} mm² (A = ${fmt(gross.A, 1)}); độ lệch trọng tâm e_N,y = ${fmt(eNy, 2)} mm, e_N,z = ${fmt(eNz, 2)} mm`);
  describe('Uốn M_z > 0', mzp);
  describeCols('Uốn M_z > 0', mzp);
  steps.push(`W_eff,z (M > 0) = ${fmt(res.MzPos.Weff, 0)} mm³; (M < 0) = ${fmt(res.MzNeg.Weff, 0)} mm³ (W_el = ${fmt(W(gross, 'z'), 0)})`);
  steps.push(`W_eff,y (M > 0) = ${fmt(res.MyPos.Weff, 0)} mm³; (M < 0) = ${fmt(res.MyNeg.Weff, 0)} mm³ (W_el = ${fmt(W(gross, 'y'), 0)})`);
  return res;
}

export interface EffCheck {
  sigma: number;
  util: number;
  ok: boolean;
  F: InternalForces;
  x?: number;
  terms: string;
}

/** Kiểm tra σ = N/A_eff + (M + N·e_N)/W_eff ≤ [σ] cho danh sách mặt cắt, trả về mặt cắt bất lợi nhất. */
export function checkEffective(eff: EffectiveResult, forces: ({ x?: number } & InternalForces)[], allowable: number): EffCheck | null {
  if (!eff.applicable || !eff.N || !eff.MzPos || !eff.MzNeg || !eff.MyPos || !eff.MyNeg) return null;
  let best: EffCheck | null = null;
  for (const F of forces) {
    const Nn = F.N * 1e3; // N
    const comp = Nn < 0;
    const A = comp ? eff.N.Aeff : eff.gross.A;
    const eY = comp ? Math.abs(eff.N.eNy) : 0;
    const eZ = comp ? Math.abs(eff.N.eNz) : 0;
    const Wz = F.Mz >= 0 ? eff.MzPos.Weff : eff.MzNeg.Weff;
    const Wy = F.My >= 0 ? eff.MyPos.Weff : eff.MyNeg.Weff;
    const sN = Math.abs(Nn) / A;
    const sMz = (Math.abs(F.Mz) * 1e6 + Math.abs(Nn) * eY) / Wz;
    const sMy = (Math.abs(F.My) * 1e6 + Math.abs(Nn) * eZ) / Wy;
    const sigma = sN + sMz + sMy;
    if (!best || sigma > best.sigma) {
      best = {
        sigma, util: sigma / allowable, ok: sigma <= allowable, F, x: F.x,
        terms: `σ = ${fmt(Math.abs(Nn), 0)}/${fmt(A, 1)} + (${fmt(Math.abs(F.Mz) * 1e6, 0)} + ${fmt(Math.abs(Nn), 0)}·${fmt(eY, 2)})/${fmt(Wz, 0)}` +
          (F.My || eZ ? ` + (${fmt(Math.abs(F.My) * 1e6, 0)} + ${fmt(Math.abs(Nn), 0)}·${fmt(eZ, 2)})/${fmt(Wy, 0)}` : '') +
          ` = ${fmt(sigma, 2)} MPa`,
      };
    }
  }
  return best;
}

/** A_eff khi tiết diện là loại 4 lúc chịu nén đều; undefined nếu không phải loại 4. */
export function aeffIfClass4(spec: SectionSpec, mat: Material, fy: number): number | undefined {
  const geo = geometry(spec);
  if (!geo || !geo.plates.length) return undefined;
  const st = iterate(spec, { N: -1, Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0 }, mat, fy);
  if (!st || (!st.plates.some((p) => p.removed) && !((st.rhoC ?? 1) < 1))) return undefined;
  return st.sec.A;
}

/** W_eff,z theo chiều mô men nếu có tấm bị khoét khi uốn; undefined nếu toàn bộ hữu hiệu. */
export function weffZ(spec: SectionSpec, mat: Material, fy: number, sign: number): number | undefined {
  const geo = geometry(spec);
  if (!geo || !geo.plates.length) return undefined;
  const st = iterate(spec, { N: 0, Qy: 0, Qz: 0, T: 0, Mz: sign >= 0 ? 1 : -1, My: 0 }, mat, fy);
  if (!st || (!st.plates.some((p) => p.removed) && !((st.rhoC ?? 1) < 1))) return undefined;
  return W(st.sec, 'z');
}
