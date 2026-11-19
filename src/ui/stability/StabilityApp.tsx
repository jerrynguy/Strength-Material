import { useMemo, useState } from 'react';
import { computeSection, validateSection } from '../../core/section';
import {
  BUCKLING_MATERIALS, END_CONDITIONS, checkStability, criticalStress, lambda1, trialDesign,
  type BucklingMaterial, type BucklingParams, type StabilityResult,
} from '../../core/stability';
import { STEEL_FAMILIES } from '../../core/steelTables';
import { fmt } from '../../core/stress';
import type { Material, SectionSpec } from '../../core/types';
import { MaterialRow, SectionSpecEditor } from '../editors';
import { aeffIfClass4 } from '../../core/effective';
import { Card, NumField, Select, TextField } from '../fields';
import { BucklingChart } from './BucklingChart';
import { LocalCard } from './LocalCard';

export interface StabModel {
  title: string;
  N: number;
  L: number;
  Ly: number;
  sameL: boolean;
  muZ: number;
  muY: number;
  material: Material;
  mat: BucklingMaterial | 'custom';
  params: BucklingParams;
  nReq: number;
  section: SectionSpec;
}

export const defaultStabModel = (): StabModel => ({
  title: 'Cột chịu nén đúng tâm',
  N: 300, L: 4, Ly: 4, sameL: true, muZ: 1, muY: 1,
  material: { name: 'Thép CT3', E: 200, nu: 0.3, allowable: 160 },
  mat: 'CT3', params: { ...BUCKLING_MATERIALS.CT3, phi: [...BUCKLING_MATERIALS.CT3.phi] }, nReq: 2,
  section: { kind: 'catalog', family: 'I_GOST', name: 'I22', rotate: false },
});

export const STAB_PRESETS: { key: string; label: string; build: () => StabModel }[] = [
  { key: 'col-I', label: 'Cột thép I chịu nén đúng tâm, khớp hai đầu', build: defaultStabModel },
  {
    key: 'euler', label: 'Thanh tròn mảnh (vùng Euler)',
    build: () => ({ ...defaultStabModel(), title: 'Thanh tròn D40, L = 2 m', N: 20, L: 2, Ly: 2, section: { kind: 'circle', D: 40 } }),
  },
  {
    key: 'cant', label: 'Cột công-xôn ống tròn (μ = 2)',
    build: () => ({ ...defaultStabModel(), title: 'Cột công-xôn ống thép', N: 150, L: 3, Ly: 3, muZ: 2, muY: 2, section: { kind: 'catalog', family: 'CHS', name: 'Ø168.3×6.3', rotate: false } }),
  },
  {
    key: 'braced', label: 'Cột H có giằng theo phương yếu (L khác nhau hai phương)',
    build: () => ({ ...defaultStabModel(), title: 'Cột H có giằng giữa cột', N: 800, L: 6, Ly: 3, sameL: false, section: { kind: 'catalog', family: 'H_JIS', name: 'H200×200×8×12', rotate: false } }),
  },
  {
    key: 'angle', label: 'Thanh dàn thép góc (trục quán tính chính)',
    build: () => ({ ...defaultStabModel(), title: 'Thanh dàn L75×6', N: 60, L: 1.8, Ly: 1.8, section: { kind: 'catalog', family: 'L_GOST', name: 'L75×6', rotate: false } }),
  },
  {
    key: 'wood', label: 'Cột gỗ tiết diện chữ nhật',
    build: () => ({
      ...defaultStabModel(), title: 'Cột gỗ 150×150', N: 80, L: 3, Ly: 3,
      material: { name: 'Gỗ nhóm V', E: 10, nu: 0.3, allowable: 12 }, mat: 'wood', params: { ...BUCKLING_MATERIALS.wood, phi: [...BUCKLING_MATERIALS.wood.phi] },
      section: { kind: 'rect', b: 150, h: 150 },
    }),
  },
];

const REGIME = { euler: 'Thanh mảnh — Euler', empirical: 'Thanh vừa — Iasinski', short: 'Thanh ngắn — tính theo bền (σ_ch)' };

