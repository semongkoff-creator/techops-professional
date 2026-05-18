import { useState } from "react";
import type { Report, Task } from "../types";
import type { User } from "../types";
import type { Page } from "../types/app";
import { ASSET_BASE } from "../services/api";

export function DashboardPage({ isDesktop, user, summary, pushHealth, tasks, reports, technicians, onlineTechIds, onJump }: { isDesktop: boolean; user: User; summary: { taskStats: Array<{ status: string; total: number }>; reportStats: Array<{ report_status: string; total: number }> } | null; pushHealth: { summary: { total_users: number; token_active: number; token_missing: number; last_failed: number }; items: Array<{ id: number; name: string; username: string; role: string; token_status: "active" | "missing"; last_audit_action?: string | null }> } | null; tasks: Task[]; reports: Report[]; technicians: User[]; onlineTechIds: number[]; onJump: (p: Page) => void; }) {
  const [showPushDetails, setShowPushDetails] = useState(false);
  const openTask = tasks.filter((t) => !["closed", "completed"].includes(t.status)).length;
  const avgProgress = tasks.length ? Math.round(tasks.reduce((a, b) => a + b.completion_percent, 0) / tasks.length) : 0;
  const formatDate = (v: string) => (v ? new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" }) : "-");
  const activeTasks = tasks.filter((t) => ["assigned_to_technician", "in_progress"].includes(t.status)).slice(0, 2);
  const isMonitoringRole = user.role === "supervisor" || user.role === "atasan";
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 11 ? "Selamat Pagi!" : hour < 15 ? "Selamat Siang!" : hour < 19 ? "Selamat Sore!" : "Selamat Malam!";
  const todayLabel = now.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (isDesktop) {
    const completedTasks = tasks.filter((t) => t.status === "completed" || t.status === "closed").length;
    const runningTasks = tasks.filter((t) => t.status === "in_progress" || t.status === "assigned_to_technician").length;
    const pendingTasks = tasks.filter((t) => t.status === "draft_to_supervisor").length;
    const weekdayLabels = ["S", "M", "T", "W", "T", "F", "S"];
    const todayIndex = new Date().getDay();
    const dayCounts = new Array(7).fill(0);
    tasks.forEach((t) => {
      const base = t.due_date || "";
      const d = base ? new Date(base) : null;
      if (!d || Number.isNaN(d.getTime())) return;
      dayCounts[d.getDay()] += 1;
    });
    const maxDay = Math.max(1, ...dayCounts);
    const weekBars = dayCounts.map((c) => Math.max(14, Math.round((c / maxDay) * 100)));
    const progressPct = Math.max(0, Math.min(100, avgProgress));
    const firstTechnicians = technicians.slice(0, 4);
    const trendOf = (value: number) => (value > 0 ? "up" : "down");
    const totalTrend = trendOf(tasks.length - completedTasks);
    const endedTrend = trendOf(completedTasks - runningTasks);
    const runningTrend = trendOf(runningTasks - pendingTasks);
    const pendingTrend = trendOf(pendingTasks - completedTasks);
    const openProjectCreator = () => {
      localStorage.setItem("techops-open-create-task", "1");
      onJump("tasks");
    };
    const openImportData = () => onJump("export");

    return (
      <section className="dashboard-pro-shell">
        <div className="dashboard-pro-top">
          <div>
            <h2>Dashboard</h2>
            <p>Plan, prioritize, and accomplish your tasks with ease.</p>
          </div>
          <div className="dashboard-pro-actions">
            <button className="btn btn-primary rounded-pill px-4" onClick={openProjectCreator}>Add Project</button>
            <button className="btn btn-outline-primary rounded-pill px-4" onClick={openImportData}>Export Data</button>
          </div>
        </div>

        <div className="dashboard-kpi-grid">
          <div className="kpi-card kpi-card-primary">
            <h6>Total Projects</h6>
            <strong>{tasks.length}</strong>
            <span className={`kpi-trend ${totalTrend}`}>{totalTrend === "up" ? "↗" : "↘"} Dibanding minggu lalu</span>
          </div>
          <div className="kpi-card">
            <h6>Ended Projects</h6>
            <strong>{completedTasks}</strong>
            <span className={`kpi-trend ${endedTrend}`}>{endedTrend === "up" ? "↗" : "↘"} Dibanding minggu lalu</span>
          </div>
          <div className="kpi-card">
            <h6>Running Projects</h6>
            <strong>{runningTasks}</strong>
            <span className={`kpi-trend ${runningTrend}`}>{runningTrend === "up" ? "↗" : "↘"} Dibanding minggu lalu</span>
          </div>
          <div className="kpi-card">
            <h6>Pending Project</h6>
            <strong>{pendingTasks}</strong>
            <span className={`kpi-trend ${pendingTrend === "up" ? "down" : "up"}`}>{pendingTrend === "up" ? "↘" : "↗"} Dibanding minggu lalu</span>
          </div>
        </div>
        {isMonitoringRole && pushHealth && (
          <div className="card dashboard-pro-card mt-3">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0">Push Token Health</h5>
                <button className="btn btn-sm btn-outline-primary" onClick={() => setShowPushDetails((v) => !v)}>
                  {showPushDetails ? "Hide Details" : "View Details"}
                </button>
              </div>
              <div className="row g-2">
                <div className="col-3"><div className="small text-secondary">Users</div><strong>{pushHealth.summary.total_users}</strong></div>
                <div className="col-3"><div className="small text-secondary">Active</div><strong className="text-success">{pushHealth.summary.token_active}</strong></div>
                <div className="col-3"><div className="small text-secondary">Missing</div><strong className="text-warning">{pushHealth.summary.token_missing}</strong></div>
                <div className="col-3"><div className="small text-secondary">Failed</div><strong className="text-danger">{pushHealth.summary.last_failed}</strong></div>
              </div>
              {showPushDetails && (
                <div className="table-wrap mt-3">
                  <table className="table table-sm align-middle">
                    <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Last Audit</th></tr></thead>
                    <tbody>
                      {pushHealth.items
                        .filter((i) => i.token_status === "missing" || i.last_audit_action === "push_token_update_failed")
                        .slice(0, 12)
                        .map((i) => (
                          <tr key={i.id}>
                            <td>{i.name} <span className="text-secondary small">(@{i.username})</span></td>
                            <td>{i.role}</td>
                            <td>{i.token_status === "missing" ? <span className="badge text-bg-warning">missing</span> : <span className="badge text-bg-success">active</span>}</td>
                            <td>{i.last_audit_action || "-"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="dashboard-pro-grid">
          <div className="card dashboard-pro-card">
            <div className="card-body">
              <h5>Project Analytics</h5>
              <div className="dashboard-bars dashboard-bars-clarified">
                {weekBars.map((v, i) => (
                  <div key={i} className="dashboard-bar-item clarified" title={`${weekdayLabels[i]}: ${dayCounts[i]} task`}>
                    <span className="bar-value">{dayCounts[i]}</span>
                    <div className={i === todayIndex ? "dashboard-bar active" : "dashboard-bar"} style={{ height: `${v}%` }} />
                    <span>{weekdayLabels[i]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card dashboard-pro-card">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="mb-0">Project</h5>
                <button className="btn btn-sm btn-outline-primary rounded-pill" onClick={openProjectCreator}>+ New</button>
              </div>
              <div className="d-grid gap-2">
                {tasks.slice(0, 4).map((t) => (
                  <div key={t.id} className="project-line">
                    <strong>{t.title}</strong>
                    <span>{formatDate(t.due_date || "")}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card dashboard-pro-card">
            <div className="card-body">
              <h5>Team Collaboration</h5>
              <div className="d-grid gap-2">
                {firstTechnicians.map((te) => (
                  <div key={te.id} className="team-line team-hover-card">
                    <div className="team-avatar-wrap">
                      {te.avatar_url ? <img className="avatar team-avatar" src={te.avatar_url.startsWith("http") ? te.avatar_url : `${ASSET_BASE}${te.avatar_url}`} alt={te.name} /> : <div className="avatar fallback team-avatar">{te.name.slice(0, 1).toUpperCase()}</div>}
                      <span className={`team-status-dot ${onlineTechIds.includes(te.id) ? "online" : "offline"}`} />
                    </div>
                    <div className="team-meta">
                      <strong>{te.name}</strong>
                      <p>{te.role}</p>
                    </div>
                    <div className="team-hover-panel">
                      <strong>{te.name}</strong>
                      <p>{te.role}</p>
                      <p>{te.email || "-"}</p>
                      <p>Task Aktif: {tasks.filter((t) => t.technician_id === te.id && ["assigned_to_technician", "in_progress"].includes(t.status)).length}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card dashboard-pro-card">
            <div className="card-body">
              <h5>Project Progress</h5>
              <div className="progress-ring" style={{ background: `conic-gradient(#ff7a45 0 ${progressPct}%, #d8e2f7 ${progressPct}% 100%)` }}>
                <div className="progress-ring-hole">
                  <strong>{progressPct}%</strong>
                  <span>Project Ended</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (isMonitoringRole) {
    const activeTechs = technicians.filter((t) => tasks.some((task) => task.technician_id === t.id && ["assigned_to_technician", "in_progress"].includes(task.status)));
    const idleTechs = technicians.filter((t) => !activeTechs.some((at) => at.id === t.id));
    const technicianCards = [...activeTechs, ...idleTechs].slice(0, 4);
    return (
      <section className="d-grid gap-3 mobile-dash monitoring-dash">
        <div className="monitoring-head">
          <span className="live-dot" /> LIVE MONITORING
          <span className="refresh-note">PULL TO REFRESH</span>
        </div>
        <div className="card">
          <div className="card-body py-2">
            <input className="form-control" placeholder="Search technicians, tasks, or IDs..." />
          </div>
        </div>
        <div className="row g-2">
          <div className="col-6"><div className="card"><div className="card-body py-3"><div className="mobile-kpi-label">Total Techs</div><strong className="kpi-main">{technicians.length}</strong></div></div></div>
          <div className="col-6"><div className="card"><div className="card-body py-3"><div className="mobile-kpi-label">Active</div><strong className="kpi-main text-success">{activeTechs.length}</strong></div></div></div>
          <div className="col-6"><div className="card"><div className="card-body py-3"><div className="mobile-kpi-label">Idle</div><strong className="kpi-main text-secondary">{idleTechs.length}</strong></div></div></div>
          <div className="col-6"><div className="card"><div className="card-body py-3"><div className="mobile-kpi-label">Incidents</div><strong className="kpi-main text-danger">{tasks.filter((t) => t.priority === "high" && t.status !== "completed").length}</strong></div></div></div>
        </div>
        <div className="d-flex justify-content-between align-items-center px-1">
          <h6 className="mb-0">Technicians</h6>
          <span className="badge rounded-pill text-bg-light">{technicians.length}</span>
        </div>
        {technicianCards.map((tech) => {
          const task = tasks.find((t) => t.technician_id === tech.id && ["assigned_to_technician", "in_progress"].includes(t.status));
          const progress = task?.completion_percent ?? 0;
          const isActive = Boolean(task);
          return (
            <div className="card tech-card" key={tech.id}>
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-start">
                  <div>
                    <strong>{tech.name}</strong>
                    <span className={`badge ms-2 ${isActive ? "text-success bg-success-subtle" : "text-secondary bg-secondary-subtle"}`}>{isActive ? "AKTIF" : "IDLE"}</span>
                    <div className="text-secondary">{tech.role === "supervisor" ? "Lead Eng." : "Technician"}</div>
                  </div>
                </div>
                <div className="mt-2 small">Task: <strong>{task?.title ?? "Standby"}</strong> <span className="float-end">{progress}%</span></div>
                <div className="progress mt-2" style={{ height: "8px" }}><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
              </div>
            </div>
          );
        })}
        <div className="card">
          <div className="card-body">
            <h6 className="mb-2">Aksi Cepat</h6>
            <div className="d-flex gap-2">
              <button className="btn btn-primary" onClick={() => onJump("export")}>Export Laporan</button>
              <button className="btn btn-outline-primary" onClick={() => onJump("profile")}>Buka Profil</button>
            </div>
          </div>
        </div>
        {pushHealth && (
          <div className="card">
            <div className="card-body">
              <h6 className="mb-2">Push Token Health</h6>
              <div className="row g-2">
                <div className="col-3"><small className="text-secondary">Users</small><div><strong>{pushHealth.summary.total_users}</strong></div></div>
                <div className="col-3"><small className="text-secondary">Active</small><div><strong className="text-success">{pushHealth.summary.token_active}</strong></div></div>
                <div className="col-3"><small className="text-secondary">Missing</small><div><strong className="text-warning">{pushHealth.summary.token_missing}</strong></div></div>
                <div className="col-3"><small className="text-secondary">Failed</small><div><strong className="text-danger">{pushHealth.summary.last_failed}</strong></div></div>
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="d-grid gap-3 mobile-dash">
      <div className="card mobile-hero">
        <div className="card-body">
          <h5 className="mb-1">{greeting}</h5>
          <p className="mb-0 text-capitalize">{todayLabel}</p>
        </div>
      </div>

      <div className="row g-2">
        <div className="col-6">
          <div className="card"><div className="card-body py-3"><div className="mobile-kpi-label">TUGAS HARI INI</div><strong>{openTask} item</strong></div></div>
        </div>
        <div className="col-6">
          <div className="card"><div className="card-body py-3"><div className="mobile-kpi-label">SELESAI</div><strong>{tasks.filter((t) => t.status === "completed").length} item</strong></div></div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between mb-2"><span>Penyelesaian Tugas</span><strong>{avgProgress}%</strong></div>
          <div className="progress" style={{ height: "10px" }}><div className="progress-bar" style={{ width: `${avgProgress}%` }} /></div>
        </div>
      </div>

      <div className="d-flex justify-content-between align-items-center px-1">
        <h6 className="mb-0">Tugas Aktif</h6>
        <button className="btn btn-link p-0" onClick={() => onJump("tasks")}>Lihat Semua</button>
      </div>

      {activeTasks.map((task) => (
        <div className={`card mobile-task-card ${task.priority}`} key={task.id}>
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-start mb-2">
              <strong>{task.title}</strong>
              <span className={`badge text-uppercase ${task.priority === "high" ? "text-danger bg-danger-subtle" : task.priority === "medium" ? "text-warning bg-warning-subtle" : "text-success bg-success-subtle"}`}>{task.priority}</span>
            </div>
            <p className="mb-3 text-secondary">{task.location}</p>
            <button className="btn btn-primary w-100 rounded-pill" onClick={() => onJump("tasks")}>Mulai Kerjakan</button>
          </div>
        </div>
      ))}

      <div className="card"><div className="card-body"><h5>Aksi Cepat</h5><div className="d-flex gap-2"><button className="btn btn-primary" onClick={() => onJump("tasks")}>Buka Tugas</button><button className="btn btn-outline-primary" onClick={() => onJump("reports")}>Isi Laporan</button></div><p className="mb-0 mt-2 text-secondary small">Laporan masuk: {reports.length}</p></div></div>
    </section>
  );
}
