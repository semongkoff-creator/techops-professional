import { ChevronRight, Eye, MapPin, Pencil, Plus, Search, SlidersHorizontal, Trash2, UserCircle2, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { api } from "../services/api";
import type { Task, User } from "../types";

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

function FancySelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
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
    <div className={`fancy-select${open ? " open" : ""}`} ref={rootRef}>
      <button type="button" className="fancy-select-trigger" onClick={() => setOpen((v) => !v)}>
        <span>{selected ? selected.label : "-"}</span>
        <span className="fancy-caret">v</span>
      </button>
      {open && (
        <div className="fancy-select-menu">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
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

export function TasksPage({ isDesktop, user, tasks, supervisors, technicians, staffs, onDone }: { isDesktop: boolean; user: User; tasks: Task[]; supervisors: User[]; technicians: User[]; staffs: User[]; onDone: () => Promise<void>; }) {
  const supervisorUsers = useMemo(() => supervisors.filter((u) => String(u.role || "").toLowerCase() === "supervisor"), [supervisors]);
  const [form, setForm] = useState({ title: "", description: "", customer: "", location: "", priority: "medium", supervisor_id: "", staff_id: "", technician_id: "", documentation_image_url: "", due_date: "", completion_percent: "0" });
  const [assign, setAssign] = useState<{ [k: number]: string }>({});
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "not_started" | "in_progress" | "done">("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [activeTaskMenuId, setActiveTaskMenuId] = useState<number | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedTaskMode, setSelectedTaskMode] = useState<"view" | "update">("view");
  const [pendingProgress, setPendingProgress] = useState("0");
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [confirmDeleteTask, setConfirmDeleteTask] = useState<Task | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadRetrying, setUploadRetrying] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const createCameraInputRef = useRef<HTMLInputElement | null>(null);
  const editCameraInputRef = useRef<HTMLInputElement | null>(null);
  const updateCameraInputRef = useRef<HTMLInputElement | null>(null);
  const [createMediaPreview, setCreateMediaPreview] = useState<string>("");
  const [editMediaPreview, setEditMediaPreview] = useState<string>("");
  const [updateMediaPreview, setUpdateMediaPreview] = useState<string>("");
  const [updateMediaFile, setUpdateMediaFile] = useState<File | null>(null);
  const canCreateTask = user.role === "supervisor" || user.role === "staff" || user.role === "teknisi" || user.role === "technician";
  const canAssign = user.role === "staff";
  const canUpdateTask = user.role === "staff" || user.role === "teknisi" || user.role === "technician";
  const isTechnicianCreate = user.role === "teknisi" || user.role === "technician";
  const isSupervisorRole = user.role === "supervisor";
  const isStaffRole = user.role === "staff" || user.role === "atasan";
  const isTechnicianRole = user.role === "teknisi" || user.role === "technician";
  const canUploadTaskMedia = isTechnicianRole;
  const showToast = (message: string, type: "success" | "error" = "success") => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  };

  // filter scroll — pointer events (bypass semua CSS overflow)
  const scrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);
  const didDrag = useRef(false);

  const allBtnRef = useRef<HTMLButtonElement | null>(null);
  const notStartedBtnRef = useRef<HTMLButtonElement | null>(null);
  const inProgressBtnRef = useRef<HTMLButtonElement | null>(null);
  const doneBtnRef = useRef<HTMLButtonElement | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const formatDate = (v: string) => (v ? new Date(v).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "-");
  const technicianName = (id?: number | null) => technicians.find((te) => te.id === id)?.name || "-";
  const supervisorName = (id?: number | null) => supervisorUsers.find((sp) => sp.id === id)?.name || "-";
  const staffName = (id?: number | null) => staffs.find((a) => a.id === id)?.name || "-";
  const toIntOrUndefined = (v: string) => {
    const n = Number(v);
    return Number.isInteger(n) ? n : undefined;
  };
  const isVideoUrl = (url?: string | null) => /\.(mp4|webm|mov|m4v|ogg)(\?.*)?$/i.test(String(url || ""));
  const validateMediaFile = (file?: File | null) => {
    if (!file) return "File media belum dipilih.";
    const type = String(file.type || "");
    const isImage = type.startsWith("image/");
    const isVideo = type.startsWith("video/");
    if (!isImage && !isVideo) return "Format file tidak didukung. Gunakan gambar/video.";
    const maxBytes = isVideo ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxBytes) return isVideo ? "Ukuran video maksimal 20MB." : "Ukuran gambar maksimal 5MB.";
    return "";
  };
  const setPreviewFromFile = (file: File, setter: (v: string) => void) => {
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result || ""));
    reader.readAsDataURL(file);
  };
  const requestCameraPermission = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch {
      return false;
    }
  };
  const uploadDocumentationFromFile = async (file?: File | null, taskId?: number) => {
    if (!file) return null;
    const validationMsg = validateMediaFile(file);
    if (validationMsg) {
      showToast(validationMsg, "error");
      return null;
    }
    try {
      setUploadingDoc(true);
      setUploadRetrying(false);
      setUploadPercent(0);
      const r = await api.uploadTaskDocumentationWithProgress(
        file,
        taskId,
        setUploadPercent,
        () => setUploadRetrying(true),
      ) as { documentation_image_url?: string };
      if (!r?.documentation_image_url) throw new Error("URL dokumentasi tidak ditemukan.");
      return r.documentation_image_url;
    } catch (err) {
      const msg = (err as Error).message || "Gagal upload dokumentasi.";
      showToast(msg, "error");
      return null;
    } finally {
      setUploadingDoc(false);
      setUploadRetrying(false);
      setTimeout(() => setUploadPercent(0), 400);
    }
  };
  const onCreateDocPick = async (file?: File | null) => {
    if (!file) return;
    setPreviewFromFile(file, setCreateMediaPreview);
    const url = await uploadDocumentationFromFile(file);
    if (url) setForm((prev) => ({ ...prev, documentation_image_url: url }));
    if (createCameraInputRef.current) createCameraInputRef.current.value = "";

  };
  const onEditDocPick = async (file?: File | null) => {
    if (!editTask) return;
    if (!file) return;
    setPreviewFromFile(file, setEditMediaPreview);
    const url = await uploadDocumentationFromFile(file, editTask.id);
    if (url) setEditTask((prev) => (prev ? { ...prev, documentation_image_url: url } : prev));
    if (editCameraInputRef.current) editCameraInputRef.current.value = "";

  };
  const onUpdateDocPick = (file?: File | null) => {
    if (!file) return;
    const validationMsg = validateMediaFile(file);
    if (validationMsg) {
      showToast(validationMsg, "error");
      return;
    }
    setUpdateMediaFile(file);
    setPreviewFromFile(file, setUpdateMediaPreview);
    if (updateCameraInputRef.current) updateCameraInputRef.current.value = "";
  };
  const openEditTask = (t: Task) => {
    const techOk = typeof t.technician_id === "number" && technicians.some((te) => te.id === t.technician_id);
    setEditTask({ ...t, technician_id: techOk ? t.technician_id : null });
    setEditMediaPreview(t.documentation_image_url || "");
  };

  useEffect(() => {
    if (!form.supervisor_id && supervisorUsers.length > 0) {
      setForm((prev) => ({ ...prev, supervisor_id: String(supervisorUsers[0].id) }));
    }
  }, [supervisorUsers, form.supervisor_id]);
  useEffect(() => {
    if (!selectedTask) return;
    const next = selectedTask.completion_percent >= 100 ? "100" : selectedTask.completion_percent > 0 ? "50" : "0";
    setPendingProgress(next);
  }, [selectedTask]);
  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);
  useEffect(() => {
    if (!selectedTask) {
      setUpdateMediaFile(null);
      setUpdateMediaPreview("");
      if (updateCameraInputRef.current) updateCameraInputRef.current.value = "";
    }
  }, [selectedTask]);

  const mobileTasks = useMemo(() => tasks
    .filter((t) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return t.title.toLowerCase().includes(q) || t.location.toLowerCase().includes(q) || t.code.toLowerCase().includes(q);
    })
    .filter((t) => {
      const pct = Number(t.completion_percent || 0);
      if (filter === "all") return true;
      if (filter === "not_started") return pct <= 0 && (t.status === "assigned_to_technician" || t.status === "draft_to_supervisor" || t.status === "in_progress");
      if (filter === "in_progress") return pct > 0 && pct < 100;
      return pct >= 100 || t.status === "completed" || t.status === "closed";
    }), [tasks, query, filter]);

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (!scrollRef.current) return;
    isDragging.current = true;
    didDrag.current = false;
    startX.current = e.clientX;
    startScroll.current = scrollRef.current.scrollLeft;
    scrollRef.current.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isDragging.current || !scrollRef.current) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 4) didDrag.current = true;
    scrollRef.current.scrollLeft = startScroll.current - dx;
  }

  function onPointerUp() {
    isDragging.current = false;
  }

  function handleFilterClick(next: "all" | "not_started" | "in_progress" | "done") {
    if (didDrag.current) return; // swipe bukan tap
    setFilter(next);
  }

  useLayoutEffect(() => {
    const row = scrollRef.current;
    if (!row) return;
    const btn =
      filter === "all" ? allBtnRef.current :
      filter === "not_started" ? notStartedBtnRef.current :
      filter === "in_progress" ? inProgressBtnRef.current :
      doneBtnRef.current;
    if (!btn) return;
    setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
    btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [filter, mobileTasks.length]);

  const FILTERS = [
    { key: "all" as const, label: "Semua", ref: allBtnRef },
    { key: "not_started" as const, label: "Belum Mulai", ref: notStartedBtnRef },
    { key: "in_progress" as const, label: "Sedang Berjalan", ref: inProgressBtnRef },
    { key: "done" as const, label: "Selesai", ref: doneBtnRef },
  ];

  const isAssignableTask = (t: Task) => !Boolean(t.technician_id) && !["assigned_to_technician", "in_progress", "completed", "closed"].includes(t.status);
  const technicianSelect = (t: Task) => (
    <select className="form-select form-select-sm" value={assign[t.id] || ""} onChange={(e) => setAssign({ ...assign, [t.id]: e.target.value })}>
      <option value="">Teknisi</option>
      {technicians.map((te) => <option key={te.id} value={te.id}>{te.name}</option>)}
    </select>
  );
  const desktopTechnicianCell = (t: Task) => (canAssign && isDesktop && isAssignableTask(t) ? technicianSelect(t) : technicianName(t.technician_id));

  const action = (t: Task) => (
    <div className={`d-flex flex-wrap gap-2 ${isDesktop ? "desktop-action-wrap" : ""}`}>
      {canAssign && (() => {
        const assignable = isAssignableTask(t);
        if (!assignable) {
          return null;
        }
        const assignField = (
          <button className="btn btn-sm btn-primary" onClick={async () => {
            if (!assign[t.id]) {
              showToast("Pilih teknisi dulu sebelum assign.", "error");
              return;
            }
            try {
              await api.assignTechnician(t.id, { technician_id: Number(assign[t.id]) });
              await onDone();
              showToast("Teknisi berhasil di-assign.");
            } catch (err) {
              showToast((err as Error).message || "Gagal assign teknisi.", "error");
            }
          }}>Assign</button>
        );
        if (isDesktop) return assignField;
        return <>{technicianSelect(t)}{assignField}</>;
      })()}
      {canUpdateTask && !isDesktop && selectedTaskMode === "update" && <>
        <select className="form-select form-select-sm" defaultValue={t.status} onChange={async (e) => {
          try {
            await api.updateTaskStatus(t.id, { status: e.target.value });
            await onDone();
            showToast("Status task berhasil diperbarui.");
          } catch (err) {
            showToast((err as Error).message || "Gagal update status task.", "error");
          }
        }}>
          <option value="assigned_to_technician">assigned_to_technician</option>
          <option value="in_progress">in_progress</option>
          <option value="completed">completed</option>
        </select>
        <select className="form-select form-select-sm" defaultValue={String(t.completion_percent)} onChange={async (e) => {
          try {
            await api.updateTaskProgress(t.id, { completion_percent: Number(e.target.value) });
            await onDone();
            showToast("Progress task berhasil diperbarui.");
          } catch (err) {
            showToast((err as Error).message || "Gagal update progress task.", "error");
          }
        }}>
          <option>0</option><option>25</option><option>50</option><option>75</option><option>100</option>
        </select>
      </>}
      <div className={`task-more-wrap ${isDesktop ? "desktop-more" : ""}`}>
        <button type="button" className="task-more-btn" onClick={() => setActiveTaskMenuId((prev) => (prev === t.id ? null : t.id))}>...</button>
        {activeTaskMenuId === t.id && (
          <div className={`task-inline-menu compact ${isDesktop ? "desktop-action-menu open-down" : ""}`}>
            <button type="button" onClick={() => { setSelectedTaskMode(canUpdateTask ? "update" : "view"); setSelectedTask(t); setActiveTaskMenuId(null); }}><Eye size={14} /> Lihat</button>
            {(user.role === "supervisor") && <button type="button" onClick={() => { openEditTask(t); setActiveTaskMenuId(null); }}><Pencil size={14} /> Edit</button>}
            {(user.role === "supervisor") && <button type="button" className="danger" onClick={() => { setConfirmDeleteTask(t); setActiveTaskMenuId(null); }}><Trash2 size={14} /> Hapus</button>}
          </div>
        )}
      </div>
    </div>
  );

  async function submitTask() {
    setFormError(""); setFormSuccess("");
    if (!form.title.trim() || !form.location.trim()) {
      setFormError("Judul dan lokasi wajib diisi.");
      return;
    }
    if (isStaffRole && !form.supervisor_id) {
      setFormError("Staff wajib memilih Supervisor.");
      return;
    }
    if (isStaffRole && !form.technician_id) {
      setFormError("Staff wajib memilih Teknisi.");
      return;
    }
    if (isTechnicianRole && !form.supervisor_id) {
      setFormError("Teknisi wajib memilih Supervisor.");
      return;
    }
    if (isTechnicianRole && !form.staff_id) {
      setFormError("Teknisi wajib memilih Staff.");
      return;
    }
    try {
      setSaving(true);
      await api.createTask({
        ...form,
        supervisor_id: toIntOrUndefined(form.supervisor_id),
        staff_id: isTechnicianRole ? toIntOrUndefined(form.staff_id) : undefined,
        technician_id: isStaffRole ? toIntOrUndefined(form.technician_id) : undefined,
        documentation_image_url: canUploadTaskMedia ? (form.documentation_image_url?.trim() || undefined) : undefined,
        completion_percent: Number(form.completion_percent || 0),
      });
      await onDone();
      setFormSuccess("Tugas berhasil disimpan.");
      showToast("Tugas berhasil ditambahkan.");
      setForm({ title: "", description: "", customer: "", location: "", priority: "medium", supervisor_id: supervisorUsers[0] ? String(supervisorUsers[0].id) : "", staff_id: "", technician_id: "", documentation_image_url: "", due_date: "", completion_percent: "0" });
      setShowCreateModal(false);
    } catch (err) {
      const msg = (err as Error).message || "Gagal menyimpan tugas.";
      setFormError(msg);
      showToast(msg, "error");
    }
    finally { setSaving(false); }
  }

  async function submitEditTask() {
    if (!editTask) return;
    try {
      await api.updateTask(editTask.id, {
        title: editTask.title,
        description: editTask.description,
        customer: editTask.customer,
        location: editTask.location,
        priority: editTask.priority,
        supervisor_id: editTask.supervisor_id,
        technician_id: typeof editTask.technician_id === "number" ? editTask.technician_id : undefined,
        due_date: editTask.due_date,
        documentation_image_url: editTask.documentation_image_url || undefined, completion_percent: editTask.completion_percent,
      });
      await onDone(); setEditTask(null); setFormSuccess("Tugas berhasil diperbarui.");
      showToast("Perubahan task berhasil disimpan.");
    } catch (err) {
      const msg = (err as Error).message || "Gagal update tugas.";
      setFormError(msg);
      showToast(msg, "error");
    }
  }

  async function removeTask(taskId: number) {
    try {
      await api.deleteTask(taskId); await onDone(); setFormSuccess("Tugas berhasil dihapus."); setActiveTaskMenuId(null);
      setConfirmDeleteTask(null);
      showToast("Task berhasil dihapus.");
    } catch (err) {
      const msg = (err as Error).message || "Gagal hapus tugas.";
      setFormError(msg);
      showToast(msg, "error");
    }
  }

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
      {isDesktop ? (
        <div className="card"><div className="card-body"><div className="d-flex justify-content-between align-items-center mb-2"><h5 className="mb-0">Job Activity Table</h5>{canCreateTask && <button className="btn btn-primary rounded-pill px-3" onClick={() => setShowCreateModal(true)}><Plus size={16} /> Buat Tugas</button>}</div><div className="worksheet-head"><div><strong>UNIT</strong></div><div className="worksheet-brand">SATRIA PIRANTI PERKASA</div><div className="text-end"><span className="badge text-bg-primary">PCS</span></div></div><div className="table-wrap desktop-job-table"><table className="table align-middle"><thead><tr className="worksheet-group"><th colSpan={2}>IDENTITAS</th><th colSpan={4}>AKTIVITAS</th><th colSpan={4}>PROGRESS</th><th colSpan={4}>PENUGASAN</th><th colSpan={2}>AKSI</th></tr><tr><th>No</th><th>Tgl</th><th>Job</th><th>Detail Job</th><th>Customer</th><th>Lokasi</th><th>Plan</th><th>Aging</th><th>Status</th><th>Progress</th><th>Staff</th><th>Mekanik</th><th>Final</th><th>Keterangan</th><th>Dokumentasi</th><th>Aksi</th></tr></thead><tbody>{tasks.map((t, i) => <tr key={t.id}><td>{i + 1}</td><td>{formatDate(t.due_date || "")}</td><td>{t.priority?.toUpperCase() || "-"}</td><td>{t.title}</td><td>{t.customer || "-"}</td><td>{t.location || "-"}</td><td>{formatDate(t.due_date || "")}</td><td>{t.due_date ? Math.max(0, Math.ceil(((new Date(t.due_date).getTime() - Date.now()) / 86400000))) : "-"}</td><td><span className="badge text-bg-light border">{t.status}</span></td><td>{Math.max(0, Math.min(100, t.completion_percent || 0))}%</td><td>{staffName(t.created_by_atasan_id)}</td><td>{desktopTechnicianCell(t)}</td><td>{t.status === "completed" || t.status === "closed" ? "CLOSE" : "OPEN"}</td><td>{t.description || "-"}</td><td>{t.documentation_image_url ? <a href={t.documentation_image_url} target="_blank" rel="noreferrer">Lihat Gambar</a> : "-"}</td><td>{action(t)}</td></tr>)}</tbody></table></div></div></div>
      ) : (
        <div className="task-mobile-list d-grid gap-2">
          {canCreateTask && <div className="d-flex justify-content-end"><button className="btn btn-primary rounded-pill px-3" onClick={() => setShowCreateModal(true)}><Plus size={16} /> Buat Tugas</button></div>}
          {formSuccess && <div className="alert alert-success py-2 mb-0">{formSuccess}</div>}
          <div className="card"><div className="card-body p-2"><div className="task-search-wrap"><Search size={16} /><input className="form-control border-0 shadow-none" placeholder="Cari tugas..." value={query} onChange={(e) => setQuery(e.target.value)} /><button className="task-filter-trigger" type="button" onClick={() => setShowFilterModal(true)} aria-label="Filter"><SlidersHorizontal size={16} /></button></div></div></div>

          {/* Filter tabs — pointer events scroll, bypass CSS overflow */}
          <div className="task-filter-shell">
            <div
              ref={scrollRef}
              style={{ overflowX: "auto", overflowY: "hidden", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as CSSProperties}
            >
              <div style={{ display: "inline-flex", gap: "0.5rem", minWidth: "max-content", padding: "0 0 0.2rem" }}>
                {FILTERS.map(({ key, label, ref }) => (
                  <button
                    key={key}
                    ref={ref}
                    type="button"
                    onClick={() => handleFilterClick(key)}
                    style={{
                      border: `1px solid ${filter === key ? "#16b39a" : "#d6dceb"}`,
                      background: filter === key ? "#16b39a" : "#f6f8fc",
                      color: filter === key ? "#fff" : "#4d5f82",
                      borderRadius: "999px",
                      padding: "0.4rem 0.8rem",
                      whiteSpace: "nowrap",
                      fontSize: "0.82rem",
                      fontWeight: 600,
                      flexShrink: 0,
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="task-filter-track">
              <div className="task-filter-indicator" style={{ width: `${indicator.width}px`, transform: `translateX(${indicator.left}px)` }} />
            </div>
          </div>

          {mobileTasks.map((t) => {
            const step = Math.max(1, Math.min(4, Math.round(t.completion_percent / 25)));
            const done = Number(t.completion_percent) >= 100 || t.status === "completed" || t.status === "closed";
            const statusLabel = done ? "Selesai" : Number(t.completion_percent) > 0 || t.status === "in_progress" ? "Sedang Berjalan" : "Belum Mulai";
            const statusClass = done ? "done" : Number(t.completion_percent) > 0 || t.status === "in_progress" ? "progress" : "not-started";
            return <div className={`card task-mobile-card ${t.priority}`} key={t.id}><div className="card-body"><div className="d-flex justify-content-between align-items-center mb-2"><span className={`task-prio ${t.priority}`}>{t.priority.toUpperCase()}</span><div className="task-more-wrap"><button type="button" className="task-more-btn" onClick={() => setActiveTaskMenuId((prev) => (prev === t.id ? null : t.id))}>...</button>{activeTaskMenuId === t.id && <div className="task-inline-menu compact">{user.role === "supervisor" && <><button type="button" onClick={() => { openEditTask(t); setActiveTaskMenuId(null); }}><Pencil size={14} /> Edit</button><button type="button" className="danger" onClick={() => { setConfirmDeleteTask(t); setActiveTaskMenuId(null); }}><Trash2 size={14} /> Hapus</button></>}{canUpdateTask && <button type="button" onClick={() => { setSelectedTaskMode("update"); setSelectedTask(t); setActiveTaskMenuId(null); }}><Pencil size={14} /> Update Task</button>}<button type="button" onClick={() => { setSelectedTaskMode("view"); setSelectedTask(t); setActiveTaskMenuId(null); }}><Eye size={14} /> Lihat</button></div>}</div></div><h4>{t.title}</h4><p className="text-secondary mb-1"><MapPin size={14} /> {t.location}</p><p className="text-secondary mb-1">Keterangan: {t.description || "-"}</p><p className="text-secondary mb-2 task-supervisor"><UserCircle2 size={14} /> Supervisor: {supervisorName(t.supervisor_id)}</p><p className="text-secondary mb-2 task-supervisor"><UserCircle2 size={14} /> Staff: {staffName(t.created_by_atasan_id)}</p><p className="text-secondary mb-2 task-supervisor"><UserCircle2 size={14} /> Teknisi: {technicianName(t.technician_id)}</p><div className="d-flex justify-content-between align-items-center"><div className={`task-progress-inline ${statusClass}`}>{[1, 2, 3, 4].map((i) => <span key={i} className={i <= step ? "on" : ""} />)}<strong>{statusLabel}</strong></div>{done ? <span className={`task-done ${statusClass}`}>Selesai</span> : <button type="button" className="task-arrow-btn" onClick={() => { setSelectedTaskMode(canUpdateTask ? "update" : "view"); setSelectedTask(t); }}><ChevronRight size={18} color="#ffffff" /></button>}</div></div></div>;
          })}
        </div>
      )}

      {editTask && <div className="task-modal-backdrop" onClick={() => setEditTask(null)}><div className="task-modal card task-form" onClick={(e) => e.stopPropagation()}><div className="card-body d-grid gap-2"><div className="d-flex justify-content-between align-items-center"><h5 className="mb-0">Edit Tugas</h5><button className="btn btn-light btn-sm" onClick={() => setEditTask(null)}><X size={16} /></button></div><label className="task-label">Detail Job</label><input className="form-control" value={editTask.title} onChange={(e) => setEditTask({ ...editTask, title: e.target.value })} /><label className="task-label">Keterangan</label><textarea className="form-control" value={editTask.description} onChange={(e) => setEditTask({ ...editTask, description: e.target.value })} /><label className="task-label">Customer</label><input className="form-control" placeholder="Customer" value={editTask.customer || ""} onChange={(e) => setEditTask({ ...editTask, customer: e.target.value })} /><label className="task-label">Lokasi</label><input className="form-control" value={editTask.location} onChange={(e) => setEditTask({ ...editTask, location: e.target.value })} />{canUploadTaskMedia && <><label className="task-label">Dokumentasi (Foto / Video)</label><div className="d-flex gap-2"><button type="button" className="btn btn-outline-primary btn-sm" onClick={async () => { const ok = await requestCameraPermission(); if (!ok) { showToast("Izin kamera ditolak. Aktifkan permission kamera di browser.", "error"); return; } editCameraInputRef.current?.click(); }}>Ambil dari Kamera</button></div><input ref={editCameraInputRef} type="file" accept="image/*,video/*" capture="environment" style={{ display: "none" }} onChange={(e) => { void onEditDocPick(e.target.files?.[0]); }} />{editTask.documentation_image_url && <a href={editTask.documentation_image_url} target="_blank" rel="noreferrer" className="small text-decoration-none">Lihat dokumentasi terupload</a>}{uploadingDoc && <div className="small text-secondary">Mengupload media... {uploadPercent}%{uploadRetrying ? " (Mencoba ulang upload...)" : ""}<div className="progress mt-1" style={{ height: "6px" }}><div className="progress-bar" role="progressbar" style={{ width: `${uploadPercent}%` }} /></div></div>}</>}<label className="task-label">Job (Prioritas)</label><FancySelect value={editTask.priority} onChange={(v) => setEditTask({ ...editTask, priority: v as Task["priority"] })} options={[{ value: "low", label: "low" }, { value: "medium", label: "medium" }, { value: "high", label: "high" }]} /><label className="task-label">Supervisor</label><FancySelect value={String(editTask.supervisor_id)} onChange={(v) => setEditTask({ ...editTask, supervisor_id: Number(v) })} options={supervisorUsers.map((s) => ({ value: String(s.id), label: s.name }))} /><label className="task-label">Mekanik (Teknisi)</label><FancySelect value={String(editTask.technician_id ?? "")} onChange={(v) => setEditTask({ ...editTask, technician_id: v ? Number(v) : null })} options={[{ value: "", label: "Belum ditentukan" }, ...technicians.map((te) => ({ value: String(te.id), label: te.name }))]} /><label className="task-label">Progress</label><FancySelect value={String(editTask.completion_percent)} onChange={(v) => setEditTask({ ...editTask, completion_percent: Number(v) })} options={[{ value: "0", label: "Belum Mulai (0%)" }, { value: "50", label: "Sedang Berjalan (50%)" }, { value: "100", label: "Selesai (100%)" }]} /><label className="task-label">Plan / Tanggal</label><DatePickerField value={editTask.due_date ? String(editTask.due_date).slice(0, 10) : ""} onChange={(v) => setEditTask({ ...editTask, due_date: v })} /><button className="btn btn-primary" disabled={uploadingDoc} onClick={submitEditTask}>{uploadingDoc ? `Mengupload media... ${uploadPercent}%` : "Simpan Perubahan"}</button></div></div></div>}
      {showFilterModal && <div className="task-modal-backdrop" onClick={() => setShowFilterModal(false)}><div className="task-modal card" onClick={(e) => e.stopPropagation()}><div className="card-body d-grid gap-2"><div className="d-flex justify-content-between align-items-center"><h5 className="mb-0">Filter Tugas</h5><button className="btn btn-light btn-sm" onClick={() => setShowFilterModal(false)}><X size={16} /></button></div><button className={`btn ${filter === "all" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => { setFilter("all"); setShowFilterModal(false); }}>Semua</button><button className={`btn ${filter === "not_started" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => { setFilter("not_started"); setShowFilterModal(false); }}>Belum Mulai</button><button className={`btn ${filter === "in_progress" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => { setFilter("in_progress"); setShowFilterModal(false); }}>Sedang Berjalan</button><button className={`btn ${filter === "done" ? "btn-primary" : "btn-outline-primary"}`} onClick={() => { setFilter("done"); setShowFilterModal(false); }}>Selesai</button></div></div></div>}
      {selectedTask && <div className="task-modal-backdrop" onClick={() => setSelectedTask(null)}><div className="task-modal card" onClick={(e) => e.stopPropagation()}><div className="card-body d-grid gap-2"><div className="d-flex justify-content-between align-items-center"><h5 className="mb-0">Detail Tugas</h5><button className="btn btn-light btn-sm" onClick={() => setSelectedTask(null)}><X size={16} /></button></div><div><strong>{selectedTask.title}</strong></div><div className="text-secondary">Keterangan: {selectedTask.description || "-"}</div><div className="text-secondary">Lokasi: {selectedTask.location}</div><div className="text-secondary">Supervisor: {supervisorName(selectedTask.supervisor_id)}</div><div className="text-secondary">Staff: {staffName(selectedTask.created_by_atasan_id)}</div><div className="text-secondary">Teknisi: {technicianName(selectedTask.technician_id)}</div><div className="text-secondary">Status: {selectedTask.status}</div><div className="text-secondary">Progress: {selectedTask.completion_percent}%</div>{selectedTask.documentation_image_url && <a href={selectedTask.documentation_image_url} target="_blank" rel="noreferrer" className="text-decoration-none">{isVideoUrl(selectedTask.documentation_image_url) ? <video src={selectedTask.documentation_image_url} controls style={{ width: "100%", maxHeight: 220, borderRadius: 10, border: "1px solid #dbe3f3" }} /> : <img src={selectedTask.documentation_image_url} alt="Dokumentasi tugas" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, border: "1px solid #dbe3f3" }} />}</a>}{canUpdateTask && !isDesktop && selectedTaskMode === "update" && <><label className="task-label">Update Progres Pekerjaan</label><select className="form-select form-select-sm task-progress-select" value={pendingProgress} onChange={(e) => setPendingProgress(e.target.value)}><option value="0">Belum Mulai</option><option value="50">Sedang Berjalan</option><option value="100">Selesai</option></select>{isTechnicianRole && <><label className="task-label">Dokumentasi Update (Foto / Video)</label><div className="d-flex gap-2"><button type="button" className="btn btn-outline-primary btn-sm" onClick={async () => { const ok = await requestCameraPermission(); if (!ok) { showToast("Izin kamera ditolak. Aktifkan permission kamera di browser.", "error"); return; } updateCameraInputRef.current?.click(); }}>Ambil dari Kamera</button></div><input ref={updateCameraInputRef} type="file" accept="image/*,video/*" capture="environment" style={{ display: "none" }} onChange={(e) => { onUpdateDocPick(e.target.files?.[0]); }} />{updateMediaPreview && (isVideoUrl(updateMediaPreview) ? <video src={updateMediaPreview} controls style={{ width: "100%", maxHeight: 220, borderRadius: 10, border: "1px solid #dbe3f3" }} /> : <img src={updateMediaPreview} alt="Preview dokumentasi update" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, border: "1px solid #dbe3f3" }} />)}{uploadingDoc && <div className="small text-secondary">Mengupload media... {uploadPercent}%{uploadRetrying ? " (Mencoba ulang upload...)" : ""}<div className="progress mt-1" style={{ height: "6px" }}><div className="progress-bar" role="progressbar" style={{ width: `${uploadPercent}%` }} /></div></div>}</>}<button type="button" className="btn btn-primary btn-sm" onClick={async () => { const progress = Number(pendingProgress); const status = progress >= 100 ? "completed" : progress > 0 ? "in_progress" : "assigned_to_technician"; try { let documentationUrl = selectedTask.documentation_image_url || ""; if (isTechnicianRole && updateMediaFile) { const uploaded = await uploadDocumentationFromFile(updateMediaFile, selectedTask.id); if (!uploaded) return; documentationUrl = uploaded; } if (isTechnicianRole && documentationUrl !== (selectedTask.documentation_image_url || "")) { await api.updateTask(selectedTask.id, { documentation_image_url: documentationUrl }); } await api.updateTaskProgress(selectedTask.id, { completion_percent: progress }); await api.updateTaskStatus(selectedTask.id, { status }); await onDone(); setSelectedTask(null); setUpdateMediaFile(null); setUpdateMediaPreview(""); showToast("Progres task berhasil diperbarui."); } catch (err) { showToast((err as Error).message || "Gagal update progres task.", "error"); } }}>Konfirmasi Update</button></>}</div></div></div>}
      {canCreateTask && showCreateModal && <div className="task-modal-backdrop" onClick={() => setShowCreateModal(false)}><div className="task-modal card task-form" onClick={(e) => e.stopPropagation()}><div className="card-body d-grid gap-2"><div className="d-flex justify-content-between align-items-center"><h5 className="mb-0">Buat Tugas</h5><button className="btn btn-light btn-sm" onClick={() => setShowCreateModal(false)}><X size={16} /></button></div><label className="task-label">Detail Job</label><input className="form-control" placeholder="Isi detail job" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /><label className="task-label">Keterangan</label><textarea className="form-control" placeholder="Isi keterangan pekerjaan" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><label className="task-label">Customer</label><input className="form-control" placeholder="Nama customer" value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /><label className="task-label">Lokasi</label><input className="form-control" placeholder="Lokasi pekerjaan" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />{canUploadTaskMedia && <><label className="task-label">Dokumentasi (Foto / Video)</label><div className="d-flex gap-2"><button type="button" className="btn btn-outline-primary btn-sm" onClick={async () => { const ok = await requestCameraPermission(); if (!ok) { showToast("Izin kamera ditolak. Aktifkan permission kamera di browser.", "error"); return; } createCameraInputRef.current?.click(); }}>Ambil dari Kamera</button></div><input ref={createCameraInputRef} type="file" accept="image/*,video/*" capture="environment" style={{ display: "none" }} onChange={(e) => { void onCreateDocPick(e.target.files?.[0]); }} />{form.documentation_image_url && <a href={form.documentation_image_url} target="_blank" rel="noreferrer" className="small text-decoration-none">Lihat dokumentasi terupload</a>}{uploadingDoc && <div className="small text-secondary">Mengupload media... {uploadPercent}%{uploadRetrying ? " (Mencoba ulang upload...)" : ""}<div className="progress mt-1" style={{ height: "6px" }}><div className="progress-bar" role="progressbar" style={{ width: `${uploadPercent}%` }} /></div></div>}</>}<label className="task-label">Job (Prioritas)</label><FancySelect value={form.priority} onChange={(v) => setForm({ ...form, priority: v })} options={[{ value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" }]} />{isTechnicianRole && <><label className="task-label">SPV</label><FancySelect value={form.supervisor_id} onChange={(v) => setForm({ ...form, supervisor_id: v })} options={supervisorUsers.map((s) => ({ value: String(s.id), label: s.name }))} /><label className="task-label">Staff</label><FancySelect value={form.staff_id} onChange={(v) => setForm({ ...form, staff_id: v })} options={staffs.map((s) => ({ value: String(s.id), label: s.name }))} /></>}{isSupervisorRole && <><label className="task-label">Staff (Opsional)</label><FancySelect value={form.staff_id} onChange={(v) => setForm({ ...form, staff_id: v })} options={[{ value: "", label: "-" }, ...staffs.map((s) => ({ value: String(s.id), label: s.name }))]} /><label className="task-label">Mekanik (Teknisi Opsional)</label><FancySelect value={form.technician_id} onChange={(v) => setForm({ ...form, technician_id: v })} options={[{ value: "", label: "-" }, ...technicians.map((te) => ({ value: String(te.id), label: te.name }))]} /></>}{isStaffRole && <><label className="task-label">SPV</label><FancySelect value={form.supervisor_id} onChange={(v) => setForm({ ...form, supervisor_id: v })} options={supervisorUsers.map((s) => ({ value: String(s.id), label: s.name }))} /><label className="task-label">Mekanik (Teknisi)</label><FancySelect value={form.technician_id} onChange={(v) => setForm({ ...form, technician_id: v })} options={technicians.map((te) => ({ value: String(te.id), label: te.name }))} /></>}<label className="task-label">Plan / Tanggal</label><DatePickerField value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} /><label className="task-label">Progress Awal</label><FancySelect value={form.completion_percent} onChange={(v) => setForm({ ...form, completion_percent: v })} options={[{ value: "0", label: "Belum Mulai (0%)" }, { value: "50", label: "Sedang Berjalan (50%)" }, { value: "100", label: "Selesai (100%)" }]} /><div className="task-help">Field <strong>Status</strong> dan <strong>Aging</strong> otomatis dari sistem.</div>{formError && <div className="alert alert-danger py-2 mb-0">{formError}</div>}<button className="btn btn-primary" type="button" disabled={saving || uploadingDoc} onClick={submitTask}>{uploadingDoc ? `Mengupload media... ${uploadPercent}%` : saving ? "Menyimpan..." : "Simpan"}</button></div></div></div>}
      {confirmDeleteTask && <div className="task-modal-backdrop task-confirm-backdrop" onClick={() => setConfirmDeleteTask(null)}><div className="task-confirm-modal card" onClick={(e) => e.stopPropagation()}><div className="card-body"><h5 className="mb-2">Hapus Tugas</h5><p className="mb-3">Yakin hapus tugas <strong>{confirmDeleteTask.title}</strong>?</p><div className="task-confirm-actions"><button type="button" className="btn btn-light" onClick={() => setConfirmDeleteTask(null)}>Batal</button><button type="button" className="btn btn-danger" onClick={() => { void removeTask(confirmDeleteTask.id); }}>Ya, Hapus</button></div></div></div></div>}
    </section>
  );
}





























