import type { ReactNode } from 'react';
import { fmt } from '../core/stress';
import { effectiveRestraints, type Model } from '../core/types';

const W = 900;
const PADX = 60;

/** Sơ đồ tính: thanh, liên kết, khớp, tải trọng, kích thước. */
export function BeamView({ model, cursorX }: { model: Model; cursorX?: number | null }) {
  const L = model.length > 0 ? model.length : 1;
  const X = (x: number) => PADX + (x / L) * (W - 2 * PADX);
  const by = 120; // cao độ trục thanh
  const H = 250;
  const els: ReactNode[] = [];

  // Tải phân bố
  model.loads.forEach((ld) => {
    if (ld.type !== 'distributed') return;
    const qMax = Math.max(1e-9, ...model.loads.map((l) => (l.type === 'distributed' ? Math.max(Math.abs(l.q1), Math.abs(l.q2)) : 0)));
    const sc = (q: number) => (Math.abs(q) / qMax) * 45;
    const x1 = X(ld.x1), x2 = X(ld.x2);
    if (ld.dir === 'y') {
      const down = ld.q1 + ld.q2 <= 0;
      const yBase = down ? by - 6 : by + 6;
      const e1 = down ? by - 10 - sc(ld.q1) : by + 10 + sc(ld.q1);
      const e2 = down ? by - 10 - sc(ld.q2) : by + 10 + sc(ld.q2);
      const n = Math.max(2, Math.round((x2 - x1) / 28));
      els.push(<polygon key={ld.id + 'p'} points={`${x1},${yBase} ${x1},${e1} ${x2},${e2} ${x2},${yBase}`} className="dist-fill" />);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const xx = x1 + (x2 - x1) * t;
        const ee = e1 + (e2 - e1) * t;
        if (Math.abs(ee - yBase) > 4) els.push(<Arrow key={ld.id + i} x1={xx} y1={ee} x2={xx} y2={yBase} cls="load thin" />);
      }
      els.push(
        <text key={ld.id + 't'} x={(x1 + x2) / 2} y={Math.min(e1, e2, yBase) - 6} className="lbl load-lbl" textAnchor="middle">
          {ld.name} = {ld.q1 === ld.q2 ? fmt(Math.abs(ld.q1), 2) : `${fmt(Math.abs(ld.q1), 2)}→${fmt(Math.abs(ld.q2), 2)}`} kN/m
        </text>,
      );
    } else {
      const yy = ld.dir === 'x' ? by - 18 : by + 18;
      els.push(<line key={ld.id} x1={x1} y1={yy} x2={x2} y2={yy} className="load dashed" />);
      els.push(
        <text key={ld.id + 't'} x={(x1 + x2) / 2} y={yy - 5} className="lbl load-lbl" textAnchor="middle">
          {ld.name} ({ld.dir}) = {fmt(ld.q1, 2)}{ld.q1 !== ld.q2 ? `→${fmt(ld.q2, 2)}` : ''} kN/m
        </text>,
      );
    }
  });

  // Nhiệt độ: dải tô màu trên thanh + nhãn
  model.loads.forEach((ld, i) => {
    if (ld.type !== 'temp') return;
    const x1 = X(ld.x1), x2 = X(ld.x2);
    const yy = by - 84 - 14 * (i % 2);
    els.push(<line key={ld.id} x1={x1} y1={yy} x2={x2} y2={yy} className="load dashed" />);
    els.push(
      <text key={ld.id + 't'} x={(x1 + x2) / 2} y={yy - 4} className="lbl load-lbl" textAnchor="middle">
        {ld.Ttop === ld.Tbot ? `${ld.name}: ΔT = ${fmt(ld.Ttop, 1)} °C` : `${ld.name}: ΔT trên ${fmt(ld.Ttop, 1)} / dưới ${fmt(ld.Tbot, 1)} °C`}
      </text>,
    );
  });

  // Thanh
  els.push(<rect key="beam" x={X(0)} y={by - 6} width={X(L) - X(0)} height={12} className="beam" />);

  // Gối
  model.supports.forEach((s) => {
    const x = X(Math.min(Math.max(s.x, 0), L));
    const r = effectiveRestraints(s);
    const g: ReactNode[] = [];
    if (s.kind === 'fixed') {
      const left = s.x <= L / 2;
      const wx = left ? x - 4 : x + 4;
      g.push(<line key="w" x1={wx} y1={by - 34} x2={wx} y2={by + 34} className="support" />);
      for (let i = -32; i <= 28; i += 10) {
        g.push(<line key={i} x1={wx} y1={by + i} x2={wx + (left ? -10 : 10)} y2={by + i + 10} className="support thin" />);
      }
    } else if (s.kind === 'pin' || s.kind === 'roller') {
      g.push(<polygon key="t" points={`${x},${by + 6} ${x - 13},${by + 30} ${x + 13},${by + 30}`} className="support-fill" />);
      if (s.kind === 'roller') {
        g.push(<circle key="c1" cx={x - 7} cy={by + 35} r={4} className="support-fill" />);
        g.push(<circle key="c2" cx={x + 7} cy={by + 35} r={4} className="support-fill" />);
        g.push(<line key="g" x1={x - 18} y1={by + 40} x2={x + 18} y2={by + 40} className="support" />);
      } else {
        g.push(<line key="g" x1={x - 18} y1={by + 31} x2={x + 18} y2={by + 31} className="support" />);
        for (let i = -16; i <= 12; i += 7) g.push(<line key={i} x1={x + i} y1={by + 31} x2={x + i - 6} y2={by + 38} className="support thin" />);
      }
    } else if (s.kind === 'spring') {
      const k = s.springs;
      if (k?.ky) {
        g.push(<polyline key="z" points={`${x},${by + 6} ${x},${by + 11} ${x - 7},${by + 14} ${x + 7},${by + 19} ${x - 7},${by + 24} ${x + 7},${by + 29} ${x},${by + 32} ${x},${by + 38}`} className="support" fill="none" />);
        g.push(<line key="g" x1={x - 16} y1={by + 38} x2={x + 16} y2={by + 38} className="support" />);
      }
      if (k?.kx) g.push(<polyline key="zx" points={`${x},${by} ${x - 5},${by} ${x - 8},${by - 6} ${x - 13},${by + 6} ${x - 18},${by - 6} ${x - 23},${by + 6} ${x - 26},${by} ${x - 30},${by}`} className="support" fill="none" />);
      if (k?.krz || k?.kry || k?.krx) g.push(<path key="zr" d={`M ${x} ${by - 10} a 10 10 0 1 0 0.1 0`} className="support thin" fill="none" />);
      const lab = [k?.ky && 'k_y', k?.kx && 'k_x', k?.kz && 'k_z', k?.krz && 'k_φz', k?.kry && 'k_φy', k?.krx && 'k_φx'].filter(Boolean).join(',');
      g.push(<text key="l" x={x + 10} y={by + 26} className="lbl tiny">{lab || '∅'}</text>);
    } else {
      const lab = (Object.keys(r) as (keyof typeof r)[]).filter((k) => r[k]).join(',');
      g.push(<rect key="r" x={x - 10} y={by + 8} width={20} height={20} className="support-fill" />);
      g.push(<text key="l" x={x} y={by + 44} className="lbl tiny" textAnchor="middle">{lab || '∅'}</text>);
    }
    g.push(<text key="n" x={x} y={by + 62} className="lbl strong" textAnchor="middle">{s.name}</text>);
    const st = s.settle;
    if (st && Object.values(st).some((v) => v)) {
      const parts = [st.dx && `Δx ${fmt(st.dx, 1)}`, st.dy && `Δy ${fmt(st.dy, 1)}`, st.dz && `Δz ${fmt(st.dz, 1)}`].filter(Boolean).join(', ');
      const rot = [st.rz && `φz ${fmt(st.rz, 2)}‰`, st.ry && `φy ${fmt(st.ry, 2)}‰`].filter(Boolean).join(', ');
      g.push(<text key="st" x={x} y={by + 76} className="lbl tiny load-lbl" textAnchor="middle">lún {parts}{parts ? ' mm' : ''}{rot ? ` ${rot}` : ''}</text>);
    }
    els.push(<g key={s.id}>{g}</g>);
  });

  // Khớp nối
  model.hinges.forEach((h) => {
    els.push(<circle key={h.id} cx={X(h.x)} cy={by} r={6} className="hinge" />);
    els.push(<text key={h.id + 't'} x={X(h.x)} y={by - 12} className="lbl strong" textAnchor="middle">{h.name}</text>);
  });

  // Lực tập trung & mô men
  model.loads.forEach((ld) => {
    if (ld.type === 'force') {
      const x = X(ld.x);
      const mag = Math.hypot(ld.Fx, ld.Fy);
      if (mag > 0) {
        const ux = ld.Fx / mag, uy = -ld.Fy / mag; // màn hình y hướng xuống
        const len = 60;
        const tipY = uy > 0 ? by - 7 : uy < 0 ? by + 7 : by;
        const tipX = x - (Math.abs(uy) < 0.2 ? ux * 2 : 0);
        els.push(<Arrow key={ld.id} x1={tipX - ux * len} y1={tipY - uy * len} x2={tipX} y2={tipY} cls="load" />);
        els.push(
          <text key={ld.id + 't'} x={tipX - ux * len + 6} y={tipY - uy * len + (uy > 0 ? -4 : 14)} className="lbl load-lbl">
            {ld.name} = {fmt(mag, 2)} kN
          </text>,
        );
      }
      if (ld.Fz) {
        els.push(<circle key={ld.id + 'z'} cx={x} cy={by + 80} r={8} className="load-z" />);
        els.push(ld.Fz > 0
          ? <circle key={ld.id + 'zd'} cx={x} cy={by + 80} r={2} className="load-dot" />
          : <path key={ld.id + 'zx'} d={`M${x - 5},${by + 75}L${x + 5},${by + 85}M${x + 5},${by + 75}L${x - 5},${by + 85}`} className="load" />);
        els.push(<text key={ld.id + 'zt'} x={x + 12} y={by + 84} className="lbl load-lbl">Fz = {fmt(ld.Fz, 2)} kN</text>);
      }
    } else if (ld.type === 'moment') {
      const x = X(ld.x);
      if (ld.Mz) {
        const r = 22;
        const ccw = ld.Mz > 0;
        // cung 270°
        const a0 = ccw ? -0.25 * Math.PI : 0.25 * Math.PI + Math.PI;
        const a1 = ccw ? 1.25 * Math.PI : -0.25 * Math.PI;
        const p = (a: number) => [x + r * Math.cos(a), by - r * Math.sin(a)];
        const [sx, sy] = p(a0);
        const [ex, ey] = p(a1);
        els.push(
          <path key={ld.id} d={`M${sx},${sy} A${r},${r} 0 1 ${ccw ? 0 : 1} ${ex},${ey}`} className="load moment" markerEnd="url(#arrow)" />,
        );
        els.push(<text key={ld.id + 't'} x={x > W - 200 ? x - 26 : x + 26} y={by - 30} className="lbl load-lbl" textAnchor={x > W - 200 ? 'end' : 'start'}>{ld.name} = {fmt(Math.abs(ld.Mz), 2)} kN·m</text>);
      }
      if (ld.Mx) {
        els.push(<Arrow key={ld.id + 'x1'} x1={x - 30} y1={by - 44} x2={x + 10} y2={by - 44} cls="load torque" />);
        els.push(<Arrow key={ld.id + 'x2'} x1={x - 30} y1={by - 44} x2={x + 18} y2={by - 44} cls="load torque" />);
        els.push(<text key={ld.id + 'xt'} x={x + 22} y={by - 40} className="lbl load-lbl">T = {fmt(ld.Mx, 2)} kN·m</text>);
      }
      if (ld.My) {
        els.push(<text key={ld.id + 'yt'} x={x} y={by + 100} className="lbl load-lbl" textAnchor="middle">My = {fmt(ld.My, 2)} kN·m</text>);
      }
    }
  });

  // Kích thước
  const pts = [...new Set([0, L, ...model.supports.map((s) => s.x), ...model.hinges.map((h) => h.x),
    ...model.loads.flatMap((l) => (l.type === 'distributed' || l.type === 'temp' ? [l.x1, l.x2] : [l.x]))]
    .filter((x) => x >= 0 && x <= L).map((x) => Math.round(x * 1e6) / 1e6))].sort((a, b) => a - b);
  const dy = H - 22;
  els.push(<line key="dim" x1={X(0)} y1={dy} x2={X(L)} y2={dy} className="dim" />);
  pts.forEach((p, i) => {
    els.push(<line key={'dt' + i} x1={X(p)} y1={dy - 5} x2={X(p)} y2={dy + 5} className="dim" />);
    if (i > 0) {
      els.push(<text key={'dl' + i} x={(X(p) + X(pts[i - 1])) / 2} y={dy - 6} className="lbl tiny" textAnchor="middle">{fmt(p - pts[i - 1], 3)} m</text>);
    }
  });

  if (cursorX != null) els.push(<line key="cur" x1={X(cursorX)} y1={20} x2={X(cursorX)} y2={H - 30} className="cursor" />);

  return (
    <svg className="beam-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0L10,5L0,10z" className="arrow-head" />
        </marker>
      </defs>
      {els}
    </svg>
  );
}

function Arrow({ x1, y1, x2, y2, cls }: { x1: number; y1: number; x2: number; y2: number; cls: string }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} className={cls} markerEnd="url(#arrow)" />;
}
