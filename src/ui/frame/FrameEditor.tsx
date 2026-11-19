import { useState } from 'react';
import { DIST_DIR_LABELS, type FDistDir, type FLoad, type FrameModel, type FSupport, type FSupportKind } from '../../core/frame';
import { fdist, fmember, fnode, fnodeLoad, fpoint, fsupport, inclinedBeam } from '../../core/framePresets';
import { SECTION_DEFAULTS } from '../../core/section';
import { uid } from '../../core/presets';
import { fmt } from '../../core/stress';
import { MaterialRow, SectionSpecEditor } from '../editors';
import { Card, NumField, Select, TextField } from '../fields';

type Setter = (fn: (m: FrameModel) => FrameModel) => void;

const SUP_LABELS: Record<FSupportKind, string> = {
  fixed: 'Ngàm', pin: 'Gối cố định (khớp)', roller: 'Gối di động', custom: 'Tuỳ chỉnh',
};

const nextName = (used: string[]) => {
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') if (!used.includes(c)) return c;
  for (let i = 1; ; i++) if (!used.includes(`N${i}`)) return `N${i}`;
};

export function FrameGeneral({ model, set, onReplace }: { model: FrameModel; set: Setter; onReplace: (m: FrameModel) => void }) {
  const [q, setQ] = useState({ l: 4, h: 3, q: -10, dir: 'gyp' as FDistDir, bottom: 'pin' as FSupportKind, top: 'roller' as FSupportKind, topAngle: 0 });
  const angle = (Math.atan2(q.h, q.l) * 180) / Math.PI;
  return (
    <>
      <Card title="Khung & vật liệu">
        <div className="row">
          <TextField label="Tên bài toán" value={model.title} onChange={(v) => set((s) => ({ ...s, title: v }))} width={280} />
        </div>
        <MaterialRow m={model.material} setMat={(p) => set((s) => ({ ...s, material: { ...s.material, ...p } }))} />
      </Card>
      <Card title="Tạo nhanh dầm nghiêng">
        <div className="row">
          <NumField label="Nhịp ngang l" unit="m" value={q.l} onChange={(v) => setQ({ ...q, l: v })} />
          <NumField label="Chênh cao h" unit="m" value={q.h} onChange={(v) => setQ({ ...q, h: v })} />
          <span className="muted small-note">α = {fmt(angle, 2)}°, L = {fmt(Math.hypot(q.l, q.h), 3)} m</span>
        </div>
        <div className="row">
          <NumField label="q (âm = xuống)" unit="kN/m" value={q.q} onChange={(v) => setQ({ ...q, q: v })} />
          <Select label="Cách phân bố" value={q.dir} onChange={(v) => setQ({ ...q, dir: v })}
            options={(Object.keys(DIST_DIR_LABELS) as FDistDir[]).map((k) => ({ value: k, label: DIST_DIR_LABELS[k] }))} />
        </div>
        <div className="row">
          <Select label="Gối chân (A)" value={q.bottom} onChange={(v) => setQ({ ...q, bottom: v })}
            options={(['pin', 'roller', 'fixed'] as FSupportKind[]).map((k) => ({ value: k, label: SUP_LABELS[k] }))} />
          <Select label="Gối đỉnh (B)" value={q.top} onChange={(v) => setQ({ ...q, top: v })}
            options={(['roller', 'pin', 'fixed'] as FSupportKind[]).map((k) => ({ value: k, label: SUP_LABELS[k] }))} />
          <NumField label="Góc mặt tựa B" unit="°" value={q.topAngle} onChange={(v) => setQ({ ...q, topAngle: v })}
            title="0° = mặt tựa nằm ngang (phản lực đứng); bằng α = mặt tựa song song dầm" />
          <button onClick={() => setQ({ ...q, topAngle: Math.round(angle * 1e4) / 1e4 })}>= α</button>
        </div>
        <button className="primary" onClick={() => onReplace(inclinedBeam(q))}>Tạo dầm nghiêng (thay mô hình hiện tại)</button>
        <p className="hint">
          “Theo hình chiếu ngang” dùng cho tải sàn/mái, tuyết, hoạt tải cầu thang. “Theo chiều dài thanh” dùng cho trọng lượng bản thân.
        </p>
      </Card>
    </>
  );
}

