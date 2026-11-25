import { fmt } from '../../core/stress';
import { GEAR_LABEL, LOAD_CHARTS, analyzeLift, type LiftModel } from '../../core/lifting';
import { liftConclusion } from '../lifting/LiftApp';
import { LiftView } from '../lifting/LiftView';
import { RConclusion, RFig, RKV, RSection, RSteps, RSub, RTable, Verdict, type ReportParts } from './primitives';

export function LiftReport({ model, parts }: { model: LiftModel; parts: ReportParts }) {
  const r = analyzeLift(model);
  const f = model.factors, c = model.crane, o = model.outrigger, cw = model.crawler, st = model.stack;
  const chart = LOAD_CHARTS.find((x) => x.key === c.chart);
  let n = 0;
  const N = () => String(++n);
  const ok = (b: boolean | null) => (b === null ? '—' : <Verdict ok={b}>{b ? 'ĐẠT' : 'KHÔNG ĐẠT'}</Verdict>);
  const pct = (x: number) => (Number.isFinite(x) ? `${fmt(x * 100, 2)}%` : '—');
  return (
    <>
      <RSection n={N()} title="Kết luận chung">
        <RConclusion items={liftConclusion(r, model)} />
        {r.warnings.length > 0 && <RSteps lines={r.warnings} />}
      </RSection>
      {parts.inputs && (
        <RSection n={N()} title="Dữ liệu đầu vào">
          <RKV rows={[
            ['Hàng nâng', `${model.loadName}: ${fmt(model.net, 3)} t`],
            ['Hệ số', `CF = ${f.cf}; COG = ${f.cog}; TF = ${f.tf}; YF = ${f.yf}; SKL = ${f.skl}; DAF = ${f.daf}`],
            ['Cẩu', `${c.name} (${c.kind === 'crawler' ? 'bánh xích' : 'bánh lốp'}); cần ${c.boom} m; đối trọng ${c.counterweight} t; ${chart ? `bảng tải ${chart.name}, ${c.chartMode === 'step' ? 'lấy dòng bán kính lớn hơn kề' : 'nội suy tuyến tính'}` : 'sức nâng nhập tay'}; UC cho phép ${c.ucLimit}%`],
            ['Vị trí làm việc', model.positions.map((p) => `${p.label}: R = ${p.radius} m${p.capManual > 0 ? ` (sức nâng ${p.capManual} t)` : ''}`).join('; ')],
            ['Phụ kiện treo', model.rigging.map((it) => `${it.name}: ${it.qty > 1 ? `${it.qty} × ` : ''}${fmt(it.mass, 3)} t`).join('; ') || '—'],
            ...(o.enabled ? [['Chân chống', `phản lực lớn nhất ${o.force} t; tấm kê ${o.matL} × ${o.matB} × ${o.matT} m${o.matDensity > 0 ? `, ${o.matDensity} t/m³` : ''}${o.spread > 0 ? `; lan truyền ${o.spread}°` : ''}; [p] = ${o.allow || '—'} t/m²`] as [string, string]] : []),
            ...(cw.enabled ? [['Bánh xích', cw.mode === 'manual' ? `áp lực theo nhà sản xuất ${cw.pManual} t/m²; [p] = ${cw.allow || '—'} t/m²` : `KL cẩu ${cw.craneMass} t; xích ${cw.trackL} × ${cw.shoeB} m (2 bên); e = ${cw.ecc} m; lớp kê ${cw.matT} m; [p] = ${cw.allow || '—'} t/m²`] as [string, string]] : []),
            ...(st.enabled ? [['Bãi xếp ống', `${st.name}: ${st.unit} t/ống, OD ${st.od} m; ${st.nBottom} ống tầng dưới, ${st.tiers} tầng; diện tích ${st.areaL} × ${st.areaB} m; [p] = ${st.allow || '—'} t/m²`] as [string, string]] : []),
          ]} />
        </RSection>
      )}
      {parts.diagrams && (
        <RSection n={N()} title="Sơ đồ nâng">
          <RFig caption="Hình chiếu đứng tại vị trí có UC lớn nhất (minh hoạ, không theo tỉ lệ cẩu thực)"><LiftView model={model} r={r} compact /></RFig>
        </RSection>
      )}
      <RSection n={N()} title="Kiểm tra cẩu">
        <RTable head={['Vị trí', 'R (m)', 'Sức nâng (t)', 'Tải tính toán (t)', 'UC', 'Kết luận']}
          rows={r.crane.rows.map((x) => [x.label, x.radius, x.cap != null ? fmt(x.cap, 3) : '—', fmt(r.crane.factored, 3), pct(x.uc), ok(x.ok)])}
          note="Tải tính toán = (tải trên móc·CF·COG·TF·YF·SKL + phụ kiện)·DAF." />
        {parts.steps && <RSteps lines={r.crane.steps} />}
      </RSection>
      {r.gear.length > 0 && (
        <RSection n={N()} title="Kiểm tra cáp, dây vải, ma ní">
          <RTable head={['Hạng mục', 'Loại', 'T 1 nhánh (t)', 'Tải lớn nhất (t)', 'SWL (t)', 'Hệ số giảm', 'Hệ số an toàn', 'Kết luận']}
            rows={r.gear.map((g) => [g.gear.name, GEAR_LABEL[g.gear.type], fmt(g.tension, 3), fmt(g.max, 3), g.gear.swl, g.gear.reduce, fmt(g.sf, 3), ok(g.ok)])}
            note="Tải lớn nhất = T·CF·COG·TF·YF·SKL + phụ kiện·DAF; hệ số an toàn = SWL·hệ số giảm / tải lớn nhất ≥ 1." />
          {parts.steps && r.gear.map((g, i) => <RSub key={i} title={g.gear.name}><RSteps lines={g.steps} /></RSub>)}
        </RSection>
      )}
      {(o.enabled || cw.enabled) && (
        <RSection n={N()} title="Áp lực nền dưới cẩu">
          <RTable head={['Vị trí', 'p (t/m²)', 'p (kPa)', '[p] (t/m²)', 'Kết luận']}
            rows={[
              ...(o.enabled ? [['Chân chống', fmt(r.outrigger.p, 3), fmt(r.outrigger.p * 9.81, 1), o.allow || '—', ok(r.outrigger.ok)]] : []),
              ...(cw.enabled ? [['Bánh xích', fmt(r.crawler.p, 3), fmt(r.crawler.p * 9.81, 1), cw.allow || '—', ok(r.crawler.ok)]] : []),
            ]} />
          {parts.steps && o.enabled && <RSub title="Chân chống"><RSteps lines={r.outrigger.steps} /></RSub>}
          {parts.steps && cw.enabled && <RSub title="Bánh xích"><RSteps lines={r.crawler.steps} /></RSub>}
        </RSection>
      )}
      {st.enabled && (
        <RSection n={N()} title="Áp lực nền bãi xếp ống">
          <RTable head={['Số tầng', 'Số ống', 'Tổng KL (t)', 'p (t/m²)', 'p (kPa)', 'Kết luận']}
            rows={r.stack.rows.map((x) => [x.tiers, x.count, fmt(x.weight, 3), fmt(x.p, 3), fmt(x.p * 9.81, 1), ok(x.ok)])}
            note={`Diện tích chịu tải ${st.areaL} × ${st.areaB} = ${fmt(r.stack.area, 2)} m²; p = tổng khối lượng / diện tích.`} />
          {parts.steps && <RSteps lines={r.stack.steps} />}
        </RSection>
      )}
    </>
  );
}
