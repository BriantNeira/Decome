"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "@/lib/api";
import type { BrandingConfig } from "@/types/branding";

interface BrandingContextValue {
  branding: BrandingConfig;
  refresh: () => Promise<void>;
}

const defaultBranding: BrandingConfig = {
  logo_light_url: null,
  logo_dark_url: null,
  favicon_url: null,
};

const BrandingContext = createContext<BrandingContextValue>({
  branding: defaultBranding,
  refresh: async () => {},
});

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<BrandingConfig>(defaultBranding);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get<BrandingConfig>("/branding");
      setBranding(res.data);
    } catch {
      // Silently fail — use defaults
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <BrandingContext.Provider value={{ branding, refresh }}>
      {children}
    </BrandingContext.Provider>
  );
}

export function useBrandingContext() {
  return useContext(BrandingContext);
}