export function FrameGeometry({ model, set }: { model: FrameModel; set: Setter }) {
  const nodeOpts = model.nodes.map((n) => ({ value: n.id, label: n.name }));
  const secOpts = model.sections.map((s) => ({ value: s.id, label: s.name }));
  const lenOf = (i: string, j: string) => {
    const a = model.nodes.find((n) => n.id === i), b = model.nodes.find((n) => n.id === j);
    return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0;
  };
  return (
    <>
      <Card title="Nút" actions={
        <button onClick={() => set((m) => {
          const last = m.nodes[m.nodes.length - 1];
          return { ...m, nodes: [...m.nodes, fnode(nextName(m.nodes.map((n) => n.name)), (last?.x ?? 0) + 2, last?.y ?? 0)] };
        })}>+ Nút</button>
      }>
        <table className="edit-table">
          <thead><tr><th>Tên</th><th>X (m)</th><th>Y (m)</th><th /></tr></thead>
          <tbody>
            {model.nodes.map((n) => (
              <tr key={n.id}>
                <td><TextField label="" value={n.name} width={56} onChange={(v) => set((m) => ({ ...m, nodes: m.nodes.map((x) => (x.id === n.id ? { ...x, name: v } : x)) }))} /></td>
                <td><NumField value={n.x} width={90} onChange={(v) => set((m) => ({ ...m, nodes: m.nodes.map((x) => (x.id === n.id ? { ...x, x: v } : x)) }))} /></td>
                <td><NumField value={n.y} width={90} onChange={(v) => set((m) => ({ ...m, nodes: m.nodes.map((x) => (x.id === n.id ? { ...x, y: v } : x)) }))} /></td>
                <td><button className="del" title="Xoá nút (và các thanh, gối, tải nối với nút)" onClick={() => set((m) => {
                  const members = m.members.filter((b) => b.i !== n.id && b.j !== n.id);
                  const mids = new Set(members.map((b) => b.id));
                  return {
                    ...m, nodes: m.nodes.filter((x) => x.id !== n.id), members,
                    supports: m.supports.filter((s) => s.nodeId !== n.id),
                    loads: m.loads.filter((l) => (l.type === 'node' ? l.nodeId !== n.id : mids.has(l.memberId))),
                  };
                })}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Thanh" actions={
        <button disabled={model.nodes.length < 2 || model.sections.length === 0} onClick={() => set((m) => {
          const a = m.nodes[m.nodes.length - 2], b = m.nodes[m.nodes.length - 1];
          return { ...m, members: [...m.members, fmember(`${a.name}${b.name}`, a, b, m.sections[0].id)] };
        })}>+ Thanh</button>
      }>
        {model.members.map((b) => {
          const upd = (p: Partial<typeof b>) => set((m) => ({ ...m, members: m.members.map((x) => (x.id === b.id ? { ...x, ...p } : x)) }));
          return (
            <div key={b.id} className="item">
              <div className="row">
                <TextField label="Tên" value={b.name} width={60} onChange={(v) => upd({ name: v })} />
                <Select label="Đầu i" value={b.i} options={nodeOpts} onChange={(v) => upd({ i: v })} />
                <Select label="Đầu j" value={b.j} options={nodeOpts} onChange={(v) => upd({ j: v })} />
                <Select label="Tiết diện" value={b.sectionId} options={secOpts} onChange={(v) => upd({ sectionId: v })} />
                <button className="del" title="Xoá thanh" onClick={() => set((m) => ({
                  ...m, members: m.members.filter((x) => x.id !== b.id), loads: m.loads.filter((l) => l.type === 'node' || l.memberId !== b.id),
                }))}>✕</button>
              </div>
              <div className="row checks">
                <span className="muted">L = {fmt(lenOf(b.i, b.j), 4)} m</span>
                <label className="check"><input type="checkbox" checked={b.releaseI} onChange={(e) => upd({ releaseI: e.target.checked })} />khớp đầu i</label>
                <label className="check"><input type="checkbox" checked={b.releaseJ} onChange={(e) => upd({ releaseJ: e.target.checked })} />khớp đầu j</label>
              </div>
            </div>
          );
        })}
        <p className="hint">Đầu thanh không đánh dấu khớp là nối cứng vào nút. Đánh dấu khớp cả hai đầu cho thanh dàn.</p>
      </Card>

      <Card title="Gối tựa" actions={
        <button disabled={!model.nodes.length} onClick={() => set((m) => ({ ...m, supports: [...m.supports, fsupport(m.nodes[0], 'pin')] }))}>+ Gối</button>
      }>
        {model.supports.map((s) => {
          const upd = (p: Partial<FSupport>) => set((m) => ({ ...m, supports: m.supports.map((x) => (x.id === s.id ? { ...x, ...p } : x)) }));
          return (
            <div key={s.id} className="item">
              <div className="row">
                <Select label="Tại nút" value={s.nodeId} options={nodeOpts} onChange={(v) => upd({ nodeId: v })} />
                <Select label="Loại" value={s.kind} onChange={(v) => upd({ kind: v })}
                  options={(Object.keys(SUP_LABELS) as FSupportKind[]).map((k) => ({ value: k, label: SUP_LABELS[k] }))} />
                <NumField label="Góc mặt tựa" unit="°" value={s.angle} onChange={(v) => upd({ angle: v })} />
                <button className="del" onClick={() => set((m) => ({ ...m, supports: m.supports.filter((x) => x.id !== s.id) }))}>✕</button>
              </div>
              {s.kind === 'custom' && (
                <div className="row checks">
                  <span className="muted">Chặn:</span>
                  {([['t', 'dọc mặt tựa'], ['n', 'vuông góc mặt tựa'], ['r', 'xoay']] as const).map(([k, l]) => (
                    <label key={k} className="check">
                      <input type="checkbox" checked={s.restraints[k]} onChange={(e) => upd({ restraints: { ...s.restraints, [k]: e.target.checked } })} />{l}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <p className="hint">Góc mặt tựa 0° = nằm ngang (gối di động cho phản lực thẳng đứng). Gối di động trên mặt nghiêng α cho phản lực vuông góc mặt nghiêng.</p>
      </Card>

      <Card title="Tiết diện" actions={
        <button onClick={() => set((m) => ({ ...m, sections: [...m.sections, { id: uid('sec'), name: `TD${m.sections.length + 1}`, spec: structuredClone(SECTION_DEFAULTS.I) }] }))}>+ Tiết diện</button>
      }>
        {model.sections.map((s) => (
          <details key={s.id} className="item" open={model.sections.length === 1}>
            <summary>
              {s.name} <span className="muted">— dùng cho {model.members.filter((b) => b.sectionId === s.id).map((b) => b.name).join(', ') || 'chưa thanh nào'}</span>
            </summary>
            <div className="row">
              <TextField label="Tên" value={s.name} width={140} onChange={(v) => set((m) => ({ ...m, sections: m.sections.map((x) => (x.id === s.id ? { ...x, name: v } : x)) }))} />
              <button className="del" disabled={model.members.some((b) => b.sectionId === s.id)} title="Chỉ xoá được tiết diện chưa dùng"
                onClick={() => set((m) => ({ ...m, sections: m.sections.filter((x) => x.id !== s.id) }))}>✕</button>
            </div>
            <SectionSpecEditor spec={s.spec} size={170}
              onChange={(spec) => set((m) => ({ ...m, sections: m.sections.map((x) => (x.id === s.id ? { ...x, spec } : x)) }))} />
          </details>
        ))}
      </Card>
    </>
  );
}

export function FrameLoads({ model, set }: { model: FrameModel; set: Setter }) {
  const nodeOpts = model.nodes.map((n) => ({ value: n.id, label: n.name }));
  const memOpts = model.members.map((n) => ({ value: n.id, label: n.name }));
  const lenOf = (id: string) => {
    const b = model.members.find((m) => m.id === id);
    const a = b && model.nodes.find((n) => n.id === b.i), c = b && model.nodes.find((n) => n.id === b.j);
    return a && c ? Math.hypot(c.x - a.x, c.y - a.y) : 0;
  };
  const names = model.loads.map((l) => l.name);
  const nm = (p: string) => { for (let i = 1; ; i++) if (!names.includes(`${p}${i}`)) return `${p}${i}`; };
  const upd = (id: string, p: Partial<FLoad>) => set((m) => ({ ...m, loads: m.loads.map((l) => (l.id === id ? ({ ...l, ...p } as FLoad) : l)) }));
  const m0 = model.members[0];
  return (
    <Card title="Tải trọng" actions={
      <>
        <button disabled={!model.nodes.length} onClick={() => set((m) => ({ ...m, loads: [...m.loads, fnodeLoad(nm('P'), m.nodes[0], 0, -10)] }))}>+ Lực/mô men tại nút</button>
        <button disabled={!m0} onClick={() => set((m) => ({ ...m, loads: [...m.loads, fpoint(nm('P'), m0, lenOf(m0.id) / 2, 0, -10)] }))}>+ Lực trên thanh</button>
        <button disabled={!m0} onClick={() => set((m) => ({ ...m, loads: [...m.loads, fdist(nm('q'), m0, 0, lenOf(m0.id), -10)] }))}>+ Phân bố</button>
      </>
    }>
      {model.loads.map((ld) => (
        <div key={ld.id} className="item">
          <div className="row">
            <span className="tag">{ld.type === 'node' ? 'Tại nút' : ld.type === 'mpoint' ? 'Trên thanh' : 'Phân bố'}</span>
            <TextField label="Tên" value={ld.name} width={60} onChange={(v) => upd(ld.id, { name: v })} />
            {ld.type === 'node'
              ? <Select label="Nút" value={ld.nodeId} options={nodeOpts} onChange={(v) => upd(ld.id, { nodeId: v })} />
              : <Select label="Thanh" value={ld.memberId} options={memOpts} onChange={(v) => upd(ld.id, { memberId: v })} />}
            {ld.type !== 'node' && <span className="muted small-note">L = {fmt(lenOf(ld.memberId), 4)} m</span>}
            <button className="del" onClick={() => set((m) => ({ ...m, loads: m.loads.filter((x) => x.id !== ld.id) }))}>✕</button>
          </div>
          {ld.type === 'node' && (
            <div className="row">
              <NumField label="Fx" unit="kN" value={ld.Fx} onChange={(v) => upd(ld.id, { Fx: v })} />
              <NumField label="Fy" unit="kN" value={ld.Fy} onChange={(v) => upd(ld.id, { Fy: v })} />
              <NumField label="M (↺ +)" unit="kN·m" value={ld.M} onChange={(v) => upd(ld.id, { M: v })} />
            </div>
          )}
          {ld.type === 'mpoint' && (
            <div className="row">
              <NumField label="a (từ đầu i)" unit="m" value={ld.a} onChange={(v) => upd(ld.id, { a: v })} />
              <Select label="Hệ trục" value={ld.local ? 'l' : 'g'} onChange={(v) => upd(ld.id, { local: v === 'l' })}
                options={[{ value: 'g', label: 'Tổng thể (X, Y)' }, { value: 'l', label: 'Địa phương (dọc x′, vuông góc y′)' }]} />
              <NumField label={ld.local ? 'Fx′' : 'Fx'} unit="kN" value={ld.Fx} onChange={(v) => upd(ld.id, { Fx: v })} />
              <NumField label={ld.local ? 'Fy′' : 'Fy'} unit="kN" value={ld.Fy} onChange={(v) => upd(ld.id, { Fy: v })} />
              <NumField label="M (↺ +)" unit="kN·m" value={ld.M} onChange={(v) => upd(ld.id, { M: v })} />
            </div>
          )}
          {ld.type === 'mdist' && (
            <>
              <div className="row">
                <Select label="Phương" value={ld.dir} onChange={(v) => upd(ld.id, { dir: v })}
                  options={(Object.keys(DIST_DIR_LABELS) as FDistDir[]).map((k) => ({ value: k, label: DIST_DIR_LABELS[k] }))} />
              </div>
              <div className="row">
                <NumField label="từ a" unit="m" value={ld.a} onChange={(v) => upd(ld.id, { a: v })} />
                <NumField label="đến b" unit="m" value={ld.b} onChange={(v) => upd(ld.id, { b: v })} />
                <NumField label="q₁ tại a" unit="kN/m" value={ld.q1} onChange={(v) => upd(ld.id, { q1: v })} />
                <NumField label="q₂ tại b" unit="kN/m" value={ld.q2} onChange={(v) => upd(ld.id, { q2: v })} />
              </div>
            </>
          )}
        </div>
      ))}
      <p className="hint">
        a, b đo dọc theo thanh từ đầu i (m). Lực theo hệ tổng thể: Fy &lt; 0, q &lt; 0 (phương đứng) là hướng xuống.
        Phương “vuông góc thanh” lấy dương theo trục y′ (quay +90° từ hướng i → j).
      </p>
    </Card>
  );
}
