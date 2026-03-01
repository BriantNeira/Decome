"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useBranding } from "@/hooks/useBranding";
import { useTheme } from "@/hooks/useTheme";

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: "/dashboard",          label: "Dashboard", roles: ["admin", "bdm", "director"] },
      { href: "/dashboard/settings", label: "Settings",  roles: ["admin", "bdm", "director"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/dashboard/admin/users",    label: "Users",    roles: ["admin"] },
      { href: "/dashboard/admin/branding", label: "Branding", roles: ["admin"] },
    ],
  },
];

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  return (
    <Link
      href={href}
      className={`
        relative flex items-center px-3 py-2.5 rounded-lg text-sm font-medium
        transition-all duration-150 group
        ${active ? "text-white" : "text-sidebar-text hover:text-white"}
      `}
    >
      {active && <span className="absolute inset-0 rounded-lg bg-sidebar-active/25" />}
      <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 bg-white/5 transition-opacity duration-150" />
      <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-sidebar-active transition-all duration-150 ${active ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`} />
      <span className="relative">{label}</span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const { theme } = useTheme();

  const logoUrl = theme === "night" && branding.logo_dark_url
    ? branding.logo_dark_url
    : branding.logo_light_url;

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <aside className="hidden md:flex flex-col w-60 min-h-screen bg-sidebar">
      {/* Logo */}
      <div className="flex items-center h-16 px-6">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-7 w-auto max-w-[140px] object-contain" />
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-sidebar-active flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold leading-none">D</span>
            </div>
            <span className="font-semibold text-white tracking-wide text-sm">DecoMe</span>
          </div>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-5 space-y-5">
        {NAV_GROUPS.map((group, gi) => {
          const visibleItems = group.items.filter(
            (item) => user && item.roles.includes(user.role)
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={gi}>
              {group.label && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-white/30 select-none">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {visibleItems.map((item) => (
                  <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-5 space-y-0.5">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-semibold text-white truncate">{user?.full_name}</p>
          <p className="text-xs text-sidebar-text truncate capitalize">{user?.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-2.5 text-sm text-sidebar-text hover:text-red-400 rounded-lg transition-all duration-150 hover:bg-red-500/10"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
