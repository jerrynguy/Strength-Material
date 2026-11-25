import { fmt } from '../../core/stress';
import { DRIVE_AXLES_DEFAULT, MOD_TYPES, defaultModular, type ModType, type ModularInput, type ModularResult } from '../../core/modular';
import { NumField, Select } from '../fields';

const Pass = ({ ok }: { ok: boolean | null }) => (ok === null ? <span className="muted">—</span> : <b className={ok ? 'pass' : 'fail'}>{ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}</b>);

/** Ô nhập xe module thủy lực — nằm trong thẻ "Xe" của tab Vận chuyển */
export function ModularEditor({ mi, set, cargoMass, others }: { mi: ModularInput; set: (p: Partial<ModularInput>) => void; cargoMass: number; others: number }) {
  const spec = MOD_TYPES[mi.type];
  const spmt = mi.type === 'spmt';
  const unit = (i: number, p: Partial<{ lines: number; drive: number }>) => set({ units: mi.units.map((u, j) => (j === i ? { ...u, ...p } : u)) });
  return (
    <>
      <div className="row">
        <Select<ModType> label="Loại xe module" value={mi.type} options={(Object.keys(MOD_TYPES) as ModType[]).map((k) => ({ value: k, label: MOD_TYPES[k].label }))}
          onChange={(k) => { const d = defaultModular(k); set({ type: k, payloadPerLine: d.payloadPerLine, units: k === 'spmt' ? (mi.units.length ? mi.units : d.units) : mi.units.map((u) => ({ ...u, drive: 0 })) }); }} />
        <NumField label="Tải trọng / trục dòng" unit="t" value={mi.payloadPerLine} width={85} onChange={(x) => set({ payloadPerLine: x })} />
        <NumField label="Tự trọng / trục dòng" unit="t" value={mi.selfPerLine} width={85} onChange={(x) => set({ selfPerLine: x })} />
      </div>
      <p className="hint">{spec.label}: {spec.tires} lốp / trục dòng; khoảng cách trục dòng {fmt(spec.axleSpacing, 2)} m; bề rộng cơ sở {fmt(spec.axleBaseSingle, 2)} m (module đơn) / {fmt(spec.axleBaseDouble, 2)} m (module đôi);
        cao sàn {fmt(spec.deckH, 2)} ± {fmt(spec.stroke, 2)} m. Hàng {fmt(cargoMass, 3)} t lấy từ thẻ Hàng hoá; gối kê / dầm / mâm xoay {fmt(others, 3)} t lấy từ thẻ Tải khác trên xe.</p>
      <p className="lead">Cấu hình module (để trống = dùng số trục dòng cần)</p>
      {mi.units.map((u, i) => (
        <div key={i} className="row sub">
          <NumField label={i === 0 ? 'Số trục dòng' : undefined} value={u.lines} width={80}
            onChange={(x) => { const n = Math.max(1, Math.round(x)); unit(i, spmt ? { lines: n, drive: DRIVE_AXLES_DEFAULT[n] ?? u.drive } : { lines: n }); }} />
          {spmt && <NumField label={i === 0 ? 'Trục chủ động' : undefined} value={u.drive} width={80} title="Module 4 trục dòng: 4; 6 trục dòng: 4; 6 trục dòng 'super 6': 6" onChange={(x) => unit(i, { drive: Math.max(0, Math.round(x)) })} />}
          <button className="del" onClick={() => set({ units: mi.units.filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <div className="row">
        <button onClick={() => set({ units: [...mi.units, { lines: 4, drive: spmt ? 4 : 0 }] })}>+ module 4 trục dòng</button>
        <button onClick={() => set({ units: [...mi.units, { lines: 6, drive: spmt ? 4 : 0 }] })}>+ module 6 trục dòng</button>
        {spmt && <button onClick={() => set({ units: [...mi.units, { lines: 6, drive: 6 }] })}>+ super 6</button>}
      </div>
      <div className="row">
        <NumField label="Lực cản lăn" unit="%" value={mi.rolling} width={75} title="Đường nhựa khô: 3%" onChange={(x) => set({ rolling: x })} />
        <NumField label="Độ dốc" unit="%" value={mi.grade} width={75} onChange={(x) => set({ grade: x })} />
        <NumField label="PPU" unit="t" value={mi.ppu} width={75} title="Trọng lượng bộ nguồn (power pack unit)" onChange={(x) => set({ ppu: x })} />
      </div>
      {spmt ? (
        <div className="row">
          <NumField label="Lực đẩy / trục chủ động" unit="t" value={mi.propulsion} width={85} title="5,0–7,0 t" onChange={(x) => set({ propulsion: x })} />
          <NumField label="PPU / 10 trục dòng" unit="HP" value={mi.hpPer10} width={85} onChange={(x) => set({ hpPer10: x })} />
        </div>
      ) : (
        <div className="row">
          <NumField label="Số xe kéo" value={mi.trucks} width={70} onChange={(x) => set({ trucks: Math.max(0, Math.round(x)) })} />
          <NumField label="Tải trên trục chủ động / xe" unit="t" value={mi.truckDriveWeight} width={85} onChange={(x) => set({ truckDriveWeight: x })} />
          <NumField label="Tự trọng / xe kéo" unit="t" value={mi.truckWeight} width={85} onChange={(x) => set({ truckWeight: x })} />
        </div>
      )}
      <div className="row">
        <NumField label="Độ sâu hố" unit="mm" value={mi.pothole} width={85} onChange={(x) => set({ pothole: x })} />
        <NumField label="Số trục trong nhóm treo" value={mi.axlesPerGroup} width={75} title="Treo 4 điểm: thường 2 trục / nhóm; treo 3 điểm: nhóm lớn 4 trục" onChange={(x) => set({ axlesPerGroup: Math.max(1, Math.round(x)) })} />
      </div>
      <p className="hint">Theo thẻ tham khảo: SPMT 30 t, pull type 25 t mỗi trục dòng; mỗi trục dòng có 2 trục (cụm bánh). Lực kéo cần = (cản lăn + dốc) × tổng trọng lượng.
        Pull type: lực kéo tối đa = 80% trọng lượng trên trục chủ động của xe kéo.</p>
    </>
  );
}

export function ModularTable({ x }: { x: ModularResult }) {
  return (
    <table className="grid">
      <tbody>
        <tr><td>Tải đặt lên xe</td><td>{fmt(x.payload, 3)} t</td><td></td></tr>
        <tr><td>Số trục dòng cần</td><td>{x.linesReq} (đang dùng {x.lines})</td><td></td></tr>
        {x.checks.map((c, i) => <tr key={i}><td>{c.label}</td><td>{c.value}</td><td><Pass ok={c.ok} /></td></tr>)}
        <tr><td>Tổng trọng lượng</td><td>{fmt(x.gvw, 3)} t</td><td></td></tr>
        <tr><td>Lực kéo cần</td><td>{fmt(x.effort, 3)} t</td><td></td></tr>
        {x.ppuHp !== null && <tr><td>Công suất PPU</td><td>{fmt(x.ppuHp, 1)} HP ({fmt(x.ppuKw ?? 0, 1)} kW)</td><td></td></tr>}
        {x.trucksReq !== null && <tr><td>Số xe kéo cần</td><td>{x.trucksReq}</td><td></td></tr>}
        <tr><td>Độ nghiêng khi một nhóm treo qua hố</td><td>{fmt(x.lean, 1)} mm</td><td></td></tr>
        <tr><td>Chiều dài theo số trục dòng (ước tính)</td><td>{x.lines} × {fmt(x.spec.axleSpacing, 2)} = {fmt(x.length, 2)} m</td><td></td></tr>
      </tbody>
    </table>
  );
}
