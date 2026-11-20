/**
 * Kiểm tra ổn định nén đúng tâm cho chế độ "thanh thẳng", dùng chung cho thẻ kiểm tra, báo cáo PDF và chọn tiết diện.
 * Lực nén thay đổi dọc thanh (lực đặt giữa thân, tải dọc phân bố, trọng lượng bản thân) được quy về lực nén đều
 * tương đương N_tđ = N_th,đều/α_th; μ có thể lấy tự động từ bài toán trị riêng (đúng gối tựa của mô hình) hoặc nhập tay.
 */
import type { AnalysisResult } from './analysis';
import { aeffIfClass4 } from './effective';
import { DEFAULT_LOCAL, type LocalOptions } from './localBuckling';
import type { SectionProps } from './section';
import { BUCKLING_MATERIALS, beamEquivalentAxial, checkStability, type BucklingMaterial, type EquivalentAxial, type StabilityResult } from './stability';
import { selfWeightPerM, type Model } from './types';

export interface BeamStabParams {
  /** μ lấy tự động từ phân tích ổn định của mô hình (đúng gối tựa) */
  muAuto: boolean;
  /** μ nhập tay (khi muAuto = false) */
  mu: number;
  mat: BucklingMaterial;
  nReq: number;
  /** hệ số an toàn và bảng φ cho thẻ nén – uốn */
  bcN: number;
  bcMat: BucklingMaterial;
}
export const DEFAULT_BEAM_STAB: BeamStabParams = { muAuto: true, mu: 1, mat: 'CT3', nReq: 2, bcN: 1.5, bcMat: 'CT3' };

export interface BeamAxialCheck {
  /** lực nén lớn nhất dọc thanh (kN) */
  Nmax: number;
  /** lực dùng kiểm tra ổn định (kN) */
  Ncheck: number;
  eq: EquivalentAxial | null;
  muZ: number;
  muY: number;
  /** μ lấy từ phân tích (true) hay nhập tay / đoán (false) */
  auto: boolean;
  /** trọng lượng bản thân (kN) nếu có tải bản thân dọc trục */
  G: number;
  /** σ = N_max/A tại mặt cắt nén lớn nhất (MPa) — cần kiểm tra bền khi N thay đổi */
  sigBase: number;
  okBase: boolean;
  r: StabilityResult;
  ok: boolean;
}

export function beamAxialCheck(
  model: Model, res: AnalysisResult, sec: SectionProps, p: Pick<BeamStabParams, 'muAuto' | 'mu' | 'mat' | 'nReq'>,
  local: LocalOptions = DEFAULT_LOCAL, eqIn?: EquivalentAxial | null,
): BeamAxialCheck | null {
  if (!res.ok) return null;
  let Nmax = 0;
  for (const s of res.forceSamples) Nmax = Math.max(Nmax, -s.N);
  if (!(Nmax > 0)) return null;
  const eq = eqIn !== undefined ? eqIn : beamEquivalentAxial(model, res);
  const pz = eq?.planes.find((q) => q.plane === 'z');
  const py = eq?.planes.find((q) => q.plane === 'y');
  const auto = p.muAuto && !!eq;
  const muZ = auto ? round3(pz?.mu ?? py!.mu) : p.mu;
  const muY = auto ? round3(py?.mu ?? pz!.mu) : p.mu;
  const Ncheck = eq ? eq.Ntd : Nmax;
  const sigBase = (Nmax * 1e3) / sec.A;
  const r = checkStability(sec, {
    N: Ncheck, Lz: model.length, Ly: model.length, muZ, muY, E: model.material.E, allowable: model.material.allowable,
    params: BUCKLING_MATERIALS[p.mat], nRequired: p.nReq, Aeff: aeffIfClass4(model.section, model.material, local.fy, local.stiffenerSpacing),
  });
  const okBase = sigBase <= model.material.allowable;
  const G = model.selfWeight === 'x' ? selfWeightPerM(model.material, sec.A) * model.length : 0;
  return { Nmax, Ncheck, eq, muZ, muY, auto, G, sigBase, okBase, r, ok: r.okPhi && r.okN && (!eq?.varying || okBase) };
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
