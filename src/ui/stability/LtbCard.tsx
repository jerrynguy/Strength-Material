import { useMemo, useState } from 'react';
import type { AnalysisResult } from '../../core/analysis';
import { checkFrameMemberLTB, checkLTB, LTB_CURVES, type FrameLtbOptions, type LoadHeight, type LtbCurve, type LtbOptions, type LtbResult } from '../../core/ltb';
import { memberLocal, type FrameModel, type FrameResult } from '../../core/frame';
import type { LocalOptions } from '../../core/localBuckling';
import { uid } from '../../core/presets';
import { fmt } from '../../core/stress';
import type { Model } from '../../core/types';
import { Diagram } from '../Diagram';
import { Card, NumField, Select } from '../fields';

export const defaultLtbOptions = (): LtbOptions => ({ loadHeight: 'top', braces: [], fy: 240, curve: 'auto' });

export function LtbCard({ model, res, opt, setOpt }: {
  model: Model;
  res: AnalysisResult;
  opt: LtbOptions;
  setOpt: (o: LtbOptions) => void;
}) {
  const r = useMemo(() => checkLTB(model, res, opt), [model, res, opt]);
  if (!res.ok || !res.forceSamples.some((s) => s.Mz !== 0)) return null;
  return (
    <Card title="Ổn định uốn – xoắn (mất ổn định ngang của dầm)">
      <div className="row">
        <Select label="Điểm đặt tải" value={opt.loadHeight} onChange={(v: LoadHeight) => setOpt({ ...opt, loadHeight: v })}
          options={[{ value: 'top', label: 'Cánh trên (bất lợi)' }, { value: 'sc', label: 'Tâm cắt' }, { value: 'bottom', label: 'Cánh dưới (có lợi)' }]} />
        <NumField label="f_y" unit="MPa" value={opt.fy} width={100} onChange={(v) => setOpt({ ...opt, fy: v })} title="Dùng chung với thẻ ổn định cục bộ" />
        <Select label="Đường cong ổn định" value={opt.curve} onChange={(v: 'auto' | LtbCurve) => setOpt({ ...opt, curve: v })}
          options={[{ value: 'auto', label: 'Tự động' }, ...(Object.keys(LTB_CURVES) as LtbCurve[]).map((k) => ({ value: k, label: `${k} (α_LT = ${LTB_CURVES[k]})` }))]} />
      </div>
      <div className="row checks">
        <span className="muted">Giằng ngang trong nhịp:</span>
        <button onClick={() => setOpt({ ...opt, braces: [...opt.braces, { id: uid('br'), x: model.length / 2, lateral: true, twist: true }] })}>+ Giằng</button>
      </div>
      {opt.braces.map((b) => {
        const upd = (p: Partial<typeof b>) => setOpt({ ...opt, braces: opt.braces.map((x) => (x.id === b.id ? { ...x, ...p } : x)) });
        return (
          <div key={b.id} className="row checks">
            <NumField label="x" unit="m" value={b.x} width={100} onChange={(v) => upd({ x: v })} />
            <label className="check"><input type="checkbox" checked={b.lateral} onChange={(e) => upd({ lateral: e.target.checked })} />chặn chuyển vị ngang</label>
            <label className="check"><input type="checkbox" checked={b.twist} onChange={(e) => upd({ twist: e.target.checked })} />chặn xoắn</label>
            <button className="del" onClick={() => setOpt({ ...opt, braces: opt.braces.filter((x) => x.id !== b.id) })}>✕</button>
          </div>
        );
      })}
      {!r.applicable ? (
        <p className="muted">{r.reason}</p>
      ) : (
        <>
          <p className={r.ok ? 'ok' : 'error'}>
            {r.ok ? 'Dầm đủ ổn định uốn – xoắn' : 'Dầm KHÔNG đủ ổn định uốn – xoắn'}: |M|max = {fmt(Math.abs(r.Mmax), 2)} kN·m
            {r.ok ? ' ≤ ' : ' > '}χ_LT·W·[σ] = {fmt(r.Mrd, 2)} kN·m ({fmt(r.util * 100, 1)}%).
          </p>
          <table className="kv wide">
            <tbody>
              <tr><th>Mô men tới hạn đàn hồi M_cr</th><td><b>{fmt(r.Mcr, 2)}</b> kN·m (hệ số an toàn n = M_cr/|M|max = {fmt(r.alpha, 3)})</td></tr>
              <tr><th>|M|max</th><td>{fmt(Math.abs(r.Mmax), 3)} kN·m tại x = {fmt(r.xMax, 3)} m</td></tr>
              <tr><th>I_y · I_t · I_w</th><td>{fmt(r.Iweak, 0)} mm⁴ · {fmt(r.It, 0)} mm⁴ · {fmt(r.Iw, 0)} mm⁶</td></tr>
              <tr><th>Độ mảnh λ̄_LT = √(W·f_y/M_cr)</th><td>{fmt(r.lambdaLT, 3)} — đường cong {r.curve} (α_LT = {LTB_CURVES[r.curve]})</td></tr>
              <tr><th>Hệ số giảm χ_LT</th><td>{fmt(r.chi, 4)}</td></tr>
              <tr><th>Mô men cho phép không / có kể uốn – xoắn</th><td>{fmt(r.Mel, 2)} → {fmt(r.Mrd, 2)} kN·m</td></tr>
            </tbody>
          </table>
          {r.warnings.map((w, i) => <p key={i} className="warn">{w}</p>)}
          <Diagram title="Dạng mất ổn định — chuyển vị ngang u (chuẩn hoá)" unit="—" tone="a" digits={2}
            data={r.mode.map((m) => ({ x: m.x, y: m.u }))} L={model.length} keyPoints={[0, model.length, ...opt.braces.map((b) => b.x)]} />
          <Diagram title="Dạng mất ổn định — góc xoắn φ (chuẩn hoá)" unit="—" tone="d" digits={2}
            data={r.mode.map((m) => ({ x: m.x, y: m.phi }))} L={model.length} keyPoints={[0, model.length, ...opt.braces.map((b) => b.x)]} />
          <details>
            <summary>Lời giải từng bước</summary>
            <ul className="steps">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </details>
        </>
      )}
      <p className="hint">
        M_cr tính bằng phần tử hữu hạn với biểu đồ mô men thực (không cần tra C1, C2). Giả thiết: tại gối dầm được chặn chuyển vị ngang và
        xoắn (gối chạc); ngàm chặn cả vênh. Kiểm tra theo phương pháp tổng quát EN 1993-1-1 §6.3.2.2, dùng [σ] thay cho f_y/γ_M1.
        Dầm có sàn bê tông/tôn liên kết chặt vào cánh nén thì thường không cần kiểm tra. Mặt cắt chỉ đối xứng một trục: có kể hiệu ứng
        Wagner (β_y) — cánh lớn chịu nén làm tăng M_cr, cánh nhỏ chịu nén làm giảm.
      </p>
    </Card>
  );
}

