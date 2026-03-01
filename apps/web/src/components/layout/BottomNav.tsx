"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { href: "/dashboard",                label: "Dashboard", roles: ["admin", "bdm", "director"] },
  { href: "/dashboard/settings",       label: "Settings",  roles: ["admin", "bdm", "director"] },
  { href: "/dashboard/admin/users",    label: "Users",     roles: ["admin"] },
  { href: "/dashboard/admin/branding", label: "Branding",  roles: ["admin"] },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border flex">
      {visibleItems.map((item) => {
        const active = pathname === item.href
          || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              relative flex flex-1 flex-col items-center justify-center py-3 text-xs font-medium
              transition-colors duration-150
              ${active ? "text-action" : "text-text-secondary hover:text-text-primary"}
            `}
          >
            {active && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full bg-action" />
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
