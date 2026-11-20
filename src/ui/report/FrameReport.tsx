import { alphaTOf } from '../../core/types';
import { defaultFrameLtbOptions, frameLtbRows, frameOpRows } from '../stability/LtbCard';
import type { FrameLtbOptions } from '../../core/ltb';
import type { FrameMu } from '../frame/FrameApp';
import type { ReactNode } from 'react';
import { checkFrameMember, frameAnalyses } from '../../core/beamColumn';
import { analyzeFrame, DIST_DIR_LABELS, memberLocal, memberMaterial, withFrameSelfWeight, withYield, type FrameModel } from '../../core/frame';
import { aeffIfClass4 } from '../../core/effective';
import { checkLocal, type LocalOptions } from '../../core/localBuckling';
import { BUCKLING_MATERIALS, checkStability } from '../../core/stability';
import { sectionSteps } from '../../core/steps';
import { fmt, maxNormalOnSection } from '../../core/stress';
import { densityOf, type InternalForces } from '../../core/types';
import { memberClass } from '../frame/FrameApp';
import { FrameView } from '../frame/FrameView';
import { StiffenerChecks, StiffenerInputs } from './StiffenerReport';
import { RConclusion, RFig, RKV, RSection, RSteps, RSub, RTable, Verdict, type ReportParts } from './primitives';
import { sectionRows } from './BeamReport';

const STATUS = { 'tinh-dinh': 'tĩnh định', 'sieu-tinh': 'siêu tĩnh', 'bien-hinh': 'biến hình' };
const SUP = { fixed: 'Ngàm', pin: 'Gối cố định', roller: 'Gối di động', custom: 'Tuỳ chỉnh', spring: 'Gối đàn hồi' };
const toIF = (s: { N: number; Q: number; M: number }): InternalForces => ({ N: s.N, Qy: s.Q, Qz: 0, T: 0, Mz: s.M, My: 0 });

