"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/lobby", label: "Play" },
  { href: "/room/demo-room", label: "Room" },
  { href: "/game/demo-room", label: "Game" },
  { href: "/extras", label: "Extras" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideTopbar = pathname?.startsWith("/game/");

  return (
    <>
      <div className="bg-decor" />
      <div className="app">
        {!hideTopbar && (
          <header className="topbar">
            <div className="logo">
              <div className="badge">N</div>
              <div className="badge b2">🏠</div>
              <span className="word">Noni&apos;s Card House</span>
            </div>
            <nav className="nav">
              {NAV.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={active ? "active" : ""}
                    style={{
                      textDecoration: "none",
                      fontFamily: "Fredoka, sans-serif",
                      fontWeight: 600,
                      color: active ? "#1a0a40" : "var(--ink-dim)",
                      background: active ? "var(--ink)" : "transparent",
                      borderRadius: 10,
                      padding: "8px 14px",
                      fontSize: 14,
                    }}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>
        )}
        {children}
      </div>
    </>
  );
}
