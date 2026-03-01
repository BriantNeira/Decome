"use client";

import { useEffect, useState } from "react";
import { THEME_KEY } from "@/lib/constants";

type Theme = "day" | "night";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("day");

  useEffect(() => {
    const stored = (localStorage.getItem(THEME_KEY) as Theme) ?? "day";
    applyTheme(stored);
    setTheme(stored);
  }, []);

  function toggleTheme() {
    const next: Theme = theme === "day" ? "night" : "day";
    applyTheme(next);
    setTheme(next);
    localStorage.setItem(THEME_KEY, next);
  }

  return { theme, toggleTheme };
}

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}
