import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { analyze, withSelfWeight } from './core/analysis';
import { classify } from './core/classify';
import { PRESETS, defaultModel } from './core/presets';
import type { FrameModel } from './core/frame';
import { FRAME_PRESETS } from './core/framePresets';
import { FrameApp, type FrameMu } from './ui/frame/FrameApp';
import { designBeam } from './core/design';
import { DesignCard } from './ui/DesignCard';
import { STAB_PRESETS, StabilityApp, defaultStabModel, type StabModel } from './ui/stability/StabilityApp';
import { BeamStabilityCard, type StabOpenRequest } from './ui/stability/StabilityChecks';
import { BeamBeamColumnCard } from './ui/stability/BeamColumnCards';
import { LtbCard, defaultFrameLtbOptions, defaultLtbOptions } from './ui/stability/LtbCard';
import { LocalCard } from './ui/stability/LocalCard';
import { ReportShell } from './ui/report/ReportShell';
import { ClassicalCard } from './ui/ClassicalCard';
import { TransportApp } from './ui/transport/TransportApp';
import { TRANSPORT_PRESETS, defaultTransport, type TransportModel } from './core/transport';
import { DEFAULT_BEAM_STAB, type BeamStabParams } from './core/beamAxial';
import type { FrameLtbOptions, LtbOptions } from './core/ltb';
import { DEFAULT_LOCAL, type LocalOptions } from './core/localBuckling';
import type { Model } from './core/types';
import { BeamView } from './ui/BeamView';
import { Diagram } from './ui/Diagram';
import { GeneralEditor, LoadsEditor, SectionEditor, SupportsEditor } from './ui/editors';
import { Card } from './ui/fields';
import { ClassificationCard, DeterminacyCard, ReactionsCard, StressCard, SummaryCard } from './ui/results';

const STORE_KEY = 'strength-material:model:v1';
const FRAME_KEY = 'strength-material:frame:v1';
const MODE_KEY = 'strength-material:mode';
const STAB_KEY = 'strength-material:stab:v1';
const LOCAL_KEY = 'strength-material:local:v1';
const BSTAB_KEY = 'strength-material:beam-stab:v1';
const TRANSPORT_KEY = 'strength-material:transport:v1';

type Mode = 'beam' | 'frame' | 'stab' | 'transport';
type StructMode = Exclude<Mode, 'transport'>;

function load<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* bỏ qua */
  }
  return fallback();
}
const save = (key: string, v: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* bỏ qua */
  }
};

/** Ghép dữ liệu đã lưu với mặc định (phòng thiếu trường khi phiên bản thay đổi) */
function mergeTransport(m: Partial<TransportModel>): TransportModel {
  const d = defaultTransport();
  return {
    ...d, ...m,
    cargo: { ...d.cargo, ...m.cargo }, coef: { ...d.coef, ...m.coef }, topOver: { ...d.topOver, ...m.topOver }, direct: { ...d.direct, ...m.direct },
    blocking: { ...d.blocking, ...m.blocking }, vehicle: { ...d.vehicle, ...m.vehicle }, limits: { ...d.limits, ...m.limits }, road: { ...d.road, ...m.road },
    ground: { ...d.ground, ...m.ground }, barges: Array.isArray(m.barges) ? m.barges : d.barges,
  };
}

