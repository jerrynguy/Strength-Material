import { aeffIfClass4 } from '../../core/effective';
import { checkLocal, type LocalOptions } from '../../core/localBuckling';
import { computeSection, validateSection } from '../../core/section';
import { checkStability, criticalStress, lambda1, selfWeightColumn } from '../../core/stability';
import { densityOf } from '../../core/types';
import { fmt } from '../../core/stress';
import { SectionView } from '../SectionView';
import { BucklingChart } from '../stability/BucklingChart';
import type { StabModel } from '../stability/StabilityApp';
import { sectionRows } from './BeamReport';
import { StiffenerChecks, StiffenerInputs, TubeReport } from './StiffenerReport';
import { RConclusion, RFig, RKV, RSection, RSteps, RTable, Verdict, type ReportParts } from './primitives';

export function StabReport({ model, parts, local: lopt }: { model: StabModel; parts: ReportParts; local: LocalOptions }) {
  const err = validateSection(model.section);
  if (err) return <RSection n="1" title="Kết quả"><p className="r-bad">Tiết diện chưa hợp lệ: {err}</p></RSection>;
  const sec = computeSection(model.section);
  const sw = model.selfWeight ? selfWeightColumn(model.section, sec, model.material, { N: model.N, L: model.L, Ly: model.Ly, sameL: model.sameL, muZ: model.muZ, muY: model.muY }) : null;
  const r = checkStability(sec, {
    N: sw ? sw.Ntd : model.N, Lz: model.L, Ly: model.sameL ? model.L : model.Ly, muZ: model.muZ, muY: model.muY,
    E: model.material.E, allowable: model.material.allowable, params: model.params, nRequired: model.nReq,
    Aeff: aeffIfClass4(model.section, model.material, lopt.fy, lopt.stiffenerSpacing),
  });
  const local = checkLocal(model.section, model.material, [{ N: -(sw ? sw.Nbase : model.N), Qy: 0, Qz: 0, T: 0, Mz: 0, My: 0 }], { ...lopt, length: model.L * 1e3 });
  const E = model.material.E * 1e3;
  const xMax = Math.max(200, Math.ceil(r.lambdaMax / 50) * 50);
  const sig: [number, number][] = [];
  for (let l = 1; l <= xMax; l++) sig.push([l, criticalStress(model.params, E, l).sigma]);
  const l1 = lambda1(model.params);
  const marks = [{ x: model.params.lambda0, label: 'λ₀' }, ...(l1 ? [{ x: l1, label: 'λ₁' }] : [])];
  let n = 0;
  const N = () => String(++n);
  return (
    <>
      <RSection n={N()} title="Kết luận chung">
        <RConclusion items={[
          ...(sw ? [{ label: 'Bền tại chân cột (N + G)/A', ok: (sw.Nbase * 1e3) / sec.A <= model.material.allowable, detail: `σ = ${fmt((sw.Nbase * 1e3) / sec.A, 2)} MPa so với [σ] = ${model.material.allowable} MPa` }] : []),
          { label: 'Ổn định theo hệ số φ', ok: r.okPhi, detail: `σ = ${fmt(r.sigma, 2)} MPa so với φ[σ] = ${fmt(r.allowPhi, 2)} MPa` },
          { label: 'Ổn định theo hệ số an toàn', ok: r.okN, detail: `n_ôđ = ${fmt(r.nActual, 3)} so với [n_ôđ] = ${model.nReq}` },
          ...(local.applicable ? [{ label: 'Ổn định cục bộ', ok: local.ok, detail: `tiết diện loại ${local.sectionClass || '—'}${local.tube?.governs ? `; vỏ trụ ${fmt(local.tube.util * 100, 0)}%` : ''}` }] : []),
        ]} />
      </RSection>
      {parts.inputs && (
        <RSection n={N()} title="Dữ liệu đầu vào">
          <RKV rows={[
            ['Lực nén N (đỉnh cột)', `${fmt(model.N, 3)} kN`],
            ...(sw ? [['Trọng lượng bản thân', `q = ${fmt(sw.q, 4)} kN/m; G = ${fmt(sw.G, 3)} kN (ρ = ${fmt(densityOf(model.material), 0)} kg/m³); lực tương đương N_tđ = ${fmt(sw.Ntd, 3)} kN`] as [string, string]] : []),
            ['Chiều dài', model.sameL ? `L = ${fmt(model.L, 3)} m` : `L_z = ${fmt(model.L, 3)} m; L_y = ${fmt(model.Ly, 3)} m`],
            ['Hệ số chiều dài μ', `μ_z = ${model.muZ}; μ_y = ${model.muY}`],
            ['Vật liệu', `${model.material.name}: E = ${model.material.E} GPa, [σ] = ${model.material.allowable} MPa; ${model.params.label}`],
            ['Tham số', `λ₀ = ${model.params.lambda0}; a = ${model.params.a}, b = ${model.params.b}${model.params.c ? `, c = ${model.params.c}` : ''} MPa; σ_ch = ${model.params.sigmaY || '—'} MPa`],
            ['Mặt cắt', sec.label],
          ]} />
          <div className="r-row"><SectionView sec={sec} size={170} /><RKV rows={sectionRows(sec)} /></div>
          <StiffenerInputs spec={model.section} />
        </RSection>
      )}
      <RSection n={N()} title="Kiểm tra ổn định">
        <RTable head={['Phương', 'μ', 'L (m)', 'I (mm⁴)', 'i (mm)', 'λ']}
          rows={r.planes.map((p) => [p.plane, p.mu, fmt(p.L, 3), fmt(p.I, 0), fmt(p.i, 2), fmt(p.lambda, 2)])} />
        <RKV rows={[
          ['λ_max', fmt(r.lambdaMax, 2)],
          ['σ_th · P_th', `${fmt(r.sigmaCr, 2)} MPa · ${fmt(r.Pcr, 2)} kN`],
          ['n_ôđ = P_th/N', <Verdict ok={r.okN}>{fmt(r.nActual, 3)}</Verdict>],
          ['φ · σ so với φ[σ]', <Verdict ok={r.okPhi}>{r.phi === null ? '—' : fmt(r.phi, 4)} · {fmt(r.sigma, 2)} MPa so với {fmt(r.allowPhi, 2)} MPa</Verdict>],
          ['Tải trọng cho phép [N] = φ[σ]A', `${fmt(r.Nallow, 2)} kN`],
        ]} />
        {parts.diagrams && (
          <div className="r-row">
            <RFig caption="Hệ số φ theo độ mảnh λ">
              <BucklingChart title="φ(λ)" unit="—" digits={3} marks={marks} curve={model.params.phi.map((v, i) => [i * 10, v])} point={r.phi !== null ? { x: r.lambdaMax, y: r.phi } : null} />
            </RFig>
            <RFig caption="Ứng suất tới hạn σ_th theo λ">
              <BucklingChart title="σ_th(λ)" unit="MPa" digits={1} tone="b" marks={marks} curve={sig} point={{ x: r.lambdaMax, y: r.sigmaCr }} />
            </RFig>
          </div>
        )}
        {parts.steps && <RSteps lines={[...(sw?.steps ?? []), ...r.steps]} />}
        {local.applicable && local.plates.length > 0 && (
          <RTable head={['Tấm', 'c/t', 'Giới hạn 1/2/3', 'σ_cr (MPa)', 'Loại']}
            rows={local.plates.filter((p, i, a) => a.findIndex((q) => q.name.replace(/ – (trái|phải)$/, '') === p.name.replace(/ – (trái|phải)$/, '')) === i)
              .map((p) => [p.name.replace(/ – (trái|phải)$/, ''), fmt(p.ct, 1), p.limits.map((l) => fmt(l, 1)).join(' / '), fmt(p.sigmaCr, 0), String(p.cls)])}
            note={`Ổn định cục bộ (f_y = ${lopt.fy} MPa; ${lopt.stiffenerSpacing > 0 ? `sườn ngang a = ${lopt.stiffenerSpacing} mm` : 'không có sườn ngang'}): tiết diện loại ${local.sectionClass}.`} />
        )}
        {local.effective?.applicable && local.effective.N && local.sectionClass === 4 && (
          <p>Tiết diện loại 4 khi nén: A_eff = {fmt(local.effective.N.Aeff, 1)} mm² ({fmt((local.effective.N.Aeff / sec.A) * 100, 1)}% A); kiểm tra ổn định dùng σ = N/A_eff.</p>
        )}
        <StiffenerChecks local={local} steps={parts.steps} />
        {local.tube && <TubeReport tube={local.tube} steps={parts.steps} />}
      </RSection>
    </>
  );
}
