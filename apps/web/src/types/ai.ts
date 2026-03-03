export interface LLMConfig {
  provider: string;
  model: string;
  api_key_set: boolean;
  max_tokens_per_request: number;
  is_active: boolean;
  updated_at: string;
}

export interface LLMConfigUpdate {
  provider?: string;
  api_key?: string;
  model?: string;
  max_tokens_per_request?: number;
  is_active?: boolean;
}

export interface EmailTemplate {
  id: string;
  name: string;
  description: string | null;
  subject_template: string;
  body_template: string;
  is_active: boolean;
  reminder_type_id: number | null;
  reminder_type_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateListResponse {
  items: EmailTemplate[];
  total: number;
}

export interface TokenBudget {
  id: number;
  user_id: string;
  monthly_limit: number;
}

export interface BudgetUsageSummary {
  user_id: string;
  user_name: string;
  user_email: string;
  monthly_limit: number;
  tokens_used_this_month: number;
  remaining: number | null;
  budget_id: number | null;
}

export interface Contact {
  id: string;
  account_id: string;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_decision_maker: boolean;
}

export interface GeneratedMessage {
  id: string;
  reminder_id: string;
  template_id: string | null;
  contact_id: string | null;
  contact_name: string | null;
  tone: string;
  subject: string;
  body: string;
  tokens_used: number;
  generated_at: string;
  generated_by: string;
  sent_at: string | null;
  sent_to_email: string | null;
}

export type Tone = "formal" | "friendly" | "direct";

export interface ImportRowResult {
  row_num: number;
  status: "ok" | "error" | "skipped";
  error_msg: string | null;
  entity_name: string | null;
  account: string;
  program: string;
  reminder_type: string;
  title: string;
  due_date: string;
  reminder_id: string | null;
}

export interface ImportResponse {
  total_rows: number;
  valid_rows: number;
  error_rows: number;
  skipped_rows?: number;
  rows: ImportRowResult[];
  created: number;
}

export const TEMPLATE_VARIABLES = [
  { key: "account_name", label: "Account" },
  { key: "contact_name", label: "Contact Name" },
  { key: "contact_email", label: "Contact Email" },
  { key: "program_name", label: "Program" },
  { key: "bdm_name", label: "My Name" },
  { key: "bdm_email", label: "My Email" },
  { key: "reminder_title", label: "Reminder Title" },
  { key: "reminder_notes", label: "Notes" },
  { key: "due_date", label: "Due Date" },
];

export interface GraphEmailConfig {
  tenant_id: string | null;
  client_id: string | null;
  client_secret_set: boolean;
  from_email: string | null;
  is_active: boolean;
  updated_at: string | null;
}

/* ── KPI types (match backend KPISummary flat response) ──── */

export interface KpiByType {
  type_id: number | null;
  type_name: string;
  type_color: string | null;
  total: number;
  completed: number;
  overdue: number;
}

export interface KpiByAccount {
  account_id: string;
  account_name: string;
  total: number;
  completed: number;
  overdue: number;
  on_time_pct: number;
}

export interface KpiByBdm {
  user_id: string;
  user_name: string;
  user_email: string;
  total: number;
  completed: number;
  overdue: number;
  messages_generated: number;
  tokens_used: number;
}

export interface KpiTokenBdm {
  name: string;
  tokens: number;
  messages: number;
}

export interface KpiTokenSummary {
  total_tokens: number;
  by_bdm: KpiTokenBdm[];
}

export interface KpiResponse {
  date_from: string;
  date_to: string;
  completed_on_time: number;
  completed_late: number;
  completion_rate: number;
  overdue_pending: number;
  total_open: number;
  total_completed: number;
  by_type: KpiByType[];
  by_account: KpiByAccount[];
  by_program: { program_id: string | null; program_name: string; account_name: string; total: number; completed: number; overdue: number }[];
  by_bdm: KpiByBdm[];
  token_summary: KpiTokenSummary;
}

export interface KpiDiagnosis {
  diagnosis: string;
  tokens_used: number;
}

/* ── Extended KPI types ────────────────────────────────── */

export interface KPITypeSummary {
  type_name: string;
  type_color: string | null;
  total: number;
  completed: number;
  overdue: number;
}

export interface KPIAccountSummary {
  account_name: string;
  total: number;
  completed: number;
  overdue: number;
  on_time_pct: number;
}

export interface KPIProgramSummary {
  program_name: string;
  account_name: string;
  total: number;
  completed: number;
  overdue: number;
}

export interface KPIBDMSummary {
  bdm_name: string;
  bdm_email: string;
  total: number;
  completed: number;
  overdue: number;
  tokens_used: number;
  messages_generated: number;
}

export interface KPITokenBDM {
  name: string;
  tokens: number;
  messages: number;
}

export interface KPITokenSummary {
  total_tokens: number;
  by_bdm: KPITokenBDM[];
}

export interface KPISummary {
  date_from: string;
  date_to: string;
  completed_on_time: number;
  completed_late: number;
  completion_rate: number;
  overdue_pending: number;
  total_open: number;
  total_completed: number;
  by_type: KPITypeSummary[];
  by_account: KPIAccountSummary[];
  by_program: KPIProgramSummary[];
  by_bdm: KPIBDMSummary[];
  token_summary: KPITokenSummary;
}

export interface DiagnosisResponse {
  diagnosis: string;
  tokens_used: number;
}
