"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Обзор" },
  { href: "/venues", label: "Заведения" },
  { href: "/staff", label: "Персонал" },
  { href: "/roster", label: "Смены" },
  { href: "/incidents", label: "Инциденты" },
  { href: "/cameras", label: "Камеры" },
  { href: "/sales", label: "Продажи" },
  { href: "/stats", label: "Статистика" },
  { href: "/settings", label: "Настройки" },
];

export function Sidebar({ userName, pendingIncidents }: { userName: string; pendingIncidents: number }) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="sidebar__logo">
        Ordo<span>.</span>
      </div>
      <nav className="sidebar__nav">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={"sidebar__link" + (active ? " sidebar__link--active" : "")}
            >
              {l.label}
              {l.href === "/incidents" && pendingIncidents > 0 && (
                <span style={{ color: "var(--red)", fontFamily: "var(--font-mono)" }}>
                  {" "}
                  {pendingIncidents}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar__foot">{userName}</div>
    </aside>
  );
}