export default function App() {
  const [mode, setMode] = useState<Mode>(() => load<Mode>(MODE_KEY, () => 'beam'));
  const [model, setModel] = useState<Model>(() => load(STORE_KEY, defaultModel));
  const [frame, setFrame] = useState<FrameModel>(() => load(FRAME_KEY, () => FRAME_PRESETS[0].build()));
  const [stab, setStab] = useState<StabModel>(() => load(STAB_KEY, defaultStabModel));
  const [transport, setTransport] = useState<TransportModel>(() => mergeTransport(load<Partial<TransportModel>>(TRANSPORT_KEY, defaultTransport)));
  // f_y và khoảng cách sườn ngang cho ổn định cục bộ — riêng từng chế độ, dùng chung cho thẻ, báo cáo và chọn tiết diện
  const [localOpts, setLocalOpts] = useState<Record<StructMode, LocalOptions>>(() => load(LOCAL_KEY, () => ({ beam: DEFAULT_LOCAL, frame: DEFAULT_LOCAL, stab: DEFAULT_LOCAL })));
  const setLocalFor = (m: StructMode) => (o: LocalOptions) => setLocalOpts((p) => ({ ...p, [m]: o }));
  const [version, setVersion] = useState(0);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [pickX, setPickX] = useState(() => model.length / 2);
  const [mInvert, setMInvert] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => save(STORE_KEY, model), [model]);
  useEffect(() => save(FRAME_KEY, frame), [frame]);
  useEffect(() => save(MODE_KEY, mode), [mode]);
  useEffect(() => save(STAB_KEY, stab), [stab]);
  useEffect(() => save(TRANSPORT_KEY, transport), [transport]);
  useEffect(() => save(LOCAL_KEY, localOpts), [localOpts]);

  const [beamStab, setBeamStab] = useState<BeamStabParams>(() => ({ ...DEFAULT_BEAM_STAB, ...load<Partial<BeamStabParams>>(BSTAB_KEY, () => ({})) }));
  useEffect(() => save(BSTAB_KEY, beamStab), [beamStab]);
  const [frameMu, setFrameMu] = useState<FrameMu>({ in: {}, out: {} });
  const [frameLtb, setFrameLtb] = useState<FrameLtbOptions>(defaultFrameLtbOptions);
  const [so, setSo] = useState(false);
  const [ltbOpt, setLtbOpt] = useState<LtbOptions>(defaultLtbOptions);
  // f_y và khoảng cách sườn ngang dùng chung giữa thẻ uốn – xoắn và thẻ ổn định cục bộ (một nguồn)
  const ltbMerged = useMemo(() => ({ ...ltbOpt, fy: localOpts.beam.fy, stiffenerSpacing: localOpts.beam.stiffenerSpacing }), [ltbOpt, localOpts.beam.fy, localOpts.beam.stiffenerSpacing]);
  const setLtbMerged = (o: LtbOptions) => {
    setLtbOpt(o);
    if (o.fy !== localOpts.beam.fy) setLocalOpts((p) => ({ ...p, beam: { ...p.beam, fy: o.fy } }));
  };
  const [reportOpen, setReportOpen] = useState(false);
  const closeReport = useCallback(() => setReportOpen(false), []);
  const res1 = useMemo(() => analyze(model), [model]);
  const resSO = useMemo(() => (so ? analyze(model, { secondOrder: true }) : null), [model, so]);
  const res = resSO && resSO.ok ? resSO : res1;
  const cls = useMemo(() => classify(res), [res]);

  const replaceFrame = (m: FrameModel) => {
    setFrame(m);
    setVersion((v) => v + 1);
  };
  const replaceTransport = (m: TransportModel) => {
    setTransport(m);
    setVersion((v) => v + 1);
  };
  const replaceStab = (m: StabModel) => {
    setStab(m);
    setVersion((v) => v + 1);
  };
  const openStab = (r: StabOpenRequest) => {
    replaceStab({ ...defaultStabModel(), title: `Ổn định: ${r.title}`, N: Math.round(r.N * 1000) / 1000, L: r.L, Ly: r.L, muZ: r.mu, muY: r.mu, section: r.section, material: { ...r.material }, selfWeight: r.selfWeight || undefined });
    setMode('stab');
    window.scrollTo(0, 0);
  };
  const replace = (m: Model) => {
    setModel(m);
    setVersion((v) => v + 1);
    setPickX(m.length / 2);
  };
  const set = (fn: (m: Model) => Model) => setModel((m) => fn(m));

  const exportJson = () => {
    const data = mode === 'beam' ? { kind: 'beam', ...model } : mode === 'frame' ? { kind: 'frame', ...frame } : mode === 'transport' ? { kind: 'transport', ...transport } : { kind: 'stab', ...stab };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const title = mode === 'beam' ? model.title : mode === 'frame' ? frame.title : mode === 'transport' ? transport.title : stab.title;
    a.download = `${title.replace(/[^\p{L}\p{N}]+/gu, '_') || 'bai_toan'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (f: File) => {
    try {
      const m = JSON.parse(await f.text());
      if (m.kind === 'transport') {
        if (!m.cargo || !m.vehicle) throw new Error();
        replaceTransport(mergeTransport(m));
        setMode('transport');
      } else if (m.kind === 'stab') {
        if (typeof m.N !== 'number' || !m.section) throw new Error();
        replaceStab({ ...defaultStabModel(), ...m });
        setMode('stab');
      } else if (m.kind === 'frame' || (Array.isArray(m.nodes) && Array.isArray(m.members))) {
        if (!Array.isArray(m.nodes) || !Array.isArray(m.members)) throw new Error();
        replaceFrame(m as FrameModel);
        setMode('frame');
      } else {
        if (typeof m.length !== 'number' || !Array.isArray(m.supports) || !Array.isArray(m.loads)) throw new Error();
        replace({ ...defaultModel(), ...m, hinges: m.hinges ?? [] });
        setMode('beam');
      }
    } catch {
      alert('Tệp không đúng định dạng bài toán.');
    }
  };

  const L = model.length > 0 ? model.length : 1;
  const fs = res.forceSamples;
  const ds = res.dispSamples;
  const any = (k: 'N' | 'Qy' | 'Qz' | 'Mz' | 'My' | 'T') => fs.some((s) => s[k] !== 0);
  const anyD = (k: 'u' | 'v' | 'w' | 'thetaZ' | 'thetaY' | 'phi') => ds.some((s) => Math.abs(s[k]) > 1e-15);
  const dprops = { L, keyPoints: res.keyPoints, cursorX: hoverX ?? pickX, onHover: setHoverX, onPick: setPickX };

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Sức bền vật liệu — Bộ giải thanh & khung</h1>
          <p className="muted">Nội lực · ứng suất · biến dạng · tĩnh định / siêu tĩnh · dạng chịu lực</p>
        </div>
        <div className="top-actions">
          <div className="seg mode">
            <button className={mode === 'beam' ? 'on' : ''} onClick={() => setMode('beam')}>Thanh thẳng (dầm, trục, cột)</button>
            <button className={mode === 'frame' ? 'on' : ''} onClick={() => setMode('frame')}>Khung phẳng / dầm nghiêng</button>
            <button className={mode === 'stab' ? 'on' : ''} onClick={() => setMode('stab')}>Ổn định thanh nén</button>
            <button className={mode === 'transport' ? 'on' : ''} onClick={() => setMode('transport')}>Vận chuyển & chằng buộc</button>
          </div>
          <select
            value=""
            onChange={(e) => {
              if (mode === 'beam') {
                const p = PRESETS.find((x) => x.key === e.target.value);
                if (p) replace(p.build());
              } else if (mode === 'frame') {
                const p = FRAME_PRESETS.find((x) => x.key === e.target.value);
                if (p) replaceFrame(p.build());
              } else if (mode === 'transport') {
                const p = TRANSPORT_PRESETS.find((x) => x.key === e.target.value);
                if (p) replaceTransport(p.build());
              } else {
                const p = STAB_PRESETS.find((x) => x.key === e.target.value);
                if (p) replaceStab(p.build());
              }
            }}
          >
            <option value="">Mở bài mẫu…</option>
            {(mode === 'beam' ? PRESETS : mode === 'frame' ? FRAME_PRESETS : mode === 'transport' ? TRANSPORT_PRESETS : STAB_PRESETS).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button className="primary" onClick={() => setReportOpen(true)}>Xuất báo cáo PDF</button>
          <button onClick={exportJson}>Lưu (.json)</button>
          <button onClick={() => fileRef.current?.click()}>Mở tệp…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
        </div>
      </header>

      {mode === 'transport' ? (
        <TransportApp key={version} model={transport} setModel={(fn) => setTransport((m) => fn(m))} />
      ) : mode === 'stab' ? (
        <StabilityApp key={version} model={stab} setModel={(fn) => setStab((m) => fn(m))} local={localOpts.stab} setLocal={setLocalFor('stab')} />
      ) : mode === 'frame' ? (
        <FrameApp key={version} model={frame} setModel={(fn) => setFrame((m) => fn(m))} replace={replaceFrame} local={localOpts.frame} setLocal={setLocalFor('frame')} mu={frameMu} setMu={setFrameMu} ltb={frameLtb} setLtb={setFrameLtb} />
      ) : (
      <main className="layout" key={version}>
        <div className="col-edit">
          <GeneralEditor model={model} set={set} />
          <SupportsEditor model={model} set={set} />
          <LoadsEditor model={model} set={set} />
          <SectionEditor model={model} set={set} />
          <Card title="Quy ước dấu">
            <ul className="steps">
              <li>Trục x dọc thanh (trái → phải), y hướng lên, z vuông góc mặt phẳng hình vẽ.</li>
              <li>N &gt; 0: kéo. Q &gt; 0: làm phân tố quay thuận chiều kim đồng hồ (hợp lực phía trái hướng lên).</li>
              <li>M<sub>z</sub> &gt; 0: căng thớ dưới. Biểu đồ M mặc định vẽ về phía thớ căng (giá trị dương ở dưới).</li>
              <li>Ứng suất: σ &gt; 0 kéo; σ = N/A − M<sub>z</sub>·y/I<sub>z</sub> − M<sub>y</sub>·z/I<sub>y</sub>.</li>
            </ul>
          </Card>
        </div>

        <div className="col-res">
          <Card title={model.title || 'Sơ đồ tính'}>
            <BeamView model={withSelfWeight(model)} cursorX={hoverX ?? pickX} />
          </Card>
          <DeterminacyCard res={res} />
          {res.ok && (
            <>
              <ReactionsCard res={res} />
              <ClassificationCard cls={cls} />
              <Card
                title="Biểu đồ nội lực"
                actions={
                  <>
                    <label className="check" title="Kể mô men phụ do lực dọc trên độ võng">
                      <input type="checkbox" checked={so} onChange={(e) => setSo(e.target.checked)} />
                      Bậc hai (P-Δ)
                    </label>
                    <label className="check">
                      <input type="checkbox" checked={mInvert} onChange={(e) => setMInvert(e.target.checked)} />
                      Vẽ M về phía thớ căng
                    </label>
                  </>
                }
              >
                {so && resSO && !resSO.ok && <p className="error">{resSO.errors[0]} Đang hiển thị kết quả bậc nhất.</p>}
                {so && resSO?.ok && <p className="hint">Đang hiển thị kết quả phân tích bậc hai (P-Δ).</p>}
                <p className="hint">Rê chuột để đọc giá trị, bấm để chọn mặt cắt tính ứng suất (x = {pickX.toFixed(3)} m).</p>
                {(any('N') || !any('Qy')) && <Diagram title="Lực dọc N" unit="kN" tone="c" data={fs.map((s) => ({ x: s.x, y: s.N }))} {...dprops} />}
                {(any('Qy') || !any('N')) && <Diagram title="Lực cắt Qy" unit="kN" tone="a" data={fs.map((s) => ({ x: s.x, y: s.Qy }))} {...dprops} />}
                {(any('Mz') || any('Qy')) && <Diagram title="Mô men uốn Mz" unit="kN·m" tone="b" invert={mInvert} data={fs.map((s) => ({ x: s.x, y: s.Mz }))} {...dprops} />}
                {any('Qz') && <Diagram title="Lực cắt Qz" unit="kN" tone="a" data={fs.map((s) => ({ x: s.x, y: s.Qz }))} {...dprops} />}
                {any('My') && <Diagram title="Mô men uốn My" unit="kN·m" tone="b" invert={mInvert} data={fs.map((s) => ({ x: s.x, y: s.My }))} {...dprops} />}
                {any('T') && <Diagram title="Mô men xoắn T" unit="kN·m" tone="d" data={fs.map((s) => ({ x: s.x, y: s.T }))} {...dprops} />}
              </Card>
              <Card title="Biến dạng & chuyển vị">
                {anyD('v') && <Diagram title="Độ võng v (phương y)" unit="mm" tone="c" digits={4} data={ds.map((s) => ({ x: s.x, y: s.v }))} {...dprops} />}
                {anyD('thetaZ') && <Diagram title="Góc xoay θz = dv/dx" unit="rad" tone="d" digits={6} data={ds.map((s) => ({ x: s.x, y: s.thetaZ }))} {...dprops} />}
                {anyD('w') && <Diagram title="Độ võng w (phương z)" unit="mm" tone="c" digits={4} data={ds.map((s) => ({ x: s.x, y: s.w }))} {...dprops} />}
                {anyD('u') && <Diagram title="Chuyển vị dọc trục u" unit="mm" tone="a" digits={4} data={ds.map((s) => ({ x: s.x, y: s.u }))} {...dprops} />}
                {anyD('phi') && <Diagram title="Góc xoắn φ" unit="rad" tone="d" digits={6} data={ds.map((s) => ({ x: s.x, y: s.phi }))} {...dprops} />}
                {!['v', 'w', 'u', 'phi'].some((k) => anyD(k as 'v')) && <p className="muted">Không có chuyển vị.</p>}
              </Card>
              <ClassicalCard key={'cl' + version} model={model} res={res1} x0Default={pickX} />
              <SummaryCard res={res} model={model} />
              <BeamStabilityCard res={res1} model={model} onOpen={openStab} local={localOpts.beam} params={beamStab} setParams={setBeamStab} />
              <BeamBeamColumnCard model={model} local={localOpts.beam} params={beamStab} setParams={setBeamStab} />
              <LtbCard model={model} res={res1} opt={ltbMerged} setOpt={setLtbMerged} />
              <LocalCard spec={model.section} material={model.material} forces={res1.forceSamples} opt={localOpts.beam} setOpt={setLocalFor('beam')} length={model.length * 1e3} />
              <DesignCard autoMu allowable={model.material.allowable} run={(o) => designBeam(model, o)} ltb={ltbMerged} localOpt={localOpts.beam}
                apply={(spec) => { set((m) => ({ ...m, section: spec })); setVersion((v) => v + 1); }} />
            </>
          )}
          <StressCard res={res} model={model} x={pickX} setX={setPickX} />
        </div>
      </main>
      )}
      {reportOpen && (
        <ReportShell
          onClose={closeReport}
          input={mode === 'transport' ? { mode, model: transport } : mode === 'beam' ? { mode, model, ltb: ltbMerged, local: localOpts.beam, stab: beamStab } : mode === 'frame' ? { mode, model: frame, local: localOpts.frame, mu: frameMu, ltb: frameLtb } : { mode, model: stab, local: localOpts.stab }}
        />
      )}
      <footer className="foot muted">
        {mode === 'transport' ? (
          <>Phương pháp: chằng buộc hàng theo EN 12195-1:2010 (đường bộ) · tải trọng trục bằng cân bằng tĩnh học, cụm trục chia đều · đối chiếu điều kiện đường bằng tĩnh học.</>
        ) : (<>
        Phương pháp: phân tích cấu tạo hình học bằng hạng ma trận liên kết · phản lực bằng phương pháp ma trận độ cứng (dầm Euler–Bernoulli) ·
        nội lực bằng phương pháp mặt cắt · ứng suất theo Navier, Jurapxki, thuyết bền 3 và 4.
        </>)}
      </footer>
    </div>
  );
}
