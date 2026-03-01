import api from "./api";
import { TOKEN_KEY } from "./constants";
import type { LoginRequest, LoginResponse, User } from "@/types/auth";

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await api.post<LoginResponse>("/auth/login", data);
  return res.data;
}

export async function verify2fa(tempToken: string, code: string): Promise<string> {
  const res = await api.post<LoginResponse>("/auth/login/2fa", {
    temp_token: tempToken,
    code,
  });
  return res.data.access_token!;
}

export async function getMe(): Promise<User> {
  const res = await api.get<User>("/auth/me");
  return res.data;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } finally {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      document.cookie = "decome_token=; path=/; max-age=0; SameSite=Lax";
    }
  }
}

export function storeToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}
