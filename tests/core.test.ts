import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core/analysis';
import { classify } from '../src/core/classify';
import { PRESETS, STEEL, dist, force, moment, support } from '../src/core/presets';
import { computeSection } from '../src/core/section';
import { stressAt } from '../src/core/stress';
import type { Model } from '../src/core/types';

const base = (over: Partial<Model>): Model => ({
  title: 't', length: 6, material: { ...STEEL }, section: { kind: 'rect', b: 100, h: 200 },
  supports: [], hinges: [], loads: [], ...over,
});

const close = (a: number, b: number, rel = 1e-6) => expect(Math.abs(a - b)).toBeLessThanOrEqual(rel * Math.max(1, Math.abs(b)));

describe('Đề mẫu Hình 1', () => {
  const r = analyze(PRESETS[0].build());
  it('tĩnh định', () => {
    expect(r.ok).toBe(true);
    expect(r.status).toBe('tinh-dinh');
  });
  it('phản lực', () => {
    close(r.reactions[0].Fy, -10);
    close(r.reactions[1].Fy, 30);
  });
  it('nội lực tại C (x = 3 m)', () => {
    const F = r.internalAt(3, 'left');
    close(F.Qy, -30);
    close(F.Mz, -70);
  });
  it('cân bằng toàn hệ', () => {
    const e = r.equilibriumResidual;
    expect(Math.abs(e.Qy) + Math.abs(e.Mz) + Math.abs(e.N)).toBeLessThan(1e-6);
  });
});

describe('Bài toán kinh điển', () => {
  const EIof = (m: Model) => analyze(m).rigidity.EIz;

  it('công-xôn: độ võng đầu tự do PL³/3EI', () => {
    const m = base({ length: 2, supports: [support('A', 0, 'fixed')], loads: [force('P', 2, -10)] });
    const r = analyze(m);
    expect(r.status).toBe('tinh-dinh');
    const vExact = (-10e3 * 2 ** 3) / (3 * EIof(m)) * 1e3;
    close(r.displacementAt(2).v, vExact, 1e-6);
    close(r.reactions[0].Mz, 20);
    close(r.internalAt(0, 'right').Mz, -20);
  });

  it('dầm đơn giản q: Mmax = qL²/8, fmax = 5qL⁴/384EI', () => {
    const m = base({ supports: [support('A', 0, 'pin'), support('B', 6, 'roller')], loads: [dist('q', 0, 6, -10)] });
    const r = analyze(m);
    close(r.internalAt(3, 'left').Mz, (10 * 36) / 8);
    close(r.displacementAt(3).v, ((-5 * 10e3 * 6 ** 4) / (384 * EIof(m))) * 1e3, 1e-5);
  });

  it('hai đầu ngàm q: siêu tĩnh bậc 3, M ngàm = qL²/12', () => {
    const m = base({ supports: [support('A', 0, 'fixed'), support('B', 6, 'fixed')], loads: [dist('q', 0, 6, -20)] });
    const r = analyze(m);
    expect(r.status).toBe('sieu-tinh');
    expect(r.degree).toBe(3);
    close(r.internalAt(0, 'right').Mz, (-20 * 36) / 12);
    close(r.internalAt(3, 'left').Mz, (20 * 36) / 24);
    close(r.reactions[0].Fy, 60);
  });

  it('ngàm – gối di động q: R_B = 3qL/8', () => {
    const m = base({ supports: [support('A', 0, 'fixed'), support('B', 6, 'roller')], loads: [dist('q', 0, 6, -10)] });
    const r = analyze(m);
    expect(r.degree).toBe(1);
    close(r.reactions[1].Fy, (3 * 10 * 6) / 8);
  });

  it('tải tam giác trên dầm đơn giản: R_A = q0L/6, R_B = q0L/3', () => {
    const m = base({ supports: [support('A', 0, 'pin'), support('B', 6, 'roller')], loads: [dist('q', 0, 6, 0, -12)] });
    const r = analyze(m);
    close(r.reactions[0].Fy, (12 * 6) / 6);
    close(r.reactions[1].Fy, (12 * 6) / 3);
  });

  it('dầm ghép có khớp: tĩnh định, M tại khớp = 0', () => {
    const r = analyze(PRESETS.find((p) => p.key === 'gerber')!.build());
    expect(r.status).toBe('tinh-dinh');
    expect(Math.abs(r.internalAt(4, 'left').Mz)).toBeLessThan(1e-9);
    // phần KB: R_B = q·5/2 = 25 kN
    close(r.reactions[1].Fy, 25);
  });

  it('thanh hai đầu ngàm chịu lực dọc: phản lực chia theo độ cứng đoạn', () => {
    const r = analyze(PRESETS.find((p) => p.key === 'bar')!.build());
    // P = 100 tại x = 1 trên L = 3: R_A = −P·b/L = −66.67, R_B = −P·a/L = −33.33
    close(r.reactions[0].Fx, -200 / 3);
    close(r.reactions[1].Fx, -100 / 3);
    close(r.internalAt(0.5, 'left').N, 200 / 3);
    close(r.internalAt(2, 'left').N, -100 / 3);
  });
});

