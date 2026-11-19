import { useEffect, useMemo, useRef, useState } from 'react';
import { analyze } from './core/analysis';
import { classify } from './core/classify';
import { PRESETS, defaultModel } from './core/presets';
import type { FrameModel } from './core/frame';
import { FRAME_PRESETS } from './core/framePresets';
import { FrameApp } from './ui/frame/FrameApp';
import { designBeam } from './core/design';
import { DesignCard } from './ui/DesignCard';
import type { Model } from './core/types';
import { BeamView } from './ui/BeamView';
import { Diagram } from './ui/Diagram';
import { GeneralEditor, LoadsEditor, SectionEditor, SupportsEditor } from './ui/editors';
import { Card } from './ui/fields';
import { ClassificationCard, DeterminacyCard, ReactionsCard, StressCard, SummaryCard } from './ui/results';

const STORE_KEY = 'strength-material:model:v1';
const FRAME_KEY = 'strength-material:frame:v1';
const MODE_KEY = 'strength-material:mode';

type Mode = 'beam' | 'frame';

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

export default function App() {
  const [mode, setMode] = useState<Mode>(() => load<Mode>(MODE_KEY, () => 'beam'));
  const [model, setModel] = useState<Model>(() => load(STORE_KEY, defaultModel));
  const [frame, setFrame] = useState<FrameModel>(() => load(FRAME_KEY, () => FRAME_PRESETS[0].build()));
  const [version, setVersion] = useState(0);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [pickX, setPickX] = useState(() => model.length / 2);
  const [mInvert, setMInvert] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => save(STORE_KEY, model), [model]);
  useEffect(() => save(FRAME_KEY, frame), [frame]);
  useEffect(() => save(MODE_KEY, mode), [mode]);

  const res = useMemo(() => analyze(model), [model]);
  const cls = useMemo(() => classify(res), [res]);

  const replaceFrame = (m: FrameModel) => {
    setFrame(m);
    setVersion((v) => v + 1);
  };
  const replace = (m: Model) => {
    setModel(m);
    setVersion((v) => v + 1);
    setPickX(m.length / 2);
  };
  const set = (fn: (m: Model) => Model) => setModel((m) => fn(m));

  const exportJson = () => {
    const data = mode === 'beam' ? { kind: 'beam', ...model } : { kind: 'frame', ...frame };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const title = mode === 'beam' ? model.title : frame.title;
    a.download = `${title.replace(/[^\p{L}\p{N}]+/gu, '_') || 'bai_toan'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importJson = async (f: File) => {
    try {
      const m = JSON.parse(await f.text());
      if (m.kind === 'frame' || (Array.isArray(m.nodes) && Array.isArray(m.members))) {
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
          </div>
          <select
            value=""
            onChange={(e) => {
              if (mode === 'beam') {
                const p = PRESETS.find((x) => x.key === e.target.value);
                if (p) replace(p.build());
              } else {
                const p = FRAME_PRESETS.find((x) => x.key === e.target.value);
                if (p) replaceFrame(p.build());
              }
            }}
          >
            <option value="">Mở bài mẫu…</option>
            {(mode === 'beam' ? PRESETS : FRAME_PRESETS).map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          <button onClick={exportJson}>Lưu (.json)</button>
          <button onClick={() => fileRef.current?.click()}>Mở tệp…</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) importJson(f); e.target.value = ''; }} />
        </div>
      </header>

      {mode === 'frame' ? (
        <FrameApp key={version} model={frame} setModel={(fn) => setFrame((m) => fn(m))} replace={replaceFrame} />
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
            <BeamView model={model} cursorX={hoverX ?? pickX} />
          </Card>
          <DeterminacyCard res={res} />
          {res.ok && (
            <>
              <ReactionsCard res={res} />
              <ClassificationCard cls={cls} />
              <Card
                title="Biểu đồ nội lực"
                actions={
                  <label className="check">
                    <input type="checkbox" checked={mInvert} onChange={(e) => setMInvert(e.target.checked)} />
                    Vẽ M về phía thớ căng
                  </label>
                }
              >
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
              <SummaryCard res={res} model={model} />
              <DesignCard allowable={model.material.allowable} run={(o) => designBeam(model, o)}
                apply={(spec) => { set((m) => ({ ...m, section: spec })); setVersion((v) => v + 1); }} />
            </>
          )}
          <StressCard res={res} model={model} x={pickX} setX={setPickX} />
        </div>
      </main>
      )}
      <footer className="foot muted">
        Phương pháp: phân tích cấu tạo hình học bằng hạng ma trận liên kết · phản lực bằng phương pháp ma trận độ cứng (dầm Euler–Bernoulli) ·
        nội lực bằng phương pháp mặt cắt · ứng suất theo Navier, Jurapxki, thuyết bền 3 và 4.
      </footer>
    </div>
  );
}
