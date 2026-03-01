"use client";

import { useEffect, useState } from "react";
import { clearToken, getMe, getToken, logout as doLogout, storeToken } from "@/lib/auth";
import type { User } from "@/types/auth";

interface AuthState {
  user: User | null;
  loading: boolean;
  token: string | null;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = getToken();
    setToken(t);
    if (t) {
      getMe()
        .then(setUser)
        .catch(() => {
          clearToken();
          setUser(null);
          setToken(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(newToken: string) {
    storeToken(newToken);
    setToken(newToken);
    const me = await getMe();
    setUser(me);
  }

  async function logout() {
    await doLogout();
    setUser(null);
    setToken(null);
  }

  return { user, loading, token, login, logout };
}
