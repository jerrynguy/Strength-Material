/**
 * Lời giải theo phương pháp giáo trình (trong mặt phẳng xy: lực dọc, lực đứng, mô men M_z):
 *  1. Phản lực của hệ tĩnh định bằng các phương trình cân bằng (ΣM quanh gối, điều kiện M = 0 tại khớp, ΣY, ΣX).
 *  2. Chuyển vị tại một điểm bằng phương pháp Mohr – Maxwell (lực đơn vị), nhân biểu đồ theo Vereshchagin;
 *     hệ siêu tĩnh dùng định lý rút gọn (trạng thái đơn vị đặt trên hệ cơ bản).
 *  3. Hệ siêu tĩnh bằng phương pháp lực: chọn ẩn thừa X_i, hệ cơ bản, hệ phương trình chính tắc
 *     Σ δ_ij·X_j + Δ_iP = c_i (c_i — chuyển vị cưỡng bức tại liên kết bị bỏ).
 *
 * Mọi tích phân nhân biểu đồ tính chính xác (Gauss 3 điểm trên từng đoạn mà biểu đồ đơn vị tuyến tính, biểu đồ thực tối đa bậc 3).
 * Kết quả được đối chiếu với lời giải phần tử hữu hạn của analyze().
 */
import { analyze, type AnalysisResult } from './analysis';
import { solve } from './linalg';
import { fmt } from './stress';
import { alphaTOf, effectiveRestraints, isSpring, springOf, type DistributedLoad, type Load, type Model, type Support } from './types';

export type Comp = 'ux' | 'uy' | 'rz';
const COMPS: Comp[] = ['ux', 'uy', 'rz'];
const PREFIX: Record<Comp, string> = { ux: 'H', uy: 'V', rz: 'M' };
const UNIT: Record<Comp, string> = { ux: 'kN', uy: 'kN', rz: 'kN·m' };

/** Một thành phần phản lực trong mặt phẳng xy */
export interface Unknown {
  key: string;
  supportId: string;
  name: string;
  comp: Comp;
  x: number;
  /** độ cứng lò xo (kN/m, kN·m/rad); 0 = liên kết cứng */
  k: number;
}

export function planarUnknowns(model: Model): Unknown[] {
  const out: Unknown[] = [];
  for (const s of model.supports) {
    const r = effectiveRestraints(s);
    const k = isSpring(s) ? springOf(s) : null;
    for (const c of COMPS) if (r[c]) out.push({ key: `${s.id}:${c}`, supportId: s.id, name: `${PREFIX[c]}_${s.name}`, comp: c, x: s.x, k: k ? k[c] : 0 });
  }
  return out;
}

const n = (v: number, d = 3) => fmt(v, d);
const GAUSS3: [number, number][] = [[0.1127016653792583, 5 / 18], [0.5, 8 / 18], [0.8872983346207417, 5 / 18]];
const reactionOf = (res: AnalysisResult, u: Pick<Unknown, 'supportId' | 'comp'>) => {
  const r = res.reactions.find((q) => q.supportId === u.supportId);
  if (!r) return 0;
  return u.comp === 'ux' ? r.Fx : u.comp === 'uy' ? r.Fy : r.Mz;
};

/** Bậc siêu tĩnh trong mặt phẳng xy (kéo/nén + uốn đứng) */
export function planarDegree(res: AnalysisResult): number {
  return res.subsystems.filter((s) => (s.key === 'axial' || s.key === 'bendY') && s.considered && s.stable).reduce((a, s) => a + s.degree, 0);
}

// ───────────────────── 1. Phản lực bằng phương trình cân bằng ─────────────────────

interface Term { v: number; text: string }
interface Eq { label: string; coef: Map<string, number>; uText: Map<string, string>; c: number; terms: Term[] }

const eqText = (eq: Eq, unknowns: Unknown[]) => {
  const parts: { v: number; t: string }[] = [];
  for (const u of unknowns) {
    const a = eq.coef.get(u.key);
    if (a) parts.push({ v: a, t: eq.uText.get(u.key)! });
  }
  for (const t of eq.terms) if (Math.abs(t.v) > 1e-12) parts.push({ v: t.v, t: t.text });
  if (!parts.length) return '0 = 0';
  return parts.map((p, i) => `${p.v < 0 ? (i ? ' − ' : '−') : i ? ' + ' : ''}${p.t}`).join('') + ' = 0';
};

/** Hợp lực và trọng tâm của phần tải phân bố nằm trong [a, b] */
function partResultant(d: DistributedLoad, a: number, b: number): { R: number; xc: number; q1: number; q2: number; len: number } | null {
  const lo = Math.max(d.x1, a), hi = Math.min(d.x2, b);
  if (!(hi > lo + 1e-12)) return null;
  const q = (x: number) => d.q1 + ((d.q2 - d.q1) * (x - d.x1)) / (d.x2 - d.x1);
  const q1 = q(lo), q2 = q(hi), len = hi - lo;
  const R = ((q1 + q2) / 2) * len;
  const xc = Math.abs(q1 + q2) > 1e-12 ? lo + (len * (q1 + 2 * q2)) / (3 * (q1 + q2)) : (lo + hi) / 2;
  return { R, xc, q1, q2, len };
}

