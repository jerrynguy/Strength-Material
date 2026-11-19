import { useMemo, useState, type ReactNode } from 'react';
import { checkLocal, DEFAULT_LOCAL, type LocalOptions, type PlateResult } from '../../core/localBuckling';
import { fmt } from '../../core/stress';
import type { InternalForces, Material, SectionSpec } from '../../core/types';
import { Card, NumField } from '../fields';
import { SectionView } from '../SectionView';
import type { EffectiveResult, EffCheck } from '../../core/effective';

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
  /** Thông số dùng chung với báo cáo / chọn tiết diện (nếu không truyền thì dùng trạng thái riêng) */
  opt?: LocalOptions;
  setOpt?: (o: LocalOptions) => void;
  /** Nhãn ô khoảng cách sườn ngang */
  aLabel?: string;
}) {
  const [own, setOwn] = useState<LocalOptions>(DEFAULT_LOCAL);
  const cur = props.opt ?? own;
  const setCur = props.setOpt ?? setOwn;
  const fy = cur.fy, a = cur.stiffenerSpacing;
  const setFy = (v: number) => setCur({ ...cur, fy: v });
  const setA = (v: number) => setCur({ ...cur, stiffenerSpacing: v });
  const r = useMemo(() => checkLocal(props.spec, props.material, props.forces, { fy, stiffenerSpacing: a }), [props.spec, props.material, props.forces, fy, a]);
  const rows = merge(r.plates);
  return (
    <Card title={props.title ?? 'Ổn định cục bộ bản cánh, bản bụng'}>
      <div className="row">
        {props.controls}
        <NumField label="f_y" unit="MPa" value={fy} width={100} onChange={setFy} />
        <NumField label={props.aLabel ?? 'Khoảng cách sườn ngang a'} unit="mm" value={a} width={130} onChange={setA} title="0 = không có sườn" />
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
                    <tr><th>k_τ ({r.shear.a ? `sườn ngang a = ${r.shear.a} mm` : 'không có sườn ngang'}{props.spec.kind === 'I' && props.spec.stiffeners?.length ? ', có sườn dọc' : ''})</th><td>{fmt(r.shear.kTau, 3)}; τ_cr = {fmt(r.shear.tauCr, 1)} MPa</td></tr>
                    <tr><th>λ̄_w = 0.76√(f_y/τ_cr) · χ_w</th><td>{fmt(r.shear.lambdaW, 3)} · {fmt(r.shear.chiW, 3)}</td></tr>
                  </>
                )}
                <tr><th>τ trung bình = Q/(h_w·t_w)</th>
                  <td className={r.shear.ok ? 'good' : 'bad'}>{fmt(r.shear.tau, 2)} {r.shear.ok ? '≤' : '>'} {r.shear.needCheck ? 'χ_w·' : ''}[σ]/√3 = {fmt(r.shear.tauAllow, 2)} MPa ({fmt(r.shear.util * 100, 1)}%)</td></tr>
              </tbody>
            </table>
          )}
          {r.effective?.applicable && <EffectiveView eff={r.effective} check={r.effCheck ?? null} allow={props.material.allowable} xLabel={props.xLabel} />}
          <p className={r.ok ? 'ok' : 'error'}>{r.ok ? 'Đạt điều kiện ổn định cục bộ.' : 'KHÔNG đạt điều kiện ổn định cục bộ.'}</p>
          {r.warnings.map((w, i) => <p key={i} className="warn">{w}</p>)}
        </>
      )}
      <p className="hint">
        Đơn vị ứng suất MPa; n = σ_cr/σ là hệ số an toàn ổn định đàn hồi của tấm. Mỗi tấm lấy trạng thái bất lợi nhất dọc thanh. k_σ theo EN 1993-1-5 (bảng 4.1, 4.2) với ψ = σ₂/σ₁; phân loại theo EN 1993-1-1 bảng 5.2
        (với tấm trong, α lấy theo phân bố đàn hồi — gần đúng). Tiết diện loại 4 (hoặc có sườn dọc) được kiểm tra bằng tiết diện hữu hiệu bên dưới; cột “loại 4 · %” trong bảng chỉ là ước lượng nhanh theo từng tấm.
        Thép cán: c tính trừ góc lượn; tiết diện hàn: bỏ qua đường hàn.
      </p>
    </Card>
  );
}

