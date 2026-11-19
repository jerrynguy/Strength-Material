import type { ReactNode } from 'react';

export function RSection({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="r-sec">
      <h2>{n}. {title}</h2>
      {children}
    </section>
  );
}

export function RSub({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="r-sub">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function RTable({ head, rows, note }: { head: ReactNode[]; rows: ReactNode[][]; note?: ReactNode }) {
  return (
    <div className="r-block">
      <table className="r-table">
        <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
      {note && <p className="r-note">{note}</p>}
    </div>
  );
}

export function RKV({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <table className="r-kv r-block">
      <tbody>{rows.map(([k, v], i) => <tr key={i}><th>{k}</th><td>{v}</td></tr>)}</tbody>
    </table>
  );
}

export function RSteps({ lines }: { lines: ReactNode[] }) {
  if (!lines.length) return null;
  return <ol className="r-steps">{lines.map((l, i) => <li key={i}>{l}</li>)}</ol>;
}

export function RFig({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <figure className="r-fig">
      {children}
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function Verdict({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <span className={ok ? 'r-ok' : 'r-bad'}>{children}</span>;
}

export function RConclusion({ items }: { items: { label: string; ok: boolean | null; detail: ReactNode }[] }) {
  return (
    <table className="r-table r-block r-concl">
      <thead><tr><th>Hạng mục</th><th>Kết quả</th><th>Kết luận</th></tr></thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={i}>
            <td>{it.label}</td>
            <td>{it.detail}</td>
            <td>{it.ok === null ? '—' : <Verdict ok={it.ok}>{it.ok ? 'ĐẠT' : 'KHÔNG ĐẠT'}</Verdict>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface ReportParts {
  inputs: boolean;
  diagrams: boolean;
  stress: boolean;
  stability: boolean;
  steps: boolean;
}

export const PART_LABELS: Record<keyof ReportParts, string> = {
  inputs: 'Dữ liệu đầu vào',
  diagrams: 'Biểu đồ',
  stress: 'Ứng suất tại điểm nguy hiểm',
  stability: 'Kiểm tra ổn định',
  steps: 'Lời giải từng bước',
};