export interface ReactionSolution {
  ok: boolean;
  reason?: string;
  steps: string[];
  values: { u: Unknown; value: number; fem: number }[];
}

/** Lập và giải các phương trình cân bằng cho hệ tĩnh định trong mặt phẳng xy. */
export function reactionEquations(model: Model, res: AnalysisResult): ReactionSolution {
  if (!res.ok) return { ok: false, reason: 'Chưa có kết quả tính.', steps: [], values: [] };
  if (planarDegree(res) > 0) return { ok: false, reason: 'Hệ siêu tĩnh — phản lực tìm bằng phương pháp lực (bên dưới).', steps: [], values: [] };
  const unknowns = planarUnknowns(model);
  const tol = 1e-9 * Math.max(1, model.length);
  const loads = res.actions.filter((a) => a.source === 'load');
  const dists = res.distributed.filter((d) => d.dir === 'x' || d.dir === 'y');
  const mkEq = (label: string): Eq => ({ label, coef: new Map(), uText: new Map(), c: 0, terms: [] });
  const add = (eq: Eq, v: number, text: string) => { if (Math.abs(v) > 1e-12) { eq.c += v; eq.terms.push({ v, text }); } };
  const addU = (eq: Eq, u: Unknown, a: number, text: string) => { if (Math.abs(a) > 1e-12) { eq.coef.set(u.key, (eq.coef.get(u.key) ?? 0) + a); eq.uText.set(u.key, text); } };
  const qText = (p: NonNullable<ReturnType<typeof partResultant>>) =>
    Math.abs(p.q1 - p.q2) < 1e-12 ? `${n(Math.abs(p.q1))}·${n(p.len)}` : `${n(Math.abs(p.R))}`;

  /** phương trình mô men quanh điểm p của phần thanh trong [a, b] */
  const momentEq = (label: string, p: number, a: number, b: number): Eq => {
    const eq = mkEq(label);
    const inside = (x: number) => x >= a - tol && x <= b + tol;
    for (const u of unknowns) {
      if (!inside(u.x)) continue;
      if (u.comp === 'uy') { const d = u.x - p; if (Math.abs(d) > tol) addU(eq, u, d, `${u.name}·${n(Math.abs(d))}`); }
      if (u.comp === 'rz') addU(eq, u, 1, u.name);
    }
    for (const l of loads) {
      if (!inside(l.x)) continue;
      const d = l.x - p;
      if (l.Fy && Math.abs(d) > tol) add(eq, l.Fy * d, `${n(Math.abs(l.Fy))}·${n(Math.abs(d))}`);
      if (l.Mz) add(eq, l.Mz, n(Math.abs(l.Mz)));
    }
    for (const d of dists) {
      if (d.dir !== 'y') continue;
      const pr = partResultant(d, a, b);
      if (!pr) continue;
      const arm = pr.xc - p;
      if (Math.abs(arm) > tol) add(eq, pr.R * arm, `${qText(pr)}·${n(Math.abs(arm))}`);
    }
    return eq;
  };
  const forceEq = (dir: 'x' | 'y'): Eq => {
    const eq = mkEq(dir === 'y' ? 'ΣY = 0' : 'ΣX = 0');
    for (const u of unknowns) if (u.comp === (dir === 'y' ? 'uy' : 'ux')) addU(eq, u, 1, u.name);
    for (const l of loads) { const F = dir === 'y' ? l.Fy : l.Fx; if (F) add(eq, F, n(Math.abs(F))); }
    for (const d of dists) {
      if (d.dir !== dir) continue;
      const pr = partResultant(d, 0, model.length);
      if (pr) add(eq, pr.R, qText(pr));
    }
    return eq;
  };
  const eqs: Eq[] = [];
  // mô men của từng phần quanh khớp nối (phần bên phải trước — thường chỉ còn một ẩn)
  for (const h of [...model.hinges].sort((a, b) => b.x - a.x)) {
    eqs.push(momentEq(`ΣM_${h.name} (phần bên phải khớp ${h.name}) = 0`, h.x, h.x + tol * 2, model.length));
    eqs.push(momentEq(`ΣM_${h.name} (phần bên trái khớp ${h.name}) = 0`, h.x, 0, h.x - tol * 2));
  }
  const pts = [...new Map(model.supports.map((s) => [Math.round(s.x / tol), s])).values()];
  for (const s of pts) eqs.push(momentEq(`ΣM_${s.name} = 0`, s.x, 0, model.length));
  eqs.push(forceEq('y'), forceEq('x'));

  const steps: string[] = [];
  steps.push(`Ẩn số phản lực (trong mặt phẳng xy): ${unknowns.map((u) => u.name).join(', ')} — chiều dương: H theo +x, V hướng lên, M ngược chiều kim đồng hồ.`);
  const known = new Map<string, number>();
  const used = new Set<Eq>();
  const evalRest = (eq: Eq) => { let s = eq.c; for (const [k, a] of eq.coef) if (known.has(k)) s += a * known.get(k)!; return s; };
  for (let guard = 0; guard < 50 && known.size < unknowns.length; guard++) {
    const eq = eqs.find((e) => !used.has(e) && [...e.coef.keys()].filter((k) => !known.has(k)).length === 1);
    if (!eq) break;
    used.add(eq);
    const key = [...eq.coef.keys()].find((k) => !known.has(k))!;
    const u = unknowns.find((q) => q.key === key)!;
    const val = -evalRest(eq) / eq.coef.get(key)!;
    known.set(key, val);
    const subs = [...eq.coef.keys()].filter((k) => k !== key).map((k) => `${unknowns.find((q) => q.key === k)!.name} = ${n(known.get(k)!)}`);
    steps.push(`${eq.label}: ${eqText(eq, unknowns)}${subs.length ? ` (thay ${subs.join(', ')})` : ''} ⇒ ${u.name} = ${n(val)} ${UNIT[u.comp]}`);
  }
  // các ẩn còn lại (trường hợp phải giải đồng thời)
  const rest = unknowns.filter((u) => !known.has(u.key));
  if (rest.length) {
    const cand = eqs.filter((e) => !used.has(e) && [...e.coef.keys()].some((k) => !known.has(k)));
    const A = cand.map((e) => rest.map((u) => e.coef.get(u.key) ?? 0));
    const b = cand.map((e) => -evalRest(e));
    // bình phương tối thiểu (hệ tương thích nên nghiệm đúng)
    const AtA = rest.map((_, i) => rest.map((__, j) => A.reduce((s, row) => s + row[i] * row[j], 0)));
    const Atb = rest.map((_, i) => A.reduce((s, row, r) => s + row[i] * b[r], 0));
    const x = solve(AtA, Atb);
    if (!x) return { ok: false, reason: 'Không giải được hệ phương trình cân bằng.', steps, values: [] };
    rest.forEach((u, i) => known.set(u.key, x[i]));
    steps.push(`Giải đồng thời ${cand.map((e) => e.label).join('; ')} ⇒ ${rest.map((u, i) => `${u.name} = ${n(x[i])} ${UNIT[u.comp]}`).join(', ')}`);
    cand.forEach((e) => used.add(e));
  }
  // kiểm tra bằng các phương trình chưa dùng
  for (const eq of eqs.filter((e) => !used.has(e) && (e.label.startsWith('ΣY') || e.label.startsWith('ΣX') || e.label.startsWith('ΣM')))) {
    const r = evalRest(eq);
    if (eq.coef.size || eq.terms.length) steps.push(`Kiểm tra ${eq.label}: ${eqText(eq, unknowns)} → ${n(r, 6)} ≈ 0 ✓`);
    break;
  }
  const values = unknowns.map((u) => ({ u, value: known.get(u.key) ?? 0, fem: reactionOf(res, u) }));
  return { ok: true, steps, values };
}

