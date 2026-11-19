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