describe('Phân tích cấu tạo hình học', () => {
  it('hai gối di động: biến hình theo phương dọc (cảnh báo), vẫn giải uốn', () => {
    const r = analyze(base({ supports: [support('A', 0, 'roller'), support('B', 6, 'roller')], loads: [force('P', 3, -10)] }));
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.includes('biến hình'))).toBe(true);
  });
  it('hai gối di động + lực dọc → biến hình, báo lỗi', () => {
    const r = analyze(base({ supports: [support('A', 0, 'roller'), support('B', 6, 'roller')], loads: [force('P', 3, -10, 5)] }));
    expect(r.ok).toBe(false);
    expect(r.status).toBe('bien-hinh');
  });
  it('khớp nối đặt sai làm hệ thành cơ cấu', () => {
    const r = analyze(base({
      supports: [support('A', 0, 'pin'), support('B', 6, 'roller')],
      hinges: [{ id: 'h', name: 'K', x: 3 }],
      loads: [force('P', 2, -10)],
    }));
    expect(r.status).toBe('bien-hinh');
  });
  it('dầm liên tục 3 gối: bậc 1', () => {
    const r = analyze(PRESETS.find((p) => p.key === 'continuous')!.build());
    expect(r.degree).toBe(1);
  });
});

describe('Tiết diện và ứng suất (đề mẫu Hình 2)', () => {
  const sec = computeSection({ kind: 'I', bt: 300, tt: 30, hw: 450, tw: 30, bb: 300, tb: 30 });
  it('đặc trưng hình học chữ I', () => {
    close(sec.A, 2 * 300 * 30 + 450 * 30);
    close(sec.Iz, (300 * 510 ** 3) / 12 - (270 * 450 ** 3) / 12);
    close(sec.firstMomentAboveY(225), 300 * 30 * 240);
    close(sec.widthAtY(-225 + 1e-6), 30);
  });
  it('điểm A ở chân bản bụng: σ, τ, σtđ theo TB4', () => {
    const s = stressAt(sec, { N: 0, Qy: 40, Qz: 0, T: 0, Mz: 60, My: 0 }, STEEL, -225 + 1e-9, 0);
    const I = (300 * 510 ** 3) / 12 - (270 * 450 ** 3) / 12;
    close(s.sigma, (60e6 * 225) / I, 1e-6);
    close(s.tauQy, (40e3 * 300 * 30 * 240) / (I * 30), 1e-6);
    close(s.td4, Math.sqrt(s.sigma ** 2 + 3 * s.tauQy ** 2));
    close(s.td4, 11.369, 1e-3);
  });
  it('hộp rỗng = chữ nhật ngoài − chữ nhật trong', () => {
    const b = computeSection({ kind: 'box', B: 100, H: 200, tw: 10, tf: 10 });
    close(b.Iz, (100 * 200 ** 3 - 80 * 180 ** 3) / 12);
    close(b.widthAtY(0), 20);
  });
  it('ống tròn: Jurapxki tại trục trung hoà, xoắn τ = T·R/Ip', () => {
    const t = computeSection({ kind: 'tube', D: 100, t: 10 });
    close(t.Iz, (Math.PI * (100 ** 4 - 80 ** 4)) / 64);
    close(t.firstMomentAboveY(0), (2 / 3) * (50 ** 3 - 40 ** 3));
    close(t.torsion.tauMax(1e6), (1e6 * 50) / t.torsion.J);
  });
  it('chữ nhật: τmax = 1.5·Q/A', () => {
    const r = computeSection({ kind: 'rect', b: 100, h: 200 });
    const s = stressAt(r, { N: 0, Qy: 10, Qz: 0, T: 0, Mz: 0, My: 0 }, STEEL, 0, 0);
    close(s.tauQy, (1.5 * 10e3) / (100 * 200));
  });
});

describe('Nhận biết dạng chịu lực', () => {
  it('uốn thuần tuý giữa hai lực đối xứng', () => {
    const r = analyze(base({
      supports: [support('A', 0, 'pin'), support('B', 6, 'roller')],
      loads: [force('P1', 2, -10), force('P2', 4, -10)],
    }));
    const c = classify(r);
    expect(c.regions.map((g) => g.label)).toEqual(['Uốn ngang phẳng', 'Uốn thuần tuý', 'Uốn ngang phẳng']);
  });
  it('kéo đúng tâm', () => {
    const c = classify(analyze(base({ supports: [support('A', 0, 'fixed')], loads: [force('P', 6, 0, 10)] })));
    expect(c.regions[0].label).toBe('Kéo đúng tâm');
  });
  it('trục chịu uốn + xoắn', () => {
    const r = analyze(PRESETS.find((p) => p.key === 'shaft')!.build());
    expect(r.ok).toBe(true);
    const c = classify(r);
    expect(c.kinds.some((k) => k.includes('xoắn'))).toBe(true);
    expect(c.kinds.some((k) => k.toLowerCase().includes('uốn xiên'))).toBe(true);
  });
  it('cột nén + uốn là chịu lực phức tạp', () => {
    const c = classify(analyze(PRESETS.find((p) => p.key === 'column')!.build()));
    expect(c.regions[0].label).toBe('Nén + uốn ngang phẳng');
    expect(c.regions[0].complex).toBe(true);
  });
  it('mô men tập trung: hệ quy ước dấu', () => {
    const r = analyze(base({ length: 2, supports: [support('A', 0, 'fixed')], loads: [moment('M', 2, 10)] }));
    // Mô men ngược chiều kim đồng hồ ở đầu tự do bên phải → căng thớ dưới (M > 0)
    close(r.internalAt(1, 'left').Mz, 10);
  });
});

import { fmt } from '../src/core/stress';
describe('Định dạng số', () => {
  it('không xoá số 0 của phần nguyên', () => {
    expect(fmt(80, 0)).toBe('80');
    expect(fmt(100, 0)).toBe('100');
    expect(fmt(80.2, 0)).toBe('80');
    expect(fmt(1.50, 2)).toBe('1.5');
    expect(fmt(2000, 1)).toBe('2000');
  });
});
