import type { ReactNode } from 'react';
import { analyze, withSelfWeight } from '../../core/analysis';
import { checkBeamColumn } from '../../core/beamColumn';
import { classify } from '../../core/classify';
import { checkLocal, type LocalOptions } from '../../core/localBuckling';
import { checkLTB, type LtbOptions } from '../../core/ltb';
import { BUCKLING_MATERIALS } from '../../core/stability';
import { DEFAULT_BEAM_STAB, beamAxialCheck, type BeamStabParams } from '../../core/beamAxial';
import { equilibriumSteps, sectionSteps } from '../../core/steps';
import { fmt, maxNormalOnSection, stressAt } from '../../core/stress';
import { SUPPORT_LABELS, alphaTOf, effectiveRestraints, springOf, type InternalForces, type Model, densityOf } from '../../core/types';
import { BeamView } from '../BeamView';
import { plasticProps } from '../../core/section';
import { Diagram } from '../Diagram';
import { SectionView } from '../SectionView';
import { quickPoints } from '../results';
import { StiffenerChecks, StiffenerInputs, TubeReport } from './StiffenerReport';
import { RConclusion, RFig, RKV, RSection, RSteps, RSub, RTable, Verdict, type ReportParts } from './primitives';

const STATUS = { 'tinh-dinh': 'tĩnh định', 'sieu-tinh': 'siêu tĩnh', 'bien-hinh': 'biến hình' };

export function sectionRows(sec: NonNullable<ReturnType<typeof analyze>['section']>, density = 7850): [string, string][] {
  return [
    ['Diện tích A', `${fmt(sec.A, 1)} mm²`],
    ['I_z (trục ngang) · I_y (trục đứng)', `${fmt(sec.Iz, 0)} · ${fmt(sec.Iy, 0)} mm⁴`],
    ['W_z · W_y', `${fmt(sec.Iz / Math.max(sec.yMax, -sec.yMin), 0)} · ${fmt(sec.Iy / Math.max(sec.zMax, -sec.zMin), 0)} mm³`],
    ['W_pl,z · W_pl,y (dẻo)', `${fmt(plasticProps(sec, 'z').Wpl, 0)} · ${fmt(plasticProps(sec, 'y').Wpl, 0)} mm³ (hệ số hình dạng ${fmt(plasticProps(sec, 'z').shape, 3)})`],
    ['Mô men quán tính xoắn I_t', sec.torsion.J ? `${fmt(sec.torsion.J, 0)} mm⁴` : '—'],
    ['Khối lượng', `${fmt(sec.A * 1e-6 * density, 2)} kg/m (ρ = ${fmt(density, 0)} kg/m³)`],
  ];
}

