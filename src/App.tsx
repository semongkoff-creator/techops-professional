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
import { useIsDesktop } from "./hooks/useIsDesktop";
import { registerNativeBridgeListeners } from "./mobile/flutterBridge";

export default function App() {
  const { user, setUser, loading, login, logout } = useAuth();
  const isDesktopViewport = useIsDesktop();
  const [page, setPage] = useState<Page>("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [supervisors, setSupervisors] = useState<User[]>([]);
  const [technicians, setTechnicians] = useState<User[]>([]);
  const [staffs, setStaffs] = useState<User[]>([]);
  const [atasans, setAtasans] = useState<User[]>([]);
  const [summary, setSummary] = useState<{ taskStats: Array<{ status: string; total: number }>; reportStats: Array<{ report_status: string; total: number }> } | null>(null);
  const [theme, setTheme] = useState<Theme>("light");
  const [markingAllNotifications, setMarkingAllNotifications] = useState(false);
  const [onlineTechIds, setOnlineTechIds] = useState<number[]>([]);
  const [inAppBanner, setInAppBanner] = useState<Notification | null>(null);
  const [lastNotifIdSeen, setLastNotifIdSeen] = useState<number>(0);
  const lastBrowserNotifIdRef = useRef<number>(0);

  const PRESENCE_KEY = "techops-presence-v1";
  const PRESENCE_TTL_MS = 45_000;
  const ensureArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  const normalizeNotifications = (value: unknown): Notification[] =>
    ensureArray<unknown>(value)
      .filter((it): it is Record<string, unknown> => !!it && typeof it === "object")
      .filter((it) => Number.isFinite(Number(it.id)))
      .map((it) => ({
        id: Number(it.id),
        user_id: Number(it.user_id || 0),
        title: String(it.title || ""),
        message: String(it.message || ""),
        type: String(it.type || "general"),
        reference_type: String(it.reference_type || ""),
        reference_id: Number(it.reference_id || 0),
        is_read: (it as { is_read?: unknown }).is_read ?? false,
        created_at: String(it.created_at || new Date().toISOString()),
      })) as Notification[];

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

  async function loadLookupData() {
    if (!user) return;
    const [spv, tek, staffUsers, atasanUsers, allUsers] = await Promise.allSettled([
      api.users("supervisor"),
      api.users("teknisi"),
      api.users("staff"),
      api.users("atasan"),
      api.users(),
    ]);

    const usersFallback = allUsers.status === "fulfilled" ? ensureArray<User>(allUsers.value) : [];
    const supervisorsDataRaw = spv.status === "fulfilled" ? ensureArray<User>(spv.value) : [];
    const supervisorsDataFromApi = supervisorsDataRaw.filter((u) => String(u.role || "").toLowerCase() === "supervisor");
    const supervisorsDataFallback = usersFallback.filter((u) => String(u.role || "").toLowerCase() === "supervisor");
    const supervisorsData = supervisorsDataFromApi.length > 0 ? supervisorsDataFromApi : supervisorsDataFallback;
    const techniciansData = tek.status === "fulfilled"
      ? ensureArray<User>(tek.value)
      : usersFallback.filter((u) => u.role === "teknisi" || u.role === "technician");
    const staffsData = staffUsers.status === "fulfilled"
      ? ensureArray<User>(staffUsers.value)
      : usersFallback.filter((u) => u.role === "staff");
    const atasansData = atasanUsers.status === "fulfilled"
      ? ensureArray<User>(atasanUsers.value)
      : usersFallback.filter((u) => u.role === "atasan");

    setSupervisors(supervisorsData);
    setTechnicians(techniciansData);
    setStaffs(staffsData);
    setAtasans(atasansData);
  }

  async function reloadCore() {
    if (!user) return;
    const [t, r, n, ds] = await Promise.allSettled([
      api.tasks(),
      api.reports(),
      api.notifications(),
      api.dashboardSummary(),
    ]);

    if (t.status === "fulfilled") setTasks(ensureArray<Task>(t.value));
    if (r.status === "fulfilled") setReports(ensureArray<Report>(r.value));
    if (n.status === "fulfilled") setNotifications(normalizeNotifications(n.value));
    if (ds.status === "fulfilled") setSummary(ds.value as { taskStats: Array<{ status: string; total: number }>; reportStats: Array<{ report_status: string; total: number }> });
  }

  async function reload() {
    await Promise.allSettled([reloadCore(), loadLookupData()]);
  }

  useEffect(() => {
    reload().catch(() => undefined);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let busy = false;
    const safeReload = async () => {
      if (busy) return;
      if (document.visibilityState !== "visible") return;
      busy = true;
      try {
        await reloadCore();
      } catch {
        // keep UI stable on intermittent network issues
      } finally {
        busy = false;
      }
    };

    const intervalMs = isDesktopViewport ? 15000 : 8000;
    const timer = window.setInterval(() => {
      void safeReload();
    }, intervalMs);

    const onVisible = () => {
      void safeReload();
    };

    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, isDesktopViewport]);

  useEffect(() => {
    if (!user) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    const timer = window.setTimeout(() => {
      Notification.requestPermission().catch(() => undefined);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (!notifications.length) return;
    const latestUnread = notifications.find((n) => !isRead(n));
    if (!latestUnread) return;
    if (latestUnread.id <= lastBrowserNotifIdRef.current) return;
    lastBrowserNotifIdRef.current = latestUnread.id;
    const systemNotif = new Notification(latestUnread.title || "Notifikasi Baru", {
      body: latestUnread.message || "Ada pembaruan terbaru.",
      tag: `techops-${latestUnread.id}`,
    });
    systemNotif.onclick = () => {
      window.focus();
      void markOneNotificationRead(latestUnread.id);
      openNotificationTarget(latestUnread);
      systemNotif.close();
    };
  }, [notifications, user]);

  useEffect(() => {
    if (!user) return;
    const onPushReceived = (event: Event) => {
      const payload = (event as CustomEvent<any>).detail || {};
      const title = String(payload?.title || payload?.data?.title || "Notifikasi");
      const body = String(payload?.body || payload?.data?.message || "Ada pembaruan terbaru.");
      const synthetic: Notification = {
        id: Date.now(),
        user_id: user.id,
        title,
        message: body,
        type: String(payload?.data?.type || "push"),
        reference_type: String(payload?.data?.reference_type || "task"),
        reference_id: Number(payload?.data?.reference_id || 0),
        is_read: false,
        created_at: new Date().toISOString(),
      } as Notification;
      setInAppBanner(synthetic);
      setTimeout(() => setInAppBanner((prev) => (prev?.id === synthetic.id ? null : prev)), 4500);
      void reload();
    };

    const onPushAction = (event: Event) => {
      const payload = (event as CustomEvent<any>).detail || {};
      const deepLink = String(payload?.notification?.data?.deep_link || payload?.data?.deep_link || "");
      if (deepLink.includes("/reports")) {
        setPage("reports");
      } else if (deepLink.includes("/notifications")) {
        setPage("notifications");
      } else {
        setPage("tasks");
      }
      void reload();
    };

    window.addEventListener("push:received", onPushReceived as EventListener);
    window.addEventListener("push:action", onPushAction as EventListener);
    return () => {
      window.removeEventListener("push:received", onPushReceived as EventListener);
      window.removeEventListener("push:action", onPushAction as EventListener);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unregister = registerNativeBridgeListeners(
      () => {
        // media is handled inside page-level upload flow (TasksPage/ProfilePage).
      },
      (payload) => {
        if (payload?.deep_link) {
          const deepLink = String(payload.deep_link);
          if (deepLink.includes("/tasks")) {
            setPage("tasks");
          } else if (deepLink.includes("/reports")) {
            setPage("reports");
          } else if (deepLink.includes("/notifications")) {
            setPage("notifications");
          } else {
            setPage("dashboard");
          }
        } else {
          setPage("tasks");
        }
        void reload();
      },
    );
    return unregister;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let busy = false;
    const syncNotifications = async () => {
      if (busy) return;
      if (document.visibilityState !== "visible") return;
      busy = true;
      try {
        const n = await api.notifications();
        setNotifications(normalizeNotifications(n));
      } catch {
        // ignore intermittent errors
      } finally {
        busy = false;
      }
    };
    const timer = window.setInterval(() => {
      void syncNotifications();
    }, isDesktopViewport ? 10000 : 4000);
    return () => {
      window.clearInterval(timer);
    };
  }, [user, isDesktopViewport]);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("techops-theme", theme);
  }, [theme]);

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

  const isRead = (n: Notification) => {
    const raw = (n as Notification & { is_read: unknown }).is_read;
    return raw === true || raw === 1 || raw === "1" || raw === "true" || raw === "t";
  };
  const unread = useMemo(() => notifications.filter((n) => !isRead(n)).length, [notifications]);

  useEffect(() => {
    if (!notifications.length) return;
    const latest = notifications[0];
    if (!latest) return;
    if (latest.id <= lastNotifIdSeen) return;
    if (!isRead(latest)) {
      setInAppBanner(latest);
      setTimeout(() => setInAppBanner((prev) => (prev?.id === latest.id ? null : prev)), 4500);
    }
    setLastNotifIdSeen(latest.id);
  }, [notifications]);
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

  function openNotificationTarget(n: Notification) {
    if (n.reference_type === "task") {
      setPage("tasks");
      return;
    }
    if (n.reference_type === "report") {
      setPage("reports");
      return;
    }
    setPage("notifications");
  }

  if (loading) return <div className="center">Loading...</div>;
  if (!user) return <LoginPage onLogin={login} />;
  const isDesktop = isDesktopViewport;

  const content = (() => {
    if (page === "dashboard") return <DashboardPage isDesktop={isDesktop} user={user} summary={summary} tasks={tasks} reports={reports} technicians={technicians} onlineTechIds={onlineTechIds} onJump={setPage} />;
    if (page === "tasks") return <TasksPage isDesktop={isDesktop} user={user} tasks={tasks} supervisors={supervisors} technicians={technicians} staffs={staffs} atasans={atasans} onDone={reload} />;
    if (page === "reports") return <ReportsPage isDesktop={isDesktop} user={user} reports={reports} tasks={tasks} supervisors={supervisors} onDone={reload} />;
    if (page === "analytics") return <AnalyticsPage tasks={tasks} technicians={technicians} />;
    if (page === "export") return <ExportPage technicians={technicians} />;
    if (page === "profile") return <ProfilePage user={user} isDesktop={isDesktop} tasks={tasks} onChanged={async () => { const me = await api.me(); setUser(me as User); }} onOpenNotifications={async () => { setPage("notifications"); }} onLogout={logout} />;
    return <NotificationsPage notifications={notifications} onReadAll={markAllNotificationsRead} onReadOne={markOneNotificationRead} busy={markingAllNotifications} />;
  })();

  const pageContent = (
    <>
      {inAppBanner && (
        <button
          type="button"
          className="inapp-banner"
          onClick={() => {
            void markOneNotificationRead(inAppBanner.id);
            openNotificationTarget(inAppBanner);
            setInAppBanner(null);
          }}
        >
          <strong>{inAppBanner.title}</strong>
          <span>{inAppBanner.message}</span>
        </button>
      )}
      {content}
    </>
  );
  if (isDesktop) return <DesktopLayout user={user} page={page} setPage={setPage} unread={unread} logout={logout} theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} notifications={notifications} onReadNotification={markOneNotificationRead} onReadAllNotifications={markAllNotificationsRead} onOpenNotification={openNotificationTarget}>{pageContent}</DesktopLayout>;
  return <MobileLayout user={user} page={page} setPage={setPage} unread={unread} theme={theme} onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")} notifications={notifications} onReadNotification={markOneNotificationRead} onReadAllNotifications={markAllNotificationsRead} onOpenNotification={openNotificationTarget}>{pageContent}</MobileLayout>;
}

