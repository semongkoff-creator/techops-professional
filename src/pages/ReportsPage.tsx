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
    <div className={`fancy-select${open ? " open" : ""}`} ref={rootRef}>
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
    <div className={`fancy-date${open ? " open" : ""}`} ref={rootRef}>
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
  const mekanikOptions = [
    "Haili-Minajul", "Sutrisno", "Angga-Agung", "Ahmad-Edwin", "Ahmad Anshori- Bashori",
    "Heri-Ridwan", "Eko-Degi", "Muhdi-Lutvi", "Asep-Firma", "Jaka. f-Adnan Sodiandi",
    "Dwi Fy-Mahmud", "Bambang -Facru", "Dian-Pardi", "Rahmat I- Cecep Saepul. A",
    "Dwi Prasetyo-Rokimi", "Tono - Hermawan", "Hafidz - Bayu", "Rendi - Dendi", "Sugeng",
  ];
  const isTechnicianRole = user.role === "teknisi" || user.role === "technician";
  const canCreateReport = isTechnicianRole || user.role === "staff";
  const [localHistory, setLocalHistory] = useState<Report[]>([]);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [historyReady, setHistoryReady] = useState(false);
  const historyStorageKey = `techops-report-history-${user.id}`;
  const [form, setForm] = useState({ task_id: "", report_date: "", supervisor_id: "", progress_percent: "0", issue_text: "", summary_text: "" });
  const [mekanikName, setMekanikName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [unitRows, setUnitRows] = useState([{ unit_code: "", hour_meter: "", merk: "", tipe: "", trouble: "", action: "", sparepart: "", hasil: "ON PROGRESS / WAITING SPAREPART / DILANJUT HARI BERIKUTNYA" }]);
  const [submitErr, setSubmitErr] = useState("");
  const [submitMsg, setSubmitMsg] = useState("");
  const [submitBusy, setSubmitBusy] = useState(false);
  const [reviewingReport, setReviewingReport] = useState<Report | null>(null);
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
  const reportIdentity = (r: Report) => `${r.task_id || r.task_code_ref || "-"}|${normDate(r.report_date)}|${(r.summary_text || "").trim().toLowerCase()}|${r.progress_percent ?? 0}|${r.report_status || ""}`;
  const looseIdentity = (r: Report) => `${r.task_id || r.task_code_ref || "-"}|${(r.summary_text || "").trim().toLowerCase()}|${r.progress_percent ?? 0}`;
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
          <button className="btn btn-sm btn-outline-primary" onClick={() => setReviewingReport(r)}>Review</button>
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
        <h6 className="mb-1">{user.role === "supervisor" ? "Belum ada laporan selesai dari teknisi/staff" : canCreateReport ? "Belum ada laporan selesai yang kamu kirim" : (user.role === "staff" || user.role === "atasan") ? "Belum ada laporan selesai yang dikirim supervisor" : "Belum ada laporan selesai"}</h6>
        <p className="mb-0 text-secondary">{user.role === "supervisor" ? "Laporan selesai teknisi/staff akan muncul di sini untuk direview dan dikirim ke atasan." : canCreateReport ? "Kirim laporan selesai, lalu cek statusnya di daftar ini." : "Data laporan akan muncul setelah ada pengiriman."}</p>
      </div>
    </div>
  );

  const addUnitRow = () => {
    setUnitRows((prev) => [...prev, { unit_code: "", hour_meter: "", merk: "", tipe: "", trouble: "", action: "", sparepart: "", hasil: "ON PROGRESS / WAITING SPAREPART / DILANJUT HARI BERIKUTNYA" }]);
  };

  const removeUnitRow = (index: number) => {
    setUnitRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  };

  const updateUnitRow = (
    index: number,
    key: "unit_code" | "hour_meter" | "merk" | "tipe" | "trouble" | "action" | "sparepart" | "hasil",
    value: string,
  ) => {
    setUnitRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const parseUnitRowsFromSummary = (summary: string) => {
    return (summary || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => /^\d+\.\s+Kode Unit:/i.test(line))
      .map((line) => {
        const [head, ...rest] = line.split("|").map((part) => part.trim());
        const unitCode = head.replace(/^\d+\.\s+Kode Unit:\s*/i, "").trim();
        const field = (label: string) => rest.find((part) => part.toLowerCase().startsWith(label.toLowerCase()))?.split(":").slice(1).join(":").trim() || "-";
        return {
          unit_code: unitCode || "-",
          hour_meter: field("Hour Meter"),
          merk: field("Merk"),
          tipe: field("Tipe"),
          trouble: field("Trouble"),
          action: field("Action"),
          sparepart: field("Sparepart"),
          hasil: field("Hasil"),
        };
      });
  };

  const extractMainSummary = (summary: string) => {
    if (!summary) return "-";
    const cutAt = summary.indexOf("Nama Mekanik:");
    if (cutAt <= 0) return summary.trim();
    return summary.slice(0, cutAt).trim();
  };
  const extractTaggedValue = (summary: string, label: string) => {
    const rows = (summary || "").split("\n").map((s) => s.trim());
    const line = rows.find((s) => s.toLowerCase().startsWith(`${label.toLowerCase()}:`));
    if (!line) return "-";
    return line.split(":").slice(1).join(":").trim() || "-";
  };
  const taskDocUrlByReport = (r: Report) => tasks.find((t) => t.id === r.task_id)?.documentation_image_url || "";
  const activeTaskOptions = tasks
    .filter((t) => ["draft_to_supervisor", "assigned_to_technician", "in_progress"].includes(String(t.status || "")))
    .map((t) => ({
      value: String(t.id),
      label: `${t.code} - ${t.customer || "-"} / ${t.location || "-"}`,
    }));

  const normalizeReportDate = (raw: string) => {
    const v = (raw || "").trim().toLowerCase();
    if (!v) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const dmy = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
    if (dmy) {
      const dd = dmy[1].padStart(2, "0");
      const mm = dmy[2].padStart(2, "0");
      const yy = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
      return `${yy}-${mm}-${dd}`;
    }
    const monthMap: Record<string, string> = {
      januari: "01", februari: "02", maret: "03", april: "04", mei: "05", juni: "06",
      juli: "07", agustus: "08", september: "09", oktober: "10", november: "11", desember: "12",
    };
    const indo = v.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
    if (indo && monthMap[indo[2]]) {
      const dd = indo[1].padStart(2, "0");
      return `${indo[3]}-${monthMap[indo[2]]}-${dd}`;
    }
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) {
      const yyyy = String(parsed.getFullYear());
      const mm = String(parsed.getMonth() + 1).padStart(2, "0");
      const dd = String(parsed.getDate()).padStart(2, "0");
      return `${yyyy}-${mm}-${dd}`;
    }
    return "";
  };

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
            <h5 className="mb-0">{isDesktop ? "Submission Panel Laporan Selesai" : "Laporan Selesai"}</h5>
            <label className="task-label">Nama Mekanik</label>
            <FancySelect value={mekanikName} onChange={setMekanikName} options={[{ value: "", label: "Pilih Nama Mekanik" }, ...mekanikOptions.map((v) => ({ value: v, label: v }))]} />
            <label className="task-label">Tanggal Laporan</label>
            <DatePickerField value={form.report_date} onChange={(v) => setForm({ ...form, report_date: v })} placeholder="dd/mm/yyyy" />
            <label className="task-label">Customer / Nama PT</label>
            <input className="form-control" placeholder="Isi nama customer / PT" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <label className="task-label">Kirim Ke</label>
            <FancySelect value={form.supervisor_id} onChange={(v) => setForm({ ...form, supervisor_id: v })} options={[{ value: "", label: "Pilih Supervisor" }, ...supervisors.map((s) => ({ value: String(s.id), label: s.name }))]} />
            <label className="task-label">Task Aktif (Referensi)</label>
            <FancySelect
              value={form.task_id}
              onChange={(v) => setForm({ ...form, task_id: v })}
              options={[{ value: "", label: "Pilih Task Aktif (Opsional)" }, ...activeTaskOptions]}
            />
            <label className="task-label">Detail Unit (Bisa Banyak)</label>
            <div className="d-grid gap-2">
              {unitRows.map((row, index) => (
                <div key={`unit-row-${index}`} className="border rounded p-2 d-grid gap-2">
                  <input
                    className="form-control"
                    placeholder={`Kode Unit #${index + 1}`}
                    value={row.unit_code}
                    onChange={(e) => updateUnitRow(index, "unit_code", e.target.value)}
                  />
                  <input
                    className="form-control"
                    placeholder="Hour Meter"
                    value={row.hour_meter}
                    onChange={(e) => updateUnitRow(index, "hour_meter", e.target.value)}
                  />
                  <input
                    className="form-control"
                    placeholder="Merk"
                    value={row.merk}
                    onChange={(e) => updateUnitRow(index, "merk", e.target.value)}
                  />
                  <input
                    className="form-control"
                    placeholder="Tipe"
                    value={row.tipe}
                    onChange={(e) => updateUnitRow(index, "tipe", e.target.value)}
                  />
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Trouble / Masalah (Wajib isi)"
                    value={row.trouble}
                    onChange={(e) => updateUnitRow(index, "trouble", e.target.value)}
                  />
                  <textarea
                    className="form-control"
                    rows={2}
                    placeholder="Action Pekerjaan / Perbaikan (Wajib isi)"
                    value={row.action}
                    onChange={(e) => updateUnitRow(index, "action", e.target.value)}
                  />
                  <input
                    className="form-control"
                    placeholder="Sparepart yang dibutuhkan (Opsional)"
                    value={row.sparepart}
                    onChange={(e) => updateUnitRow(index, "sparepart", e.target.value)}
                  />
                  <FancySelect
                    value={row.hasil}
                    onChange={(v) => updateUnitRow(index, "hasil", v)}
                    options={[
                      { value: "CLOSED", label: "CLOSED" },
                      { value: "ON PROGRESS / WAITING SPAREPART / DILANJUT HARI BERIKUTNYA", label: "ON PROGRESS / WAITING SPAREPART / DILANJUT HARI BERIKUTNYA" },
                    ]}
                  />
                  <div className="d-flex justify-content-end">
                    <button type="button" className="btn btn-outline-danger btn-sm" disabled={unitRows.length <= 1} onClick={() => removeUnitRow(index)}>Hapus Baris</button>
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-outline-primary btn-sm" onClick={addUnitRow}>+ Tambah Kode Unit</button>
            </div>
            <label className="task-label">Ringkasan</label>
            <textarea className="form-control" rows={3} placeholder="Ringkasan pekerjaan hari ini" value={form.summary_text} onChange={(e) => setForm({ ...form, summary_text: e.target.value })} />
            <p className="task-help">Laporan selesai akan dikirim ke supervisor, lalu task otomatis disinkronkan menjadi selesai.</p>
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
                  if (!form.report_date || !form.supervisor_id || !customerName.trim()) {
                    setSubmitErr("Lengkapi tanggal, customer, dan supervisor dulu.");
                    return;
                  }
                  const normalizedReportDate = normalizeReportDate(form.report_date);
                  if (!normalizedReportDate) {
                    setSubmitErr("Format tanggal belum valid. Pakai format: YYYY-MM-DD, DD/MM/YYYY, atau 9 Mei 2026.");
                    return;
                  }
                  const selectedTaskId = form.task_id ? Number(form.task_id) : null;
                  const selectedTask = selectedTaskId ? tasks.find((t) => t.id === selectedTaskId) : null;
                  const taskCodeRef = selectedTask?.code || "";
                  setSubmitBusy(true);
                  const compactUnitRows = unitRows
                    .map((row, index) => ({
                      no: index + 1,
                      unit_code: row.unit_code.trim(),
                      hour_meter: row.hour_meter.trim(),
                      merk: row.merk.trim(),
                      tipe: row.tipe.trim(),
                      trouble: row.trouble.trim(),
                      action: row.action.trim(),
                      sparepart: row.sparepart.trim(),
                      hasil: row.hasil.trim(),
                    }))
                    .filter((row) => row.unit_code || row.hour_meter || row.merk || row.tipe || row.trouble || row.action || row.sparepart || row.hasil);
                  if (compactUnitRows.some((row) => !row.trouble || !row.action || !row.hasil)) {
                    setSubmitErr("Setiap baris unit wajib isi Trouble, Action, dan Hasil Pekerjaan.");
                    setSubmitBusy(false);
                    return;
                  }
                  const unitSummary = compactUnitRows.length
                    ? `\n\nNama Mekanik: ${mekanikName || "-"}\nCustomer / PT: ${customerName.trim()}\n\nDetail Unit:\n${compactUnitRows.map((row) => `${row.no}. Kode Unit: ${row.unit_code || "-"} | Hour Meter: ${row.hour_meter || "-"} | Merk: ${row.merk || "-"} | Tipe: ${row.tipe || "-"} | Trouble: ${row.trouble || "-"} | Action: ${row.action || "-"} | Sparepart: ${row.sparepart || "-"} | Hasil: ${row.hasil || "-"}`).join("\n")}`
                    : "";
                  const baseSummary = form.summary_text.trim() || `Laporan selesai ${customerName.trim()}`;
                  await api.createReport({
                    ...form,
                    task_id: selectedTaskId,
                    task_code: taskCodeRef,
                    customer_name: customerName.trim(),
                    report_date: normalizedReportDate,
                    supervisor_id: Number(form.supervisor_id),
                    progress_percent: 100,
                    summary_text: `${baseSummary}${unitSummary}`,
                  });
                  const nowId = Date.now();
                  setLocalHistory((prev) => [{
                    id: nowId,
                    task_id: selectedTaskId,
                    task_code_ref: taskCodeRef || null,
                    report_date: normalizedReportDate,
                    progress_percent: 100,
                    issue_text: null,
                    summary_text: `${baseSummary}${unitSummary}`,
                    report_status: "submitted_by_technician",
                    task_code: selectedTask?.code,
                    task_title: selectedTask?.title,
                  }, ...prev]);
                  setSubmitMsg("Laporan selesai berhasil dikirim.");
                  showToast("Laporan selesai berhasil dibuat.");
                  setForm({ task_id: "", report_date: "", supervisor_id: "", progress_percent: "0", issue_text: "", summary_text: "" });
                  setMekanikName("");
                  setCustomerName("");
                  setUnitRows([{ unit_code: "", hour_meter: "", merk: "", tipe: "", trouble: "", action: "", sparepart: "", hasil: "ON PROGRESS / WAITING SPAREPART / DILANJUT HARI BERIKUTNYA" }]);
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
              {submitBusy ? "Mengirim..." : "Kirim Laporan Selesai"}
            </button>
          </div>
        </form>
      )}
      {isDesktop ? (
        <div className="card">
          <div className="card-body">
            <h5>{user.role === "supervisor" ? "Queue Laporan Selesai Teknisi" : canCreateReport ? "Riwayat Laporan Selesai Saya" : "Queue Laporan Selesai"}</h5>
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Task</th>
                    <th>Tanggal</th>
                    <th>Progress</th>
                    <th>Status Laporan</th>
                    <th>Ringkasan</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-secondary">
                        {user.role === "supervisor" ? "Belum ada laporan selesai teknisi untuk dikirim ke atasan." : canCreateReport ? "Belum ada laporan selesai yang kamu kirim." : "Belum ada data laporan."}
                      </td>
                    </tr>
                  ) : reportRows.map((r) => {
                    const unitRows = parseUnitRowsFromSummary(r.summary_text || "");
                    const mainSummary = extractMainSummary(r.summary_text);
                    return (
                      <tr key={r.id}>
                        <td><strong>{r.task_code || r.task_code_ref || tasks.find((t) => t.id === r.task_id)?.code || (r.task_id ? `Task #${r.task_id}` : "Tanpa Task")}</strong></td>
                        <td>{r.report_date ? new Date(r.report_date).toLocaleDateString("id-ID") : "-"}</td>
                        <td>{r.progress_percent ?? 0}%</td>
                        <td><span className="badge text-bg-light border report-status-badge">{prettyReportStatus(r.report_status)}</span></td>
                        <td style={{ minWidth: "380px", maxWidth: "560px" }}>
                          <div style={{ fontWeight: 600, color: "#243a5d", marginBottom: unitRows.length ? "0.35rem" : "0" }}>{mainSummary}</div>
                          {taskDocUrlByReport(r) && (
                            <div style={{ marginBottom: "0.4rem" }}>
                              <a href={taskDocUrlByReport(r)} target="_blank" rel="noreferrer" style={{ textDecoration: "none", fontSize: ".82rem" }}>
                                Lihat Dokumentasi Gambar
                              </a>
                            </div>
                          )}
                          {unitRows.length > 0 && (
                            <div style={{ fontSize: ".85rem", color: "#5b6f90", lineHeight: 1.45 }}>
                              {unitRows.slice(0, 2).map((u, idx) => (
                                <div key={`${r.id}-desktop-unit-${idx}`}>
                                  {idx + 1}. {u.unit_code} | HM {u.hour_meter} | {u.merk} {u.tipe} | {u.hasil}
                                </div>
                              ))}
                              {unitRows.length > 2 && <div>+{unitRows.length - 2} unit lainnya</div>}
                            </div>
                          )}
                        </td>
                        <td>{actions(r)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="d-grid gap-2">
          {reportRows.length === 0
            ? emptyState
            : reportRows.map((r) => (
              <div key={r.id} className="card">
                <div className="card-body report-mobile-item">
                  <b className="report-item-title">{r.task_code || r.task_code_ref || tasks.find((t) => t.id === r.task_id)?.code || (r.task_id ? `Task #${r.task_id}` : "Tanpa Task")}</b>
                  <p className="mb-2 report-item-summary">{extractMainSummary(r.summary_text)}</p>
                  <span className="badge text-bg-light border report-status-badge">{prettyReportStatus(r.report_status)}</span>
                  {expandedId === r.id && (
                    <div className="mt-2 small text-secondary report-detail-box">
                      <div>Tanggal: {r.report_date ? new Date(r.report_date).toLocaleDateString("id-ID") : "-"}</div>
                      <div>Progress: {r.progress_percent ?? 0}%</div>
                      <div>Kendala: {r.issue_text || "-"}</div>
                      {taskDocUrlByReport(r) && (
                        <div className="mt-2">
                          <a href={taskDocUrlByReport(r)} target="_blank" rel="noreferrer" className="text-decoration-none">
                            Lihat Dokumentasi Gambar
                          </a>
                        </div>
                      )}
                      {(() => {
                        const unitRows = parseUnitRowsFromSummary(r.summary_text || "");
                        if (!unitRows.length) return null;
                        return (
                          <div className="mt-2">
                            <strong>Detail Unit</strong>
                            <div className="d-grid gap-1 mt-1">
                              {unitRows.map((row, idx) => (
                                <div key={`${r.id}-unit-${idx}`} className="border rounded p-2 bg-white">
                                  <div><strong>{idx + 1}. {row.unit_code}</strong></div>
                                  <div>HM: {row.hour_meter} | Merk: {row.merk} | Tipe: {row.tipe}</div>
                                  <div>Trouble: {row.trouble}</div>
                                  <div>Action: {row.action}</div>
                                  <div>Hasil: {row.hasil}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {actions(r)}
                </div>
              </div>
            ))}
        </div>
      )}
      {reviewingReport && (
        <div className="task-modal-backdrop" onClick={() => setReviewingReport(null)}>
          <div className="task-modal card" onClick={(e) => e.stopPropagation()}>
            <div className="card-body d-grid gap-2">
              {(() => {
                const unitRowsFromSummary = parseUnitRowsFromSummary(reviewingReport.summary_text || "");
                return (
                  <>
              <h5 className="mb-1">Review Laporan</h5>
              <div><strong>Tanggal:</strong> {reviewingReport.report_date ? new Date(reviewingReport.report_date).toLocaleDateString("id-ID") : "-"}</div>
              <div><strong>Progress:</strong> {reviewingReport.progress_percent ?? 0}%</div>
              <div><strong>Nama Mekanik:</strong> {extractTaggedValue(reviewingReport.summary_text || "", "Nama Mekanik")}</div>
              <div><strong>Customer / PT:</strong> {extractTaggedValue(reviewingReport.summary_text || "", "Customer / PT")}</div>
              {taskDocUrlByReport(reviewingReport) && (
                <>
                  <div><strong>Dokumentasi Gambar:</strong> <a href={taskDocUrlByReport(reviewingReport)} target="_blank" rel="noreferrer">Buka gambar</a></div>
                  <a href={taskDocUrlByReport(reviewingReport)} target="_blank" rel="noreferrer" className="text-decoration-none">
                    <img
                      src={taskDocUrlByReport(reviewingReport)}
                      alt="Dokumentasi"
                      style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "10px", border: "1px solid #dbe3f3" }}
                    />
                  </a>
                </>
              )}
              {unitRowsFromSummary.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-sm table-bordered align-middle mb-1">
                    <thead>
                      <tr>
                        <th>No</th>
                        <th>Kode Unit</th>
                        <th>Hour Meter</th>
                        <th>Merk</th>
                        <th>Tipe</th>
                        <th>Trouble</th>
                        <th>Action</th>
                        <th>Hasil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitRowsFromSummary.map((row, idx) => (
                        <tr key={`${row.unit_code}-${idx}`}>
                          <td>{idx + 1}</td>
                          <td>{row.unit_code}</td>
                          <td>{row.hour_meter}</td>
                          <td>{row.merk}</td>
                          <td>{row.tipe}</td>
                          <td>{row.trouble}</td>
                          <td>{row.action}</td>
                          <td>{row.hasil}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div><strong>Ringkasan:</strong></div>
              <div className="mb-2 p-2 border rounded bg-light" style={{ whiteSpace: "pre-wrap", maxHeight: "180px", overflow: "auto" }}>
                {extractMainSummary(reviewingReport.summary_text || "-")}
              </div>
              <div className="d-flex gap-2 justify-content-end">
                <button type="button" className="btn btn-light" onClick={() => setReviewingReport(null)}>Tutup</button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    await api.reviewReport(reviewingReport.id);
                    await onDone();
                    setReviewingReport(null);
                    showToast("Laporan berhasil direview.");
                  }}
                >
                  Review
                </button>
              </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

