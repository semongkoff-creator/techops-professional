import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { api } from "./services/api";
import type { Notification, Report, Task, User } from "./types";
import type { Page, Theme } from "./types/app";
import { LoginPage } from "./pages/LoginPage";
import { DesktopLayout } from "./layouts/DesktopLayout";
import { MobileLayout } from "./layouts/MobileLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { TasksPage } from "./pages/TasksPage";
import { ReportsPage } from "./pages/ReportsPage";
import { AnalyticsPage, NotificationsPage } from "./pages/SupportPages";
import { ExportPage, ProfilePage } from "./pages/SettingsPages";

export default function App() {
  const { user, setUser, loading, login, logout } = useAuth();
  const [page, setPage] = useState<Page>("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [staffs, setStaffs] = useState<User[]>([]);
  const [summary, setSummary] = useState<{ taskStats: Array<{ status: string; total: number }>; reportStats: Array<{ report_status: string; total: number }> } | null>(null);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("techops-theme") as Theme) || "light");
  const [isWideScreen, setIsWideScreen] = useState<boolean>(() => (typeof window !== "undefined" ? window.innerWidth >= 1024 : true));
  const [markingAllNotifications, setMarkingAllNotifications] = useState(false);
  const [onlineTechIds, setOnlineTechIds] = useState<number[]>([]);
  const seenNotificationIdsRef = useRef<Set<number>>(new Set());
  const initializedNotificationsRef = useRef(false);

  const PRESENCE_KEY = "techops-presence-v1";
  const PRESENCE_TTL_MS = 45_000;

  const readPresence = () => {
    try {
      const raw = localStorage.getItem(PRESENCE_KEY);
      if (!raw) return {} as Record<string, number>;
      const parsed = JSON.parse(raw) as Record<string, number>;
      if (!parsed || typeof parsed !== "object") return {} as Record<string, number>;
      return parsed;
    } catch {
      return {} as Record<string, number>;
    }
  };

  const writePresence = (next: Record<string, number>) => {
    localStorage.setItem(PRESENCE_KEY, JSON.stringify(next));
  };

  const recomputeOnlineTechIds = () => {
    const now = Date.now();
    const presence = readPresence();
    const activeIds = Object.entries(presence)
      .filter(([, ts]) => Number(ts) > 0 && now - Number(ts) <= PRESENCE_TTL_MS)
      .map(([id]) => Number(id))
      .filter((id) => Number.isFinite(id));
    setOnlineTechIds(activeIds);
  };

  async function reload() {
    if (!user) return;
    const [t, r, n, ds, spv, tek, staffUsers, allUsers] = await Promise.allSettled([
      api.tasks(),
      api.reports(),
      api.notifications(),
      api.dashboardSummary(),
      api.users("supervisor"),
      api.users("teknisi"),
      api.users("staff"),
      api.users(),
    ]);

    if (t.status === "fulfilled") setTasks(t.value as Task[]);
    if (r.status === "fulfilled") setReports(r.value as Report[]);
    if (n.status === "fulfilled") setNotifications(n.value as Notification[]);
    if (ds.status === "fulfilled") setSummary(ds.value as { taskStats: Array<{ status: string; total: number }>; reportStats: Array<{ report_status: string; total: number }> });

    const usersFallback = allUsers.status === "fulfilled" ? (allUsers.value as User[]) : [];
    const supervisorsData = spv.status === "fulfilled"
      ? (spv.value as User[])
      : usersFallback.filter((u) => u.role === "supervisor");
    const techniciansData = tek.status === "fulfilled"
      ? (tek.value as User[])
      : usersFallback.filter((u) => u.role === "teknisi" || u.role === "technician");
    const staffsData = staffUsers.status === "fulfilled"
      ? (staffUsers.value as User[])
      : usersFallback.filter((u) => u.role === "staff" || u.role === "atasan");

    setSupervisors(supervisorsData);
    setTechnicians(techniciansData);
    setStaffs(staffsData);
  }

  useEffect(() => {
    reload().catch(() => undefined);
  }, [user]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("techops-theme", theme);
  }, [theme]);

  useEffect(() => {
    const onResize = () => setIsWideScreen(window.innerWidth >= 1024);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    recomputeOnlineTechIds();
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key !== PRESENCE_KEY) return;
      recomputeOnlineTechIds();
    };
    const timer = window.setInterval(recomputeOnlineTechIds, 10_000);
    window.addEventListener("storage", onStorage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    if (!(user.role === "teknisi" || user.role === "technician")) return;

    const beat = () => {
      const presence = readPresence();
      presence[String(user.id)] = Date.now();
      writePresence(presence);
      recomputeOnlineTechIds();
    };
    beat();
    const timer = window.setInterval(beat, 15_000);
    return () => {
      window.clearInterval(timer);
      const presence = readPresence();
      delete presence[String(user.id)];
      writePresence(presence);
      recomputeOnlineTechIds();
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => undefined);
    }
  }, [user]);

  const isRead = (n: Notification) => {
    const raw = (n as Notification & { is_read: unknown }).is_read;
    return raw === true || raw === 1 || raw === "1" || raw === "true" || raw === "t";
  };

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const newUnread = notifications.filter((n) => !isRead(n) && !seenNotificationIdsRef.current.has(n.id));
    if (!initializedNotificationsRef.current) {
      notifications.forEach((n) => seenNotificationIdsRef.current.add(n.id));
      initializedNotificationsRef.current = true;
      return;
    }
    if (Notification.permission === "granted") {
      newUnread.forEach((n) => {
        try {
          new Notification(n.title || "Notifikasi Baru", { body: n.message || "" });
        } catch {
          // ignore browser notification failure
        }
      });
    }
    newUnread.forEach((n) => seenNotificationIdsRef.current.add(n.id));
  }, [notifications]);
  const unread = useMemo(() => notifications.filter((n) => !isRead(n)).length, [notifications]);
  async function markAllNotificationsRead() {
    if (markingAllNotifications) return;
    const unreadIds = notifications.filter((n) => !isRead(n)).map((n) => n.id);
    if (unreadIds.length === 0) return;
    setMarkingAllNotifications(true);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    try {
      try {
        await api.readAllNotifications();
      } catch {
        await Promise.all(unreadIds.map((id) => api.readNotification(id)));
      }
      void reload();
    } catch {
      // keep optimistic state so UX tetap terasa berfungsi
    } finally {
      setMarkingAllNotifications(false);
    }
  }

  async function markOneNotificationRead(id: number) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    try {
      await api.readNotification(id);
    } catch {
      // ignore: UI already updated optimistically
    }
  }

  if (loading) return <div className="center">Loading...</div>;
  if (!user) return <LoginPage onLogin={login} />;
  const isDesktop = isWideScreen;

  const content = (() => {
    if (page === "dashboard") return <DashboardPage isDesktop={isDesktop} user={user} summary={summary} tasks={tasks} reports={reports} technicians={technicians} onlineTechIds={onlineTechIds} onJump={setPage} />;
    if (page === "tasks") return <TasksPage isDesktop={isDesktop} user={user} tasks={tasks} supervisors={supervisors} technicians={technicians} staffs={staffs} onDone={reload} />;
    if (page === "reports") return <ReportsPage isDesktop={isDesktop} user={user} reports={reports} tasks={tasks} supervisors={supervisors} onDone={reload} />;
    if (page === "analytics") return <AnalyticsPage tasks={tasks} />;
    if (page === "export") return <ExportPage technicians={technicians} />;
    if (page === "profile") return <ProfilePage user={user} isDesktop={isDesktop} tasks={tasks} onChanged={async () => { const me = await api.me(); setUser(me as User); }} onOpenNotifications={async () => { setPage("notifications"); }} onLogout={logout} />;
    return <NotificationsPage notifications={notifications} onReadAll={markAllNotificationsRead} onReadOne={markOneNotificationRead} busy={markingAllNotifications} />;
  })();

  if (isDesktop) return <DesktopLayout user={user} page={page} setPage={setPage} unread={unread} logout={logout} theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}>{content}</DesktopLayout>;
  return <MobileLayout user={user} page={page} setPage={setPage} unread={unread} theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}>{content}</MobileLayout>;
}

