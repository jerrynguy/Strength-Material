import { fmt } from '../../core/stress';
import { DRIVE_AXLES_DEFAULT, MOD_TYPES, SAFE_HSA, SAFE_SSA, SPINE_MOMENTS, defaultModular, type ModType, type ModularInput, type ModularResult, type Suspension } from '../../core/modular';
import { NumField, Select } from '../fields';

const Pass = ({ ok }: { ok: boolean | null }) => (ok === null ? <span className="muted">—</span> : <b className={ok ? 'pass' : 'fail'}>{ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}</b>);

/** Ô nhập xe module thủy lực — nằm trong thẻ "Xe" của tab Vận chuyển */
export function ModularEditor({ mi, set, cargoMass, others, cogAuto }: { mi: ModularInput; set: (p: Partial<ModularInput>) => void; cargoMass: number; others: number; cogAuto: number }) {
  const spec = MOD_TYPES[mi.type];
  const spmt = mi.type === 'spmt';
  const unit = (i: number, p: Partial<{ lines: number; drive: number }>) => set({ units: mi.units.map((u, j) => (j === i ? { ...u, ...p } : u)) });
  return (
    <>
      <div className="row">
        <Select<ModType> label="Loại xe module" value={mi.type} options={(Object.keys(MOD_TYPES) as ModType[]).map((k) => ({ value: k, label: MOD_TYPES[k].label }))}
          onChange={(k) => { const d = defaultModular(k); const sp = MOD_TYPES[k]; set({ type: k, payloadPerLine: d.payloadPerLine, axleBase: (mi.wide ?? 1) === 2 ? sp.axleBaseDouble : sp.axleBaseSingle, spineM: d.spineM, units: k === 'spmt' ? (mi.units.length ? mi.units : d.units) : mi.units.map((u) => ({ ...u, drive: 0 })) }); }} />
        <NumField label="Tải trọng / trục dòng" unit="t" value={mi.payloadPerLine} width={85} onChange={(x) => set({ payloadPerLine: x })} />
        <NumField label="Tự trọng / trục dòng" unit="t" value={mi.selfPerLine} width={85} onChange={(x) => set({ selfPerLine: x })} />
      </div>
      <p className="hint">{spec.label}: {spec.tires} lốp / trục dòng; khoảng cách trục dòng {fmt(spec.axleSpacing, 2)} m; bề rộng cơ sở {fmt(spec.axleBaseSingle, 2)} m (module đơn) / {fmt(spec.axleBaseDouble, 2)} m (module đôi);
        cao sàn {fmt(spec.deckH, 2)} ± {fmt(spec.stroke, 2)} m. Hàng {fmt(cargoMass, 3)} t lấy từ thẻ Hàng hoá; gối kê / dầm / mâm xoay {fmt(others, 3)} t lấy từ thẻ Tải khác trên xe.</p>
      <div className="row">
        <Select label="Ghép module" value={String(mi.wide ?? 1)} options={[{ value: '1', label: 'Module đơn' }, { value: '2', label: 'Module đôi (2 hàng song song)' }]}
          onChange={(w) => set({ wide: w === '2' ? 2 : 1, axleBase: w === '2' ? spec.axleBaseDouble : spec.axleBaseSingle })} />
        <NumField label="Bề rộng cơ sở D_AB" unit="m" value={mi.axleBase ?? spec.axleBaseSingle} width={85} title="Khoảng cách tâm hai cụm bánh ngoài cùng — bề rộng vùng ổn định" onChange={(x) => set({ axleBase: x })} />
      </div>
      <p className="lead">Cấu hình module theo chiều dài xe (để trống = dùng số trục dòng cần)</p>
      {mi.units.map((u, i) => (
        <div key={i} className="row sub">
          <NumField label={i === 0 ? 'Số trục dòng' : undefined} value={u.lines} width={80}
            onChange={(x) => { const n = Math.max(1, Math.round(x)); unit(i, spmt ? { lines: n, drive: DRIVE_AXLES_DEFAULT[n] ?? u.drive } : { lines: n }); }} />
          {spmt && <NumField label={i === 0 ? 'Trục chủ động' : undefined} value={u.drive} width={80} title="Module 4 trục dòng: 4; 6 trục dòng: 4; 6 trục dòng 'super 6': 6" onChange={(x) => unit(i, { drive: Math.max(0, Math.round(x)) })} />}
          <button className="del" onClick={() => set({ units: mi.units.filter((_, j) => j !== i) })}>×</button>
        </div>
      ))}
      <div className="row">
        <button onClick={() => set({ units: [...mi.units, { lines: 4, drive: spmt ? 4 : 0 }] })}>+ module 4 trục dòng</button>
        <button onClick={() => set({ units: [...mi.units, { lines: 6, drive: spmt ? 4 : 0 }] })}>+ module 6 trục dòng</button>
        {spmt && <button onClick={() => set({ units: [...mi.units, { lines: 6, drive: 6 }] })}>+ super 6</button>}
      </div>
      <div className="row">
        <NumField label="Lực cản lăn" unit="%" value={mi.rolling} width={75} title="Đường nhựa khô: 3%" onChange={(x) => set({ rolling: x })} />
        <NumField label="Độ dốc" unit="%" value={mi.grade} width={75} onChange={(x) => set({ grade: x })} />
        <NumField label="PPU" unit="t" value={mi.ppu} width={75} title="Trọng lượng bộ nguồn (power pack unit)" onChange={(x) => set({ ppu: x })} />
      </div>
      {spmt ? (
        <div className="row">
          <NumField label="Lực đẩy / trục chủ động" unit="t" value={mi.propulsion} width={85} title="5,0–7,0 t" onChange={(x) => set({ propulsion: x })} />
          <NumField label="PPU / 10 trục dòng" unit="HP" value={mi.hpPer10} width={85} onChange={(x) => set({ hpPer10: x })} />
        </div>
      ) : (
        <div className="row">
          <NumField label="Số xe kéo" value={mi.trucks} width={70} onChange={(x) => set({ trucks: Math.max(0, Math.round(x)) })} />
          <NumField label="Tải trên trục chủ động / xe" unit="t" value={mi.truckDriveWeight} width={85} onChange={(x) => set({ truckDriveWeight: x })} />
          <NumField label="Tự trọng / xe kéo" unit="t" value={mi.truckWeight} width={85} onChange={(x) => set({ truckWeight: x })} />
        </div>
      )}
      <div className="row">
        <NumField label="Độ sâu hố" unit="mm" value={mi.pothole} width={85} onChange={(x) => set({ pothole: x })} />
        <NumField label="Số trục trong nhóm treo" value={mi.axlesPerGroup} width={75} title="Treo 4 điểm: thường 2 trục / nhóm; treo 3 điểm: nhóm lớn 4 trục" onChange={(x) => set({ axlesPerGroup: Math.max(1, Math.round(x)) })} />
      </div>
      <p className="lead">Ổn định (thẻ tham khảo trang 5–6)</p>
      <div className="row">
        <Select<Suspension> label="Kiểu treo" value={mi.suspension ?? '3'} options={[{ value: '3', label: 'Treo 3 điểm (vùng ổn định tam giác)' }, { value: '4', label: 'Treo 4 điểm (vùng ổn định chữ nhật)' }]} onChange={(x) => set({ suspension: x })} />
      </div>
      <div className="row">
        <Select label="Trọng tâm chung trên vùng ổn định" value={mi.cogMode ?? 'load'} options={[{ value: 'load', label: 'Tính từ hàng (bỏ qua xe module, thiên về an toàn)' }, { value: 'manual', label: 'Nhập tay' }]}
          onChange={(x) => set({ cogMode: x as 'load' | 'manual', cog: x === 'manual' ? Math.round(cogAuto * 1000) / 1000 : mi.cog })} />
        {(mi.cogMode ?? 'load') === 'manual'
          ? <NumField label="CoG" unit="m" value={mi.cog ?? 0} width={80} onChange={(x) => set({ cog: x })} />
          : <span className="muted small">CoG = cao sàn + trọng tâm hàng − {fmt(spec.stabilityElev, 3)} = {fmt(cogAuto, 3)} m</span>}
      </div>
      <div className="row">
        <NumField label="Góc thủy lực yêu cầu S_HSA" unit="°" value={mi.hsa ?? SAFE_HSA} width={70} onChange={(x) => set({ hsa: x })} />
        <NumField label="Góc kết cấu yêu cầu S_SSA" unit="°" value={mi.ssa ?? SAFE_SSA} width={70} onChange={(x) => set({ ssa: x })} />
      </div>
      <p className="lead">Dầm sống (trang 8)</p>
      <div className="row">
        <NumField label="Trục dòng thò ra — đầu trước" value={mi.overhangFront ?? 0} width={70} onChange={(x) => set({ overhangFront: Math.max(0, Math.round(x)) })} />
        <NumField label="— đầu sau" value={mi.overhangRear ?? 0} width={70} onChange={(x) => set({ overhangRear: Math.max(0, Math.round(x)) })} />
      </div>
      <div className="row">
        <Select label="Mô men cho phép (trung bình nhiều hãng)" value={SPINE_MOMENTS.find((s) => s.m === mi.spineM)?.key ?? 'custom'}
          options={[...SPINE_MOMENTS.map((s) => ({ value: s.key, label: `${s.label}: ${s.m} t·m` })), ...(SPINE_MOMENTS.some((s) => s.m === mi.spineM) ? [] : [{ value: 'custom', label: 'Tuỳ chỉnh' }])]}
          onChange={(k) => { const s = SPINE_MOMENTS.find((x) => x.key === k); if (s) set({ spineM: s.m }); }} />
        <NumField label="M cho phép" unit="t·m" value={mi.spineM ?? 0} width={85} onChange={(x) => set({ spineM: x })} />
      </div>
      <p className="lead">Áp lực nền (trang 9)</p>
      <div className="row">
        <Select label="Kết luận theo" value={String(mi.gpMethod ?? 1)} options={[{ value: '1', label: 'Cách 1: bóng xe T_L × T_W' }, { value: '2', label: 'Cách 2: lan truyền 45°, T_L × (T_W + D_AS)' }]}
          onChange={(x) => set({ gpMethod: x === '2' ? 2 : 1 })} />
        <NumField label="Áp lực cho phép" unit="t/m²" value={mi.pAllow ?? 0} width={85} title="0 = chỉ tính, không kết luận" onChange={(x) => set({ pAllow: x })} />
      </div>
      <p className="hint">T_W lấy từ ô “Rộng xe” ở trên.</p>
      <p className="lead">Ngoại lực (trang 10–12)</p>
      <div className="row">
        <NumField label="Góc lệch lực tăng tốc / phanh φ" unit="°" value={mi.accPhi ?? 0} width={70} onChange={(x) => set({ accPhi: x })} />
        <NumField label="Dốc dọc chưa bù α_GL" unit="°" value={mi.alphaGL ?? 0} width={70} onChange={(x) => set({ alphaGL: x })} />
        <NumField label="Dốc ngang chưa bù β_GT" unit="°" value={mi.betaGT ?? 0} width={70} onChange={(x) => set({ betaGT: x })} />
      </div>
      <div className="row">
        <NumField label="Áp lực gió W_P" unit="kN/m²" value={mi.windP ?? 0} width={85} onChange={(x) => set({ windP: x })} />
        <NumField label="Diện tích chắn gió" unit="m²" value={mi.windA ?? 0} width={80} onChange={(x) => set({ windA: x })} />
        <NumField label="Hệ số hình dạng S_f" value={mi.windSf ?? 1} width={65} onChange={(x) => set({ windSf: x })} />
      </div>
      <div className="row">
        <NumField label="Góc gió φ" unit="°" value={mi.windPhi ?? 0} width={70} title="0° = gió dọc xe, 90° = gió ngang" onChange={(x) => set({ windPhi: x })} />
        <NumField label="Tâm mặt chắn gió CoW" unit="m" value={mi.cow ?? 0} width={80} title="Chiều cao tâm mặt chắn gió trên vùng ổn định; 0 = lấy bằng CoG" onChange={(x) => set({ cow: x })} />
      </div>
      <p className="hint">Vận tốc vào cua, bán kính cua và gia tốc phanh lấy từ thẻ “Điều kiện đường”. Dốc chưa bù = góc đường − góc xe (sau khi xe tự cân bằng thủy lực).</p>
      <p className="hint">Theo thẻ tham khảo: SPMT 30 t, pull type 25 t mỗi trục dòng; mỗi trục dòng có 2 trục (cụm bánh). Lực kéo cần = (cản lăn + dốc) × tổng trọng lượng.
        Pull type: lực kéo tối đa = 80% trọng lượng trên trục chủ động của xe kéo.</p>
    </>
  );
}

