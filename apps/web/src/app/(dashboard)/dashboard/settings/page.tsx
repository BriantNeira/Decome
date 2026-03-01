"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import api from "@/lib/api";
import { QRCodeSVG } from "qrcode.react";

export default function SettingsPage() {
  const { user } = useAuth();
  const { showToast, ToastComponent } = useToast();

  // 2FA state machine: idle | setup | enabling | done
  const [twoFAState, setTwoFAState] = useState<"idle" | "setup" | "enabling">("idle");
  const [qrUri, setQrUri] = useState("");
  const [secret, setSecret] = useState("");
  const [enableCode, setEnableCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDisable, setShowDisable] = useState(false);

  async function startSetup() {
    setLoading(true);
    try {
      const res = await api.post<{ uri: string; secret: string }>("/auth/2fa/setup");
      setQrUri(res.data.uri);
      setSecret(res.data.secret);
      setTwoFAState("setup");
    } catch (err: any) {
      showToast(err.response?.data?.detail ?? "Failed to start 2FA setup.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function enable2fa() {
    setLoading(true);
    try {
      await api.post("/auth/2fa/enable", { code: enableCode });
      showToast("2FA enabled successfully.", "success");
      setTwoFAState("idle");
      setEnableCode("");
      window.location.reload();
    } catch (err: any) {
      showToast(err.response?.data?.detail ?? "Invalid code.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function disable2fa() {
    setLoading(true);
    try {
      await api.post("/auth/2fa/disable", { code: disableCode });
      showToast("2FA disabled.", "success");
      setShowDisable(false);
      setDisableCode("");
      window.location.reload();
    } catch (err: any) {
      showToast(err.response?.data?.detail ?? "Invalid code.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-text-primary mb-6">Settings</h1>

      {/* Profile */}
      <Card className="mb-4">
        <h2 className="font-medium text-text-primary mb-3">Profile</h2>
        <div className="space-y-2 text-sm">
          <div className="flex gap-4">
            <span className="text-text-secondary w-24">Name</span>
            <span className="text-text-primary">{user?.full_name}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-text-secondary w-24">Email</span>
            <span className="text-text-primary">{user?.email}</span>
          </div>
          <div className="flex gap-4">
            <span className="text-text-secondary w-24">Role</span>
            <span className="text-text-primary capitalize">{user?.role}</span>
          </div>
        </div>
      </Card>

      {/* 2FA */}
      <Card>
        <h2 className="font-medium text-text-primary mb-3">Two-Factor Authentication</h2>

        {user?.totp_enabled ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md">
                ✓ Enabled
              </span>
            </div>
            {!showDisable ? (
              <Button variant="danger" size="sm" onClick={() => setShowDisable(true)}>
                Disable 2FA
              </Button>
            ) : (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-text-secondary">Enter your current authenticator code to disable 2FA:</p>
                <Input
                  label="Verification Code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="max-w-xs"
                />
                <div className="flex gap-2">
                  <Button variant="danger" size="sm" loading={loading} onClick={disable2fa}>
                    Confirm Disable
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowDisable(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : twoFAState === "idle" ? (
          <div>
            <p className="text-sm text-text-secondary mb-4">
              Protect your account with a time-based one-time password (TOTP).
            </p>
            <Button size="sm" loading={loading} onClick={startSetup}>
              Enable 2FA
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-text-secondary">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
            </p>
            {qrUri && (
              <div className="p-4 bg-white rounded-xl inline-block">
                <QRCodeSVG value={qrUri} size={180} />
              </div>
            )}
            <details className="text-xs text-text-secondary">
              <summary className="cursor-pointer">Manual entry key</summary>
              <code className="mt-1 block font-mono break-all">{secret}</code>
            </details>
            <Input
              label="Verification Code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={enableCode}
              onChange={(e) => setEnableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="max-w-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" loading={loading} onClick={enable2fa}>
                Verify & Enable
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setTwoFAState("idle")}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
      <ToastComponent />
    </div>
  );
}