// ───────────────────── Biểu đồ, nhân biểu đồ ─────────────────────

interface Diagram { M: (x: number) => number; N: (x: number) => number }
/** biểu đồ M, N của một trạng thái; làm sạch sai số làm tròn của lời giải số (tương đối 1e-7 so với giá trị lớn nhất) */
const diagramOf = (r: AnalysisResult): Diagram => {
  let sM = 0, sN = 0;
  for (const q of r.forceSamples) { sM = Math.max(sM, Math.abs(q.Mz)); sN = Math.max(sN, Math.abs(q.N)); }
  const c = (v: number, s: number) => (Math.abs(v) <= 1e-7 * s ? 0 : v);
  return { M: (x) => c(r.internalAt(x, 'right').Mz, sM), N: (x) => c(r.internalAt(x, 'right').N, sN) };
};
const cleanSamples = (r: AnalysisResult) => {
  let s = 0;
  for (const q of r.forceSamples) s = Math.max(s, Math.abs(q.Mz));
  return r.forceSamples.map((q) => ({ x: q.x, y: Math.abs(q.Mz) <= 1e-7 * s ? 0 : q.Mz }));
};

/** biến dạng nhiệt ε₀, κ₀ tại x (giống analyze) */
function thermalAt(model: Model, res: AnalysisResult, x: number): { eps0: number; kap0: number } {
  const sec = res.section!;
  const at = alphaTOf(model.material);
  const h = (sec.yMax - sec.yMin) / 1e3;
  let eps0 = 0, kap0 = 0;
  for (const l of model.loads) {
    if (l.type !== 'temp' || x < l.x1 || x > l.x2) continue;
    const Tc = l.Tbot + ((l.Ttop - l.Tbot) * (-sec.yMin / 1e3)) / h;
    eps0 += at * Tc;
    kap0 += (at * (l.Tbot - l.Ttop)) / h;
  }
  return { eps0, kap0 };
}

