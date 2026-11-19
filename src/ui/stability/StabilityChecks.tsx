import { useState } from 'react';
import type { AnalysisResult } from '../../core/analysis';
import type { FrameModel, FrameResult } from '../../core/frame';
import { aeffIfClass4 } from '../../core/effective';
import { BUCKLING_MATERIALS, checkStability, type BucklingMaterial } from '../../core/stability';
import { fmt } from '../../core/stress';
import { effectiveRestraints, type Model, type SectionSpec } from '../../core/types';
import { Card, NumField, Select } from '../fields';

const REG = { euler: 'Euler', empirical: 'Iasinski', short: 'ngắn' };

/** Đoán hệ số μ từ liên kết hai đầu thanh */
export function guessMu(model: Model): number {
  const L = model.length;
  const tol = 1e-6 * Math.max(1, L);
  if (model.supports.some((s) => s.x > tol && s.x < L - tol)) return 1;
  const kind = (x: number) => {
    const arr = model.supports.filter((s) => Math.abs(s.x - x) <= tol);
    if (!arr.length) return 'free';
    return arr.some((s) => effectiveRestraints(s).rz) ? 'fixed' : 'pin';
  };
  const a = kind(0), b = kind(L);
  if ((a === 'fixed' && b === 'free') || (a === 'free' && b === 'fixed')) return 2;
  if (a === 'fixed' && b === 'fixed') return 0.5;
  if ((a === 'fixed' && b === 'pin') || (a === 'pin' && b === 'fixed')) return 0.7;
  return 1;
}

export interface StabOpenRequest {
  N: number;
  L: number;
  mu: number;
  section: SectionSpec;
  material: Model['material'];
  title: string;
}

export function BeamStabilityCard({ res, model, onOpen }: { res: AnalysisResult; model: Model; onOpen: (r: StabOpenRequest) => void }) {
  const [mu, setMu] = useState(() => guessMu(model));
  const [mat, setMat] = useState<BucklingMaterial>('CT3');
  const [nReq, setNReq] = useState(2);
  if (!res.ok || !res.section) return null;
  let Nc = 0;
  for (const s of res.forceSamples) Nc = Math.max(Nc, -s.N);
  if (!(Nc > 0)) return null;
  const r = checkStability(res.section, {
    N: Nc, Lz: model.length, Ly: model.length, muZ: mu, muY: mu, E: model.material.E, allowable: model.material.allowable,
    params: BUCKLING_MATERIALS[mat], nRequired: nReq, Aeff: aeffIfClass4(model.section, model.material, 240),
  });
  const ok = r.okPhi && r.okN;
  return (
    <Card title="Kiểm tra ổn định (thanh có lực nén)">
      <div className="row">
        <NumField label="μ (đoán từ liên kết)" value={mu} width={90} onChange={setMu} />
        <Select label="Bảng φ" value={mat} onChange={setMat}
          options={(Object.keys(BUCKLING_MATERIALS) as BucklingMaterial[]).map((k) => ({ value: k, label: BUCKLING_MATERIALS[k].label }))} />
        <NumField label="[n_ôđ]" value={nReq} width={80} onChange={setNReq} />
      </div>
      <table className="kv wide">
        <tbody>
          <tr><th>Lực nén lớn nhất N</th><td>{fmt(Nc, 2)} kN</td></tr>
          <tr><th>λ_max = μL/i_min</th><td>{fmt(r.lambdaMax, 2)} ({REG[r.regime]})</td></tr>
          <tr><th>σ_th · P_th</th><td>{fmt(r.sigmaCr, 2)} MPa · {fmt(r.Pcr, 2)} kN</td></tr>
          <tr><th>n_ôđ = P_th/N</th><td className={r.okN ? 'good' : 'bad'}>{fmt(r.nActual, 3)}</td></tr>
          <tr><th>σ = N/A ≤ φ[σ]</th><td className={r.okPhi ? 'good' : 'bad'}>{fmt(r.sigma, 2)} {r.okPhi ? '≤' : '>'} {r.phi === null ? '—' : `${fmt(r.phi, 3)}·${model.material.allowable} = ${fmt(r.allowPhi, 2)}`} MPa</td></tr>
        </tbody>
      </table>
      <p className={ok ? 'ok' : 'error'}>{ok ? 'Thanh đủ ổn định.' : 'Thanh KHÔNG đủ ổn định.'}</p>
      {r.warnings.map((w, i) => <p key={i} className="warn">{w}</p>)}
      {res.forceSamples.some((s) => s.Mz !== 0 || s.My !== 0) && (
        <p className="hint">Thanh chịu nén kèm uốn: kiểm tra trên chỉ xét nén đúng tâm; cần kiểm tra thêm nén – uốn đồng thời.</p>
      )}
      <button onClick={() => onOpen({ N: Nc, L: model.length, mu, section: model.section, material: model.material, title: model.title })}>
        Mở chi tiết trong mục Ổn định →
      </button>
    </Card>
  );
}

