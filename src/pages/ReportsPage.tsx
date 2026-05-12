import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import type { Report, Task, User } from "../types";

type FancyOption = { value: string; label: string };

function FancySelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: FancyOption[] }) {
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
        <span className="fancy-caret">v</span>
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

function DatePickerField({ value, onChange, placeholder = "dd/mm/yyyy" }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
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
        <span className="fancy-caret">v</span>
      </button>
      {open && (
        <div className="fancy-date-menu">
          <div className="fancy-date-head">
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}>{"<"}</button>
            <strong>{monthName}</strong>
            <button type="button" onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}>{">"}</button>
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

export function ReportsPage({ isDesktop, user, reports, tasks, supervisors, onDone }: { isDesktop: boolean; user: User; reports: Report[]; tasks: Task[]; supervisors: User[]; onDone: () => Promise<void> }) {
  const isTechnicianRole = user.role === "teknisi" || user.role === "technician";
  const canCreateReport = isTechnicianRole || user.role === "staff";
  const [localHistory, setLocalHistory] = useState<Report[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const historyStorageKey = `techops-report-history-${user.id}`;
  const [form, setForm] = useState({ task_id: "", report_date: "", supervisor_id: "", progress_percent: "0", issue_text: "", summary_text: "" });
  const [submitErr, setSubmitErr] = useState("");
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(historyStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Report[];
        if (Array.isArray(parsed)) setLocalHistory(parsed);
      }
    } catch {
      // ignore invalid local cache
    } finally {
      setHistoryReady(true);
    }
  }, [historyStorageKey]);

  useEffect(() => {
    if (!historyReady) return;
    try {
      localStorage.setItem(historyStorageKey, JSON.stringify(localHistory));
    } catch {
      // ignore localStorage write error
    }
  }, [historyReady, historyStorageKey, localHistory]);

  const prettyReportStatus = (status: string) => {
    if (status === "submitted_by_technician") return "Masuk ke Supervisor";
    if (status === "reviewed_by_supervisor") return "Siap Dikirim ke Atasan";
    if (status === "forwarded_to_atasan") return "Sudah Dikirim ke Atasan";
    if (status === "approved_by_atasan") return "Disetujui Atasan";
    if (status === "needs_revision") return "Perlu Revisi";
    return status;
  };
  const normDate = (d?: string | null) => (d ? String(d).slice(0, 10) : "");
  const reportIdentity = (r: Report) => `${r.task_id}|${normDate(r.report_date)}|${(r.summary_text || "").trim().toLowerCase()}|${r.progress_percent ?? 0}|${r.report_status || ""}`;
  const looseIdentity = (r: Report) => `${r.task_id}|${(r.summary_text || "").trim().toLowerCase()}|${r.progress_percent ?? 0}`;
  const mergedByIdentity = new Map<string, Report>();
  for (const r of localHistory) mergedByIdentity.set(reportIdentity(r), r);
  for (const r of reports) mergedByIdentity.set(reportIdentity(r), r); // server wins
  const reportRows = Array.from(mergedByIdentity.values());

  useEffect(() => {
    if (!reports.length) return;
    const serverLoose = new Set(reports.map((r) => looseIdentity(r)));
    setLocalHistory((prev) => prev.filter((r) => !serverLoose.has(looseIdentity(r))));
  }, [reports]);

  const actions = (r: Report) => (
    <div className="d-flex gap-2 flex-wrap">
      {user.role === "supervisor" && (
        <>
          <button className="btn btn-sm btn-outline-primary" onClick={async () => { await api.reviewReport(r.id); await onDone(); }}>Review</button>
          <button className="btn btn-sm btn-primary" onClick={async () => { await api.forwardReport(r.id); await onDone(); }}>Kirim ke Atasan</button>
        </>
      )}
      {user.role !== "supervisor" && (
        <button className="btn btn-sm btn-outline-secondary" onClick={() => setExpandedId((prev) => prev === r.id ? null : r.id)}>
          {expandedId === r.id ? "Tutup Detail" : "Lihat Detail"}
        </button>
      )}
    </div>
  );

  const emptyState = (
    <div className="card report-empty-card">
      <div className="card-body">
        <h6 className="mb-1">{user.role === "supervisor" ? "Belum ada laporan dari teknisi/staff" : canCreateReport ? "Belum ada laporan yang kamu kirim" : (user.role === "staff" || user.role === "atasan") ? "Belum ada laporan yang dikirim supervisor" : "Belum ada laporan"}</h6>
        <p className="mb-0 text-secondary">{user.role === "supervisor" ? "Laporan teknisi/staff akan muncul di sini untuk direview dan dikirim ke atasan." : canCreateReport ? "Kirim laporan harian, lalu cek statusnya di daftar ini." : "Data laporan akan muncul setelah ada pengiriman."}</p>
      </div>
    </div>
  );

  return (
    <section className="d-grid gap-3">
      {toast && (
        <div
          className={`alert ${toast.type === "success" ? "alert-success" : "alert-danger"} py-2 px-3`}
          style={{ position: "fixed", top: "14px", right: "14px", zIndex: 1200, minWidth: "220px", boxShadow: "0 10px 24px rgba(0,0,0,.2)" }}
        >
          {toast.message}
        </div>
      )}
      {canCreateReport && (
        <form className="card report-card">
          <div className="card-body task-form report-form d-grid gap-2">
            <h5 className="mb-0">{isDesktop ? "Submission Panel" : "Laporan Harian"}</h5>
            <label className="task-label">Tanggal Laporan</label>
            <DatePickerField value={form.report_date} onChange={(v) => setForm({ ...form, report_date: v })} placeholder="dd/mm/yyyy" />
            <label className="task-label">Task Harian</label>
            <FancySelect value={form.task_id} onChange={(v) => setForm({ ...form, task_id: v })} options={[{ value: "", label: "Pilih Task Harian" }, ...tasks.map((t) => ({ value: String(t.id), label: `${t.code} - ${t.title}` }))]} />
            <label className="task-label">Kirim Ke</label>
            <FancySelect value={form.supervisor_id} onChange={(v) => setForm({ ...form, supervisor_id: v })} options={[{ value: "", label: "Pilih Supervisor" }, ...supervisors.map((s) => ({ value: String(s.id), label: s.name }))]} />
            <label className="task-label">Progress</label>
            <FancySelect value={form.progress_percent} onChange={(v) => setForm({ ...form, progress_percent: v })} options={[{ value: "0", label: "Belum Mulai" }, { value: "50", label: "Sedang Berjalan" }, { value: "100", label: "Selesai" }]} />
            <label className="task-label">Kendala</label>
            <textarea className="form-control" rows={3} placeholder="Contoh: Menunggu akses ruangan / material belum datang" value={form.issue_text} onChange={(e) => setForm({ ...form, issue_text: e.target.value })} />
            <label className="task-label">Ringkasan</label>
            <textarea className="form-control" rows={3} placeholder="Ringkasan pekerjaan hari ini" value={form.summary_text} onChange={(e) => setForm({ ...form, summary_text: e.target.value })} />
            <p className="task-help">Laporan akan dikirim ke supervisor yang dipilih.</p>
            {submitErr && <div className="alert alert-danger py-2 mb-0">{submitErr}</div>}
            {submitMsg && <div className="alert alert-success py-2 mb-0">{submitMsg}</div>}
            <button
              className="btn btn-primary"
              disabled={submitBusy}
              type="button"
              onClick={async () => {
                try {
                  setSubmitErr("");
                  setSubmitMsg("");
                  if (!form.report_date || !form.task_id || !form.supervisor_id || !form.summary_text.trim()) {
                    setSubmitErr("Lengkapi tanggal, task, supervisor, dan ringkasan dulu.");
                    return;
                  }
                  setSubmitBusy(true);
                  await api.createReport({
                    ...form,
                    task_id: Number(form.task_id),
                    supervisor_id: Number(form.supervisor_id),
                    progress_percent: Number(form.progress_percent),
                  });
                  const selectedTask = tasks.find((t) => t.id === Number(form.task_id));
                  const nowId = Date.now();
                  setLocalHistory((prev) => [{
                    id: nowId,
                    task_id: Number(form.task_id),
                    report_date: form.report_date,
                    progress_percent: Number(form.progress_percent),
                    issue_text: form.issue_text || null,
                    summary_text: form.summary_text,
                    report_status: "submitted_by_technician",
                    task_code: selectedTask?.code,
                    task_title: selectedTask?.title,
                  }, ...prev]);
                  setSubmitMsg("Laporan berhasil dikirim.");
                  showToast("Laporan berhasil dibuat.");
                  setForm({ task_id: "", report_date: "", supervisor_id: "", progress_percent: "0", issue_text: "", summary_text: "" });
                  await onDone();
                } catch (err) {
                  const msg = (err as Error).message || "Gagal kirim laporan.";
                  setSubmitErr(msg);
                  showToast(msg, "error");
                } finally {
                  setSubmitBusy(false);
                }
              }}
            >
              {submitBusy ? "Mengirim..." : "Kirim"}
            </button>
          </div>
        </form>
      )}
      {isDesktop ? (
        <div className="card">
          <div className="card-body">
            <h5>{user.role === "supervisor" ? "Queue Laporan Teknisi" : canCreateReport ? "Riwayat Laporan Saya" : "Queue Laporan"}</h5>
            {reportRows.length === 0
              ? <p className="mb-0 text-secondary">{user.role === "supervisor" ? "Belum ada laporan teknisi untuk dikirim ke atasan." : canCreateReport ? "Belum ada laporan yang kamu kirim." : "Belum ada data laporan."}</p>
              : reportRows.map((r) => (
                <div key={r.id} className="item-row">
                  <div className="report-item-main">
                    <b className="report-item-title">{r.task_code || tasks.find((t) => t.id === r.task_id)?.code || `Task #${r.task_id}`}</b>
                    <p className="mb-2 report-item-summary">{r.summary_text}</p>
                    <span className="badge text-bg-light border report-status-badge">{prettyReportStatus(r.report_status)}</span>
                    {expandedId === r.id && (
                      <div className="mt-2 small text-secondary report-detail-box">
                        <div>Tanggal: {r.report_date ? new Date(r.report_date).toLocaleDateString("id-ID") : "-"}</div>
                        <div>Progress: {r.progress_percent ?? 0}%</div>
                        <div>Kendala: {r.issue_text || "-"}</div>
                      </div>
                    )}
                  </div>
                  {actions(r)}
                </div>
              ))}
          </div>
        </div>
      ) : (
        <div className="d-grid gap-2">
          {reportRows.length === 0
            ? emptyState
            : reportRows.map((r) => (
              <div key={r.id} className="card">
                <div className="card-body report-mobile-item">
                  <b className="report-item-title">{r.task_code || tasks.find((t) => t.id === r.task_id)?.code || `Task #${r.task_id}`}</b>
                  <p className="mb-2 report-item-summary">{r.summary_text}</p>
                  <span className="badge text-bg-light border report-status-badge">{prettyReportStatus(r.report_status)}</span>
                  {expandedId === r.id && (
                    <div className="mt-2 small text-secondary report-detail-box">
                      <div>Tanggal: {r.report_date ? new Date(r.report_date).toLocaleDateString("id-ID") : "-"}</div>
                      <div>Progress: {r.progress_percent ?? 0}%</div>
                      <div>Kendala: {r.issue_text || "-"}</div>
                    </div>
                  )}
                  {actions(r)}
                </div>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

