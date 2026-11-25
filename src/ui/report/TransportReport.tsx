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
            ['Hệ số gia tốc (EN 12195-1, đường bộ)', `c_x = ${k.cxF} (tiến), ${k.cxR} (lùi); c_y = ${k.cy} (trượt), ${k.cyTip} (lật); c_z = ${k.cz}; f_s = ${k.fsLong} (dọc), ${k.fsTrans} (ngang)`],
            ['Chằng vắt qua nóc', model.topOver.n > 0 ? `${model.topOver.n} dây; α = ${model.topOver.alpha}°; STF = ${model.topOver.stf} daN; LC = ${model.topOver.lc} daN` : 'không dùng'],
            ['Chằng trực tiếp', model.direct.lc > 0 && (model.direct.nLong > 0 || model.direct.nTrans > 0) ? `LC = ${model.direct.lc} daN/nhánh; α = ${model.direct.alpha}°, β = ${model.direct.beta}°; nhánh làm việc: ${model.direct.nLong} (dọc), ${model.direct.nTrans} (ngang)` : 'không dùng'],
            ['Chặn', `BC = ${model.blocking.fwd} kN (trước), ${model.blocking.rear} kN (sau), ${model.blocking.side} kN (bên)`],
            ['Xe', `sàn dài ${v.deckL} m, cao ${v.deckH} m, rộng ${v.width} m; chốt kéo x = ${v.kingpinX} m; trục SMRM x = ${v.axles.map((a) => a.x).join('; ')} m; tự trọng SMRM ${v.trailerTare} t tại x = ${v.trailerCgX} m`],
            ['Đầu kéo', `không tải: trục trước ${v.tractorFront} t, cụm sau ${v.tractorRear} t (${v.tractorRearAxles} trục); WB = ${v.wheelbase} m; mâm kéo trước tâm cụm sau e = ${v.fifthWheelOffset} m`],
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
          note="UC = lực quán tính / tổng khả năng giữ. Khi có chằng trực tiếp hoặc chặn, ma sát dùng μ·f_μ cho mọi thành phần." />
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
      <RSection n={N()} title="Đối chiếu điều kiện đường">
        <RSteps lines={r.road.steps} />
      </RSection>
    </>
  );
}
