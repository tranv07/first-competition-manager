"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function WorkspaceNav({
  competitionId,
  canManageUsers,
  canAdmin,
}: {
  competitionId: string;
  canManageUsers: boolean;
  canAdmin?: boolean;
}) {
  const pathname = usePathname();
  const navItems = [
    { href: "/workspace", label: "Overview", glyph: "O" },
    { href: "/workspace/events", label: "Event", glyph: "E" },
    { href: "/workspace/teams", label: "Teams", glyph: "T" },
    { href: "/workspace/matches", label: "Matches", glyph: "M" },
    { href: "/workspace/rankings", label: "Rankings", glyph: "R" },
    ...(canAdmin
      ? [{ href: "/workspace/admin", label: "Admin CRUD", glyph: "A" }]
      : []),
    ...(canManageUsers
      ? [
          {
            href: `/workspace/events/${competitionId}/users`,
            label: "Users and roles",
            glyph: "U",
          },
        ]
      : []),
  ];

  return (
    <nav className="primary-nav" aria-label="Main navigation">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/workspace" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={`nav-link${isActive ? " nav-link--active" : ""}`}
            href={item.href}
            key={item.href}
          >
            <span className="nav-glyph" aria-hidden="true">
              {item.glyph}
            </span>
            {item.label}
            {item.label === "Matches" && <span className="nav-count">1</span>}
          </Link>
        );
      })}
    </nav>
  );
}