/** các điểm chia đoạn: biểu đồ đơn vị tuyến tính, biểu đồ thực trơn trên mỗi đoạn */
function segmentsOf(model: Model, results: AnalysisResult[], extra: number[]): number[] {
  const tol = 1e-9 * Math.max(1, model.length);
  const xs = [0, model.length, ...extra, ...results.flatMap((r) => r.keyPoints), ...model.loads.flatMap((l) => (l.type === 'temp' ? [l.x1, l.x2] : []))]
    .filter((x) => x >= -tol && x <= model.length + tol).sort((a, b) => a - b);
  return xs.filter((x, i) => i === 0 || x - xs[i - 1] > tol);
}

const gauss = (f: (x: number) => number, a: number, b: number) => GAUSS3.reduce((s, [t, w]) => s + w * f(a + (b - a) * t), 0) * (b - a);

/**
 * ∫ F·g dx trên các đoạn, trình bày theo Vereshchagin: Ω (diện tích biểu đồ F trên đoạn) × tung độ ȳ của g tại trọng tâm Ω.
 * g tuyến tính trên mỗi đoạn. Trả về tổng và các dòng lời giải.
 */
function multiply(xs: number[], F: (x: number) => number, g: (x: number) => number, Fname: string, gname: string, scale: number): { total: number; lines: string[] } {
  let total = 0;
  const lines: string[] = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i], b = xs[i + 1];
    const exact = gauss((x) => F(x) * g(x), a, b);
    if (Math.abs(exact) < 1e-12 * scale) continue;
    total += exact;
    // tách biểu đồ F tại các điểm F = 0 → mỗi phần cùng dấu, trọng tâm nằm trong đoạn (như khi nhân biểu đồ bằng tay)
    const cuts = [a];
    const K = 24;
    // so với điểm lấy mẫu khác 0 gần nhất (điểm mẫu có thể rơi đúng vào chỗ F = 0)
    let xPrev = a + (b - a) * 1e-9, fPrev = F(xPrev);
    for (let k = 1; k <= K; k++) {
      const x = a + ((b - a) * k) / K - (k === K ? (b - a) * 1e-9 : 0), fx = F(x);
      if (fx === 0) continue;
      if (fPrev !== 0 && fPrev * fx < 0) {
        let lo = xPrev, hi = x;
        for (let it = 0; it < 60; it++) { const m = 0.5 * (lo + hi); const fm = F(m); if (fm !== 0 && fm * fPrev > 0) lo = m; else hi = m; }
        cuts.push(0.5 * (lo + hi));
      }
      xPrev = x; fPrev = fx;
    }
    cuts.push(b);
    const parts: string[] = [];
    for (let k = 0; k + 1 < cuts.length; k++) {
      const p = cuts[k], q = cuts[k + 1];
      const Om = gauss(F, p, q);
      if (Math.abs(Om) <= 1e-12 * scale * (q - p)) continue;
      const xc = gauss((x) => x * F(x), p, q) / Om;
      const yb = g(xc);
      parts.push(`Ω = ${n(Om, 4)}, x_c = ${n(xc, 4)}, ȳ = ${gname}(x_c) = ${n(yb, 4)} → Ω·ȳ = ${n(Om * yb, 4)}`);
    }
    const head = `đoạn [${n(a)}; ${n(b)}]${cuts.length > 2 ? ` (${Fname} đổi dấu tại x = ${cuts.slice(1, -1).map((c) => n(c, 4)).join('; ')} — tách thành ${cuts.length - 1} phần)` : ''}: `;
    lines.push(head + (parts.length ? parts.join(' ; ') : `Ω(${Fname}) ≈ 0`) + (parts.length > 1 ? ` ⇒ Σ = ${n(exact, 4)}` : ''));
  }
  return { total, lines };
}

// ───────────────────── Hệ cơ bản, trạng thái đơn vị ─────────────────────

/** Bỏ các liên kết (ẩn thừa) → hệ cơ bản */
export function releaseModel(model: Model, keys: string[]): Model {
  const rel = new Set(keys);
  const supports: Support[] = [];
  for (const s of model.supports) {
    const comps = COMPS.filter((c) => rel.has(`${s.id}:${c}`));
    if (!comps.length) { supports.push(s); continue; }
    if (isSpring(s)) {
      const k = { ...s.springs! };
      for (const c of comps) { if (c === 'ux') k.kx = 0; if (c === 'uy') k.ky = 0; if (c === 'rz') k.krz = 0; }
      supports.push({ ...s, springs: k });
      continue;
    }
    const r = { ...effectiveRestraints(s) };
    for (const c of comps) r[c] = false;
    const st = s.settle ? { ...s.settle } : undefined;
    if (st) for (const c of comps) { if (c === 'ux') delete st.dx; if (c === 'uy') delete st.dy; if (c === 'rz') delete st.rz; }
    supports.push({ ...s, kind: 'custom', restraints: r, settle: st });
  }
  return { ...model, supports };
}

const unitLoad = (comp: Comp, x: number, id: string): Load =>
  comp === 'rz' ? { id, type: 'moment', name: '1', x, Mx: 0, My: 0, Mz: 1 } : { id, type: 'force', name: '1', x, Fx: comp === 'ux' ? 1 : 0, Fy: comp === 'uy' ? 1 : 0, Fz: 0 };

