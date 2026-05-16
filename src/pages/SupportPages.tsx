import { useMemo, useState } from "react";
import type { Notification, Task, User } from "../types";

export function AnalyticsPage({ tasks, technicians }: { tasks: Task[]; technicians: User[] }) {
  const [selectedTechnicianId, setSelectedTechnicianId] = useState("");
  const filteredTasks = useMemo(() => {
    if (!selectedTechnicianId) return tasks;
    const id = Number(selectedTechnicianId);
    if (!Number.isFinite(id)) return tasks;
    return tasks.filter((t) => Number(t.technician_id || 0) === id);
  }, [tasks, selectedTechnicianId]);

  const completed = filteredTasks.filter((t) => t.status === "completed" || t.status === "closed").length;
  const completionRate = filteredTasks.length ? Math.round((completed / filteredTasks.length) * 100) : 0;
  const statusBuckets = [
    { key: "draft_to_supervisor", label: "Draft", color: "#94a3b8" },
    { key: "assigned_to_technician", label: "Assigned", color: "#3b82f6" },
    { key: "in_progress", label: "Progress", color: "#f59e0b" },
    { key: "completed", label: "Done", color: "#22c55e" },
    { key: "closed", label: "Closed", color: "#0f766e" },
  ] as const;
  const statusCounts = statusBuckets.map((b) => ({ ...b, total: filteredTasks.filter((t) => t.status === b.key).length }));
  const maxStatus = Math.max(1, ...statusCounts.map((s) => s.total));

  const priorityBuckets = [
    { key: "high", label: "High", color: "#ef4444" },
    { key: "medium", label: "Medium", color: "#f59e0b" },
    { key: "low", label: "Low", color: "#22c55e" },
  ] as const;
  const priorityCounts = priorityBuckets.map((b) => ({ ...b, total: filteredTasks.filter((t) => t.priority === b.key).length }));
  const priorityTotal = priorityCounts.reduce((acc, cur) => acc + cur.total, 0);
  const [high, medium, low] = priorityCounts.map((p) => p.total);
  const safeTotal = priorityTotal || 1;
  const hPct = (high / safeTotal) * 100;
  const mPct = (medium / safeTotal) * 100;
  const lPct = (low / safeTotal) * 100;

  return <section className="row g-3 analytics-shell">
    <div className="col-12">
      <div className="card analytics-panel">
        <div className="card-body d-flex flex-wrap align-items-center gap-2">
          <strong style={{ color: "#35517f" }}>Filter Mekanik:</strong>
          <select
            className="form-select"
            style={{ maxWidth: 340 }}
            value={selectedTechnicianId}
            onChange={(e) => setSelectedTechnicianId(e.target.value)}
          >
            <option value="">Semua Mekanik</option>
            {technicians.map((te) => (
              <option key={te.id} value={String(te.id)}>
                {te.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
    <div className="col-md-4"><div className="card analytics-kpi"><div className="card-body"><h6>Total Task</h6><h3>{filteredTasks.length}</h3></div></div></div>
    <div className="col-md-4"><div className="card analytics-kpi"><div className="card-body"><h6>Task Selesai</h6><h3>{completed}</h3></div></div></div>
    <div className="col-md-4"><div className="card analytics-kpi analytics-kpi-accent"><div className="card-body"><h6>Completion Rate</h6><h3>{completionRate}%</h3></div></div></div>

    <div className="col-12 col-lg-8">
      <div className="card analytics-panel">
        <div className="card-body">
          <h6 className="mb-3 analytics-title">Status Task Chart</h6>
          <div className="analytics-bars">
            {statusCounts.map((s) => <div key={s.key} className="analytics-bar-row"><div className="analytics-bar-head"><span>{s.label}</span><strong>{s.total}</strong></div><div className="analytics-track"><div className="analytics-fill" style={{ width: `${(s.total / maxStatus) * 100}%`, background: s.color }} /></div></div>)}
          </div>
        </div>
      </div>
    </div>

    <div className="col-12 col-lg-4">
      <div className="card analytics-panel">
        <div className="card-body">
          <h6 className="mb-3 analytics-title">Prioritas Task</h6>
          <div className="analytics-donut-wrap">
            <div className="analytics-donut" style={{ background: `conic-gradient(#ef4444 0 ${hPct}%, #f59e0b ${hPct}% ${hPct + mPct}%, #22c55e ${hPct + mPct}% 100%)` }}>
              <div className="analytics-donut-hole"><strong>{priorityTotal}</strong><span>Total</span></div>
            </div>
            <div className="analytics-legend">
              {priorityCounts.map((p) => <div key={p.key} className="analytics-legend-item"><span className="dot" style={{ background: p.color }} />{p.label}: <strong>{p.total}</strong></div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>;
}

export function NotificationsPage({ notifications, onReadAll, onReadOne, busy = false }: { notifications: Notification[]; onReadAll: () => Promise<void>; onReadOne?: (id: number) => Promise<void>; busy?: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const isRead = (n: Notification) => {
    const raw = (n as Notification & { is_read: unknown }).is_read;
    return raw === true || raw === 1 || raw === "1" || raw === "true" || raw === "t";
  };
  const unreadCount = useMemo(() => notifications.filter((n) => !isRead(n)).length, [notifications]);
  const visible = useMemo(() => (showAll ? notifications : notifications.filter((n) => !isRead(n))), [notifications, showAll]);

  return <section className="card"><div className="card-body"><div className="d-flex justify-content-between align-items-center mb-3"><h5 className="mb-0">Notifikasi</h5><div className="d-flex gap-2"><button className="btn btn-sm btn-outline-secondary" onClick={() => setShowAll((v) => !v)}>{showAll ? "Belum dibaca" : "Lihat semua"}</button><button className="btn btn-sm btn-outline-primary" disabled={busy} onClick={() => { void onReadAll(); }}>{busy ? "Memproses..." : "Mark all read"}</button></div></div>{visible.length === 0 ? <div className="text-secondary small">Tidak ada notifikasi {showAll ? "" : "belum dibaca"}.</div> : visible.map((n) => <div key={n.id} className={isRead(n) ? "notif" : "notif unread"} onClick={() => { if (onReadOne) void onReadOne(n.id); }} role="button" tabIndex={0}><b>{n.title}</b><p className="mb-0">{n.message}</p></div>)}</div></section>;
}
