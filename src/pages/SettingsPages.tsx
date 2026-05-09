import { useEffect, useRef, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, KeyRound, LogOut, PencilLine } from "lucide-react";
import type { Task, User } from "../types";
import { api } from "../services/api";
import { Avatar } from "../components/Avatar";

type FancyOption = { value: string; label: string };

function FancySelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: FancyOption[];
}) {
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
        <span>{selected ? selected.label : "-"}</span>
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

function DatePickerField({
  value,
  onChange,
  placeholder = "dd/mm/yyyy",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
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

export function ExportPage({ technicians }: { technicians: User[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [technician, setTechnician] = useState("");
  const [format, setFormat] = useState<"pdf" | "xlsx">("pdf");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    try {
      setLoading(true);
      const query = new URLSearchParams();
      if (from) query.set("from", from);
      if (to) query.set("to", to);
      if (technician) query.set("technician_id", technician);
      query.set("format", format);
      await api.exportData(`?${query.toString()}`, format);
      setResult("File export berhasil diunduh.");
    } catch (err) {
      setResult((err as Error).message || "Gagal export data.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="card"><div className="card-body d-grid gap-2"><h5>Export</h5><DatePickerField value={from} onChange={setFrom} /><DatePickerField value={to} onChange={setTo} /><FancySelect value={technician} onChange={setTechnician} options={[{ value: "", label: "Semua Teknisi" }, ...technicians.map((t) => ({ value: String(t.id), label: t.name }))]} /><FancySelect value={format} onChange={setFormat} options={[{ value: "pdf", label: "PDF" }, { value: "xlsx", label: "XLSX" }]} /><button className="btn btn-primary" disabled={loading} onClick={generate}>{loading ? "Memproses..." : "Generate"}</button>{result && <div className="alert alert-success py-2 mb-0">{result}</div>}</div></section>;
}

export function ProfilePage({ user, isDesktop, onChanged, onOpenNotifications, onLogout, tasks = [] }: { user: User; isDesktop: boolean; onChanged: () => Promise<void>; onOpenNotifications: () => Promise<void>; onLogout: () => void | Promise<void>; tasks?: Task[] }) {
  const phoneKey = `techops-phone-${user.id}`;
  const deptKey = `techops-department-${user.id}`;
  const [editMode, setEditMode] = useState(false);
  const [passwordMode, setPasswordMode] = useState(false);
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email || "");
  const [phone, setPhone] = useState(localStorage.getItem(phoneKey) || localStorage.getItem("techops-phone") || "");
  const [department, setDepartment] = useState(localStorage.getItem(deptKey) || localStorage.getItem("techops-department") || "Field Operations");
  const [avatar, setAvatar] = useState(user.avatar_url || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState("");
  const [avatarErr, setAvatarErr] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);
  useEffect(() => {
    const legacyPhone = localStorage.getItem("techops-phone");
    const legacyDept = localStorage.getItem("techops-department");
    if (legacyPhone && !localStorage.getItem(phoneKey)) {
      localStorage.setItem(phoneKey, legacyPhone);
      setPhone(legacyPhone);
    }
    if (legacyDept && !localStorage.getItem(deptKey)) {
      localStorage.setItem(deptKey, legacyDept);
      setDepartment(legacyDept);
    }
  }, [phoneKey, deptKey]);
  const myTasks = tasks.filter((t) => {
    if (user.role === "supervisor") return t.supervisor_id === user.id;
    if (user.role === "teknisi" || user.role === "technician") return t.technician_id === user.id;
    return true;
  });
  const totalProjects = myTasks.length;
  const tasksCompleted = myTasks.filter((t) => t.status === "completed" || t.status === "closed").length;
  const activeTasks = myTasks.filter((t) => ["assigned_to_technician", "in_progress", "draft_to_supervisor"].includes(t.status)).length;
  if (!editMode && !passwordMode) {
    return <section className={`card profile-shell ${isDesktop ? "profile-shell-desktop" : "profile-shell-mobile"}`}><div className="card-body">
      {isDesktop ? (
        <div className="profile-desktop-grid">
          <div className="profile-desktop-summary">
            <h5 className="mb-3">Profile</h5>
            <input
              id="avatar-file-input"
              className="d-none"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setAvatarErr("");
                setAvatarMsg("");
                try {
                  setAvatarBusy(true);
                  const r = await api.uploadAvatar(file);
                  setAvatar((r as { avatar_url: string }).avatar_url);
                  await onChanged();
                  setAvatarMsg("Avatar berhasil diupload.");
                } catch (err) {
                  setAvatarErr((err as Error).message || "Gagal upload avatar.");
                } finally {
                  setAvatarBusy(false);
                  e.currentTarget.value = "";
                }
              }}
            />
            <div className="profile-head">
              <button type="button" className="profile-avatar-upload-btn" onClick={() => { document.getElementById("avatar-file-input")?.click(); }}>
                <Avatar user={{ ...user, avatar_url: avatar || user.avatar_url }} />
              </button>
              <h4>{user.name}</h4>
              <p className="profile-role-badge">{user.role}</p>
              <small>Bergabung: {new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })}</small>
              <small>Departemen: {department}</small>
            </div>
            <div className="profile-stats-row">
              <div><strong>{totalProjects}</strong><span>Total Projects</span></div>
              <div><strong>{tasksCompleted}</strong><span>Tasks Completed</span></div>
              <div><strong>{activeTasks}</strong><span>Active Tasks</span></div>
            </div>
            <button className="btn btn-primary w-100 mt-2" onClick={() => { void Promise.resolve(onLogout()); }}><LogOut size={16} /> Sign Out</button>
          </div>
          <div>
            <h5 className="mb-3">Pengaturan Akun</h5>
            <div className="profile-menu">
              <button className="profile-menu-item" onClick={() => setEditMode(true)}><span><PencilLine size={16} /> Edit Profile</span><ChevronRight size={16} /></button>
              <button className="profile-menu-item" onClick={onOpenNotifications}><span><Bell size={16} /> Notification</span><ChevronRight size={16} /></button>
              <button className="profile-menu-item" onClick={() => setPasswordMode(true)}><span><KeyRound size={16} /> Change Password</span><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <h5 className="text-center mb-3">Profile</h5>
          <div className="profile-head">
            <Avatar user={{ ...user, avatar_url: avatar || user.avatar_url }} />
            <h4>{user.name}</h4>
            <p>{user.role}</p>
          </div>
          <div className="profile-menu">
            <button className="profile-menu-item" onClick={() => setEditMode(true)}><span><PencilLine size={16} /> Edit Profile</span><ChevronRight size={16} /></button>
            <button className="profile-menu-item" onClick={onOpenNotifications}><span><Bell size={16} /> Notification</span><ChevronRight size={16} /></button>
            <button className="profile-menu-item" onClick={() => setPasswordMode(true)}><span><KeyRound size={16} /> Change Password</span><ChevronRight size={16} /></button>
          </div>
          <button className="btn btn-primary w-100 mt-3" onClick={() => { void Promise.resolve(onLogout()); }}><LogOut size={16} /> Sign Out</button>
        </>
      )}
    </div></section>;
  }

  if (passwordMode) {
    return <section className={`card profile-shell ${isDesktop ? "" : "profile-shell-mobile"}`}><div className="card-body d-grid gap-2">
      <div className="d-flex align-items-center gap-2 mb-1"><button className="btn btn-light btn-sm" onClick={() => setPasswordMode(false)}><ChevronLeft size={16} /></button><h5 className="mb-0">Change Password</h5></div>
      <label className="small text-secondary">Password Lama</label><input className="form-control" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      <label className="small text-secondary">Password Baru</label><input className="form-control" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      <label className="small text-secondary">Konfirmasi Password Baru</label><input className="form-control" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      {pwErr && <div className="alert alert-danger py-2 mb-0">{pwErr}</div>}
      {pwMsg && <div className="alert alert-success py-2 mb-0">{pwMsg}</div>}
      <button className="btn btn-primary" disabled={busy} onClick={async () => {
        setPwErr("");
        setPwMsg("");
        if (!currentPassword || !newPassword || !confirmPassword) {
          setPwErr("Semua field password wajib diisi.");
          return;
        }
        if (newPassword.length < 6) {
          setPwErr("Password baru minimal 6 karakter.");
          return;
        }
        if (newPassword !== confirmPassword) {
          setPwErr("Konfirmasi password tidak sama.");
          return;
        }
        try {
          setBusy(true);
          await api.changePassword({ current_password: currentPassword, new_password: newPassword });
          setPwMsg("Password berhasil diubah.");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        } catch (err) {
          setPwErr((err as Error).message || "Gagal ubah password.");
        } finally {
          setBusy(false);
        }
      }}>{busy ? "Menyimpan..." : "Simpan Password"}</button>
    </div></section>;
  }

  return <section className={`card profile-shell ${isDesktop ? "" : "profile-shell-mobile"}`}><div className="card-body d-grid gap-2">
    <div className="d-flex align-items-center gap-2 mb-1"><button className="btn btn-light btn-sm" onClick={() => setEditMode(false)}><ChevronLeft size={16} /></button><h5 className="mb-0">Edit Profile</h5></div>
    <label className="small text-secondary">Nama</label><input className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
    <label className="small text-secondary">Email</label><input className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} />
    <label className="small text-secondary">No. HP</label><input className="form-control" value={phone} onChange={(e) => setPhone(e.target.value)} />
    <label className="small text-secondary">Departemen</label><input className="form-control" value={department} onChange={(e) => setDepartment(e.target.value)} />
    <label className="small text-secondary">Username</label><input className="form-control" value={user.username} disabled />
    <label className="small text-secondary">Role</label><input className="form-control" value={user.role} disabled />
    <label className="small text-secondary">Avatar</label>
    {avatarErr && <div className="alert alert-danger py-2 mb-0">{avatarErr}</div>}
    {avatarMsg && <div className="alert alert-success py-2 mb-0">{avatarMsg}</div>}
    <input
      id="avatar-file-input"
      className="d-none"
      type="file"
      accept="image/*"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setAvatarErr("");
        setAvatarMsg("");
        try {
          setAvatarBusy(true);
          const r = await api.uploadAvatar(file);
          setAvatar((r as { avatar_url: string }).avatar_url);
          await onChanged();
          setAvatarMsg("Avatar berhasil diupload.");
        } catch (err) {
          setAvatarErr((err as Error).message || "Gagal upload avatar.");
        } finally {
          setAvatarBusy(false);
          e.currentTarget.value = "";
        }
      }}
    />
    <button className="btn btn-outline-primary" disabled={avatarBusy} onClick={() => { document.getElementById("avatar-file-input")?.click(); }}>{avatarBusy ? "Uploading..." : "Upload Avatar"}</button>
    <button className="btn btn-primary" onClick={async () => { await api.updateProfile({ name, avatar_url: avatar }); localStorage.setItem(phoneKey, phone); localStorage.setItem(deptKey, department); await onChanged(); setEditMode(false); }}>Save</button>
  </div></section>;
}
