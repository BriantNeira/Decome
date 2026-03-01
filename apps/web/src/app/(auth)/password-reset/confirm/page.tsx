"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import api, { parseApiError } from "@/lib/api";

export default function PasswordResetConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      await api.post("/auth/password-reset/confirm", { token, new_password: password });
      setDone(true);
    } catch (err: any) {
      setError(parseApiError(err, "Reset failed. The link may have expired."));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <p className="text-red-500">Invalid reset link.</p>
          <Link href="/password-reset" className="text-action hover:underline mt-4 block text-sm">
            Request a new one
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Set new password</h1>
        </div>
        <Card>
          {done ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">✅</div>
              <p className="text-text-secondary text-sm mb-4">Password updated successfully.</p>
              <button onClick={() => router.push("/login")} className="text-action hover:underline text-sm">
                Sign in
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="New Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
              <Input
                label="Confirm Password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <Button type="submit" loading={loading} className="w-full">
                Update password
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
