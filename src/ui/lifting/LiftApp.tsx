import { useMemo } from 'react';
import { fmt } from '../../core/stress';
import {
  DEFAULT_FACTORS, GEAR_LABEL, LOAD_CHARTS, analyzeLift, lookupChart,
  type Crawler, type CraneSetup, type Factors, type Gear, type GearType, type LiftModel, type LiftPosition, type LiftResult, type Outrigger, type PipeStack, type RigItem,
} from '../../core/lifting';
import { Card, NumField, Select, TextField } from '../fields';
import { LiftView } from './LiftView';

type SetFn = (fn: (m: LiftModel) => LiftModel) => void;

const Pass = ({ ok }: { ok: boolean | null }) => (ok === null ? <span className="muted">—</span> : <b className={ok ? 'pass' : 'fail'}>{ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}</b>);
const pct = (x: number) => (Number.isFinite(x) ? `${fmt(x * 100, 2)}%` : '—');

export function LiftApp({ model, setModel }: { model: LiftModel; setModel: SetFn }) {
  const r = useMemo(() => analyzeLift(model), [model]);
  const set = (p: Partial<LiftModel>) => setModel((m) => ({ ...m, ...p }));
  const fac = (p: Partial<Factors>) => setModel((m) => ({ ...m, factors: { ...m.factors, ...p } }));
  const crane = (p: Partial<CraneSetup>) => setModel((m) => ({ ...m, crane: { ...m.crane, ...p } }));
  const out = (p: Partial<Outrigger>) => setModel((m) => ({ ...m, outrigger: { ...m.outrigger, ...p } }));
  const crw = (p: Partial<Crawler>) => setModel((m) => ({ ...m, crawler: { ...m.crawler, ...p } }));
  const stk = (p: Partial<PipeStack>) => setModel((m) => ({ ...m, stack: { ...m.stack, ...p } }));
  const setRig = (fn: (a: RigItem[]) => RigItem[]) => setModel((m) => ({ ...m, rigging: fn(m.rigging) }));
  const setPos = (fn: (a: LiftPosition[]) => LiftPosition[]) => setModel((m) => ({ ...m, positions: fn(m.positions) }));
  const setGear = (fn: (a: Gear[]) => Gear[]) => setModel((m) => ({ ...m, gear: fn(m.gear) }));
  const f = model.factors, c = model.crane, o = model.outrigger, cw = model.crawler, st = model.stack;
  const chart = LOAD_CHARTS.find((x) => x.key === c.chart);

  return (
    <main className="layout">
      <div className="col-edit">
        <Card title="Hàng nâng">
          <div className="row"><TextField label="Tên bài toán" value={model.title} width={280} onChange={(t) => set({ title: t })} /></div>
          <div className="row">
            <TextField label="Tên hàng" value={model.loadName} width={190} onChange={(t) => set({ loadName: t })} />
            <NumField label="Khối lượng (net)" unit="t" value={model.net} width={90} onChange={(x) => set({ net: x })} />
          </div>
        </Card>

        <Card title="Hệ số tải" actions={<button onClick={() => fac({ ...DEFAULT_FACTORS })}>Về mặc định</button>}>
          <div className="row">
            <NumField label="CF dự phòng KL" value={f.cf} width={70} onChange={(x) => fac({ cf: x })} />
            <NumField label="COG lệch tâm" value={f.cog} width={70} onChange={(x) => fac({ cog: x })} />
            <NumField label="TF nghiêng" value={f.tf} width={70} onChange={(x) => fac({ tf: x })} />
          </div>
          <div className="row">
            <NumField label="YF xoay" value={f.yf} width={70} onChange={(x) => fac({ yf: x })} />
            <NumField label="SKL tải lệch" value={f.skl} width={70} onChange={(x) => fac({ skl: x })} />
            <NumField label="DAF hệ số động" value={f.daf} width={70} onChange={(x) => fac({ daf: x })} />
          </div>
          <p className="hint">Như bảng trong hồ sơ: CF = 1,05; DAF = 1,15; các hệ số còn lại = 1. Tăng COG, SKL khi trọng tâm chưa chắc chắn hoặc nâng bằng nhiều móc.</p>
        </Card>

        <Card title="Cẩu & bảng tải">
          <div className="row">
            <TextField label="Tên cẩu" value={c.name} width={150} onChange={(t) => crane({ name: t })} />
            <Select label="Loại" value={c.kind} options={[{ value: 'mobile', label: 'Bánh lốp (chân chống)' }, { value: 'crawler', label: 'Bánh xích' }]}
              onChange={(x) => setModel((m) => ({ ...m, crane: { ...m.crane, kind: x }, outrigger: { ...m.outrigger, enabled: x === 'mobile' }, crawler: { ...m.crawler, enabled: x === 'crawler' } }))} />
          </div>
          <div className="row">
            <label className="field">
              <span className="field-label">Bảng tải</span>
              <span className="field-input">
                <select value={c.chart} onChange={(e) => {
                  const ch = LOAD_CHARTS.find((x) => x.key === e.target.value);
                  crane(ch ? { chart: ch.key, kind: ch.kind, name: ch.name.split(' ').slice(1).join(' ') || ch.name, boom: ch.booms.includes(c.boom) ? c.boom : ch.booms[ch.booms.length - 1] } : { chart: '' });
                }}>
                  <option value="">— nhập sức nâng tay —</option>
                  {LOAD_CHARTS.map((x) => <option key={x.key} value={x.key}>{x.name}</option>)}
                </select>
              </span>
            </label>
            {chart ? (
              <label className="field">
                <span className="field-label">Chiều dài cần</span>
                <span className="field-input">
                  <select value={c.boom} onChange={(e) => crane({ boom: +e.target.value })}>
                    {!chart.booms.includes(c.boom) && <option value={c.boom}>{c.boom} m (không có trong bảng)</option>}
                    {chart.booms.map((b) => <option key={b} value={b}>{b} m</option>)}
                  </select>
                </span>
              </label>
            ) : <NumField label="Chiều dài cần" unit="m" value={c.boom} width={80} onChange={(x) => crane({ boom: x })} />}
          </div>
          <div className="row">
            {chart && <Select label="Tra bán kính" value={c.chartMode} options={[{ value: 'step', label: 'Dòng lớn hơn kề (an toàn)' }, { value: 'linear', label: 'Nội suy tuyến tính' }]} onChange={(x) => crane({ chartMode: x })} />}
            <NumField label="Đối trọng" unit="t" value={c.counterweight} width={80} onChange={(x) => crane({ counterweight: x })} />
            <NumField label="UC cho phép" unit="%" value={c.ucLimit} width={80} onChange={(x) => crane({ ucLimit: x })} />
          </div>
          <p className="lead">Vị trí làm việc</p>
          {model.positions.map((p, i) => (
            <div key={i} className="row">
              <TextField label={i === 0 ? 'Vị trí' : ''} value={p.label} width={170} onChange={(t) => setPos((a) => a.map((y, j) => (j === i ? { ...y, label: t } : y)))} />
              <NumField label={i === 0 ? 'Bán kính R' : undefined} unit="m" value={p.radius} width={80} onChange={(x) => setPos((a) => a.map((y, j) => (j === i ? { ...y, radius: x } : y)))} />
              <NumField label={i === 0 ? 'Sức nâng tay' : undefined} unit="t" value={p.capManual} width={80} title="0 = tra bảng tải" onChange={(x) => setPos((a) => a.map((y, j) => (j === i ? { ...y, capManual: x } : y)))} />
              <button className="del" onClick={() => setPos((a) => a.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <div className="row"><button onClick={() => setPos((a) => [...a, { label: `Vị trí ${a.length + 1}`, radius: a.at(-1)?.radius ?? 10, capManual: 0 }])}>+ vị trí</button></div>
          <p className="hint">Sức nâng tay = 0 thì tra bảng tải. UC cho phép theo quy trình nâng (nhiều nơi dùng 85% cho nâng thường, 75% cho nâng hai cẩu).
            Bảng tải trong app chỉ là phần trích trên bản vẽ — đối chiếu bảng đầy đủ theo cấu hình đối trọng, chân chống của nhà sản xuất.</p>
        </Card>

        <Card title="Phụ kiện treo (rigging)" actions={<button onClick={() => setRig((a) => [...a, { name: 'Phụ kiện', mass: 0, qty: 1 }])}>+ phụ kiện</button>}>
          {model.rigging.map((it, i) => (
            <div key={i} className="row">
              <TextField label={i === 0 ? 'Tên' : ''} value={it.name} width={200} onChange={(t) => setRig((a) => a.map((y, j) => (j === i ? { ...y, name: t } : y)))} />
              <NumField label={i === 0 ? 'KL 1 chiếc' : undefined} unit="t" value={it.mass} width={80} onChange={(x) => setRig((a) => a.map((y, j) => (j === i ? { ...y, mass: x } : y)))} />
              <NumField label={i === 0 ? 'SL' : undefined} value={it.qty} width={50} onChange={(x) => setRig((a) => a.map((y, j) => (j === i ? { ...y, qty: Math.max(0, Math.round(x)) } : y)))} />
              <button className="del" onClick={() => setRig((a) => a.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
          <p className="hint">Tổng {fmt(r.crane.rigging, 3)} t: móc, thanh gánh, cáp, dây vải, ma ní… (cộng vào tải trên móc trước khi nhân DAF).</p>
        </Card>

        <Card title="Cáp, dây vải, ma ní" actions={<button onClick={() => setGear((a) => [...a, { type: 'sling', name: 'Cáp thép', load: model.net, legs: 2, angle: 60, length: 0, self: 0, rigging: 0, swl: 0, reduce: 1 }])}>+ hạng mục</button>}>
          {model.gear.map((g, i) => {
            const upd = (p: Partial<Gear>) => setGear((a) => a.map((y, j) => (j === i ? { ...y, ...p } : y)));
            return (
              <div key={i} className="item">
                <div className="row">
                  <Select value={g.type} options={(Object.keys(GEAR_LABEL) as GearType[]).map((k) => ({ value: k, label: GEAR_LABEL[k] }))} onChange={(x) => upd({ type: x })} />
                  <TextField label="Tên" value={g.name} width={170} onChange={(t) => upd({ name: t })} />
                  <button className="del" onClick={() => setGear((a) => a.filter((_, j) => j !== i))}>Xoá</button>
                </div>
                <div className="row">
                  <NumField label="Tải đỡ W" unit="t" value={g.load} width={75} onChange={(x) => upd({ load: x })} />
                  <NumField label="Số nhánh" value={g.legs} width={55} onChange={(x) => upd({ legs: Math.max(1, Math.round(x)) })} />
                  <NumField label="Góc với ngang" unit="°" value={g.angle} width={70} title="90° = nhánh thẳng đứng" onChange={(x) => upd({ angle: x })} />
                  <NumField label="Phụ kiện" unit="t" value={g.rigging} width={75} title="Khối lượng phụ kiện cộng thêm (nhân DAF)" onChange={(x) => upd({ rigging: x })} />
                </div>
                <div className="row">
                  <NumField label="SWL" unit="t" value={g.swl} width={70} onChange={(x) => upd({ swl: x })} />
                  <NumField label="Hệ số giảm" value={g.reduce} width={60} title="Ví dụ thắt cổ dê 0,8; quấn qua cạnh sắc…" onChange={(x) => upd({ reduce: x })} />
                  <NumField label="Dài" unit="m" value={g.length} width={60} onChange={(x) => upd({ length: x })} />
                  <NumField label="KL bản thân" unit="t" value={g.self} width={80} onChange={(x) => upd({ self: x })} />
                </div>
              </div>
            );
          })}
          <p className="hint">Tải một nhánh T = W/(n·sinα); tải lớn nhất = T·CF·COG·TF·YF·SKL + phụ kiện·DAF; hệ số an toàn = SWL·hệ số giảm / tải lớn nhất ≥ 1.
            Hồ sơ dùng phụ kiện 1,042 t cho cáp / dây vải và 0,010 t cho ma ní.</p>
        </Card>

        <Card title="Áp lực nền dưới cẩu">
          <div className="row checks">
            <label className="check"><input type="checkbox" checked={o.enabled} onChange={(e) => out({ enabled: e.target.checked })} /> Chân chống (outrigger) có tấm kê</label>
            <label className="check"><input type="checkbox" checked={cw.enabled} onChange={(e) => crw({ enabled: e.target.checked })} /> Bánh xích</label>
          </div>
          {o.enabled && (
            <>
              <p className="lead">Chân chống</p>
              <div className="row">
                <NumField label="Phản lực chân chống lớn nhất" unit="t" value={o.force} width={85} onChange={(x) => out({ force: x })} />
                <NumField label="[p] cho phép" unit="t/m²" value={o.allow} width={85} onChange={(x) => out({ allow: x })} />
              </div>
              <div className="row">
                <NumField label="Tấm kê dài" unit="m" value={o.matL} width={70} onChange={(x) => out({ matL: x })} />
                <NumField label="rộng" unit="m" value={o.matB} width={70} onChange={(x) => out({ matB: x })} />
                <NumField label="dày" unit="m" value={o.matT} width={70} onChange={(x) => out({ matT: x })} />
              </div>
              <div className="row">
                <NumField label="KL riêng tấm kê" unit="t/m³" value={o.matDensity} width={70} title="0 = không kể tự trọng tấm kê (gỗ ≈ 0,8; thép 7,85)" onChange={(x) => out({ matDensity: x })} />
                <NumField label="Góc lan truyền" unit="°" value={o.spread} width={70} title="0 = chỉ lấy diện tích tấm kê" onChange={(x) => out({ spread: x })} />
              </div>
              <p className="hint">Phản lực chân chống lấy từ phần mềm / bảng của nhà sản xuất cho cấu hình và góc quay bất lợi nhất.</p>
            </>
          )}
          {cw.enabled && (
            <>
              <p className="lead">Bánh xích</p>
              <div className="row">
                <Select label="Cách tính" value={cw.mode} options={[{ value: 'manual', label: 'Nhập áp lực (nhà sản xuất)' }, { value: 'calc', label: 'Tính từ khối lượng & xích' }]} onChange={(x) => crw({ mode: x })} />
                <NumField label="[p] cho phép" unit="t/m²" value={cw.allow} width={85} onChange={(x) => crw({ allow: x })} />
              </div>
              {cw.mode === 'manual' ? (
                <div className="row"><NumField label="Áp lực dưới xích" unit="t/m²" value={cw.pManual} width={85} onChange={(x) => crw({ pManual: x })} /></div>
              ) : (
                <>
                  <div className="row">
                    <NumField label="KL cẩu (gồm đối trọng)" unit="t" value={cw.craneMass} width={85} onChange={(x) => crw({ craneMass: x })} />
                    <NumField label="Dài tiếp đất 1 xích" unit="m" value={cw.trackL} width={75} onChange={(x) => crw({ trackL: x })} />
                    <NumField label="Rộng guốc" unit="m" value={cw.shoeB} width={70} onChange={(x) => crw({ shoeB: x })} />
                  </div>
                  <div className="row">
                    <NumField label="Lệch tâm dọc xích e" unit="m" value={cw.ecc} width={75} title="Khoảng cách từ hợp lực tới giữa chiều dài xích" onChange={(x) => crw({ ecc: x })} />
                    <NumField label="Lớp kê dày" unit="m" value={cw.matT} width={70} onChange={(x) => crw({ matT: x })} />
                    <NumField label="Góc lan truyền" unit="°" value={cw.spread} width={70} onChange={(x) => crw({ spread: x })} />
                  </div>
                  <p className="hint">Tải nâng lấy bằng tải tính toán {fmt(r.crane.factored, 3)} t. p_max = p_tb·(1 + 6e/L) khi e ≤ L/6, phân bố tam giác khi e &gt; L/6.</p>
                </>
              )}
            </>
          )}
        </Card>

        <Card title="Bãi xếp ống (áp lực nền)">
          <div className="row checks"><label className="check"><input type="checkbox" checked={st.enabled} onChange={(e) => stk({ enabled: e.target.checked })} /> Kiểm tra bãi xếp ống</label></div>
          {st.enabled && (
            <>
              <div className="row">
                <TextField label="Tên ống" value={st.name} width={130} onChange={(t) => stk({ name: t })} />
                <NumField label="KL 1 ống" unit="t" value={st.unit} width={75} onChange={(x) => stk({ unit: x })} />
                <NumField label="OD" unit="m" value={st.od} width={70} onChange={(x) => stk({ od: x })} />
              </div>
              <div className="row">
                <NumField label="Số ống tầng dưới" value={st.nBottom} width={60} onChange={(x) => stk({ nBottom: Math.max(1, Math.round(x)) })} />
                <NumField label="Số tầng" value={st.tiers} width={55} onChange={(x) => stk({ tiers: Math.max(1, Math.round(x)) })} />
                <NumField label="[p] cho phép" unit="t/m²" value={st.allow} width={80} onChange={(x) => stk({ allow: x })} />
              </div>
              <div className="row">
                <NumField label="Diện tích chịu tải: dài" unit="m" value={st.areaL} width={70} onChange={(x) => stk({ areaL: x })} />
                <NumField label="rộng" unit="m" value={st.areaB} width={70} onChange={(x) => stk({ areaB: x })} />
              </div>
              <p className="hint">Xếp lồng: mỗi tầng trên ít hơn tầng dưới 1 ống. Hồ sơ: 26 × 4 = 104 m², 25 ống tầng dưới → 2/3/4/5 tầng = 49/72/94/115 ống.</p>
            </>
          )}
        </Card>
      </div>

      <div className="col-res">
        <Card title={model.title || 'Sơ đồ nâng'}><LiftView model={model} r={r} /></Card>
        <LiftConclusionCard r={r} model={model} />
        <CraneCard r={r} model={model} />
        <GearCard r={r} />
        {(o.enabled || cw.enabled) && <PressureCard r={r} model={model} />}
        {st.enabled && <StackCard r={r} model={model} />}
      </div>
    </main>
  );
}

export function liftConclusion(r: LiftResult, m: LiftModel) {
  return [
    ...r.crane.rows.map((x) => ({ label: `Cẩu ${m.crane.name} – ${x.label.toLowerCase()} (R = ${fmt(x.radius, 2)} m)`, ok: x.ok as boolean | null, detail: `${fmt(r.crane.factored, 3)} / ${x.cap != null ? fmt(x.cap, 3) : '—'} t; UC = ${pct(x.uc)}` })),
    ...r.gear.map((g) => ({ label: `${GEAR_LABEL[g.gear.type]}: ${g.gear.name}`, ok: g.ok as boolean | null, detail: `tải lớn nhất ${fmt(g.max, 3)} t; SWL ${fmt(g.swlEff, 3)} t; hệ số an toàn ${fmt(g.sf, 3)}` })),
    ...(m.outrigger.enabled ? [{ label: 'Áp lực nền dưới chân chống', ok: r.outrigger.ok, detail: `p = ${fmt(r.outrigger.p, 3)} t/m² (${fmt(r.outrigger.p * 9.81, 1)} kPa)${r.outrigger.allow > 0 ? ` so với ${r.outrigger.allow} t/m²` : ''}` }] : []),
    ...(m.crawler.enabled ? [{ label: 'Áp lực nền dưới bánh xích', ok: r.crawler.ok, detail: `p = ${fmt(r.crawler.p, 3)} t/m² (${fmt(r.crawler.p * 9.81, 1)} kPa)${r.crawler.allow > 0 ? ` so với ${r.crawler.allow} t/m²` : ''}` }] : []),
    ...(m.stack.enabled ? [{ label: `Bãi xếp ống ${m.stack.tiers} tầng`, ok: r.stack.ok, detail: `${r.stack.rows.at(-1)!.count} ống, ${fmt(r.stack.rows.at(-1)!.weight, 2)} t; p = ${fmt(r.stack.rows.at(-1)!.p, 3)} t/m²` }] : []),
  ];
}

function LiftConclusionCard({ r, model }: { r: LiftResult; model: LiftModel }) {
  return (
    <Card title="Kết luận chung">
      <div className={`status ${r.ok ? 'status-tinh-dinh' : 'status-bien-hinh'}`}>{r.ok ? 'Phương án nâng ĐẠT các kiểm tra' : 'Có hạng mục KHÔNG ĐẠT'}</div>
      <table className="grid">
        <thead><tr><th>Hạng mục</th><th>Kết quả</th><th>Kết luận</th></tr></thead>
        <tbody>{liftConclusion(r, model).map((it, i) => <tr key={i}><td>{it.label}</td><td>{it.detail}</td><td><Pass ok={it.ok} /></td></tr>)}</tbody>
      </table>
      {r.warnings.map((w, i) => <p key={i} className="warn">{w}</p>)}
    </Card>
  );
}

function CraneCard({ r, model }: { r: LiftResult; model: LiftModel }) {
  const f = model.factors, c = model.crane;
  const chart = LOAD_CHARTS.find((x) => x.key === c.chart);
  const col = chart ? chart.booms.findIndex((b) => Math.abs(b - c.boom) <= 0.05) : -1;
  // các dòng bảng tải đã dùng (theo bán kính các vị trí không nhập sức nâng tay)
  const used = new Set<number>();
  if (chart) for (const p of model.positions) {
    if (p.capManual > 0) continue;
    const l = lookupChart(chart, c.boom, p.radius, c.chartMode);
    if (l.rowLo >= 0) { used.add(l.rowLo); used.add(l.rowHi); }
  }
  return (
    <Card title="Kiểm tra cẩu (Check crane)">
      <table className="grid">
        <thead><tr><th>Cẩu</th><th>Cần (m)</th><th>Đối trọng (t)</th><th>Vị trí</th><th>R (m)</th><th>Sức nâng (t)</th><th>Tải tính toán (t)</th><th>UC</th><th></th></tr></thead>
        <tbody>
          {r.crane.rows.map((x, i) => (
            <tr key={i}><td>{c.name}</td><td>{c.boom}</td><td>{c.counterweight}</td><td>{x.label}</td><td>{x.radius}</td><td>{x.cap != null ? fmt(x.cap, 3) : '—'}</td><td>{fmt(r.crane.factored, 3)}</td><td><b>{pct(x.uc)}</b></td><td><Pass ok={x.ok} /></td></tr>
          ))}
        </tbody>
      </table>
      <table className="grid">
        <tbody>
          <tr><td>Khối lượng hàng (net)</td><td>{fmt(model.net, 3)} t</td></tr>
          <tr><td>Khối lượng phụ kiện</td><td>{fmt(r.crane.rigging, 3)} t</td></tr>
          <tr><td>CF · COG · TF · YF · SKL</td><td>{f.cf} · {f.cog} · {f.tf} · {f.yf} · {f.skl}</td></tr>
          <tr><td>DAF</td><td>{f.daf}</td></tr>
        </tbody>
      </table>
      <p className="hint">Tải tính toán = (tải trên móc·CF·COG·TF·YF·SKL + phụ kiện)·DAF; UC = tải tính toán / sức nâng ≤ {c.ucLimit}%.</p>
      {chart && (
        <details><summary>Bảng tải {chart.name} (t)</summary>
          <div className="chart-wrap">
            <table className="grid">
              <thead><tr><th>R (m) \ cần (m)</th>{chart.booms.map((b, j) => <th key={j} className={j === col ? 'hl' : ''}>{b}</th>)}</tr></thead>
              <tbody>
                {chart.rows.map((row, i) => (
                  <tr key={i}>
                    <td className={used.has(i) ? 'hl' : ''}>{row.r}</td>
                    {row.cap.map((v, j) => <td key={j} className={j === col && used.has(i) ? 'hl' : ''}>{v ?? ''}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {chart.note && <p className="hint">{chart.note}</p>}
        </details>
      )}
      <details><summary>Lời giải</summary><ol className="steps">{r.crane.steps.map((l, i) => <li key={i}>{l}</li>)}</ol></details>
    </Card>
  );
}

function GearCard({ r }: { r: LiftResult }) {
  return (
    <Card title="Kiểm tra cáp, dây vải, ma ní (Check sling / shackles)">
      {r.gear.length === 0 && <p className="muted">Chưa có hạng mục.</p>}
      {r.gear.length > 0 && (
        <div className="chart-wrap"><table className="grid">
          <thead><tr><th>Hạng mục</th><th>Loại</th><th>Dài (m)</th><th>KL bản thân (t)</th><th>T 1 nhánh (t)</th><th>Tải lớn nhất (t)</th><th>SWL (t)</th><th>Hệ số giảm</th><th>Hệ số an toàn</th><th></th></tr></thead>
          <tbody>
            {r.gear.map((g, i) => (
              <tr key={i}><td>{g.gear.name}</td><td>{GEAR_LABEL[g.gear.type]}</td><td>{g.gear.length || '—'}</td><td>{g.gear.self || '—'}</td><td>{fmt(g.tension, 3)}</td><td>{fmt(g.max, 3)}</td><td>{g.gear.swl}</td><td>{g.gear.reduce}</td><td><b>{fmt(g.sf, 3)}</b></td><td><Pass ok={g.ok} /></td></tr>
            ))}
          </tbody>
        </table></div>
      )}
      <p className="hint">Tải lớn nhất = T·CF·COG·TF·YF·SKL + phụ kiện·DAF; hệ số an toàn = SWL·hệ số giảm / tải lớn nhất.</p>
      {r.gear.map((g, i) => <details key={i}><summary>Lời giải – {g.gear.name}</summary><ol className="steps">{g.steps.map((l, j) => <li key={j}>{l}</li>)}</ol></details>)}
    </Card>
  );
}

function PressureCard({ r, model }: { r: LiftResult; model: LiftModel }) {
  return (
    <Card title="Áp lực nền dưới cẩu (Check ground pressure)">
      <table className="grid">
        <thead><tr><th>Vị trí</th><th>Tải (t)</th><th>A (m²)</th><th>p (t/m²)</th><th>p (kPa)</th><th>[p]</th><th></th></tr></thead>
        <tbody>
          {model.outrigger.enabled && <tr><td>Chân chống + tấm kê {model.outrigger.matL}×{model.outrigger.matB}×{model.outrigger.matT} m</td><td>{fmt(r.outrigger.load, 3)}</td><td>{fmt(r.outrigger.area, 3)}</td><td><b>{fmt(r.outrigger.p, 3)}</b></td><td>{fmt(r.outrigger.p * 9.81, 1)}</td><td>{r.outrigger.allow || '—'}</td><td><Pass ok={r.outrigger.ok} /></td></tr>}
          {model.crawler.enabled && <tr><td>Bánh xích{model.crawler.mode === 'manual' ? ' (nhập theo nhà sản xuất)' : ''}</td><td>{model.crawler.mode === 'manual' ? '—' : fmt(r.crawler.load, 3)}</td><td>{model.crawler.mode === 'manual' ? '—' : fmt(r.crawler.area, 3)}</td><td><b>{fmt(r.crawler.p, 3)}</b></td><td>{fmt(r.crawler.p * 9.81, 1)}</td><td>{r.crawler.allow || '—'}</td><td><Pass ok={r.crawler.ok} /></td></tr>}
        </tbody>
      </table>
      {model.outrigger.enabled && <details><summary>Lời giải – chân chống</summary><ol className="steps">{r.outrigger.steps.map((l, i) => <li key={i}>{l}</li>)}</ol></details>}
      {model.crawler.enabled && <details><summary>Lời giải – bánh xích</summary><ol className="steps">{r.crawler.steps.map((l, i) => <li key={i}>{l}</li>)}</ol></details>}
    </Card>
  );
}

function StackCard({ r, model }: { r: LiftResult; model: LiftModel }) {
  return (
    <Card title="Áp lực nền bãi xếp ống">
      <table className="grid">
        <thead><tr><th>Số tầng</th><th>Số ống</th><th>Tổng KL (t)</th><th>Cao chồng (m)</th><th>p (t/m²)</th><th>p (kPa)</th><th></th></tr></thead>
        <tbody>
          {r.stack.rows.map((x) => (
            <tr key={x.tiers}><td>{x.tiers}</td><td>{x.count}</td><td>{fmt(x.weight, 3)}</td><td>{fmt(x.height, 3)}</td><td><b>{fmt(x.p, 3)}</b></td><td>{fmt(x.p * 9.81, 1)}</td><td><Pass ok={x.ok} /></td></tr>
          ))}
        </tbody>
      </table>
      <p className="hint">{model.stack.name}: {model.stack.unit} t/ống; diện tích chịu tải {model.stack.areaL} × {model.stack.areaB} = {fmt(r.stack.area, 2)} m². p = tổng khối lượng / diện tích (như hồ sơ, chưa kể tự trọng gối kê).</p>
      <details><summary>Lời giải</summary><ol className="steps">{r.stack.steps.map((l, i) => <li key={i}>{l}</li>)}</ol></details>
    </Card>
  );
}