export function BeamReport({ model, parts, ltbOpt, local: lopt, stab = DEFAULT_BEAM_STAB }: { model: Model; parts: ReportParts; ltbOpt: LtbOptions; local: LocalOptions; stab?: BeamStabParams }) {
  const res = analyze(model);
  const sec = res.section;
  let n = 0;
  const N = () => String(++n);
  const conclusions: { label: string; ok: boolean | null; detail: ReactNode }[] = [];

  if (!res.ok || !sec) {
    return (
      <RSection n="1" title="Kết quả">
        <p className="r-bad">Không giải được: {res.errors.join(' ')}</p>
      </RSection>
    );
  }
  const cls = classify(res);
  const allow = model.material.allowable;
  const ext = (k: keyof InternalForces) => {
    let best = { v: 0, x: 0 };
    for (const s of res.forceSamples) if (Math.abs(s[k]) > Math.abs(best.v)) best = { v: s[k], x: s.x };
    return best;
  };
  // Điểm có ứng suất pháp lớn nhất
  let crit = { v: 0, x: 0, side: 'left' as 'left' | 'right', pt: [0, 0] as [number, number] };
  res.forceSamples.forEach((s, i) => {
    const m = maxNormalOnSection(sec, s);
    const useMax = Math.abs(m.max) >= Math.abs(m.min);
    const v = useMax ? m.max : m.min;
    if (Math.abs(v) > Math.abs(crit.v)) {
      const next = res.forceSamples[i + 1];
      crit = { v, x: s.x, side: next && next.x === s.x ? 'left' : 'right', pt: useMax ? m.at : m.atMin };
    }
  });
  const Fcrit = res.internalAt(crit.x, crit.side);
  const stCrit = stressAt(sec, Fcrit, model.material, crit.pt[0], crit.pt[1]);
  // Điểm tiếp giáp bụng – cánh (thuyết bền 4)
  const junctions = quickPoints(model.section, sec).filter((q) => q.label.includes('bản bụng') || q.label.includes('tiếp giáp'));
  let jun: { x: number; st: ReturnType<typeof stressAt>; F: InternalForces; label: string } | null = null;
  for (const q of junctions) {
    for (const s of res.forceSamples) {
      const st = stressAt(sec, s, model.material, q.y, q.z);
      if (!jun || st.td4 > jun.st.td4) jun = { x: s.x, st, F: s, label: q.label };
    }
  }
  const sigOk = Math.abs(crit.v) <= allow;
  conclusions.push({ label: 'Bền theo ứng suất pháp', ok: sigOk, detail: `|σ|max = ${fmt(Math.abs(crit.v), 2)} MPa so với [σ] = ${allow} MPa` });
  if (jun) conclusions.push({ label: 'Bền theo thuyết bền 4 (tiếp giáp bụng – cánh)', ok: jun.st.td4 <= allow, detail: `σ_tđ = ${fmt(jun.st.td4, 2)} MPa tại x = ${fmt(jun.x, 3)} m` });

  let Nc = 0;
  for (const s of res.forceSamples) Nc = Math.max(Nc, -s.N);
  const ac = Nc > 0 ? beamAxialCheck(model, res, sec, stab, lopt) : null;
  const axial = ac?.r ?? null;
  const varying = !!ac?.eq?.varying;
  const muTxt = ac ? (ac.muZ === ac.muY ? `μ = ${fmt(ac.muZ, 3)}` : `μ_z = ${fmt(ac.muZ, 3)}, μ_y = ${fmt(ac.muY, 3)}`) + (ac.auto ? ' theo gối tựa của mô hình' : ' nhập tay') : '';
  const bc = parts.stability && Nc > 0 ? checkBeamColumn(model, stab.bcN, BUCKLING_MATERIALS[stab.bcMat], lopt) : null;
  const ltb = parts.stability ? checkLTB(model, res, ltbOpt) : null;
  const local = parts.stability ? checkLocal(model.section, model.material, res.forceSamples, { ...lopt, length: model.length * 1e3 }) : null;
  if (ac && varying) conclusions.push({ label: 'Bền tại mặt cắt nén lớn nhất N_max/A', ok: ac.okBase, detail: `σ = ${fmt(ac.sigBase, 2)} MPa so với [σ] = ${allow} MPa` });
  if (ac && axial) conclusions.push({ label: `Ổn định nén đúng tâm (${muTxt}${varying ? '; lực nén đều tương đương N_tđ' : ''})`, ok: axial.okPhi && axial.okN, detail: `σ = ${fmt(axial.sigma, 2)} MPa so với φ[σ] = ${fmt(axial.allowPhi, 2)} MPa (λ = ${fmt(axial.lambdaMax, 1)}); n_ôđ = ${fmt(axial.nActual, 3)} so với [n_ôđ] = ${stab.nReq}` });
  if (bc && bc.planes.some((p) => p.M1)) conclusions.push({ label: 'Nén – uốn đồng thời (bậc hai, giáo trình)', ok: bc.ok2 && bc.okN, detail: `σ_II = ${bc.sigma2 === null ? '—' : fmt(bc.sigma2, 2)} MPa; σ(n·tải) = ${bc.sigmaN === null ? '—' : fmt(bc.sigmaN, 2)} MPa${bc.sigmaInter !== null ? `; công thức tương tác ${fmt((bc.sigmaInter / allow) * 100, 1)}%${bc.okInter ? '' : ' (không đạt — thiên về an toàn)'}` : ''}` });
  if (ltb?.applicable) conclusions.push({ label: 'Ổn định uốn – xoắn', ok: ltb.ok, detail: `|M| = ${fmt(Math.abs(ltb.Mmax), 2)} kN·m so với χ_LT·W·[σ] = ${fmt(ltb.Mrd, 2)} kN·m (M_cr = ${fmt(ltb.Mcr, 2)}; loại ${ltb.sectionClass}, ${ltb.wKind})` });
  if (local?.applicable) conclusions.push({ label: model.section.kind === 'I' && model.section.stiffeners?.length ? 'Ổn định cục bộ (bụng có sườn dọc)' : 'Ổn định cục bộ', ok: local.ok, detail: `Tiết diện loại ${local.sectionClass || '—'}${local.effCheck ? `; tiết diện hữu hiệu ${fmt(local.effCheck.util * 100, 0)}%` : ''}${local.shear?.needCheck ? `; bụng chịu cắt ${fmt(local.shear.util * 100, 0)}%` : ''}${local.tube?.governs ? `; vỏ trụ ${fmt(local.tube.util * 100, 0)}%` : ''}` });

  const fs = res.forceSamples, ds = res.dispSamples;
  const any = (k: keyof InternalForces) => fs.some((s) => s[k] !== 0);
  const dprops = { L: model.length, keyPoints: res.keyPoints };
  const restr = (s: Model['supports'][number]) => {
    const r = effectiveRestraints(s);
    return (Object.keys(r) as (keyof typeof r)[]).filter((k) => r[k]).join(', ');
  };
  const loadRow = (l: Model['loads'][number]) =>
    l.type === 'force' ? [l.name, 'Lực tập trung', `x = ${fmt(l.x, 3)} m`, `Fx = ${fmt(l.Fx, 3)}, Fy = ${fmt(l.Fy, 3)}${l.Fz ? `, Fz = ${fmt(l.Fz, 3)}` : ''} kN`]
      : l.type === 'moment' ? [l.name, 'Mô men', `x = ${fmt(l.x, 3)} m`, `Mz = ${fmt(l.Mz, 3)}${l.Mx ? `, Mx = ${fmt(l.Mx, 3)}` : ''}${l.My ? `, My = ${fmt(l.My, 3)}` : ''} kN·m`]
        : l.type === 'temp' ? [l.name, 'Nhiệt độ', `${fmt(l.x1, 3)} → ${fmt(l.x2, 3)} m`, `ΔT thớ trên = ${fmt(l.Ttop, 2)} °C, thớ dưới = ${fmt(l.Tbot, 2)} °C (α_t = ${alphaTOf(model.material).toExponential(2)} 1/°C)`]
          : [l.name, `Phân bố (${l.dir})`, `${fmt(l.x1, 3)} → ${fmt(l.x2, 3)} m`, `q = ${fmt(l.q1, 3)} → ${fmt(l.q2, 3)} kN/m`];

  return (
    <>
      <RSection n={N()} title="Kết luận chung">
        <RConclusion items={conclusions} />
        <p className="r-note">Hệ {STATUS[res.status]}{res.status === 'sieu-tinh' ? ` bậc ${res.degree}` : ''}. {cls.summary}</p>
      </RSection>

      {parts.inputs && (
        <RSection n={N()} title="Sơ đồ tính và dữ liệu đầu vào">
          <RFig caption="Hình 1. Sơ đồ tính"><BeamView model={withSelfWeight(model)} /></RFig>
          <RKV rows={[
            ['Chiều dài thanh L', `${fmt(model.length, 3)} m`],
            ['Vật liệu', `${model.material.name}: E = ${model.material.E} GPa, ν = ${model.material.nu}, [σ] = ${allow} MPa, ρ = ${fmt(densityOf(model.material), 0)} kg/m³`],
            ['Mặt cắt', sec.label],
          ]} />
          <div className="r-row">
            <SectionView sec={sec} size={170} />
            <RKV rows={sectionRows(sec, densityOf(model.material))} />
          </div>
          <StiffenerInputs spec={model.section} />
          <RTable head={['Liên kết', 'Loại', 'x (m)', 'Chặn / lò xo', 'Lún gối']} rows={model.supports.map((s) => [s.name, SUPPORT_LABELS[s.kind], fmt(s.x, 3),
            s.kind === 'spring' ? (Object.entries(springOf(s)) as [string, number][]).filter(([, v]) => v > 0).map(([k, v]) => `k_${k.startsWith('r') ? 'φ' + k[1] : k[1]} = ${fmt(v, 1)} ${k.startsWith('r') ? 'kN·m/rad' : 'kN/m'}`).join('; ') || '—' : restr(s),
            s.settle && Object.values(s.settle).some((v) => v) ? [s.settle.dx && `Δx = ${fmt(s.settle.dx, 2)} mm`, s.settle.dy && `Δy = ${fmt(s.settle.dy, 2)} mm`, s.settle.dz && `Δz = ${fmt(s.settle.dz, 2)} mm`, s.settle.rz && `φz = ${fmt(s.settle.rz, 3)}‰`, s.settle.ry && `φy = ${fmt(s.settle.ry, 3)}‰`].filter(Boolean).join('; ') : '—'])}
            note={model.hinges.length ? `Khớp nối: ${model.hinges.map((h) => `${h.name} (x = ${fmt(h.x, 3)} m)`).join(', ')}` : undefined} />
          <RTable head={['Tải', 'Loại', 'Vị trí', 'Giá trị']} rows={withSelfWeight(model).loads.map(loadRow)}
            note="Dấu theo hệ trục tổng thể: Fy < 0, q < 0 hướng xuống; Mz > 0 ngược chiều kim đồng hồ." />
        </RSection>
      )}

      <RSection n={N()} title="Phân tích cấu tạo hình học">
        <RTable head={['Hệ con', 'Số liên kết', 'Bậc tự do', 'Liên kết độc lập', 'Bậc siêu tĩnh']}
          rows={res.subsystems.filter((s) => s.considered).map((s) => [s.label, s.constraints, s.dof, s.rank, s.stable ? s.degree : '—'])} />
        <p>Kết luận: hệ <b>{STATUS[res.status]}</b>{res.status === 'sieu-tinh' ? `, bậc siêu tĩnh n = ${res.degree}` : ''}.</p>
        {res.warnings.map((w, i) => <p key={i} className="r-note">{w}</p>)}
      </RSection>

      <RSection n={N()} title="Phản lực liên kết">
        <RTable head={['Gối', 'x (m)', 'X (kN)', 'Y (kN)', 'Mz (kN·m)', 'Z (kN)', 'My (kN·m)', 'Mx (kN·m)']}
          rows={res.reactions.map((r) => [r.name, fmt(r.x, 3), fmt(r.Fx, 3), fmt(r.Fy, 3), fmt(r.Mz, 3), fmt(r.Fz, 3), fmt(r.My, 3), fmt(r.Mx, 3)])} />
        {parts.steps && <RSteps lines={equilibriumSteps(res)} />}
      </RSection>

      <RSection n={N()} title="Nội lực và dạng chịu lực">
        <RTable head={['Đoạn (m)', 'Dạng chịu lực', 'Nội lực khác 0']}
          rows={cls.regions.map((r) => [`${fmt(r.x1, 3)} → ${fmt(r.x2, 3)}`, r.label + (r.complex ? ' (phức tạp)' : ''), r.components.join(', ') || '—'])} />
        <RKV rows={(['N', 'Qy', 'Mz', 'Qz', 'My', 'T'] as (keyof InternalForces)[]).filter(any).map((k) => {
          const e = ext(k);
          return [`|${k}|max`, `${fmt(e.v, 3)} ${k.startsWith('M') || k === 'T' ? 'kN·m' : 'kN'} tại x = ${fmt(e.x, 3)} m`] as [string, string];
        })} />
        {parts.diagrams && (
          <>
            {any('N') && <RFig caption="Biểu đồ lực dọc N (kN)"><Diagram title="N" unit="kN" tone="c" data={fs.map((s) => ({ x: s.x, y: s.N }))} {...dprops} /></RFig>}
            {any('Qy') && <RFig caption="Biểu đồ lực cắt Qy (kN)"><Diagram title="Qy" unit="kN" tone="a" data={fs.map((s) => ({ x: s.x, y: s.Qy }))} {...dprops} /></RFig>}
            {any('Mz') && <RFig caption="Biểu đồ mô men Mz (kN·m) — vẽ về phía thớ căng"><Diagram title="Mz" unit="kN·m" tone="b" invert data={fs.map((s) => ({ x: s.x, y: s.Mz }))} {...dprops} /></RFig>}
            {any('Qz') && <RFig caption="Biểu đồ lực cắt Qz (kN)"><Diagram title="Qz" unit="kN" tone="a" data={fs.map((s) => ({ x: s.x, y: s.Qz }))} {...dprops} /></RFig>}
            {any('My') && <RFig caption="Biểu đồ mô men My (kN·m)"><Diagram title="My" unit="kN·m" tone="b" invert data={fs.map((s) => ({ x: s.x, y: s.My }))} {...dprops} /></RFig>}
            {any('T') && <RFig caption="Biểu đồ mô men xoắn T (kN·m)"><Diagram title="T" unit="kN·m" tone="d" data={fs.map((s) => ({ x: s.x, y: s.T }))} {...dprops} /></RFig>}
          </>
        )}
      </RSection>

      <RSection n={N()} title="Chuyển vị">
        <RKV rows={([['v', 'Độ võng v (phương y)', 'mm'], ['w', 'Độ võng w (phương z)', 'mm'], ['thetaZ', 'Góc xoay θz', 'rad'], ['u', 'Chuyển vị dọc u', 'mm'], ['phi', 'Góc xoắn φ', 'rad']] as const)
          .map(([k, label, unit]) => {
            let best = { v: 0, x: 0 };
            for (const s of ds) if (Math.abs(s[k]) > Math.abs(best.v)) best = { v: s[k], x: s.x };
            return best.v ? ([label, `${fmt(best.v, 5)} ${unit} tại x = ${fmt(best.x, 3)} m`] as [string, string]) : null;
          })
          .filter((r): r is [string, string] => r !== null)} />
        {parts.diagrams && ds.some((s) => s.v) && (
          <RFig caption="Đường đàn hồi v (mm)"><Diagram title="v" unit="mm" tone="c" digits={4} data={ds.map((s) => ({ x: s.x, y: s.v }))} {...dprops} /></RFig>
        )}
      </RSection>

      {parts.stress && (
        <RSection n={N()} title="Kiểm tra bền">
          <RSub title={`Điểm có ứng suất pháp lớn nhất: x = ${fmt(crit.x, 3)} m, y = ${fmt(crit.pt[0], 1)} mm, z = ${fmt(crit.pt[1], 1)} mm`}>
            <RKV rows={[
              ['Nội lực', `N = ${fmt(Fcrit.N, 3)} kN; Qy = ${fmt(Fcrit.Qy, 3)} kN; Mz = ${fmt(Fcrit.Mz, 3)} kN·m${Fcrit.My ? `; My = ${fmt(Fcrit.My, 3)} kN·m` : ''}${Fcrit.T ? `; T = ${fmt(Fcrit.T, 3)} kN·m` : ''}`],
              ['σ', <>{fmt(stCrit.sigma, 2)} MPa — <Verdict ok={sigOk}>{sigOk ? '≤' : '>'} [σ] = {allow} MPa</Verdict></>],
            ]} />
            {parts.steps && <RSteps lines={[...sectionSteps(res, crit.x, crit.side), ...stCrit.steps]} />}
          </RSub>
          {jun && (
            <RSub title={`${jun.label} — thuyết bền 4: x = ${fmt(jun.x, 3)} m, y = ${fmt(jun.st.y, 1)} mm`}>
              <RKV rows={[
                ['σ · τ', `${fmt(jun.st.sigma, 2)} MPa · ${fmt(jun.st.tau, 2)} MPa`],
                ['σ_tđ (TB4) = √(σ² + 3τ²)', <>{fmt(jun.st.td4, 2)} MPa — <Verdict ok={jun.st.td4 <= allow}>{jun.st.td4 <= allow ? '≤' : '>'} [σ]</Verdict></>],
              ]} />
              {parts.steps && <RSteps lines={jun.st.steps} />}
            </RSub>
          )}
        </RSection>
      )}

      {parts.stability && (axial || ltb?.applicable || local?.applicable) && (
        <RSection n={N()} title="Kiểm tra ổn định">
          {ac && axial && (
            <RSub title={varying
              ? `Ổn định nén đúng tâm (lực nén thay đổi dọc thanh: N_max = ${fmt(ac.Nmax, 2)} kN${ac.G > 0 ? `, có G = ${fmt(ac.G, 3)} kN` : ''}, N_tđ = ${fmt(ac.Ncheck, 2)} kN; ${muTxt}; ${BUCKLING_MATERIALS[stab.mat].label})`
              : `Ổn định nén đúng tâm (N = ${fmt(Nc, 2)} kN, ${muTxt}; ${BUCKLING_MATERIALS[stab.mat].label})`}>
              <RKV rows={[
                ['λ_max · chế độ', `${fmt(axial.lambdaMax, 2)} · ${axial.regime === 'euler' ? 'Euler' : axial.regime === 'empirical' ? 'Iasinski' : 'thanh ngắn'}`],
                ['σ_th · P_th · n_ôđ', `${fmt(axial.sigmaCr, 2)} MPa · ${fmt(axial.Pcr, 2)} kN · ${fmt(axial.nActual, 3)}`],
                ['n_ôđ so với [n_ôđ]', <Verdict ok={axial.okN}>{fmt(axial.nActual, 3)} so với {stab.nReq}</Verdict>],
                [`σ = ${varying ? 'N_tđ' : 'N'}/A so với φ[σ]`, <Verdict ok={axial.okPhi}>{fmt(axial.sigma, 2)} {axial.okPhi ? '≤' : '>'} {fmt(axial.allowPhi, 2)} MPa</Verdict>],
              ]} />
              {parts.steps && <RSteps lines={[...(ac.eq?.steps ?? []), ...axial.steps]} />}
            </RSub>
          )}
          {bc && bc.planes.some((p) => p.M1) && (
            <RSub title="Nén – uốn đồng thời (n = 1.5, σ_ch = 240 MPa)">
              <RTable head={['Mặt phẳng', 'N_th (kN)', 'μ tđ', 'M bậc 1', 'M bậc 2']}
                rows={bc.planes.map((p) => [p.label, p.Ncr ? fmt(p.Ncr, 1) : '—', p.mu ? fmt(p.mu, 3) : '—', fmt(p.M1, 3), Number.isFinite(p.M2) ? fmt(p.M2, 3) : '—'])} />
              <RKV rows={[
                ['(1) Bền bậc hai', <Verdict ok={bc.ok2}>σ = {bc.sigma2 === null ? '—' : fmt(bc.sigma2, 2)} MPa so với [σ] = {allow}</Verdict>],
                ['(2) Tải × n, bậc hai', <Verdict ok={bc.okN}>σ = {bc.sigmaN === null ? 'mất ổn định' : fmt(bc.sigmaN, 2)} MPa so với σ_ch = {bc.sigmaY}</Verdict>],
                ['(3) Công thức tương tác', <Verdict ok={bc.okInter}>σ = {bc.sigmaInter === null ? '—' : fmt(bc.sigmaInter, 2)} MPa so với [σ]</Verdict>],
              ]} />
              {parts.steps && <RSteps lines={bc.steps} />}
            </RSub>
          )}
          {ltb?.applicable && (
            <RSub title={`Ổn định uốn – xoắn (tải đặt ${ltbOpt.loadHeight === 'top' ? 'cánh trên' : ltbOpt.loadHeight === 'bottom' ? 'cánh dưới' : 'tâm cắt'}${ltbOpt.braces.length ? `, ${ltbOpt.braces.length} giằng` : ''})`}>
              <RKV rows={[
                ['M_cr · n = M_cr/|M|max', `${fmt(ltb.Mcr, 2)} kN·m · ${fmt(ltb.alpha, 3)}`],
                ['λ̄_LT · đường cong · χ_LT', `${fmt(ltb.lambdaLT, 3)} · ${ltb.curve} · ${fmt(ltb.chi, 4)}`],
                [`|M|max so với χ_LT·${ltb.wKind}·[σ] (loại ${ltb.sectionClass})`, <Verdict ok={ltb.ok}>{fmt(Math.abs(ltb.Mmax), 2)} {ltb.ok ? '≤' : '>'} {fmt(ltb.Mrd, 2)} kN·m</Verdict>],
              ]} />
              {parts.steps && <RSteps lines={ltb.steps} />}
            </RSub>
          )}
          {local?.applicable && (
            <RSub title={`Ổn định cục bộ (f_y = ${lopt.fy} MPa; ${lopt.stiffenerSpacing > 0 ? `sườn ngang a = ${lopt.stiffenerSpacing} mm` : 'không có sườn ngang'}) — tiết diện loại ${local.sectionClass || '—'}`}>
              {local.tube && <TubeReport tube={local.tube} steps={parts.steps} />}
              {local.plates.length > 0 && <RTable head={['Tấm', 'c/t', 'Giới hạn 1/2/3', 'ψ · k_σ', 'σ nén', 'σ_cr', 'Loại']}
                rows={local.plates.filter((p, i, a) => a.findIndex((q) => q.name.replace(/ – (trái|phải)$/, '') === p.name.replace(/ – (trái|phải)$/, '') && q.s1 === p.s1) === i)
                  .map((p) => [p.name.replace(/ – (trái|phải)$/, ''), fmt(p.ct, 1), p.cls ? p.limits.map((l) => fmt(l, 1)).join(' / ') : '—',
                    p.cls ? `${fmt(p.psi, 2)} · ${fmt(p.k, 2)}` : '—', p.cls ? fmt(p.s1, 1) : 'không nén', p.cls ? fmt(p.sigmaCr, 0) : '—',
                    p.cls === 0 ? '—' : p.cls === 4 ? <Verdict ok={p.util <= 1}>4 ({fmt(p.util * 100, 0)}%)</Verdict> : String(p.cls)])} />}
              {local.effective?.applicable && local.effective.N && (
                <RKV rows={[
                  ['Tiết diện hữu hiệu: A_eff · e_N,y', `${fmt(local.effective.N.Aeff, 1)} mm² · ${fmt(local.effective.N.eNy, 2)} mm`],
                  ['W_eff,z (M > 0 / M < 0)', `${fmt(local.effective.MzPos!.Weff, 0)} / ${fmt(local.effective.MzNeg!.Weff, 0)} mm³`],
                  ...(local.effCheck ? [['σ = N/A_eff + (M + N·e_N)/W_eff', <Verdict ok={local.effCheck.ok}>{fmt(local.effCheck.sigma, 2)} MPa so với [σ] = {allow} MPa</Verdict>] as [string, ReactNode]] : []),
                ]} />
              )}
              <StiffenerChecks local={local} steps={parts.steps} />
              {local.shear && !(model.section.kind === 'I' && model.section.stiffeners?.length) && (
                <p>Bản bụng chịu cắt: h_w/t_w = {fmt(local.shear.ratio, 1)} {local.shear.needCheck ? `> 72ε/η → χ_w = ${fmt(local.shear.chiW, 3)}` : '≤ 72ε/η'};
                  τ = <Verdict ok={local.shear.ok}>{fmt(local.shear.tau, 2)} MPa so với {fmt(local.shear.tauAllow, 2)} MPa</Verdict>.</p>
              )}
            </RSub>
          )}
        </RSection>
      )}
    </>
  );
}