export function FrameStabilityCard({ res, model, mu, setMu }: {
  res: FrameResult;
  model: FrameModel;
  mu: Record<string, number>;
  setMu: (m: Record<string, number>) => void;
}) {
  const [mat, setMat] = useState<BucklingMaterial>('CT3');
  const rows = res.members
    .map((mr) => {
      let Nc = 0;
      for (const s of mr.samples) Nc = Math.max(Nc, -s.N);
      return { mr, Nc };
    })
    .filter((x) => x.Nc > 1e-9);
  if (!rows.length) return null;
  return (
    <Card title="Kiểm tra ổn định các thanh chịu nén">
      <div className="row">
        <Select label="Bảng φ" value={mat} onChange={setMat}
          options={(Object.keys(BUCKLING_MATERIALS) as BucklingMaterial[]).map((k) => ({ value: k, label: BUCKLING_MATERIALS[k].label }))} />
        {res.buckling && (
          <button onClick={() => {
            const next = { ...mu };
            for (const { mr, Nc } of rows) {
              const EI = model.material.E * 1e9 * mr.section.Iz * 1e-12;
              next[mr.id] = Math.round(((Math.PI / mr.L) * Math.sqrt(EI / (res.buckling!.alpha * Nc * 1e3))) * 1000) / 1000;
            }
            setMu(next);
          }}>Lấy μ từ phân tích ổn định khung (α_th = {fmt(res.buckling.alpha, 2)})</button>
        )}
      </div>
      <div className="table-scroll">
        <table className="grid">
          <thead><tr><th>Thanh</th><th>N nén (kN)</th><th>L (m)</th><th>μ</th><th>λ</th><th>φ</th><th>σ (MPa)</th><th>φ[σ] (MPa)</th><th>P_th (kN)</th><th>Kết luận</th></tr></thead>
          <tbody>
            {rows.map(({ mr, Nc }) => {
              const m = mu[mr.id] ?? 1;
              const r = checkStability(mr.section, {
                N: Nc, Lz: mr.L, Ly: mr.L, muZ: m, muY: m, E: model.material.E, allowable: model.material.allowable,
                params: BUCKLING_MATERIALS[mat], nRequired: 1, Aeff: aeffIfClass4(mr.sectionSpec, model.material, 240),
              });
              return (
                <tr key={mr.id}>
                  <td><b>{mr.name}</b></td>
                  <td>{fmt(Nc, 2)}</td>
                  <td>{fmt(mr.L, 3)}</td>
                  <td><NumField value={m} width={64} onChange={(v) => setMu({ ...mu, [mr.id]: v })} /></td>
                  <td>{fmt(r.lambdaMax, 1)}</td>
                  <td>{r.phi === null ? '—' : fmt(r.phi, 3)}</td>
                  <td>{fmt(r.sigma, 2)}</td>
                  <td>{fmt(r.allowPhi, 2)}</td>
                  <td>{fmt(r.Pcr, 1)}</td>
                  <td className={r.okPhi ? 'good' : 'bad'}>{r.okPhi ? 'đạt ✓' : 'không đạt ✗'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="hint">
        μ mặc định = 1 (đầu thanh không chuyển vị ngang tương đối). Với khung có chuyển vị ngang (không giằng), bấm “Lấy μ từ phân tích ổn
        định khung” để dùng μ tính từ hệ số tới hạn α_th (μ trong mặt phẳng; bảng này dùng chung μ cho cả trục yếu — thiên về an toàn).
        Kiểm tra nén – uốn xem ở thẻ bên dưới.
      </p>
    </Card>
  );
}
