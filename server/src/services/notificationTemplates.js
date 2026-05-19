function normalizeRole(role) {
  if (role === "technician") return "teknisi";
  return role;
}

function withPak(name) {
  const clean = String(name || "").trim();
  if (!clean) return "Pak Supervisor";
  return clean.toLowerCase().startsWith("pak ") ? clean : `Pak ${clean}`;
}

export function buildTaskAssignedNotification({ senderRole, senderName, action = "create" }) {
  const role = normalizeRole(senderRole);
  const title = "Tugas Baru";
  const actionText = action === "update" ? "tugas/update" : "tugas";

  if (role === "supervisor") {
    return {
      title,
      message: `Ada ${actionText} dari ${withPak(senderName)}, tolong cek di tugas ya.`,
      type: action === "update" ? "task_updated_by_supervisor" : "task_created_by_supervisor",
    };
  }

  if (role === "staff" || role === "atasan") {
    return {
      title,
      message: `Ada ${actionText} dari ${senderName || "Staff"} nih, cek di tugas ya.`,
      type: action === "update" ? "task_updated_by_staff" : "task_created_by_staff",
    };
  }

  return {
    title,
    message: "Ada tugas baru nih...! Segera cek dashboard kamu.",
    type: "task_created",
  };
}

export function buildTaskUpdatedNotification({
  senderRole,
  senderName,
  status,
  completionPercent,
}) {
  const role = normalizeRole(senderRole);
  if (role !== "teknisi") {
    return {
      title: "Update Tugas",
      message: "Ada update tugas baru, cek di tugas ya.",
      type: "task_updated",
    };
  }

  const pct = Number(completionPercent);
  const lowerStatus = String(status || "").toLowerCase();
  let actionText = "sedang mengerjakan tugas ini.";

  if (lowerStatus === "completed" || lowerStatus === "closed" || pct >= 100) {
    actionText = "sudah menyelesaikan tugas ini.";
  } else if (pct > 0 || lowerStatus === "in_progress") {
    actionText = "sedang mengerjakan tugas ini.";
  } else if (lowerStatus === "assigned_to_technician") {
    actionText = "siap mengerjakan tugas ini.";
  }

  return {
    title: "Update Tugas",
    message: `${senderName || "Mekanik"} ${actionText}`,
    type: "task_updated_by_technician",
  };
}

export function buildReportSubmittedNotification({ senderRole, senderName }) {
  const role = normalizeRole(senderRole);
  if (role === "teknisi") {
    return {
      title: "Laporan Baru dari Teknisi",
      message: `${senderName || "Mekanik"} sudah kirim laporan selesai.`,
      type: "report_submitted_by_technician",
    };
  }
  if (role === "staff" || role === "atasan") {
    return {
      title: "Laporan Baru dari Staff",
      message: `${senderName || "Staff"} sudah kirim laporan selesai.`,
      type: "report_submitted_by_staff",
    };
  }
  return {
    title: "Laporan Baru",
    message: "Ada laporan selesai baru, cek di laporan ya.",
    type: "report_submitted",
  };
}
