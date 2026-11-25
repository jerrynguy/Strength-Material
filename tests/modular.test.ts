import { describe, expect, it } from 'vitest';
import { analyzeModular, defaultModular } from '../src/core/modular';
import { analyzeTransport, pullTypeTank400, pullTypeTransformer280, spmtDieselEngine } from '../src/core/transport';

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
    expect(r.checks.filter((c) => /trục dòng|chủ động/.test(c.label)).every((c) => c.ok)).toBe(true);
    // Ổn định kết cấu ngang của ví dụ này (module đơn D_AB = 1,45 m, CoG 3 m): W_axle = 399/28 = 14,25 t, A_C = 15 t
    // → độ dời = (15/14,25)·(1,45/3) − 1,45/3 ≈ 0,025 m → Sβ ≈ 0,5° < 5°: thẻ trang 4 không xét ổn định
    const sb = (Math.atan(((15 / (399 / 28)) * (1.45 / 3) - 1.45 / 3) / 3) * 180) / Math.PI;
    expect(r.stab!.Sb).toBeCloseTo(sb, 9);
    expect(r.checks.find((c) => c.label === 'Ổn định kết cấu ngang Sβ')!.ok).toBe(false);
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

describe('Ổn định và dầm sống — ví dụ trên thẻ tham khảo', () => {
  it('trang 7: bồn 400 t, pull type module đôi 2 × 16 trục dòng, treo 3 điểm, CoG 4,85 m', () => {
    const r = analyzeModular({
      ...defaultModular('pull'), load: 400, units: [{ lines: 16, drive: 0 }], wide: 2, axleBase: 3.3,
      suspension: '3', cog: 4.85, rolling: 3, grade: 3, trucks: 1, truckDriveWeight: 50, truckWeight: 50,
    });
    const s = r.stab!;
    expect(r.lines).toBe(32);
    expect(s.TL).toBeCloseTo(24, 9); // 16 × 1,5
    expect(r.lines * 3.5).toBeCloseTo(112, 9); // W_T
    expect(s.axles).toBe(64);
    expect(s.Waxle).toBeCloseTo(8, 9); // (112 + 400) / 64
    expect(s.Ac).toBeCloseTo(12.5, 9);
    expect(s.Ha).toBeCloseTo(39.5, 1); // arctan(4 / 4,85)
    expect(s.Hb).toBeCloseTo(12.8, 1); // arctan(1,1 / 4,85)
    expect(s.sLong).toBeCloseTo(4.5, 9); // (24/3)·(64·12,5/512) − 24/3
    expect(s.sTrans).toBeCloseTo(0.61875, 9); // (12,5/8)·1,1 − 1,1 ≈ 0,62
    // thẻ ghi Sα = 42,6°; arctan(4,5 / 4,85) = 42,86° (sai khác do làm tròn trên thẻ)
    expect(s.Sa).toBeCloseTo((Math.atan(4.5 / 4.85) * 180) / Math.PI, 9);
    expect(s.Sa).toBeGreaterThan(42.5);
    expect(s.Sa).toBeLessThan(43);
    expect(s.Sb).toBeCloseTo(7.3, 1);
    // câu hỏi phụ 2: lực kéo — có 50·0,8 = 40 t; cần (50 + 112 + 400)·6% = 33,7 t
    expect(r.pullAvail).toBeCloseTo(40, 9);
    expect(r.effort).toBeCloseTo(33.72, 9);
    expect(r.ok).toBe(true);
  });

  it('treo 4 điểm: Hα = arctan((T_L/4)/CoG), Hβ = arctan((D_AB/2)/CoG); độ dời theo công thức 4 điểm', () => {
    const r = analyzeModular({ ...defaultModular('pull'), load: 400, units: [{ lines: 16, drive: 0 }], wide: 2, axleBase: 3.3, suspension: '4', cog: 4.85 });
    const s = r.stab!;
    expect(s.Ha).toBeCloseTo((Math.atan(6 / 4.85) * 180) / Math.PI, 9);
    expect(s.Hb).toBeCloseTo((Math.atan(1.65 / 4.85) * 180) / Math.PI, 9);
    expect(s.sLong).toBeCloseTo((12.5 / 16) * 12 - 6, 9);
    expect(s.sTrans).toBeCloseTo((12.5 / 16) * 3.3 - 1.65, 9);
    expect(r.notes.some((n) => /Treo 4 điểm/.test(n))).toBe(true); // 512 t > 0,5 × 800 t
  });

  it('trang 8: máy biến áp 280 t, 12 trục dòng pull type đời cũ, 4 trục dòng thò ra → M ≈ 350 t·m; được thò ra tối đa 4 (gần 5)', () => {
    const r = analyzeModular({ ...defaultModular('pull'), load: 280, units: [{ lines: 12, drive: 0 }], overhangFront: 4, spineM: 560 });
    expect(r.spine.wLine).toBeCloseTo(280 / 12, 9);
    expect(r.spine.Mmax).toBeCloseTo((280 / 12) * 1.5 * 10, 9); // 350 (thẻ: 23,3 → 349,5)
    expect(r.spine.ratio).toBeCloseTo(14.93, 2);
    expect(r.spine.nMax).toBe(4);
    expect(r.spine.ok).toBe(true);
    const r6 = analyzeModular({ ...defaultModular('pull'), load: 280, units: [{ lines: 12, drive: 0 }], overhangFront: 6, spineM: 560 });
    expect(r6.spine.ok).toBe(false); // 23,33·1,5·21 = 735 > 560
  });

  it('bài mẫu trang 7 và 8 trong tab chạy được', () => {
    const a = analyzeTransport(pullTypeTank400());
    expect(a.modular!.stab!.Ha).toBeCloseTo(39.5, 1);
    const b = analyzeTransport(pullTypeTransformer280());
    expect(b.modular!.spine.Mmax).toBeCloseTo(350, 6);
  });
});

