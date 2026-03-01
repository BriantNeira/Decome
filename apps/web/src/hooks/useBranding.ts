"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { BrandingConfig } from "@/types/branding";

export function useBranding() {
  const [branding, setBranding] = useState<BrandingConfig>({
    logo_light_url: null,
    logo_dark_url: null,
    favicon_url: null,
  });

  async function refresh() {
    try {
      const res = await api.get<BrandingConfig>("/branding");
      setBranding(res.data);
    } catch {
      // Silently fail — use defaults
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return { branding, refresh };
}