export function EffectiveView({ eff, check, allow, xLabel }: { eff: EffectiveResult; check: EffCheck | null; allow: number; xLabel?: string }) {
  const g = eff.gross;
  const Wel = g.Iz / Math.max(g.yMax, -g.yMin);
  const WelY = g.Iy / Math.max(g.zMax, -g.zMin);
  const reduced = [
    ...(eff.N?.plates ?? []).filter((p) => p.removed).map((p) => ({ when: 'nén đều', p })),
    ...(eff.MzPos?.plates ?? []).filter((p) => p.removed).map((p) => ({ when: 'uốn M_z > 0', p })),
    ...(eff.MzNeg?.plates ?? []).filter((p) => p.removed).map((p) => ({ when: 'uốn M_z < 0', p })),
  ];
  return (
    <div className="eff-block">
      <h3 className="sub-title">Tiết diện hữu hiệu (EN 1993-1-5 §4.3{eff.N?.columns?.length || eff.MzPos?.columns?.length ? ', §4.5' : ''})</h3>
      <div className="section-grid">
        {eff.N && (
          <figure className="eff-fig">
            <SectionView sec={eff.N.sec} size={170} />
            <figcaption>Khi nén đều: A_eff = {fmt(eff.N.Aeff, 0)} mm²</figcaption>
          </figure>
        )}
        {eff.MzPos && (
          <figure className="eff-fig">
            <SectionView sec={eff.MzPos.sec} size={170} />
            <figcaption>Khi uốn M_z &gt; 0: W_eff = {fmt(eff.MzPos.Weff, 0)} mm³</figcaption>
          </figure>
        )}
        <table className="kv">
          <tbody>
            <tr><th>A_eff / A</th><td>{fmt(eff.N!.Aeff, 1)} / {fmt(g.A, 1)} mm² ({fmt((eff.N!.Aeff / g.A) * 100, 1)}%)</td></tr>
            <tr><th>Độ lệch trọng tâm e_N,y · e_N,z</th><td>{fmt(eff.N!.eNy, 2)} · {fmt(eff.N!.eNz, 2)} mm</td></tr>
            <tr><th>W_eff,z (M &gt; 0 / M &lt; 0)</th><td>{fmt(eff.MzPos!.Weff, 0)} / {fmt(eff.MzNeg!.Weff, 0)} mm³ (W_el = {fmt(Wel, 0)})</td></tr>
            <tr><th>W_eff,y (M &gt; 0 / M &lt; 0)</th><td>{fmt(eff.MyPos!.Weff, 0)} / {fmt(eff.MyNeg!.Weff, 0)} mm³ (W_el = {fmt(WelY, 0)})</td></tr>
            {check && (
              <tr><th>Kiểm tra bền tiết diện hữu hiệu</th>
                <td className={check.ok ? 'good' : 'bad'}>{fmt(check.sigma, 2)} {check.ok ? '≤' : '>'} [σ] = {allow} MPa ({fmt(check.util * 100, 1)}%)
                  {check.x !== undefined && <span className="muted"> tại x = {fmt(check.x, 3)}{xLabel ?? ' m'}</span>}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {reduced.length > 0 && (
        <div className="table-scroll">
          <table className="grid">
            <thead><tr><th>Trường hợp</th><th>Tấm</th><th>ψ</th><th>λ̄_p</th><th>ρ</th><th>b_eff (mm)</th><th>Phần khoét (mm)</th></tr></thead>
            <tbody>
              {reduced.map(({ when, p }, i) => (
                <tr key={i}>
                  <td>{when}</td><td>{p.name}</td><td>{fmt(p.psi, 3)}</td><td>{fmt(p.lambdaP, 3)}</td><td>{fmt(p.rho, 4)}</td>
                  <td>{fmt(p.beff, 1)}</td><td>{fmt(p.removed![1] - p.removed![0], 1)} <span className="muted">({fmt(p.removed![0], 1)} → {fmt(p.removed![1], 1)})</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(() => {
        const cols = [
          ...(eff.N?.columns ?? []).map((c) => ({ when: 'nén đều', c, rho: eff.N!.rhoC })),
          ...(eff.MzPos?.columns ?? []).map((c) => ({ when: 'uốn M_z > 0', c, rho: eff.MzPos!.rhoC })),
          ...(eff.MzNeg?.columns ?? []).map((c) => ({ when: 'uốn M_z < 0', c, rho: eff.MzNeg!.rhoC })),
        ];
        if (!cols.length) return null;
        return (
          <>
            <h3 className="sub-title">Mất ổn định tổng thể của bụng có sườn dọc (EN 1993-1-5 A.2 — thanh trên nền đàn hồi)</h3>
            <div className="table-scroll">
              <table className="grid">
                <thead><tr><th>Trường hợp</th><th>Sườn</th><th>b1 / b2 (mm)</th><th>A_sl (mm²)</th><th>I_sl (mm⁴)</th><th>a_c (mm)</th><th>σ_cr,sl → σ_cr,c</th><th>λ̄_c · α_e</th><th>χ_c</th></tr></thead>
                <tbody>
                  {cols.map(({ when, c }, i) => (
                    <tr key={i}>
                      <td>{when}</td><td>{c.name} <span className="muted">@{fmt(c.pos, 0)}</span></td><td>{fmt(c.b1, 0)} / {fmt(c.b2, 0)}</td>
                      <td>{fmt(c.Asl, 0)}</td><td>{fmt(c.Isl, 0)}</td><td>{fmt(c.ac, 0)}{Number.isFinite(c.a) ? ` (a = ${fmt(c.a, 0)})` : ''}</td>
                      <td>{fmt(c.sigmaCrSl, 1)} → {fmt(c.sigmaCrC, 1)}</td><td>{fmt(c.lambdaC, 3)} · {fmt(c.alphaE, 3)}</td>
                      <td className={c.chiC < 1 ? 'bad' : 'good'}>{fmt(c.chiC, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="hint">
              Sườn cùng dải bụng hai bên (bề rộng góp theo phân bố b_eff) làm việc như thanh trên nền đàn hồi; ρ_c = χ_c nhỏ nhất được dùng để
              giảm bề dày vùng nén của bụng (trừ dải biên sát cánh) và sườn — tô đỏ nhạt trên hình. Bỏ qua làm việc kiểu tấm (thiên về an toàn).
              Khoảng cách sườn ngang a lấy theo ô “Khoảng cách sườn ngang”; a = 0 coi như không có sườn ngang (a ≥ a_c).
            </p>
          </>
        );
      })()}
      {check && <p className="hint">{check.terms}</p>}
      <details>
        <summary>Lời giải tiết diện hữu hiệu</summary>
        <ul className="steps">{eff.steps.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </details>
      <p className="hint">
        Phần khoét đo từ chân tấm (tấm vươn) hoặc từ mép 1 (tấm trong); vùng tô đỏ trong hình là phần không hữu hiệu. Kiểm tra theo EN 1993-1-1
        6.2.9.3: σ = N/A_eff + (|M| + |N|·e_N)/W_eff ≤ [σ]. Thanh chịu nén loại 4: kiểm tra ổn định dùng σ = N/A_eff.
      </p>
    </div>
  );
}
