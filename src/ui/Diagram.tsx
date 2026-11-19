import type { MouseEvent, ReactNode } from 'react';
import { fmt } from '../core/stress';

const W = 900;
const PADX = 60;

export interface DiagramProps {
  title: ReactNode;
  unit: string;
  data: { x: number; y: number }[];
  L: number;
  keyPoints: number[];
  /** Vẽ giá trị dương xuống dưới (quy ước biểu đồ mô men vẽ về phía thớ căng) */
  invert?: boolean;
  cursorX?: number | null;
  onHover?: (x: number | null) => void;
  onPick?: (x: number) => void;
  tone?: 'a' | 'b' | 'c' | 'd';
  digits?: number;
}

function valueAt(data: { x: number; y: number }[], x: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i].x - x) < 1e-12) out.push(data[i].y);
  }
  if (out.length) return out;
  for (let i = 0; i + 1 < data.length; i++) {
    const a = data[i], b = data[i + 1];
    if (x > a.x && x < b.x) return [a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x)];
  }
  return [];
}

export function Diagram(p: DiagramProps) {
  const { data, L, invert, cursorX, digits = 2 } = p;
  const H = 170;
  const padY = 26;
  const X = (x: number) => PADX + (x / L) * (W - 2 * PADX);
  let lo = 0, hi = 0;
  for (const d of data) { lo = Math.min(lo, d.y); hi = Math.max(hi, d.y); }
  const span = hi - lo || 1;
  const Y = (v: number) => {
    const t = (v - lo) / span; // 0..1
    return invert ? padY + t * (H - 2 * padY) : H - padY - t * (H - 2 * padY);
  };
  const y0 = Y(0);
  const pts = data.map((d) => `${X(d.x).toFixed(2)},${Y(d.y).toFixed(2)}`).join(' ');
  const poly = data.length ? `${X(data[0].x)},${y0} ${pts} ${X(data[data.length - 1].x)},${y0}` : '';

  // Nhãn giá trị: tại các điểm đặc biệt + cực trị
  const labels: { x: number; v: number }[] = [];
  const pushLabel = (x: number, v: number) => {
    if (Math.abs(v) < 1e-9 * Math.max(Math.abs(lo), Math.abs(hi), 1)) return;
    if (labels.some((l) => Math.abs(l.x - x) < L * 0.02 && Math.abs(l.v - v) <= 1e-6 * Math.max(1, Math.abs(v)))) return;
    labels.push({ x, v });
  };
  for (const k of p.keyPoints) for (const v of valueAt(data, k)) pushLabel(k, v);
  let iMax = -1, iMin = -1;
  data.forEach((d, i) => {
    if (iMax < 0 || d.y > data[iMax].y) iMax = i;
    if (iMin < 0 || d.y < data[iMin].y) iMin = i;
  });
  if (iMax >= 0) pushLabel(data[iMax].x, data[iMax].y);
  if (iMin >= 0) pushLabel(data[iMin].x, data[iMin].y);

  const hasData = hi !== 0 || lo !== 0;
  const cur = cursorX != null ? valueAt(data, cursorX) : [];

  const toX = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    return Math.min(L, Math.max(0, ((sx - PADX) / (W - 2 * PADX)) * L));
  };

  return (
    <figure className={`diagram tone-${p.tone ?? 'a'}`}>
      <figcaption>
        <span className="d-title">{p.title}</span>
        <span className="d-unit">({p.unit})</span>
        {cursorX != null && cur.length > 0 && (
          <span className="d-cursor">
            x = {fmt(cursorX, 3)} m: {cur.map((v) => fmt(v, 3)).join(' | ')}
          </span>
        )}
        {!hasData && <span className="muted"> — bằng 0 trên toàn thanh</span>}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={(e) => p.onHover?.(toX(e))}
        onMouseLeave={() => p.onHover?.(null)}
        onClick={(e) => p.onPick?.(toX(e))}
      >
        <polygon points={poly} className="d-fill" />
        <polyline points={pts} className="d-line" />
        <line x1={X(0)} y1={y0} x2={X(L)} y2={y0} className="d-base" />
        {p.keyPoints.map((k) => (
          <line key={k} x1={X(k)} y1={padY - 10} x2={X(k)} y2={H - padY + 10} className="d-grid" />
        ))}
        {hasData && hi > 0 && <text x={16} y={Y(hi / 2) + 5} className="d-sign">+</text>}
        {hasData && lo < 0 && <text x={16} y={Y(lo / 2) + 5} className="d-sign">−</text>}
        {labels.map((l, i) => {
          const above = invert ? l.v < 0 : l.v > 0;
          return (
            <text key={i} x={X(l.x)} y={Y(l.v) + (above ? -6 : 15)} className="d-val" textAnchor={l.x <= L * 0.02 ? 'start' : l.x >= L * 0.98 ? 'end' : 'middle'}>
              {fmt(l.v, digits)}
            </text>
          );
        })}
        {cursorX != null && <line x1={X(cursorX)} y1={6} x2={X(cursorX)} y2={H - 6} className="cursor" />}
      </svg>
    </figure>
  );
}
