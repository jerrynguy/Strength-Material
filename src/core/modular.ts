/**
 * Xe module thủy lực (hydraulic platform transporter): SPMT và pull type.
 * Công thức và số liệu theo thẻ tham khảo "Hydraulic Platform Transporters – Reference Card"
 * (The Works International / Industrial Training International), các trang 1–4:
 *  - Số trục dòng cần: tải / tải trọng một trục dòng (SPMT 30 t, pull type 25 t), làm tròn lên. Chưa kể hệ số động.
 *  - Lực kéo cần: (lực cản lăn % + độ dốc %) × tổng trọng lượng (hàng, xe module, gối kê, mâm xoay, dầm, PPU, xe kéo).
 *  - SPMT: số trục chủ động cần = lực kéo / lực đẩy một trục chủ động (5–7 t); PPU = số trục dòng / 10 × 100 HP.
 *  - Pull type: lực kéo tối đa của xe kéo = 80% trọng lượng trên các trục chủ động.
 *  - Hiệu ứng cân bằng: độ nghiêng = độ sâu hố / số trục trong nhóm treo.
 * Đơn vị: khối lượng và lực theo tấn (t, tấn lực), chiều dài m, độ sâu mm.
 */
import { fmt } from './stress';

export type ModType = 'spmt' | 'pull';

export interface ModTypeSpec {
  label: string;
  /** tải trọng một trục dòng (t) */
  payload: number;
  /** số lốp mỗi trục dòng */
  tires: number;
  /** khoảng cách tâm hai cụm bánh của trục dòng — module đơn / đôi (m) */
  axleBaseSingle: number;
  axleBaseDouble: number;
  /** khoảng cách các trục dòng (m) */
  axleSpacing: number;
  /** chiều cao sàn danh định và hành trình ± (m) */
  deckH: number;
  stroke: number;
}

/** Thông số theo trang 3 của thẻ tham khảo */
export const MOD_TYPES: Record<ModType, ModTypeSpec> = {
  spmt: { label: 'SPMT (tự hành)', payload: 30, tires: 4, axleBaseSingle: 1.45, axleBaseDouble: 2.9, axleSpacing: 1.4, deckH: 1.5, stroke: 0.3 },
  pull: { label: 'Pull type (kéo bằng xe đầu kéo)', payload: 25, tires: 8, axleBaseSingle: 1.8, axleBaseDouble: 3.3, axleSpacing: 1.5, deckH: 1.2, stroke: 0.3 },
};

/** Số trục chủ động của một module SPMT theo số trục dòng (trang 4): 4 trục dòng → 4; 6 trục dòng → 4; "super 6" → 6 */
export const DRIVE_AXLES_DEFAULT: Record<number, number> = { 4: 4, 6: 4 };

export interface ModUnit {
  /** số trục dòng của module */
  lines: number;
  /** số trục chủ động (chỉ SPMT) */
  drive: number;
}

export interface ModularInput {
  type: ModType;
  /** tải trọng một trục dòng (t) */
  payloadPerLine: number;
  /** tự trọng một trục dòng (t) */
  selfPerLine: number;
  /** khối lượng hàng (t) */
  load: number;
  /** gối kê, mâm xoay, dầm vận chuyển đặt trên xe (t) — tính vào tải đặt lên xe và tổng trọng lượng */
  accessories: number;
  /** PPU (t) — chỉ tính vào tổng trọng lượng khi tính lực kéo */
  ppu: number;
  /** cấu hình module; rỗng = tự lấy số trục dòng cần */
  units: ModUnit[];
  /** lực cản lăn (%) — đường nhựa khô 3% — và độ dốc (%) */
  rolling: number;
  grade: number;
  /** SPMT: lực đẩy một trục chủ động (t), 5,0–7,0 */
  propulsion: number;
  /** SPMT: công suất PPU cho mỗi 10 trục dòng (HP) */
  hpPer10: number;
  /** pull type: số xe kéo, trọng lượng trên các trục chủ động của mỗi xe kéo (t), tự trọng mỗi xe kéo (t) */
  trucks: number;
  truckDriveWeight: number;
  truckWeight: number;
  /** hiệu ứng cân bằng: độ sâu hố (mm) và số trục trong nhóm treo đi qua hố */
  pothole: number;
  axlesPerGroup: number;
}

