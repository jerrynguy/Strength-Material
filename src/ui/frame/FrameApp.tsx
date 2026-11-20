import { useMemo, useState } from 'react';
import { labelFor } from '../../core/classify';
import { analyzeFrame, memberLocal, type FrameModel, type FrameResult, type MemberResult } from '../../core/frame';
import { sectionSteps } from '../../core/steps';
import { fmt } from '../../core/stress';
import type { InternalForces } from '../../core/types';
import { Card, NumField, Select } from '../fields';
import { StressPanel } from '../results';
import { designFrame } from '../../core/design';
import { DesignCard } from '../DesignCard';
import { FrameStabilityCard } from '../stability/StabilityChecks';
import { FrameBeamColumnCard } from '../stability/BeamColumnCards';
import { LocalCard } from '../stability/LocalCard';
import type { LocalOptions } from '../../core/localBuckling';
import { FrameGeneral, FrameGeometry, FrameLoads } from './FrameEditor';
import { FrameView, type FrameViewMode } from './FrameView';

const STATUS = { 'tinh-dinh': 'Hệ TĨNH ĐỊNH', 'sieu-tinh': 'Hệ SIÊU TĨNH', 'bien-hinh': 'Hệ BIẾN HÌNH (không chịu lực được)' };

const toIF = (f: { N: number; Q: number; M: number }): InternalForces => ({ N: f.N, Qy: f.Q, Qz: 0, T: 0, Mz: f.M, My: 0 });

export function memberClass(mr: MemberResult) {
  let n = 0, q = 0, mm = 0, nSigned = 0;
  for (const s of mr.samples) {
    n = Math.max(n, Math.abs(s.N)); q = Math.max(q, Math.abs(s.Q)); mm = Math.max(mm, Math.abs(s.M));
    if (Math.abs(s.N) > Math.abs(nSigned)) nSigned = s.N;
  }
  const scale = Math.max(n, q, mm, 1e-9);
  return labelFor({ N: n, Qy: q, Qz: 0, T: 0, Mz: mm, My: 0 }, 1e-7 * scale, 1e-7 * scale, Math.sign(nSigned));
}

