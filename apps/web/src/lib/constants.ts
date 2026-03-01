export const API_URL =
  typeof window !== "undefined"
    ? "" // Use Next.js rewrites in browser
    : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000");

export const ROLES = {
  ADMIN: "admin",
  BDM: "bdm",
  DIRECTOR: "director",
} as const;

export const TOKEN_KEY = "decome_token";
export const THEME_KEY = "decome_theme";
