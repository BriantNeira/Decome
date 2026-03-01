"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { FileUpload } from "@/components/ui/FileUpload";
import { useToast } from "@/components/ui/Toast";
import { useBranding } from "@/hooks/useBranding";
import { RoleGuard } from "@/components/layout/RoleGuard";
import api from "@/lib/api";

export default function BrandingPage() {
  return (
    <RoleGuard allowedRoles={["admin"]} fallback={<p className="text-red-500">Access denied.</p>}>
      <BrandingContent />
    </RoleGuard>
  );
}

function BrandingContent() {
  const { branding, refresh } = useBranding();
  const { showToast, ToastComponent } = useToast();
  const [uploadingLogo, setUploadingLogo] = useState<"light" | "dark" | null>(null);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);

  async function uploadLogo(file: File, variant: "light" | "dark") {
    setUploadingLogo(variant);
    const form = new FormData();
    form.append("file", file);
    try {
      await api.post(`/branding/logo?variant=${variant}`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showToast(`${variant === "light" ? "Light" : "Dark"} logo updated.`, "success");
      refresh();
    } catch (err: any) {
      showToast(err.response?.data?.detail ?? "Upload failed.", "error");
    } finally {
      setUploadingLogo(null);
    }
  }

  async function uploadFavicon(file: File) {
    setUploadingFavicon(true);
    const form = new FormData();
    form.append("file", file);
    try {
      await api.post("/branding/favicon", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      showToast("Favicon updated.", "success");
      refresh();
    } catch (err: any) {
      showToast(err.response?.data?.detail ?? "Upload failed.", "error");
    } finally {
      setUploadingFavicon(false);
    }
  }

  async function deleteLogo(variant: "light" | "dark") {
    try {
      await api.delete(`/branding/logo?variant=${variant}`);
      showToast(`${variant === "light" ? "Light" : "Dark"} logo removed.`, "success");
      refresh();
    } catch {
      showToast("Delete failed.", "error");
    }
  }

  async function deleteFavicon() {
    try {
      await api.delete("/branding/favicon");
      showToast("Favicon removed.", "success");
      refresh();
    } catch {
      showToast("Delete failed.", "error");
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-text-primary mb-6">Branding</h1>

      {/* Logo Light */}
      <Card className="mb-4">
        <h2 className="font-medium text-text-primary mb-1">Logo — Light Mode</h2>
        <p className="text-xs text-text-secondary mb-4">SVG or PNG · max 2 MB</p>
        {branding.logo_light_url && (
          <div className="mb-4 flex items-center gap-4">
            <img src={branding.logo_light_url} alt="Light logo" className="h-12 w-auto border border-border rounded-lg p-2" />
            <Button variant="secondary" size="sm" onClick={() => deleteLogo("light")}>Remove</Button>
          </div>
        )}
        {uploadingLogo === "light" ? (
          <p className="text-sm text-text-secondary">Uploading...</p>
        ) : (
          <FileUpload accept=".svg,.png" maxSizeMB={2} label="Choose logo" onFile={(f) => uploadLogo(f, "light")} />
        )}
      </Card>

      {/* Logo Dark */}
      <Card className="mb-4">
        <h2 className="font-medium text-text-primary mb-1">Logo — Dark Mode</h2>
        <p className="text-xs text-text-secondary mb-4">SVG or PNG · max 2 MB · optional (falls back to light logo)</p>
        {branding.logo_dark_url && (
          <div className="mb-4 flex items-center gap-4 bg-gray-900 rounded-lg p-3">
            <img src={branding.logo_dark_url} alt="Dark logo" className="h-12 w-auto" />
            <Button variant="secondary" size="sm" onClick={() => deleteLogo("dark")}>Remove</Button>
          </div>
        )}
        {uploadingLogo === "dark" ? (
          <p className="text-sm text-text-secondary">Uploading...</p>
        ) : (
          <FileUpload accept=".svg,.png" maxSizeMB={2} label="Choose dark logo" onFile={(f) => uploadLogo(f, "dark")} />
        )}
      </Card>

      {/* Favicon */}
      <Card>
        <h2 className="font-medium text-text-primary mb-1">Favicon</h2>
        <p className="text-xs text-text-secondary mb-4">PNG or ICO · max 500 KB</p>
        {branding.favicon_url && (
          <div className="mb-4 flex items-center gap-4">
            <img src={branding.favicon_url} alt="Favicon" className="h-8 w-8 border border-border rounded" />
            <Button variant="secondary" size="sm" onClick={deleteFavicon}>Remove</Button>
          </div>
        )}
        {uploadingFavicon ? (
          <p className="text-sm text-text-secondary">Uploading...</p>
        ) : (
          <FileUpload accept=".png,.ico" maxSizeMB={0.5} label="Choose favicon" onFile={uploadFavicon} />
        )}
      </Card>

      <ToastComponent />
    </div>
  );
}
