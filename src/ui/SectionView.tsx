import type { SectionProps } from '../core/section';

/** Vẽ mặt cắt ngang, trục trung tâm, điểm khảo sát và trục trung hoà. */
export function SectionView(props: {
  sec: SectionProps;
  size?: number;
  point?: { y: number; z: number } | null;
  neutral?: [number, number, number] | null;
  onPick?: (y: number, z: number) => void;
}) {
  const { sec, size = 220, point, neutral, onPick } = props;
  const pad = 28;
  const w = sec.zMax - sec.zMin;
  const h = sec.yMax - sec.yMin;
  const k = (size - 2 * pad) / Math.max(w, h);
  const W = size;
  const H = size;
  // toạ độ so với trọng tâm → màn hình
  const cx = W / 2 - ((sec.zMax + sec.zMin) / 2) * k;
  const cy = H / 2 + ((sec.yMax + sec.yMin) / 2) * k;
  const X = (z: number) => cx + z * k;
  const Y = (y: number) => cy - y * k;
  const [zc, yc] = sec.centroid;
  const path = sec.rings
    .map((r) => 'M' + r.pts.map(([z, y]) => `${X(z - zc).toFixed(2)},${Y(y - yc).toFixed(2)}`).join('L') + 'Z')
    .join(' ');

  let na: [number, number, number, number] | null = null;
  if (neutral) {
    const [s0, a, b] = neutral;
    // s0 + a·y + b·z = 0
    const ext = Math.max(w, h);
    if (Math.abs(a) > 1e-15 || Math.abs(b) > 1e-15) {
      if (Math.abs(a) >= Math.abs(b)) {
        const yAt = (z: number) => -(s0 + b * z) / a;
        na = [X(-ext), Y(yAt(-ext)), X(ext), Y(yAt(ext))];
      } else {
        const zAt = (y: number) => -(s0 + a * y) / b;
        na = [X(zAt(-ext)), Y(-ext), X(zAt(ext)), Y(ext)];
      }
    }
  }

  return (
    <svg
      className="section-svg"
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      onClick={(e) => {
        if (!onPick) return;
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const sx = ((e.clientX - r.left) / r.width) * W;
        const sy = ((e.clientY - r.top) / r.height) * H;
        onPick(Math.round(((cy - sy) / k) * 10) / 10, Math.round(((sx - cx) / k) * 10) / 10);
      }}
      style={{ cursor: onPick ? 'crosshair' : undefined }}
    >
      <path d={path} fillRule="evenodd" className="sec-fill" />
      {sec.rings.filter((r) => r.ineffective).map((r, i) => (
        <path key={'ie' + i} d={'M' + r.pts.map(([z, y]) => `${X(z - zc).toFixed(2)},${Y(y - yc).toFixed(2)}`).join('L') + 'Z'} className="sec-ineff" />
      ))}
      <line x1={8} y1={cy} x2={W - 8} y2={cy} className="axis" />
      <line x1={cx} y1={8} x2={cx} y2={H - 8} className="axis" />
      <text x={W - 10} y={cy - 4} className="axis-label" textAnchor="end">z</text>
      <text x={cx + 4} y={14} className="axis-label">y</text>
      <circle cx={cx} cy={cy} r={3} className="centroid" />
      <text x={cx + 5} y={cy + 13} className="axis-label">C</text>
      {na && (
        <line x1={na[0]} y1={na[1]} x2={na[2]} y2={na[3]} className="neutral" />
      )}
      {point && (
        <g>
          <circle cx={X(point.z)} cy={Y(point.y)} r={5} className="probe" />
          <text x={X(point.z) + 8} y={Y(point.y) - 6} className="probe-label">K</text>
        </g>
      )}
    </svg>
  );
}
