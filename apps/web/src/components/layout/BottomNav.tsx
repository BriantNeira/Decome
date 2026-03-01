"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: "🏠", roles: ["admin", "bdm", "director"] },
  { href: "/dashboard/settings", label: "Settings", icon: "⚙️", roles: ["admin", "bdm", "director"] },
  { href: "/dashboard/admin/users", label: "Users", icon: "👥", roles: ["admin"] },
  { href: "/dashboard/admin/branding", label: "Brand", icon: "🎨", roles: ["admin"] },
];

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) => user && item.roles.includes(user.role));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border flex">
      {visibleItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`
              flex flex-1 flex-col items-center justify-center py-3 text-xs font-medium transition-colors
              ${active ? "text-action" : "text-text-secondary"}
            `}
          >
            <span className="text-xl mb-1">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
