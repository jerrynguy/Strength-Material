import type { ReactNode } from 'react';
import { checkFrameMember, frameAnalyses } from '../../core/beamColumn';
import { analyzeFrame, DIST_DIR_LABELS, type FrameModel } from '../../core/frame';
import { aeffIfClass4 } from '../../core/effective';
import { checkLocal, type LocalOptions } from '../../core/localBuckling';
import { BUCKLING_MATERIALS, checkStability } from '../../core/stability';
import { sectionSteps } from '../../core/steps';
import { fmt, maxNormalOnSection } from '../../core/stress';
import type { InternalForces } from '../../core/types';
import { memberClass } from '../frame/FrameApp';
import { FrameView } from '../frame/FrameView';
import { StiffenerChecks, StiffenerInputs } from './StiffenerReport';
import { RConclusion, RFig, RKV, RSection, RSteps, RSub, RTable, Verdict, type ReportParts } from './primitives';
import { sectionRows } from './BeamReport';

const STATUS = { 'tinh-dinh': 'tĩnh định', 'sieu-tinh': 'siêu tĩnh', 'bien-hinh': 'biến hình' };
const SUP = { fixed: 'Ngàm', pin: 'Gối cố định', roller: 'Gối di động', custom: 'Tuỳ chỉnh' };
const toIF = (s: { N: number; Q: number; M: number }): InternalForces => ({ N: s.N, Qy: s.Q, Qz: 0, T: 0, Mz: s.M, My: 0 });

