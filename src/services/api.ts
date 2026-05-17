const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

export const ASSET_BASE = API_BASE.replace(/\/api\/?$/, "");

type Method = "GET" | "POST" | "PATCH" | "DELETE";
const DEVICE_ID_KEY = "techops-device-id-v1";

function getDeviceId() {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const created = (typeof crypto !== "undefined" && "randomUUID" in crypto)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

function getToken() {
  return localStorage.getItem("token");
}

function setToken(token: string) {
  localStorage.setItem("token", token);
}

function clearToken() {
  localStorage.removeItem("token");
}

function authHeader() {
  const token = getToken();
  const base = { "x-device-id": getDeviceId() };
  return token ? { ...base, Authorization: `Bearer ${token}` } : base;
}

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "x-device-id": getDeviceId() },
      });
      if (!res.ok) throw new Error("refresh_failed");
      const data = await res.json() as { token?: string };
      if (!data.token) throw new Error("refresh_failed");
      setToken(data.token);
      return data.token;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

function expireSessionAndThrow(): never {
  clearToken();
  window.dispatchEvent(new CustomEvent("auth:expired"));
  throw new Error("Sesi login berakhir. Silakan login ulang.");
}

async function doFetch(path: string, method: Method, body?: unknown, isUpload = false): Promise<Response> {
  const headers: Record<string, string> = {
    ...(isUpload ? {} : { "Content-Type": "application/json" }),
    ...authHeader(),
  };
  return fetch(`${API_BASE}${path}`, {
    method,
    credentials: "include",
    headers,
    body: isUpload ? (body as FormData | undefined) : (body ? JSON.stringify(body) : undefined),
  });
}

export async function request<T>(path: string, method: Method = "GET", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await doFetch(path, method, body);
  } catch {
    throw new Error("Gagal terhubung ke server. Pastikan backend jalan di port 5000.");
  }

  if (res.status === 401 && path !== "/auth/login" && path !== "/auth/refresh") {
    try {
      await refreshAccessToken();
      res = await doFetch(path, method, body);
    } catch {
      return expireSessionAndThrow();
    }
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    if (res.status === 401) return expireSessionAndThrow();
    const payload = errorBody as { message?: string; errors?: Array<{ msg?: string; path?: string; param?: string }> };
    const first = payload.errors?.[0];
    const field = first?.path || first?.param;
    const detail = first?.msg ? (field ? `${field}: ${first.msg}` : first.msg) : "";
    throw new Error(detail || payload.message || "Request failed");
  }
  return res.json();
}

async function upload(path: string, file: File, fieldName = "avatar", method: Method = "PATCH", extraFields?: Record<string, string>): Promise<any> {
  const fd = new FormData();
  fd.append(fieldName, file);
  if (extraFields) {
    Object.entries(extraFields).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") fd.append(k, v);
    });
  }

  let res: Response;
  try {
    res = await doFetch(path, method, fd, true);
  } catch {
    throw new Error("Gagal terhubung ke server. Pastikan backend jalan di port 5000.");
  }

  if (res.status === 401) {
    try {
      await refreshAccessToken();
      res = await doFetch(path, method, fd, true);
    } catch {
      return expireSessionAndThrow();
    }
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error((errorBody as { message?: string }).message || "Upload failed");
  }
  return res.json();
}

