export interface EmailConfig {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  from_email: string | null;
  from_name: string | null;
  use_tls: boolean;
  is_active: boolean;
  updated_at: string | null;
}

export interface EmailAlertLog {
  id: number;
  reminder_id: string;
  reminder_title: string | null;
  alert_type: "7_day" | "1_day" | "overdue";
  sent_to: string;
  status: "sent" | "failed";
  error_message: string | null;
  sent_at: string;
}

export interface EmailAlertLogListResponse {
  items: EmailAlertLog[];
  total: number;
}

export interface AlertRunResult {
  sent: number;
  failed: number;
  skipped: string | null;
}
