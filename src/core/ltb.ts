/**
 * Ổn định uốn – xoắn (mất ổn định ngang) của dầm chịu uốn trong mặt phẳng đứng.
 *
 * Mô men tới hạn đàn hồi M_cr tính bằng phần tử hữu hạn (ẩn: chuyển vị ngang u và góc xoắn φ,
 * hàm dạng Hermite bậc 3) từ thế năng toàn phần:
 *   Π = ½∫(EI_y u″² + GI_t φ′² + EI_w φ″²)dx + α[∫ M(x)·u″·φ dx − ½ Σ P·e·φ² − ½∫ q·e·φ² dx]
 * trong đó M(x) là biểu đồ mô men thực, e là khoảng cách điểm đặt tải phía trên tâm cắt
 * (tải hướng xuống đặt trên tâm cắt làm giảm M_cr). Trị riêng α nhỏ nhất: M_cr = α·M_max.
 *
 * Kiểm tra bền theo phương pháp tổng quát EN 1993-1-1 §6.3.2.2:
 *   λ̄_LT = √(W·f_y / M_cr), Φ = 0.5[1 + α_LT(λ̄ − 0.2) + λ̄²], χ_LT = 1/(Φ + √(Φ² − λ̄²)) ≤ 1
 *   M_max ≤ χ_LT·W·[σ]   ([σ] dùng thay cho f_y/γ_M1 để thống nhất với phần còn lại của ứng dụng)
 *
 * Giả thiết: gối tựa chặn chuyển vị ngang và xoắn (gối chạc); ngàm chặn cả u′, φ′ (kiềm chế vênh).
 * Bỏ qua hiệu ứng Wagner với mặt cắt chỉ đối xứng một trục.
 */
import type { AnalysisResult } from './analysis';
import { weffZ } from './effective';
import { luFactor, luSolve, zeros } from './linalg';
import { fmt } from './stress';
import { effectiveRestraints, type Model } from './types';

export type LoadHeight = 'top' | 'sc' | 'bottom';
export type LtbCurve = 'a' | 'b' | 'c' | 'd';

export const LTB_CURVES: Record<LtbCurve, number> = { a: 0.21, b: 0.34, c: 0.49, d: 0.76 };

export interface LtbBrace {
  id: string;
  x: number;
  /** chặn chuyển vị ngang tại tâm cắt */
  lateral: boolean;
  /** chặn xoắn */
  twist: boolean;
}

export interface LtbOptions {
  loadHeight: LoadHeight;
  braces: LtbBrace[];
  fy: number; // MPa
  curve: 'auto' | LtbCurve;
}

export interface LtbResult {
  applicable: boolean;
  reason?: string;
  Mmax: number; // kN·m
  xMax: number;
  Mcr: number; // kN·m
  alpha: number;
  Iw: number; // mm⁶
  It: number; // mm⁴
  Iweak: number; // mm⁴
  W: number; // mm³
  lambdaLT: number;
  curve: LtbCurve;
  chi: number;
  Mrd: number; // kN·m = χ·W·[σ]
  Mel: number; // kN·m = W·[σ]
  util: number;
  ok: boolean;
  mode: { x: number; u: number; phi: number }[];
  steps: string[];
  warnings: string[];
}

const NA = (reason: string): LtbResult => ({
  applicable: false, reason, Mmax: 0, xMax: 0, Mcr: 0, alpha: 0, Iw: 0, It: 0, Iweak: 0, W: 0, lambdaLT: 0, curve: 'd', chi: 1,
  Mrd: 0, Mel: 0, util: 0, ok: true, mode: [], steps: [], warnings: [],
});