export const api = {
  login: (payload: { username: string; password: string }) => request<{ token: string; user: unknown }>("/auth/login", "POST", payload),
  me: () => request("/auth/me"),
  refresh: () => request<{ token: string }>("/auth/refresh", "POST"),
  logout: () => request<{ message: string }>("/auth/logout", "POST"),
  users: (role?: string) => request(`/users${role ? `?role=${role}` : ""}`),
  createMember: (payload: unknown) => request("/users/members", "POST", payload),
  updateProfile: (payload: { name: string; avatar_url?: string }) => request("/users/me", "PATCH", payload),
  updatePushToken: (pushToken: string) => request("/users/me/push-token", "PATCH", { push_token: pushToken }),
  changePassword: (payload: { current_password: string; new_password: string }) => request("/users/me/password", "PATCH", payload),
  uploadAvatar: (file: File) => upload("/users/me/avatar", file),
  uploadTaskDocumentation: (file: File, taskId?: number) => upload("/tasks/upload-media", file, "media", "POST", taskId ? { task_id: String(taskId) } : undefined),
  uploadTaskDocumentationWithProgress: (
    file: File,
    taskId: number | undefined,
    onProgress: (percent: number) => void,
    onRetry?: (attempt: number) => void,
  ) => new Promise<{ documentation_image_url?: string }>((resolve, reject) => {
    const maxAttempts = 2;
    let attempt = 0;

    const runAttempt = () => {
      attempt += 1;
      const fd = new FormData();
      fd.append("media", file);
      if (taskId) fd.append("task_id", String(taskId));

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/tasks/upload-media`, true);
      const token = getToken();
      if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("x-device-id", getDeviceId());
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        const pct = Math.max(0, Math.min(100, Math.round((e.loaded / e.total) * 100)));
        onProgress(pct);
      };
      xhr.onerror = () => {
        if (attempt < maxAttempts) {
          onRetry?.(attempt + 1);
          onProgress(0);
          runAttempt();
          return;
        }
        reject(new Error("Gagal terhubung ke server. Pastikan backend jalan di port 5000."));
      };
      xhr.onload = () => {
        const status = xhr.status;
        let payload: any = {};
        try {
          payload = xhr.responseText ? JSON.parse(xhr.responseText) : {};
        } catch {
          payload = {};
        }
        if (status >= 200 && status < 300) {
          onProgress(100);
          resolve(payload);
          return;
        }
        if (status === 401) {
          reject(new Error("Sesi login berakhir. Silakan login ulang."));
          return;
        }
        const retryable = status >= 500 || status === 429;
        if (retryable && attempt < maxAttempts) {
          onRetry?.(attempt + 1);
          onProgress(0);
          runAttempt();
          return;
        }
        reject(new Error(payload?.message || "Upload failed"));
      };
      xhr.send(fd);
    };

    runAttempt();
  }),
  tasks: () => request("/tasks"),
  createTask: (payload: unknown) => request("/tasks", "POST", payload),
  updateTask: (taskId: number, payload: unknown) => request(`/tasks/${taskId}`, "PATCH", payload),
  deleteTask: (taskId: number) => request(`/tasks/${taskId}`, "DELETE"),
  assignTechnician: (taskId: number, payload: unknown) => request(`/tasks/${taskId}/assign-technician`, "PATCH", payload),
  updateTaskStatus: (taskId: number, payload: unknown) => request(`/tasks/${taskId}/status`, "PATCH", payload),
  updateTaskProgress: (taskId: number, payload: unknown) => request(`/tasks/${taskId}/progress`, "PATCH", payload),
  reports: () => request("/reports"),
  createReport: (payload: unknown) => request("/reports", "POST", payload),
  reviewReport: (id: number) => request(`/reports/${id}/review`, "PATCH"),
  forwardReport: (id: number) => request(`/reports/${id}/forward`, "PATCH"),
  approveReport: (id: number) => request(`/reports/${id}/approve`, "PATCH"),
  revisionReport: (id: number) => request(`/reports/${id}/revision`, "PATCH"),
  notifications: () => request("/notifications"),
  readAllNotifications: () => request("/notifications/read-all", "PATCH"),
  readNotification: (id: number) => request(`/notifications/${id}/read`, "PATCH"),
  dashboardSummary: () => request("/dashboard/summary"),
  dashboardCharts: () => request("/dashboard/charts"),
  exportData: async (query: string, format: "pdf" | "xls" | "xlsx") => {
    let res = await fetch(`${API_BASE}/dashboard/export${query}`, {
      method: "GET",
      credentials: "include",
      headers: { ...authHeader() },
    });

    if (res.status === 401) {
      try {
        await refreshAccessToken();
        res = await fetch(`${API_BASE}/dashboard/export${query}`, {
          method: "GET",
          credentials: "include",
          headers: { ...authHeader() },
        });
      } catch {
        return expireSessionAndThrow();
      }
    }

    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      throw new Error((errorBody as { message?: string }).message || "Export failed");
    }

    const blob = await res.blob();
    const ext = format === "pdf" ? "pdf" : "xlsx";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `techops-export.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { message: "File downloaded" };
  },
};
