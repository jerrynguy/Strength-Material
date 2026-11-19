import { useMemo, useState, type ReactNode } from 'react';
import type { AnalysisResult } from '../core/analysis';
import type { Classification } from '../core/classify';
import type { SectionProps } from '../core/section';
import { findProfile } from '../core/steelTables';
import { equilibriumSteps, sectionSteps } from '../core/steps';
import { fmt, maxNormalOnSection, neutralAxisCoeffs, stressAt, type PointStress } from '../core/stress';
import type { InternalForces, Material, Model, SectionSpec } from '../core/types';
import { Card, NumField, Select } from './fields';
import { SectionView } from './SectionView';

const STATUS_TEXT = {
  'tinh-dinh': 'Hệ TĨNH ĐỊNH',
  'sieu-tinh': 'Hệ SIÊU TĨNH',
  'bien-hinh': 'Hệ BIẾN HÌNH (không chịu lực được)',
};

export function DeterminacyCard({ res }: { res: AnalysisResult }) {
  const shown = res.subsystems.filter((s) => s.considered || s.key === 'axial' || s.key === 'bendY');
  return (
    <Card title="Phân tích cấu tạo hình học">
      <div className={`status status-${res.status}`}>
        {STATUS_TEXT[res.status]}
        {res.status === 'sieu-tinh' && <> — bậc siêu tĩnh n = {res.degree}</>}
      </div>
      <table className="grid">
        <thead>
          <tr><th>Hệ con</th><th>Số liên kết</th><th>Bậc tự do (đoạn cứng)</th><th>Liên kết độc lập</th><th>Bậc siêu tĩnh</th><th>Trạng thái</th></tr>
        </thead>
        <tbody>
          {shown.map((s) => (
            <tr key={s.key} className={s.considered ? '' : 'dim-row'}>
              <td>{s.label}{!s.loaded && <span className="muted"> (không tải)</span>}</td>
              <td>{s.constraints}</td>
              <td>{s.dof}</td>
              <td>{s.rank}</td>
              <td>{s.stable ? s.degree : '—'}</td>
              <td>{s.selfEquilibrated ? 'tự cân bằng' : s.stable ? (s.degree ? `siêu tĩnh bậc ${s.degree}` : 'tĩnh định') : 'biến hình'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">
        Bậc siêu tĩnh n = (số liên kết) − (số liên kết độc lập). Hệ bất biến hình khi số liên kết độc lập bằng số bậc tự do của các đoạn cứng
        (các đoạn thanh nối với nhau bằng khớp). Hệ phẳng thông thường: n = n<sub>dọc trục</sub> + n<sub>uốn</sub>.
      </p>
      {res.errors.map((e, i) => <p key={i} className="error">{e}</p>)}
      {res.warnings.map((w, i) => <p key={i} className="warn">{w}</p>)}
    </Card>
  );
}

export function ReactionsCard({ res }: { res: AnalysisResult }) {
  if (!res.ok) return null;
  const cols: [keyof InternalForces | 'Fx' | 'Fy' | 'Fz' | 'Mx' | 'My' | 'Mz', string][] = [
    ['Fx', 'X (kN)'], ['Fy', 'Y (kN)'], ['Mz', 'M_z (kN·m)'], ['Fz', 'Z (kN)'], ['My', 'M_y (kN·m)'], ['Mx', 'M_x xoắn (kN·m)'],
  ];
  const used = cols.filter(([k]) => res.reactions.some((r) => (r as unknown as Record<string, number>)[k] !== 0));
  const show = used.length ? used : cols.slice(0, 2);
  return (
    <Card title="Phản lực liên kết">
      <table className="grid">
        <thead>
          <tr><th>Gối</th><th>x (m)</th>{show.map(([k, l]) => <th key={k}>{l}</th>)}</tr>
        </thead>
        <tbody>
          {res.reactions.map((r) => (
            <tr key={r.supportId}>
              <td><b>{r.name}</b></td>
              <td>{fmt(r.x, 3)}</td>
              {show.map(([k]) => <td key={k}>{fmt((r as unknown as Record<string, number>)[k], 3)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Dấu theo trục tổng thể: Y &gt; 0 hướng lên, M<sub>z</sub> &gt; 0 ngược chiều kim đồng hồ.</p>
      <details>
        <summary>Kiểm tra cân bằng</summary>
        <ul className="steps">{equilibriumSteps(res).map((l, i) => <li key={i}>{l}</li>)}</ul>
      </details>
    </Card>
  );
}

export function ClassificationCard({ cls }: { cls: Classification }) {
  if (!cls.regions.length) return null;
  return (
    <Card title="Dạng chịu lực của thanh">
      <p className="lead">{cls.summary}</p>
      <table className="grid">
        <thead><tr><th>Đoạn (m)</th><th>Dạng chịu lực</th><th>Nội lực khác 0</th></tr></thead>
        <tbody>
          {cls.regions.map((r, i) => (
            <tr key={i}>
              <td>{fmt(r.x1, 3)} → {fmt(r.x2, 3)}</td>
              <td>{r.label}{r.complex && <span className="tag small">phức tạp</span>}</td>
              <td>{r.components.join(', ') || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

export function SummaryCard({ res, model }: { res: AnalysisResult; model: Model }) {
  const data = useMemo(() => {
    if (!res.ok || !res.section) return null;
    const sec = res.section;
    const ext = (k: keyof InternalForces) => {
      let best = { v: 0, x: 0 };
      for (const s of res.forceSamples) if (Math.abs(s[k]) > Math.abs(best.v)) best = { v: s[k], x: s.x };
      return best;
    };
    let sig = { v: 0, x: 0 };
    for (const s of res.forceSamples) {
      const m = maxNormalOnSection(sec, s);
      const v = Math.abs(m.max) > Math.abs(m.min) ? m.max : m.min;
      if (Math.abs(v) > Math.abs(sig.v)) sig = { v, x: s.x };
    }
    const Q = ext('Qy');
    const tau = stressAt(sec, { N: 0, Qy: Q.v, Qz: 0, T: 0, Mz: 0, My: 0 }, model.material, 0, 0).tauQy;
    const T = ext('T');
    const tauT = T.v ? sec.torsion.tauMax(T.v * 1e6) : 0;
    const dext = (k: 'v' | 'w' | 'thetaZ' | 'thetaY') => {
      let best = { v: 0, x: 0 };
      for (const s of res.dispSamples) if (Math.abs(s[k]) > Math.abs(best.v)) best = { v: s[k], x: s.x };
      return best;
    };
    const d0 = res.dispSamples[0], d1 = res.dispSamples[res.dispSamples.length - 1];
    return {
      N: ext('N'), Qy: Q, Mz: ext('Mz'), Qz: ext('Qz'), My: ext('My'), T, sig, tau, tauT,
      v: dext('v'), w: dext('w'), tz: dext('thetaZ'), ty: dext('thetaY'),
      dL: d1.u - d0.u, twist: d1.phi - d0.phi,
    };
  }, [res, model.material]);
  if (!data) return null;
  const allow = model.material.allowable;
  const ok = Math.abs(data.sig.v) <= allow;
  const row = (label: string, e: { v: number; x: number }, unit: string, d = 3) =>
    e.v !== 0 && <tr><th>{label}</th><td>{fmt(e.v, d)} {unit}</td><td className="muted">tại x = {fmt(e.x, 3)} m</td></tr>;
  return (
    <Card title="Giá trị lớn nhất & kiểm tra bền">
      <table className="kv wide">
        <tbody>
          {row('|N|max', data.N, 'kN')}
          {row('|Qy|max', data.Qy, 'kN')}
          {row('|Mz|max', data.Mz, 'kN·m')}
          {row('|Qz|max', data.Qz, 'kN')}
          {row('|My|max', data.My, 'kN·m')}
          {row('|T|max', data.T, 'kN·m')}
          {row('σ pháp lớn nhất', data.sig, 'MPa')}
          {data.tau !== 0 && <tr><th>τ max do Qy (tại trục trung hoà)</th><td>{fmt(data.tau, 3)} MPa</td><td /></tr>}
          {data.tauT !== 0 && <tr><th>τ max do xoắn</th><td>{fmt(data.tauT, 3)} MPa</td><td /></tr>}
          {row('Độ võng lớn nhất v', data.v, 'mm', 4)}
          {row('Độ võng lớn nhất w', data.w, 'mm', 4)}
          {row('Góc xoay lớn nhất θz', data.tz, 'rad', 6)}
          {row('Góc xoay lớn nhất θy', data.ty, 'rad', 6)}
          {data.dL !== 0 && <tr><th>Biến dạng dài ΔL</th><td>{fmt(data.dL, 4)} mm</td><td /></tr>}
          {data.twist !== 0 && <tr><th>Góc xoắn tương đối hai đầu</th><td>{fmt(data.twist, 6)} rad ({fmt((data.twist * 180) / Math.PI, 4)}°)</td><td /></tr>}
        </tbody>
      </table>
      <p className={ok ? 'ok' : 'error'}>
        Điều kiện bền theo ứng suất pháp: |σ|max = {fmt(Math.abs(data.sig.v), 3)} MPa {ok ? '≤' : '>'} [σ] = {fmt(allow, 3)} MPa → {ok ? 'ĐỦ BỀN' : 'KHÔNG ĐỦ BỀN'}
      </p>
      <p className="hint">Kiểm tra bền đầy đủ tại điểm có cả σ và τ (ví dụ chân bản bụng chữ I) dùng mục “Ứng suất tại điểm” với thuyết bền 3/4.</p>
    </Card>
  );
}

export function quickPoints(s: SectionSpec, sec: SectionProps): { label: string; y: number; z: number }[] {
  const pts = [
    { label: 'Thớ trên', y: sec.yMax, z: 0 },
    { label: 'Trọng tâm / trục trung hoà', y: 0, z: 0 },
    { label: 'Thớ dưới', y: sec.yMin, z: 0 },
  ];
  const zc = sec.centroid[0];
  const eps = 1e-6;
  if (s.kind === 'I') {
    pts.push({ label: 'Đầu bản bụng (trên)', y: sec.yMax - s.tt - eps, z: 0 });
    pts.push({ label: 'Chân bản bụng (dưới)', y: sec.yMin + s.tb + eps, z: 0 });
  } else if (s.kind === 'T') {
    pts.push({ label: 'Đầu bản bụng (tiếp giáp cánh)', y: sec.yMax - s.tf - eps, z: 0 });
  } else if (s.kind === 'U') {
    pts.forEach((p) => (p.z = s.tw / 2 - zc));
    pts.push({ label: 'Bụng – tiếp giáp cánh trên', y: sec.yMax - s.tf - eps, z: s.tw / 2 - zc });
    pts.push({ label: 'Bụng – tiếp giáp cánh dưới', y: sec.yMin + s.tf + eps, z: s.tw / 2 - zc });
  } else if (s.kind === 'box') {
    const zw = -(s.B - s.tw) / 2;
    pts.push({ label: 'Thành đứng – tiếp giáp cánh trên', y: sec.yMax - s.tf - eps, z: zw });
    pts.push({ label: 'Thành đứng – tiếp giáp cánh dưới', y: sec.yMin + s.tf + eps, z: zw });
    pts[1].z = zw;
  } else if (s.kind === 'tube') {
    pts[1].z = -(s.D / 2 - s.t / 2);
  } else if (s.kind === 'catalog' && !s.rotate) {
    const f = findProfile(s.family, s.name);
    const g = f?.profile.geom;
    if (g && (g.type === 'I' || g.type === 'U')) {
      const zw = g.type === 'U' ? g.tw / 2 - zc : 0;
      if (g.type === 'U') pts.forEach((p) => (p.z = zw));
      const tWeb = g.tf + ((g.slope ?? 0) * (g.type === 'I' ? (g.b - g.tw) / 2 : g.b - g.tw)) / 2;
      pts.push({ label: 'Đầu bản bụng (trên)', y: sec.yMax - tWeb - eps, z: zw });
      pts.push({ label: 'Chân bản bụng (dưới)', y: sec.yMin + tWeb + eps, z: zw });
    } else if (g && g.type === 'RHS') {
      const zw = -(g.B - g.t) / 2;
      pts[1].z = zw;
      pts.push({ label: 'Thành đứng – tiếp giáp cánh dưới', y: sec.yMin + g.t + eps, z: zw });
    } else if (g && g.type === 'CHS') {
      pts[1].z = -(g.D / 2 - g.t / 2);
    } else if (g && g.type === 'L') {
      pts.forEach((p) => (p.z = g.t / 2 - zc));
    }
  } else if (s.kind === 'L') {
    pts.forEach((p) => (p.z = s.t / 2 - zc));
  }
  return pts.filter((p) => sec.contains(p.y, p.z) || Math.abs(p.y - sec.yMax) < 1e-9 || Math.abs(p.y - sec.yMin) < 1e-9);
}

export function StressCard({ res, model, x, setX }: { res: AnalysisResult; model: Model; x: number; setX: (x: number) => void }) {
  const [side, setSide] = useState<'left' | 'right'>('left');
  if (!res.section) return null;
  return (
    <StressPanel
      sec={res.section}
      spec={model.section}
      material={model.material}
      F={res.ok ? res.internalAt(x, side) : null}
      steps={res.ok ? sectionSteps(res, x, side) : []}
      controls={
        <>
          <NumField label="Mặt cắt x" unit="m" value={x} onChange={setX} />
          <Select label="Phía" value={side} onChange={setSide}
            options={[{ value: 'left', label: 'trái (x⁻)' }, { value: 'right', label: 'phải (x⁺)' }]} />
        </>
      }
    />
  );
}

/** Khối tính ứng suất tại điểm — dùng chung cho dầm và khung. */
export function StressPanel(props: {
  sec: SectionProps;
  spec: SectionSpec;
  material: Material;
  /** Nội lực từ kết quả tính (null nếu chưa có) */
  F: InternalForces | null;
  steps: string[];
  controls: ReactNode;
  title?: string;
}) {
  const { sec, spec, material } = props;
  const [mode, setMode] = useState<'beam' | 'manual'>('beam');
  const [manual, setManual] = useState<InternalForces>({ N: 0, Qy: 40, Qz: 0, T: 0, Mz: 60, My: 0 });
  const [pt, setPt] = useState<{ y: number; z: number }>({ y: 0, z: 0 });
  const F = mode === 'manual' ? manual : props.F;
  const st: PointStress | null = F ? stressAt(sec, F, material, pt.y, pt.z) : null;
  const quick = quickPoints(spec, sec);
  const allow = material.allowable;
  return (
    <Card title={props.title ?? 'Ứng suất & biến dạng tại điểm K trên mặt cắt'}>
      <div className="row">
        <Select label="Nội lực lấy từ" value={mode} onChange={setMode}
          options={[{ value: 'beam', label: 'Kết quả tính tại mặt cắt' }, { value: 'manual', label: 'Nhập trực tiếp (đề cho sẵn N, Q, M)' }]} />
        {mode === 'beam' ? props.controls : null}
      </div>
      {mode === 'manual' && (
        <div className="row">
          {(['N', 'Qy', 'Mz', 'Qz', 'My', 'T'] as (keyof InternalForces)[]).map((k) => (
            <NumField key={k} label={k} unit={k.startsWith('M') || k === 'T' ? 'kN·m' : 'kN'} value={manual[k]}
              onChange={(v) => setManual({ ...manual, [k]: v })} />
          ))}
        </div>
      )}
      <div className="row">
        <NumField label="y (từ trọng tâm, lên +)" unit="mm" value={pt.y} onChange={(v) => setPt({ ...pt, y: v })} />
        <NumField label="z (từ trọng tâm)" unit="mm" value={pt.z} onChange={(v) => setPt({ ...pt, z: v })} />
      </div>
      <div className="chips">
        {quick.map((q) => (
          <button key={q.label} className="chip" onClick={() => setPt({ y: q.y, z: q.z })}>{q.label}</button>
        ))}
      </div>
      {F && st && (
        <>
          <div className="stress-grid">
            <div>
              <SectionView sec={sec} size={220} point={pt} neutral={neutralAxisCoeffs(sec, F)} onPick={(y, z) => setPt({ y, z })} />
              <p className="hint center">Bấm vào hình để chọn điểm. Đường đứt là trục trung hoà.</p>
            </div>
            <table className="kv">
              <tbody>
                <tr><th colSpan={2} className="sub-h">Nội lực tại mặt cắt</th></tr>
                <tr><th>N · Qy · Mz</th><td>{fmt(F.N)} kN · {fmt(F.Qy)} kN · {fmt(F.Mz)} kN·m</td></tr>
                {(F.Qz !== 0 || F.My !== 0 || F.T !== 0) && <tr><th>Qz · My · T</th><td>{fmt(F.Qz)} kN · {fmt(F.My)} kN·m · {fmt(F.T)} kN·m</td></tr>}
                <tr><th colSpan={2} className="sub-h">Ứng suất tại K (y = {fmt(pt.y, 2)}, z = {fmt(pt.z, 2)} mm)</th></tr>
                <tr><th>σ (pháp)</th><td><b>{fmt(st.sigma)}</b> MPa {st.sigma > 0 ? '(kéo)' : st.sigma < 0 ? '(nén)' : ''}</td></tr>
                <tr><th>τ (tiếp)</th><td><b>{fmt(st.tau)}</b> MPa</td></tr>
                <tr><th>σ₁ ; σ₃</th><td>{fmt(st.sigma1)} ; {fmt(st.sigma3)} MPa</td></tr>
                <tr><th>τ<sub>max</sub> ; α₀</th><td>{fmt(st.tauMax)} MPa ; {fmt(st.alpha0, 2)}°</td></tr>
                <tr><th>σ<sub>tđ</sub> TB3</th><td>{fmt(st.td3)} MPa</td></tr>
                <tr><th>σ<sub>tđ</sub> TB4</th><td><b>{fmt(st.td4)}</b> MPa {st.td4 <= allow ? '≤' : '>'} [σ] = {fmt(allow)} → {st.td4 <= allow ? 'đủ bền' : 'KHÔNG đủ bền'}</td></tr>
                <tr><th>ε = σ/E</th><td>{fmt(st.eps * 1e6, 2)} ×10⁻⁶</td></tr>
                <tr><th>γ = τ/G</th><td>{fmt(st.gamma * 1e6, 2)} ×10⁻⁶ rad</td></tr>
              </tbody>
            </table>
            <Mohr st={st} />
          </div>
          {st.notes.map((n, i) => <p key={i} className="warn">{n}</p>)}
          <details open>
            <summary>Lời giải từng bước</summary>
            <ul className="steps">
              {mode === 'beam' && props.steps.map((l, i) => <li key={'s' + i}>{l}</li>)}
              <li>A = {fmt(sec.A, 2)} mm²; I<sub>z</sub> = {fmt(sec.Iz, 0)} mm⁴; I<sub>y</sub> = {fmt(sec.Iy, 0)} mm⁴</li>
              {st.steps.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </details>
          <StressProfile sec={sec} F={F} material={material} z={pt.z} probeY={pt.y} />
        </>
      )}
    </Card>
  );
}

function Mohr({ st }: { st: PointStress }) {
  const S = 220;
  const c = st.sigma / 2;
  const r = st.tauMax;
  const ext = Math.max(Math.abs(st.sigma1), Math.abs(st.sigma3), r, 1e-9) * 1.25;
  const k = S / 2 / ext;
  const X = (s: number) => S / 2 + s * k;
  const Y = (t: number) => S / 2 + t * k;
  return (
    <svg className="mohr" viewBox={`0 0 ${S} ${S}`} width={S} height={S}>
      <line x1={0} y1={S / 2} x2={S} y2={S / 2} className="axis" />
      <line x1={S / 2} y1={0} x2={S / 2} y2={S} className="axis" />
      <text x={S - 4} y={S / 2 - 4} className="axis-label" textAnchor="end">σ</text>
      <text x={S / 2 + 4} y={12} className="axis-label">τ</text>
      <circle cx={X(c)} cy={S / 2} r={r * k} className="mohr-c" />
      <line x1={X(st.sigma)} y1={Y(st.tau)} x2={X(0)} y2={Y(-st.tau)} className="mohr-d" />
      <circle cx={X(st.sigma)} cy={Y(st.tau)} r={3.5} className="probe" />
      <circle cx={X(st.sigma1)} cy={S / 2} r={3} className="centroid" />
      <circle cx={X(st.sigma3)} cy={S / 2} r={3} className="centroid" />
      <text x={X(st.sigma1)} y={S / 2 + 16} className="axis-label" textAnchor="middle">σ₁</text>
      <text x={X(st.sigma3)} y={S / 2 + 16} className="axis-label" textAnchor="middle">σ₃</text>
      <text x={6} y={S - 6} className="axis-label">Vòng Mohr</text>
    </svg>
  );
}

function StressProfile({ sec, F, material, z, probeY }: { sec: SectionProps; F: InternalForces; material: Material; z: number; probeY: number }) {
  const data = useMemo(() => {
    const n = 120;
    const out: { y: number; s: number; t: number }[] = [];
    for (let i = 0; i <= n; i++) {
      const y = sec.yMin + ((sec.yMax - sec.yMin) * i) / n;
      const yy = i === 0 ? y + 1e-6 : i === n ? y - 1e-6 : y;
      const st = stressAt(sec, F, material, yy, z);
      out.push({ y, s: st.sigma, t: st.tauQy });
    }
    return out;
  }, [sec, F, material, z]);
  const H = 220, Wd = 200, pad = 18;
  const Y = (y: number) => pad + ((sec.yMax - y) / (sec.yMax - sec.yMin)) * (H - 2 * pad);
  const plot = (key: 's' | 't', title: string) => {
    const m = Math.max(1e-12, ...data.map((d) => Math.abs(d[key])));
    const X = (v: number) => Wd / 2 + (v / m) * (Wd / 2 - 30);
    const pts = data.map((d) => `${X(d[key]).toFixed(1)},${Y(d.y).toFixed(1)}`).join(' ');
    const ex = data.reduce((a, d) => (Math.abs(d[key]) > Math.abs(a[key]) ? d : a), data[0]);
    return (
      <figure className="profile">
        <figcaption>{title}</figcaption>
        <svg viewBox={`0 0 ${Wd} ${H}`} width={Wd} height={H}>
          <polygon points={`${Wd / 2},${Y(sec.yMax)} ${pts} ${Wd / 2},${Y(sec.yMin)}`} className="d-fill" />
          <polyline points={pts} className="d-line" />
          <line x1={Wd / 2} y1={pad} x2={Wd / 2} y2={H - pad} className="d-base" />
          <line x1={10} y1={Y(probeY)} x2={Wd - 10} y2={Y(probeY)} className="cursor" />
          <text x={X(ex[key])} y={Y(ex.y) + (ex.y > 0 ? -4 : 12)} className="d-val" textAnchor="middle">{fmt(ex[key], 2)}</text>
        </svg>
      </figure>
    );
  };
  return (
    <div className="profiles">
      {plot('s', 'Biểu đồ σ theo chiều cao (MPa)')}
      {plot('t', 'Biểu đồ τ do Qy (MPa)')}
    </div>
  );
}