describe('Áp lực nền và ngoại lực — thẻ tham khảo trang 9–12', () => {
  it('trang 9: máy biến áp 250 t, 12 trục dòng pull type, T_L 18, T_W 3, W_T 42 → 5,4 và 3,6 t/m²', () => {
    const r = analyzeModular({ ...defaultModular('pull'), load: 250, units: [{ lines: 12, drive: 0 }], tw: 3 });
    expect(r.lines * 3.5).toBeCloseTo(42, 9);
    expect(r.ground.TL).toBeCloseTo(18, 9);
    expect(r.ground.p1).toBeCloseTo(292 / 54, 9);
    expect(r.ground.p1).toBeCloseTo(5.4, 1);
    expect(r.ground.p2).toBeCloseTo(292 / 81, 9);
    expect(r.ground.p2).toBeCloseTo(3.6, 1);
    const chk = analyzeModular({ ...defaultModular('pull'), load: 250, units: [{ lines: 12, drive: 0 }], tw: 3, pAllow: 5, gpMethod: 1 });
    expect(chk.ground.ok).toBe(false);
    expect(analyzeModular({ ...defaultModular('pull'), load: 250, units: [{ lines: 12, drive: 0 }], tw: 3, pAllow: 5, gpMethod: 2 }).ground.ok).toBe(true);
  });

  const base = { ...defaultModular('pull'), load: 400, units: [{ lines: 16, drive: 0 }], wide: 2 as const, axleBase: 3.3, cog: 4.85, accel: 0, vCurve: 0, radius: 0 };

  it('trang 10: lực ly tâm F = W_TOT/g·V0²/r; F_SUSP-T = F·CoG/D_AB; treo 3 điểm chia cho số trục nhóm 2 (1/4 số trục)', () => {
    const r = analyzeModular({ ...base, suspension: '3', vCurve: 2, radius: 20 });
    const f = r.ext!.forces.find((x) => x.label.startsWith('Ly tâm'))!;
    expect(f.F).toBeCloseTo((512 / 9.81) * (4 / 20), 9);
    expect(f.Fs).toBeCloseTo((f.F * 4.85) / 3.3, 9);
    expect(f.n).toBe(16);
    expect(f.Faxle).toBeCloseTo(f.Fs / 16, 9);
    // vận tốc gấp đôi → lực ly tâm gấp 4
    const r2 = analyzeModular({ ...base, suspension: '3', vCurve: 4, radius: 20 });
    expect(r2.ext!.forces[0].F).toBeCloseTo(4 * f.F, 9);
    // treo 4 điểm: chia cho nhóm 2+3 (nửa số trục)
    expect(analyzeModular({ ...base, suspension: '4', vCurve: 2, radius: 20 }).ext!.forces[0].n).toBe(32);
  });

  it('trang 11: gió W_P–L = cos φ·W_P; F_SUSP-L = F·CoW/(0,5·T_L); tăng tốc a = V0/t, F_ACC = W_TOT/g·a', () => {
    const r = analyzeModular({ ...base, suspension: '3', windP: 0.981, windA: 100, windSf: 1.2, windPhi: 30, cow: 6, accel: 1.39 / 2, accPhi: 0 });
    const wl = r.ext!.forces.find((x) => x.label === 'Gió (dọc)')!;
    const wt = r.ext!.forces.find((x) => x.label === 'Gió (ngang)')!;
    expect(wl.F).toBeCloseTo(Math.cos(Math.PI / 6) * 0.1 * 100 * 1.2, 9);
    expect(wl.Fs).toBeCloseTo((wl.F * 6) / 12, 9);
    expect(wt.Fs).toBeCloseTo((wt.F * 6) / 3.3, 9);
    const acc = r.ext!.forces.find((x) => x.label === 'Tăng tốc / phanh (dọc)')!;
    expect(acc.F).toBeCloseTo((512 / 9.81) * 0.695, 9);
    expect(acc.Fs).toBeCloseTo((acc.F * 4.85) / 12, 9);
    expect(acc.n).toBe(32);
  });

  it('trang 12: dốc chưa bù F = sin α_GL·W_TOT, sin β_GT·W_TOT; tải trục kể ngoại lực so với A_C', () => {
    const r = analyzeModular({ ...base, suspension: '3', alphaGL: 2, betaGT: 1 });
    const L = r.ext!.forces.find((x) => x.label === 'Dốc dọc chưa bù')!;
    const T = r.ext!.forces.find((x) => x.label === 'Dốc ngang chưa bù')!;
    expect(L.F).toBeCloseTo(Math.sin((2 * Math.PI) / 180) * 512, 9);
    expect(T.F).toBeCloseTo(Math.sin(Math.PI / 180) * 512, 9);
    expect(r.ext!.Waxle).toBeCloseTo(8 + Math.max(r.ext!.axleT, r.ext!.axleL), 9);
    expect(r.notes.some((n) => /Dốc chưa bù/.test(n))).toBe(true);
  });
});