export function FrameReport({ model, parts, local: lopt }: { model: FrameModel; parts: ReportParts; local: LocalOptions }) {
  const res = analyzeFrame(model, { buckling: true });
  let n = 0;
  const N = () => String(++n);
  if (!res.ok) {
    return <RSection n="1" title="Kết quả"><p className="r-bad">Không giải được: {res.errors.join(' ')}</p></RSection>;
  }
  const allow = model.material.allowable;
  const nodeName = (id: string) => model.nodes.find((x) => x.id === id)?.name ?? '?';
  const secName = (id: string) => model.sections.find((x) => x.id === id)?.name ?? '?';
  const a = parts.stability ? frameAnalyses(model, 1.5) : null;

  const rows = res.members.map((mr) => {
    let sig = 0, x = 0;
    for (const s of mr.samples) {
      const m = maxNormalOnSection(mr.section, toIF(s));
      const v = Math.abs(m.max) > Math.abs(m.min) ? m.max : m.min;
      if (Math.abs(v) > Math.abs(sig)) { sig = v; x = s.s; }
    }
    let Nc = 0;
    for (const s of mr.samples) Nc = Math.max(Nc, -s.N);
    const muIn = res.buckling && Nc > 0 ? (Math.PI / mr.L) * Math.sqrt((model.material.E * 1e9 * mr.section.Iz * 1e-12) / (res.buckling.alpha * Nc * 1e3)) : 1;
    const axial = Nc > 0 ? checkStability(mr.section, {
      N: Nc, Lz: mr.L, Ly: mr.L, muZ: muIn, muY: 1, E: model.material.E, allowable: allow, params: BUCKLING_MATERIALS.CT3, nRequired: 1, Aeff: aeffIfClass4(mr.sectionSpec, model.material, lopt.fy, lopt.stiffenerSpacing),
    }) : null;
    const bc = a && Nc > 0 ? checkFrameMember(a, mr.id, 1, model, BUCKLING_MATERIALS.CT3, lopt) : null;
    const local = parts.stability ? checkLocal(mr.sectionSpec, model.material, mr.samples.map(toIF), lopt) : null;
    return { mr, sig, x, Nc, muIn, axial, bc, local };
  });
  const concl: { label: string; ok: boolean | null; detail: ReactNode }[] = [];
  const worstSig = rows.reduce((p, r) => (Math.abs(r.sig) > Math.abs(p.sig) ? r : p), rows[0]);
  concl.push({ label: 'Bền theo ứng suất pháp (mọi thanh)', ok: Math.abs(worstSig.sig) <= allow, detail: `|σ|max = ${fmt(Math.abs(worstSig.sig), 2)} MPa ở thanh ${worstSig.mr.name}` });
  if (res.buckling) concl.push({ label: 'Hệ số tới hạn của khung α_th', ok: res.buckling.alpha > 1, detail: `${fmt(res.buckling.alpha, 3)}${res.buckling.alpha < 10 ? ' (< 10: nên kể hiệu ứng bậc hai)' : ''}` });
  const comp = rows.filter((r) => r.axial);
  if (comp.length) concl.push({ label: 'Ổn định các thanh chịu nén (φ)', ok: comp.every((r) => r.axial!.okPhi), detail: comp.map((r) => `${r.mr.name}: ${fmt((r.axial!.sigma / (r.axial!.allowPhi || 1)) * 100, 0)}%`).join('; ') });
  const bcs = rows.filter((r) => r.bc && r.bc.planes.some((p) => p.M1));
  if (bcs.length) concl.push({ label: 'Nén – uốn (bậc hai, tải × 1.5 ≤ σ_ch)', ok: bcs.every((r) => r.bc!.ok2 && r.bc!.okN), detail: bcs.map((r) => `${r.mr.name}: ${r.bc!.sigmaN === null ? 'mất ổn định' : fmt(r.bc!.sigmaN, 0) + ' MPa'}`).join('; ') });
  const locs = rows.filter((r) => r.local?.applicable);
  if (locs.length) concl.push({ label: 'Ổn định cục bộ', ok: locs.every((r) => r.local!.ok), detail: locs.map((r) => `${r.mr.name}: loại ${r.local!.sectionClass || '—'}`).join('; ') });

  return (
    <>
      <RSection n={N()} title="Kết luận chung">
        <RConclusion items={concl} />
        <p className="r-note">Hệ {STATUS[res.status]}{res.status === 'sieu-tinh' ? ` bậc ${res.degree}` : ''}. Kết quả nội lực theo phân tích bậc nhất.</p>
      </RSection>

      {parts.inputs && (
        <RSection n={N()} title="Sơ đồ tính và dữ liệu đầu vào">
          <RFig caption="Hình 1. Sơ đồ khung"><FrameView model={model} res={res} mode="model" /></RFig>
          <RKV rows={[['Vật liệu', `${model.material.name}: E = ${model.material.E} GPa, ν = ${model.material.nu}, [σ] = ${allow} MPa`]]} />
          <RTable head={['Nút', 'X (m)', 'Y (m)']} rows={model.nodes.map((x) => [x.name, fmt(x.x, 3), fmt(x.y, 3)])} />
          <RTable head={['Thanh', 'Đầu i → j', 'L (m)', 'Tiết diện', 'Khớp đầu']}
            rows={res.members.map((mr) => {
              const m = model.members.find((x) => x.id === mr.id)!;
              return [m.name, `${nodeName(m.i)} → ${nodeName(m.j)}`, fmt(mr.L, 3), secName(m.sectionId), [m.releaseI && 'i', m.releaseJ && 'j'].filter(Boolean).join(', ') || '—'];
            })} />
          {model.sections.map((s) => {
            const mr = res.members.find((m) => model.members.find((x) => x.id === m.id)?.sectionId === s.id);
            return mr ? <RSub key={s.id} title={`Tiết diện ${s.name}: ${mr.section.label}`}><RKV rows={sectionRows(mr.section)} /><StiffenerInputs spec={s.spec} /></RSub> : null;
          })}
          <RTable head={['Gối tại nút', 'Loại', 'Góc mặt tựa']} rows={model.supports.map((s) => [nodeName(s.nodeId), SUP[s.kind], `${fmt(s.angle, 2)}°`])} />
          <RTable head={['Tải', 'Đặt tại', 'Giá trị']}
            rows={model.loads.map((l) => l.type === 'node'
              ? [l.name, `nút ${nodeName(l.nodeId)}`, `Fx = ${fmt(l.Fx, 3)}, Fy = ${fmt(l.Fy, 3)} kN, M = ${fmt(l.M, 3)} kN·m`]
              : l.type === 'mpoint'
                ? [l.name, `thanh ${model.members.find((m) => m.id === l.memberId)?.name}, a = ${fmt(l.a, 3)} m`, `${l.local ? "Fx' / Fy'" : 'Fx / Fy'} = ${fmt(l.Fx, 3)} / ${fmt(l.Fy, 3)} kN, M = ${fmt(l.M, 3)} kN·m`]
                : [l.name, `thanh ${model.members.find((m) => m.id === l.memberId)?.name}, ${fmt(l.a, 3)} → ${fmt(l.b, 3)} m`, `q = ${fmt(l.q1, 3)} → ${fmt(l.q2, 3)} kN/m (${DIST_DIR_LABELS[l.dir]})`])} />
        </RSection>
      )}

      <RSection n={N()} title="Cấu tạo hình học và phản lực">
        {res.det && (
          <p>
            Số ẩn = 3 × {model.members.length} + {res.det.reactionUnknowns} = {res.det.unknowns}; số phương trình = {res.det.equations}; hạng = {res.det.rank} →
            hệ <b>{STATUS[res.status]}</b>{res.status === 'sieu-tinh' ? `, bậc n = ${res.degree}` : ''}.
          </p>
        )}
        <RTable head={['Nút', 'R_X (kN)', 'R_Y (kN)', 'M (kN·m)']} rows={res.reactions.map((r) => [r.name, fmt(r.Rx, 3), fmt(r.Ry, 3), fmt(r.M, 3)])}
          note={`Kiểm tra cân bằng toàn hệ: ΣX = ${fmt(Math.abs(res.residual.X) < 1e-6 ? 0 : res.residual.X, 4)}, ΣY = ${fmt(Math.abs(res.residual.Y) < 1e-6 ? 0 : res.residual.Y, 4)}, ΣM = ${fmt(Math.abs(res.residual.M) < 1e-6 ? 0 : res.residual.M, 4)}.`} />
      </RSection>

      <RSection n={N()} title="Nội lực các thanh">
        <RTable head={['Thanh', 'N_i', 'Q_i', 'M_i', 'N_j', 'Q_j', 'M_j', '|M|max', 'Dạng chịu lực']}
          rows={res.members.map((m) => {
            const p = m.internalAt(0, 'right'), q = m.internalAt(m.L, 'left');
            let best = m.samples[0];
            for (const s of m.samples) if (Math.abs(s.M) > Math.abs(best.M)) best = s;
            return [m.name, fmt(p.N, 2), fmt(p.Q, 2), fmt(p.M, 2), fmt(q.N, 2), fmt(q.Q, 2), fmt(q.M, 2), `${fmt(best.M, 2)} @${fmt(best.s, 2)}`, memberClass(m).label];
          })} note="Đơn vị kN, kN·m; i, j: mặt cắt sát đầu i, j. M > 0 căng thớ phía −y′." />
        {parts.diagrams && (
          <>
            <RFig caption="Biểu đồ lực dọc N (kN)"><FrameView model={model} res={res} mode="N" /></RFig>
            <RFig caption="Biểu đồ lực cắt Q (kN)"><FrameView model={model} res={res} mode="Q" /></RFig>
            <RFig caption="Biểu đồ mô men M (kN·m) — vẽ về phía thớ căng"><FrameView model={model} res={res} mode="M" /></RFig>
          </>
        )}
      </RSection>

      <RSection n={N()} title="Chuyển vị">
        <RTable head={['Nút', 'u_X (mm)', 'u_Y (mm)', 'Góc xoay (rad)']} rows={res.nodeDisp.map((d) => [d.name, fmt(d.ux, 4), fmt(d.uy, 4), d.rz === null ? 'khớp' : fmt(d.rz, 6)])} />
        {parts.diagrams && <RFig caption="Hình dạng biến dạng (phóng đại)"><FrameView model={model} res={res} mode="deform" /></RFig>}
      </RSection>

      {parts.stress && (
        <RSection n={N()} title="Kiểm tra bền">
          <RTable head={['Thanh', 'Tiết diện', '|σ|max (MPa)', 'Vị trí (m)', 'Kết luận']}
            rows={rows.map((r) => [r.mr.name, r.mr.section.label, fmt(Math.abs(r.sig), 2), fmt(r.x, 3), <Verdict ok={Math.abs(r.sig) <= allow}>{Math.abs(r.sig) <= allow ? '≤' : '>'} [σ] = {allow}</Verdict>])} />
          {parts.steps && (
            <RSub title={`Lời giải mặt cắt nguy hiểm — thanh ${worstSig.mr.name}, s = ${fmt(worstSig.x, 3)} m`}>
              <RSteps lines={sectionSteps({
                ok: true, keyPoints: worstSig.mr.keyS, actions: worstSig.mr.actions, distributed: worstSig.mr.dists,
                internalAt: (s, sd) => toIF(worstSig.mr.internalAt(s, sd)),
              }, worstSig.x, 'left', 'đầu i').map((l) => l.replace(/Qy/g, 'Q').replace(/Mz/g, 'M'))} />
            </RSub>
          )}
        </RSection>
      )}

      {parts.stability && (
        <RSection n={N()} title="Kiểm tra ổn định">
          {res.buckling && (
            <>
              <p>Hệ số tới hạn của khung (bài toán trị riêng): <b>α_th = {fmt(res.buckling.alpha, 3)}</b> — khung mất ổn định khi tải tăng {fmt(res.buckling.alpha, 2)} lần.</p>
              {parts.diagrams && <RFig caption="Dạng mất ổn định thứ nhất"><FrameView model={model} res={res} mode="buckle" /></RFig>}
            </>
          )}
          {comp.length > 0 && (
            <RTable head={['Thanh', 'N nén (kN)', 'μ (từ α_th)', 'λ', 'φ', 'σ (MPa)', 'φ[σ] (MPa)', 'Kết luận']}
              rows={comp.map((r) => [r.mr.name, fmt(r.Nc, 2), fmt(r.muIn, 3), fmt(r.axial!.lambdaMax, 1), r.axial!.phi === null ? '—' : fmt(r.axial!.phi, 3),
                fmt(r.axial!.sigma, 2), fmt(r.axial!.allowPhi, 2), <Verdict ok={r.axial!.okPhi}>{r.axial!.okPhi ? 'đạt' : 'không đạt'}</Verdict>])}
              note="μ trong mặt phẳng suy từ α_th của cả khung; μ ngoài mặt phẳng lấy bằng 1 (giả thiết có giằng ở hai đầu thanh). Bảng φ thép CT3." />
          )}
          {bcs.length > 0 && (
            <RTable head={['Thanh', 'σ bậc 2 (MPa)', 'σ tải × 1.5 (MPa)', 'σ tương tác (MPa)']}
              rows={bcs.map((r) => [r.mr.name,
                <Verdict ok={r.bc!.ok2}>{r.bc!.sigma2 === null ? '—' : fmt(r.bc!.sigma2, 1)}</Verdict>,
                <Verdict ok={r.bc!.okN}>{r.bc!.sigmaN === null ? 'mất ổn định' : fmt(r.bc!.sigmaN, 1)}</Verdict>,
                <Verdict ok={r.bc!.okInter}>{r.bc!.sigmaInter === null ? 'không áp dụng' : fmt(r.bc!.sigmaInter, 1)}</Verdict>])}
              note={`Nén – uốn: (1) σ_II ≤ [σ] = ${allow}; (2) σ(1.5·tải) ≤ σ_ch = 240; (3) N/(φA) + M/(W(1 − N/N_th)) ≤ [σ].`} />
          )}
          {locs.length > 0 && (
            <RTable head={['Thanh', 'Loại tiết diện', 'Tấm bất lợi', 'Tiết diện hữu hiệu', 'Bụng chịu cắt']}
              rows={locs.map((r) => {
                const worst = r.local!.plates.filter((p) => p.cls).sort((x, y) => y.cls - x.cls || y.ct - x.ct)[0];
                return [r.mr.name, r.local!.sectionClass || 'không nén',
                  worst ? `${worst.name}: c/t = ${fmt(worst.ct, 1)} (loại ${worst.cls})` : '—',
                  r.local!.effCheck ? <Verdict ok={r.local!.effCheck.ok}>σ = {fmt(r.local!.effCheck.sigma, 1)} MPa</Verdict> : '—',
                  r.local!.shear ? <Verdict ok={r.local!.shear.ok}>{fmt(r.local!.shear.util * 100, 0)}%</Verdict> : '—'];
              })} note={`Ổn định cục bộ theo EN 1993-1-1 bảng 5.2, f_y = ${lopt.fy} MPa; ${lopt.stiffenerSpacing > 0 ? `sườn ngang a = ${lopt.stiffenerSpacing} mm` : 'không có sườn ngang (a = ∞)'}.`} />
          )}
          {locs.filter((r) => r.mr.sectionSpec.kind === 'I' && r.mr.sectionSpec.stiffeners?.length).map((r) => (
            <StiffenerChecks key={r.mr.id} local={r.local} steps={parts.steps} title={`Thanh ${r.mr.name} — bụng có sườn dọc (EN 1993-1-5 A.2, A.3)`} />
          ))}
        </RSection>
      )}
    </>
  );
}