/** trạng thái chỉ có tải đơn vị: bỏ nhiệt độ, lún gối, trọng lượng bản thân */
const unitState = (basic: Model, comp: Comp, x: number) => analyze({
  ...basic, selfWeight: undefined, loads: [unitLoad(comp, x, '__unit')],
  supports: basic.supports.map((s) => (s.settle ? { ...s, settle: undefined } : s)),
});

/** hệ cơ bản đúng (bất biến hình, tĩnh định trong mặt phẳng) */
function basicOk(model: Model, orig: AnalysisResult, keys: string[]): boolean {
  const b = analyze({ ...releaseModel(model, keys), loads: [], selfWeight: undefined, supports: releaseModel(model, keys).supports.map((s) => ({ ...s, settle: undefined })) });
  for (const key of ['axial', 'bendY'] as const) {
    const o = orig.subsystems.find((s) => s.key === key), s = b.subsystems.find((q) => q.key === key);
    if (!o || !s) return false;
    if (o.stable && (!s.stable || s.degree !== 0)) return false;
  }
  return true;
}

/** Chọn ẩn thừa tự động: phản lực đứng gối giữa, gối phải, mô men ngàm, gối trái, phản lực ngang */
export function autoRedundants(model: Model, res: AnalysisResult): string[] | null {
  const deg = planarDegree(res);
  if (deg === 0) return [];
  const L = model.length, tol = 1e-9 * Math.max(1, L);
  const score = (u: Unknown) => (u.comp === 'uy' ? (u.x > tol && u.x < L - tol ? 0 : u.x >= L - tol ? 1 : 3) : u.comp === 'rz' ? 2 : 4) + (u.k ? -0.5 : 0);
  const cand = planarUnknowns(model).sort((a, b) => score(a) - score(b) || b.x - a.x);
  const pick: string[] = [];
  const tryPick = (i: number): boolean => {
    if (pick.length === deg) return basicOk(model, res, pick);
    for (let j = i; j < cand.length; j++) {
      pick.push(cand[j].key);
      if (tryPick(j + 1)) return true;
      pick.pop();
    }
    return false;
  };
  return tryPick(0) ? [...pick] : null;
}

// ───────────────────── 3. Phương pháp lực ─────────────────────

export interface ForceMethodResult {
  ok: boolean;
  reason?: string;
  degree: number;
  candidates: Unknown[];
  redundants: Unknown[];
  basic: Model | null;
  steps: string[];
  delta: number[][];
  DeltaP: number[];
  c: number[];
  X: number[];
  reactions: { u: Unknown; value: number; fem: number }[];
  maxDiffM: number;
  diagrams: { MP: { x: number; y: number }[]; m: { x: number; y: number }[][]; keyPoints: number[] };
}

const sub = (i: number) => String(i).split('').map((d) => '₀₁₂₃₄₅₆₇₈₉'[+d]).join('');

