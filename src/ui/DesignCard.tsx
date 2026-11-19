import { useState, type ReactNode } from 'react';
import type { Candidate, DesignOptions } from '../core/design';
import { STEEL_FAMILIES } from '../core/steelTables';
import { fmt } from '../core/stress';
import type { SectionSpec } from '../core/types';
import { Card, NumField, Select } from './fields';

/** Chọn số hiệu thép hình thoả điều kiện bền và độ cứng. */
export function DesignCard(props: {
  allowable: number;
  run: (opt: DesignOptions) => Candidate[];
  apply: (spec: SectionSpec) => void;
  extraControls?: ReactNode;
  note?: string;
}) {
  const [opt, setOpt] = useState<DesignOptions>({ family: 'I_GOST', rotate: false, deflRatio: 250, selfWeight: true });
  const [rows, setRows] = useState<Candidate[] | null>(null);
  const [showAll, setShowAll] = useState(false);
  const best = rows?.find((r) => r.ok);
  const bestIdx = best ? rows!.indexOf(best) : -1;
  const shown = !rows ? [] : showAll ? rows : rows.filter((_, i) => bestIdx < 0 ? i >= rows.length - 4 : i >= bestIdx - 2 && i <= bestIdx + 2);
  return (
    <Card title="Chọn số hiệu thép hình">
      <div className="row">
        {props.extraControls}
        <Select label="Họ thép" value={opt.family} onChange={(v) => { setOpt({ ...opt, family: v }); setRows(null); }}
          options={STEEL_FAMILIES.map((f) => ({ value: f.key, label: f.label }))} />
        <NumField label="Độ võng cho phép L /" value={opt.deflRatio} onChange={(v) => { setOpt({ ...opt, deflRatio: v }); setRows(null); }}
          title="0 = không kiểm tra độ võng" />
      </div>
      <div className="row checks">
        <label className="check"><input type="checkbox" checked={opt.selfWeight} onChange={(e) => { setOpt({ ...opt, selfWeight: e.target.checked }); setRows(null); }} />kể trọng lượng bản thân</label>
        <label className="check"><input type="checkbox" checked={opt.rotate} onChange={(e) => { setOpt({ ...opt, rotate: e.target.checked }); setRows(null); }} />xoay 90° (uốn quanh trục yếu)</label>
        <button className="primary" onClick={() => setRows(props.run(opt))}>Tìm tiết diện</button>
      </div>
      {rows && (
        <>
          {best ? (
            <p className="ok">
              Tiết diện nhẹ nhất đạt yêu cầu: <b>{best.name}</b> ({fmt(best.mass, 2)} kg/m), hệ số sử dụng {fmt(best.util * 100, 1)}%.{' '}
              <button onClick={() => props.apply(best.spec)}>Dùng {best.name}</button>
            </p>
          ) : (
            <p className="error">Không có tiết diện nào trong họ này đạt yêu cầu — hãy chọn họ thép lớn hơn.</p>
          )}
          <div className="table-scroll">
            <table className="grid">
              <thead>
                <tr><th>Số hiệu</th><th>kg/m</th><th>|σ|max (MPa)</th><th>τmax (MPa)</th><th>f / [f] (mm)</th><th>Sử dụng</th><th /></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.name} className={r === best ? 'sel-row' : ''}>
                    <td><b>{r.name}</b></td>
                    <td>{fmt(r.mass, 2)}</td>
                    <td>{r.error ? '—' : fmt(Math.abs(r.sigma), 1)}</td>
                    <td>{r.error ? '—' : fmt(r.tau, 1)}</td>
                    <td>{r.deflLimit ? `${fmt(r.defl, 2)} / ${fmt(r.deflLimit, 1)}` : fmt(r.defl, 2)}</td>
                    <td className={r.ok ? 'good' : 'bad'}>{r.error ? r.error : `${fmt(r.util * 100, 1)}% ${r.ok ? '✓' : '✗'}`}</td>
                    <td><button onClick={() => props.apply(r.spec)}>Dùng</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="linkish" onClick={() => setShowAll(!showAll)}>{showAll ? 'Thu gọn' : `Xem cả ${rows.length} số hiệu`}</button>
        </>
      )}
      <p className="hint">
        Điều kiện: |σ|max ≤ [σ] = {fmt(props.allowable)} MPa; τmax ≤ [σ]/√3; độ võng ≤ L/n. Kết cấu được tính lại với từng tiết diện
        (đúng cả với hệ siêu tĩnh). {props.note ?? ''} Chưa kiểm tra ổn định — cấu kiện chịu nén cần kiểm tra riêng.
      </p>
    </Card>
  );
}