export const defaultModular = (type: ModType = 'spmt'): ModularInput => ({
  type,
  payloadPerLine: MOD_TYPES[type].payload,
  selfPerLine: 3.5,
  load: 350,
  accessories: 0,
  ppu: 0,
  units: type === 'spmt' ? [{ lines: 6, drive: 4 }, { lines: 4, drive: 4 }, { lines: 4, drive: 4 }] : [],
  rolling: 3,
  grade: 8,
  propulsion: 5,
  hpPer10: 100,
  trucks: 1,
  truckDriveWeight: 18,
  truckWeight: 25,
  pothole: 300,
  axlesPerGroup: 2,
});

export interface ModCheck {
  label: string;
  value: string;
  ok: boolean | null;
}

export interface ModularResult {
  spec: ModTypeSpec;
  /** tải đặt lên xe = hàng + gối kê/dầm (t) */
  payload: number;
  linesReq: number;
  lines: number;
  /** tỉ lệ tải trên các trục dòng */
  uc: number;
  /** tải trung bình một trục dòng (t) */
  perLine: number;
  /** tổng trọng lượng (t) */
  gvw: number;
  /** lực kéo cần (tấn lực) */
  effort: number;
  driveReq: number | null;
  driveAvail: number | null;
  ppuHp: number | null;
  ppuKw: number | null;
  /** pull type: lực kéo tối đa của các xe kéo (tấn lực) và số xe kéo cần */
  pullAvail: number | null;
  trucksReq: number | null;
  /** độ nghiêng khi một nhóm treo đi qua hố (mm) */
  lean: number;
  /** chiều dài sàn ước tính (m) */
  length: number;
  checks: ModCheck[];
  ok: boolean;
  steps: string[];
}

