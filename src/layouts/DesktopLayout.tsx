import { Bell, ChartNoAxesColumn, FileText, LayoutDashboard, LogOut, Moon, Sun, UserCircle2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Notification, User } from "../types";
import type { Page, Theme } from "../types/app";
import { Avatar } from "../components/Avatar";

export function DesktopLayout({
  user, page, setPage, unread, logout, theme, onToggleTheme, children,
  notifications = [], onReadNotification, onReadAllNotifications, onOpenNotification,
}: {
  user: User;
  page: Page;
  setPage: (p: Page) => void;
  unread: number;
  logout: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  children: ReactNode;
  notifications?: Notification[];
  onReadNotification?: (id: number) => Promise<void>;
  onReadAllNotifications?: () => Promise<void>;
  onOpenNotification?: (n: Notification) => void;
}) {
  const isMonitoringRole = user.role === "supervisor";
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!bellRef.current) return;
      if (!bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);
  const isRead = (n: Notification) => {
    const raw = (n as Notification & { is_read: unknown }).is_read;
    return raw === true || raw === 1 || raw === "1" || raw === "true" || raw === "t";
  };
  const latestUnread = notifications.filter((n) => !isRead(n)).slice(0, 8);
  const pageTitle =
    page === "dashboard" ? "Dashboard" :
    page === "tasks" ? "Tasks" :
    page === "reports" ? "Reports" :
    page === "analytics" ? "Analytics" :
    page === "export" ? "Export" :
    page === "profile" ? "Profile" : "Notifications";
  const nav = [
    { key: "dashboard" as Page, label: "Dashboard", icon: LayoutDashboard },
    { key: "tasks" as Page, label: "Tasks", icon: FileText },
    { key: "reports" as Page, label: "Reports", icon: FileText },
    { key: "analytics" as Page, label: "Analytics", icon: ChartNoAxesColumn },
    { key: "profile" as Page, label: "Profile", icon: UserCircle2 },
  ];

  return (
    <div className={isMonitoringRole ? "desktop-stage monitoring-desktop-stage" : "desktop-stage"}>
      <div className={isMonitoringRole ? "desktop-shell monitoring-desktop-shell" : "desktop-shell"}>
      <aside className="sidebar">
        <div className="brand brand-with-logo">
          <img src="/assets/logo-satria.jpg" alt="Satria Piranti Perkasa" className="brand-logo" />
          <span>Satria Piranti Perkasa</span>
        </div>
        {nav.map((n) => {
          const Icon = n.icon;
          return (
            <button key={n.key} className={page === n.key ? "navbtn active" : "navbtn"} onClick={() => setPage(n.key)}>
              <Icon size={16} /> {n.label}
            </button>
          );
        })}
        <button className={page === "notifications" ? "navbtn active" : "navbtn"} onClick={() => setPage("notifications")}>
          <Bell size={16} /> Notifikasi {unread > 0 ? `(${unread})` : ""}
        </button>
        <button className="logout" onClick={logout}><LogOut size={16} /> Logout</button>
      </aside>
      <main className="content">
        <header className="topbar topbar-pro">
          <div className="topbar-brand-wrap">
            <img src="/assets/logo-satria.jpg" alt="Satria Piranti Perkasa" className="topbar-brand-logo" />
            <div className="topbar-brand-text">
              <strong>Satria Piranti Perkasa</strong>
              <span>{pageTitle}</span>
            </div>
          </div>
          <div className="inline">
            <button className="bell" onClick={onToggleTheme} aria-label="Toggle theme">{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button>
            <div ref={bellRef} className={`topbar-bell-wrap${bellOpen ? " open" : ""}`}>
              <button className="bell" onClick={() => setBellOpen((v) => !v)}><Bell size={18} /> {unread}</button>
              {bellOpen && (
                <div className="notif-popover">
                  <div className="notif-popover-head">
                    <strong>Notifikasi</strong>
                    <button type="button" className="btn btn-link btn-sm p-0" onClick={() => { void onReadAllNotifications?.(); }}>Mark all</button>
                  </div>
                  <div className="notif-popover-body">
                    {latestUnread.length === 0 ? <div className="small text-secondary">Belum ada notifikasi belum dibaca.</div> : latestUnread.map((n) => (
                      <button
                        type="button"
                        key={n.id}
                        className={`notif-pop-item${isRead(n) ? "" : " unread"}`}
                        onClick={async () => {
                          await onReadNotification?.(n.id);
                          onOpenNotification?.(n);
                          setBellOpen(false);
                        }}
                      >
                        <b>{n.title}</b>
                        <span>{n.message}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-secondary w-100 mt-2" onClick={() => { setPage("notifications"); setBellOpen(false); }}>Lihat Semua</button>
                </div>
              )}
            </div>
            <div className="inline topbar-user"><Avatar user={user} /></div>
          </div>
        </header>
        {children}
      </main>
      </div>
    </div>
  );
}