export const defaultFrameLtbOptions = (): FrameLtbOptions => ({ loadHeight: 'top', curve: 'auto', braces: {} });

/** Kết quả uốn – xoắn của mọi thanh khung chịu uốn */
export function frameLtbRows(model: FrameModel, res: FrameResult, opt: FrameLtbOptions, local: LocalOptions) {
  if (!res.ok) return [];
  return res.members
    .filter((mr) => mr.samples.some((x) => Math.abs(x.M) > 1e-9))
    .map((mr) => {
      const fm = model.members.find((x) => x.id === mr.id);
      const ml = memberLocal(local, fm, mr.material);
      return { mr, ml, r: checkFrameMemberLTB(model, res, mr.id, opt, ml.fy, ml.stiffenerSpacing) };
    });
}

export function FrameLtbCard({ model, res, opt, setOpt, local }: {
  model: FrameModel;
  res: FrameResult;
  opt: FrameLtbOptions;
  setOpt: (o: FrameLtbOptions) => void;
  local: LocalOptions;
}) {
  const rows = useMemo(() => frameLtbRows(model, res, opt, local), [model, res, opt, local]);
  const [sel, setSel] = useState('');
  if (!rows.length) return null;
  const cur = rows.find((x) => x.mr.id === sel) ?? rows.find((x) => x.r.applicable) ?? rows[0];
  const r: LtbResult = cur.r;
  const braces = opt.braces[cur.mr.id] ?? 0;
  const kp = [0, cur.mr.L, ...Array.from({ length: braces }, (_, k) => (cur.mr.L * (k + 1)) / (braces + 1))];
  return (
    <Card title="Ổn định uốn – xoắn các thanh khung">
      <div className="row">
        <Select label="Điểm đặt tải ngang" value={opt.loadHeight} onChange={(v: LoadHeight) => setOpt({ ...opt, loadHeight: v })}
          options={[{ value: 'top', label: 'Phía +y của thanh (cánh trên, bất lợi)' }, { value: 'sc', label: 'Tâm cắt' }, { value: 'bottom', label: 'Phía −y (cánh dưới)' }]} />
        <Select label="Đường cong ổn định" value={opt.curve} onChange={(v: 'auto' | LtbCurve) => setOpt({ ...opt, curve: v })}
          options={[{ value: 'auto', label: 'Tự động' }, ...(Object.keys(LTB_CURVES) as LtbCurve[]).map((k) => ({ value: k, label: `${k} (α_LT = ${LTB_CURVES[k]})` }))]} />
      </div>
      <div className="table-scroll">
        <table className="grid">
          <thead><tr><th>Thanh</th><th>L (m)</th><th>Giằng trong nhịp</th><th>|M|max (kN·m)</th><th>M_cr (kN·m)</th><th>λ̄_LT</th><th>χ_LT</th><th>χ·W·[σ] (kN·m)</th><th>Kết luận</th><th></th></tr></thead>
          <tbody>
            {rows.map(({ mr, r: q }) => (
              <tr key={mr.id} className={mr.id === cur.mr.id ? 'sel-row' : undefined}>
                <td><b>{mr.name}</b></td>
                <td>{fmt(mr.L, 3)}</td>
                <td><NumField value={opt.braces[mr.id] ?? 0} width={60} onChange={(v) => setOpt({ ...opt, braces: { ...opt.braces, [mr.id]: Math.max(0, Math.round(v)) } })} title="Số giằng (chặn ngang + xoắn) chia đều nhịp thanh" /></td>
                {q.applicable ? (
                  <>
                    <td>{fmt(Math.abs(q.Mmax), 2)}</td><td>{fmt(q.Mcr, 1)}</td><td>{fmt(q.lambdaLT, 3)}</td><td>{fmt(q.chi, 3)}</td><td>{fmt(q.Mrd, 2)}</td>
                    <td className={q.ok ? 'good' : 'bad'}>{q.ok ? 'đạt ✓' : 'không đạt ✗'} ({fmt(q.util * 100, 0)}%)</td>
                  </>
                ) : (
                  <td colSpan={6} className="muted">{q.reason}</td>
                )}
                <td><button onClick={() => setSel(mr.id)}>Chi tiết</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {r.applicable && (
        <>
          <h3 className="sub-title">Thanh {cur.mr.name}: f_y = {cur.ml.fy} MPa; M_cr = {fmt(r.Mcr, 2)} kN·m; I_y · I_t · I_w = {fmt(r.Iweak, 0)} mm⁴ · {fmt(r.It, 0)} mm⁴ · {fmt(r.Iw, 0)} mm⁶{r.betaY ? `; β_y = ${fmt(r.betaY, 1)} mm (Wagner)` : ''}</h3>
          {r.warnings.map((w, i) => <p key={i} className="warn">{w}</p>)}
          <Diagram title="Dạng mất ổn định — chuyển vị ngang u (chuẩn hoá)" unit="—" tone="a" digits={2}
            data={r.mode.map((m) => ({ x: m.x, y: m.u }))} L={cur.mr.L} keyPoints={kp} />
          <Diagram title="Dạng mất ổn định — góc xoắn φ (chuẩn hoá)" unit="—" tone="d" digits={2}
            data={r.mode.map((m) => ({ x: m.x, y: m.phi }))} L={cur.mr.L} keyPoints={kp} />
          <details>
            <summary>Lời giải từng bước</summary>
            <ul className="steps">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </details>
        </>
      )}
      <p className="hint">
        Mỗi thanh giải riêng bài toán trị riêng với biểu đồ mô men, tải ngang và lực tập trung thực của thanh (hệ địa phương, x từ đầu i).
        Hai đầu thanh coi là gối chạc (chặn chuyển vị ngoài mặt phẳng và xoắn, vênh tự do); đầu tự do của công-xôn không có liên kết, đầu còn lại
        kiềm chế vênh. Có thể thêm giằng chia đều nhịp. f_y và a sườn ngang lấy theo từng thanh. Ảnh hưởng của lực dọc xét ở thẻ nén – uốn.
      </p>
    </Card>
  );
}
