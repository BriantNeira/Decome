"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { login, storeToken } from "@/lib/auth";
import { parseApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useBranding } from "@/hooks/useBranding";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { showToast, ToastComponent } = useToast();
  const { branding } = useBranding();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login({ email, password });
      if (result.requires_2fa && result.temp_token) {
        sessionStorage.setItem("decome_temp_token", result.temp_token);
        router.push("/login/2fa");
      } else if (result.access_token) {
        storeToken(result.access_token);
        document.cookie = `decome_token=${result.access_token}; path=/; SameSite=Lax`;
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(parseApiError(err, "Login failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex">
      {/* Left decorative panel */}
      <div className="hidden lg:flex flex-col justify-between w-2/5 bg-sidebar p-12">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-active flex items-center justify-center flex-shrink-0">
            <span className="text-white text-sm font-bold leading-none">W</span>
          </div>
          <span className="text-sidebar-text font-semibold tracking-wide">Deminder</span>
        </div>
        <div>
          <p className="text-sidebar-text/60 text-xs uppercase tracking-widest mb-3">Platform</p>
          <h2 className="text-sidebar-text text-3xl font-bold leading-snug drop-shadow-sm">
            BDM Reminder &<br />AI Communications
          </h2>
          <p className="text-sidebar-text/80 mt-4 text-sm leading-relaxed">
            Manage your team, automate outreach, and<br />stay on top of every business opportunity.
          </p>
        </div>
        <p className="text-sidebar-text/40 text-xs">&copy; {new Date().getFullYear()} Deminder</p>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10">
        {/* Logo — always visible on right panel (both mobile and desktop) */}
        <div className="flex flex-col items-center mb-8">
          {branding.logo_light_url ? (
            <img src={branding.logo_light_url} alt="Logo" className="h-10 w-auto mb-3" />
          ) : (
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-action flex items-center justify-center">
                <span className="text-white text-sm font-bold">W</span>
              </div>
              <span className="text-text-primary font-semibold text-lg">Deminder</span>
            </div>
          )}
        </div>

        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-text-primary mb-1">Sign in</h1>
          <p className="text-text-secondary text-sm mb-8">Enter your credentials to access your account.</p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <div>
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <div className="mt-1.5 text-right">
                <Link href="/password-reset" className="text-xs text-text-secondary hover:text-action transition-colors">
                  Forgot password?
                </Link>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}

            <Button type="submit" loading={loading} className="w-full">
              Sign in
            </Button>
          </form>
        </div>
      </div>

      <ToastComponent />
    </div>
  );
}
