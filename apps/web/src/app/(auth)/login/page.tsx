"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { login, storeToken } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { showToast, ToastComponent } = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login({ email, password });
      if (result.requires_2fa && result.temp_token) {
        // Store temp token and redirect to 2FA page
        sessionStorage.setItem("decome_temp_token", result.temp_token);
        router.push("/login/2fa");
      } else if (result.access_token) {
        storeToken(result.access_token);
        // Also set cookie for middleware
        document.cookie = `decome_token=${result.access_token}; path=/; SameSite=Lax`;
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-text-primary">Welcome back</h1>
          <p className="text-text-secondary mt-1 text-sm">Sign in to your account</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error && (
              <p className="text-sm text-red-500 text-center">{error}</p>
            )}

            <Button type="submit" loading={loading} className="w-full mt-2">
              Sign in
            </Button>

            <div className="text-center">
              <Link href="/password-reset" className="text-sm text-action hover:underline">
                Forgot your password?
              </Link>
            </div>
          </form>
        </Card>
      </div>
      <ToastComponent />
    </div>
  );
}
