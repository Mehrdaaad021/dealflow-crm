"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "▦" },
  { href: "/companies", label: "Companies", icon: "🏢" },
  { href: "/pipeline", label: "Pipeline", icon: "🎯" },
  { href: "/leads", label: "Leads", icon: "📥" },
  { href: "/tasks", label: "Tasks", icon: "✅" },
  { href: "/quotations", label: "Quotations", icon: "🧾" },
  { href: "/catalog", label: "Catalog", icon: "📦" },
  { href: "/analytics", label: "Analytics", icon: "📈" },
];

const ROLE_LABEL: Record<string, string> = {
  sales_rep: "Sales Rep",
  sales_manager: "Sales Manager",
  admin: "Admin",
};

export function AppShell(props: {
  user: {
    name?: string | null;
    email?: string | null;
    role?: string | null;
  } | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  // No shell on the login page or when signed out
  if (pathname.startsWith("/login") || !props.user) {
    return <>{props.children}</>;
  }

  const displayName = props.user.name ?? props.user.email ?? "User";
  const initials = displayName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#faf7f2]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-[#122f2a] text-white md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-400 text-lg font-bold text-[#122f2a]">
            
          </span>
          <div>
            <p className="text-sm font-bold">Dealflow</p>
            <p className="text-[11px] text-white/60">Revenue workspace</p>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-1 px-3">
          {NAV.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-white text-[#122f2a]"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span aria-hidden>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="m-3 rounded-lg bg-white/10 p-3 text-[11px] text-white/70">
          <p className="font-bold uppercase tracking-wider text-white/90">
            Demo data
          </p>
          <p className="mt-1">Fictional records for your portfolio workspace.</p>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col md:pl-64">
        <header className="sticky top-0 z-30 border-b border-[#eee7dc] bg-[#faf7f2]/90 backdrop-blur">
          <div className="flex items-center justify-between px-6 py-3">
            <span className="flex items-center gap-2 text-xs text-[#5c6b66]">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Live workspace
            </span>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold text-[#122f2a]">
                  {displayName}
                </p>
                <p className="text-[11px] text-[#5c6b66]">{props.user.email}</p>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1f6f5c]/15 text-xs font-bold text-[#1f6f5c]">
                {initials}
              </span>
              <span className="hidden rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900 sm:inline">
                {ROLE_LABEL[props.user.role ?? ""] ?? props.user.role}
              </span>
              <button
                onClick={() => void signOut({ callbackUrl: "/login" })}
                className="text-sm font-medium text-[#5c6b66] hover:text-[#122f2a]"
              >
                Sign out
              </button>
            </div>
          </div>
          <nav className="flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
            {NAV.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${
                    active
                      ? "bg-[#122f2a] text-white"
                      : "bg-white text-[#122f2a] shadow-sm"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="flex-1">{props.children}</main>
      </div>
    </div>
  );
}