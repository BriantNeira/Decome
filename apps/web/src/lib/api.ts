import axios from "axios";
import { TOKEN_KEY } from "./constants";

const api = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

// Attach JWT on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle 401 globally — clear token and redirect to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      const isAuthRoute =
        window.location.pathname.startsWith("/login") ||
        window.location.pathname.startsWith("/password-reset");
      if (!isAuthRoute) {
        localStorage.removeItem(TOKEN_KEY);
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

/** Normalize FastAPI error responses to a plain string.
 *  - HTTPException: detail is a string → use as-is
 *  - Pydantic 422: detail is an array of {msg, ...} → join .msg fields
 */
export function parseApiError(err: any, fallback = "An error occurred."): string {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: any) => (typeof d?.msg === "string" ? d.msg : String(d))).join("; ");
  }
  return fallback;
}

export default api;
