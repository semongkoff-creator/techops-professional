import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import type { Report, Task, User } from "../types";

type FancyOption = { value: string; label: string };

function FancySelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: FancyOption[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((o) => o.value === value) || options[0];

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div className="fancy-select" ref={rootRef}>
      <button type="button" className="fancy-select-trigger" onClick={() => setOpen((v) => !v)}>
        <span>{selected?.label}</span>
        <span className="fancy-caret">▾</span>
      </button>
      {open && (
        <div className="fancy-select-menu">
          {options.map((opt) => (
            <button
              type="button"
              key={opt.value}
              className={opt.value === value ? "active" : ""}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DatePickerField({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<Date>(() => {
    if (!value) return new Date();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  });
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = value ? new Date(value) : null;
  const monthStart = new Date(view.getFullYear(), view.getMonth(), 1);
  const monthEnd = new Date(view.getFullYear(), view.getMonth() + 1, 0);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const total = startOffset + monthEnd.getDate();
  const rows = Math.ceil(total / 7) * 7;
  const monthName = view.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const label = value
    ? new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
    : placeholder;

  const pickDay = (day: number) => {
    const y = view.getFullYear();
    const m = view.getMonth() + 1;
    const mm = String(m).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${y}-${mm}-${dd}`);
    setOpen(false);
  };

  return (
    <div className="fancy-date" ref={rootRef}>
      <button type="button" className="fancy-select-trigger" onClick={() => setOpen((v) => !v)}>
        <span className={value ? "" : "date-placeholder"}>{label}</span>
        <span className="fancy-caret">▾</span>
      </button>
      {open && (
        <div className="fancy-date-menu">
          <div className="fancy-date-head">
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>‹</button>
            <strong>{monthName}</strong>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>›</button>
          </div>
          <div className="fancy-date-week">
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => <span key={d}>{d}</span>)}
          </div>
          <div className="fancy-date-grid">
            {Array.from({ length: rows }).map((_, i) => {
              const day = i - startOffset + 1;
              if (day < 1 || day > monthEnd.getDate()) return <span key={i} className="muted"> </span>;
              const isActive = !!selected && selected.getFullYear() === view.getFullYear() && selected.getMonth() === view.getMonth() && selected.getDate() === day;
              return <button type="button" key={i} className={isActive ? "active" : ""} onClick={() => pickDay(day)}>{day}</button>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportsPage({ isDesktop, user, reports, tasks, supervisors, onDone }: { isDesktop: boolean; user: User; reports: Report[]; tasks: Task[]; supervisors: User[]; onDone: () => Promise<void>; }) {
  const canCreateReport = user.role === "teknisi";
  const [form, setForm] = useState({ task_id: "", report_date: "", supervisor_id: "", progress_percent: "0", issue_text: "", summary_text: "" });
  const prettyReportStatus = (status: string) => {
    if (status === "submitted_by_technician") return "Masuk dari Teknisi";
    if (status === "reviewed_by_supervisor") return "Siap Dikirim ke Atasan";
    if (status === "forwarded_to_atasan") return "Sudah Dikirim ke Atasan";
    if (status === "approved_by_atasan") return "Disetujui Atasan";
    if (status === "needs_revision") return "Perlu Revisi";
    return status;
  };

  const actions = (r: Report) => <div className="d-flex gap-2 flex-wrap">{user.role === "supervisor" && <><button className="btn btn-sm btn-outline-primary" onClick={async () => { await api.reviewReport(r.id); await onDone(); }}>Review</button><button className="btn btn-sm btn-primary" onClick={async () => { await api.forwardReport(r.id); await onDone(); }}>Kirim ke Atasan</button></>}{user.role === "atasan" && <><button className="btn btn-sm btn-success" onClick={async () => { await api.approveReport(r.id); await onDone(); }}>Approve</button><button className="btn btn-sm btn-outline-danger" onClick={async () => { await api.revisionReport(r.id); await onDone(); }}>Revisi</button></>}</div>;
  const emptyState = (
    <div className="card report-empty-card">
      <div className="card-body">
        <h6 className="mb-1">{user.role === "supervisor" ? "Belum ada laporan dari teknisi" : user.role === "atasan" ? "Belum ada laporan yang dikirim supervisor" : "Belum ada laporan"}</h6>
        <p className="mb-0 text-secondary">{user.role === "supervisor" ? "Laporan teknisi akan muncul di sini untuk direview dan dikirim ke atasan." : "Data laporan akan muncul setelah ada pengiriman."}</p>
      </div>
    </div>
  );

  return <section className="d-grid gap-3">{canCreateReport && <form className="card report-card"><div className="card-body task-form report-form d-grid gap-2"><h5 className="mb-0">{isDesktop ? "Submission Panel" : "Laporan Harian"}</h5><label className="task-label">Tanggal Laporan</label><DatePickerField value={form.report_date} onChange={(v) => setForm({ ...form, report_date: v })} placeholder="dd/mm/yyyy" /><label className="task-label">Task Harian</label><FancySelect value={form.task_id} onChange={(v) => setForm({ ...form, task_id: v })} options={[{ value: "", label: "Pilih Task Harian" }, ...tasks.map((t) => ({ value: String(t.id), label: `${t.code} - ${t.title}` }))]} /><label className="task-label">Kirim Ke</label><FancySelect value={form.supervisor_id} onChange={(v) => setForm({ ...form, supervisor_id: v })} options={[{ value: "", label: "Pilih Supervisor" }, ...supervisors.map((s) => ({ value: String(s.id), label: s.name }))]} /><label className="task-label">Progress</label><FancySelect value={form.progress_percent} onChange={(v) => setForm({ ...form, progress_percent: v })} options={[{ value: "0", label: "Belum Mulai" }, { value: "50", label: "Sedang Berjalan" }, { value: "100", label: "Selesai" }]} /><label className="task-label">Kendala</label><textarea className="form-control" rows={3} placeholder="Contoh: Menunggu akses ruangan / material belum datang" value={form.issue_text} onChange={(e) => setForm({ ...form, issue_text: e.target.value })} /><label className="task-label">Ringkasan</label><textarea className="form-control" rows={3} placeholder="Ringkasan pekerjaan hari ini" value={form.summary_text} onChange={(e) => setForm({ ...form, summary_text: e.target.value })} /><p className="task-help">Laporan akan dikirim ke supervisor yang dipilih.</p><button className="btn btn-primary" type="button" onClick={async () => { await api.createReport({ ...form, task_id: Number(form.task_id), supervisor_id: Number(form.supervisor_id), progress_percent: Number(form.progress_percent) }); await onDone(); }}>Kirim</button></div></form>}
  {isDesktop
    ? <div className="card"><div className="card-body"><h5>{user.role === "supervisor" ? "Queue Laporan Teknisi" : "Queue Laporan"}</h5>{reports.length === 0 ? <p className="mb-0 text-secondary">{user.role === "supervisor" ? "Belum ada laporan teknisi untuk dikirim ke atasan." : "Belum ada data laporan."}</p> : reports.map((r) => <div key={r.id} className="item-row"><div><b>{r.task_code || `Task #${r.task_id}`}</b><p className="mb-2">{r.summary_text}</p><span className="badge text-bg-light border">{prettyReportStatus(r.report_status)}</span></div>{actions(r)}</div>)}</div></div>
    : <div className="d-grid gap-2">{reports.length === 0 ? emptyState : reports.map((r) => <div key={r.id} className="card"><div className="card-body"><b>{r.task_code || `Task #${r.task_id}`}</b><p className="mb-2">{r.summary_text}</p><span className="badge text-bg-light border">{prettyReportStatus(r.report_status)}</span>{actions(r)}</div></div>)}</div>}
  </section>;
}
