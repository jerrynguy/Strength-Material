import type { MouseEvent, ReactNode } from 'react';
import { supportDirections, type FrameModel, type FrameResult, type FLoad } from '../../core/frame';
import { fmt } from '../../core/stress';

export type FrameViewMode = 'model' | 'N' | 'Q' | 'M' | 'deform';

const W = 900;

export function FrameView(props: {
  model: FrameModel;
  res?: FrameResult | null;
  mode: FrameViewMode;
  pick?: { memberId: string; s: number } | null;
  onPick?: (memberId: string, s: number) => void;
  mTensionSide?: boolean;
}) {
  const { model, res, mode, pick } = props;
  const nodes = model.nodes;
  if (nodes.length === 0) return <p className="muted">Chưa có nút.</p>;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const n of nodes) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); }
  const span = Math.max(x1 - x0, y1 - y0, 1);
  const nodeById0 = new Map(nodes.map((n) => [n.id, n]));

  // Hình học biểu đồ trong hệ toạ độ thực (để khung nhìn ôm trọn biểu đồ)
  type WPt = [number, number];
  const dia: { id: string; kind: string; poly: WPt[]; curve: WPt[]; labels: { p: WPt; text: string }[] }[] = [];
  let deformScale = 0;
  if (res?.ok && (mode === 'N' || mode === 'Q' || mode === 'M')) {
    let vmax = 1e-12;
    for (const mr of res.members) for (const sm of mr.samples) vmax = Math.max(vmax, Math.abs(sm[mode]));
    const scale = (0.11 * span) / vmax;
    for (const mr of res.members) {
      const mem = model.members.find((m) => m.id === mr.id)!;
      const a = nodeById0.get(mem.i)!;
      const P = (sv: number, v: number): WPt => {
        const off = (mode === 'M' && props.mTensionSide !== false ? -v : v) * scale;
        return [a.x + mr.c * sv - mr.s * off, a.y + mr.s * sv + mr.c * off];
      };
      const curve = mr.samples.map((sm) => P(sm.s, sm[mode]));
      const lab: { s: number; v: number }[] = [];
      const push = (sv: number, v: number) => {
        if (Math.abs(v) < 1e-6 * vmax) return;
        if (lab.some((l) => Math.abs(l.s - sv) < mr.L * 0.04 && Math.abs(l.v - v) < 1e-6 * Math.max(1, Math.abs(v)))) return;
        lab.push({ s: sv, v });
      };
      for (const ks of mr.keyS) { push(ks, mr.internalAt(ks, 'left')[mode]); push(ks, mr.internalAt(ks, 'right')[mode]); }
      let best = mr.samples[0];
      for (const sm of mr.samples) if (Math.abs(sm[mode]) > Math.abs(best[mode])) best = sm;
      push(best.s, best[mode]);
      dia.push({
        id: mr.id, kind: mode, curve, poly: [P(0, 0), ...curve, P(mr.L, 0)],
        labels: lab.map((l) => ({ p: P(Math.min(Math.max(l.s, mr.L * 0.06), mr.L * 0.94), l.v * 1.15), text: fmt(l.v, 2) })),
      });
    }
  }
  if (res?.ok && mode === 'deform') {
    let dmax = 1e-12;
    for (const mr of res.members) for (const d of mr.disp) dmax = Math.max(dmax, Math.hypot(d.ux, d.uy));
    deformScale = (0.08 * span) / (dmax / 1e3);
    for (const mr of res.members) {
      const mem = model.members.find((m) => m.id === mr.id)!;
      const a = nodeById0.get(mem.i)!;
      const curve = mr.disp.map((d): WPt => [a.x + mr.c * d.s + (d.ux / 1e3) * deformScale, a.y + mr.s * d.s + (d.uy / 1e3) * deformScale]);
      dia.push({ id: mr.id, kind: 'deform', curve, poly: [], labels: [] });
    }
  }
  for (const d of dia) for (const [x, y] of [...d.curve, ...d.labels.map((l) => l.p)]) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  const spanW = Math.max(x1 - x0, 1e-6), spanH = Math.max(y1 - y0, 1e-6);
  const pad = 70;
  const k = Math.min((W - 2 * pad) / Math.max(spanW, span * 0.25), 440 / Math.max(spanH, span * 0.15));
  const H = Math.max(260, Math.min(640, spanH * k + 2 * pad));
  const ox = (W - spanW * k) / 2 - x0 * k;
  const oy = (H + spanH * k) / 2 + y0 * k;
  const X = (x: number) => ox + x * k;
  const Y = (y: number) => oy - y * k;
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const els: ReactNode[] = [];
  const faint = mode !== 'model';

  // Thanh
  for (const m of model.members) {
    const a = nodeById.get(m.i), b = nodeById.get(m.j);
    if (!a || !b) continue;
    els.push(<line key={m.id} x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)} className={faint ? 'fr-member faint' : 'fr-member'} />);
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;
    // nhãn tên thanh lệch về phía +y'
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (mode === 'model') {
      els.push(
        <text key={m.id + 't'} x={X(mx) - uy * 14} y={Y(my) - ux * 14 + 4} className="lbl tiny" textAnchor="middle">
          {m.name} · {fmt(L, 3)} m
        </text>,
      );
    }
    const rel = (n: typeof a, dir: number) => (
      <circle cx={X(n.x) + ux * dir * 11} cy={Y(n.y) - uy * dir * 11} r={4.5} className="hinge" />
    );
    if (m.releaseI) els.push(<g key={m.id + 'ri'}>{rel(a, 1)}</g>);
    if (m.releaseJ) els.push(<g key={m.id + 'rj'}>{rel(b, -1)}</g>);
  }

  // Biểu đồ
  const placed: { x: number; y: number; t: string }[] = [];
  for (const d of dia) {
    const pts = d.curve.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
    if (d.kind === 'deform') {
      els.push(<polyline key={d.id + 'df'} points={pts} className="fr-deform" />);
      continue;
    }
    els.push(<polygon key={d.id + 'd'} points={d.poly.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' ')} className={`fr-dia fr-${d.kind}`} />);
    els.push(<polyline key={d.id + 'l'} points={pts} className={`fr-dial fr-${d.kind}`} />);
    d.labels.forEach((l, q) => {
      const px = X(l.p[0]), py = Y(l.p[1]);
      if (placed.some((o) => Math.hypot(o.x - px, o.y - py) < 30 && o.t === l.text)) return;
      if (placed.some((o) => Math.hypot(o.x - px, o.y - py) < 14)) return;
      placed.push({ x: px, y: py, t: l.text });
      els.push(<text key={d.id + 'v' + q} x={px} y={py + 4} className="d-val" textAnchor="middle">{l.text}</text>);
    });
  }
  if (res?.ok && mode === 'deform') {
    let dmax = 1e-12;
    for (const nd of res.nodeDisp) dmax = Math.max(dmax, Math.hypot(nd.ux, nd.uy));
    for (const nd of res.nodeDisp) {
      const n = nodeById.get(nd.nodeId)!;
      const m = Math.hypot(nd.ux, nd.uy);
      if (m < 1e-6 * dmax) continue;
      const px = X(n.x + (nd.ux / 1e3) * deformScale), py = Y(n.y + (nd.uy / 1e3) * deformScale);
      els.push(<text key={nd.nodeId + 'dd'} x={px + 8} y={py - 8} className="d-val">{fmt(m, 3)} mm</text>);
    }
    let best = { m: 0, x: 0, y: 0 };
    for (const d of dia) for (const mr of res.members.filter((q) => q.id === d.id)) {
      mr.disp.forEach((dd, q) => {
        const m = Math.hypot(dd.ux, dd.uy);
        if (m > best.m) best = { m, x: d.curve[q][0], y: d.curve[q][1] };
      });
    }
    if (best.m > dmax * 1.0001) {
      els.push(<text key="dmax" x={X(best.x) + 8} y={Y(best.y) + 16} className="d-val">max {fmt(best.m, 3)} mm</text>);
    }
    els.push(<text key="dsc" x={12} y={H - 10} className="lbl tiny">Phóng đại ×{fmt(deformScale, 0)}</text>);
  }

  // Gối
  for (const s of model.supports) {
    const n = nodeById.get(s.nodeId);
    if (!n) continue;
    const g: ReactNode[] = [];
    if (s.kind === 'fixed') {
      g.push(<line key="w" x1={-22} y1={0} x2={22} y2={0} className="support" />);
      for (let i = -20; i <= 16; i += 8) g.push(<line key={i} x1={i} y1={0} x2={i + 7} y2={9} className="support thin" />);
    } else if (s.kind === 'pin' || s.kind === 'roller') {
      g.push(<polygon key="t" points="0,0 -12,20 12,20" className="support-fill" />);
      if (s.kind === 'roller') {
        g.push(<circle key="a" cx={-6} cy={24} r={4} className="support-fill" />);
        g.push(<circle key="b" cx={6} cy={24} r={4} className="support-fill" />);
        g.push(<line key="g" x1={-18} y1={29} x2={18} y2={29} className="support" />);
      } else {
        g.push(<line key="g" x1={-18} y1={21} x2={18} y2={21} className="support" />);
        for (let i = -16; i <= 10; i += 7) g.push(<line key={i} x1={i} y1={21} x2={i + 6} y2={28} className="support thin" />);
      }
    } else {
      const lab = supportDirections(s).map((d) => d.label).join('');
      g.push(<rect key="r" x={-9} y={2} width={18} height={18} className="support-fill" />);
      g.push(<text key="l" x={0} y={34} className="lbl tiny" textAnchor="middle">{lab || '∅'}</text>);
    }
    els.push(<g key={s.id} transform={`translate(${X(n.x)},${Y(n.y)}) rotate(${-s.angle})`}>{g}</g>);
  }

  // Nút
  for (const n of nodes) {
    els.push(<circle key={n.id} cx={X(n.x)} cy={Y(n.y)} r={3.5} className="fr-node" />);
    els.push(<text key={n.id + 't'} x={X(n.x) - 10} y={Y(n.y) - 9} className="lbl strong" textAnchor="end">{n.name}</text>);
  }

  // Tải trọng
  if (mode === 'model') for (const ld of model.loads) els.push(...drawLoad(ld, model, X, Y, span));

  // Điểm chọn
  if (pick && res?.ok) {
    const mr = res.members.find((m) => m.id === pick.memberId);
    const mem = model.members.find((m) => m.id === pick.memberId);
    const a = mem && nodeById.get(mem.i);
    if (mr && a) {
      const px = X(a.x + mr.c * pick.s), py = Y(a.y + mr.s * pick.s);
      els.push(<circle key="pick" cx={px} cy={py} r={6} className="probe" />);
      if (mode === 'N' || mode === 'Q' || mode === 'M') {
        const v = mr.internalAt(pick.s, 'left')[mode];
        els.push(<text key="pickt" x={px + 9} y={py + 16} className="probe-label">{mode} = {fmt(v, 3)}</text>);
      }
    }
  }

  const onClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!props.onPick) return;
    const r = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const sy = ((e.clientY - r.top) / r.height) * H;
    let best: { id: string; s: number; d: number } | null = null;
    for (const m of model.members) {
      const a = nodeById.get(m.i), b = nodeById.get(m.j);
      if (!a || !b) continue;
      const ax = X(a.x), ay = Y(a.y), bx = X(b.x), by = Y(b.y);
      const L2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const t = Math.min(1, Math.max(0, ((sx - ax) * (bx - ax) + (sy - ay) * (by - ay)) / L2));
      const d = Math.hypot(ax + t * (bx - ax) - sx, ay + t * (by - ay) - sy);
      if (!best || d < best.d) best = { id: m.id, s: t * Math.hypot(b.x - a.x, b.y - a.y), d };
    }
    if (best && best.d < 40) props.onPick(best.id, Math.round(best.s * 1000) / 1000);
  };

  return (
    <svg className="frame-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" onClick={onClick}
      style={{ cursor: props.onPick ? 'crosshair' : undefined }}>
      <defs>
        <marker id="farrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0L10,5L0,10z" className="arrow-head" />
        </marker>
      </defs>
      {els}
    </svg>
  );
}

