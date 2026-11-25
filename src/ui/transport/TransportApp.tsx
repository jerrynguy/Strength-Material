import { useMemo } from 'react';
import { fmt } from '../../core/stress';
import {
  DIR_LABEL, EN12195_ROAD, FRICTION_PRESETS, analyzeTransport, toT,
  type Blocking, type Cargo, type Coefficients, type Direct, type Limits, type Road, type TopOver, type TransportModel, type TransportResult, type Vehicle,
} from '../../core/transport';
import { Card, NumField, TextField } from '../fields';
import { TransportView } from './TransportView';

type SetFn = (fn: (m: TransportModel) => TransportModel) => void;

const kt = (kN: number) => <>{fmt(kN, 2)} kN <span className="muted">({fmt(toT(kN), 2)} t)</span></>;
const Pass = ({ ok }: { ok: boolean }) => <b className={ok ? 'pass' : 'fail'}>{ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}</b>;

export function TransportApp({ model, setModel }: { model: TransportModel; setModel: SetFn }) {
  const r = useMemo(() => analyzeTransport(model), [model]);
  const set = (p: Partial<TransportModel>) => setModel((m) => ({ ...m, ...p }));
  const cargo = (p: Partial<Cargo>) => setModel((m) => ({ ...m, cargo: { ...m.cargo, ...p } }));
  const coef = (p: Partial<Coefficients>) => setModel((m) => ({ ...m, coef: { ...m.coef, ...p } }));
  const top = (p: Partial<TopOver>) => setModel((m) => ({ ...m, topOver: { ...m.topOver, ...p } }));
  const dir = (p: Partial<Direct>) => setModel((m) => ({ ...m, direct: { ...m.direct, ...p } }));
  const blk = (p: Partial<Blocking>) => setModel((m) => ({ ...m, blocking: { ...m.blocking, ...p } }));
  const veh = (p: Partial<Vehicle>) => setModel((m) => ({ ...m, vehicle: { ...m.vehicle, ...p } }));
  const lim = (p: Partial<Limits>) => setModel((m) => ({ ...m, limits: { ...m.limits, ...p } }));
  const road = (p: Partial<Road>) => setModel((m) => ({ ...m, road: { ...m.road, ...p } }));
  const c = model.cargo, k = model.coef, v = model.vehicle;
  const muKey = FRICTION_PRESETS.findIndex((f) => f.mu === model.mu);

  return (
    <main className="layout">
      <div className="col-edit">
        <Card title="Hàng hoá">
          <div className="row"><TextField label="Tên bài toán" value={model.title} width={280} onChange={(t) => set({ title: t })} /></div>
          <div className="row">
            <TextField label="Tên hàng" value={c.name} width={160} onChange={(t) => cargo({ name: t })} />
            <NumField label="Khối lượng m" unit="t" value={c.mass} onChange={(x) => cargo({ mass: x })} />
          </div>
          <div className="row">
            <NumField label="Dài bao" unit="m" value={c.length} width={95} onChange={(x) => cargo({ length: x })} />
            <NumField label="Rộng bao" unit="m" value={c.width} width={95} onChange={(x) => cargo({ width: x })} />
            <NumField label="Cao bao" unit="m" value={c.height} width={95} onChange={(x) => cargo({ height: x })} />
          </div>
          <div className="row">
            <NumField label="Chân đế dọc" unit="m" value={c.footL} width={95} title="Khoảng cách giữa hai mép lật theo phương dọc" onChange={(x) => cargo({ footL: x })} />
            <NumField label="Chân đế ngang" unit="m" value={c.footW} width={95} title="Khoảng cách giữa hai mép lật theo phương ngang (ví dụ khoảng cách hai gối nêm ngoài cùng)" onChange={(x) => cargo({ footW: x })} />
            <NumField label="Cao trọng tâm d" unit="m" value={c.cgH} width={95} title="Tính từ mặt sàn xe" onChange={(x) => cargo({ cgH: x })} />
          </div>
          <div className="row">
            <NumField label="Trọng tâm cách mép trước sàn" unit="m" value={c.cgX} onChange={(x) => cargo({ cgX: x })} />
          </div>
          <p className="hint">Trọng tâm coi như nằm giữa chân đế. Nhiều kiện giống nhau xếp chung một khối thì nhập tổng khối lượng.</p>
        </Card>

        <Card title="Ma sát & hệ số EN 12195-1" actions={<button onClick={() => coef({ ...EN12195_ROAD })}>Về mặc định đường bộ</button>}>
          <div className="row">
            <NumField label="Hệ số ma sát μ" value={model.mu} width={90} onChange={(x) => set({ mu: x })} />
            <label className="field">
              <span className="field-label">Tra theo cặp vật liệu (phụ lục B)</span>
              <span className="field-input">
                <select value={muKey} onChange={(e) => { const f = FRICTION_PRESETS[+e.target.value]; if (f) set({ mu: f.mu }); }}>
                  <option value={-1}>— chọn —</option>
                  {FRICTION_PRESETS.map((f, i) => <option key={i} value={i}>{f.label}: μ = {f.mu}</option>)}
                </select>
              </span>
            </label>
          </div>
          <div className="row">
            <NumField label="c_x tiến" unit="g" value={k.cxF} width={80} onChange={(x) => coef({ cxF: x })} />
            <NumField label="c_x lùi" unit="g" value={k.cxR} width={80} onChange={(x) => coef({ cxR: x })} />
            <NumField label="c_y ngang" unit="g" value={k.cy} width={80} onChange={(x) => coef({ cy: x })} />
            <NumField label="c_y lật" unit="g" value={k.cyTip} width={80} onChange={(x) => coef({ cyTip: x })} />
            <NumField label="c_z" unit="g" value={k.cz} width={80} onChange={(x) => coef({ cz: x })} />
          </div>
          <div className="row">
            <NumField label="f_s dọc" value={k.fsLong} width={70} onChange={(x) => coef({ fsLong: x })} />
            <NumField label="f_s ngang" value={k.fsTrans} width={70} onChange={(x) => coef({ fsTrans: x })} />
            <NumField label="f_μ" value={k.fmu} width={70} onChange={(x) => coef({ fmu: x })} />
          </div>
          <p className="hint">Đường bộ: c_x = 0,8 (tiến), 0,5 (lùi), c_y = 0,5, c_z = 1,0. f_s là hệ số an toàn cho chằng vắt qua nóc; f_μ = 0,75 quy đổi ma sát khi chằng trực tiếp hoặc chặn.
            Hàng dễ lắc lư (wobbling) nên tăng c_y lật. Có thể sửa các hệ số theo quy trình riêng.</p>
        </Card>

        <Card title="Chằng buộc">
          <p className="lead">Chằng vắt qua nóc (top-over)</p>
          <div className="row">
            <NumField label="Số dây n" value={model.topOver.n} width={70} onChange={(x) => top({ n: Math.max(0, Math.round(x)) })} />
            <NumField label="Góc với sàn α" unit="°" value={model.topOver.alpha} width={80} onChange={(x) => top({ alpha: x })} />
            <NumField label="STF" unit="daN" value={model.topOver.stf} width={95} onChange={(x) => top({ stf: x })} />
            <NumField label="LC" unit="daN" value={model.topOver.lc} width={95} onChange={(x) => top({ lc: x })} />
          </div>
          <p className="lead">Chằng trực tiếp (chéo)</p>
          <div className="row">
            <NumField label="Nhánh làm việc – dọc" value={model.direct.nLong} width={70} title="Số nhánh cùng giữ hàng theo mỗi phương dọc (tiến hoặc lùi)" onChange={(x) => dir({ nLong: Math.max(0, Math.round(x)) })} />
            <NumField label="– ngang" value={model.direct.nTrans} width={70} title="Số nhánh cùng giữ hàng theo phương ngang (một phía)" onChange={(x) => dir({ nTrans: Math.max(0, Math.round(x)) })} />
            <NumField label="LC mỗi nhánh" unit="daN" value={model.direct.lc} width={100} onChange={(x) => dir({ lc: x })} />
          </div>
          <div className="row">
            <NumField label="Góc với sàn α" unit="°" value={model.direct.alpha} width={80} onChange={(x) => dir({ alpha: x })} />
            <NumField label="Góc với trục dọc β" unit="°" value={model.direct.beta} width={80} onChange={(x) => dir({ beta: x })} />
          </div>
          <p className="lead">Chặn (blocking) — khả năng chịu lực BC</p>
          <div className="row">
            <NumField label="Phía trước" unit="kN" value={model.blocking.fwd} width={90} onChange={(x) => blk({ fwd: x })} />
            <NumField label="Phía sau" unit="kN" value={model.blocking.rear} width={90} onChange={(x) => blk({ rear: x })} />
            <NumField label="Hai bên" unit="kN" value={model.blocking.side} width={90} onChange={(x) => blk({ side: x })} />
          </div>
          <p className="hint">Nhập 0 nếu không dùng. Xích, cáp ghi SWL theo tấn: LC ≈ SWL·981 daN (5 t ≈ 4900 daN). Chằng chéo 4 nhánh đối xứng: 2 nhánh làm việc mỗi phương.</p>
        </Card>

        <Card title="Xe đầu kéo & sơ mi rơ moóc">
          <div className="row">
            <NumField label="Dài sàn" unit="m" value={v.deckL} width={90} onChange={(x) => veh({ deckL: x })} />
            <NumField label="Cao mặt sàn" unit="m" value={v.deckH} width={90} onChange={(x) => veh({ deckH: x })} />
            <NumField label="Rộng xe" unit="m" value={v.width} width={90} onChange={(x) => veh({ width: x })} />
          </div>
          <div className="row">
            <NumField label="Chốt kéo cách mép trước" unit="m" value={v.kingpinX} width={90} onChange={(x) => veh({ kingpinX: x })} />
            <NumField label="Tự trọng SMRM" unit="t" value={v.trailerTare} width={90} onChange={(x) => veh({ trailerTare: x })} />
            <NumField label="Trọng tâm SMRM" unit="m" value={v.trailerCgX} width={90} onChange={(x) => veh({ trailerCgX: x })} />
          </div>
          <div className="row">
            {v.axles.map((a, i) => (
              <NumField key={i} label={`Trục ${i + 1}`} unit="m" value={a.x} width={85} onChange={(x) => veh({ axles: v.axles.map((b, j) => (j === i ? { x } : b)) })} />
            ))}
            <button onClick={() => veh({ axles: [...v.axles, { x: (v.axles.at(-1)?.x ?? v.deckL - 2) + 1.31 }] })}>+ trục</button>
            {v.axles.length > 1 && <button className="del" onClick={() => veh({ axles: v.axles.slice(0, -1) })}>− trục</button>}
          </div>
          <div className="row">
            <NumField label="Đầu kéo: trục trước (không tải)" unit="t" value={v.tractorFront} width={90} onChange={(x) => veh({ tractorFront: x })} />
            <NumField label="Cụm sau (không tải)" unit="t" value={v.tractorRear} width={90} onChange={(x) => veh({ tractorRear: x })} />
            <NumField label="Số trục sau" value={v.tractorRearAxles} width={60} onChange={(x) => veh({ tractorRearAxles: Math.max(1, Math.round(x)) })} />
          </div>
          <div className="row">
            <NumField label="Chiều dài cơ sở WB" unit="m" value={v.wheelbase} width={90} title="Trục trước → tâm cụm trục sau" onChange={(x) => veh({ wheelbase: x })} />
            <NumField label="Mâm kéo trước tâm cụm sau e" unit="m" value={v.fifthWheelOffset} width={90} onChange={(x) => veh({ fifthWheelOffset: x })} />
          </div>
          <p className="hint">Toạ độ dọc tính từ mép trước sàn sơ mi rơ moóc, hướng về phía sau. Các trục trong cùng cụm coi như chịu tải bằng nhau (hệ treo cân bằng).</p>
        </Card>

        <Card title="Giới hạn cho phép">
          <div className="row">
            <NumField label="Trục trước" unit="t" value={model.limits.frontAxle} width={80} onChange={(x) => lim({ frontAxle: x })} />
            <NumField label="Cụm sau đầu kéo" unit="t" value={model.limits.tractorGroup} width={80} onChange={(x) => lim({ tractorGroup: x })} />
            <NumField label="Cụm trục SMRM" unit="t" value={model.limits.trailerGroup} width={80} onChange={(x) => lim({ trailerGroup: x })} />
            <NumField label="Tổng" unit="t" value={model.limits.gross} width={80} onChange={(x) => lim({ gross: x })} />
          </div>
          <div className="row">
            <NumField label="Cao tối đa" unit="m" value={model.limits.height} width={80} onChange={(x) => lim({ height: x })} />
            <NumField label="Rộng tối đa" unit="m" value={model.limits.width} width={80} onChange={(x) => lim({ width: x })} />
          </div>
          <p className="hint">Giá trị mặc định chỉ để tham khảo (trục đơn 10 t, cụm 2 trục 18 t, cụm 3 trục 24 t, cao 4,2 m, rộng 2,5 m). Đối chiếu văn bản hiện hành và giấy phép lưu hành. Nhập 0 để bỏ qua.</p>
        </Card>

        <Card title="Điều kiện đường (đối chiếu)">
          <div className="row">
            <NumField label="Độ dốc θ" unit="°" value={model.road.slope} width={80} onChange={(x) => road({ slope: x })} />
            <NumField label="Vận tốc vào cua" unit="km/h" value={model.road.vCurve} width={90} onChange={(x) => road({ vCurve: x })} />
            <NumField label="Bán kính cua R" unit="m" value={model.road.radius} width={80} onChange={(x) => road({ radius: x })} />
            <NumField label="Gia tốc phanh a" unit="m/s²" value={model.road.brake} width={90} onChange={(x) => road({ brake: x })} />
          </div>
          <p className="hint">Dùng để đối chiếu cách tính tĩnh học trong hồ sơ (lực theo dốc, ly tâm, phanh) với hệ số EN 12195-1.</p>
        </Card>
      </div>

      <div className="col-res">
        <Card title={model.title || 'Sơ đồ'}>
          <TransportView model={model} />
        </Card>
        <ConclusionCard r={r} />
        <SlideCard r={r} />
        <TipCard r={r} />
        <AxleCard r={r} />
        <RoadCard r={r} model={model} />
      </div>
    </main>
  );
}

