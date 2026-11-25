import { describe, expect, it } from 'vitest';
import { G, analyzeTransport, axleLoads, bargeCheck, groundPressure, checkSliding, checkTipping, defaultTransport, migrateCoef, migrateRoad, pipeType2, roadCheck, type TransportModel } from '../src/core/transport';

const none = (m: TransportModel): TransportModel => ({
  ...m, topOver: { ...m.topOver, n: 0 }, direct: { ...m.direct, nLong: 0, nTrans: 0 }, blocking: { fwd: 0, rear: 0, side: 0 },
});

describe('Chằng buộc theo EN 12195-1', () => {
  it('chỉ ma sát: F = c·m·g, ma sát μ·c_z·m·g', () => {
    const m = none({ ...defaultTransport(), mu: 0.6 });
    const s = checkSliding(m, 'fwd');
    expect(s.demand).toBeCloseTo(0.8 * 26.1 * G, 9);
    expect(s.friction).toBeCloseTo(0.6 * 26.1 * G, 9);
    expect(s.ok).toBe(false);
    expect(checkSliding(m, 'side').ok).toBe(true);
    expect(checkSliding(m, 'side').frictionAlone).toBe(true);
  });

  it('dây vắt qua nóc: n ≥ (c − μ·c_z)·m·g·f_s / (2·μ·sinα·F_T)', () => {
    // 10 t, μ = 0,3, α = 90°, STF 400 daN → phương ngang: (0,5 − 0,3)·98,1·1,1/(2·0,3·4) = 8,99 → 9 dây
    const base = none(defaultTransport());
    const m: TransportModel = { ...base, mu: 0.3, cargo: { ...base.cargo, mass: 10 }, topOver: { n: 9, alpha: 90, stf: 400, lc: 2500 } };
    const s = checkSliding(m, 'side');
    expect(s.nTopOverReq).toBe(9);
    expect(s.ok).toBe(true);
    expect(checkSliding({ ...m, topOver: { ...m.topOver, n: 8 } }, 'side').ok).toBe(false);
  });

  it('chằng trực tiếp: n·LC·(cosα·cosβ + μ·f_μ·sinα) ≥ (c − μ·f_μ·c_z)·m·g', () => {
    const m = defaultTransport(); // 26,1 t; μ = 0,6; 2 nhánh LC 4900 daN, α = 45°, β = 30°
    const s = checkSliding(m, 'fwd');
    const geo = Math.cos(Math.PI / 4) * Math.cos(Math.PI / 6) + 0.45 * Math.sin(Math.PI / 4);
    expect(s.direct).toBeCloseTo(2 * 49 * geo, 9);
    expect(s.friction).toBeCloseTo(0.45 * 26.1 * G, 9);
    expect(s.capacity).toBeCloseTo(0.45 * 26.1 * G + 2 * 49 * geo, 9);
    expect(s.lcDirectReq! * 10 / 1000).toBeCloseTo(((0.8 - 0.45) * 26.1 * G) / (2 * geo), 9);
    expect(s.ok).toBe(s.lcDirectReq! <= 4900);
  });

  it('lật: ổn định khi b/d ≥ c/c_z; dây vắt qua nóc bù mô men', () => {
    const base = none(defaultTransport());
    const m: TransportModel = { ...base, cargo: { ...base.cargo, mass: 20, width: 1.6, footW: 1.6, cgH: 1.8 } };
    const x = checkTipping(m, 'side'); // b/d = 0,8/1,8 = 0,444 < 0,5 → lật
    expect(x.stable).toBe(false);
    const need = ((0.5 * 1.8 - 0.8) * 20 * G * 1.1) / (5 * 1.6 * Math.sin(Math.PI / 3));
    expect(x.nTopOverReq).toBe(Math.ceil(need));
    const y = checkTipping({ ...m, topOver: { n: x.nTopOverReq!, alpha: 60, stf: 500, lc: 2500 } }, 'side');
    expect(y.ok).toBe(true);
    expect(checkTipping(m, 'fwd').stable).toBe(true);
  });
});

