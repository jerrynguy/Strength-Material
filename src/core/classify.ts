/**
 * Nhận biết dạng chịu lực của thanh theo từng đoạn, dựa trên các thành phần nội lực khác 0.
 */
import type { AnalysisResult } from './analysis';
import type { InternalForces } from './types';

export interface LoadingRegion {
  x1: number;
  x2: number;
  label: string;
  /** đơn giản (1 dạng biến dạng cơ bản) hay phức tạp (tổ hợp) */
  complex: boolean;
  components: string[];
}

export interface Classification {
  regions: LoadingRegion[];
  summary: string;
  kinds: string[];
}

export function labelFor(m: Record<keyof InternalForces, number>, tolF: number, tolM: number, nSign: number) {
  const hasN = m.N > tolF;
  const hasQy = m.Qy > tolF;
  const hasQz = m.Qz > tolF;
  const hasMz = m.Mz > tolM;
  const hasMy = m.My > tolM;
  const hasT = m.T > tolM;
  const comps: string[] = [];
  if (hasN) comps.push('N');
  if (hasQy) comps.push('Qy');
  if (hasQz) comps.push('Qz');
  if (hasMz) comps.push('Mz');
  if (hasMy) comps.push('My');
  if (hasT) comps.push('T');

  const bendBoth = hasMz && hasMy;
  const bend = hasMz || hasMy;
  const shear = hasQy || hasQz;
  let bendLabel = '';
  if (bendBoth) bendLabel = 'uốn xiên';
  else if (bend) bendLabel = shear ? 'uốn ngang phẳng' : 'uốn thuần tuý';
  else if (shear) bendLabel = 'cắt';
  const axial = hasN ? (nSign > 0 ? 'kéo' : 'nén') : '';

  const parts: string[] = [];
  if (axial) parts.push(bend || shear || hasT ? axial : `${axial} đúng tâm`);
  if (bendLabel) parts.push(bendLabel);
  if (hasT) parts.push(parts.length ? 'xoắn' : 'xoắn thuần tuý');
  if (parts.length === 0) return { label: 'Không chịu lực', complex: false, comps };
  let label = parts.join(' + ');
  label = label.charAt(0).toUpperCase() + label.slice(1);
  const basic = [axial, bendLabel, hasT ? 'xoắn' : ''].filter(Boolean).length;
  return { label, complex: basic > 1 || bendBoth, comps };
}

export function classify(res: AnalysisResult): Classification {
  if (!res.ok) return { regions: [], summary: '', kinds: [] };
  const kp = res.keyPoints;
  let fMax = 0, mMax = 0;
  for (const s of res.forceSamples) {
    fMax = Math.max(fMax, Math.abs(s.N), Math.abs(s.Qy), Math.abs(s.Qz));
    mMax = Math.max(mMax, Math.abs(s.Mz), Math.abs(s.My), Math.abs(s.T));
  }
  const tolF = 1e-7 * Math.max(fMax, 1e-9) + 1e-9;
  const tolM = 1e-7 * Math.max(mMax, 1e-9) + 1e-9;
  const raw: LoadingRegion[] = [];
  for (let i = 0; i + 1 < kp.length; i++) {
    const a = kp[i], b = kp[i + 1];
    const m = { N: 0, Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0 };
    let nSigned = 0;
    for (let j = 0; j <= 20; j++) {
      const x = a + ((b - a) * j) / 20;
      const F = res.internalAt(x, j === 20 ? 'left' : 'right');
      for (const k of Object.keys(m) as (keyof InternalForces)[]) m[k] = Math.max(m[k], Math.abs(F[k]));
      if (Math.abs(F.N) > Math.abs(nSigned)) nSigned = F.N;
    }
    const { label, complex, comps } = labelFor(m, tolF, tolM, Math.sign(nSigned));
    const last = raw[raw.length - 1];
    if (last && last.label === label) last.x2 = b;
    else raw.push({ x1: a, x2: b, label, complex, components: comps });
  }
  const kinds = [...new Set(raw.filter((r) => r.label !== 'Không chịu lực').map((r) => r.label))];
  const anyComplex = raw.some((r) => r.complex);
  const summary =
    kinds.length === 0
      ? 'Thanh không chịu lực.'
      : anyComplex
        ? 'Thanh chịu lực phức tạp (tổ hợp nhiều dạng biến dạng cơ bản).'
        : kinds.length === 1
          ? `Thanh chịu ${kinds[0].toLowerCase()} (chịu lực đơn giản).`
          : 'Thanh chịu các dạng biến dạng cơ bản khác nhau trên từng đoạn.';
  return { regions: raw, summary, kinds };
}
