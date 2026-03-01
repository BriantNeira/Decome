"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { verify2fa, storeToken } from "@/lib/auth";

export default function TwoFAPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const tempToken = sessionStorage.getItem("decome_temp_token");
    if (!tempToken) router.replace("/login");
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    const tempToken = sessionStorage.getItem("decome_temp_token");
    if (!tempToken) { router.replace("/login"); return; }

    setLoading(true);
    try {
      const token = await verify2fa(tempToken, code);
      sessionStorage.removeItem("decome_temp_token");
      storeToken(token);
      document.cookie = `decome_token=${token}; path=/; SameSite=Lax`;
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Invalid code. Try again.");
      setCode("");
    } finally {
      setLoading(false);
    }
  }

  function handleCodeChange(val: string) {
    const digits = val.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    if (digits.length === 6) {
      // Auto-submit
      setTimeout(() => {
        document.getElementById("2fa-form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      }, 100);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Two-Factor Authentication</h1>
          <p className="text-text-secondary mt-1 text-sm">Enter the 6-digit code from your authenticator app</p>
        </div>

        <Card>
          <form id="2fa-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              ref={inputRef}
              label="Authentication Code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              placeholder="000000"
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
              required
            />
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
            <Button type="submit" loading={loading} className="w-full">
              Verify
            </Button>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="text-sm text-text-secondary hover:text-text-primary text-center"
            >
              ← Back to login
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
