import { useMemo, useState, type ReactNode } from 'react';
import { checkBeamColumn, checkFrameMember, frameAnalyses, type BeamColumnResult } from '../../core/beamColumn';
import type { FrameModel, FrameResult } from '../../core/frame';
import { BUCKLING_MATERIALS, type BucklingMaterial } from '../../core/stability';
import { fmt } from '../../core/stress';
import type { Model } from '../../core/types';
import { Card, NumField, Select } from '../fields';

function Verdict({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <td className={ok ? 'good' : 'bad'}>{children} {ok ? '✓' : '✗'}</td>;
}

function Controls(props: { n: number; setN: (v: number) => void; mat: BucklingMaterial; setMat: (m: BucklingMaterial) => void }) {
  return (
    <div className="row">
      <NumField label="Hệ số an toàn n (tải × n)" value={props.n} width={90} onChange={props.setN} title="Thường n = σ_ch/[σ]" />
      <Select label="Bảng φ / σ_ch" value={props.mat} onChange={props.setMat}
        options={(Object.keys(BUCKLING_MATERIALS) as BucklingMaterial[]).map((k) => ({ value: k, label: BUCKLING_MATERIALS[k].label }))} />
    </div>
  );
}

export function BeamColumnResultView({ r }: { r: BeamColumnResult }) {
  return (
    <>
      <table className="grid">
        <thead><tr><th>Mặt phẳng uốn</th><th>N_th (kN)</th><th>μ tđ</th><th>λ</th><th>M bậc 1</th><th>M bậc 2</th><th>Khuếch đại</th></tr></thead>
        <tbody>
          {r.planes.map((p) => (
            <tr key={p.key}>
              <td>{p.label}</td>
              <td>{p.Ncr ? fmt(p.Ncr, 1) : '—'}</td>
              <td>{p.mu ? fmt(p.mu, 3) : '—'}</td>
              <td>{p.lambda ? fmt(p.lambda, 1) : '—'}</td>
              <td>{fmt(p.M1, 3)}</td>
              <td>{Number.isFinite(p.M2) ? fmt(p.M2, 3) : '—'}</td>
              <td>{p.M1 && Number.isFinite(p.M2) ? `×${fmt(p.M2 / p.M1, 3)}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="grid">
        <thead><tr><th>Cách kiểm tra</th><th>Giá trị</th><th>Giới hạn</th><th>Kết luận</th></tr></thead>
        <tbody>
          <tr>
            <td>(1) Bền, phân tích bậc hai, tải thực</td>
            <td>σ = {r.sigma2 === null ? '—' : fmt(r.sigma2, 2)} MPa <span className="muted">(bậc 1: {fmt(r.sigma1, 2)})</span></td>
            <td>[σ] = {r.allowable}</td>
            <Verdict ok={r.ok2}>{r.sigma2 === null ? 'mất ổn định' : `${fmt((r.sigma2 / r.allowable) * 100, 1)}%`}</Verdict>
          </tr>
          <tr>
            <td>(2) Giáo trình: tải × n = {r.n}, bậc hai</td>
            <td>σ = {r.sigmaN === null ? 'mất ổn định' : `${fmt(r.sigmaN, 2)} MPa`}</td>
            <td>σ_ch = {r.sigmaY}</td>
            <Verdict ok={r.okN}>{r.sigmaN === null ? '—' : `${fmt((r.sigmaN / r.sigmaY) * 100, 1)}%`}</Verdict>
          </tr>
          <tr>
            <td>(3) Tương tác N/(φA) + M/(W(1 − N/N_th))</td>
            <td>σ = {r.sigmaInter === null ? '—' : `${fmt(r.sigmaInter, 2)} MPa`} {r.phi !== null && <span className="muted">(φ = {fmt(r.phi, 3)})</span>}</td>
            <td>[σ] = {r.allowable}</td>
            <Verdict ok={r.okInter}>{r.sigmaInter === null ? 'không áp dụng' : `${fmt((r.sigmaInter / r.allowable) * 100, 1)}%`}</Verdict>
          </tr>
        </tbody>
      </table>
      {r.errors.map((e, i) => <p key={i} className="error">{e}</p>)}
      <details>
        <summary>Lời giải từng bước</summary>
        <ul className="steps">{r.steps.map((s, i) => <li key={i}>{s}</li>)}</ul>
      </details>
    </>
  );
}

const HINT = (
  <p className="hint">
    Lực tới hạn N_th lấy từ bài toán trị riêng (đúng với mọi liên kết), μ tương đương = (π/L)√(EI/N_th). Phân tích bậc hai kể mô men phụ N·v do
    thanh bị võng. Cách (2) là cách kiểm tra trong giáo trình SBVL; cách (3) là công thức tương tác gần đúng, thường thiên về an toàn. Chưa xét
    mất ổn định uốn – xoắn và ổn định cục bộ.
  </p>
);

export function BeamBeamColumnCard({ model }: { model: Model }) {
  const [n, setN] = useState(1.5);
  const [mat, setMat] = useState<BucklingMaterial>('CT3');
  const r = useMemo(() => checkBeamColumn(model, n, BUCKLING_MATERIALS[mat]), [model, n, mat]);
  if (!r || r.planes.every((p) => !p.M1)) return null;
  const all = r.ok2 && r.okN && r.okInter;
  return (
    <Card title="Kiểm tra nén – uốn đồng thời">
      <Controls n={n} setN={setN} mat={mat} setMat={setMat} />
      <p className={all ? 'ok' : r.ok2 && r.okN ? 'warn' : 'error'}>
        {all ? 'Thanh đạt cả ba cách kiểm tra.' : r.ok2 && r.okN ? 'Đạt theo phân tích bậc hai nhưng không đạt công thức tương tác (thiên về an toàn).' : 'Thanh KHÔNG đạt điều kiện nén – uốn.'}
      </p>
      <BeamColumnResultView r={r} />
      {HINT}
    </Card>
  );
}

export function FrameBeamColumnCard({ model, res, muOut, setMuOut }: {
  model: FrameModel;
  res: FrameResult;
  muOut: Record<string, number>;
  setMuOut: (m: Record<string, number>) => void;
}) {
  const [n, setN] = useState(1.5);
  const [mat, setMat] = useState<BucklingMaterial>('CT3');
  const [open, setOpen] = useState<string | null>(null);
  const a = useMemo(() => frameAnalyses(model, n), [model, n]);
  const rows = res.members
    .map((mr) => ({ mr, r: checkFrameMember(a, mr.id, muOut[mr.id] ?? 1, model, BUCKLING_MATERIALS[mat]) }))
    .filter((x) => x.r !== null) as { mr: FrameResult['members'][number]; r: BeamColumnResult }[];
  if (!rows.length) return null;
  const sel = rows.find((x) => x.mr.id === open);
  return (
    <Card title="Kiểm tra nén – uốn các thanh khung">
      <Controls n={n} setN={setN} mat={mat} setMat={setMat} />
      {a.r1.buckling && (
        <p className="lead">
          Hệ số tới hạn của khung α_th = {fmt(a.r1.buckling.alpha, 3)} — khung mất ổn định khi tải trọng tăng {fmt(a.r1.buckling.alpha, 2)} lần
          {a.r1.buckling.alpha < 10 ? ' (α_th < 10: nên kể hiệu ứng bậc hai).' : '.'}
        </p>
      )}
      <div className="table-scroll">
        <table className="grid">
          <thead>
            <tr><th>Thanh</th><th>N nén</th><th>μ trong mp</th><th>μ ngoài mp</th><th>λ_max</th><th>σ bậc 2</th><th>σ (n·tải)</th><th>σ tương tác</th><th /></tr>
          </thead>
          <tbody>
            {rows.map(({ mr, r }) => (
              <tr key={mr.id} className={open === mr.id ? 'sel-row' : ''}>
                <td><b>{mr.name}</b></td>
                <td>{fmt(r.Nc, 2)}</td>
                <td>{r.planes[0].mu ? fmt(r.planes[0].mu, 3) : '—'}</td>
                <td><NumField value={muOut[mr.id] ?? 1} width={64} onChange={(v) => setMuOut({ ...muOut, [mr.id]: v })} /></td>
                <td>{r.lambdaMax ? fmt(r.lambdaMax, 1) : '—'}</td>
                <Verdict ok={r.ok2}>{r.sigma2 === null ? '—' : fmt(r.sigma2, 1)}</Verdict>
                <Verdict ok={r.okN}>{r.sigmaN === null ? '—' : fmt(r.sigmaN, 1)}</Verdict>
                <Verdict ok={r.okInter}>{r.sigmaInter === null ? (r.lambdaMax && r.lambdaMax > 200 ? 'λ > 200' : 'N ≥ N_th') : fmt(r.sigmaInter, 1)}</Verdict>
                <td><button onClick={() => setOpen(open === mr.id ? null : mr.id)}>{open === mr.id ? 'Đóng' : 'Chi tiết'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel && (
        <>
          <h3 className="sub-title">Thanh {sel.mr.name}</h3>
          <BeamColumnResultView r={sel.r} />
        </>
      )}
      <p className="hint">
        μ trong mặt phẳng khung được tính tự động từ hệ số tới hạn của cả khung (kể chuyển vị ngang); μ ngoài mặt phẳng nhập theo cách giằng
        (mặc định 1). Thanh có lực nén nhỏ trong khung sẽ có μ tương đương lớn — đó là đặc điểm của cách suy μ từ α_th của cả khung (thiên về
        an toàn); cột chịu lực chính mới là thanh quyết định. Ứng suất đơn vị MPa, so với [σ] = {model.material.allowable} MPa (cột 1, 3) và σ_ch (cột 2).
      </p>
      {HINT}
    </Card>
  );
}
