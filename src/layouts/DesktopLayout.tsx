import { Bell, ChartNoAxesColumn, FileText, LayoutDashboard, LogOut, Moon, Sun, UserCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import type { User } from "../types";
import type { Page, Theme } from "../types/app";
import { Avatar } from "../components/Avatar";

export function DesktopLayout({ user, page, setPage, unread, logout, theme, onToggleTheme, children }: { user: User; page: Page; setPage: (p: Page) => void; unread: number; logout: () => void; theme: Theme; onToggleTheme: () => void; children: ReactNode; }) {
  const isMonitoringRole = user.role === "supervisor";
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
        <div className="brand">TechOps Professional</div>
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
          <div className="topbar-page">{pageTitle}</div>
          <div className="inline">
            <button className="bell" onClick={onToggleTheme} aria-label="Toggle theme">{theme === "light" ? <Moon size={18} /> : <Sun size={18} />}</button>
            <button className="bell" onClick={() => setPage("notifications")}><Bell size={18} /> {unread}</button>
            <div className="inline topbar-user"><Avatar user={user} /></div>
          </div>
        </header>
        {children}
      </main>
      </div>
    </div>
  );
}