describe('Tải trọng trục', () => {
  it('cân bằng mô men quanh chốt kéo, cụm trục chia đều', () => {
    const m = defaultTransport();
    const a = axleLoads(m);
    const xg = (8.9 + 10.21 + 11.52) / 3;
    const grp = (7 * (7 - 1) + 26.1 * (6.5 - 1)) / (xg - 1);
    expect(a.trailerGroup).toBeCloseTo(grp, 9);
    expect(a.kingpin).toBeCloseTo(33.1 - grp, 9);
    expect(a.perTrailerAxle).toBeCloseTo(grp / 3, 9);
    expect(a.gross).toBeCloseTo(33.1 + 5.5 + 3.5, 9);
    expect(a.tractorFront + a.tractorGroup).toBeCloseTo(5.5 + 3.5 + a.kingpin, 9);
  });
});

describe('Đối chiếu điều kiện đường (số liệu bản vẽ)', () => {
  it('dốc 5°, ly tâm và phanh khớp với hồ sơ (tấn lực)', () => {
    const m = defaultTransport();
    const r = roadCheck(m); // bảng hồ sơ: Q = 26,1; f = 0,6; v_thẳng 8,3; v_cua 1,38; R = 7,87; dốc dọc 5°, dốc ngang 5°
    expect(r.slope / G).toBeCloseTo(2.27, 2);
    expect(r.cross / G).toBeCloseTo(2.27, 2);
    expect(r.centrifugal / G).toBeCloseTo(0.64, 2);
    expect(r.braking / G).toBeCloseTo(11.07, 2);
    expect(r.frictionLong / G).toBeCloseTo(15.66, 2); // f·Q như hồ sơ
    expect(r.checks.map((c) => c.ok)).toEqual([true, true, true]);
    expect(r.checks[1].force).toBeCloseTo(r.slope + r.braking, 9);
    expect(r.checks[2].force).toBeCloseTo(r.centrifugal + r.cross, 9);
    expect(r.coveredX && r.coveredY).toBe(true);
  });
  it('gia tốc phanh từ vận tốc và thời gian / quãng đường; ma sát có cosθ', () => {
    const m = defaultTransport();
    const t = roadCheck({ ...m, road: { ...m.road, brakeMode: 'time', vStraight: 8.3, brakeTime: 2 } });
    expect(t.accel).toBeCloseTo(4.15, 9);
    const d = roadCheck({ ...m, road: { ...m.road, brakeMode: 'distance', vStraight: 8.3, brakeDist: 8.3 } });
    expect(d.accel).toBeCloseTo(4.15, 9);
    const c = roadCheck({ ...m, road: { ...m.road, frictionCos: true } });
    expect(c.frictionLong).toBeCloseTo(0.6 * 26.1 * G * Math.cos((5 * Math.PI) / 180), 9);
  });
  it('dữ liệu cũ: vận tốc vào cua km/h được đổi sang m/s', () => {
    const d = defaultTransport().road;
    expect(migrateRoad({ slope: 5, vCurve: 18, radius: 10, brake: 3 } as never, d).vCurve).toBeCloseTo(5, 9);
    expect(migrateRoad({ ...d, vCurve: 1.38 }, d).vCurve).toBe(1.38);
  });
  it('phân tích tổng hợp chạy được với mọi bài mẫu', () => {
    const r = analyzeTransport(defaultTransport());
    expect(r.slide).toHaveLength(3);
    expect(r.tip).toHaveLength(3);
  });
});


