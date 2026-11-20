import { describe, expect, it } from 'vitest';
import { analyze } from '../src/core/analysis';
import { checkLTB } from '../src/core/ltb';
import { STEEL, dist, support } from '../src/core/presets';
import { computeSection, plasticAlpha, plasticProps } from '../src/core/section';
import type { Model, SectionSpec } from '../src/core/types';

const rel = (a: number, b: number) => Math.abs(a / b - 1);

describe('Mô men kháng dẻo W_pl và tương tác dẻo N–M', () => {
  it('chữ nhật: W_pl = bh²/4, hệ số hình dạng 1.5, M_N = M_pl(1 − n²)', () => {
    const sec = computeSection({ kind: 'rect', b: 100, h: 200 });
    const p = plasticProps(sec);
    expect(p.Wpl).toBeCloseTo((100 * 200 ** 2) / 4, 3);
    expect(p.shape).toBeCloseTo(1.5, 6);
    expect(p.pna).toBeCloseTo(0, 6);
    for (const q of p.curvePos) expect(q.w).toBeCloseTo(p.Wpl * (1 - q.n * q.n), 2);
    // trục yếu
    expect(plasticProps(sec, 'y').Wpl).toBeCloseTo((200 * 100 ** 2) / 4, 3);
  });
  it('chữ I hàn đối xứng: W_pl = 2·b·t_f(h_w + t_f)/2 + t_w·h_w²/4', () => {
    const s: SectionSpec = { kind: 'I', bt: 200, tt: 12, hw: 400, tw: 8, bb: 200, tb: 12 };
    const p = plasticProps(computeSection(s));
    expect(p.Wpl).toBeCloseTo(200 * 12 * (400 + 12) + (8 * 400 ** 2) / 4, 2);
  });
  it('chữ T (đối xứng một trục): trục trung hoà dẻo chia đôi diện tích', () => {
    // cánh 200×20 ở trên, bụng 10×180
    const sec = computeSection({ kind: 'T', b: 200, tf: 20, hw: 180, tw: 10 });
    const p = plasticProps(sec);
    // A = 4000 + 1800 = 5800 → PNA trong cánh: (đỉnh − y)·200 = 2900 → cách đỉnh 14.5 mm
    const yTopFromBase = 200, pnaFromBase = yTopFromBase - 14.5;
    const ycFromBase = -sec.yMin;
    expect(p.pna).toBeCloseTo(pnaFromBase - ycFromBase, 6);
    const Wpl = 200 * 14.5 * (14.5 / 2) + 200 * 5.5 * (5.5 / 2) + 10 * 180 * (5.5 + 90);
    expect(rel(p.Wpl, Wpl)).toBeLessThan(1e-9);
  });
  it('ống tròn đặc: W_pl = D³/6 (đa giác hoá)', () => {
    const p = plasticProps(computeSection({ kind: 'circle', D: 100 }));
    expect(rel(p.Wpl, 100 ** 3 / 6)).toBeLessThan(2e-3);
  });
  it('α dẻo của chữ nhật với (N, M): α²n² + α·m = 1', () => {
    const sec = computeSection({ kind: 'rect', b: 100, h: 200 });
    const fy = 235;
    const N = 1500, M = 120; // kN, kN·m
    const n = (N * 1e3) / (sec.A * fy), m = (M * 1e6) / (((100 * 200 ** 2) / 4) * fy);
    const exact = (-m + Math.sqrt(m * m + 4 * n * n)) / (2 * n * n);
    expect(rel(plasticAlpha(sec, N, M, fy), exact)).toBeLessThan(2e-3);
    expect(plasticAlpha(sec, 0, M, fy)).toBeCloseTo(1 / m, 6);
    expect(plasticAlpha(sec, -N, 0, fy)).toBeCloseTo(1 / n, 6);
  });
});

describe('Uốn – xoắn dùng W theo loại tiết diện', () => {
  const beam = (section: SectionSpec): Model => ({
    title: '', length: 6, material: { ...STEEL }, section, supports: [support('A', 0, 'pin'), support('B', 6, 'roller')], hinges: [], loads: [dist('q', 0, 6, -20)],
  });
  it('IPE 300 loại 1 → W_pl', () => {
    const m = beam({ kind: 'catalog', family: 'IPE', name: 'IPE 300', rotate: false });
    const r = checkLTB(m, analyze(m), { loadHeight: 'sc', braces: [], fy: 235, curve: 'auto' });
    expect(r.sectionClass).toBe(1);
    expect(r.wKind).toBe('W_pl');
    expect(r.W).toBeCloseTo(plasticProps(computeSection(m.section)).Wpl, 6);
    expect(r.Wpl / r.Wel).toBeGreaterThan(1.1);
    expect(r.Mrd).toBeCloseTo((r.chi * r.Wpl * STEEL.allowable) / 1e6, 6);
  });
  it('cánh mảnh loại 3 → W_el', () => {
    // c/t cánh = 146/12 = 12.2: 10ε < c/t ≤ 14ε (f_y 235) → loại 3
    const m = beam({ kind: 'I', bt: 300, tt: 12, hw: 400, tw: 8, bb: 300, tb: 12 });
    const r = checkLTB(m, analyze(m), { loadHeight: 'sc', braces: [], fy: 235, curve: 'auto' });
    expect(r.sectionClass).toBe(3);
    expect(r.wKind).toBe('W_el');
    expect(r.W).toBeCloseTo(r.Wel, 6);
  });
});