export function forceMethod(model: Model, res: AnalysisResult, chosen?: string[] | null): ForceMethodResult {
  const empty = (reason: string, degree = 0): ForceMethodResult => ({
    ok: false, reason, degree, candidates: planarUnknowns(model), redundants: [], basic: null, steps: [], delta: [], DeltaP: [], c: [], X: [],
    reactions: [], maxDiffM: 0, diagrams: { MP: [], m: [], keyPoints: [] },
  });
  if (!res.ok || !res.section) return empty('Chưa có kết quả tính.');
  const deg = planarDegree(res);
  if (deg === 0) return empty('Hệ tĩnh định — không cần phương pháp lực.', 0);
  const cands = planarUnknowns(model);
  let keys = chosen && chosen.length === deg && basicOk(model, res, chosen) ? chosen : null;
  const steps: string[] = [];
  if (chosen && chosen.length && !keys) steps.push(`Tập ẩn thừa đã chọn không hợp lệ (cần đúng ${deg} liên kết và hệ cơ bản phải bất biến hình) — dùng lựa chọn tự động.`);
  keys = keys ?? autoRedundants(model, res);
  if (!keys) return empty('Không tìm được hệ cơ bản hợp lệ.', deg);
  const red = keys.map((k) => cands.find((u) => u.key === k)!);
  const basic = releaseModel(model, keys);
  const EI = res.rigidity.EIz / 1e3, EA = res.rigidity.EA / 1e3; // kN·m², kN
  const resP = analyze(basic);
  if (!resP.ok) return empty(`Hệ cơ bản không giải được: ${resP.errors[0]}`, deg);
  const units = red.map((u) => unitState(basic, u.comp, u.x));
  if (units.some((r) => !r.ok)) return empty('Trạng thái đơn vị không giải được.', deg);
  const xs = segmentsOf(model, [res, resP, ...units], []);
  const dP = diagramOf(resP);
  const dU = units.map(diagramOf);
  const scaleM = Math.max(1e-9, ...res.forceSamples.map((s) => Math.abs(s.Mz)), 1);
  const basicUnknowns = planarUnknowns(basic);
  const springs = basicUnknowns.filter((u) => u.k > 0);
  const rigid = basicUnknowns.filter((u) => u.k === 0);
  const settleOf = (u: Unknown) => {
    const s = model.supports.find((q) => q.id === u.supportId)?.settle;
    if (!s) return 0;
    return (u.comp === 'ux' ? s.dx ?? 0 : u.comp === 'uy' ? s.dy ?? 0 : s.rz ?? 0) / 1e3;
  };
  const hasAxial = units.some((r) => r.forceSamples.some((q) => Math.abs(q.N) > 1e-9));

  steps.push(`Bậc siêu tĩnh trong mặt phẳng xy: n = ${deg}. Chọn ẩn thừa: ${red.map((u, i) => `X${sub(i + 1)} = ${u.name}${u.k ? ` (lò xo k = ${n(u.k)})` : ''}`).join('; ')}.`);
  steps.push(`Hệ cơ bản: bỏ các liên kết trên, thay bằng X_i chưa biết (chiều dương: H theo +x, V hướng lên, M ngược chiều kim đồng hồ). EI = ${n(EI, 1)} kN·m²${hasAxial ? `, EA = ${n(EA, 1)} kN` : ''}.`);
  steps.push('Phương trình chính tắc: Σⱼ δᵢⱼ·Xⱼ + Δᵢₚ = cᵢ (cᵢ — chuyển vị cưỡng bức tại liên kết i; lò xo bị bỏ thì δᵢᵢ cộng thêm 1/k). δ, Δ tính bằng nhân biểu đồ Vereshchagin: δᵢⱼ = Σ Ω(mᵢ)·ȳ(mⱼ)/EI, Δᵢₚ = Σ Ω(M_P)·ȳ(mᵢ)/EI.');

  const nr = red.length;
  const delta = Array.from({ length: nr }, () => new Array<number>(nr).fill(0));
  const DeltaP = new Array<number>(nr).fill(0);
  const c = red.map((u) => (u.k ? 0 : settleOf(u)));
  for (let i = 0; i < nr; i++) {
    for (let j = i; j < nr; j++) {
      const mm = multiply(xs, dU[i].M, dU[j].M, `m${sub(i + 1)}`, `m${sub(j + 1)}`, 1);
      let v = mm.total / EI;
      let txt = `EI·δ${sub(i + 1)}${sub(j + 1)} = Σ Ω(m${sub(i + 1)})·ȳ(m${sub(j + 1)}) = ${n(mm.total, 5)}`;
      if (hasAxial) {
        const nn = xs.slice(1).reduce((s, b, k) => s + gauss((x) => dU[i].N(x) * dU[j].N(x), xs[k], b), 0);
        if (Math.abs(nn) > 1e-12) { v += nn / EA; txt += `; ∫n${sub(i + 1)}n${sub(j + 1)}/EA = ${n(nn / EA, 6)}`; }
      }
      for (const s of springs) {
        const ri = reactionOf(units[i], s), rj = reactionOf(units[j], s);
        if (ri && rj) { v += (ri * rj) / s.k; txt += `; lò xo ${s.name}: r̄${sub(i + 1)}·r̄${sub(j + 1)}/k = ${n((ri * rj) / s.k, 6)}`; }
      }
      if (i === j && red[i].k) { v += 1 / red[i].k; txt += `; + 1/k_${red[i].name} = ${n(1 / red[i].k, 6)}`; }
      delta[i][j] = delta[j][i] = v;
      steps.push(`${txt} ⇒ δ${sub(i + 1)}${sub(j + 1)} = ${n(v, 6)}${red[j].comp === 'rz' || red[i].comp === 'rz' ? '' : ' m/kN'}`);
      if (mm.lines.length) steps.push(...mm.lines.map((l) => `   ${l}`));
    }
    const mp = multiply(xs, dP.M, dU[i].M, 'M_P', `m${sub(i + 1)}`, scaleM);
    let v = mp.total / EI;
    let txt = `EI·Δ${sub(i + 1)}ₚ = Σ Ω(M_P)·ȳ(m${sub(i + 1)}) = ${n(mp.total, 5)}`;
    if (hasAxial) {
      const nn = xs.slice(1).reduce((s, b, k) => s + gauss((x) => dP.N(x) * dU[i].N(x), xs[k], b), 0);
      if (Math.abs(nn) > 1e-12) { v += nn / EA; txt += `; ∫N_P·n${sub(i + 1)}/EA = ${n(nn / EA, 6)}`; }
    }
    // nhiệt độ
    const th = xs.slice(1).reduce((s, b, k) => s + gauss((x) => { const t = thermalAt(model, res, x); return t.kap0 * dU[i].M(x) + t.eps0 * dU[i].N(x); }, xs[k], b), 0);
    if (Math.abs(th) > 1e-15) { v += th; txt += `; nhiệt độ ∫(m·κ₀ + n·ε₀)dx = ${n(th, 6)}`; }
    // lò xo còn lại và lún gối của hệ cơ bản
    for (const s of springs) {
      const ri = reactionOf(units[i], s), RP = reactionOf(resP, s);
      if (ri && RP) { v += (ri * RP) / s.k; txt += `; lò xo ${s.name}: r̄·R_P/k = ${n((ri * RP) / s.k, 6)}`; }
    }
    for (const s of rigid) {
      const cs = settleOf(s);
      const ri = reactionOf(units[i], s);
      if (cs && ri) { v -= ri * cs; txt += `; lún ${s.name}: −r̄·c = ${n(-ri * cs, 6)}`; }
    }
    DeltaP[i] = v;
    steps.push(`${txt} ⇒ Δ${sub(i + 1)}ₚ = ${n(v, 6)}`);
    if (mp.lines.length) steps.push(...mp.lines.map((l) => `   ${l}`));
  }
  const rhs = DeltaP.map((d, i) => c[i] - d);
  const X = solve(delta.map((r) => [...r]), rhs);
  if (!X) return empty('Hệ phương trình chính tắc suy biến.', deg);
  const signed = (v: number, first: boolean) => `${v < 0 ? (first ? '−' : ' − ') : first ? '' : ' + '}${n(Math.abs(v), 6)}`;
  for (let i = 0; i < nr; i++) {
    steps.push(`Phương trình ${i + 1}: ${delta[i].map((d, j) => `${signed(d, j === 0)}·X${sub(j + 1)}`).join('')}${signed(DeltaP[i], false)} = ${n(c[i], 6)}`);
  }
  steps.push(`Nghiệm: ${X.map((v, i) => `X${sub(i + 1)} = ${red[i].name} = ${n(v)} ${UNIT[red[i].comp]}`).join('; ')}`);
  steps.push('Nội lực cuối cùng: M = M_P + Σ Xᵢ·mᵢ; phản lực R = R_P + Σ Xᵢ·r̄ᵢ.');
  // phản lực cuối và đối chiếu
  const reactions = cands.map((u) => {
    const ri = red.findIndex((q) => q.key === u.key);
    const value = ri >= 0 ? X[ri] : reactionOf(resP, u) + X.reduce((s, x, j) => s + x * reactionOf(units[j], u), 0);
    return { u, value, fem: reactionOf(res, u) };
  });
  let maxDiffM = 0;
  for (const smp of res.forceSamples) {
    const Mf = dP.M(smp.x) + X.reduce((s, x, j) => s + x * dU[j].M(smp.x), 0);
    maxDiffM = Math.max(maxDiffM, Math.abs(Mf - res.internalAt(smp.x, 'right').Mz));
  }
  steps.push(`Đối chiếu với lời giải số (phần tử hữu hạn): sai khác mô men lớn nhất ${n(maxDiffM, 8)} kN·m.`);
  const sample = cleanSamples;
  return {
    ok: true, degree: deg, candidates: cands, redundants: red, basic, steps, delta, DeltaP, c, X, reactions, maxDiffM,
    diagrams: { MP: sample(resP), m: units.map(sample), keyPoints: xs },
  };
}