function MuSelect({ label, mu, onChange }: { label: string; mu: number; onChange: (m: number) => void }) {
  const key = END_CONDITIONS.find((e) => e.mu === mu)?.key ?? 'custom';
  return (
    <>
      <Select label={label} value={key} onChange={(k) => { const e = END_CONDITIONS.find((x) => x.key === k); if (e) onChange(e.mu); }}
        options={[...END_CONDITIONS.map((e) => ({ value: e.key, label: e.label })), ...(key === 'custom' ? [{ value: 'custom', label: 'Tuỳ chỉnh' }] : [])]} />
      <NumField label="μ" value={mu} width={70} onChange={onChange} />
    </>
  );
}

export function StabilityApp({ model, setModel }: { model: StabModel; setModel: (fn: (m: StabModel) => StabModel) => void }) {
  const set = (p: Partial<StabModel>) => setModel((m) => ({ ...m, ...p }));
  const err = validateSection(model.section);
  const sec = useMemo(() => (err ? null : computeSection(model.section)), [model.section, err]);
  const inp = {
    N: model.N, Lz: model.L, Ly: model.sameL ? model.L : model.Ly, muZ: model.muZ, muY: model.muY,
    E: model.material.E, allowable: model.material.allowable, params: model.params, nRequired: model.nReq,
    Aeff: sec ? aeffIfClass4(model.section, model.material, 240) : undefined,
  };
  const r = sec ? checkStability(sec, inp) : null;
  return (
    <main className="layout">
      <div className="col-edit">
        <Card title="Thanh chịu nén">
          <div className="row">
            <TextField label="Tên bài toán" value={model.title} width={260} onChange={(v) => set({ title: v })} />
          </div>
          <div className="row">
            <NumField label="Lực nén N" unit="kN" value={model.N} onChange={(v) => set({ N: v })} />
            <NumField label="Chiều dài L" unit="m" value={model.L} onChange={(v) => set({ L: v })} />
            <label className="check"><input type="checkbox" checked={!model.sameL} onChange={(e) => set({ sameL: !e.target.checked, Ly: model.L })} />chiều dài khác nhau theo hai phương (có giằng)</label>
          </div>
          <div className="row">
            <MuSelect label="Liên kết – uốn quanh trục z" mu={model.muZ} onChange={(v) => set({ muZ: v })} />
          </div>
          <div className="row">
            <MuSelect label="Liên kết – uốn quanh trục y" mu={model.muY} onChange={(v) => set({ muY: v })} />
            {!model.sameL && <NumField label="L theo phương y" unit="m" value={model.Ly} onChange={(v) => set({ Ly: v })} />}
          </div>
          <p className="hint">μ: hệ số chiều dài tính toán. Trục z nằm ngang (uốn trong mặt phẳng đứng), trục y thẳng đứng của mặt cắt.</p>
        </Card>
        <Card title="Vật liệu & tiêu chuẩn ổn định">
          <MaterialRow m={model.material} setMat={(p) => set({ material: { ...model.material, ...p } })} />
          <div className="row">
            <Select label="Bảng φ / hệ số Iasinski" value={model.mat}
              onChange={(k) => k === 'custom' ? set({ mat: k }) : set({ mat: k, params: { ...BUCKLING_MATERIALS[k], phi: [...BUCKLING_MATERIALS[k].phi] } })}
              options={[...(Object.keys(BUCKLING_MATERIALS) as BucklingMaterial[]).map((k) => ({ value: k, label: BUCKLING_MATERIALS[k].label })), { value: 'custom', label: 'Tuỳ chỉnh' }]} />
            <NumField label="[n_ôđ]" value={model.nReq} width={80} onChange={(v) => set({ nReq: v })} />
          </div>
          <div className="row">
            <NumField label="λ₀" value={model.params.lambda0} width={80} onChange={(v) => set({ mat: 'custom', params: { ...model.params, lambda0: v } })} />
            <NumField label="a" unit="MPa" value={model.params.a} width={100} onChange={(v) => set({ mat: 'custom', params: { ...model.params, a: v } })} />
            <NumField label="b" unit="MPa" value={model.params.b} width={100} onChange={(v) => set({ mat: 'custom', params: { ...model.params, b: v } })} />
            <NumField label="c" unit="MPa" value={model.params.c} width={100} onChange={(v) => set({ mat: 'custom', params: { ...model.params, c: v } })} />
            <NumField label="σ_ch" unit="MPa" value={model.params.sigmaY} width={100} onChange={(v) => set({ mat: 'custom', params: { ...model.params, sigmaY: v } })} />
          </div>
          <p className="hint">
            σ_th = π²E/λ² khi λ ≥ λ₀; σ_th = a − bλ + cλ² khi λ &lt; λ₀ (Iasinski), không vượt σ_ch. Bảng φ theo giáo trình SBVL (tham khảo) — với
            “Tuỳ chỉnh” vẫn dùng bảng φ của vật liệu đã chọn trước đó.
          </p>
        </Card>
        <Card title="Mặt cắt ngang">
          <SectionSpecEditor spec={model.section} onChange={(s) => set({ section: s })} />
        </Card>
      </div>
      <div className="col-res">
        {r && sec ? (
          <>
            <ResultCard r={r} model={model} />
            <LocalCard spec={model.section} material={model.material} forces={[{ N: -model.N, Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0 }]} title="Ổn định cục bộ bản cánh, bản bụng (nén đúng tâm)" />
            <Card title="Đồ thị φ(λ) và σ_th(λ)">
              <Charts r={r} model={model} />
            </Card>
            <Card title="Lời giải từng bước">
              <ul className="steps">
                <li>A = {fmt(sec.A, 2)} mm²; I<sub>z</sub> = {fmt(sec.Iz, 0)} mm⁴; I<sub>y</sub> = {fmt(sec.Iy, 0)} mm⁴</li>
                {r.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </Card>
            <TrialCard model={model} apply={(spec) => set({ section: spec })} />
          </>
        ) : (
          <Card title="Kết quả"><p className="error">Tiết diện chưa hợp lệ: {err}</p></Card>
        )}
      </div>
    </main>
  );
}

function ResultCard({ r, model }: { r: StabilityResult; model: StabModel }) {
  return (
    <Card title="Kết quả kiểm tra ổn định">
      <div className={`status ${r.okPhi && r.okN ? 'status-tinh-dinh' : 'status-bien-hinh'}`}>
        {r.okPhi && r.okN ? 'ĐỦ ỔN ĐỊNH' : r.okPhi ? 'ĐẠT theo φ, KHÔNG ĐẠT theo hệ số an toàn n_ôđ' : r.okN ? 'KHÔNG ĐẠT theo φ (đạt theo n_ôđ)' : 'KHÔNG ĐỦ ỔN ĐỊNH'} — {REGIME[r.regime]}
      </div>
      <table className="grid">
        <thead><tr><th>Phương</th><th>μ</th><th>L (m)</th><th>I (mm⁴)</th><th>i (mm)</th><th>λ</th></tr></thead>
        <tbody>
          {r.planes.map((p) => (
            <tr key={p.plane} className={p === r.governing ? 'sel-row' : ''}>
              <td>{p.plane}</td><td>{p.mu}</td><td>{fmt(p.L, 3)}</td><td>{fmt(p.I, 0)}</td><td>{fmt(p.i, 2)}</td><td><b>{fmt(p.lambda, 2)}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="kv wide">
        <tbody>
          <tr><th>Độ mảnh λ_max</th><td><b>{fmt(r.lambdaMax, 2)}</b> (λ₀ = {model.params.lambda0}{lambda1(model.params) ? `, λ₁ = ${fmt(lambda1(model.params), 1)}` : ''})</td></tr>
          <tr><th>Ứng suất tới hạn σ_th</th><td>{fmt(r.sigmaCr, 2)} MPa</td></tr>
          <tr><th>Lực tới hạn P_th</th><td>{fmt(r.Pcr, 2)} kN</td></tr>
          <tr><th>Hệ số an toàn ổn định n_ôđ = P_th/N</th><td className={r.okN ? 'good' : 'bad'}>{fmt(r.nActual, 3)} {r.okN ? '≥' : '<'} [n_ôđ] = {model.nReq}</td></tr>
          <tr><th>Hệ số giảm ứng suất φ</th><td>{r.phi === null ? '— (ngoài bảng)' : fmt(r.phi, 4)}</td></tr>
          <tr><th>σ = N/A so với φ[σ]</th><td className={r.okPhi ? 'good' : 'bad'}>{fmt(r.sigma, 2)} {r.okPhi ? '≤' : '>'} {fmt(r.allowPhi, 2)} MPa ({fmt((r.sigma / (r.allowPhi || 1)) * 100, 1)}%)</td></tr>
          <tr><th>Tải trọng cho phép [N] = φ[σ]A</th><td>{fmt(r.Nallow, 2)} kN</td></tr>
        </tbody>
      </table>
      {r.warnings.map((w, i) => <p key={i} className="warn">{w}</p>)}
    </Card>
  );
}

function Charts({ r, model }: { r: StabilityResult; model: StabModel }) {
  const p = model.params;
  const E = model.material.E * 1e3;
  const xMax = Math.max(200, Math.ceil(r.lambdaMax / 50) * 50);
  const phiCurve: [number, number][] = p.phi.map((v, i) => [i * 10, v]);
  const sigCurve: [number, number][] = [];
  for (let l = 1; l <= xMax; l += 1) sigCurve.push([l, criticalStress(p, E, l).sigma]);
  const l1 = lambda1(p);
  const marks = [{ x: p.lambda0, label: 'λ₀' }, ...(l1 ? [{ x: l1, label: 'λ₁' }] : [])];
  return (
    <div className="charts">
      <BucklingChart title="Hệ số φ theo độ mảnh" unit="—" curve={phiCurve} digits={3} marks={marks}
        point={r.phi !== null ? { x: r.lambdaMax, y: r.phi } : null} />
      <BucklingChart title="Ứng suất tới hạn σ_th" unit="MPa" curve={sigCurve} digits={1} marks={marks} tone="b"
        point={{ x: r.lambdaMax, y: r.sigmaCr }} />
    </div>
  );
}

function TrialCard({ model, apply }: { model: StabModel; apply: (s: SectionSpec) => void }) {
  const [family, setFamily] = useState('I_GOST');
  const [out, setOut] = useState<{ steps: string[]; chosen: string | null } | null>(null);
  const run = () => {
    const fam = STEEL_FAMILIES.find((f) => f.key === family)!;
    const cands = fam.profiles.map((p) => ({ name: p.name, sec: computeSection({ kind: 'catalog', family, name: p.name, rotate: false }) }));
    setOut(trialDesign(cands, {
      N: model.N, Lz: model.L, Ly: model.sameL ? model.L : model.Ly, muZ: model.muZ, muY: model.muY,
      E: model.material.E, allowable: model.material.allowable, params: model.params, nRequired: model.nReq,
    }));
  };
  return (
    <Card title="Chọn tiết diện theo điều kiện ổn định (phương pháp thử dần)">
      <div className="row">
        <Select label="Họ thép" value={family} onChange={(v) => { setFamily(v); setOut(null); }}
          options={STEEL_FAMILIES.map((f) => ({ value: f.key, label: f.label }))} />
        <button className="primary" onClick={run}>Chọn tiết diện</button>
      </div>
      {out && (
        <>
          <ul className="steps">{out.steps.map((s, i) => <li key={i}>{s}</li>)}</ul>
          {out.chosen && (
            <button onClick={() => apply({ kind: 'catalog', family, name: out.chosen!, rotate: false })}>Dùng {out.chosen}</button>
          )}
        </>
      )}
      <p className="hint">Bắt đầu với φ₀ = 0.5 → A_yc = N/(φ₀[σ]) → chọn số hiệu → tính λ, tra φ′ → lặp với φ₁ = (φ₀ + φ′)/2 đến khi φ hội tụ, rồi kiểm tra lại.</p>
    </Card>
  );
}
