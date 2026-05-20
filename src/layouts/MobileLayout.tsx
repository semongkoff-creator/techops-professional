import { BarChart3, Bell, ClipboardList, FileText, Home, Moon, Sun, UserCircle2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Notification, User } from "../types";
import type { Page, Theme } from "../types/app";
import { Avatar } from "../components/Avatar";

export function MobileLayout({
  user, page, setPage, unread, theme, onToggleTheme, children,
  notifications = [], onReadNotification, onReadAllNotifications, onOpenNotification,
}: {
  user: User;
  page: Page;
  setPage: (p: Page) => void;
  unread: number;
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
  const tabs: Array<{ key: Page; label: string; icon: typeof Home }> = isMonitoringRole
    ? [
      { key: "dashboard", label: "Home", icon: Home },
      { key: "tasks", label: "Monitoring", icon: ClipboardList },
      { key: "reports", label: "Laporan", icon: FileText },
      { key: "analytics", label: "Analytics", icon: BarChart3 },
      { key: "profile", label: "Profil", icon: UserCircle2 },
    ]
    : [
      { key: "dashboard", label: "Home", icon: Home },
      { key: "tasks", label: "Tugas", icon: ClipboardList },
      { key: "reports", label: "Laporan", icon: FileText },
      { key: "profile", label: "Profil", icon: UserCircle2 },
    ];
  return (
    <div className="app-shell mobile-stitch-shell">
      <main className="content pb-5">
        <header className="topbar mobile-stitch-topbar">
          <div className="inline">
            <div className="mobile-brand-wrap">
              <img src="/assets/logo-satria.jpg" alt="Satria Piranti Perkasa" className="mobile-brand-logo" />
              <strong className="mobile-brand">Satria</strong>
            </div>
          </div>
          <div className="inline">
            <button className="bell" onClick={onToggleTheme} aria-label="Toggle theme">{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button>
            <div ref={bellRef} style={{ position: "relative" }}>
              <button className="bell" onClick={() => setBellOpen((v) => !v)} aria-label={`Notifikasi${unread > 0 ? ` ${unread} belum dibaca` : ""}`}>
                <Bell size={18} /> {unread > 0 ? unread : ""}
              </button>
              {bellOpen && (
                <div className="notif-popover mobile">
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
            <Avatar user={user} />
          </div>
        </header>
        {children}
      </main>
      <nav className={`bottom-nav tabs-${tabs.length}`}>
        {tabs.map((t) => {
          const Icon = t.icon;
          return <button key={t.key} className={page === t.key ? "active" : ""} onClick={() => setPage(t.key)}><Icon size={16} /> {t.label}</button>;
        })}
      </nav>
    </div>
  );
}


