/**
 * Ứng suất tại một điểm trên mặt cắt ngang.
 *
 *  σ = N/A + σ_uốn(y, z)                 (công thức uốn tổng quát, kể cả mặt cắt không đối xứng)
 *  τ_Q = Q·S_c/(I·b_c)                     (công thức Jurapxki)
 *  τ_T theo mô hình xoắn của tiết diện     (tròn / thành mỏng kín / thành mỏng hở / chữ nhật)
 *
 * Ứng suất chính:     σ1,3 = σ/2 ± √((σ/2)² + τ²)
 * Thuyết bền 3 (τmax): σtđ = √(σ² + 4τ²)
 * Thuyết bền 4 (thế năng biến đổi hình dạng): σtđ = √(σ² + 3τ²)
 */
import type { SectionProps } from './section';
import type { InternalForces, Material } from './types';

export interface PointStress {
  y: number;
  z: number;
  inside: boolean;
  sigmaN: number;
  sigmaMz: number;
  sigmaMy: number;
  sigma: number;
  tauQy: number;
  tauQz: number;
  tauT: number;
  /** τ tổng hợp dùng để kiểm tra bền */
  tau: number;
  sigma1: number;
  sigma3: number;
  tauMax: number;
  /** góc nghiêng mặt chính α₀ (độ) */
  alpha0: number;
  td3: number;
  td4: number;
  /** biến dạng dài tỉ đối ε = σ/E */
  eps: number;
  /** biến dạng góc γ = τ/G */
  gamma: number;
  notes: string[];
  /** Các bước tính có thay số */
  steps: string[];
}

const f = (v: number, d = 3) => {
  if (!Number.isFinite(v)) return '—';
  if (Math.abs(v) < 1e-9) return '0';
  if (Math.abs(v) >= 1e7 || Math.abs(v) < 1e-3) return v.toExponential(Math.max(d, 4));
  const t = v.toFixed(d);
  return (t.includes('.') ? t.replace(/\.?0+$/, '') : t) || '0';
};

/** Phần ứng suất pháp do uốn tại (y, z): σ = a·y + b·z (MPa), M tính bằng N·mm */
function bendingCoeffs(sec: SectionProps, Mz: number, My: number): [number, number] {
  const D = sec.Iz * sec.Iy - sec.Iyz * sec.Iyz;
  const a = (-Mz * sec.Iy + My * sec.Iyz) / D;
  const b = (-My * sec.Iz + Mz * sec.Iyz) / D;
  return [a, b];
}

