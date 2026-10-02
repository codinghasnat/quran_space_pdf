"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, BookOpenCheck, Flame, LayoutGrid, Settings2 } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { addDays } from "@/lib/dates";
import { useHifz } from "@/lib/hifz/store";
import { useToday } from "@/lib/hifz/useJourney";

const NAV = [
  { href: "/today", label: "Today", icon: BookOpenCheck },
  { href: "/mushaf", label: "Mushaf", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: LayoutGrid },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

/** Consecutive days with a recitation, counting back from today (or yesterday while today is still open). */
export function streakDays(days: Set<string>, today: string): number {
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export default function AppShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const path = usePathname();
  const data = useHifz();
  const today = useToday();
  const streak = data ? streakDays(new Set(data.recitations.map((r) => r.day)), today) : 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur-xl">
        <div className={`mx-auto flex h-16 items-center gap-2 px-5 ${wide ? "max-w-[1280px]" : "max-w-[1100px]"}`}>
          <Link href="/today" className="mr-4 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal font-quran text-lg text-bg glow-soft">ح</span>
            <span className="font-serif text-xl tracking-tight">Hifz</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = path === href || (href !== "/today" && path.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-sm transition-colors ${
                    active ? "bg-teal/10 font-medium text-teal" : "text-parchment-muted hover:text-parchment"
                  }`}
                >
                  <Icon size={16} />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="flex-1" />
          <div
            title="Days in a row"
            className={`flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium ${
              streak > 0 ? "bg-hint/10 text-hint" : "bg-parchment-muted/10 text-parchment-muted"
            }`}
          >
            <Flame size={15} className={streak > 0 ? "drop-shadow-[0_0_6px_rgb(var(--hint)/0.6)]" : ""} /> {streak}
          </div>
          <Link
            href="/settings"
            aria-label="Settings"
            className={`flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors ${
              path === "/settings" ? "bg-teal text-bg" : "bg-surface text-parchment-muted hover:text-teal"
            }`}
          >
            <Settings2 size={16} />
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className={`mx-auto px-5 pb-24 ${wide ? "max-w-[1280px]" : "max-w-[1100px]"}`}>{children}</main>
    </div>
  );
}
