import { useMemo } from 'react';
import { computeSection } from '../core/section';
import { STEEL_DENSITY, STEEL_FAMILIES, findProfile } from '../core/steelTables';
import { fmt } from '../core/stress';
import type { SectionSpec } from '../core/types';
import { Select } from './fields';

type CatalogSpec = Extract<SectionSpec, { kind: 'catalog' }>;

export function SteelPicker({ spec, onChange }: { spec: CatalogSpec; onChange: (s: SectionSpec) => void }) {
  const fam = STEEL_FAMILIES.find((f) => f.key === spec.family) ?? STEEL_FAMILIES[0];
  const found = findProfile(spec.family, spec.name);
  return (
    <>
      <div className="row">
        <Select
          label="Họ thép"
          value={fam.key}
          options={STEEL_FAMILIES.map((f) => ({ value: f.key, label: f.label }))}
          onChange={(k) => {
            const f = STEEL_FAMILIES.find((x) => x.key === k)!;
            onChange({ ...spec, family: k, name: f.profiles[Math.min(4, f.profiles.length - 1)].name });
          }}
        />
        <Select
          label="Số hiệu"
          value={found ? spec.name : fam.profiles[0].name}
          options={fam.profiles.map((p) => ({ value: p.name, label: p.name }))}
          onChange={(n) => onChange({ ...spec, name: n })}
        />
        <label className="check" title="Uốn quanh trục yếu">
          <input type="checkbox" checked={spec.rotate} onChange={(e) => onChange({ ...spec, rotate: e.target.checked })} />
          xoay 90°
        </label>
      </div>
      {found && <ProfileInfo spec={spec} />}
      <details>
        <summary>Bảng tra họ {fam.label}</summary>
        <FamilyTable familyKey={fam.key} current={spec.name} onPick={(n) => onChange({ ...spec, name: n })} />
      </details>
    </>
  );
}

function ProfileInfo({ spec }: { spec: CatalogSpec }) {
  const f = findProfile(spec.family, spec.name)!;
  const g = f.profile.geom;
  const sec = computeSection({ ...spec, rotate: false });
  const dims =
    g.type === 'I' ? `h = ${g.h}, b = ${g.b}, t_w = ${g.tw}, t_f = ${g.tf}, r = ${g.r}${g.slope ? `, cánh dốc ${g.slope * 100}%` : ''}`
      : g.type === 'U' ? `h = ${g.h}, b = ${g.b}, t_w = ${g.tw}, t_f = ${g.tf}, r = ${g.r}, cánh dốc ${(g.slope ?? 0) * 100}%`
        : g.type === 'L' ? `b = ${g.b}, t = ${g.t}, r = ${g.r}`
          : g.type === 'CHS' ? `D = ${g.D}, t = ${g.t}`
            : `H = ${g.H}, B = ${g.B}, t = ${g.t}`;
  return (
    <p className="hint">
      {f.family.standard} · {dims} (mm) · khối lượng {fmt((sec.A * 1e-6 * STEEL_DENSITY), 2)} kg/m
      {f.profile.ref && (
        <> · bảng tra: A = {f.profile.ref.A} cm², I<sub>x</sub> = {f.profile.ref.Ix} cm⁴ — tính từ hình học: A = {fmt(sec.A / 100, 2)} cm², I = {fmt(sec.Iz / 1e4, 1)} cm⁴</>
      )}
    </p>
  );
}

function FamilyTable({ familyKey, current, onPick }: { familyKey: string; current: string; onPick: (n: string) => void }) {
  const rows = useMemo(() => {
    const f = STEEL_FAMILIES.find((x) => x.key === familyKey)!;
    return f.profiles.map((p) => {
      const s = computeSection({ kind: 'catalog', family: familyKey, name: p.name, rotate: false });
      const ymax = Math.max(s.yMax, -s.yMin);
      const zmax = Math.max(s.zMax, -s.zMin);
      return {
        name: p.name, A: s.A / 100, mass: s.A * 1e-6 * STEEL_DENSITY, Ix: s.Iz / 1e4, Wx: s.Iz / ymax / 1e3,
        Iy: s.Iy / 1e4, Wy: s.Iy / zmax / 1e3, ix: Math.sqrt(s.Iz / s.A) / 10, iy: Math.sqrt(s.Iy / s.A) / 10,
        Sx: s.firstMomentAboveY(0) / 1e3,
      };
    });
  }, [familyKey]);
  return (
    <div className="table-scroll">
      <table className="grid steel-table">
        <thead>
          <tr>
            <th>Số hiệu</th><th>kg/m</th><th>A cm²</th><th>I<sub>x</sub> cm⁴</th><th>W<sub>x</sub> cm³</th><th>S<sub>x</sub> cm³</th>
            <th>i<sub>x</sub> cm</th><th>I<sub>y</sub> cm⁴</th><th>W<sub>y</sub> cm³</th><th>i<sub>y</sub> cm</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className={r.name === current ? 'sel-row' : ''} onClick={() => onPick(r.name)}>
              <td><b>{r.name}</b></td><td>{fmt(r.mass, 2)}</td><td>{fmt(r.A, 2)}</td><td>{fmt(r.Ix, 1)}</td><td>{fmt(r.Wx, 1)}</td>
              <td>{fmt(r.Sx, 1)}</td><td>{fmt(r.ix, 2)}</td><td>{fmt(r.Iy, 1)}</td><td>{fmt(r.Wy, 1)}</td><td>{fmt(r.iy, 2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hint">Các đặc trưng tính từ hình học (có góc lượn). x là trục ngang (uốn mạnh), y trục đứng. Với thép góc L: trục song song cạnh. Bấm một dòng để chọn.</p>
    </div>
  );
}
