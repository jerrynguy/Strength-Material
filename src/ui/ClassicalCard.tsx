import { useMemo, useState } from 'react';
import type { AnalysisResult } from '../core/analysis';
import { forceMethod, planarDegree, reactionEquations, unitLoadDisplacement, type DispKind } from '../core/classical';
import { fmt } from '../core/stress';
import type { Model } from '../core/types';
import { Diagram } from './Diagram';
import { Card, NumField, Select } from './fields';

const sub = (i: number) => String(i).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');

/** Lời giải theo phương pháp giáo trình: phản lực, phương pháp lực, chuyển vị bằng lực đơn vị. */
export function ClassicalCard({ model, res, x0Default }: { model: Model; res: AnalysisResult; x0Default?: number }) {
  const [chosen, setChosen] = useState<string[] | null>(null);
  const [x0, setX0] = useState(() => x0Default ?? model.length / 2);
  const [kind, setKind] = useState<DispKind>('v');
  const deg = res.ok ? planarDegree(res) : 0;
  const reac = useMemo(() => (res.ok && deg === 0 ? reactionEquations(model, res) : null), [model, res, deg]);
  const fm = useMemo(() => (res.ok && deg > 0 ? forceMethod(model, res, chosen) : null), [model, res, deg, chosen]);
  const disp = useMemo(() => (res.ok ? unitLoadDisplacement(model, res, Math.min(Math.max(x0, 0), model.length), kind, chosen) : null), [model, res, x0, kind, chosen]);
  if (!res.ok) return null;
  const selected = fm?.redundants.map((u) => u.key) ?? [];
  const toggle = (key: string) => {
    const cur = chosen ?? selected;
    // chọn thêm khi đã đủ số ẩn thừa → bỏ ẩn chọn sớm nhất
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key].slice(-deg);
    setChosen(next);
  };
  const L = model.length;
  return (
    <Card title="Lời giải theo phương pháp giáo trình (mặt phẳng xy)">
      {deg === 0 && reac?.ok && (
        <>
          <h3 className="sub-title">1. Xác định phản lực bằng phương trình cân bằng</h3>
          <ol className="steps">{reac.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <table className="grid">
            <thead><tr><th>Phản lực</th><th>Phương trình cân bằng</th><th>Lời giải số</th></tr></thead>
            <tbody>
              {reac.values.map(({ u, value, fem }) => (
                <tr key={u.key}><td>{u.name}</td><td><b>{fmt(value, 4)}</b> {u.comp === 'rz' ? 'kN·m' : 'kN'}</td><td>{fmt(fem, 4)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {deg > 0 && fm && (
        <>
          <h3 className="sub-title">1. Hệ siêu tĩnh bậc {deg} — phương pháp lực</h3>
          <div className="row checks">
            <span className="muted">Ẩn thừa (chọn đúng {deg}):</span>
            {fm.candidates.map((u) => (
              <label key={u.key} className="check">
                <input type="checkbox" checked={(chosen ?? selected).includes(u.key)} onChange={() => toggle(u.key)} />{u.name}
              </label>
            ))}
            <button onClick={() => setChosen(null)}>Tự động</button>
          </div>
          {chosen && chosen.length !== deg && <p className="warn">Đang chọn {chosen.length}/{deg} ẩn thừa — đang dùng lựa chọn tự động cho đến khi đủ.</p>}
          {!fm.ok ? <p className="error">{fm.reason}</p> : (
            <>
              <ol className="steps">{fm.steps.map((s, i) => <li key={i} className={s.startsWith('   ') ? 'muted' : undefined}>{s.trim()}</li>)}</ol>
              <div className="table-scroll">
                <table className="grid">
                  <thead><tr><th></th>{fm.redundants.map((u, j) => <th key={u.key}>X{sub(j + 1)} = {u.name}</th>)}<th>Δᵢₚ</th><th>cᵢ</th><th>Xᵢ</th></tr></thead>
                  <tbody>
                    {fm.redundants.map((u, i) => (
                      <tr key={u.key}>
                        <th>Phương trình {i + 1}</th>
                        {fm.delta[i].map((d, j) => <td key={j}>δ{sub(i + 1)}{sub(j + 1)} = {d.toExponential(4)}</td>)}
                        <td>{fm.DeltaP[i].toExponential(4)}</td><td>{fmt(fm.c[i], 5)}</td>
                        <td><b>{fmt(fm.X[i], 4)}</b> {u.comp === 'rz' ? 'kN·m' : 'kN'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <table className="grid">
                <thead><tr><th>Phản lực</th><th>Phương pháp lực</th><th>Lời giải số</th></tr></thead>
                <tbody>
                  {fm.reactions.map(({ u, value, fem }) => (
                    <tr key={u.key}><td>{u.name}</td><td><b>{fmt(value, 4)}</b> {u.comp === 'rz' ? 'kN·m' : 'kN'}</td><td>{fmt(fem, 4)}</td></tr>
                  ))}
                </tbody>
              </table>
              <Diagram title="M_P — hệ cơ bản chịu tải" unit="kN·m" tone="d" digits={2} invert data={fm.diagrams.MP} L={L} keyPoints={fm.diagrams.keyPoints} />
              {fm.diagrams.m.map((d, i) => (
                <Diagram key={i} title={`m${sub(i + 1)} — X${sub(i + 1)} = 1 (${fm.redundants[i].name})`} unit="m" tone="a" digits={3} invert data={d} L={L} keyPoints={fm.diagrams.keyPoints} />
              ))}
            </>
          )}
        </>
      )}

      <h3 className="sub-title">2. Chuyển vị bằng lực đơn vị (Mohr – Maxwell, nhân biểu đồ Vereshchagin)</h3>
      <div className="row">
        <NumField label="Tại x" unit="m" value={x0} width={100} onChange={setX0} />
        <Select label="Đại lượng" value={kind} onChange={(v: DispKind) => setKind(v)}
          options={[{ value: 'v', label: 'Độ võng v' }, { value: 'theta', label: 'Góc xoay θ' }, { value: 'u', label: 'Chuyển vị dọc u' }]} />
      </div>
      {disp && !disp.ok && <p className="error">{disp.reason}</p>}
      {disp?.ok && (
        <>
          <p className="ok">
            {kind === 'v' ? 'v' : kind === 'theta' ? 'θ' : 'u'}({fmt(x0, 3)}) = <b>{kind === 'theta' ? `${fmt(disp.value, 6)} rad` : `${fmt(disp.value, 4)} mm`}</b>
            {' '}— lời giải số {kind === 'theta' ? `${fmt(disp.fem, 6)} rad` : `${fmt(disp.fem, 4)} mm`}
          </p>
          <ol className="steps">{disp.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <Diagram title={`m̄ — trạng thái đơn vị (${kind === 'theta' ? 'M̄ = 1' : 'P̄ = 1'} tại x = ${fmt(x0, 3)} m)`} unit="m" tone="a" digits={3} invert data={disp.unitDiagram} L={L} keyPoints={disp.keyPoints} />
        </>
      )}
      <p className="hint">
        Chỉ xét trong mặt phẳng xy (lực dọc, lực đứng, mô men M_z); bỏ qua biến dạng trượt. Biểu đồ mô men vẽ phía thớ căng.
        Nhân biểu đồ: trên mỗi đoạn mà biểu đồ đơn vị là đường thẳng, ∫M·m̄ dx = Ω·ȳ (Ω — diện tích biểu đồ M, ȳ — tung độ m̄ tại trọng tâm Ω).
        Mọi kết quả được đối chiếu với lời giải số (phương pháp phần tử hữu hạn) của ứng dụng.
      </p>
    </Card>
  );
}