/** Ma trận phần tử dầm Hermite: ∫ N″ᵢ N″ⱼ dx (nhân EI) */
const kBend = (l: number) => {
  const c = 1 / l ** 3;
  return [
    [12 * c, 6 * l * c, -12 * c, 6 * l * c],
    [6 * l * c, 4 * l * l * c, -6 * l * c, 2 * l * l * c],
    [-12 * c, -6 * l * c, 12 * c, -6 * l * c],
    [6 * l * c, 2 * l * l * c, -6 * l * c, 4 * l * l * c],
  ];
};
/** ∫ N′ᵢ N′ⱼ dx (nhân GI_t) */
const kString = (l: number) => {
  const c = 1 / (30 * l);
  return [
    [36 * c, 3 * l * c, -36 * c, 3 * l * c],
    [3 * l * c, 4 * l * l * c, -3 * l * c, -l * l * c],
    [-36 * c, -3 * l * c, 36 * c, -3 * l * c],
    [3 * l * c, -l * l * c, -3 * l * c, 4 * l * l * c],
  ];
};
const N = (t: number, l: number) => [1 - 3 * t * t + 2 * t ** 3, l * (t - 2 * t * t + t ** 3), 3 * t * t - 2 * t ** 3, l * (-t * t + t ** 3)];
const N2 = (t: number, l: number) => [(-6 + 12 * t) / (l * l), (-4 + 6 * t) / l, (6 - 12 * t) / (l * l), (-2 + 6 * t) / l];
const GAUSS: [number, number][] = [
  [0.0694318442029737, 0.1739274225687269], [0.3300094782075719, 0.3260725774312731],
  [0.6699905217924281, 0.3260725774312731], [0.9305681557970263, 0.1739274225687269],
];

