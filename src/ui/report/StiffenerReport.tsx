import type { LocalResult, TubeResult } from '../../core/localBuckling';
import { geometry } from '../../core/localBuckling';
import { fmt } from '../../core/stress';
import type { SectionSpec } from '../../core/types';
import { RKV, RSteps, RSub, RTable, Verdict } from './primitives';

/** Bảng dữ liệu sườn dọc (phần dữ liệu đầu vào). */
export function StiffenerInputs({ spec }: { spec: SectionSpec }) {
  if (spec.kind !== 'I' || !spec.stiffeners?.length) return null;
  const st = [...spec.stiffeners].sort((a, b) => a.pos - b.pos);
  const geo = geometry(spec);
  const panels = geo?.plates.filter((p) => p.web) ?? [];
  return (
    <RSub title="Sườn dọc bản bụng">
      <RTable
        head={['Sườn', 'Cách mép trên bụng (mm)', 'b_s × t_s (mm)', 'Phía', 'Diện tích (mm²)', 'Tỉ số b_s/t_s']}
        rows={st.map((k, i) => [
          `Sườn dọc ${i + 1}`, fmt(k.pos, 1), `${fmt(k.b, 1)} × ${fmt(k.t, 1)}`, k.sides === 2 ? 'hai phía' : 'một phía',
          fmt(k.b * k.t * k.sides, 0), fmt(k.b / k.t, 1),
        ])}
        note={`Bản bụng ${fmt(spec.hw, 0)} × ${fmt(spec.tw, 1)} mm được chia thành ${panels.length} ô: ${panels.map((p) => `${p.name.replace('Bụng – ', '')} = ${fmt(p.c, 0)} mm`).join('; ')}. Vị trí sườn tính đến tâm sườn.`}
      />
    </RSub>
  );
}

