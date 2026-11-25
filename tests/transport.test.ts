import { describe, expect, it } from 'vitest';
import { G, analyzeTransport, axleLoads, bargeCheck, groundPressure, checkSliding, checkTipping, defaultTransport, roadCheck, type TransportModel } from '../src/core/transport';

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
    const r = roadCheck({ ...m, road: { slope: 5, vCurve: 1.38 * 3.6, radius: 7.87, brake: 4.16 } });
    expect(r.slope / G).toBeCloseTo(2.27, 2);
    expect(r.centrifugal / G).toBeCloseTo(0.64, 2);
    expect(r.braking / G).toBeCloseTo(11.07, 1);
    expect(r.frictionRoad / G).toBeCloseTo(15.6, 1);
    expect(r.coveredX && r.coveredY).toBe(true);
  });
  it('phân tích tổng hợp chạy được với mọi bài mẫu', () => {
    const r = analyzeTransport(defaultTransport());
    expect(r.slide).toHaveLength(3);
    expect(r.tip).toHaveLength(3);
  });
});


describe('Áp lực nền và tỉ lệ tải sà lan', () => {
  it('toàn xe: A = (L₀ + 2h·tanθ)(B₀ + 2h·tanθ), p = tổng tải / A', () => {
    const m = defaultTransport();
    const r = groundPressure({ ...m, ground: { ...m.ground, layerH: 0.5, angle: 45, wholeL: 13, wholeB: 2.5 } });
    const gross = axleLoads(m).gross;
    expect(r.whole.area).toBeCloseTo(14 * 3.5, 9);
    expect(r.whole.p).toBeCloseTo(gross / 49, 9);
  });
  it('cụm trục: chiều dài vệt = khoảng trục ngoài cùng + vệt lốp', () => {
    const m = defaultTransport();
    const r = groundPressure({ ...m, ground: { ...m.ground, layerH: 0, tyreL: 0.25, wheelW: 2.5 } });
    const g3 = r.groups[2];
    expect(g3.area).toBeCloseTo((11.52 - 8.9 + 0.25) * 2.5, 9);
    expect(g3.p).toBeCloseTo(axleLoads(m).trailerGroup / g3.area, 9);
    expect(r.worst!.p).toBeGreaterThan(r.whole.p);
  });
  it('sà lan 158 DWT theo bản vẽ: (74,133 + 0,5 + 0,5) / 158 = 47,55%', () => {
    const b = bargeCheck(defaultTransport().barges[0]);
    expect(b.total).toBeCloseTo(75.133, 9);
    expect(b.uc * 100).toBeCloseTo(47.55, 2);
    expect(b.ok).toBe(true);
    expect(bargeCheck({ name: 'x', dwt: 50, ucLimit: 80, items: [{ name: 'a', mass: 41 }] }).ok).toBe(false);
  });
});
