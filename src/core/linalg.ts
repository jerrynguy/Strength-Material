/** Đại số tuyến tính tối giản (ma trận đặc, kích thước nhỏ). */

export type Matrix = number[][];

export function zeros(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
}

/** Giải A·x = b bằng khử Gauss có chọn trụ. Trả về null nếu suy biến. */
export function solve(A: Matrix, b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  let scale = 0;
  for (const row of A) for (const v of row) scale = Math.max(scale, Math.abs(v));
  const tol = (scale || 1) * 1e-12;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < tol) return null;
    if (p !== c) [M[p], M[c]] = [M[c], M[p]];
    const piv = M[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = M[r][c] / piv;
      if (f === 0) continue;
      const Mr = M[r];
      const Mc = M[c];
      for (let k = c; k <= n; k++) Mr[k] -= f * Mc[k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
    x[r] = s / M[r][r];
  }
  return x;
}

/** Hạng của ma trận (khử Gauss với dung sai tương đối). */
export function rank(A: Matrix, cols?: number): number {
  if (A.length === 0) return 0;
  const n = cols ?? A[0].length;
  const M = A.map((r) => [...r]);
  let scale = 0;
  for (const row of M) for (const v of row) scale = Math.max(scale, Math.abs(v));
  const tol = (scale || 1) * 1e-9;
  let rk = 0;
  for (let c = 0; c < n && rk < M.length; c++) {
    let p = rk;
    for (let r = rk + 1; r < M.length; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < tol) continue;
    [M[p], M[rk]] = [M[rk], M[p]];
    for (let r = rk + 1; r < M.length; r++) {
      const f = M[r][c] / M[rk][c];
      for (let k = c; k < n; k++) M[r][k] -= f * M[rk][k];
    }
    rk++;
  }
  return rk;
}

/** Phân tích LU có chọn trụ (dùng lại cho nhiều vế phải). Trả về null nếu suy biến. */
export interface LU {
  M: Float64Array[];
  perm: number[];
  n: number;
}

export function luFactor(A: Matrix): LU | null {
  const n = A.length;
  const M = A.map((r) => Float64Array.from(r));
  const perm = [...Array(n).keys()];
  let scale = 0;
  for (const row of A) for (const v of row) scale = Math.max(scale, Math.abs(v));
  const tol = (scale || 1) * 1e-13;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < tol) return null;
    if (p !== c) { [M[p], M[c]] = [M[c], M[p]]; [perm[p], perm[c]] = [perm[c], perm[p]]; }
    const Mc = M[c];
    const piv = Mc[c];
    for (let r = c + 1; r < n; r++) {
      const Mr = M[r];
      const f = Mr[c] / piv;
      if (f === 0) continue;
      Mr[c] = f;
      for (let k = c + 1; k < n; k++) Mr[k] -= f * Mc[k];
    }
  }
  return { M, perm, n };
}

export function luSolve(lu: LU, b: number[]): number[] {
  const { M, perm, n } = lu;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[perm[i]];
    const Mi = M[i];
    for (let k = 0; k < i; k++) s -= Mi[k] * y[k];
    y[i] = s;
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    const Mi = M[i];
    for (let k = i + 1; k < n; k++) s -= Mi[k] * x[k];
    x[i] = s / Mi[i];
  }
  return x;
}

/**
 * Trị riêng dương nhỏ nhất của bài toán K·x = λ·G·x (lặp nghịch đảo với dịch chuyển 0).
 * applyG: y ↦ G·y. Trả về λ và vectơ riêng, hoặc null nếu không hội tụ / không có trị dương.
 */
export function smallestEigen(lu: LU, applyG: (y: number[]) => number[], n: number, start: number[]): { lambda: number; x: number[] } | null {
  let x = start.slice(0, n);
  if (!x.some((v) => v !== 0)) x = Array.from({ length: n }, (_, i) => Math.sin(i + 1));
  let lambda = NaN;
  for (let it = 0; it < 400; it++) {
    const g = applyG(x);
    const y = luSolve(lu, g);
    let num = 0, den = 0, nrm = 0;
    for (let i = 0; i < n; i++) { num += x[i] * g[i]; den += y[i] * g[i]; nrm = Math.max(nrm, Math.abs(y[i])); }
    if (!(nrm > 0) || !Number.isFinite(nrm)) return null;
    // Rayleigh: λ ≈ (x·Gx)/(y·Gx) với y = K⁻¹Gx
    const lNew = num / den;
    x = y.map((v) => v / nrm);
    if (Number.isFinite(lambda) && Math.abs(lNew - lambda) <= 1e-10 * Math.abs(lNew)) { lambda = lNew; break; }
    lambda = lNew;
  }
  if (!Number.isFinite(lambda)) return null;
  return { lambda, x };
}