describe('Áp lực nền và tỉ lệ tải sà lan', () => {
  it('ống loại 2 theo bản vẽ: 42,83 t / (6 × 1,3 × 2 × 1,11 = 17,316 m²) = 2,47 t/m²', () => {
    const m = pipeType2();
    const a = axleLoads(m);
    expect(a.gross).toBeCloseTo(16.49 + 26.1 + 0.24, 9);
    const r = groundPressure(m, a);
    expect(r.whole.area).toBeCloseTo(17.316, 9);
    expect(r.whole.p).toBeCloseTo(42.83 / 17.316, 9);
    expect(r.whole.p).toBeCloseTo(2.47, 2);
    // áp lực theo từng cụm trục: tải cụm / (số trục × 2 vệt)
    const g3 = r.groups[2];
    expect(g3.area).toBeCloseTo(3 * 2 * 1.3 * 1.11, 9);
    expect(g3.p).toBeCloseTo(a.trailerGroup / g3.area, 9);
    expect(r.worst!.p).toBeGreaterThanOrEqual(r.whole.p);
    expect(r.overlap).toBe(false); // trục cách 1,3 m = chiều dài vệt
  });
  it('vệt tự tính = (vệt lốp + 2h·tanθ) × (rộng cụm bánh + 2h·tanθ); cảnh báo khi vệt chồng nhau', () => {
    const m = defaultTransport();
    const r = groundPressure({ ...m, ground: { ...m.ground, layerH: 0.5, angle: 45, tyreL: 0.3, setW: 0.6, patchL: 0, patchB: 0 } });
    expect(r.whole.L).toBeCloseTo(1.3, 9);
    expect(r.whole.B).toBeCloseTo(1.6, 9);
    expect(r.whole.area).toBeCloseTo(6 * 2 * 1.3 * 1.6, 9);
    expect(groundPressure({ ...m, ground: { ...m.ground, layerH: 1 } }).overlap).toBe(true);
  });
  it('tự trọng tổng phân bổ theo %, tải khác vào tải trục nhưng không vào chằng buộc', () => {
    const m = pipeType2();
    const a = axleLoads(m);
    const b = axleLoads({ ...m, others: [] });
    expect(a.gross - b.gross).toBeCloseTo(0.24, 9);
    expect(checkSliding(m, 'fwd').demand).toBeCloseTo(checkSliding({ ...m, others: [] }, 'fwd').demand, 12);
    const z = axleLoads({ ...m, cargo: { ...m.cargo, mass: 0 }, others: [] });
    const sh = m.vehicle.tareShare!;
    expect(z.tractorFront).toBeCloseTo((16.49 * sh.front) / 100, 9);
    expect(z.trailerGroup).toBeCloseTo((16.49 * sh.trailer) / 100, 9);
  });
  it('sà lan 158 DWT theo bản vẽ: (74,133 + 0,5 + 0,5) / 158 = 47,55%', () => {
    const b = bargeCheck(defaultTransport().barges[0]);
    expect(b.total).toBeCloseTo(75.133, 9);
    expect(b.uc * 100).toBeCloseTo(47.55, 2);
    expect(b.ok).toBe(true);
    expect(bargeCheck({ name: 'x', dwt: 50, ucLimit: 80, items: [{ name: 'a', mass: 41 }] }).ok).toBe(false);
  });
});

describe('Hệ số theo EN 12195-1: f_s theo từng phương, ma sát khi chặn', () => {
  it('f_s = 1,25 phương tiến, 1,1 phương lùi và ngang', () => {
    const base = none(defaultTransport());
    // 10 t, μ = 0,3, vắt nóc α = 90°, STF 400 daN
    const m: TransportModel = { ...base, mu: 0.3, cargo: { ...base.cargo, mass: 10 }, topOver: { n: 1, alpha: 90, stf: 400, lc: 2500 } };
    const W = 10 * G;
    const fwd = checkSliding(m, 'fwd'), rear = checkSliding(m, 'rear');
    expect(fwd.nTopOverReq).toBe(Math.ceil(((0.8 - 0.3) * W * 1.25) / (2 * 0.3 * 4)));
    expect(rear.nTopOverReq).toBe(Math.ceil(((0.5 - 0.3) * W * 1.1) / (2 * 0.3 * 4)));
    expect(rear.topOver).toBeCloseTo((2 * 1 * 0.3 * 4) / 1.1, 9);
    expect(fwd.topOver).toBeCloseTo((2 * 1 * 0.3 * 4) / 1.25, 9);
  });
  it('chỉ chặn: ma sát dùng μ (không nhân f_μ); có chằng trực tiếp mới dùng μ·f_μ', () => {
    const base = none(defaultTransport());
    const blk: TransportModel = { ...base, mu: 0.4, blocking: { fwd: 50, rear: 0, side: 0 } };
    const s = checkSliding(blk, 'fwd');
    expect(s.muUsed).toBe(0.4);
    expect(s.capacity).toBeCloseTo(0.4 * base.cargo.mass * G + 50, 9);
    const withDirect = checkSliding({ ...blk, direct: { nLong: 2, nTrans: 2, lc: 2000, alpha: 45, beta: 30 } }, 'fwd');
    expect(withDirect.muUsed).toBeCloseTo(0.4 * 0.75, 12);
  });
  it('dữ liệu cũ có fsLong: giữ cho phương tiến, phương lùi lấy 1,1', () => {
    const c = migrateCoef({ cxF: 0.8, fsLong: 1.3 } as never);
    expect(c.fsFwd).toBe(1.3);
    expect(c.fsRear).toBe(1.1);
    expect((c as unknown as { fsLong?: number }).fsLong).toBeUndefined();
    expect(migrateCoef(undefined).fsRear).toBe(1.1);
  });
});