export function stressAt(sec: SectionProps, F: InternalForces, mat: Material, y: number, z: number): PointStress {
  const notes: string[] = [];
  const steps: string[] = [];
  const N = F.N * 1e3; // N
  const Qy = F.Qy * 1e3;
  const Qz = F.Qz * 1e3;
  const Mz = F.Mz * 1e6; // N·mm
  const My = F.My * 1e6;
  const T = F.T * 1e6;
  const inside = sec.contains(y, z);
  if (!inside) notes.push('Điểm nằm ngoài vật liệu của mặt cắt.');

  const sigmaN = N / sec.A;
  const [a, b] = bendingCoeffs(sec, Mz, My);
  // Với mặt cắt không đối xứng, σ_Mz chứa toàn bộ phần uốn (không tách được theo từng mô men)
  const sigmaMz = sec.Iyz === 0 ? (-Mz * y) / sec.Iz : a * y + b * z;
  const sigmaMy = sec.Iyz === 0 ? (-My * z) / sec.Iy : 0;
  const sigma = sigmaN + sigmaMz + sigmaMy;

  steps.push(`σ_N = N/A = ${f(N)} / ${f(sec.A)} = ${f(sigmaN)} MPa`);
  if (Mz !== 0) {
    if (sec.Iyz === 0) steps.push(`σ_Mz = −Mz·y/Iz = −(${f(Mz)})·(${f(y)}) / ${f(sec.Iz)} = ${f(sigmaMz)} MPa`);
    else steps.push('Uốn không đối xứng: σ = −[(Mz·Iy − My·Iyz)·y + (My·Iz − Mz·Iyz)·z] / (Iy·Iz − Iyz²)');
  }
  if (My !== 0 && sec.Iyz === 0) steps.push(`σ_My = −My·z/Iy = −(${f(My)})·(${f(z)}) / ${f(sec.Iy)} = ${f(sigmaMy)} MPa`);
  steps.push(`σ = ${f(sigma)} MPa`);

  // Jurapxki
  let tauQy = 0;
  if (Qy !== 0) {
    const bY = sec.widthAtY(y);
    const S = sec.firstMomentAboveY(y);
    tauQy = bY > 1e-9 ? (Qy * S) / (sec.Iz * bY) : 0;
    steps.push(`τ_Qy = Qy·S_z^c/(Iz·b) = ${f(Qy)}·${f(S)} / (${f(sec.Iz)}·${f(bY)}) = ${f(tauQy)} MPa`);
  }
  let tauQz = 0;
  if (Qz !== 0) {
    const hZ = sec.heightAtZ(z);
    const S = sec.firstMomentBeyondZ(z);
    tauQz = hZ > 1e-9 ? (Qz * S) / (sec.Iy * hZ) : 0;
    steps.push(`τ_Qz = Qz·S_y^c/(Iy·h) = ${f(Qz)}·${f(S)} / (${f(sec.Iy)}·${f(hZ)}) = ${f(tauQz)} MPa`);
  }
  let tauT = 0;
  if (T !== 0) {
    if (sec.torsion.tauAt) {
      tauT = sec.torsion.tauAt(y, z, T);
      steps.push(`τ_T = T·ρ/Ip = ${f(Math.abs(T))}·${f(Math.hypot(y, z))} / ${f(sec.torsion.J)} = ${f(tauT)} MPa`);
    } else {
      tauT = sec.torsion.tauMax(T);
      notes.push('Mặt cắt không tròn: lấy τ_T = τ_max do xoắn (thiên về an toàn).');
      steps.push(`τ_T,max = ${f(tauT)} MPa (${sec.torsion.model})`);
    }
  }
  const tauShear = Math.hypot(tauQy, tauQz);
  const tau = tauShear + Math.abs(tauT);
  if (tauShear !== 0 && tauT !== 0) notes.push('τ do lực cắt và do xoắn được cộng trị tuyệt đối (thiên về an toàn).');
  if (Qz !== 0 && Qy !== 0) notes.push('τ do Qy và Qz được tổng hợp hình học √(τy² + τz²).');

  const c = sigma / 2;
  const r = Math.hypot(c, tau);
  const sigma1 = c + r;
  const sigma3 = c - r;
  const alpha0 = sigma === 0 && tau === 0 ? 0 : (0.5 * Math.atan2(-2 * tau, sigma) * 180) / Math.PI;
  const td3 = Math.sqrt(sigma * sigma + 4 * tau * tau);
  const td4 = Math.sqrt(sigma * sigma + 3 * tau * tau);
  steps.push(`σ1,3 = σ/2 ± √((σ/2)² + τ²) = ${f(sigma1)} ; ${f(sigma3)} MPa`);
  steps.push(`TB3: σtđ = √(σ² + 4τ²) = ${f(td3)} MPa`);
  steps.push(`TB4: σtđ = √(σ² + 3τ²) = ${f(td4)} MPa`);

  const E = mat.E * 1e3; // MPa
  const G = E / (2 * (1 + mat.nu));
  return {
    y, z, inside, sigmaN, sigmaMz, sigmaMy, sigma, tauQy, tauQz, tauT, tau, sigma1, sigma3, tauMax: r, alpha0,
    td3, td4, eps: sigma / E, gamma: tau / G, notes, steps,
  };
}

/** Ứng suất pháp lớn nhất trên một mặt cắt (dò tại các điểm biên). */
export function maxNormalOnSection(sec: SectionProps, F: InternalForces): { max: number; min: number; at: [number, number]; atMin: [number, number] } {
  const N = F.N * 1e3;
  const [a, b] = bendingCoeffs(sec, F.Mz * 1e6, F.My * 1e6);
  let max = -Infinity, min = Infinity;
  let at: [number, number] = [0, 0], atMin: [number, number] = [0, 0];
  for (const [z, y] of sec.checkPoints) {
    const s = N / sec.A + a * y + b * z;
    if (s > max) { max = s; at = [y, z]; }
    if (s < min) { min = s; atMin = [y, z]; }
  }
  return { max, min, at, atMin };
}

/** Vị trí trục trung hoà: σ(y, z) = 0 → trả về hệ số [N/A, a, b] để vẽ */
export function neutralAxisCoeffs(sec: SectionProps, F: InternalForces): [number, number, number] {
  const [a, b] = bendingCoeffs(sec, F.Mz * 1e6, F.My * 1e6);
  return [(F.N * 1e3) / sec.A, a, b];
}

export { f as fmt };