function drawLoad(ld: FLoad, model: FrameModel, X: (x: number) => number, Y: (y: number) => number, span: number): ReactNode[] {
  const out: ReactNode[] = [];
  const arrowLen = 55;
  const arrow = (key: string, tx: number, ty: number, dx: number, dy: number, len = arrowLen, label?: string) => {
    // (dx, dy) hướng lực trong hệ tổng thể, đầu mũi tại (tx, ty) màn hình
    const m = Math.hypot(dx, dy) || 1;
    const ux = dx / m, uy = -dy / m;
    out.push(<line key={key} x1={tx - ux * len} y1={ty - uy * len} x2={tx - ux * 3} y2={ty - uy * 3} className="load" markerEnd="url(#farrow)" />);
    if (label) out.push(<text key={key + 't'} x={tx - ux * len + 4} y={ty - uy * len - 4} className="lbl load-lbl">{label}</text>);
  };
  const momentArc = (key: string, cx: number, cy: number, M: number, label: string) => {
    const r = 20, ccw = M > 0;
    const a0 = ccw ? -0.25 * Math.PI : 1.25 * Math.PI, a1 = ccw ? 1.25 * Math.PI : -0.25 * Math.PI;
    const p = (a: number) => [cx + r * Math.cos(a), cy - r * Math.sin(a)];
    const [sx, sy] = p(a0), [ex, ey] = p(a1);
    out.push(<path key={key} d={`M${sx},${sy} A${r},${r} 0 1 ${ccw ? 0 : 1} ${ex},${ey}`} className="load moment" markerEnd="url(#farrow)" />);
    out.push(<text key={key + 't'} x={cx + 24} y={cy - 22} className="lbl load-lbl">{label}</text>);
  };
  if (ld.type === 'node') {
    const n = model.nodes.find((q) => q.id === ld.nodeId);
    if (!n) return out;
    if (ld.Fx || ld.Fy) arrow(ld.id, X(n.x), Y(n.y), ld.Fx, ld.Fy, arrowLen, `${ld.name} = ${fmt(Math.hypot(ld.Fx, ld.Fy), 2)} kN`);
    if (ld.M) momentArc(ld.id + 'm', X(n.x), Y(n.y), ld.M, `${ld.name} = ${fmt(Math.abs(ld.M), 2)} kN·m`);
    return out;
  }
  const mem = model.members.find((m) => m.id === ld.memberId);
  const a = mem && model.nodes.find((q) => q.id === mem.i);
  const b = mem && model.nodes.find((q) => q.id === mem.j);
  if (!mem || !a || !b) return out;
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const c = (b.x - a.x) / L, s = (b.y - a.y) / L;
  const at = (t: number): [number, number] => [a.x + c * t, a.y + s * t];
  if (ld.type === 'mpoint') {
    const [px, py] = at(ld.a);
    const [gx, gy] = ld.local ? [c * ld.Fx - s * ld.Fy, s * ld.Fx + c * ld.Fy] : [ld.Fx, ld.Fy];
    if (gx || gy) arrow(ld.id, X(px), Y(py), gx, gy, arrowLen, `${ld.name} = ${fmt(Math.hypot(gx, gy), 2)} kN`);
    if (ld.M) momentArc(ld.id + 'm', X(px), Y(py), ld.M, `${ld.name} = ${fmt(Math.abs(ld.M), 2)} kN·m`);
    return out;
  }
  // phân bố
  const dirVec = (q: number): [number, number] => {
    switch (ld.dir) {
      case 'gy': case 'gyp': return [0, q];
      case 'gx': case 'gxp': return [q, 0];
      case 'ly': return [-s * q, c * q];
      case 'lx': return [c * q, s * q];
    }
  };
  const qm = Math.max(Math.abs(ld.q1), Math.abs(ld.q2)) || 1;
  const nArr = Math.max(3, Math.round(((ld.b - ld.a) / span) * 14));
  const tips: [number, number][] = [];
  const tails: [number, number][] = [];
  for (let i = 0; i <= nArr; i++) {
    const t = ld.a + ((ld.b - ld.a) * i) / nArr;
    const q = ld.q1 + ((ld.q2 - ld.q1) * (t - ld.a)) / (ld.b - ld.a);
    const [px, py] = at(t);
    const [dx, dy] = dirVec(q);
    const len = 12 + (Math.abs(q) / qm) * 34;
    const m = Math.hypot(dx, dy);
    const ux = m ? dx / m : 0, uy = m ? -dy / m : 0;
    const tx = X(px) - ux * 3, ty = Y(py) - uy * 3;
    tips.push([tx, ty]);
    tails.push([tx - ux * len, ty - uy * len]);
    if (m > 0) out.push(<line key={ld.id + i} x1={tx - ux * len} y1={ty - uy * len} x2={tx} y2={ty} className="load thin" markerEnd="url(#farrow)" />);
  }
  out.push(<polyline key={ld.id + 'env'} points={tails.map((p) => p.join(',')).join(' ')} className="load thin" />);
  const mid = tails[Math.floor(tails.length / 2)];
  const per = ld.dir === 'gyp' ? '/m ngang' : ld.dir === 'gxp' ? '/m đứng' : '/m';
  out.push(
    <text key={ld.id + 't'} x={mid[0] + 6} y={mid[1] - 6} className="lbl load-lbl">
      {ld.name} = {ld.q1 === ld.q2 ? fmt(Math.abs(ld.q1), 2) : `${fmt(Math.abs(ld.q1), 2)}→${fmt(Math.abs(ld.q2), 2)}`} kN{per}
    </text>,
  );
  return out;
}
