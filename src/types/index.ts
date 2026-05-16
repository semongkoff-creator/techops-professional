export type Role = "staff" | "atasan" | "supervisor" | "teknisi" | "technician";

export type User = {
  id: number;
  name: string;
  username: string;
  email?: string;
  phone_number?: string | null;
  role: Role;
  avatar_url?: string | null;
};

export type Task = {
  id: number;
  code: string;
  title: string;
  description: string;
  customer?: string | null;
  location: string;
  priority: "low" | "medium" | "high";
  status: "draft_to_supervisor" | "assigned_to_technician" | "in_progress" | "completed" | "closed";
  created_by_atasan_id?: number | null;
  supervisor_id: number;
  technician_id?: number | null;
  due_date?: string | null;
  completion_percent: number;
  documentation_image_url?: string | null;
};

export type Report = {
  id: number;
  task_id: number;
  report_date: string;
  progress_percent: number;
  issue_text?: string | null;
  summary_text: string;
  report_status: "submitted_by_technician" | "reviewed_by_supervisor" | "forwarded_to_atasan" | "approved_by_atasan" | "needs_revision";
  task_code?: string;
  task_title?: string;
};

export type Notification = {
  id: number;
  title: string;
  message: string;
  is_read: boolean | number | string;
  created_at: string;
};
