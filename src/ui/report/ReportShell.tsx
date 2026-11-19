import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FrameModel } from '../../core/frame';
import type { LtbOptions } from '../../core/ltb';
import type { Model } from '../../core/types';
import type { StabModel } from '../stability/StabilityApp';
import { BeamReport } from './BeamReport';
import { FrameReport } from './FrameReport';
import { PART_LABELS, type ReportParts } from './primitives';
import { StabReport } from './StabReport';

export type ReportInput =
  | { mode: 'beam'; model: Model; ltb: LtbOptions }
  | { mode: 'frame'; model: FrameModel }
  | { mode: 'stab'; model: StabModel };

const MODE_LABEL = { beam: 'Thanh thẳng (dầm, trục, cột)', frame: 'Khung phẳng / dầm nghiêng', stab: 'Ổn định thanh chịu nén' };

const PARTS_KEY = 'strength-material:report-parts';

function loadParts(): ReportParts {
  const d: ReportParts = { inputs: true, diagrams: true, stress: true, stability: true, steps: true };
  try {
    const raw = localStorage.getItem(PARTS_KEY);
    if (raw) return { ...d, ...JSON.parse(raw) };
  } catch {
    /* bỏ qua */
  }
  return d;
}

export function ReportShell({ input, onClose }: { input: ReportInput; onClose: () => void }) {
  const [parts, setParts] = useState<ReportParts>(loadParts);
  const [author, setAuthor] = useState('');
  const title = input.model.title || 'Bài toán';
  const today = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

  useEffect(() => {
    try { localStorage.setItem(PARTS_KEY, JSON.stringify(parts)); } catch { /* bỏ qua */ }
  }, [parts]);
  useEffect(() => {
    document.body.classList.add('report-open');
    const prev = document.title;
    // Tên tệp PDF gợi ý khi lưu = tiêu đề trang
    document.title = `Bao cao - ${title}`.replace(/[\\/:*?"<>|]+/g, ' ');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.classList.remove('report-open');
      document.title = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [title, onClose]);

  return createPortal(
    <div className="report-overlay" role="dialog" aria-label="Xem trước báo cáo">
      <div className="report-toolbar">
        <b>Xem trước báo cáo</b>
        <div className="report-parts">
          {(Object.keys(PART_LABELS) as (keyof ReportParts)[]).map((k) => (
            <label key={k} className="check">
              <input type="checkbox" checked={parts[k]} onChange={(e) => setParts({ ...parts, [k]: e.target.checked })} />
              {PART_LABELS[k]}
            </label>
          ))}
          <label className="check">Người lập: <input className="r-author" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="(tuỳ chọn)" /></label>
        </div>
        <div className="report-actions">
          <button className="primary" onClick={() => window.print()}>In / Lưu PDF</button>
          <button onClick={onClose}>Đóng</button>
        </div>
        <p className="report-tip">Trong hộp thoại in, chọn máy in “Lưu dưới dạng PDF” (Save as PDF), khổ A4. Bỏ chọn “Đầu trang và chân trang” để trang gọn hơn.</p>
      </div>
      <article className="report-page">
        <header className="r-head">
          <div className="r-brand">SỨC BỀN VẬT LIỆU — BỘ GIẢI THANH &amp; KHUNG</div>
          <h1>BÁO CÁO TÍNH TOÁN</h1>
          <div className="r-title">{title}</div>
          <table className="r-meta">
            <tbody>
              <tr><th>Loại bài toán</th><td>{MODE_LABEL[input.mode]}</td><th>Ngày lập</th><td>{today}</td></tr>
              <tr><th>Đơn vị</th><td>kN, m, kN·m; mặt cắt mm; ứng suất MPa</td><th>Người lập</th><td>{author || '—'}</td></tr>
            </tbody>
          </table>
        </header>
        {input.mode === 'beam' && <BeamReport model={input.model} parts={parts} ltbOpt={input.ltb} />}
        {input.mode === 'frame' && <FrameReport model={input.model} parts={parts} />}
        {input.mode === 'stab' && <StabReport model={input.model} parts={parts} />}
        <footer className="r-foot">
          Phương pháp: phân tích cấu tạo hình học bằng hạng ma trận; phương pháp ma trận độ cứng; nội lực bằng phương pháp mặt cắt; ứng suất theo
          Navier, Jurapxki, thuyết bền 3/4; ổn định theo Euler/Iasinski/bảng φ, EN 1993-1-1 &amp; 1-5. Quy ước dấu: N &gt; 0 kéo; Q &gt; 0 làm phân tố
          quay thuận chiều kim đồng hồ; M &gt; 0 căng thớ dưới. Kết quả do phần mềm tính — người lập chịu trách nhiệm kiểm tra số liệu đầu vào và
          đối chiếu tiêu chuẩn thiết kế hiện hành.
        </footer>
      </article>
    </div>,
    document.body,
  );
}
