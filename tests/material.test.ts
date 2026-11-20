import { describe, expect, it } from 'vitest';
import { checkFrameMember, frameAnalyses } from '../src/core/beamColumn';
import { designFrame } from '../src/core/design';
import { analyzeFrame, memberLocal, memberMaterial, type FrameModel } from '../src/core/frame';
import { fmember, fnode, fnodeLoad, fsupport } from '../src/core/framePresets';
import { STEEL } from '../src/core/presets';
import { BUCKLING_MATERIALS } from '../src/core/stability';

const S = { id: 's', name: 's', spec: { kind: 'catalog', family: 'H_JIS', name: 'H300×300×10×15', rotate: false } as const };
const HI = { id: 'hi', name: 'Thép S355', E: 200, nu: 0.3, allowable: 210, fy: 345 };
const STIFF = { id: 'st', name: 'Cứng gấp đôi', E: 400, nu: 0.3, allowable: 160 };

const portal = (matAC?: string, matBD?: string): FrameModel => {
  const A = fnode('A', 0, 0), C = fnode('C', 0, 4), D = fnode('D', 6, 4), B = fnode('B', 6, 0);
  return {
    title: '', material: { ...STEEL }, materials: [HI, STIFF], sections: [S], nodes: [A, C, D, B],
    members: [{ ...fmember('AC', A, C, 's'), materialId: matAC }, fmember('CD', C, D, 's'), { ...fmember('BD', B, D, 's'), materialId: matBD }],
    supports: [fsupport(A, 'fixed'), fsupport(B, 'fixed')], loads: [fnodeLoad('H', C, 50, -300), fnodeLoad('V', D, 0, -300)],
  };
};

describe('Vật liệu riêng từng thanh khung', () => {
  it('memberMaterial: chọn theo id, không có thì dùng vật liệu chung', () => {
    const m = portal('hi');
    expect(memberMaterial(m, m.members[0]).name).toBe('Thép S355');
    expect(memberMaterial(m, m.members[1]).name).toBe(STEEL.name);
    expect(memberMaterial(m, { materialId: 'khong-co' }).name).toBe(STEEL.name);
  });
  it('f_y: riêng của thanh → của vật liệu → chung', () => {
    const g = { fy: 240, stiffenerSpacing: 0 };
    expect(memberLocal(g, {}, HI).fy).toBe(345);
    expect(memberLocal(g, { fy: 420 }, HI).fy).toBe(420);
    expect(memberLocal(g, {}, STIFF).fy).toBe(240);
  });
  it('E riêng ảnh hưởng phân phối nội lực: cột cứng hơn nhận lực ngang lớn hơn', () => {
    const same = analyzeFrame(portal());
    const stiff = analyzeFrame(portal('st'));
    expect(Math.abs(same.reactions[0].Rx)).toBeCloseTo(Math.abs(same.reactions[1].Rx), 0);
    expect(Math.abs(stiff.reactions[0].Rx)).toBeGreaterThan(Math.abs(stiff.reactions[1].Rx) * 1.3);
    expect(stiff.members[0].material.name).toBe('Cứng gấp đôi');
  });
  it('kiểm tra nén – uốn dùng [σ] của vật liệu thanh', () => {
    const m = portal('hi');
    const a = frameAnalyses(m, 1.5);
    const rAC = checkFrameMember(a, m.members[0].id, 1, m, BUCKLING_MATERIALS.CT3)!;
    const rBD = checkFrameMember(a, m.members[2].id, 1, m, BUCKLING_MATERIALS.CT3)!;
    expect(rAC.allowable).toBe(210);
    expect(rBD.allowable).toBe(160);
  });
  it('chọn tiết diện khung tính hệ số sử dụng theo [σ] từng thanh', () => {
    const opt = { family: 'H_JIS', rotate: false, deflRatio: 0, selfWeight: false, stability: false, mu: 1 };
    const base = designFrame(portal(), 's', opt);
    const hi = designFrame(portal('hi', 'hi'), 's', opt);
    // cột dùng thép [σ] cao hơn → cùng số hiệu, hệ số sử dụng không lớn hơn
    for (let i = 0; i < base.length; i++) expect(hi[i].util).toBeLessThanOrEqual(base[i].util + 1e-9);
    expect(hi.findIndex((c) => c.ok)).toBeLessThanOrEqual(base.findIndex((c) => c.ok));
  });
});
