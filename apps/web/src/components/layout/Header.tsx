"use client";

import { useEffect } from "react";
import { useBranding } from "@/hooks/useBranding";
import { useTheme } from "@/hooks/useTheme";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { branding } = useBranding();
  const { theme } = useTheme();

  const logoUrl = theme === "night" && branding.logo_dark_url
    ? branding.logo_dark_url
    : branding.logo_light_url;

  // Sync favicon with branding config.
  useEffect(() => {
    const existing = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (existing) existing.remove();
    if (!branding.favicon_url) return;
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = `${branding.favicon_url}?v=${Date.now()}`;
    document.head.appendChild(link);
  }, [branding.favicon_url]);

  return (
    <header className="h-14 border-b border-border bg-surface/80 backdrop-blur-sm flex items-center px-6 gap-4 sticky top-0 z-30">
      {/* Logo — mobile only */}
      <div className="md:hidden flex items-center gap-2">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-7 w-auto" />
        ) : (
          <span className="font-semibold text-sm text-text-primary">DecoMe</span>
        )}
      </div>

      {title && (
        <h1 className="flex-1 text-sm font-semibold text-text-primary hidden md:block tracking-wide">{title}</h1>
      )}
      <div className="flex-1 md:hidden" />

      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