export function FrameApp({ model, setModel, replace, local, setLocal }: {
  local: LocalOptions;
  setLocal: (o: LocalOptions) => void;
  model: FrameModel;
  setModel: (fn: (m: FrameModel) => FrameModel) => void;
  replace: (m: FrameModel) => void;
}) {
  const [view, setView] = useState<FrameViewMode>('M');
  const [pick, setPick] = useState<{ memberId: string; s: number } | null>(null);
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [designSec, setDesignSec] = useState<string>('');
  const [memberMu, setMemberMu] = useState<Record<string, number>>({});
  const [muOut, setMuOut] = useState<Record<string, number>>({});
  const [so, setSo] = useState(false);
  const [localMem, setLocalMem] = useState('');
  const set = setModel;
  const res1 = useMemo(() => analyzeFrame(model, { buckling: true }), [model]);
  const resSO = useMemo(() => (so ? analyzeFrame(model, { secondOrder: true, buckling: true }) : null), [model, so]);
  const res = resSO && resSO.ok ? resSO : res1;
  const mr = res.ok ? res.members.find((m) => m.id === pick?.memberId) ?? res.members[0] : undefined;
  const sPick = mr ? Math.min(pick?.memberId === mr.id ? pick.s : mr.L / 2, mr.L) : 0;

  return (
    <main className="layout">
      <div className="col-edit">
        <FrameGeneral model={model} set={set} onReplace={replace} />
        <FrameGeometry model={model} set={set} />
        <FrameLoads model={model} set={set} />
        <Card title="Quy ước dấu (khung)">
          <ul className="steps">
            <li>Hệ tổng thể: X sang phải, Y lên trên; mô men ↺ dương.</li>
            <li>Mỗi thanh có trục x′ từ đầu i → j, y′ quay +90° từ x′. Đổi hướng i/j sẽ đổi dấu Q (N và hình biểu đồ M không đổi).</li>
            <li>N &gt; 0 kéo. M vẽ về phía thớ căng (không cần dấu), giá trị in kèm dấu theo quy ước: M &gt; 0 căng thớ phía −y′.</li>
          </ul>
        </Card>
      </div>
      <div className="col-res">
        <Card title={model.title || 'Sơ đồ khung'} actions={
          <div className="seg">
            {([['model', 'Sơ đồ'], ['N', 'N'], ['Q', 'Q'], ['M', 'M'], ['deform', 'Biến dạng'], ['buckle', 'Mất ổn định']] as [FrameViewMode, string][]).map(([k, l]) => (
              <button key={k} className={view === k ? 'on' : ''} disabled={(k !== 'model' && !res.ok) || (k === 'buckle' && !res.buckling)} onClick={() => setView(k)}>{l}</button>
            ))}
          </div>
        }>
          <FrameView model={model} res={res} mode={res.ok ? view : 'model'} pick={mr ? { memberId: mr.id, s: sPick } : null}
            onPick={(memberId, s) => setPick({ memberId, s })} />
          <div className="row checks">
            <label className="check">
              <input type="checkbox" checked={so} onChange={(e) => setSo(e.target.checked)} />
              Phân tích bậc hai (P-Δ) — kể ảnh hưởng lực dọc lên chuyển vị và mô men
            </label>
          </div>
          {so && resSO && !resSO.ok && <p className="error">{resSO.errors[0]} Đang hiển thị kết quả bậc nhất.</p>}
          {so && resSO?.ok && <p className="hint">Đang hiển thị kết quả bậc hai (cân bằng trên hình dạng đã biến dạng).</p>}
          <p className="hint">
            {view === 'M' ? 'Biểu đồ mô men vẽ về phía thớ căng. ' : ''}Bấm vào một thanh để chọn mặt cắt tính ứng suất.
          </p>
        </Card>
        <FrameDeterminacy res={res} />
        {res.ok && (
          <>
            <FrameReactions res={res} model={model} />
            <FrameMembers res={res} />
            <FrameDisp res={res} />
            <FrameStabilityCard res={res1} model={model} mu={memberMu} setMu={setMemberMu} local={local} />
            <FrameBeamColumnCard model={model} res={res1} muOut={muOut} setMuOut={setMuOut} local={local} />
            {(() => {
              const lm = res1.members.find((m) => m.id === localMem) ?? res1.members[0];
              if (!lm) return null;
              return (
                <LocalCard
                  key={`local-${lm.id}`}
                  title={`Ổn định cục bộ bản cánh, bản bụng — thanh ${lm.name}`}
                  aLabel={`a sườn ngang của ${lm.name}${model.members.find((x) => x.id === lm.id)?.stiffenerSpacing !== undefined ? ' (riêng)' : ' (= chung)'}`}
                  fyLabel={`f_y của ${lm.name}${model.members.find((x) => x.id === lm.id)?.fy !== undefined ? ' (riêng)' : lm.material.fy ? ' (theo vật liệu)' : ' (= chung)'}`}
                  spec={lm.sectionSpec}
                  material={lm.material}
                  opt={memberLocal(local, model.members.find((x) => x.id === lm.id), lm.material)}
                  setOpt={(o) => {
                    const cur = memberLocal(local, model.members.find((x) => x.id === lm.id), lm.material);
                    const patch: { fy?: number; stiffenerSpacing?: number } = {};
                    if (o.fy !== cur.fy) patch.fy = o.fy;
                    if (o.stiffenerSpacing !== cur.stiffenerSpacing) patch.stiffenerSpacing = o.stiffenerSpacing;
                    if (Object.keys(patch).length) set((m) => ({ ...m, members: m.members.map((x) => (x.id === lm.id ? { ...x, ...patch } : x)) }));
                  }}
                  forces={lm.samples.map((sm) => ({ x: sm.s, N: sm.N, Qy: sm.Q, Qz: 0, T: 0, Mz: sm.M, My: 0 }))}
                  controls={
                    <>
                      <Select label="Thanh" value={lm.id} onChange={setLocalMem}
                        options={res1.members.map((m) => ({ value: m.id, label: m.name }))} />
                      <NumField label="f_y chung của khung" unit="MPa" value={local.fy} width={120}
                        onChange={(v) => setLocal({ ...local, fy: v })} title="Dùng cho các thanh không đặt f_y riêng" />
                      <NumField label="a chung của khung" unit="mm" value={local.stiffenerSpacing} width={120}
                        onChange={(v) => setLocal({ ...local, stiffenerSpacing: v })} title="Dùng cho các thanh không đặt giá trị riêng" />
                      {model.members.find((x) => x.id === lm.id)?.fy !== undefined && (
                        <button onClick={() => set((m) => ({ ...m, members: m.members.map((x) => (x.id === lm.id ? { ...x, fy: undefined } : x)) }))}>
                          Bỏ f_y riêng của {lm.name}
                        </button>
                      )}
                      {model.members.find((x) => x.id === lm.id)?.stiffenerSpacing !== undefined && (
                        <button onClick={() => set((m) => ({ ...m, members: m.members.map((x) => (x.id === lm.id ? { ...x, stiffenerSpacing: undefined } : x)) }))}>
                          Bỏ a riêng của {lm.name}
                        </button>
                      )}
                    </>
                  }
                />
              );
            })()}
            {model.sections.length > 0 && (() => {
              const sid = model.sections.some((x) => x.id === designSec) ? designSec : model.sections[0].id;
              return (
                <DesignCard
                  allowable={model.material.allowable}
                  run={(o) => designFrame(model, sid, { ...o, memberMu })}
                  showMu={false}
                  localOpt={local}
                  apply={(spec) => set((m) => ({ ...m, sections: m.sections.map((x) => (x.id === sid ? { ...x, spec } : x)) }))}
                  extraControls={<Select label="Tiết diện cần chọn" value={sid} onChange={setDesignSec}
                    options={model.sections.map((x) => ({ value: x.id, label: `${x.name} (${model.members.filter((b) => b.sectionId === x.id).map((b) => b.name).join(', ')})` }))} />}
                  note="Với khung: kiểm tra mọi thanh dùng tiết diện đã chọn; độ võng là độ võng tương đối của thanh so với dây cung."
                />
              );
            })()}
            {mr && (
              <StressPanel
                key={`stress-${mr.id}`}
                title={`Ứng suất tại mặt cắt trên thanh ${mr.name}`}
                sec={mr.section}
                spec={mr.sectionSpec}
                material={mr.material}
                F={toIF(mr.internalAt(sPick, side))}
                steps={sectionSteps(
                  {
                    ok: true, keyPoints: mr.keyS, actions: mr.actions, distributed: mr.dists,
                    internalAt: (s, sd) => toIF(mr.internalAt(s, sd)),
                  },
                  sPick, side, 'đầu i',
                ).map((l) => l.replace(/Qy/g, 'Q').replace(/Mz/g, 'M'))}
                controls={
                  <>
                    <Select label="Thanh" value={mr.id} onChange={(id) => setPick({ memberId: id, s: Math.min(sPick, res.members.find((m) => m.id === id)!.L) })}
                      options={res.members.map((m) => ({ value: m.id, label: `${m.name} (L = ${fmt(m.L, 3)} m)` }))} />
                    <NumField label="Cách đầu i" unit="m" value={sPick} onChange={(v) => setPick({ memberId: mr.id, s: v })} />
                    <Select label="Phía" value={side} onChange={setSide}
                      options={[{ value: 'left', label: 'về phía đầu i (s⁻)' }, { value: 'right', label: 'về phía đầu j (s⁺)' }]} />
                  </>
                }
              />
            )}
          </>
        )}
      </div>
    </main>
  );
}

