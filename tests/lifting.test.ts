import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FACTORS, LOAD_CHARTS, analyzeLift, craneCheck, crawlerPressure, gearCheck, liftAtt1354, liftLs248, liftLtm1080, lookupChart, outriggerPressure, stackPressure,
} from '../src/core/lifting';

const chart = (k: string) => LOAD_CHARTS.find((c) => c.key === k)!;

describe('Bảng tải cẩu', () => {
  it('tra đúng các ô đóng khung trên bản vẽ', () => {
    expect(lookupChart(chart('ltm1080'), 27.9, 12).cap).toBe(15.3);
    expect(lookupChart(chart('att1354'), 31.7, 14).cap).toBe(16.85);
    expect(lookupChart(chart('ls248'), 27.45, 18).cap).toBe(30.5);
    expect(lookupChart(chart('ls248'), 27.45, 14).cap).toBe(42.3);
  });

  it('bán kính lẻ: lấy dòng lớn hơn kề (an toàn) hoặc nội suy', () => {
    expect(lookupChart(chart('ltm1080'), 27.9, 11).cap).toBe(15.3);
    expect(lookupChart(chart('ltm1080'), 27.9, 11, 'linear').cap).toBeCloseTo((19.5 + 15.3) / 2, 9);
  });

  it('ngoài phạm vi: cần không có cột, bán kính quá lớn, ô trống', () => {
    expect(lookupChart(chart('ltm1080'), 30, 12).cap).toBeNull();
    expect(lookupChart(chart('ltm1080'), 27.9, 20).cap).toBeNull();
    expect(lookupChart(chart('ltm1080'), 27.9, 4).cap).toBeNull();
  });
});

describe('Kiểm tra cẩu theo bảng "Check crane"', () => {
  it('LTM 1080/1: (8,7·1,05 + 1,759)·1,15 = 12,528 t; UC = 81,88%', () => {
    const r = craneCheck(liftLtm1080());
    expect(r.factored).toBeCloseTo(12.528, 3);
    expect(r.rows[0].cap).toBe(15.3);
    expect(r.rows[0].uc * 100).toBeCloseTo(81.88, 2);
    expect(r.ok).toBe(true);
  });

  it('ATT 1354: 12,758 t; UC = 75,71%', () => {
    const r = craneCheck(liftAtt1354());
    expect(r.factored).toBeCloseTo(12.758, 3);
    expect(r.rows[0].uc * 100).toBeCloseTo(75.71, 1);
  });

  it('LS-248RH-5: 14,701 t; UC = 48,20% ở R = 18 m, 34,75% ở R = 14 m', () => {
    const r = craneCheck(liftLs248());
    expect(r.factored).toBeCloseTo(14.701, 2);
    expect(r.rows[0].uc * 100).toBeCloseTo(48.2, 2);
    expect(r.rows[1].uc).toBeCloseTo(14.70135 / 42.3, 4);
  });

  it('UC cho phép và sức nâng nhập tay', () => {
    const m = liftLtm1080();
    expect(craneCheck({ ...m, crane: { ...m.crane, ucLimit: 75 } }).ok).toBe(false);
    const r = craneCheck({ ...m, positions: [{ label: 'x', radius: 12, capManual: 10 }] });
    expect(r.rows[0].cap).toBe(10);
    expect(r.ok).toBe(false);
  });
});

describe('Cáp, dây vải, ma ní', () => {
  it('sling: 4,35·1,05 + 1,042·1,15 = 5,77 t; SF = 7,5/5,77 = 1,300', () => {
    const [s1, s2, sh] = liftLtm1080().gear.map((g) => gearCheck(g, DEFAULT_FACTORS));
    expect(s1.tension).toBeCloseTo(4.35, 9);
    expect(s1.max).toBeCloseTo(5.77, 2);
    expect(s1.sf).toBeCloseTo(1.3, 2);
    expect(s2.sf).toBeCloseTo(1.3, 2);
    expect(sh.max).toBeCloseTo(4.58, 2);
    expect(sh.sf).toBeCloseTo(1.64, 2);
  });

  it('nhánh nghiêng: T = W/(n·sinα); hệ số giảm SWL', () => {
    const g = { ...liftLtm1080().gear[0], angle: 30, rigging: 0, reduce: 0.8 };
    const r = gearCheck(g, { ...DEFAULT_FACTORS, cf: 1 });
    expect(r.tension).toBeCloseTo(8.7, 9);
    expect(r.swlEff).toBeCloseTo(6, 9);
    expect(r.ok).toBe(false);
  });
});

describe('Áp lực nền', () => {
  it('chân chống: p = F/A; có tự trọng tấm kê và lan truyền', () => {
    const o = liftLtm1080().outrigger;
    expect(outriggerPressure(o).p).toBeCloseTo(8.4, 9);
    expect(outriggerPressure({ ...o, matDensity: 0.8 }).p).toBeCloseTo((33.6 + 0.8) / 4, 9);
    expect(outriggerPressure({ ...o, spread: 45 }).area).toBeCloseTo(2.5 * 2.5, 9);
    expect(outriggerPressure({ ...o, allow: 8 }).ok).toBe(false);
  });

  it('bánh xích: trung bình, hình thang, tam giác', () => {
    const c = { ...liftLs248().crawler, mode: 'calc' as const, craneMass: 70, trackL: 6, shoeB: 0.8, ecc: 0, allow: 0 };
    const a = crawlerPressure(c, 10);
    expect(a.pAvg).toBeCloseTo(80 / (2 * 6 * 0.8), 9);
    expect(a.p).toBeCloseTo(a.pAvg!, 9);
    expect(crawlerPressure({ ...c, ecc: 0.5 }, 10).p).toBeCloseTo(a.pAvg! * 1.5, 9);
    expect(crawlerPressure({ ...c, ecc: 2 }, 10).p).toBeCloseTo((2 * 80) / (2 * 0.8 * 3), 9);
    expect(crawlerPressure({ ...c, mode: 'manual', pManual: 15.7, allow: 15 }, 0).ok).toBe(false);
  });

  it('bãi xếp ống: 49 / 72 / 94 / 115 ống; 4,10 / 6,02 / 7,86 / 9,62 t/m² trên 104 m²', () => {
    const r = stackPressure(liftLtm1080().stack);
    expect(r.area).toBe(104);
    expect(r.rows.map((x) => x.count)).toEqual([25, 49, 72, 94, 115]);
    expect(r.rows[1].weight).toBeCloseTo(426.1, 1);
    expect(r.rows[4].weight).toBeCloseTo(1000.04, 2);
    expect(r.rows.slice(1).map((x) => Math.round(x.p * 100) / 100)).toEqual([4.1, 6.02, 7.86, 9.62]);
  });
});

describe('Tổng hợp', () => {
  it('ba bài mẫu theo bản vẽ đều đạt', () => {
    for (const m of [liftLtm1080(), liftAtt1354(), liftLs248()]) expect(analyzeLift(m).ok).toBe(true);
  });
});