export function FrameReport({ model, parts, local: lopt, mu, ltb: ltbOpt = defaultFrameLtbOptions() }: { model: FrameModel; parts: ReportParts; local: LocalOptions; mu?: FrameMu; ltb?: FrameLtbOptions }) {
  const res = analyzeFrame(model, { buckling: true });
  let n = 0;
  const N = () => String(++n);
  if (!res.ok) {
    return <RSection n="1" title="Kết quả"><p className="r-bad">Không giải được: {res.errors.join(' ')}</p></RSection>;
  }
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
    const mat = mr.material;
    const mloc = memberLocal(lopt, model.members.find((x) => x.id === mr.id), mat);
    const muUser = mu?.in[mr.id];
    const muOutM = mu?.out[mr.id] ?? 1;
    const muIn = muUser !== undefined ? muUser : res.buckling && Nc > 0 ? (Math.PI / mr.L) * Math.sqrt((mat.E * 1e9 * mr.section.Iz * 1e-12) / (res.buckling.alpha * Nc * 1e3)) : 1;
    const axial = Nc > 0 ? checkStability(mr.section, {
      N: Nc, Lz: mr.L, Ly: mr.L, muZ: muIn, muY: muOutM, E: mat.E, allowable: mat.allowable, params: withYield(BUCKLING_MATERIALS.CT3, mloc.fy), nRequired: 1, Aeff: aeffIfClass4(mr.sectionSpec, mat, mloc.fy, mloc.stiffenerSpacing),
    }) : null;
    const bc = a && Nc > 0 ? checkFrameMember(a, mr.id, muOutM, model, withYield(BUCKLING_MATERIALS.CT3, mloc.fy), mloc) : null;
    const local = parts.stability ? checkLocal(mr.sectionSpec, mat, mr.samples.map(toIF), { ...mloc, length: mr.L * 1e3 }) : null;
    return { mr, sig, x, Nc, muIn, muOutM, muUser: muUser !== undefined, axial, bc, local, mloc };
  });
  const concl: { label: string; ok: boolean | null; detail: ReactNode }[] = [];
  const worstSig = rows.reduce((p, r) => (Math.abs(r.sig) > Math.abs(p.sig) ? r : p), rows[0]);
  concl.push({ label: 'Bền theo ứng suất pháp (mọi thanh)', ok: rows.every((r) => Math.abs(r.sig) <= r.mr.material.allowable), detail: `|σ|max = ${fmt(Math.abs(worstSig.sig), 2)} MPa ở thanh ${worstSig.mr.name} ([σ] = ${worstSig.mr.material.allowable} MPa); sử dụng lớn nhất ${fmt(Math.max(...rows.map((r) => Math.abs(r.sig) / r.mr.material.allowable)) * 100, 0)}%` });
  if (res.buckling) concl.push({ label: 'Hệ số tới hạn của khung α_th', ok: res.buckling.alpha > 1, detail: `${fmt(res.buckling.alpha, 3)}${res.buckling.alpha < 10 ? ' (< 10: nên kể hiệu ứng bậc hai)' : ''}` });
  const comp = rows.filter((r) => r.axial);
  if (comp.length) concl.push({ label: 'Ổn định các thanh chịu nén (φ)', ok: comp.every((r) => r.axial!.okPhi), detail: comp.map((r) => `${r.mr.name}: ${fmt((r.axial!.sigma / (r.axial!.allowPhi || 1)) * 100, 0)}%`).join('; ') });
  const bcs = rows.filter((r) => r.bc && r.bc.planes.some((p) => p.M1));
  if (bcs.length) concl.push({ label: 'Nén – uốn (bậc hai, tải × 1.5 ≤ σ_ch = f_y thanh)', ok: bcs.every((r) => r.bc!.ok2 && r.bc!.okN), detail: bcs.map((r) => `${r.mr.name}: ${r.bc!.sigmaN === null ? 'mất ổn định' : fmt(r.bc!.sigmaN, 0) + ' MPa'}`).join('; ') });
  const locs = rows.filter((r) => r.local?.applicable);
  const ltbs = parts.stability ? frameLtbRows(model, res, ltbOpt, lopt).filter((x) => x.r.applicable) : [];
  const ops = parts.stability ? frameOpRows(model, ltbOpt, lopt) : { secondOrder: true, rows: [] };
  const opApp = ops.rows.filter((x) => x.r.applicable);
  if (opApp.length) concl.push({ label: 'Phương pháp tổng quát EN 6.3.4 (nén + uốn – xoắn ngoài mặt phẳng)', ok: opApp.every((x) => x.r.ok), detail: opApp.map((x) => `${x.mr.name}: ${fmt(x.r.util * 100, 0)}%`).join('; ') });
  if (ltbs.length) concl.push({ label: 'Ổn định uốn – xoắn các thanh', ok: ltbs.every((x) => x.r.ok), detail: ltbs.map((x) => `${x.mr.name}: ${fmt(x.r.util * 100, 0)}%`).join('; ') });
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
          <RTable head={['Vật liệu', 'E (GPa)', 'ν', '[σ] (MPa)', 'f_y (MPa)', 'ρ (kg/m³)', 'Dùng cho thanh']}
            rows={[{ id: '', ...model.material, name: `${model.material.name} (chung)` }, ...(model.materials ?? [])].map((mt) => [
              mt.name, fmt(mt.E, 1), fmt(mt.nu, 2), fmt(mt.allowable, 1), mt.fy ? fmt(mt.fy, 0) : '—', fmt(densityOf(mt), 0),
              model.members.filter((b) => (b.materialId && (model.materials ?? []).some((x) => x.id === b.materialId) ? b.materialId : '') === mt.id).map((b) => b.name).join(', ') || '—',
            ])} />
          <RTable head={['Nút', 'X (m)', 'Y (m)']} rows={model.nodes.map((x) => [x.name, fmt(x.x, 3), fmt(x.y, 3)])} />
          <RTable head={['Thanh', 'Đầu i → j', 'L (m)', 'Tiết diện', 'Vật liệu', 'Khớp đầu']}
            rows={res.members.map((mr) => {
              const m = model.members.find((x) => x.id === mr.id)!;
              return [m.name, `${nodeName(m.i)} → ${nodeName(m.j)}`, fmt(mr.L, 3), secName(m.sectionId), mr.material.name, [m.releaseI && 'i', m.releaseJ && 'j'].filter(Boolean).join(', ') || '—'];
            })} />
          {model.sections.map((s) => {
            const mr = res.members.find((m) => model.members.find((x) => x.id === m.id)?.sectionId === s.id);
            return mr ? <RSub key={s.id} title={`Tiết diện ${s.name}: ${mr.section.label}`}><RKV rows={sectionRows(mr.section)} /><StiffenerInputs spec={s.spec} /></RSub> : null;
          })}
          <RTable head={['Gối tại nút', 'Loại', 'Góc mặt tựa / lò xo', 'Lún gối (chuyển vị cưỡng bức)']} rows={model.supports.map((s) => [nodeName(s.nodeId), SUP[s.kind],
            s.kind === 'spring' ? `k_x = ${fmt(s.springs?.kx ?? 0, 1)}, k_y = ${fmt(s.springs?.ky ?? 0, 1)} kN/m; k_φ = ${fmt(s.springs?.kr ?? 0, 1)} kN·m/rad` : `${fmt(s.angle, 2)}°`,
            s.settle && (s.settle.dx || s.settle.dy || s.settle.rz) ? `Δx = ${fmt(s.settle.dx, 2)} mm, Δy = ${fmt(s.settle.dy, 2)} mm, φ = ${fmt(s.settle.rz, 3)}‰ rad` : '—'])} />
          <RTable head={['Tải', 'Đặt tại', 'Giá trị']}
            rows={withFrameSelfWeight(model).loads.map((l) => l.type === 'node'
              ? [l.name, `nút ${nodeName(l.nodeId)}`, `Fx = ${fmt(l.Fx, 3)}, Fy = ${fmt(l.Fy, 3)} kN, M = ${fmt(l.M, 3)} kN·m`]
              : l.type === 'mtemp'
                ? [l.name, `thanh ${model.members.find((m) => m.id === l.memberId)?.name}`, `nhiệt độ: thớ trên ΔT = ${fmt(l.Ttop, 2)} °C, thớ dưới ΔT = ${fmt(l.Tbot, 2)} °C (α_t = ${alphaTOf(memberMaterial(model, model.members.find((m) => m.id === l.memberId)!)).toExponential(2)} 1/°C)`]
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
            rows={rows.map((r) => [r.mr.name, `${r.mr.section.label} — ${r.mr.material.name}`, fmt(Math.abs(r.sig), 2), fmt(r.x, 3), <Verdict ok={Math.abs(r.sig) <= r.mr.material.allowable}>{Math.abs(r.sig) <= r.mr.material.allowable ? '≤' : '>'} [σ] = {r.mr.material.allowable}</Verdict>])} />
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
            <RTable head={['Thanh', 'N nén (kN)', 'μ trong / ngoài', 'λ', 'φ', 'σ (MPa)', 'φ[σ] (MPa)', 'Kết luận']}
              rows={comp.map((r) => [r.mr.name, fmt(r.Nc, 2), `${fmt(r.muIn, 3)}${r.muUser ? '' : ' (α_th)'} / ${fmt(r.muOutM, 3)}`, fmt(r.axial!.lambdaMax, 1), r.axial!.phi === null ? '—' : fmt(r.axial!.phi, 3),
                fmt(r.axial!.sigma, 2), fmt(r.axial!.allowPhi, 2), <Verdict ok={r.axial!.okPhi}>{r.axial!.okPhi ? 'đạt' : 'không đạt'}</Verdict>])}
              note="μ trong mặt phẳng: giá trị nhập ở thẻ ổn định, nếu chưa nhập thì suy từ α_th của cả khung (ghi “α_th”); μ ngoài mặt phẳng theo thẻ nén – uốn (mặc định 1 — có giằng ở hai đầu thanh). Bảng φ thép CT3, σ_ch theo f_y từng thanh." />
          )}
          {bcs.length > 0 && (
            <RTable head={['Thanh', 'σ bậc 2 (MPa)', 'σ tải × 1.5 (MPa)', 'σ tương tác (MPa)']}
              rows={bcs.map((r) => [r.mr.name,
                <Verdict ok={r.bc!.ok2}>{r.bc!.sigma2 === null ? '—' : fmt(r.bc!.sigma2, 1)}</Verdict>,
                <Verdict ok={r.bc!.okN}>{r.bc!.sigmaN === null ? 'mất ổn định' : fmt(r.bc!.sigmaN, 1)}</Verdict>,
                <Verdict ok={r.bc!.okInter}>{r.bc!.sigmaInter === null ? 'không áp dụng' : fmt(r.bc!.sigmaInter, 1)}</Verdict>])}
              note={`Nén – uốn: (1) σ_II ≤ [σ] của vật liệu thanh; (2) σ(1.5·tải) ≤ σ_ch = f_y của thanh; (3) N/(φA) + M/(W(1 − N/N_th)) ≤ [σ].`} />
          )}
          {locs.length > 0 && (
            <RTable head={['Thanh', 'f_y (MPa)', 'Sườn ngang a (mm)', 'Loại tiết diện', 'Tấm bất lợi', 'Tiết diện hữu hiệu', 'Bụng chịu cắt']}
              rows={locs.map((r) => {
                const worst = r.local!.plates.filter((p) => p.cls).sort((x, y) => y.cls - x.cls || y.ct - x.ct)[0];
                return [r.mr.name, fmt(r.mloc.fy, 0) + (model.members.find((x) => x.id === r.mr.id)?.fy !== undefined ? ' (riêng)' : ''), r.mloc.stiffenerSpacing > 0 ? fmt(r.mloc.stiffenerSpacing, 0) + (model.members.find((x) => x.id === r.mr.id)?.stiffenerSpacing !== undefined ? ' (riêng)' : '') : '∞', r.local!.sectionClass || 'không nén',
                  worst ? `${worst.name}: c/t = ${fmt(worst.ct, 1)} (loại ${worst.cls})` : '—',
                  r.local!.effCheck ? <Verdict ok={r.local!.effCheck.ok}>σ = {fmt(r.local!.effCheck.sigma, 1)} MPa</Verdict> : '—',
                  r.local!.shear ? <Verdict ok={r.local!.shear.ok}>{fmt(r.local!.shear.util * 100, 0)}%</Verdict> : '—'];
              })} note={`Ổn định cục bộ theo EN 1993-1-1 bảng 5.2. f_y chung của khung = ${lopt.fy} MPa (f_y riêng cũng dùng làm σ_ch khi kiểm tra nén – uốn). Khoảng cách sườn ngang chung của khung: ${lopt.stiffenerSpacing > 0 ? `${lopt.stiffenerSpacing} mm` : '∞ (không có sườn ngang)'}; “(riêng)”: thanh có giá trị riêng.`} />
          )}
          {locs.filter((r) => r.mr.sectionSpec.kind === 'I' && r.mr.sectionSpec.stiffeners?.length).map((r) => (
            <StiffenerChecks key={r.mr.id} local={r.local} steps={parts.steps} title={`Thanh ${r.mr.name} — bụng có sườn dọc (EN 1993-1-5 §4.5, A.1–A.3)`} />
          ))}
          {ltbs.length > 0 && (
            <RSub title={`Ổn định uốn – xoắn các thanh (EN 1993-1-1 §6.3.2.2; tải ngang đặt ${ltbOpt.loadHeight === 'top' ? 'phía +y (cánh trên)' : ltbOpt.loadHeight === 'bottom' ? 'phía −y (cánh dưới)' : 'tại tâm cắt'})`}>
              <RTable head={['Thanh', 'L (m)', 'Giằng', 'f_y · W', '|M|max (kN·m)', 'M_cr (kN·m)', 'λ̄_LT · χ_LT', 'χ·W·[σ] (kN·m)', 'Kết luận']}
                rows={ltbs.map(({ mr, ml, r }) => [mr.name, fmt(mr.L, 3), ltbOpt.braces[mr.id] ?? 0, `${fmt(ml.fy, 0)} · ${r.wKind}`, fmt(Math.abs(r.Mmax), 2), fmt(r.Mcr, 1),
                  `${fmt(r.lambdaLT, 3)} · ${fmt(r.chi, 3)}`, fmt(r.Mrd, 2), <Verdict ok={r.ok}>{fmt(r.util * 100, 0)}%</Verdict>])}
                note="Hai đầu thanh là gối chạc (chặn ngoài mặt phẳng và xoắn, vênh tự do), đầu tự do của công-xôn không có liên kết; giằng chia đều nhịp. M_cr tính bằng bài toán trị riêng với biểu đồ mô men thực của thanh; mặt cắt đối xứng một trục có kể hiệu ứng Wagner." />
              {parts.steps && ltbs.map(({ mr, r }) => <RSteps key={mr.id} lines={r.steps.map((l) => `${mr.name}: ${l}`)} />)}
            </RSub>
          )}
          {opApp.length > 0 && (
            <RSub title="Phương pháp tổng quát — nén, uốn và uốn – xoắn ngoài mặt phẳng (EN 1993-1-1 §6.3.4)">
              <RTable head={['Thanh', 'Giằng', 'Loại · bền', 'α_ult,k', 'α_cr,op', 'λ̄_op', 'χ_z · χ_LT', 'χ_op', 'χ_op·α_ult,k', 'Kết luận']}
                rows={opApp.map(({ mr, r }) => [mr.name, ltbOpt.braces[mr.id] ?? 0, `${r.sectionClass} · ${r.plastic ? 'dẻo' : r.sectionClass === 4 ? 'hữu hiệu' : 'đàn hồi'}`, fmt(r.alphaUlt, 3), fmt(r.alphaCrOp, 3), fmt(r.lambdaOp, 3),
                  `${fmt(r.chiZ, 3)} · ${fmt(r.chiLT, 3)}`, fmt(r.chiOp, 3), fmt(r.chiOp * r.alphaUlt, 3), <Verdict ok={r.ok}>{fmt(r.util * 100, 0)}%</Verdict>])}
                note={`α_ult,k: loại 1, 2 theo đường tương tác dẻo N–M chính xác của mặt cắt (6.2.9.1); loại 3 = 1/max[|N|/(A·f_y) + |M|/(W_el·f_y)]; loại 4 dùng A_eff, W_eff; nội lực ${ops.secondOrder ? 'bậc hai P-Δ' : 'bậc nhất'}; α_cr,op từ bài toán trị riêng ngoài mặt phẳng khi tăng đồng thời N và M của thanh; λ̄_op = √(α_ult,k/α_cr,op); χ_op = min(χ_z, χ_LT) (6.3.4(4)a); điều kiện χ_op·α_ult,k ≥ f_y/[σ].`} />
              {parts.steps && opApp.map(({ mr, r }) => <RSteps key={mr.id} lines={r.steps.map((l) => `${mr.name}: ${l}`)} />)}
            </RSub>
          )}
        </RSection>
      )}
    </>
  );
}