export function conclusionItems(r: TransportResult) {
  return [
    ...r.slide.map((s) => ({ label: `Trượt – ${DIR_LABEL[s.dir].toLowerCase()}`, ok: s.ok, detail: `F = ${fmt(s.demand, 1)} kN; khả năng giữ ${fmt(s.capacity, 1)} kN; UC = ${fmt(s.uc, 3)}` })),
    ...r.tip.map((x) => ({ label: `Lật – ${DIR_LABEL[x.dir].toLowerCase()}`, ok: x.ok, detail: `M_lật = ${fmt(x.mOver, 1)}; M_chống = ${fmt(x.mStab + x.mLash, 1)} kN·m` })),
    ...r.axle.checks.map((a) => ({ label: a.label, ok: a.ok, detail: `${fmt(a.value, 2)} t${a.limit > 0 ? ` so với ${fmt(a.limit, 2)} t` : ''}` })),
    ...r.dim.checks.map((a) => ({ label: a.label, ok: a.ok, detail: `${fmt(a.value, 3)} m${a.limit > 0 ? ` so với ${fmt(a.limit, 2)} m` : ''}` })),
  ];
}

function ConclusionCard({ r }: { r: TransportResult }) {
  return (
    <Card title="Kết luận chung">
      <div className={`status ${r.ok ? 'status-tinh-dinh' : 'status-bien-hinh'}`}>{r.ok ? 'Phương án vận chuyển ĐẠT các kiểm tra' : 'Có hạng mục KHÔNG ĐẠT'}</div>
      <table className="grid">
        <thead><tr><th>Hạng mục</th><th>Kết quả</th><th>Kết luận</th></tr></thead>
        <tbody>{conclusionItems(r).map((it, i) => <tr key={i}><td>{it.label}</td><td>{it.detail}</td><td><Pass ok={it.ok} /></td></tr>)}</tbody>
      </table>
      {r.warnings.map((w, i) => <p key={i} className="warn">{w}</p>)}
    </Card>
  );
}

