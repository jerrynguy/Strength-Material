import { describe, expect, it } from 'vitest';
import { designBeam, designFrame } from '../src/core/design';
import { FRAME_PRESETS } from '../src/core/framePresets';
import { STEEL, dist, support } from '../src/core/presets';
import { computeSection } from '../src/core/section';
import { STEEL_FAMILIES } from '../src/core/steelTables';
import type { Model } from '../src/core/types';

const cat = (family: string, name: string, rotate = false) => computeSection({ kind: 'catalog', family, name, rotate });

describe('Bảng thép hình', () => {
  it('A và Ix tính từ hình học khớp bảng tra (sai lệch ≤ 1%)', () => {
    let n = 0;
    for (const f of STEEL_FAMILIES) {
      for (const p of f.profiles) {
        if (!p.ref) continue;
        const s = cat(f.key, p.name);
        expect(Math.abs(s.A / 100 / p.ref.A - 1), `${p.name} A`).toBeLessThan(0.01);
        expect(Math.abs(s.Iz / 1e4 / p.ref.Ix - 1), `${p.name} Ix`).toBeLessThan(0.01);
        n++;
      }
    }
    expect(n).toBeGreaterThan(120);
  });
  it('hộp vuông 100×100×5 (góc lượn EN 10219): A = 18.36 cm²', () => {
    expect(cat('SHS', '□100×100×5').A / 100).toBeCloseTo(18.36, 1);
  });
  it('ống Ø114.3×4.5: A = π(D² − d²)/4', () => {
    expect(cat('CHS', 'Ø114.3×4.5').A).toBeCloseTo((Math.PI * (114.3 ** 2 - 105.3 ** 2)) / 4, 6);
  });
  it('xoay 90°: IPE 200 uốn quanh trục yếu Iz ≈ 142 cm⁴', () => {
    const s = cat('IPE', 'IPE 200', true);
    expect(Math.abs(s.Iz / 1e4 / 142 - 1)).toBeLessThan(0.02);
  });
  it('thép góc: trọng tâm z0 L100×10 ≈ 2.83 cm', () => {
    const s = cat('L_GOST', 'L100×10');
    expect(s.centroid[1] / 10).toBeCloseTo(2.83, 1);
  });
});

describe('Chọn số hiệu thép', () => {
  const beam: Model = {
    title: '', length: 6, material: { ...STEEL }, section: { kind: 'rect', b: 100, h: 200 },
    supports: [support('A', 0, 'pin'), support('B', 6, 'roller')], hinges: [], loads: [dist('q', 0, 6, -10)],
  };
  it('dầm đơn giản q = 10 kN/m, L = 6 m, [σ] = 160 MPa → I24 (W cần ≥ 281 cm³)', () => {
    const c = designBeam(beam, { family: 'I_GOST', rotate: false, deflRatio: 0, selfWeight: false });
    const best = c.find((x) => x.ok)!;
    expect(best.name).toBe('I24');
    expect(c.find((x) => x.name === 'I22')!.ok).toBe(false);
  });
  it('thêm điều kiện độ võng L/250 và trọng lượng bản thân → tiết diện lớn hơn', () => {
    const c = designBeam(beam, { family: 'I_GOST', rotate: false, deflRatio: 250, selfWeight: true });
    const best = c.find((x) => x.ok)!;
    expect(['I27', 'I30']).toContain(best.name);
    expect(best.defl).toBeLessThanOrEqual(best.deflLimit);
  });
  it('khung: chọn tiết diện cột cho khung cổng', () => {
    const m = FRAME_PRESETS.find((p) => p.key === 'portal-fixed')!.build();
    const c = designFrame(m, m.sections[0].id, { family: 'H_JIS', rotate: false, deflRatio: 0, selfWeight: false });
    expect(c.some((x) => x.ok)).toBe(true);
    expect(c[0].mass).toBeLessThan(c[c.length - 1].mass);
  });
});