function FrameDeterminacy({ res }: { res: FrameResult }) {
  const d = res.det;
  return (
    <Card title="Phân tích cấu tạo hình học">
      <div className={`status status-${res.status}`}>
        {STATUS[res.status]}{res.status === 'sieu-tinh' && <> — bậc siêu tĩnh n = {res.degree}</>}
      </div>
      {d && (
        <table className="kv">
          <tbody>
            <tr><th>Ẩn nội lực đầu thanh (3 × số thanh)</th><td>{d.memberUnknowns}</td></tr>
            <tr><th>Ẩn phản lực</th><td>{d.reactionUnknowns}</td></tr>
            <tr><th>Phương trình cân bằng nút</th><td>{d.nodeEquations}</td></tr>
            <tr><th>Điều kiện khớp (M = 0 tại đầu thanh)</th><td>{d.releaseEquations}</td></tr>
            <tr><th>Hạng ma trận cân bằng</th><td>{d.rank}</td></tr>
            <tr><th>Bậc siêu tĩnh n = số ẩn − hạng</th><td><b>{d.stable ? d.degree : '—'}</b></td></tr>
          </tbody>
        </table>
      )}
      <p className="hint">
        Hệ bất biến hình khi hạng ma trận cân bằng bằng số phương trình (giải được với mọi tải). Cách đếm này tự phát hiện cả biến hình tức thời
        (ba khớp thẳng hàng, các gối di động đồng quy/song song...).
      </p>
      {res.errors.map((e, i) => <p key={i} className="error">{e}</p>)}
      {res.warnings.map((w, i) => <p key={i} className="warn">{w}</p>)}
    </Card>
  );
}