function SlideCard({ r }: { r: TransportResult }) {
  return (
    <Card title="Chống trượt (EN 12195-1)">
      <table className="grid">
        <thead><tr><th>Phương</th><th>c</th><th>Lực quán tính</th><th>Ma sát</th><th>Vắt nóc</th><th>Trực tiếp</th><th>Chặn</th><th>UC</th><th></th></tr></thead>
        <tbody>
          {r.slide.map((s) => (
            <tr key={s.dir}>
              <td>{DIR_LABEL[s.dir]}</td><td>{s.c}</td><td>{kt(s.demand)}</td><td>{fmt(s.friction, 2)}</td><td>{fmt(s.topOver, 2)}</td><td>{fmt(s.direct, 2)}</td><td>{fmt(s.block, 2)}</td>
              <td><b>{fmt(s.uc, 3)}</b></td><td><Pass ok={s.ok} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Lực (kN). UC = lực quán tính / tổng khả năng giữ. Khi có chằng trực tiếp hoặc chặn, ma sát dùng μ·f_μ cho mọi thành phần (thiên về an toàn).</p>
      {r.slide.map((s) => (
        <details key={s.dir}><summary>Lời giải – {DIR_LABEL[s.dir].toLowerCase()}</summary><ol className="steps">{s.steps.map((l, i) => <li key={i}>{l}</li>)}</ol></details>
      ))}
    </Card>
  );
}

function TipCard({ r }: { r: TransportResult }) {
  return (
    <Card title="Chống lật (EN 12195-1)">
      <table className="grid">
        <thead><tr><th>Phương</th><th>c</th><th>b (m)</th><th>d (m)</th><th>M lật (kN·m)</th><th>M chống (kN·m)</th><th>Dây cần</th><th></th></tr></thead>
        <tbody>
          {r.tip.map((x) => (
            <tr key={x.dir}>
              <td>{DIR_LABEL[x.dir]}</td><td>{x.c}</td><td>{fmt(x.b, 3)}</td><td>{fmt(x.d, 3)}</td><td>{fmt(x.mOver, 2)}</td>
              <td>{fmt(x.mStab, 2)}{x.mLash > 0 && <> + {fmt(x.mLash, 2)}</>}</td><td>{x.stable ? 'không cần' : x.nTopOverReq ?? '—'}</td><td><Pass ok={x.ok} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Hàng tự ổn định khi b/d ≥ c/c_z. Dây vắt qua nóc chống lật ngang với mô men n·F_T·w·sinα/f_s.</p>
      {r.tip.map((x) => (
        <details key={x.dir}><summary>Lời giải – {DIR_LABEL[x.dir].toLowerCase()}</summary><ol className="steps">{x.steps.map((l, i) => <li key={i}>{l}</li>)}</ol></details>
      ))}
    </Card>
  );
}

function AxleCard({ r }: { r: TransportResult }) {
  const a = r.axle;
  return (
    <Card title="Tải trọng trục & kích thước">
      {a.error && <p className="error">{a.error}</p>}
      <table className="grid">
        <thead><tr><th>Hạng mục</th><th>Giá trị</th><th>Giới hạn</th><th></th></tr></thead>
        <tbody>
          <tr><td>Tải chốt kéo</td><td>{fmt(a.kingpin, 3)} t</td><td>—</td><td></td></tr>
          {a.checks.map((c, i) => <tr key={i}><td>{c.label}</td><td>{fmt(c.value, 3)} t</td><td>{c.limit > 0 ? `${c.limit} t` : '—'}</td><td><Pass ok={c.ok} /></td></tr>)}
          <tr><td>Mỗi trục sơ mi rơ moóc</td><td>{fmt(a.perTrailerAxle, 3)} t</td><td>—</td><td></td></tr>
          {r.dim.checks.map((c, i) => <tr key={'d' + i}><td>{c.label}</td><td>{fmt(c.value, 3)} m</td><td>{c.limit > 0 ? `${c.limit} m` : '—'}</td><td><Pass ok={c.ok} /></td></tr>)}
        </tbody>
      </table>
      <details><summary>Lời giải tải trục</summary><ol className="steps">{a.steps.map((l, i) => <li key={i}>{l}</li>)}</ol></details>
    </Card>
  );
}

function RoadCard({ r, model }: { r: TransportResult; model: TransportModel }) {
  const x = r.road;
  return (
    <Card title="Đối chiếu điều kiện đường">
      <table className="grid">
        <tbody>
          <tr><td>Thành phần theo dốc m·g·sinθ</td><td>{kt(x.slope)}</td></tr>
          <tr><td>Lực ly tâm m·v²/R</td><td>{kt(x.centrifugal)}</td></tr>
          <tr><td>Lực quán tính phanh m·a</td><td>{kt(x.braking)}</td></tr>
          <tr><td>Ma sát μ·m·g·cosθ</td><td>{kt(x.frictionRoad)}</td></tr>
          <tr><td>c_x tương đương (phanh khi xuống dốc)</td><td>{fmt(x.cxRoad, 3)} g {x.coveredX ? '≤' : '>'} {model.coef.cxF} g (EN) {x.coveredX ? '— EN bao trùm' : ''}</td></tr>
          <tr><td>c_y tương đương (vào cua)</td><td>{fmt(x.cyRoad, 3)} g {x.coveredY ? '≤' : '>'} {model.coef.cy} g (EN) {x.coveredY ? '— EN bao trùm' : ''}</td></tr>
        </tbody>
      </table>
      <details><summary>Lời giải</summary><ol className="steps">{x.steps.map((l, i) => <li key={i}>{l}</li>)}</ol></details>
    </Card>
  );
}
