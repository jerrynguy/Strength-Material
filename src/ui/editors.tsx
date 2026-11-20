import { useState } from 'react';
import { dist, force, moment, support, uid } from '../core/presets';
import { SECTION_DEFAULTS, SECTION_LABELS, computeSection, validateSection, plasticProps } from '../core/section';
import { fmt } from '../core/stress';
import {
  NO_SPRINGS, SUPPORT_LABELS, effectiveRestraints, type Load, type Springs, type Model, type Restraints, type SectionSpec, type Support, type SupportKind, alphaTOf, densityOf, selfWeightPerM,
} from '../core/types';
import { Card, NumField, Select, TextField } from './fields';
import { SectionView } from './SectionView';
import { SteelPicker } from './SteelPicker';

type Setter = (fn: (m: Model) => Model) => void;

const nextName = (used: string[], letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') =>
  [...letters].find((c) => !used.includes(c)) ?? `G${used.length + 1}`;

export function MaterialRow({ m, setMat, thermal }: { m: Model['material']; setMat: (p: Partial<Model['material']>) => void; thermal?: boolean }) {
  return (
    <div className="row">
      <TextField label="Vật liệu" value={m.name} onChange={(v) => setMat({ name: v })} width={160} />
      <NumField label="E" unit="GPa" value={m.E} onChange={(v) => setMat({ E: v })} />
      <NumField label="ν (Poisson)" value={m.nu} onChange={(v) => setMat({ nu: v })} />
      <NumField label="[σ]" unit="MPa" value={m.allowable} onChange={(v) => setMat({ allowable: v })} />
      <NumField label="ρ (khối lượng riêng)" unit="kg/m³" value={densityOf(m)} width={130} onChange={(v) => setMat({ density: v > 0 ? v : undefined })} />
      {thermal && <NumField label="α_t (×10⁻⁶/°C)" value={alphaTOf(m) * 1e6} width={110} onChange={(v) => setMat({ alphaT: v > 0 ? v * 1e-6 : undefined })} title="Hệ số giãn nở nhiệt; thép 12, bê tông 10, gỗ dọc thớ ~5" />}
    </div>
  );
}

export function GeneralEditor({ model, set }: { model: Model; set: Setter }) {
  const m = model.material;
  const setMat = (patch: Partial<typeof m>) => set((s) => ({ ...s, material: { ...s.material, ...patch } }));
  return (
    <Card title="Thanh & vật liệu">
      <div className="row">
        <TextField label="Tên bài toán" value={model.title} onChange={(v) => set((s) => ({ ...s, title: v }))} width={260} />
        <NumField label="Chiều dài L" unit="m" value={model.length} onChange={(v) => set((s) => ({ ...s, length: v }))} />
      </div>
      <MaterialRow thermal m={m} setMat={setMat} />
    </Card>
  );
}

const PARAM_LABELS: Record<string, string> = {
  b: 'b (rộng)', h: 'h (cao)', B: 'B (rộng ngoài)', H: 'H (cao ngoài)', tw: 't bụng / thành đứng', tf: 't cánh / thành ngang',
  D: 'D (đường kính ngoài)', t: 't (chiều dày)', bt: 'b cánh trên', tt: 't cánh trên', hw: 'h bản bụng', bb: 'b cánh dưới', tb: 't cánh dưới',
};

function parsePts(text: string): [number, number][] {
  return text
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/[\s,;]+/).map((v) => parseFloat(v)))
    .filter((p) => p.length >= 2 && p.every(Number.isFinite))
    .map((p) => [p[0], p[1]] as [number, number]);
}
const ptsText = (pts: [number, number][]) => pts.map((p) => `${p[0]}, ${p[1]}`).join('\n');