/** Kết quả kiểm tra bụng có sườn dọc (phần ổn định cục bộ). */
export function StiffenerChecks({ local, steps, title }: { local: LocalResult | null | undefined; steps: boolean; title?: string }) {
  const eff = local?.effective;
  if (!eff?.applicable) return null;
  const states = [
    { when: 'Nén đều', st: eff.N },
    { when: 'Uốn M_z > 0', st: eff.MzPos },
    { when: 'Uốn M_z < 0', st: eff.MzNeg },
  ].filter((x) => x.st?.columns?.length);
  if (!states.length && !local?.shear) return null;
  const hasStiff = states.length > 0 || eff.steps.some((l) => l.includes('Sườn dọc'));
  if (!hasStiff) return null;
  const stepLines = eff.steps.filter((l) => l.includes('Sườn dọc') || l.includes('ρ_c'));
  return (
    <RSub title={title ?? 'Mất ổn định tổng thể của bụng có sườn dọc (EN 1993-1-5 §4.5, A.1, A.2)'}>
      {states.length > 0 ? (
        <>
          <RTable
            head={['Trường hợp', 'Sườn', 'b1 / b2 (mm)', 'A_sl (mm²)', 'I_sl (mm⁴)', 'a_c (mm)', 'Kiểu tấm σ_cr,sl → σ_cr,p (MPa)', 'Kiểu thanh σ_cr,c (MPa)', 'χ_c']}
            rows={states.flatMap(({ when, st }) =>
              st!.columns!.map((c) => [
                when, `${c.name} (@${fmt(c.pos, 0)})`, `${fmt(c.b1, 0)} / ${fmt(c.b2, 0)}`, fmt(c.Asl, 0), fmt(c.Isl, 0),
                `${fmt(c.ac, 0)}${Number.isFinite(c.a) ? ` (a = ${fmt(c.a, 0)})` : ' (a = ∞)'}`,
                `${fmt(c.sigmaCrSl, 1)} → ${fmt(c.sigmaCrP, 1)}`,
                c.kind === 'gộp' ? '—' : Number.isFinite(c.a) ? fmt(c.sigmaCrC, 1) : '0 (a = ∞)',
                c.kind === 'gộp' ? '—' : fmt(c.chiC, 4),
              ]),
            )}
            note="Kiểu tấm (A.2.2): sườn cùng dải bụng góp hai bên làm việc như thanh trên nền đàn hồi, các sườn khác coi là gối cứng; với hai sườn kề nhau xét thêm trường hợp gộp (A = A₁ + A₂, I = I₁ + I₂, đặt tại hợp lực). Kiểu thanh (4.5.3): σ_cr,sl = π²EI_sl/(A_sl·a²). Giá trị quy về mép nén lớn nhất."
          />
          <RTable
            head={['Trường hợp', 'Cách tính σ_cr,p', 'σ_cr,p (MPa)', 'λ̄_p → ρ', 'σ_cr,c → χ_c', 'ξ', 'ρ_c']}
            rows={states.filter(({ st }) => st!.panel).map(({ when, st }) => {
              const p = st!.panel!;
              return [when, p.method === 'A.1' ? `A.1 tấm trực hướng (k_σ,p = ${fmt(p.A1!.kSigma, 2)})` : `A.2 — ${p.governing}`, fmt(p.sigmaCrP, 1),
                `${fmt(p.lambdaP, 3)} → ${fmt(p.rho, 4)}`, `${p.sigmaCrC > 0 ? fmt(p.sigmaCrC, 1) : '0'} → ${fmt(p.chiC, 4)}`, fmt(p.xi, 3),
                <Verdict ok={p.rhoC >= 0.999}>{fmt(p.rhoC, 4)}</Verdict>];
            })}
            note="ρ_c = (ρ − χ_c)·ξ(2 − ξ) + χ_c với ξ = σ_cr,p/σ_cr,c − 1 ∈ [0, 1] (EN 1993-1-5 4.5.4); β_A,c = 1. ρ_c giảm bề dày vùng nén của bụng (trừ dải biên sát cánh) và sườn."
          />
        </>
      ) : (
        <p>Không có sườn dọc nằm trong vùng nén — không xảy ra mất ổn định tổng thể của bụng có sườn.</p>
      )}
      {local?.shear && (
        <p>
          Ổn định cắt có sườn dọc (EN 1993-1-5 A.3): k_τ = {fmt(local.shear.kTau, 3)}, τ_cr = {fmt(local.shear.tauCr, 1)} MPa, χ_w = {fmt(local.shear.chiW, 3)};
          {' '}τ = <Verdict ok={local.shear.ok}>{fmt(local.shear.tau, 2)} MPa so với {fmt(local.shear.tauAllow, 2)} MPa</Verdict> (đã xét cả ô bụng lớn nhất).
        </p>
      )}
      {steps && <RSteps lines={stepLines} />}
    </RSub>
  );
}

/** Ống tròn: phân loại D/t và kiểm tra vỏ trụ (EN 1993-1-6) */
export function TubeReport({ tube, steps }: { tube: TubeResult; steps: boolean }) {
  return (
    <>
      <p>Ống tròn: D/t = {fmt(tube.Dt, 1)}; giới hạn loại 1/2/3 = {tube.limits.map((l) => fmt(l, 1)).join(' / ')} (50ε², 70ε², 90ε²) → loại {tube.cls}.</p>
      {tube.sigma > 0 && (
        <>
          <RKV rows={[
            ['Vỏ trụ (EN 1993-1-6, cấp B)', `ω = ${fmt(tube.omega, 1)} (trụ ${tube.lengthKind}); C_x = ${fmt(tube.Cx, 3)}; σ_x,Rcr = ${fmt(tube.sigmaRcr, 0)} MPa`],
            ['α_x · λ̄_x · χ_x', `${fmt(tube.alpha, 3)} · ${fmt(tube.lambda, 3)} · ${fmt(tube.chi, 3)}`],
            ['σ_x,Ed so với χ_x[σ]', <Verdict ok={tube.util <= 1}>{fmt(tube.sigma, 2)} {tube.util <= 1 ? '≤' : '>'} {fmt(tube.allow, 2)} MPa{tube.governs ? '' : ' (ống loại 1–3: tham khảo)'}</Verdict>],
          ]} />
          {steps && <RSteps lines={tube.steps} />}
        </>
      )}
    </>
  );
}
