export interface Account {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  logo_url: string | null;
}

export interface ContactSummary {
  id: string;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  is_decision_maker: boolean;
}

export interface AssignmentSummary {
  id: string;
  user_id: string;
  bdm_name: string | null;
  bdm_email: string | null;
  program_id: string;
  program_name: string | null;
  is_active: boolean;
}

export interface AccountNote {
  id: string;
  user_id: string;
  author_name: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface AccountDetail {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  is_active: boolean;
  logo_url: string | null;
  assignments: AssignmentSummary[];
  contacts: ContactSummary[];
  notes: AccountNote[];
}

export interface Program {
  id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
  season?: string | null;
  account_id: string | null;
  account_name: string | null;
}

export interface Contact {
  id: string;
  account_id: string;
  account_name: string | null;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  is_decision_maker: boolean;
  program_ids: string[];
  program_names: string[];
}

export interface Assignment {
  id: string;
  user_id: string;
  account_id: string;
  program_id: string;
  is_active: boolean;
  account_name: string | null;
  program_name: string | null;
}

export interface ReminderType {
  id: number;
  name: string;
  description: string | null;
  color: string | null;
  is_active: boolean;
}

export interface CustomFieldDefinition {
  id: number;
  field_name: string;
  field_type: "text" | "number" | "date" | "boolean" | "dropdown";
  entity_type: "account" | "assignment" | "contact";
  is_required: boolean;
  options: { choices?: string[] } | null;
  is_active: boolean;
  sort_order: number;
}

export interface CustomFieldValue {
  definition_id: number;
  field_name: string;
  field_type: string;
  value: string | null;
}

export interface Reminder {
  id: string;
  user_id: string;
  user_name: string | null;
  account_id: string;
  account_name: string | null;
  program_id: string | null;
  program_name: string | null;
  type_id: number | null;
  type_name: string | null;
  type_color: string | null;
  title: string;
  notes: string | null;
  status: "open" | "in_progress" | "completed" | "cancelled";
  start_date: string;
  recurrence_rule: string | null;
  edit_count: number;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReminderStats {
  open: number;
  in_progress: number;
  overdue: number;
  completed_this_month: number;
}

export interface CalendarReminder extends Reminder {
  occurrence_date: string;
}

export interface AccountDocument {
  id: string;
  account_id: string;
  filename: string;
  file_type: string;
  uploaded_at: string;
  uploaded_by_name: string | null;
}

export interface AccountKnowledge {
  account_id: string;
  website: string | null;
  main_email: string | null;
  industry: string | null;
  account_type: string | null;
  observations: string | null;
  updated_at: string;
}

export interface CustomerProfile {
  id: number;
  account_id: string;
  profile_text: string;
  version: number;
  generated_at: string;
  tokens_used: number;
  generated_by: string | null;
}
