/** Sinh lời giải từng bước (phương pháp mặt cắt và kiểm tra cân bằng). */
import type { AnalysisResult } from './analysis';
import { fmt } from './stress';

const n = (v: number) => fmt(v, 3);

export type SectionSource = Pick<AnalysisResult, 'ok' | 'keyPoints' | 'actions' | 'distributed' | 'internalAt'>;

export function sectionSteps(res: SectionSource, x: number, side: 'left' | 'right', origin = 'đầu trái'): string[] {
  if (!res.ok) return [];
  const tol = 1e-9 * Math.max(1, res.keyPoints[res.keyPoints.length - 1]);
  const lines: string[] = [];
  lines.push(`Xét phần thanh phía ${origin} mặt cắt, cách ${origin} x = ${n(x)} m${side === 'left' ? ' (sát bên trái, x⁻)' : ' (sát bên phải, x⁺)'}.`);
  lines.push('Quy ước: N kéo dương; Q dương khi làm phân tố quay thuận chiều kim đồng hồ; M dương khi căng thớ dưới.');
  for (const a of res.actions) {
    const inc = a.x < x - tol || (side === 'right' && Math.abs(a.x - x) <= tol);
    if (!inc) continue;
    const d = x - a.x;
    const parts: string[] = [];
    if (a.Fx) parts.push(`Fx = ${n(a.Fx)} kN → N += ${n(-a.Fx)}`);
    if (a.Fy) parts.push(`Fy = ${n(a.Fy)} kN → Qy += ${n(a.Fy)}; Mz += ${n(a.Fy)}·${n(d)} = ${n(a.Fy * d)}`);
    if (a.Fz) parts.push(`Fz = ${n(a.Fz)} kN → Qz += ${n(a.Fz)}; My += ${n(a.Fz)}·${n(d)} = ${n(a.Fz * d)}`);
    if (a.Mz) parts.push(`Mz = ${n(a.Mz)} kN·m (${a.Mz > 0 ? '↺' : '↻'}) → Mz += ${n(-a.Mz)}`);
    if (a.My) parts.push(`My = ${n(a.My)} kN·m → My += ${n(a.My)}`);
    if (a.Mx) parts.push(`Mx = ${n(a.Mx)} kN·m → T += ${n(-a.Mx)}`);
    if (parts.length) lines.push(`• ${a.label} (x = ${n(a.x)} m): ${parts.join(' ; ')}`);
  }
  for (const d of res.distributed) {
    if (d.x1 >= x) continue;
    const c = Math.min(d.x2, x);
    const q = (s: number) => d.q1 + ((d.q2 - d.q1) * (s - d.x1)) / (d.x2 - d.x1);
    const R = ((q(d.x1) + q(c)) / 2) * (c - d.x1);
    const m = (d.x1 + c) / 2;
    const Mo = ((c - d.x1) / 6) * (q(d.x1) * (x - d.x1) + 4 * q(m) * (x - m) + q(c) * (x - c));
    const arm = R !== 0 ? Mo / R : 0;
    const comp = d.dir === 'x' ? 'N' : d.dir === 'y' ? 'Qy' : 'Qz';
    const mom = d.dir === 'y' ? 'Mz' : d.dir === 'z' ? 'My' : '';
    lines.push(
      `• ${d.name} trên đoạn [${n(d.x1)}; ${n(c)}] m: hợp lực R = ${n(R)} kN, cách mặt cắt ${n(arm)} m → ${comp} += ${n(d.dir === 'x' ? -R : R)}` +
        (mom ? `; ${mom} += ${n(R)}·${n(arm)} = ${n(Mo)}` : ''),
    );
  }
  const F = res.internalAt(x, side);
  lines.push(`⇒ N = ${n(F.N)} kN; Qy = ${n(F.Qy)} kN; Mz = ${n(F.Mz)} kN·m` +
    (F.Qz || F.My ? `; Qz = ${n(F.Qz)} kN; My = ${n(F.My)} kN·m` : '') + (F.T ? `; T = ${n(F.T)} kN·m` : ''));
  return lines;
}

export function equilibriumSteps(res: AnalysisResult): string[] {
  if (!res.ok) return [];
  let X = 0, Y = 0, Z = 0, M0 = 0, Mx = 0;
  for (const a of res.actions) {
    X += a.Fx; Y += a.Fy; Z += a.Fz; Mx += a.Mx;
    M0 += a.Mz + a.Fy * a.x;
  }
  for (const d of res.distributed) {
    const R = ((d.q1 + d.q2) / 2) * (d.x2 - d.x1);
    const xc = R !== 0 ? d.x1 + ((d.x2 - d.x1) * (d.q1 + 2 * d.q2)) / (3 * (d.q1 + d.q2)) : 0;
    if (d.dir === 'x') X += R;
    if (d.dir === 'y') { Y += R; M0 += R * xc; }
    if (d.dir === 'z') Z += R;
  }
  let scale = 1e-9;
  for (const a of res.actions) scale = Math.max(scale, Math.abs(a.Fx), Math.abs(a.Fy), Math.abs(a.Fz), Math.abs(a.Mz), Math.abs(a.Mx));
  const z = (v: number) => (Math.abs(v) < 1e-7 * scale * 10 ? 0 : v);
  X = z(X); Y = z(Y); Z = z(Z); M0 = z(M0); Mx = z(Mx);
  const lines = [
    'Kiểm tra cân bằng toàn thanh (tải + phản lực):',
    `ΣX = ${n(X)} kN`,
    `ΣY = ${n(Y)} kN`,
    `ΣM(quanh đầu trái, ↺ dương) = ${n(M0)} kN·m`,
  ];
  if (Z || res.distributed.some((d) => d.dir === 'z')) lines.push(`ΣZ = ${n(Z)} kN`);
  if (Mx) lines.push(`ΣMx = ${n(Mx)} kN·m`);
  return lines;
}
