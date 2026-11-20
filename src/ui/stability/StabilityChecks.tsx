import { useMemo, useState } from 'react';
import type { AnalysisResult } from '../../core/analysis';
import { memberLocal, withYield, type FrameModel, type FrameResult } from '../../core/frame';
import { aeffIfClass4 } from '../../core/effective';
import { DEFAULT_LOCAL, type LocalOptions } from '../../core/localBuckling';
import { BUCKLING_MATERIALS, beamEquivalentAxial, checkStability, type BucklingMaterial } from '../../core/stability';
import { beamAxialCheck, type BeamStabParams } from '../../core/beamAxial';
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
  /** cột có kể trọng lượng bản thân dọc trục: N là lực ở đỉnh (đã trừ G) */
  selfWeight?: boolean;
}

export function BeamStabilityCard({ res, model, onOpen, local = DEFAULT_LOCAL, params, setParams }: {
  res: AnalysisResult; model: Model; onOpen: (r: StabOpenRequest) => void; local?: LocalOptions;
  params: BeamStabParams; setParams: (p: BeamStabParams) => void;
}) {
  const eq = useMemo(() => (res.ok ? beamEquivalentAxial(model, res) : null), [model, res]);
  if (!res.ok || !res.section) return null;
  const c = beamAxialCheck(model, res, res.section, params, local, eq);
  if (!c) return null;
  const { r } = c;
  const varying = !!c.eq?.varying;
  const allow = model.material.allowable;
  const Nlbl = varying ? 'N_tđ' : 'N';
  return (
    <Card title="Kiểm tra ổn định (thanh có lực nén)">
      <div className="row">
        <Select label="μ" value={params.muAuto ? 'auto' : 'manual'} onChange={(v) => setParams({ ...params, muAuto: v === 'auto', mu: v === 'manual' && params.muAuto ? c.muZ : params.mu })}
          options={[{ value: 'auto', label: 'tự động (theo gối tựa của mô hình)' }, { value: 'manual', label: 'nhập tay' }]} />
        {params.muAuto && c.auto ? (
          <span className="hint">μ_z = {fmt(c.muZ, 3)}; μ_y = {fmt(c.muY, 3)}</span>
        ) : (
          <>
            <NumField label="μ" value={params.mu} width={80} onChange={(v) => setParams({ ...params, mu: v })} />
            <button onClick={() => setParams({ ...params, mu: guessMu(model) })} title="Đoán từ liên kết hai đầu">đoán ({guessMu(model)})</button>
          </>
        )}
        <Select label="Bảng φ" value={params.mat} onChange={(v) => setParams({ ...params, mat: v })}
          options={(Object.keys(BUCKLING_MATERIALS) as BucklingMaterial[]).map((k) => ({ value: k, label: BUCKLING_MATERIALS[k].label }))} />
        <NumField label="[n_ôđ]" value={params.nReq} width={80} onChange={(v) => setParams({ ...params, nReq: v })} />
      </div>
      <table className="kv wide">
        <tbody>
          <tr><th>Lực nén lớn nhất N_max</th><td>{fmt(c.Nmax, 2)} kN{c.G > 0 ? ` (có trọng lượng bản thân G = ${fmt(c.G, 3)} kN)` : ''}</td></tr>
          {varying && c.eq && (
            <>
              <tr><th>Lực nén đều tương đương N_tđ</th><td><b>{fmt(c.Ncheck, 2)} kN</b> = N_th,đều/α_th ({fmt((c.Ncheck / c.Nmax) * 100, 1)}% N_max) — lực nén thay đổi dọc thanh</td></tr>
              <tr><th>Bền tại mặt cắt nén lớn nhất N_max/A ≤ [σ]</th><td className={c.okBase ? 'good' : 'bad'}>{fmt(c.sigBase, 2)} {c.okBase ? '≤' : '>'} {allow} MPa</td></tr>
            </>
          )}
          {c.eq && <tr><th>Hệ số tới hạn α_th (tải thật)</th><td>{c.eq.planes.map((q) => `${q.plane}: ${fmt(q.alpha, 3)}`).join('; ')} → P_th thực = α_th·N_max = {fmt(Math.min(...c.eq.planes.map((q) => q.alpha)) * c.Nmax, 1)} kN (Euler, chưa xét đàn – dẻo)</td></tr>}
          <tr><th>λ_max = μL/i_min</th><td>{fmt(r.lambdaMax, 2)} ({REG[r.regime]})</td></tr>
          <tr><th>σ_th · P_th</th><td>{fmt(r.sigmaCr, 2)} MPa · {fmt(r.Pcr, 2)} kN</td></tr>
          <tr><th>n_ôđ = P_th/{Nlbl}</th><td className={r.okN ? 'good' : 'bad'}>{fmt(r.nActual, 3)}</td></tr>
          <tr><th>σ = {Nlbl}/A ≤ φ[σ]</th><td className={r.okPhi ? 'good' : 'bad'}>{fmt(r.sigma, 2)} {r.okPhi ? '≤' : '>'} {r.phi === null ? '—' : `${fmt(r.phi, 3)}·${allow} = ${fmt(r.allowPhi, 2)}`} MPa</td></tr>
        </tbody>
      </table>
      <p className={c.ok ? 'ok' : 'error'}>{c.ok ? 'Thanh đủ ổn định.' : 'Thanh KHÔNG đủ ổn định.'}</p>
      {r.warnings.map((w, i) => <p key={i} className="warn">{w}</p>)}
      {!c.eq && params.muAuto && <p className="hint">Không giải được bài toán trị riêng cho mô hình này — dùng μ nhập tay.</p>}
      {c.eq && <details><summary>Lời giải lực nén tương đương và μ</summary><ul className="steps">{c.eq.steps.map((l, i) => <li key={i}>{l}</li>)}</ul></details>}
      {model.selfWeight === 'y' && (
        <p className="hint">Trọng lượng bản thân đang tác dụng ngang (−y); nếu đây là cột đứng, chọn “cột đứng, chân tại x = 0” ở phần tải trọng để kể đúng lực dọc.</p>
      )}
      {res.forceSamples.some((s) => s.Mz !== 0 || s.My !== 0) && (
        <p className="hint">Thanh chịu nén kèm uốn: kiểm tra trên chỉ xét nén đúng tâm; cần kiểm tra thêm nén – uốn đồng thời.</p>
      )}
      <button onClick={() => {
        // chỉ có lực ở đỉnh + trọng lượng bản thân → mục Ổn định tự kể G; trường hợp khác chuyển N_tđ và μ tương ứng
        const tol = 1e-6 * Math.max(1, model.length);
        const otherAxial = model.loads.some((l) => (l.type === 'force' && l.Fx !== 0 && l.x < model.length - tol) || (l.type === 'distributed' && l.dir === 'x'));
        const swOnly = model.selfWeight === 'x' && !otherAxial;
        const Ntop = Math.max(0, -res.internalAt(model.length, 'left').N);
        onOpen({ N: swOnly ? Ntop : varying ? c.Ncheck : c.Nmax, L: model.length, mu: c.muZ, section: model.section, material: model.material, title: model.title, selfWeight: swOnly });
      }}>
        Mở chi tiết trong mục Ổn định →
      </button>
    </Card>
  );
}

export function FrameStabilityCard({ res, model, mu, setMu, local = DEFAULT_LOCAL }: {
  local?: LocalOptions;
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
              const EI = mr.material.E * 1e9 * mr.section.Iz * 1e-12;
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
                N: Nc, Lz: mr.L, Ly: mr.L, muZ: m, muY: m, E: mr.material.E, allowable: mr.material.allowable,
                params: withYield(BUCKLING_MATERIALS[mat], memberLocal(local, model.members.find((x) => x.id === mr.id), mr.material).fy), nRequired: 1, Aeff: aeffIfClass4(mr.sectionSpec, mr.material, memberLocal(local, model.members.find((x) => x.id === mr.id), mr.material).fy, memberLocal(local, model.members.find((x) => x.id === mr.id), mr.material).stiffenerSpacing),
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