export function checkLTB(model: Model, res: AnalysisResult, opt: LtbOptions): LtbResult {
  if (!res.ok || !res.section) return NA('Chưa có kết quả tính dầm.');
  const sec = res.section;
  const lp = sec.ltb;
  if (!lp) return NA('Chưa hỗ trợ mặt cắt này (đa giác tự do hoặc thép hình xoay 90°).');
  let Mmax = 0, xMax = 0;
  for (const s of res.forceSamples) if (Math.abs(s.Mz) > Math.abs(Mmax)) { Mmax = s.Mz; xMax = s.x; }
  if (Math.abs(Mmax) < 1e-9) return NA('Dầm không chịu uốn trong mặt phẳng đứng.');
  if (sec.Iz < sec.Iy * 1.0001) {
    return NA('Dầm uốn quanh trục yếu (I_z ≤ I_y): không xảy ra mất ổn định uốn – xoắn.');
  }
  const Wel = sec.Iz / Math.max(sec.yMax, -sec.yMin);
  const Weff = weffZ(model.section, model.material, opt.fy, Math.sign(Mmax) || 1);
  const W = Weff && Weff < Wel ? Weff : Wel;
  const L = model.length;
  const E = model.material.E * 1e9;
  const G = E / (2 * (1 + model.material.nu));
  const EIy = E * sec.Iy * 1e-12;
  const GIt = G * sec.torsion.J * 1e-12;
  const EIw = E * lp.Iw * 1e-18;
  const warnings: string[] = [];
  const steps: string[] = [];
  if (lp.closed) warnings.push('Mặt cắt kín (hộp/ống) có độ cứng xoắn rất lớn — hầu như không mất ổn định uốn – xoắn.');
  if (lp.monosym) warnings.push('Mặt cắt chỉ đối xứng một trục: bỏ qua hiệu ứng Wagner (kết quả gần đúng).');
  if (!(GIt > 0)) return NA('Không xác định được độ cứng xoắn của mặt cắt.');

  // Lưới
  const tol = 1e-9 * Math.max(1, L);
  const keys = new Set<number>([0, L, ...model.supports.map((s) => s.x), ...opt.braces.map((b) => b.x), ...res.keyPoints]);
  const kp = [...keys].filter((x) => x >= -tol && x <= L + tol).sort((a, b) => a - b).filter((x, i, a) => i === 0 || x - a[i - 1] > tol);
  const xs: number[] = [];
  for (let i = 0; i + 1 < kp.length; i++) {
    const n = Math.max(1, Math.ceil(((kp[i + 1] - kp[i]) / L) * 80));
    for (let j = 0; j < n; j++) xs.push(kp[i] + ((kp[i + 1] - kp[i]) * j) / n);
  }
  xs.push(L);
  const nn = xs.length;
  const nd = 4 * nn; // u, u′, φ, φ′
  const KE = zeros(nd, nd);
  const KG = zeros(nd, nd);
  const yLoad = opt.loadHeight === 'top' ? sec.yMax : opt.loadHeight === 'bottom' ? sec.yMin : lp.ySc;
  const e = (yLoad - lp.ySc) / 1e3; // m, dương: phía trên tâm cắt
  for (let k = 0; k + 1 < nn; k++) {
    const l = xs[k + 1] - xs[k];
    const iu = [4 * k, 4 * k + 1, 4 * k + 4, 4 * k + 5];
    const ip = [4 * k + 2, 4 * k + 3, 4 * k + 6, 4 * k + 7];
    const kb = kBend(l), ks = kString(l);
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      KE[iu[a]][iu[b]] += EIy * kb[a][b];
      KE[ip[a]][ip[b]] += EIw * kb[a][b] + GIt * ks[a][b];
    }
    for (const [t, w] of GAUSS) {
      const x = xs[k] + t * l;
      const F = res.internalAt(x, 'right');
      const M = F.Mz * 1e3; // N·m
      const n0 = N(t, l), n2 = N2(t, l);
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
        const v = w * l * M * n2[a] * n0[b];
        KG[iu[a]][ip[b]] += v;
        KG[ip[b]][iu[a]] += v;
      }
      // tải phân bố đặt lệch tâm cắt
      let q = 0;
      for (const d of res.distributed) {
        if (d.dir !== 'y' || x < d.x1 || x > d.x2) continue;
        q += (d.q1 + ((d.q2 - d.q1) * (x - d.x1)) / (d.x2 - d.x1)) * 1e3;
      }
      if (q && e) for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) KG[ip[a]][ip[b]] += w * l * q * e * n0[a] * n0[b];
    }
  }
  // Lực tập trung đặt lệch tâm cắt: P hướng xuống (Fy < 0) đặt trên tâm cắt → −P·e·φ²  (Fy·e·φ²)
  for (const a of res.actions) {
    if (a.source !== 'load' || !a.Fy || !e) continue;
    let k = 0;
    while (k < nn - 1 && xs[k] < a.x - tol) k++;
    KG[4 * k + 2][4 * k + 2] += a.Fy * 1e3 * e;
  }
  // Liên kết
  const fixed = new Set<number>();
  const nodeAt = (x: number) => {
    let k = 0;
    while (k < nn - 1 && xs[k] < x - tol) k++;
    return k;
  };
  for (const s of model.supports) {
    const r = effectiveRestraints(s);
    if (!r.uy && !r.uz) continue;
    const k = nodeAt(s.x);
    fixed.add(4 * k); fixed.add(4 * k + 2);
    if (r.rz && (s.kind === 'fixed' || r.ry)) { fixed.add(4 * k + 1); fixed.add(4 * k + 3); }
  }
  for (const b of opt.braces) {
    const k = nodeAt(b.x);
    if (b.lateral) fixed.add(4 * k);
    if (b.twist) fixed.add(4 * k + 2);
  }
  const free = [...Array(nd).keys()].filter((d) => !fixed.has(d));
  // Ước lượng ban đầu (C1 = 1, chiều dài L) để chọn dịch chuyển
  const Mcr0 = ((Math.PI ** 2 * EIy) / (L * L)) * Math.sqrt(EIw / EIy + (L * L * GIt) / (Math.PI ** 2 * EIy));
  const Mabs = Math.abs(Mmax) * 1e3;
  const Gm = free.map((r) => free.map((c) => -KG[r][c]));
  let alpha = NaN;
  let vec: number[] = [];
  for (const shiftFrac of [0.25, 0.05, 0.6]) {
    const sft = (shiftFrac * Mcr0) / Mabs;
    const A = free.map((r, i) => free.map((c, j) => KE[r][c] - sft * Gm[i][j]));
    const lu = luFactor(A);
    if (!lu) continue;
    let x = free.map((d) => {
      const node = Math.floor(d / 4);
      return d % 4 === 0 || d % 4 === 2 ? Math.sin((Math.PI * xs[node]) / L) + 0.05 : 0;
    });
    let mu = 0;
    for (let it = 0; it < 300; it++) {
      const g = Gm.map((row) => row.reduce((acc, v, j) => acc + v * x[j], 0));
      const y = luSolve(lu, g);
      let xy = 0, xx = 0, nrm = 0;
      for (let i = 0; i < y.length; i++) { xy += x[i] * y[i]; xx += x[i] * x[i]; nrm = Math.max(nrm, Math.abs(y[i])); }
      if (!(nrm > 0)) break;
      const muNew = xy / xx;
      x = y.map((v) => v / nrm);
      if (it > 3 && Math.abs(muNew - mu) <= 1e-10 * Math.abs(muNew)) { mu = muNew; break; }
      mu = muNew;
    }
    if (mu) {
      const a = sft + 1 / mu;
      if (a > 0 && Number.isFinite(a)) { alpha = a; vec = x; break; }
    }
  }
  if (!Number.isFinite(alpha)) return NA('Không tìm được mô men tới hạn (dầm không có liên kết chống xoắn?).');
  const Mcr = (alpha * Mabs) / 1e3;
  const full = new Array<number>(nd).fill(0);
  free.forEach((d, i) => (full[d] = vec[i]));
  let mu = 0, mp = 0;
  for (let k = 0; k < nn; k++) { mu = Math.max(mu, Math.abs(full[4 * k])); mp = Math.max(mp, Math.abs(full[4 * k + 2])); }
  const mode = xs.map((x, k) => ({ x, u: full[4 * k] / (mu || 1), phi: full[4 * k + 2] / (mp || 1) }));

  const curve: LtbCurve = opt.curve !== 'auto' ? opt.curve
    : lp.rolled ? (lp.hOverB <= 2 ? 'a' : 'b') : (lp.hOverB <= 2 ? 'c' : 'd');
  const aLT = LTB_CURVES[curve];
  const lam = Math.sqrt((W * opt.fy) / (Mcr * 1e6));
  const Phi = 0.5 * (1 + aLT * (lam - 0.2) + lam * lam);
  const chi = Math.min(1, 1 / (Phi + Math.sqrt(Math.max(Phi * Phi - lam * lam, 0))));
  const allow = model.material.allowable;
  const Mel = (W * allow) / 1e6;
  const Mrd = chi * Mel;
  const util = Math.abs(Mmax) / Mrd;

  steps.push(`I_y (trục yếu) = ${fmt(sec.Iy, 0)} mm⁴; I_t = ${fmt(sec.torsion.J, 0)} mm⁴; I_w = ${fmt(lp.Iw, 0)} mm⁶; W = ${fmt(W, 0)} mm³${W < Wel ? ` (tiết diện loại 4: W_eff, W_el = ${fmt(Wel, 0)})` : ''}`);
  steps.push(`Tải đặt ${opt.loadHeight === 'top' ? 'ở cánh trên' : opt.loadHeight === 'bottom' ? 'ở cánh dưới' : 'tại tâm cắt'}: e = ${fmt(e * 1e3, 1)} mm so với tâm cắt`);
  steps.push(`Ước lượng (mô men đều, gối chạc, chiều dài L): M_cr,0 = π²EI_y/L²·√(I_w/I_y + L²GI_t/(π²EI_y)) = ${fmt(Mcr0 / 1e3, 2)} kN·m`);
  steps.push(`Bài toán trị riêng với biểu đồ mô men thực: α_cr = ${fmt(alpha, 4)} → M_cr = α·|M|max = ${fmt(alpha, 4)}·${fmt(Math.abs(Mmax), 3)} = ${fmt(Mcr, 3)} kN·m (= ${fmt(Mcr / (Mcr0 / 1e3), 3)} × M_cr,0${opt.braces.length ? '' : '; với dầm không giằng, tỉ số này chính là hệ số C1'})`);
  steps.push(`λ̄_LT = √(W·f_y/M_cr) = √(${fmt(W, 0)}·${opt.fy}/${fmt(Mcr * 1e6, 0)}) = ${fmt(lam, 3)}; đường cong ${curve} (α_LT = ${aLT})`);
  steps.push(`Φ = 0.5[1 + ${aLT}(${fmt(lam, 3)} − 0.2) + ${fmt(lam, 3)}²] = ${fmt(Phi, 4)}; χ_LT = 1/(Φ + √(Φ² − λ̄²)) = ${fmt(chi, 4)}`);
  steps.push(`M_cho phép = χ_LT·W·[σ] = ${fmt(chi, 4)}·${fmt(W, 0)}·${allow} = ${fmt(Mrd, 2)} kN·m ${util <= 1 ? '≥' : '<'} |M|max = ${fmt(Math.abs(Mmax), 2)} kN·m (${fmt(util * 100, 1)}%)`);
  steps.push(`Hệ số an toàn ổn định uốn – xoắn (đàn hồi): n = M_cr/|M|max = ${fmt(alpha, 3)}`);

  return {
    applicable: true, Mmax, xMax, Mcr, alpha, Iw: lp.Iw, It: sec.torsion.J, Iweak: sec.Iy, W, lambdaLT: lam, curve, chi, Mrd, Mel,
    util, ok: util <= 1, mode, steps, warnings,
  };
}
