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
      { href: "/dashboard", label: "Dashboard", roles: ["admin", "bdm", "director"] },
    ],
  },
  {
    label: "My Work",
    items: [
      { href: "/dashboard/my-assignments",        label: "My Assignments", roles: ["bdm"] },
      { href: "/dashboard/admin/programs",        label: "Programs",       roles: ["bdm"] },
      { href: "/dashboard/reminders",             label: "Reminders",      roles: ["bdm"] },
      { href: "/dashboard/reminders/calendar",    label: "Calendar",       roles: ["bdm"] },
    ],
  },
  {
    label: "Management",
    items: [
      { href: "/dashboard/admin/accounts",        label: "Accounts",       roles: ["admin", "director"] },
      { href: "/dashboard/admin/contacts",        label: "Contacts",       roles: ["admin", "bdm"] },
      { href: "/dashboard/admin/programs",        label: "Programs",       roles: ["admin", "director"] },
      { href: "/dashboard/reminders",             label: "Reminders",      roles: ["admin"] },
      { href: "/dashboard/reminders/calendar",    label: "Calendar",       roles: ["admin"] },
      { href: "/dashboard/admin/bulk-import",    label: "Bulk Import",    roles: ["admin"] },
      { href: "/dashboard/kpis",                 label: "KPIs & Analytics", roles: ["admin", "director"] },
    ],
  },
  {
    label: "Settings",
    items: [
      { href: "/dashboard/admin/users",          label: "Users",          roles: ["admin"] },
      { href: "/dashboard/admin/assignments",    label: "Assignments",    roles: ["admin", "director"] },
      { href: "/dashboard/admin/reminder-types", label: "Reminder Types", roles: ["admin"] },
      { href: "/dashboard/admin/custom-fields",  label: "Custom Fields",  roles: ["admin"] },
      { href: "/dashboard/admin/branding",           label: "Branding",       roles: ["admin"] },
      { href: "/dashboard/admin/email-settings",  label: "Email Settings", roles: ["admin"] },
      { href: "/dashboard/admin/llm-config",      label: "LLM Settings",   roles: ["admin"] },
      { href: "/dashboard/admin/templates",       label: "Templates",      roles: ["admin", "bdm", "director"] },
      { href: "/dashboard/admin/budgets",        label: "Token Budgets",  roles: ["admin"] },
      { href: "/dashboard/settings",              label: "My Settings",    roles: ["admin", "bdm", "director"] },
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
        ${active ? "text-sidebar-active" : "text-sidebar-text hover:text-sidebar-active"}
      `}
    >
      {active && <span className="absolute inset-0 rounded-lg bg-sidebar-active/20" />}
      <span className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 bg-white/4 transition-opacity duration-150" />
      {/* Left accent bar — active only */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r-full bg-sidebar-active" />
      )}
      {/* Label with underline on hover */}
      <span
        className="relative"
        style={{
          textDecoration: "none",
          borderBottom: "2px solid transparent",
          paddingBottom: "1px",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={(e) => {
          if (!active) (e.currentTarget as HTMLElement).style.borderBottomColor = "var(--color-nav-underline)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderBottomColor = "transparent";
        }}
      >
        {label}
      </span>
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
      {/* Logo — always show badge/logo + "Deminder" name */}
      <div className="flex items-center h-16 px-6">
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-7 w-auto max-w-[32px] object-contain flex-shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-sidebar-active flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold leading-none">D</span>
            </div>
          )}
          <span className="font-semibold text-sidebar-text tracking-wide text-sm">Deminder</span>
        </div>
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
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-text opacity-50 select-none">
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
          <p className="text-xs font-semibold text-sidebar-text truncate">{user?.full_name}</p>
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
