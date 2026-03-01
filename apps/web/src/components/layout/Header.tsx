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
  // Remove-and-recreate the <link> element to force browser to re-fetch
  // (browsers cache favicons and ignore simple href mutations).
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
    <header className="h-16 border-b border-border bg-surface flex items-center px-6 gap-4">
      {/* Logo — mobile only (sidebar has it on desktop) */}
      <div className="md:hidden">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-8 w-auto" />
        ) : (
          <span className="font-semibold text-text-primary">DecoMe</span>
        )}
      </div>

      {/* Page title */}
      {title && (
        <h1 className="flex-1 text-base font-semibold text-text-primary hidden md:block">{title}</h1>
      )}
      <div className="flex-1 md:hidden" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
