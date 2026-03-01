"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "🏠", roles: ["admin", "bdm", "director"] },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️", roles: ["admin", "bdm", "director"] },
  { href: "/dashboard/admin/users", label: "Users", icon: "👥", roles: ["admin"] },
  { href: "/dashboard/admin/branding", label: "Branding", icon: "🎨", roles: ["admin"] },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  const visibleItems = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen bg-surface border-r border-border">
      <div className="flex items-center h-16 px-6 border-b border-border">
        <span className="font-semibold text-lg text-text-primary">DecoMe</span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {visibleItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? "bg-action/10 text-action"
                  : "text-text-secondary hover:bg-bg hover:text-text-primary"
                }
              `}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="mb-3 px-3">
          <p className="text-sm font-medium text-text-primary truncate">{user?.full_name}</p>
          <p className="text-xs text-text-secondary truncate capitalize">{user?.role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <span>↩</span> Sign out
        </button>
      </div>
    </aside>
  );
}