function FrameReactions({ res, model }: { res: FrameResult; model: FrameModel }) {
  const angled = model.supports.some((s) => s.angle % 180 !== 0);
  return (
    <Card title="Phản lực liên kết">
      <table className="grid">
        <thead><tr><th>Nút</th><th>R<sub>X</sub> (kN)</th><th>R<sub>Y</sub> (kN)</th><th>M (kN·m)</th>{angled && <><th>R⊥ mặt tựa</th><th>R∥ mặt tựa</th></>}</tr></thead>
        <tbody>
          {res.reactions.map((r) => (
            <tr key={r.supportId}>
              <td><b>{r.name}</b></td><td>{fmt(r.Rx, 3)}</td><td>{fmt(r.Ry, 3)}</td><td>{fmt(r.M, 3)}</td>
              {angled && <><td>{fmt(r.Rn, 3)}</td><td>{fmt(r.Rt, 3)}</td></>}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Kiểm tra cân bằng toàn hệ: ΣX = {fmt(res.residual.X, 3)}, ΣY = {fmt(res.residual.Y, 3)}, ΣM = {fmt(res.residual.M, 3)}.
      </p>
    </Card>
  );
}

function FrameMembers({ res }: { res: FrameResult }) {
  return (
    <Card title="Nội lực đầu thanh & dạng chịu lực">
      <table className="grid">
        <thead>
          <tr><th>Thanh</th><th>α (°)</th><th>N<sub>i</sub></th><th>Q<sub>i</sub></th><th>M<sub>i</sub></th><th>N<sub>j</sub></th><th>Q<sub>j</sub></th><th>M<sub>j</sub></th><th>|M|max</th><th>Dạng chịu lực</th></tr>
        </thead>
        <tbody>
          {res.members.map((m) => {
            const a = m.internalAt(0, 'right'), b = m.internalAt(m.L, 'left');
            let best = m.samples[0];
            for (const s of m.samples) if (Math.abs(s.M) > Math.abs(best.M)) best = s;
            const c = memberClass(m);
            return (
              <tr key={m.id}>
                <td><b>{m.name}</b></td>
                <td>{fmt((Math.atan2(m.s, m.c) * 180) / Math.PI, 2)}</td>
                <td>{fmt(a.N, 2)}</td><td>{fmt(a.Q, 2)}</td><td>{fmt(a.M, 2)}</td>
                <td>{fmt(b.N, 2)}</td><td>{fmt(b.Q, 2)}</td><td>{fmt(b.M, 2)}</td>
                <td>{fmt(best.M, 2)} <span className="muted">@{fmt(best.s, 2)} m</span></td>
                <td>{c.label}{c.complex && <span className="tag small">phức tạp</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hint">Đơn vị kN, kN·m. Chỉ số i, j: mặt cắt sát đầu i, đầu j của thanh.</p>
    </Card>
  );
}

function FrameDisp({ res }: { res: FrameResult }) {
  return (
    <Card title="Chuyển vị nút">
      <table className="grid">
        <thead><tr><th>Nút</th><th>u<sub>X</sub> (mm)</th><th>u<sub>Y</sub> (mm)</th><th>Tổng (mm)</th><th>Góc xoay (rad)</th></tr></thead>
        <tbody>
          {res.nodeDisp.map((d) => (
            <tr key={d.nodeId}>
              <td><b>{d.name}</b></td><td>{fmt(d.ux, 4)}</td><td>{fmt(d.uy, 4)}</td><td>{fmt(Math.hypot(d.ux, d.uy), 4)}</td>
              <td>{d.rz === null ? <span className="muted">khớp</span> : fmt(d.rz, 6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
