"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import api from "@/lib/api";

export default function PasswordResetPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/password-reset/request", { email });
    } finally {
      // Always show success (security: don't reveal if email exists)
      setSent(true);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Reset password</h1>
          <p className="text-text-secondary mt-1 text-sm">
            {sent ? "Check your email for a reset link." : "Enter your email to receive a reset link."}
          </p>
        </div>

        <Card>
          {sent ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">✅</div>
              <p className="text-text-secondary text-sm mb-4">
                If an account exists for <strong>{email}</strong>, you will receive a reset link shortly.
              </p>
              <Link href="/login" className="text-action hover:underline text-sm">
                Back to login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" loading={loading} className="w-full">
                Send reset link
              </Button>
              <div className="text-center">
                <Link href="/login" className="text-sm text-text-secondary hover:text-text-primary">
                  ← Back to login
                </Link>
              </div>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
