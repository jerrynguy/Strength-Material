import { fmt } from '../../core/stress';
import { DIR_LABEL, analyzeTransport, type TransportModel } from '../../core/transport';
import { conclusionItems } from '../transport/TransportApp';
import { TransportView } from '../transport/TransportView';
import { RConclusion, RFig, RKV, RSection, RSteps, RSub, RTable, Verdict, type ReportParts } from './primitives';

export function TransportReport({ model, parts }: { model: TransportModel; parts: ReportParts }) {
  const r = analyzeTransport(model);
  const c = model.cargo, k = model.coef, v = model.vehicle;
  let n = 0;
  const N = () => String(++n);
  const ok = (b: boolean) => <Verdict ok={b}>{b ? 'ĐẠT' : 'KHÔNG ĐẠT'}</Verdict>;
  return (
    <>
      <RSection n={N()} title="Kết luận chung">
        <RConclusion items={conclusionItems(r)} />
        {r.warnings.length > 0 && <RSteps lines={r.warnings} />}
      </RSection>
      {parts.inputs && (
        <RSection n={N()} title="Dữ liệu đầu vào">
          <RKV rows={[
            ['Hàng', `${c.name}: m = ${fmt(c.mass, 3)} t; bao ${fmt(c.length, 3)} × ${fmt(c.width, 3)} × ${fmt(c.height, 3)} m (dài × rộng × cao)`],
            ['Chân đế, trọng tâm', `chân đế ${fmt(c.footL, 3)} × ${fmt(c.footW, 3)} m; trọng tâm cao d = ${fmt(c.cgH, 3)} m trên sàn, cách mép trước sàn ${fmt(c.cgX, 3)} m`],
            ['Ma sát', `μ = ${model.mu}; f_μ = ${k.fmu}`],
            ['Hệ số gia tốc (EN 12195-1, đường bộ)', `c_x = ${k.cxF} (tiến), ${k.cxR} (lùi); c_y = ${k.cy} (trượt), ${k.cyTip} (lật); c_z = ${k.cz}; f_s = ${k.fsFwd} (tiến), ${k.fsRear} (lùi), ${k.fsTrans} (ngang)`],
            ['Chằng vắt qua nóc', model.topOver.n > 0 ? `${model.topOver.n} dây; α = ${model.topOver.alpha}°; STF = ${model.topOver.stf} daN; LC = ${model.topOver.lc} daN` : 'không dùng'],
            ['Chằng trực tiếp', model.direct.lc > 0 && (model.direct.nLong > 0 || model.direct.nTrans > 0) ? `LC = ${model.direct.lc} daN/nhánh; α = ${model.direct.alpha}°, β = ${model.direct.beta}°; nhánh làm việc: ${model.direct.nLong} (dọc), ${model.direct.nTrans} (ngang)` : 'không dùng'],
            ['Chặn', `BC = ${model.blocking.fwd} kN (trước), ${model.blocking.rear} kN (sau), ${model.blocking.side} kN (bên)`],
            ['Xe', `sàn dài ${v.deckL} m, cao ${v.deckH} m, rộng ${v.width} m; chốt kéo x = ${v.kingpinX} m; trục SMRM x = ${v.axles.map((a) => a.x).join('; ')} m; ${v.tareMode === 'total' ? `tự trọng tổ hợp ${v.tareTotal} t, phân bổ ${v.tareShare?.front} / ${v.tareShare?.tractorRear} / ${v.tareShare?.trailer} % (trục trước / cụm sau đầu kéo / cụm SMRM)` : `tự trọng SMRM ${v.trailerTare} t tại x = ${v.trailerCgX} m`}`],
            ...((model.others ?? []).length ? [['Tải khác trên xe', (model.others ?? []).map((o) => `${o.name}: ${fmt(o.mass, 3)} t tại x = ${fmt(o.x, 3)} m`).join('; ')] as [string, string]] : []),
            ['Đầu kéo', `${v.tareMode === 'total' ? '' : `không tải: trục trước ${v.tractorFront} t, cụm sau ${v.tractorRear} t; `}${v.tractorRearAxles} trục sau; WB = ${v.wheelbase} m; mâm kéo trước tâm cụm sau e = ${v.fifthWheelOffset} m`],
            ['Giới hạn', `trục trước ${model.limits.frontAxle} t; cụm sau đầu kéo ${model.limits.tractorGroup} t; cụm SMRM ${model.limits.trailerGroup} t; tổng ${model.limits.gross} t; cao ${model.limits.height} m; rộng ${model.limits.width} m`],
          ]} />
        </RSection>
      )}
      {parts.diagrams && (
        <RSection n={N()} title="Sơ đồ xếp hàng">
          <RFig caption="Hình chiếu dọc xe và hình chiếu từ phía sau (G: trọng tâm hàng)"><TransportView model={model} compact /></RFig>
        </RSection>
      )}
      <RSection n={N()} title="Kiểm tra chống trượt (EN 12195-1)">
        <RTable head={['Phương', 'c', 'c·m·g (kN)', 'Ma sát (kN)', 'Vắt nóc (kN)', 'Trực tiếp (kN)', 'Chặn (kN)', 'UC', 'Kết luận']}
          rows={r.slide.map((s) => [DIR_LABEL[s.dir], s.c, fmt(s.demand, 2), fmt(s.friction, 2), fmt(s.topOver, 2), fmt(s.direct, 2), fmt(s.block, 2), fmt(s.uc, 3), ok(s.ok)])}
          note="UC = lực quán tính / tổng khả năng giữ. Có chằng trực tiếp thì ma sát dùng μ·f_μ cho mọi thành phần (thiên về an toàn); chỉ chặn hoặc vắt nóc thì dùng μ." />
        {parts.steps && r.slide.map((s) => <RSub key={s.dir} title={`Trượt – ${DIR_LABEL[s.dir].toLowerCase()}`}><RSteps lines={s.steps} /></RSub>)}
      </RSection>
      <RSection n={N()} title="Kiểm tra chống lật (EN 12195-1)">
        <RTable head={['Phương', 'c', 'b (m)', 'd (m)', 'M lật (kN·m)', 'M chống (kN·m)', 'Kết luận']}
          rows={r.tip.map((x) => [DIR_LABEL[x.dir], x.c, fmt(x.b, 3), fmt(x.d, 3), fmt(x.mOver, 2), fmt(x.mStab + x.mLash, 2), ok(x.ok)])} />
        {parts.steps && r.tip.map((x) => <RSub key={x.dir} title={`Lật – ${DIR_LABEL[x.dir].toLowerCase()}`}><RSteps lines={x.steps} /></RSub>)}
      </RSection>
      <RSection n={N()} title="Tải trọng trục và kích thước bao">
        <RTable head={['Hạng mục', 'Giá trị', 'Giới hạn', 'Kết luận']}
          rows={[
            ['Tải chốt kéo', `${fmt(r.axle.kingpin, 3)} t`, '—', '—'],
            ...r.axle.checks.map((a) => [a.label, `${fmt(a.value, 3)} t`, a.limit > 0 ? `${a.limit} t` : '—', ok(a.ok)]),
            ...r.dim.checks.map((a) => [a.label, `${fmt(a.value, 3)} m`, a.limit > 0 ? `${a.limit} m` : '—', ok(a.ok)]),
          ]} />
        {parts.steps && <RSteps lines={r.axle.steps} />}
      </RSection>
      <RSection n={N()} title="Áp lực xuống nền">
        <RTable head={['Vị trí', 'Tải (t)', 'Số trục', 'Vệt 1 cụm bánh (m)', 'A (m²)', 'p (t/m²)', 'p (kPa)', 'Kết luận']}
          rows={[r.ground.whole, ...r.ground.groups].map((x) => [x.label, fmt(x.load, 3), `${x.axles} × 2 bên`, `${fmt(x.L, 3)} × ${fmt(x.B, 3)}`, fmt(x.area, 3), fmt(x.p, 3), fmt(x.p * 9.81, 1), ok(x.ok)])}
          note={`Mỗi trục 2 vệt chịu tải (2 bên xe); A = số trục × 2 × dọc × ngang. Áp lực cho phép [p] = ${model.ground.allow} t/m².${r.ground.overlap ? ' Vệt các trục kề nhau chồng lên nhau: áp lực thực tế lớn hơn.' : ''}`} />
        {parts.steps && <RSteps lines={r.ground.steps} />}
      </RSection>
      {r.barges.length > 0 && (
        <RSection n={N()} title="Tỉ lệ tải sà lan">
          <RTable head={['Sà lan', 'Hạng mục', 'Tổng tải (t)', 'DWT (t)', 'UC', 'Cho phép', 'Kết luận']}
            rows={r.barges.map((b, i) => [b.name, model.barges[i].items.map((it) => `${it.name}: ${fmt(it.mass, 3)} t`).join('; '), fmt(b.total, 3), fmt(b.dwt, 3), `${fmt(b.uc * 100, 2)}%`, `${fmt(b.limit * 100, 1)}%`, ok(b.ok)])}
            note="UC = tổng khối lượng / trọng tải. Chưa kiểm tra ổn định nổi, mớn nước, sức bền boong." />
        </RSection>
      )}
      <RSection n={N()} title="Kiểm tra theo hồ sơ (lực tác dụng lên hàng)">
        <RKV rows={[
          ['Điều kiện đường', `dốc dọc θ = ${model.road.slope}°; dốc ngang β = ${model.road.crossSlope}°; vào cua v = ${model.road.vCurve} m/s, R = ${model.road.radius} m; chạy thẳng v = ${model.road.vStraight} m/s`],
          ['Gia tốc phanh', `a = ${fmt(r.road.accel, 3)} m/s²`],
          ['Ma sát', model.road.frictionCos ? 'f·Q·cosθ (dọc), f·Q·cosβ (ngang)' : 'f·Q (không nhân cos góc dốc, như hồ sơ)'],
        ]} />
        <RTable head={['Trường hợp', 'Công thức', 'Lực gây trượt', 'Ma sát F_ms', 'Kết luận']}
          rows={r.road.checks.map((c) => [c.label, c.formula, `${fmt(c.force, 2)} kN (${fmt(c.force / 9.81, 2)} t)`, `${fmt(c.friction, 2)} kN (${fmt(c.friction / 9.81, 2)} t)`, ok(c.ok)])}
          note="Chỉ dùng ma sát, chưa kể dây chằng." />
        <RSteps lines={r.road.steps} />
      </RSection>
    </>
  );
}
