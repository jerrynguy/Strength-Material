import { useEffect, useState, type ReactNode } from 'react';

export function NumField(props: {
  label?: ReactNode;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  title?: string;
  width?: number;
}) {
  const { label, value, onChange, unit, title, width } = props;
  const [text, setText] = useState(String(value));
  useEffect(() => {
    const parsed = parseFloat(text.replace(',', '.'));
    if (parsed !== value) setText(String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const parsed = parseFloat(text.replace(',', '.'));
  const bad = !Number.isFinite(parsed);
  return (
    <label className="field" title={title}>
      {label !== undefined && <span className="field-label">{label}</span>}
      <span className={`field-input${bad ? ' bad' : ''}`} style={width ? { width } : undefined}>
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = parseFloat(e.target.value.replace(',', '.'));
            if (Number.isFinite(v)) onChange(v);
          }}
        />
        {unit && <em>{unit}</em>}
      </span>
    </label>
  );
}

export function TextField(props: { label: string; value: string; onChange: (v: string) => void; width?: number }) {
  return (
    <label className="field">
      <span className="field-label">{props.label}</span>
      <span className="field-input" style={props.width ? { width: props.width } : undefined}>
        <input value={props.value} onChange={(e) => props.onChange(e.target.value)} />
      </span>
    </label>
  );
}

export function Select<T extends string>(props: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="field">
      {props.label && <span className="field-label">{props.label}</span>}
      <span className="field-input">
        <select value={props.value} onChange={(e) => props.onChange(e.target.value as T)}>
          {props.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}

export function Card(props: { title: ReactNode; children: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <section className={`card ${props.className ?? ''}`}>
      <header className="card-head">
        <h2>{props.title}</h2>
        {props.actions && <div className="card-actions">{props.actions}</div>}
      </header>
      <div className="card-body">{props.children}</div>
    </section>
  );
}
