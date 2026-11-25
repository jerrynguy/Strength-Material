import type { TransportModel } from '../../core/transport';

/** Hình chiếu đứng (dọc xe) và hình chiếu cạnh (nhìn từ phía sau) của tổ hợp xe – hàng */
export function TransportView({ model, compact }: { model: TransportModel; compact?: boolean }) {
  const v = model.vehicle, c = model.cargo;
  const rearX = v.kingpinX + v.fifthWheelOffset; // tâm cụm sau đầu kéo
  const frontX = rearX - v.wheelbase;
  const x0 = Math.min(frontX - 1.2, 0), x1 = Math.max(v.deckL, c.cgX + c.length / 2) + 0.5;
  const topH = v.deckH + c.height;
  const W = 760, H = 250, pad = 24;
  const s = Math.min((W - 2 * pad) / (x1 - x0), (H - 2 * pad - 14) / Math.max(topH + 0.3, 1));
  const X = (x: number) => pad + (x - x0) * s;
  const Y = (y: number) => H - pad - y * s;
  const wr = 0.5; // bán kính bánh xe (m)
  const nr = Math.max(1, Math.round(v.tractorRearAxles));
  const tractorRear = Array.from({ length: nr }, (_, i) => rearX + (i - (nr - 1) / 2) * 1.3);
  const cabTop = Math.max(2.9, v.deckH + 1.4);
  const cx1 = c.cgX - c.length / 2, cx2 = c.cgX + c.length / 2;
  const dTop = v.deckH + c.height * 0.85;
  const lashL = model.direct.nLong > 0 && model.direct.lc > 0;
  const runX = (c.height * 0.85) / Math.tan((Math.max(5, model.direct.alpha) * Math.PI) / 180);
  // hình chiếu cạnh
  const RW = 260, RH = 250, rs = Math.min((RW - 40) / Math.max(v.width, c.width, 0.1), (RH - 50) / Math.max(topH + 0.2, 1));
  const RX = (z: number) => RW / 2 + z * rs;
  const RY = (y: number) => RH - 24 - y * rs;
  const nTop = Math.min(model.topOver.n, 1);
  const anchor = v.width / 2;
  return (
    <div className="tv-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="beam-svg tv" role="img" aria-label="Hình chiếu dọc xe">
        <line x1={pad / 2} x2={W - pad / 2} y1={Y(0)} y2={Y(0)} className="dim" />
        {/* đầu kéo */}
        <path d={`M${X(frontX - 0.9)},${Y(1.0)} L${X(frontX - 0.9)},${Y(cabTop)} L${X(frontX + 1.4)},${Y(cabTop)} L${X(frontX + 1.4)},${Y(1.0)} Z`} className="beam" />
        <rect x={X(frontX - 0.9)} y={Y(1.0)} width={(rearX + 1 - frontX + 0.9) * s} height={0.35 * s} className="beam" />
        {/* sàn sơ mi rơ moóc */}
        <rect x={X(0)} y={Y(v.deckH)} width={v.deckL * s} height={Math.max(0.25, v.deckH - 1.05) * s} className="beam" />
        <circle cx={X(v.kingpinX)} cy={Y(v.deckH - Math.max(0.25, v.deckH - 1.05))} r={4} className="hinge" />
        {/* hàng */}
        <rect x={X(cx1)} y={Y(topH)} width={c.length * s} height={c.height * s} className="tv-cargo" />
        <text x={X(c.cgX)} y={Y(topH) - 4} textAnchor="middle" className="lbl tiny">{c.name} · {c.mass} t</text>
        <circle cx={X(c.cgX)} cy={Y(v.deckH + c.cgH)} r={5} className="tv-cg" />
        <line x1={X(c.cgX)} x2={X(c.cgX)} y1={Y(v.deckH + c.cgH)} y2={Y(v.deckH)} className="cursor" />
        {lashL && (
          <>
            <line x1={X(cx1)} y1={Y(dTop)} x2={X(cx1 - runX)} y2={Y(v.deckH)} className="tv-lash" />
            <line x1={X(cx2)} y1={Y(dTop)} x2={X(cx2 + runX)} y2={Y(v.deckH)} className="tv-lash" />
          </>
        )}
        {model.blocking.fwd > 0 && <rect x={X(cx1) - 6} y={Y(v.deckH + Math.min(0.5, c.height))} width={6} height={Math.min(0.5, c.height) * s} className="tv-block" />}
        {model.blocking.rear > 0 && <rect x={X(cx2)} y={Y(v.deckH + Math.min(0.5, c.height))} width={6} height={Math.min(0.5, c.height) * s} className="tv-block" />}
        {/* bánh xe */}
        {[frontX, ...tractorRear].map((x, i) => (
          <circle key={'t' + i} cx={X(x)} cy={Y(wr)} r={wr * s} className="support-fill" />
        ))}
        {v.axles.map((a, i) => <circle key={'a' + i} cx={X(a.x)} cy={Y(wr)} r={wr * s} className="support-fill" />)}
        {!compact && (
          <>
            <text x={X(0)} y={Y(v.deckH) - 4} className="lbl tiny">mép trước sàn (x = 0)</text>
            <text x={X(v.kingpinX) + 6} y={Y(v.deckH - 0.6)} className="lbl tiny">chốt kéo</text>
            <text x={X(c.cgX) + 8} y={Y(v.deckH + c.cgH) + 4} className="lbl tiny">G</text>
          </>
        )}
        <text x={W - pad} y={16} textAnchor="end" className="lbl tiny">↑ cao {(topH).toFixed(2)} m</text>
      </svg>
      <svg viewBox={`0 0 ${RW} ${RH}`} className="tv tv-rear" role="img" aria-label="Hình chiếu từ phía sau">
        <line x1={6} x2={RW - 6} y1={RY(0)} y2={RY(0)} className="dim" />
        <rect x={RX(-v.width / 2)} y={RY(v.deckH)} width={v.width * rs} height={Math.max(0.25, v.deckH - 1.05) * rs} className="beam" />
        <rect x={RX(-v.width / 2) + 4} y={RY(1.0)} width={0.5 * rs} height={1.0 * rs} className="support-fill" />
        <rect x={RX(v.width / 2) - 4 - 0.5 * rs} y={RY(1.0)} width={0.5 * rs} height={1.0 * rs} className="support-fill" />
        <rect x={RX(-c.width / 2)} y={RY(topH)} width={c.width * rs} height={c.height * rs} className="tv-cargo" />
        <line x1={RX(-c.footW / 2)} x2={RX(c.footW / 2)} y1={RY(v.deckH) - 2} y2={RY(v.deckH) - 2} className="tv-foot" />
        <circle cx={RX(0)} cy={RY(v.deckH + c.cgH)} r={5} className="tv-cg" />
        {nTop > 0 && (
          <path d={`M${RX(-anchor)},${RY(v.deckH)} L${RX(-c.width / 2)},${RY(topH)} L${RX(c.width / 2)},${RY(topH)} L${RX(anchor)},${RY(v.deckH)}`} className="tv-lash" fill="none" />
        )}
        <text x={RW / 2} y={14} textAnchor="middle" className="lbl tiny">nhìn từ sau · rộng {Math.max(v.width, c.width).toFixed(2)} m</text>
      </svg>
    </div>
  );
}
