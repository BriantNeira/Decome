export interface User {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "bdm" | "director";
  is_active: boolean;
  totp_enabled: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token?: string;
  token_type?: string;
  requires_2fa: boolean;
  temp_token?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  role: "admin" | "bdm" | "director";
}
