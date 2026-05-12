import { BarChart3, Bell, ClipboardList, FileText, Home, Moon, Sun, UserCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import type { User } from "../types";
import type { Page, Theme } from "../types/app";
import { Avatar } from "../components/Avatar";

export function MobileLayout({ user, page, setPage, unread, theme, onToggleTheme, children }: { user: User; page: Page; setPage: (p: Page) => void; unread: number; theme: Theme; onToggleTheme: () => void; children: ReactNode; }) {
  const isMonitoringRole = user.role === "supervisor";
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
            <strong className="mobile-brand">TechOps</strong>
          </div>
          <div className="inline">
            <button className="bell" onClick={onToggleTheme} aria-label="Toggle theme">{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button>
            <button className="bell" onClick={() => setPage("notifications")} aria-label={`Notifikasi${unread > 0 ? ` ${unread} belum dibaca` : ""}`}>
              <Bell size={18} /> {unread > 0 ? unread : ""}
            </button>
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


