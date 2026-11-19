import { useMemo, useState, type ReactNode } from 'react';
import { checkLocal, type PlateResult } from '../../core/localBuckling';
import { fmt } from '../../core/stress';
import type { InternalForces, Material, SectionSpec } from '../../core/types';
import { Card, NumField } from '../fields';

const CLS_TEXT = ['không chịu nén', 'loại 1', 'loại 2', 'loại 3', 'loại 4'];

/** Gộp các tấm đối xứng cho kết quả giống hệt nhau (vd. cánh trái/phải) */
function merge(plates: PlateResult[]): (PlateResult & { label: string })[] {
  const out: (PlateResult & { label: string })[] = [];
  for (const p of plates) {
    const base = p.name.replace(/ – (trái|phải)$/, '').replace(/^Thành bên (trái|phải)$/, 'Thành bên');
    const same = out.find((o) => o.label.startsWith(base) && Math.abs(o.s1 - p.s1) < 1e-6 && Math.abs(o.s2 - p.s2) < 1e-6 && o.c === p.c && o.t === p.t);
    if (same) { if (!same.label.endsWith('(hai bên)')) same.label = `${base} (hai bên)`; continue; }
    out.push({ ...p, label: p.name });
  }
  return out;
}

export function LocalCard(props: {
  spec: SectionSpec;
  material: Material;
  forces: ({ x?: number } & InternalForces)[];
  title?: string;
  controls?: ReactNode;
  xLabel?: string;
}) {
  const [fy, setFy] = useState(240);
  const [a, setA] = useState(0);
  const r = useMemo(() => checkLocal(props.spec, props.material, props.forces, { fy, stiffenerSpacing: a }), [props.spec, props.material, props.forces, fy, a]);
  const rows = merge(r.plates);
  return (
    <Card title={props.title ?? 'Ổn định cục bộ bản cánh, bản bụng'}>
      <div className="row">
        {props.controls}
        <NumField label="f_y" unit="MPa" value={fy} width={100} onChange={setFy} />
        <NumField label="Khoảng cách sườn ngang a" unit="mm" value={a} width={130} onChange={setA} title="0 = không có sườn" />
      </div>
      {!r.applicable ? (
        <p className="muted">{r.reason}</p>
      ) : (
        <>
          <div className={`status ${r.sectionClass === 4 ? 'status-sieu-tinh' : 'status-tinh-dinh'}`}>
            Tiết diện {r.sectionClass ? CLS_TEXT[r.sectionClass].toUpperCase() : 'KHÔNG CHỊU NÉN'}
            {r.sectionClass === 4 ? ' — tấm mảnh, mất ổn định cục bộ trước khi chảy' : r.sectionClass ? ' — không mất ổn định cục bộ trước khi chảy' : ''}
            {' '}(ε = √(235/f_y) = {fmt(r.eps, 3)})
          </div>
          {rows.length > 0 && (
            <div className="table-scroll">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Tấm</th><th>c/t <span className="muted">(c × t mm)</span></th><th>Giới hạn loại 1 / 2 / 3</th><th>ψ · k_σ</th>
                    <th>σ nén</th><th>σ_cr · n</th><th>ρ</th><th title="Tấm loại 4: σ_nén/(ρ·[σ])">Kết luận</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.label}>
                      <td>
                        <b>{p.label}</b>{p.x !== undefined && p.cls > 0 && props.forces.length > 1 && <span className="muted"> @{fmt(p.x, 2)}{props.xLabel ?? ' m'}</span>}
                        <div className="muted small">{p.kind === 'internal' ? 'tựa 2 mép' : 'vươn, 1 mép tự do'}</div>
                      </td>
                      <td><b>{fmt(p.ct, 1)}</b> <span className="muted">({fmt(p.c, 1)} × {fmt(p.t, 1)})</span></td>
                      {p.cls === 0 ? (
                        <td colSpan={5} className="muted">không chịu nén</td>
                      ) : (
                        <>
                          <td>{p.limits.map((l) => fmt(l, 1)).join(' / ')}</td>
                          <td>{fmt(p.psi, 2)} · {fmt(p.k, 2)}{p.kind === 'outstand' && <div className="muted small">{p.tipMax ? 'mép tự do nén hơn' : 'chân nén hơn'}</div>}</td>
                          <td>{fmt(p.s1, 1)}</td>
                          <td>{fmt(p.sigmaCr, 0)} · {fmt(p.n, 2)}</td>
                          <td>{fmt(p.rho, 3)}</td>
                        </>
                      )}
                      <td className={p.cls === 4 ? (p.util <= 1 ? 'good' : 'bad') : p.cls ? 'good' : ''}>
                        {p.cls === 0 ? '—' : p.cls < 4 ? `${CLS_TEXT[p.cls]} ✓` : `loại 4 · ${fmt(p.util * 100, 0)}% ${p.util <= 1 ? '✓' : '✗'}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {r.tube && (
            <p className={r.tube.cls === 4 ? 'warn' : 'hint'}>
              Ống tròn: D/t = {fmt(r.tube.Dt, 1)}; giới hạn loại 1/2/3 = {r.tube.limits.map((l) => fmt(l, 1)).join(' / ')} (50ε², 70ε², 90ε²) →
              loại {r.tube.cls}. Ứng suất tới hạn cổ điển của vỏ trụ σ_cr = 0.605·E·t/R = {fmt(r.tube.sigmaCr, 0)} MPa (thực tế thấp hơn do khuyết tật).
            </p>
          )}
          {r.angleNote && <p className="hint">{r.angleNote}</p>}
          {r.shear && (
            <table className="kv wide">
              <tbody>
                <tr><th colSpan={2} className="sub-h">Ổn định bản bụng khi chịu cắt</th></tr>
                <tr><th>h_w/t_w</th><td>{fmt(r.shear.hw, 1)}/{fmt(r.shear.tw, 1)} = <b>{fmt(r.shear.ratio, 1)}</b> {r.shear.needCheck ? '>' : '≤'} 72ε/η = {fmt(r.shear.limit, 1)}
                  {r.shear.needCheck ? ' → cần kiểm tra' : ' → bụng không mất ổn định do cắt'}</td></tr>
                {r.shear.needCheck && (
                  <>
                    <tr><th>k_τ ({r.shear.a ? `a = ${r.shear.a} mm` : 'không có sườn'})</th><td>{fmt(r.shear.kTau, 3)}; τ_cr = {fmt(r.shear.tauCr, 1)} MPa</td></tr>
                    <tr><th>λ̄_w = 0.76√(f_y/τ_cr) · χ_w</th><td>{fmt(r.shear.lambdaW, 3)} · {fmt(r.shear.chiW, 3)}</td></tr>
                  </>
                )}
                <tr><th>τ trung bình = Q/(h_w·t_w)</th>
                  <td className={r.shear.ok ? 'good' : 'bad'}>{fmt(r.shear.tau, 2)} {r.shear.ok ? '≤' : '>'} {r.shear.needCheck ? 'χ_w·' : ''}[σ]/√3 = {fmt(r.shear.tauAllow, 2)} MPa ({fmt(r.shear.util * 100, 1)}%)</td></tr>
              </tbody>
            </table>
          )}
          <p className={r.ok ? 'ok' : 'error'}>{r.ok ? 'Đạt điều kiện ổn định cục bộ.' : 'KHÔNG đạt điều kiện ổn định cục bộ.'}</p>
          {r.warnings.map((w, i) => <p key={i} className="warn">{w}</p>)}
        </>
      )}
      <p className="hint">
        Đơn vị ứng suất MPa; n = σ_cr/σ là hệ số an toàn ổn định đàn hồi của tấm. Mỗi tấm lấy trạng thái bất lợi nhất dọc thanh. k_σ theo EN 1993-1-5 (bảng 4.1, 4.2) với ψ = σ₂/σ₁; phân loại theo EN 1993-1-1 bảng 5.2
        (với tấm trong, α lấy theo phân bố đàn hồi — gần đúng). Tấm loại 4 kiểm tra gần đúng σ_nén ≤ ρ·[σ] thay cho tính tiết diện hữu hiệu.
        Thép cán: c tính trừ góc lượn; tiết diện hàn: bỏ qua đường hàn.
      </p>
    </Card>
  );
}
