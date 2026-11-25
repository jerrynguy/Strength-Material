import type { LiftModel, LiftResult } from '../../core/lifting';

/** Hình chiếu đứng sơ đồ nâng: cẩu, cần, móc, thanh gánh, hàng và bán kính làm việc (vị trí có UC lớn nhất) */
export function LiftView({ model, r, compact }: { model: LiftModel; r: LiftResult; compact?: boolean }) {
  const rows = r.crane.rows;
  const gi = rows.reduce((b, x, i) => (Number.isFinite(x.uc) && (b < 0 || x.uc > rows[b].uc) ? i : b), -1);
  const pos = gi >= 0 ? rows[gi] : rows[0];
  const R = Math.max(1, pos?.radius ?? 10);
  const Lb = Math.max(model.crane.boom, R + 2);
  const crawler = model.crane.kind === 'crawler';
  const pivot = { x: -1, y: crawler ? 2.2 : 2.8 };
  const cos = Math.min(0.999, (R - pivot.x) / Lb);
  const tip = { x: R, y: pivot.y + Lb * Math.sqrt(1 - cos * cos) };
  const ang = (Math.acos(cos) * 180) / Math.PI;
  const loadY = 1.2;
  const spreaderY = loadY + Math.min(4.5, Math.max(2.5, (tip.y - loadY) * 0.3));
  const hookY = spreaderY + Math.min(4, Math.max(1.5, (tip.y - spreaderY) * 0.25));
  const x0 = -8, x1 = R + 5;
  const y1 = tip.y + 1.5;
  const W = 760, H = compact ? 300 : 340, pad = 22;
  const s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad) / y1);
  const X = (x: number) => pad + (x - x0) * s;
  const Y = (y: number) => H - pad - y * s;
  const lr = 0.6;
  const k = s;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="beam-svg tv" role="img" aria-label="Sơ đồ nâng">
      <line x1={6} x2={W - 6} y1={Y(0)} y2={Y(0)} className="dim" />
      {crawler ? (
        <>
          <rect x={X(-4)} y={Y(1.1)} width={7 * k} height={1.1 * k} rx={0.55 * k} className="support-fill" />
          <rect x={X(-4.5)} y={Y(pivot.y + 1.2)} width={6 * k} height={(pivot.y + 0.1 - 1.1) * k + 1.2 * k} className="beam" />
          <rect x={X(-6)} y={Y(pivot.y + 1)} width={1.6 * k} height={1.8 * k} className="tv-block" />
        </>
      ) : (
        <>
          <rect x={X(-5.5)} y={Y(2)} width={10 * k} height={1.1 * k} className="beam" />
          {[-4.5, -3.1, 1.2, 2.6].map((x) => <circle key={x} cx={X(x)} cy={Y(0.55)} r={0.55 * k} className="support-fill" />)}
          <line x1={X(-5.2)} x2={X(-6.6)} y1={Y(1.2)} y2={Y(0.25)} className="dim" />
          <line x1={X(4.2)} x2={X(5.6)} y1={Y(1.2)} y2={Y(0.25)} className="dim" />
          <rect x={X(-7.2)} y={Y(0.25)} width={1.2 * k} height={0.25 * k} className="tv-block" />
          <rect x={X(5)} y={Y(0.25)} width={1.2 * k} height={0.25 * k} className="tv-block" />
          <rect x={X(-3.2)} y={Y(pivot.y + 0.8)} width={4.2 * k} height={(pivot.y + 0.8 - 2) * k} className="beam" />
          <rect x={X(-5)} y={Y(pivot.y + 0.6)} width={1.6 * k} height={1.2 * k} className="tv-block" />
        </>
      )}
      {/* cần */}
      <line x1={X(pivot.x)} y1={Y(pivot.y)} x2={X(tip.x)} y2={Y(tip.y)} className="lift-boom" />
      <circle cx={X(pivot.x)} cy={Y(pivot.y)} r={4} className="hinge" />
      {/* cáp móc, thanh gánh, sling */}
      <line x1={X(tip.x)} y1={Y(tip.y)} x2={X(R)} y2={Y(hookY)} className="lift-rope" />
      <rect x={X(R) - 5} y={Y(hookY)} width={10} height={12} className="hinge" />
      <line x1={X(R)} y1={Y(hookY) + 12} x2={X(R)} y2={Y(spreaderY)} className="lift-rope" />
      <rect x={X(R) - 0.35 * k} y={Y(spreaderY)} width={0.7 * k} height={Math.max(6, 0.3 * k)} className="tv-cargo" />
      <line x1={X(R)} y1={Y(spreaderY) + Math.max(6, 0.3 * k)} x2={X(R)} y2={Y(loadY + lr)} className="tv-lash" />
      <circle cx={X(R)} cy={Y(loadY)} r={lr * k} className="tv-cargo" />
      <circle cx={X(R)} cy={Y(loadY)} r={4} className="tv-cg" />
      {/* bán kính */}
      <line x1={X(0)} x2={X(0)} y1={Y(0) + 4} y2={Y(pivot.y + 1.5)} className="cursor" />
      <line x1={X(0)} x2={X(R)} y1={Y(0) + 12} y2={Y(0) + 12} className="dim" />
      <line x1={X(R)} x2={X(R)} y1={Y(0) + 6} y2={Y(0) + 16} className="dim" />
      <text x={X(R / 2)} y={Y(0) + 10} textAnchor="middle" className="lbl tiny">R = {R} m</text>
      <text x={X((pivot.x + tip.x) / 2) - 8} y={Y((pivot.y + tip.y) / 2) - 6} textAnchor="end" className="lbl tiny">cần {model.crane.boom} m · {ang.toFixed(1)}°</text>
      <text x={X(R) + lr * k + 6} y={Y(loadY) + 4} className="lbl tiny">{model.loadName} · {model.net} t</text>
      <text x={X(R) + 10} y={Y(spreaderY) + 4} className="lbl tiny">thanh gánh / cáp</text>
      <text x={X(tip.x) + 8} y={Y(tip.y) + 4} className="lbl tiny">đầu cần ≈ {tip.y.toFixed(1)} m</text>
      <text x={W - pad} y={16} textAnchor="end" className="lbl tiny">
        {model.crane.name} · {pos?.label ?? ''}{pos?.cap ? ` · sức nâng ${pos.cap} t · UC ${(pos.uc * 100).toFixed(1)}%` : ''}
      </text>
      {!compact && <text x={X(0) + 4} y={Y(pivot.y + 1.5)} className="lbl tiny">tâm quay</text>}
    </svg>
  );
}