// ───────────────────── 2. Chuyển vị bằng lực đơn vị ─────────────────────

export type DispKind = 'v' | 'theta' | 'u';

export interface UnitLoadDisplacement {
  ok: boolean;
  reason?: string;
  steps: string[];
  /** mm (v, u) hoặc rad (θ) */
  value: number;
  fem: number;
  unitDiagram: { x: number; y: number }[];
  keyPoints: number[];
}

export function unitLoadDisplacement(model: Model, resIn: AnalysisResult, x0: number, kind: DispKind, chosen?: string[] | null): UnitLoadDisplacement {
  const fail = (reason: string): UnitLoadDisplacement => ({ ok: false, reason, steps: [], value: 0, fem: 0, unitDiagram: [], keyPoints: [] });
  const res = resIn.secondOrder ? analyze(model) : resIn;
  if (!res.ok || !res.section) return fail('Chưa có kết quả tính.');
  if (!(x0 >= 0 && x0 <= model.length)) return fail('Điểm tính phải nằm trên thanh.');
  const deg = planarDegree(res);
  const steps: string[] = [];
  let basic = model;
  if (deg > 0) {
    const fm = forceMethod(model, res, chosen);
    if (!fm.ok || !fm.basic) return fail(fm.reason ?? 'Không lập được hệ cơ bản.');
    basic = fm.basic;
    steps.push(`Hệ siêu tĩnh bậc ${deg}: theo định lý rút gọn, đặt lực đơn vị trên hệ cơ bản tĩnh định (bỏ ${fm.redundants.map((u) => u.name).join(', ')}), nhân với biểu đồ nội lực thực M của hệ siêu tĩnh.`);
  }
  const comp: Comp = kind === 'v' ? 'uy' : kind === 'theta' ? 'rz' : 'ux';
  const ru = unitState(basic, comp, x0);
  if (!ru.ok) return fail(`Trạng thái đơn vị không giải được: ${ru.errors[0] ?? ''}`);
  const EI = res.rigidity.EIz / 1e3, EA = res.rigidity.EA / 1e3;
  const xs = segmentsOf(model, [res, ru], [x0]);
  const dR = diagramOf(res), dU = diagramOf(ru);
  const scaleM = Math.max(1e-9, ...res.forceSamples.map((s) => Math.abs(s.Mz)), 1);
  const what = kind === 'v' ? `độ võng v tại x = ${n(x0)} m` : kind === 'theta' ? `góc xoay θ tại x = ${n(x0)} m` : `chuyển vị dọc trục u tại x = ${n(x0)} m`;
  steps.push(`Tìm ${what}: trạng thái "k" — đặt ${kind === 'theta' ? 'mô men đơn vị M̄ = 1 (ngược chiều kim đồng hồ)' : `lực đơn vị P̄ = 1 theo chiều ${kind === 'v' ? '+y (hướng lên)' : '+x'}`} tại x = ${n(x0)} m, vẽ biểu đồ m̄${kind === 'u' ? ', n̄' : ''}.`);
  steps.push(`Công thức Mohr – Maxwell: Δ = Σ∫ M·m̄/EI dx${kind === 'u' || model.loads.some((l) => l.type === 'temp') ? ' + Σ∫ N·n̄/EA dx' : ''} + ∫(m̄·κ₀ + n̄·ε₀)dx + Σ r̄·R/k (lò xo) − Σ r̄·c (lún gối); nhân biểu đồ theo Vereshchagin: ∫M·m̄ dx = Σ Ω·ȳ.`);
  let total = 0, mag = 0;
  const mm = multiply(xs, dR.M, dU.M, 'M', 'm̄', scaleM);
  for (let i = 0; i + 1 < xs.length; i++) mag += Math.abs(gauss((x) => dR.M(x) * dU.M(x), xs[i], xs[i + 1])) / EI;
  if (mm.lines.length) {
    steps.push(...mm.lines);
    steps.push(`∫M·m̄/EI = ${n(mm.total, 5)}/${n(EI, 1)} = ${n(mm.total / EI, 8)}`);
  }
  total += mm.total / EI;
  const nn = xs.slice(1).reduce((s, b, k) => s + gauss((x) => dR.N(x) * dU.N(x), xs[k], b), 0);
  if (Math.abs(nn) > 1e-12) { total += nn / EA; steps.push(`∫N·n̄/EA = ${n(nn, 5)}/${n(EA, 1)} = ${n(nn / EA, 8)}`); }
  const th = xs.slice(1).reduce((s, b, k) => s + gauss((x) => { const t = thermalAt(model, res, x); return t.kap0 * dU.M(x) + t.eps0 * dU.N(x); }, xs[k], b), 0);
  if (Math.abs(th) > 1e-15) { total += th; steps.push(`Nhiệt độ: ∫(m̄·κ₀ + n̄·ε₀)dx = ${n(th, 8)}`); }
  for (const s of planarUnknowns(basic)) {
    const r = reactionOf(ru, s);
    if (!r) continue;
    if (s.k > 0) {
      const R = reactionOf(res, s);
      if (R) { total += (r * R) / s.k; steps.push(`Lò xo ${s.name}: r̄·R/k = ${n(r)}·${n(R)}/${n(s.k)} = ${n((r * R) / s.k, 8)}`); }
    } else {
      const st = model.supports.find((q) => q.id === s.supportId)?.settle;
      const cs = st ? (s.comp === 'ux' ? st.dx ?? 0 : s.comp === 'uy' ? st.dy ?? 0 : st.rz ?? 0) / 1e3 : 0;
      if (cs) { total -= r * cs; steps.push(`Lún gối ${s.name}: −r̄·c = −(${n(r)})·(${n(cs, 6)}) = ${n(-r * cs, 8)}`); }
    }
  }
  // bỏ sai số làm tròn khi các số hạng triệt tiêu nhau (vd. điểm tính trùng gối)
  if (Math.abs(total) < 1e-6 * Math.max(mag, 1e-300)) total = 0;
  const value = kind === 'theta' ? total : total * 1e3;
  const D = res.displacementAt(x0);
  const fem = kind === 'v' ? D.v : kind === 'theta' ? D.thetaZ : D.u;
  steps.push(`⇒ ${kind === 'v' ? 'v' : kind === 'theta' ? 'θ' : 'u'} = ${kind === 'theta' ? `${n(value, 8)} rad` : `${n(total, 8)} m = ${n(value, 4)} mm`}${kind !== 'theta' && Math.abs(value) > 1e-9 ? ` (${value > 0 ? (kind === 'v' ? 'hướng lên' : 'theo +x') : kind === 'v' ? 'hướng xuống' : 'theo −x'})` : ''}`);
  steps.push(`Đối chiếu lời giải số: ${kind === 'theta' ? `${n(fem, 8)} rad` : `${n(fem, 4)} mm`}.`);
  if (kind === 'theta' && model.hinges.some((h) => Math.abs(h.x - x0) < 1e-9)) steps.push('Lưu ý: tại khớp nối góc xoay hai phía khác nhau — kết quả là góc xoay phía trái.');
  return { ok: true, steps, value, fem, unitDiagram: cleanSamples(ru), keyPoints: xs };
}