export function analyzeModular(mi: ModularInput): ModularResult {
  const spec = MOD_TYPES[mi.type];
  const spmt = mi.type === 'spmt';
  const steps: string[] = [];
  const payload = mi.load + mi.accessories;
  const pl = mi.payloadPerLine > 0 ? mi.payloadPerLine : spec.payload;
  const raw = payload / pl;
  const linesReq = Math.max(1, Math.ceil(raw - 1e-9));
  steps.push(`Tải đặt lên xe: hàng ${fmt(mi.load, 3)} + gối kê / dầm ${fmt(mi.accessories, 3)} = ${fmt(payload, 3)} t`);
  steps.push(`Số trục dòng cần: ${fmt(payload, 3)} / ${fmt(pl, 2)} t/trục dòng = ${fmt(raw, 3)} → ${linesReq} trục dòng (chưa kể hệ số động)`);
  const unitLines = mi.units.reduce((s, u) => s + Math.max(0, Math.round(u.lines)), 0);
  const lines = unitLines > 0 ? unitLines : linesReq;
  if (unitLines > 0) steps.push(`Cấu hình module: ${mi.units.map((u) => u.lines).join(' + ')} = ${lines} trục dòng`);
  const perLine = payload / lines;
  const uc = perLine / pl;
  steps.push(`Tải trung bình một trục dòng: ${fmt(payload, 3)} / ${lines} = ${fmt(perLine, 3)} t; tỉ lệ ${fmt(uc * 100, 1)}% của ${fmt(pl, 2)} t`);
  const trucksW = spmt ? 0 : Math.max(0, mi.trucks) * mi.truckWeight;
  const gvw = payload + lines * mi.selfPerLine + mi.ppu + trucksW;
  steps.push(`Tổng trọng lượng: hàng + gối kê/dầm + ${lines}·${fmt(mi.selfPerLine, 3)} (xe module) + PPU ${fmt(mi.ppu, 3)}${spmt ? '' : ` + xe kéo ${fmt(trucksW, 3)}`} = ${fmt(gvw, 3)} t`);
  const effort = ((mi.rolling + mi.grade) / 100) * gvw;
  steps.push(`Lực kéo cần: (${fmt(mi.rolling, 2)}% + ${fmt(mi.grade, 2)}%)·${fmt(gvw, 3)} = ${fmt(effort, 3)} t`);
  let driveReq: number | null = null, driveAvail: number | null = null, ppuHp: number | null = null, ppuKw: number | null = null;
  let pullAvail: number | null = null, trucksReq: number | null = null;
  const checks: ModCheck[] = [{ label: 'Tải trên trục dòng', value: `${fmt(perLine, 2)} / ${fmt(pl, 2)} t (${fmt(uc * 100, 1)}%)`, ok: perLine <= pl + 1e-9 }];
  if (spmt) {
    driveReq = mi.propulsion > 0 ? Math.ceil(effort / mi.propulsion - 1e-9) : null;
    if (driveReq !== null) steps.push(`Số trục chủ động cần: ${fmt(effort, 3)} / ${fmt(mi.propulsion, 2)} t/trục = ${fmt(effort / mi.propulsion, 3)} → ${driveReq}`);
    if (unitLines > 0) {
      driveAvail = mi.units.reduce((s, u) => s + Math.max(0, Math.round(u.drive)), 0);
      steps.push(`Trục chủ động có: ${mi.units.map((u) => u.drive).join(' + ')} = ${driveAvail}`);
      if (driveReq !== null) checks.push({ label: 'Trục chủ động (lực kéo)', value: `có ${driveAvail} / cần ${driveReq}`, ok: driveAvail >= driveReq });
    }
    ppuHp = (lines / 10) * mi.hpPer10;
    ppuKw = ppuHp * 0.7457;
    steps.push(`Công suất PPU: ${lines} / 10 × ${fmt(mi.hpPer10, 1)} HP = ${fmt(ppuHp, 1)} HP (${fmt(ppuKw, 1)} kW)`);
  } else {
    const per = 0.8 * mi.truckDriveWeight;
    pullAvail = Math.max(0, mi.trucks) * per;
    trucksReq = per > 0 ? Math.ceil(effort / per - 1e-9) : null;
    steps.push(`Lực kéo tối đa mỗi xe kéo: 80% × ${fmt(mi.truckDriveWeight, 3)} t trên trục chủ động = ${fmt(per, 3)} t; ${mi.trucks} xe = ${fmt(pullAvail, 3)} t`);
    if (trucksReq !== null) steps.push(`Số xe kéo cần: ${fmt(effort, 3)} / ${fmt(per, 3)} = ${fmt(effort / per, 3)} → ${trucksReq}`);
    checks.push({ label: 'Lực kéo của xe kéo', value: `${fmt(pullAvail, 2)} t so với cần ${fmt(effort, 2)} t`, ok: pullAvail >= effort - 1e-9 });
  }
  const n = Math.max(1, Math.round(mi.axlesPerGroup));
  const lean = mi.pothole / n;
  steps.push(`Hiệu ứng cân bằng: độ nghiêng = độ sâu hố / số trục trong nhóm = ${fmt(mi.pothole, 1)} / ${n} = ${fmt(lean, 1)} mm (về phía nhóm đi qua hố)`);
  const length = lines * spec.axleSpacing;
  return {
    spec, payload, linesReq, lines, uc, perLine, gvw, effort, driveReq, driveAvail, ppuHp, ppuKw, pullAvail, trucksReq, lean, length,
    checks, ok: checks.every((c) => c.ok !== false), steps,
  };
}