export function SectionSpecEditor({ spec: s, onChange: setSec, size = 200, density }: { spec: SectionSpec; onChange: (s: SectionSpec) => void; size?: number; density?: number }) {
  const err = validateSection(s);
  const props = err ? null : computeSection(s);
  const [outerText, setOuterText] = useState(s.kind === 'polygon' ? ptsText(s.outer) : '');
  const [holesText, setHolesText] = useState(s.kind === 'polygon' ? s.holes.map(ptsText).join('\n\n') : '');
  return (
    <>
      <div className="row">
        <Select
          label="Hình dạng"
          value={s.kind}
          options={Object.entries(SECTION_LABELS).map(([value, label]) => ({ value: value as SectionSpec['kind'], label }))}
          onChange={(k) => {
            const d = SECTION_DEFAULTS[k];
            setSec(structuredClone(d));
            if (d.kind === 'polygon') { setOuterText(ptsText(d.outer)); setHolesText(''); }
          }}
        />
      </div>
      {s.kind === 'catalog' ? (
        <SteelPicker spec={s} onChange={setSec} />
      ) : s.kind !== 'polygon' ? (
        <div className="row">
          {Object.entries(s)
            .filter(([k]) => k !== 'kind' && k !== 'stiffeners')
            .map(([k, v]) => (
              <NumField key={k} label={PARAM_LABELS[k] ?? k} unit="mm" value={v as number}
                onChange={(nv) => setSec({ ...s, [k]: nv } as SectionSpec)} />
            ))}
        </div>
      ) : (
        <div className="row">
          <label className="field grow">
            <span className="field-label">Đỉnh đa giác ngoài (mỗi dòng: z, y — mm)</span>
            <textarea rows={6} value={outerText} onChange={(e) => {
              setOuterText(e.target.value);
              setSec({ ...s, outer: parsePts(e.target.value) });
            }} />
          </label>
          <label className="field grow">
            <span className="field-label">Lỗ rỗng (mỗi lỗ cách nhau 1 dòng trống)</span>
            <textarea rows={6} value={holesText} onChange={(e) => {
              setHolesText(e.target.value);
              setSec({ ...s, holes: e.target.value.split(/\n\s*\n/).map(parsePts).filter((h) => h.length >= 3) });
            }} />
          </label>
        </div>
      )}
      {s.kind === 'I' && <StiffenerEditor spec={s} onChange={setSec} />}
      {err && <p className="error">{err}</p>}
      {props && (
        <div className="section-grid">
          <SectionView sec={props} size={size} />
          <table className="kv">
            <tbody>
              <tr><th>A</th><td>{fmt(props.A, 1)} mm²</td></tr>
              <tr><th>I<sub>z</sub> (trục ngang)</th><td>{fmt(props.Iz, 0)} mm⁴</td></tr>
              <tr><th>I<sub>y</sub> (trục đứng)</th><td>{fmt(props.Iy, 0)} mm⁴</td></tr>
              {props.Iyz !== 0 && <tr><th>I<sub>yz</sub></th><td>{fmt(props.Iyz, 0)} mm⁴</td></tr>}
              <tr><th>W<sub>z</sub> = I<sub>z</sub>/y<sub>max</sub></th><td>{fmt(props.Iz / Math.max(props.yMax, -props.yMin), 0)} mm³</td></tr>
              <tr><th>W<sub>y</sub></th><td>{fmt(props.Iy / Math.max(props.zMax, -props.zMin), 0)} mm³</td></tr>
              <tr><th>W<sub>pl,z</sub> · W<sub>pl,y</sub> (dẻo)</th><td>{fmt(plasticProps(props, 'z').Wpl, 0)} · {fmt(plasticProps(props, 'y').Wpl, 0)} mm³ (W<sub>pl</sub>/W<sub>el</sub> = {fmt(plasticProps(props, 'z').shape, 3)})</td></tr>
              <tr><th>Trọng tâm cách đáy</th><td>{fmt(-props.yMin, 2)} mm</td></tr>
              <tr><th>Khối lượng{density ? '' : ' (thép)'}</th><td>{fmt(props.A * 1e-6 * (density ?? 7850), 2)} kg/m</td></tr>
              <tr><th>J (xoắn)</th><td>{props.torsion.J ? `${fmt(props.torsion.J, 0)} mm⁴` : '—'}</td></tr>
              <tr><td colSpan={2} className="muted">{props.torsion.model}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export function SectionEditor({ model, set }: { model: Model; set: Setter }) {
  return (
    <Card title="Mặt cắt ngang">
      <SectionSpecEditor spec={model.section} density={densityOf(model.material)} onChange={(sec) => set((m) => ({ ...m, section: sec }))} />
    </Card>
  );
}

const R_LABELS: [keyof Restraints, string][] = [
  ['ux', 'u_x'], ['uy', 'u_y'], ['uz', 'u_z'], ['rx', 'θ_x (xoắn)'], ['ry', 'θ_y'], ['rz', 'θ_z'],
];

export function SupportsEditor({ model, set }: { model: Model; set: Setter }) {
  const upd = (id: string, patch: Partial<Support>) =>
    set((m) => ({ ...m, supports: m.supports.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  return (
    <Card
      title="Liên kết (gối tựa) & khớp nối"
      actions={
        <>
          <button onClick={() => set((m) => ({ ...m, supports: [...m.supports, support(nextName(m.supports.map((s) => s.name)), m.length, 'roller')] }))}>+ Gối</button>
          <button onClick={() => set((m) => ({ ...m, hinges: [...m.hinges, { id: uid('h'), name: nextName(m.hinges.map((h) => h.name), 'KLMNOPQRS'), x: m.length / 2 }] }))}>+ Khớp nối</button>
        </>
      }
    >
      {model.supports.length === 0 && <p className="muted">Chưa có gối tựa.</p>}
      {model.supports.map((s) => (
        <div key={s.id} className="item">
          <div className="row">
            <TextField label="Tên" value={s.name} onChange={(v) => upd(s.id, { name: v })} width={60} />
            <NumField label="x" unit="m" value={s.x} onChange={(v) => upd(s.id, { x: v })} />
            <Select
              label="Loại"
              value={s.kind}
              options={(Object.keys(SUPPORT_LABELS) as SupportKind[]).map((k) => ({ value: k, label: SUPPORT_LABELS[k] }))}
              onChange={(k) => upd(s.id, {
                kind: k,
                restraints: k === 'custom' ? { ...effectiveRestraints(s) } : s.restraints,
                ...(k === 'spring' && !s.springs ? { springs: { ...NO_SPRINGS, ky: 10000 } } : {}),
                ...(k === 'spring' ? { settle: undefined } : {}),
              })}
            />
            <button className="del" title="Xoá" onClick={() => set((m) => ({ ...m, supports: m.supports.filter((x) => x.id !== s.id) }))}>✕</button>
          </div>
          {s.kind === 'custom' && (
            <div className="row checks">
              <span className="muted">Chặn:</span>
              {R_LABELS.map(([k, l]) => (
                <label key={k} className="check">
                  <input type="checkbox" checked={s.restraints[k]}
                    onChange={(e) => upd(s.id, { restraints: { ...s.restraints, [k]: e.target.checked } })} />
                  {l}
                </label>
              ))}
            </div>
          )}
          {s.kind === 'spring' && (() => {
            const k = s.springs ?? NO_SPRINGS;
            const f: [keyof Springs, string, string][] = [['ky', 'k_y', 'kN/m'], ['kx', 'k_x', 'kN/m'], ['kz', 'k_z', 'kN/m'], ['krz', 'k_φz', 'kN·m/rad'], ['kry', 'k_φy', 'kN·m/rad'], ['krx', 'k_φx (xoắn)', 'kN·m/rad']];
            return (
              <div className="row">
                <span className="muted">Lò xo:</span>
                {f.map(([key, l, u]) => <NumField key={key} label={l} unit={u} width={100} value={k[key]} onChange={(v) => upd(s.id, { springs: { ...k, [key]: Math.max(0, v) } })} title="0 = tự do theo phương này" />)}
              </div>
            );
          })()}
          {s.kind !== 'spring' && (() => {
            const r = effectiveRestraints(s);
            const st = s.settle ?? {};
            const set1 = (k: keyof NonNullable<Support['settle']>, v: number) => {
              const n = { ...st, [k]: v || undefined };
              upd(s.id, { settle: Object.values(n).some((x) => x) ? n : undefined });
            };
            const fields: [keyof NonNullable<Support['settle']>, string, string, boolean][] = [
              ['dy', 'Δy', 'mm', r.uy], ['dx', 'Δx', 'mm', r.ux], ['dz', 'Δz', 'mm', r.uz], ['rz', 'φ_z (↺ +)', '‰ rad', r.rz], ['ry', 'φ_y', '‰ rad', r.ry],
            ];
            const shown = fields.filter((f) => f[3]);
            if (!shown.length) return null;
            return (
              <div className="row">
                <span className="muted">Lún gối:</span>
                {shown.map(([k, l, u]) => <NumField key={k} label={l} unit={u} width={88} value={st[k] ?? 0} onChange={(v) => set1(k, v)} title={k === 'dy' ? 'Âm = lún xuống' : undefined} />)}
              </div>
            );
          })()}
        </div>
      ))}
      {model.hinges.map((h) => (
        <div key={h.id} className="item">
          <div className="row">
            <span className="tag">Khớp nối</span>
            <TextField label="Tên" value={h.name} width={60}
              onChange={(v) => set((m) => ({ ...m, hinges: m.hinges.map((x) => (x.id === h.id ? { ...x, name: v } : x)) }))} />
            <NumField label="x" unit="m" value={h.x}
              onChange={(v) => set((m) => ({ ...m, hinges: m.hinges.map((x) => (x.id === h.id ? { ...x, x: v } : x)) }))} />
            <button className="del" title="Xoá" onClick={() => set((m) => ({ ...m, hinges: m.hinges.filter((x) => x.id !== h.id) }))}>✕</button>
          </div>
        </div>
      ))}
      <p className="hint">
        Ngàm chặn mọi chuyển vị và góc xoay. Gối cố định chặn u<sub>x</sub>, u<sub>y</sub>, u<sub>z</sub>. Gối di động chặn u<sub>y</sub>, u<sub>z</sub>.
        Chọn <b>Tuỳ chỉnh</b> để tự chọn từng liên kết (ví dụ ổ đỡ chặn xoắn θ<sub>x</sub>).
        Lún gối: chuyển vị cưỡng bức theo các phương gối chặn (mm, góc tính bằng phần nghìn radian); dầm tĩnh định lún gối chỉ gây chuyển vị,
        dầm siêu tĩnh phát sinh nội lực. Gối đàn hồi: lò xo theo từng phương (k = 0 là tự do), phản lực R = −k·u; có thể đặt cùng vị trí với
        gối khác (ví dụ gối khớp + lò xo xoay k_φz = ngàm đàn hồi; dầm trên nền đàn hồi rời rạc).
      </p>
    </Card>
  );
}

function ForceRow({ ld, upd }: { ld: Extract<Load, { type: 'force' }>; upd: (p: Partial<Load>) => void }) {
  const [P, setP] = useState(Math.hypot(ld.Fx, ld.Fy));
  const [ang, setAng] = useState(() => {
    const a = (Math.atan2(ld.Fy, ld.Fx) * 180) / Math.PI;
    return Math.round(a * 1000) / 1000;
  });
  const apply = (p: number, a: number) => {
    const r = (a * Math.PI) / 180;
    const c = (v: number) => (Math.abs(v) < 1e-12 ? 0 : Math.round(v * 1e9) / 1e9);
    upd({ Fx: c(p * Math.cos(r)), Fy: c(p * Math.sin(r)) });
  };
  return (
    <>
      <div className="row">
        <NumField label="Fx" unit="kN" value={ld.Fx} onChange={(v) => upd({ Fx: v })} />
        <NumField label="Fy" unit="kN" value={ld.Fy} onChange={(v) => upd({ Fy: v })} title="Fy < 0: hướng xuống" />
        <NumField label="Fz" unit="kN" value={ld.Fz} onChange={(v) => upd({ Fz: v })} title="Fz: vuông góc mặt phẳng hình vẽ" />
      </div>
      <div className="row sub">
        <span className="muted">hoặc theo độ lớn & góc:</span>
        <NumField label="P" unit="kN" value={P} onChange={(v) => { setP(v); apply(v, ang); }} />
        <NumField label="góc với +x" unit="°" value={ang} onChange={(v) => { setAng(v); apply(P, v); }} title="−90° = thẳng đứng hướng xuống" />
      </div>
    </>
  );
}

export function LoadsEditor({ model, set }: { model: Model; set: Setter }) {
  const upd = (id: string, patch: Partial<Load>) =>
    set((m) => ({ ...m, loads: m.loads.map((l) => (l.id === id ? ({ ...l, ...patch } as Load) : l)) }));
  const names = model.loads.map((l) => l.name);
  const nm = (p: string) => {
    for (let i = 1; ; i++) if (!names.includes(`${p}${i}`)) return `${p}${i}`;
  };
  return (
    <Card
      title="Tải trọng"
      actions={
        <>
          <button onClick={() => set((m) => ({ ...m, loads: [...m.loads, force(nm('P'), m.length / 2, -10)] }))}>+ Lực tập trung</button>
          <button onClick={() => set((m) => ({ ...m, loads: [...m.loads, moment(nm('M'), m.length / 2, 10)] }))}>+ Mô men</button>
          <button onClick={() => set((m) => ({ ...m, loads: [...m.loads, dist(nm('q'), 0, m.length, -10)] }))}>+ Lực phân bố</button>
          <button onClick={() => set((m) => ({ ...m, loads: [...m.loads, { id: uid('t'), type: 'temp', name: nm('t'), x1: 0, x2: m.length, Ttop: 30, Tbot: 30 }] }))}>+ Nhiệt độ</button>
        </>
      }
    >
      {model.loads.length === 0 && <p className="muted">Chưa có tải trọng.</p>}
      {model.loads.map((ld) => (
        <div key={ld.id} className="item">
          <div className="row">
            <span className="tag">{ld.type === 'force' ? 'Lực' : ld.type === 'moment' ? 'Mô men' : ld.type === 'temp' ? 'Nhiệt độ' : 'Phân bố'}</span>
            <TextField label="Tên" value={ld.name} onChange={(v) => upd(ld.id, { name: v })} width={60} />
            {ld.type === 'force' || ld.type === 'moment' ? (
              <NumField label="x" unit="m" value={ld.x} onChange={(v) => upd(ld.id, { x: v })} />
            ) : (
              <>
                <NumField label="từ x₁" unit="m" value={ld.x1} onChange={(v) => upd(ld.id, { x1: v })} />
                <NumField label="đến x₂" unit="m" value={ld.x2} onChange={(v) => upd(ld.id, { x2: v })} />
              </>
            )}
            <button className="del" title="Xoá" onClick={() => set((m) => ({ ...m, loads: m.loads.filter((x) => x.id !== ld.id) }))}>✕</button>
          </div>
          {ld.type === 'force' && <ForceRow ld={ld} upd={(p) => upd(ld.id, p)} />}
          {ld.type === 'moment' && (
            <div className="row">
              <NumField label="Mz (uốn, ↺ dương)" unit="kN·m" value={ld.Mz} onChange={(v) => upd(ld.id, { Mz: v })} />
              <button className="flip" title="Đổi chiều" onClick={() => upd(ld.id, { Mz: -ld.Mz })}>{ld.Mz >= 0 ? '↺' : '↻'} đổi chiều</button>
              <NumField label="Mx (xoắn)" unit="kN·m" value={ld.Mx} onChange={(v) => upd(ld.id, { Mx: v })} />
              <NumField label="My" unit="kN·m" value={ld.My} onChange={(v) => upd(ld.id, { My: v })} />
            </div>
          )}
          {ld.type === 'temp' && (() => {
            const sec = validateSection(model.section) ? null : computeSection(model.section);
            const at = alphaTOf(model.material);
            const hh = sec ? (sec.yMax - sec.yMin) / 1e3 : 0;
            const Tc = sec ? ld.Tbot + ((ld.Ttop - ld.Tbot) * (-sec.yMin / 1e3)) / hh : (ld.Ttop + ld.Tbot) / 2;
            return (
              <>
                <div className="row">
                  <NumField label="ΔT thớ trên (+y)" unit="°C" value={ld.Ttop} onChange={(v) => upd(ld.id, { Ttop: v })} />
                  <NumField label="ΔT thớ dưới" unit="°C" value={ld.Tbot} onChange={(v) => upd(ld.id, { Tbot: v })} />
                  <NumField label="Chênh hai bên T(+z) − T(−z)" unit="°C" value={ld.dTz ?? 0} width={150} onChange={(v) => upd(ld.id, { dTz: v || undefined })} title="Gây uốn ngang trong mặt phẳng xz; thanh cong vồng về phía nóng hơn" />
                </div>
                <p className="hint">
                  α_t = {at.toExponential(2)} 1/°C; h = {fmt(hh * 1e3, 1)} mm. Tại trọng tâm ΔT = {fmt(Tc, 2)} °C → ε₀ = {(at * Tc).toExponential(3)};
                  κ₀ = α_t(T_dưới − T_trên)/h = {hh ? ((at * (ld.Tbot - ld.Ttop)) / hh).toExponential(3) : '—'} 1/m
                  {ld.dTz && sec ? `; uốn ngang: b = ${fmt(sec.zMax - sec.zMin, 1)} mm, κ₀,w = −α_t·ΔT_z/b = ${((-at * ld.dTz) / ((sec.zMax - sec.zMin) / 1e3)).toExponential(3)} 1/m` : ''}. Thanh tĩnh định giãn/cong tự do; siêu tĩnh phát sinh nội lực.
                </p>
              </>
            );
          })()}
          {ld.type === 'distributed' && (
            <div className="row">
              <Select label="Phương" value={ld.dir} onChange={(v) => upd(ld.id, { dir: v })}
                options={[{ value: 'y', label: 'y (đứng)' }, { value: 'z', label: 'z (ngang)' }, { value: 'x', label: 'x (dọc trục)' }]} />
              <NumField label="q₁ tại x₁" unit="kN/m" value={ld.q1} onChange={(v) => upd(ld.id, { q1: v })} />
              <NumField label="q₂ tại x₂" unit="kN/m" value={ld.q2} onChange={(v) => upd(ld.id, { q2: v })} />
            </div>
          )}
        </div>
      ))}
      <div className="row checks sw-row">
        <label className="check">
          <input type="checkbox" checked={!!model.selfWeight} onChange={(e) => set((m) => ({ ...m, selfWeight: e.target.checked ? 'y' : undefined }))} />
          Kể trọng lượng bản thân
        </label>
        {model.selfWeight && (
          <>
            <Select value={model.selfWeight} onChange={(v) => set((m) => ({ ...m, selfWeight: v }))}
              options={[{ value: 'y', label: 'dầm nằm ngang (tải theo −y)' }, { value: 'x', label: 'cột đứng, chân tại x = 0 (dọc trục −x)' }]} />
            {!validateSection(model.section) && (
              <span className="muted small">g = ρ·g·A = {fmt(densityOf(model.material), 0)}·9.81·{fmt(computeSection(model.section).A, 0)}·10⁻⁶ = <b>{fmt(selfWeightPerM(model.material, computeSection(model.section).A), 4)} kN/m</b></span>
            )}
          </>
        )}
      </div>
      <p className="hint">
        Dấu theo trục: Fy &lt; 0 và q &lt; 0 (phương y) là <b>hướng xuống</b>. Mz &gt; 0 là ngược chiều kim đồng hồ ↺. q₁ ≠ q₂ cho tải hình thang / tam giác.
      </p>
    </Card>
  );
}

type ISpec = Extract<SectionSpec, { kind: 'I' }>;

/** Sườn dọc bản bụng cho tiết diện chữ I tổ hợp hàn */
function StiffenerEditor({ spec, onChange }: { spec: ISpec; onChange: (s: SectionSpec) => void }) {
  const list = spec.stiffeners ?? [];
  const set = (l: typeof list) => onChange({ ...spec, stiffeners: l });
  return (
    <div className="stiff-ed">
      <div className="row checks">
        <span className="muted">Sườn dọc bản bụng:</span>
        <button onClick={() => set([...list, { pos: Math.round(0.2 * spec.hw), b: Math.round(Math.max(60, spec.hw / 10)), t: Math.max(spec.tw, 8), sides: 1 }])}>+ Sườn dọc</button>
        {list.length === 0 && <span className="muted small">(chưa có — thường đặt cách mép nén 0.2 h_w khi bụng chịu uốn)</span>}
      </div>
      {list.map((k, i) => {
        const upd = (p: Partial<typeof k>) => set(list.map((x, j) => (j === i ? { ...x, ...p } : x)));
        return (
          <div key={i} className="row checks">
            <span className="tag">Sườn {i + 1}</span>
            <NumField label="cách mép trên bụng" unit="mm" value={k.pos} width={120} onChange={(v) => upd({ pos: v })} />
            <NumField label="b_s (vươn)" unit="mm" value={k.b} width={100} onChange={(v) => upd({ b: v })} />
            <NumField label="t_s" unit="mm" value={k.t} width={90} onChange={(v) => upd({ t: v })} />
            <Select label="Phía" value={String(k.sides) as '1' | '2'} onChange={(v) => upd({ sides: v === '2' ? 2 : 1 })}
              options={[{ value: '1', label: 'một phía' }, { value: '2', label: 'hai phía' }]} />
            <button className="del" onClick={() => set(list.filter((_, j) => j !== i))}>✕</button>
          </div>
        );
      })}
    </div>
  );
}
