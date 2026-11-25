import { describe, expect, it } from 'vitest';
import { analyzeModular, defaultModular } from '../src/core/modular';
import { analyzeTransport, spmtDieselEngine } from '../src/core/transport';

describe('Xe module thủy lực — ví dụ trên thẻ tham khảo', () => {
  it('trang 3: bồn 342 t → SPMT 342/30 = 12 trục dòng; pull type 342/25 = 14 trục dòng', () => {
    const spmt = analyzeModular({ ...defaultModular('spmt'), load: 342, units: [] });
    expect(spmt.linesReq).toBe(12);
    const pull = analyzeModular({ ...defaultModular('pull'), load: 342, units: [] });
    expect(pull.linesReq).toBe(14);
  });

  it('trang 4: động cơ 350 t, SPMT 14 trục dòng, dốc 8% → lực kéo ≈ 44 t, 9 trục chủ động, PPU 140 HP; cấu hình 6+4+4 có 12 trục chủ động', () => {
    const r = analyzeModular({ ...defaultModular('spmt'), load: 350 });
    expect(r.lines).toBe(14);
    expect(r.gvw).toBeCloseTo(350 + 14 * 3.5, 9);
    expect(r.effort).toBeCloseTo(0.11 * 399, 9); // 43,89 t, thẻ làm tròn 44 t
    expect(Math.round(r.effort)).toBe(44);
    expect(r.driveReq).toBe(9);
    expect(r.driveAvail).toBe(12);
    expect(r.ppuHp).toBeCloseTo(140, 9);
    expect(r.ppuKw!).toBeCloseTo(104.4, 1);
    expect(r.ok).toBe(true);
  });

  it('trang 2: hiệu ứng cân bằng — hố 12 inch: treo 4 điểm (2 trục/nhóm) nghiêng 6, treo 3 điểm (4 trục/nhóm) nghiêng 3', () => {
    expect(analyzeModular({ ...defaultModular(), pothole: 12, axlesPerGroup: 2 }).lean).toBe(6);
    expect(analyzeModular({ ...defaultModular(), pothole: 12, axlesPerGroup: 4 }).lean).toBe(3);
  });

  it('pull type: lực kéo tối đa = 80% trọng lượng trên trục chủ động; tổng trọng lượng có kể xe kéo', () => {
    const r = analyzeModular({ ...defaultModular('pull'), load: 100, units: [], trucks: 1, truckDriveWeight: 20, truckWeight: 25, rolling: 3, grade: 0 });
    expect(r.lines).toBe(4);
    expect(r.gvw).toBeCloseTo(100 + 4 * 3.5 + 25, 9);
    expect(r.pullAvail).toBeCloseTo(16, 9);
    expect(r.effort).toBeCloseTo(0.03 * 139, 9);
    expect(r.trucksReq).toBe(1);
    expect(analyzeModular({ ...defaultModular('pull'), load: 100, units: [], trucks: 1, truckDriveWeight: 20, grade: 12 }).ok).toBe(false);
  });

  it('cấu hình ít trục dòng hơn số cần: tải trên trục dòng không đạt', () => {
    const r = analyzeModular({ ...defaultModular('spmt'), load: 342, units: [{ lines: 6, drive: 4 }, { lines: 4, drive: 4 }] });
    expect(r.lines).toBe(10);
    expect(r.checks[0].ok).toBe(false);
  });

  it('trong tab vận chuyển: hàng lấy từ thẻ Hàng hoá, gối kê lấy từ Tải khác trên xe; bỏ kiểm tra tải trục sơ mi rơ moóc', () => {
    const m = spmtDieselEngine();
    const r = analyzeTransport({ ...m, others: [{ name: 'Gối kê', mass: 10, x: 0 }] });
    expect(r.kind).toBe('modular');
    expect(r.modular!.payload).toBeCloseTo(360, 9);
    expect(r.modular!.linesReq).toBe(12);
    expect(r.warnings.some((w) => /chốt kéo|cụm trục/.test(w))).toBe(false);
  });
});