/** Hình chiếu bằng: vùng ổn định (chữ nhật / tam giác) và các điểm P, S */
export function StabilityPlan({ x }: { x: ModularResult }) {
  const st = x.stab;
  if (!st) return null;
  const TL = st.TL, B = Math.max(st.DAB + 0.6, 1);
  const W = 620, pad = 16, top = 18;
  const s = Math.min((W - 2 * pad) / TL, 160 / B);
  const H = B * s + top + 2 * pad;
  const X = (u: number) => W / 2 + u * s;
  const Y = (v: number) => top + pad + (B / 2 - v) * s;
  const L2 = TL / 4, D2 = st.DAB / 2;
  // vùng ổn định: chữ nhật T_L/2 × D_AB (treo 4 điểm), tam giác đỉnh ở đầu trước (treo 3 điểm); trọng tâm ở trọng tâm vùng
  const poly = st.suspension === '4'
    ? [[-L2, -D2], [L2, -D2], [L2, D2], [-L2, D2]]
    : [[-TL / 6, -D2], [-TL / 6, D2], [TL / 3, 0]];
  const pts = poly.map(([u, v]) => `${X(u)},${Y(v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="beam-svg" role="img" aria-label="Vùng ổn định">
      <rect x={X(-TL / 2)} y={Y(B / 2)} width={TL * s} height={B * s} className="beam" />
      {Array.from({ length: x.linesLong }, (_, i) => {
        const u = -TL / 2 + x.spec.axleSpacing * (i + 0.5);
        return <g key={i}>{[-D2, D2].map((v, j) => <rect key={j} x={X(u) - 4} y={Y(v) - 6} width={8} height={12} className="support-fill" />)}</g>;
      })}
      <polygon points={pts} className="tv-stab" />
      <circle cx={X(0)} cy={Y(0)} r={5} className="tv-cg" />
      <text x={X(-TL / 2)} y={top} className="lbl tiny">{st.suspension === '4' ? 'Treo 4 điểm — vùng chữ nhật T_L/2 × D_AB' : 'Treo 3 điểm — vùng tam giác'}</text>
      <text x={X(TL / 2)} y={top} textAnchor="end" className="lbl tiny">đầu trước →</text>
      <text x={X(0) + 8} y={Y(0) - 6} className="lbl tiny">CoG</text>
    </svg>
  );
}

export function ModularTable({ x }: { x: ModularResult }) {
  return (
    <table className="grid">
      <tbody>
        <tr><td>Tải đặt lên xe</td><td>{fmt(x.payload, 3)} t</td><td></td></tr>
        <tr><td>Số trục dòng cần</td><td>{x.linesReq} (đang dùng {x.lines})</td><td></td></tr>
        {x.checks.map((c, i) => <tr key={i}><td>{c.label}</td><td>{c.value}</td><td><Pass ok={c.ok} /></td></tr>)}
        <tr><td>Tổng trọng lượng</td><td>{fmt(x.gvw, 3)} t</td><td></td></tr>
        <tr><td>Lực kéo cần</td><td>{fmt(x.effort, 3)} t</td><td></td></tr>
        {x.ppuHp !== null && <tr><td>Công suất PPU</td><td>{fmt(x.ppuHp, 1)} HP ({fmt(x.ppuKw ?? 0, 1)} kW)</td><td></td></tr>}
        {x.trucksReq !== null && <tr><td>Số xe kéo cần</td><td>{x.trucksReq}</td><td></td></tr>}
        <tr><td>Độ nghiêng khi một nhóm treo qua hố</td><td>{fmt(x.lean, 1)} mm</td><td></td></tr>
        <tr><td>Chiều dài xe T_L</td><td>{x.linesLong} × {fmt(x.spec.axleSpacing, 2)} = {fmt(x.length, 2)} m{x.wide === 2 ? ' (module đôi)' : ''}</td><td></td></tr>
        {x.stab && <>
          <tr><td>Tải một trục W_axle / khả năng trục A_C</td><td>{fmt(x.stab.Waxle, 3)} / {fmt(x.stab.Ac, 3)} t ({x.stab.axles} trục)</td><td></td></tr>
          <tr><td>Độ dời trọng tâm tới giới hạn kết cấu (dọc / ngang)</td><td>{fmt(x.stab.sLong, 3)} / {fmt(x.stab.sTrans, 3)} m</td><td></td></tr>
        </>}
        {x.spine.ends.filter((e) => e.n > 0).map((e, i) => <tr key={'sp' + i}><td>Dầm sống — {e.label.toLowerCase()} ({e.n} trục dòng thò ra)</td><td>M = {fmt(e.M, 1)} t·m</td><td></td></tr>)}
        <tr><td>Số trục dòng được thò ra (theo khả năng trục)</td><td>{x.spine.nMax} (M_cho phép / (A_C·2·D_AS) = {fmt(x.spine.ratio, 2)})</td><td></td></tr>
      </tbody>
    </table>
  );
}

export function GroundExtTables({ x }: { x: ModularResult }) {
  const g = x.ground, e = x.ext;
  return (
    <>
      <table className="grid">
        <thead><tr><th>Áp lực nền (trang 9)</th><th>Diện tích (m²)</th><th>P (t/m²)</th><th>P (kPa)</th><th></th></tr></thead>
        <tbody>
          <tr><td>Cách 1: T_L × T_W = {fmt(g.TL, 2)} × {fmt(g.TW, 2)}</td><td>{fmt(g.TL * g.TW, 2)}</td><td><b>{fmt(g.p1, 3)}</b></td><td>{fmt(g.p1 * 9.81, 1)}</td><td>{g.method === 1 && <Pass ok={g.ok} />}</td></tr>
          <tr><td>Cách 2: T_L × (T_W + D_AS) = {fmt(g.TL, 2)} × {fmt(g.TW + g.DAS, 2)}</td><td>{fmt(g.TL * (g.TW + g.DAS), 2)}</td><td><b>{fmt(g.p2, 3)}</b></td><td>{fmt(g.p2 * 9.81, 1)}</td><td>{g.method === 2 && <Pass ok={g.ok} />}</td></tr>
        </tbody>
      </table>
      {e && e.forces.length > 0 && (
        <table className="grid">
          <thead><tr><th>Ngoại lực (trang 10–12)</th><th>F (t)</th><th>F_SUSP (t)</th><th>Số trục nhóm</th><th>F_AXLE (t/trục)</th></tr></thead>
          <tbody>
            {e.forces.map((f, i) => <tr key={i}><td>{f.label}</td><td>{fmt(f.F, 3)}</td><td>{fmt(f.Fs, 3)}</td><td>{f.n}</td><td>{fmt(f.Faxle, 4)}</td></tr>)}
            <tr><td>Tổng thêm trên trục (ngang / dọc)</td><td colSpan={3}></td><td>{fmt(e.axleT, 4)} / {fmt(e.axleL, 4)}</td></tr>
          </tbody>
        </table>
      )}
    </>
  );
}
