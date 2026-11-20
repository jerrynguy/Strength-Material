import { describe, expect, it } from 'vitest';
import { checkLocal, tubeShellBuckling } from '../src/core/localBuckling';
import type { Material } from '../src/core/types';

const S355: Material = { name: 'S355', E: 210, nu: 0.3, allowable: 355 };

describe('Ống tròn – mất ổn định vỏ trụ (EN 1993-1-6, cấp chế tạo B)', () => {
  it('trụ trung bình D508×6, f_y 355: tính tay', () => {
    const r = 251, t = 6;
    const dwk = (1 / 25) * Math.sqrt(r / t) * t;
    const alpha = 0.62 / (1 + 1.91 * (dwk / t) ** 1.44);
    const sRcr = (0.605 * 210000 * t) / r;
    const lam = Math.sqrt(355 / sRcr);
    const lp = Math.sqrt(alpha / 0.4);
    const chi = 1 - 0.6 * ((lam - 0.2) / (lp - 0.2));
    const res = tubeShellBuckling(508, 6, 210000, 355, 355, 500, 100, 100);
    expect(res.lengthKind).toBe('trung bình');
    expect(res.Cx).toBe(1);
    expect(res.alpha).toBeCloseTo(alpha, 10);
    expect(res.alpha).toBeCloseTo(0.487, 3);
    expect(res.sigmaRcr).toBeCloseTo(sRcr, 6);
    expect(res.chi).toBeCloseTo(chi, 10);
    expect(res.chi).toBeCloseTo(0.906, 3);
  });
  it('trụ dài chịu nén thuần: C_x,N giảm (≥ 0.6); uốn thuần: C_x = 1', () => {
    const n = tubeShellBuckling(508, 6, 210000, 355, 355, 6000, 100, 100);
    expect(n.lengthKind).toBe('dài');
    expect(n.Cx).toBeCloseTo(0.6, 6);
    const m = tubeShellBuckling(508, 6, 210000, 355, 355, 6000, 100, 0);
    expect(m.Cx).toBeCloseTo(1, 6);
  });
  it('trụ rất mỏng: χ = α/λ̄² (vùng đàn hồi)', () => {
    const res = tubeShellBuckling(2000, 2, 210000, 355, 355, 1000, 50, 50);
    expect(res.lambda).toBeGreaterThan(res.lambdaP);
    expect(res.chi).toBeCloseTo(res.alpha / res.lambda ** 2, 10);
  });
  it('checkLocal: ống loại 4 chịu nén — kiểm tra vỏ trụ quyết định kết luận', () => {
    const spec = { kind: 'tube', D: 508, t: 6 } as const;
    const A = Math.PI / 4 * (508 ** 2 - 496 ** 2);
    const ok = checkLocal(spec, S355, [{ N: -(0.8 * 355 * A) / 1e3, Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0 }], { fy: 355, stiffenerSpacing: 0, length: 500 });
    expect(ok.sectionClass).toBe(4);
    expect(ok.tube!.governs).toBe(true);
    expect(ok.tube!.sigma).toBeCloseTo(0.8 * 355, 3);
    expect(ok.ok).toBe(true);
    const bad = checkLocal(spec, S355, [{ N: -(0.95 * 355 * A) / 1e3, Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0 }], { fy: 355, stiffenerSpacing: 0, length: 500 });
    expect(bad.ok).toBe(false);
    // ống dày loại 1: vỏ trụ chỉ tham khảo
    const thick = checkLocal({ kind: 'tube', D: 168.3, t: 8 }, S355, [{ N: -500, Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0 }], { fy: 355, stiffenerSpacing: 0, length: 3000 });
    expect(thick.tube!.governs).toBe(false);
  });
});
