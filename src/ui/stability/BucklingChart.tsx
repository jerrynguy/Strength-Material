import { useState, type MouseEvent } from 'react';
import { fmt } from '../../core/stress';

/** Biểu đồ một chuỗi theo λ, có đánh dấu điểm đang xét, vạch λ₁/λ₀ và tooltip khi rê chuột. */
export function BucklingChart(props: {
  title: string;
  unit: string;
  curve: [number, number][];
  point?: { x: number; y: number } | null;
  marks?: { x: number; label: string }[];
  digits?: number;
  tone?: 'a' | 'b';
}) {
  const { curve, point, digits = 2 } = props;
  const [hover, setHover] = useState<number | null>(null);
  const W = 420, H = 230, L = 46, R = 14, T = 14, B = 30;
  const xMax = curve[curve.length - 1][0];
  let yMax = 0;
  for (const [, y] of curve) yMax = Math.max(yMax, y);
  yMax = niceCeil(yMax);
  const X = (x: number) => L + (x / xMax) * (W - L - R);
  const Y = (y: number) => H - B - (Math.min(y, yMax) / yMax) * (H - T - B);
  const path = curve.map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('');
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * yMax);
  const xTicks = Array.from({ length: Math.floor(xMax / 50) + 1 }, (_, i) => i * 50);
  const valAt = (x: number) => {
    for (let i = 0; i + 1 < curve.length; i++) {
      const [x0, y0] = curve[i], [x1, y1] = curve[i + 1];
      if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
    }
    return null;
  };
  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const x = ((sx - L) / (W - L - R)) * xMax;
    setHover(x >= 0 && x <= xMax ? x : null);
  };
  const hv = hover !== null ? valAt(hover) : null;
  return (
    <figure className={`bchart tone-${props.tone ?? 'a'}`}>
      <figcaption>
        <b>{props.title}</b> <span className="muted">({props.unit})</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} className="bc-grid" />
            <text x={L - 6} y={Y(t) + 4} className="bc-tick" textAnchor="end">{fmt(t, 2)}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={X(t)} y={H - B + 16} className="bc-tick" textAnchor="middle">{t}</text>
        ))}
        <text x={W - R} y={H - 4} className="bc-tick" textAnchor="end">λ</text>
        <line x1={L} x2={W - R} y1={Y(0)} y2={Y(0)} className="bc-axis" />
        {props.marks?.map((m) => (
          <g key={m.label}>
            <line x1={X(m.x)} x2={X(m.x)} y1={T} y2={H - B} className="bc-mark" />
            <text x={X(m.x) + 4} y={T + 10} className="bc-tick">{m.label}</text>
          </g>
        ))}
        <path d={path} className="bc-line" />
        {point && point.x <= xMax && (
          <g>
            <circle cx={X(point.x)} cy={Y(point.y)} r={5} className="bc-point" />
            <text x={X(point.x) + (point.x > xMax * 0.7 ? -8 : 8)} y={Y(point.y) - 8} className="bc-label"
              textAnchor={point.x > xMax * 0.7 ? 'end' : 'start'}>
              λ = {fmt(point.x, 1)} → {fmt(point.y, digits)}
            </text>
          </g>
        )}
        {hover !== null && hv !== null && (
          <g>
            <line x1={X(hover)} x2={X(hover)} y1={T} y2={H - B} className="cursor" />
            <circle cx={X(hover)} cy={Y(hv)} r={4} className="bc-hover" />
            <rect x={Math.min(X(hover) + 6, W - 116)} y={T} width={108} height={22} rx={4} className="bc-tip" />
            <text x={Math.min(X(hover) + 12, W - 110)} y={T + 15} className="bc-tick">λ {fmt(hover, 0)}: {fmt(hv, digits)}</text>
          </g>
        )}
      </svg>
    </figure>
  );
}

function niceCeil(v: number): number {
  if (!(v > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}
