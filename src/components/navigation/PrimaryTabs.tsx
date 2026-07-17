// src/components/navigation/PrimaryTabs.tsx
// Top-level workflow navigation.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationSections } from "./navigation";

export default function PrimaryTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Primary navigation"
      className="border-b border-zinc-800 bg-zinc-950"
      data-print-hidden="true"
    >
      <div className="mx-auto flex w-full max-w-screen-2xl overflow-x-auto px-3 md:px-4">
        {navigationSections.map((section) => {
          const isActive = pathname.startsWith(section.matchPath);

          return (
            <Link
              key={section.href}
              href={section.href}
              className={[
                "shrink-0 border-b-2 px-3 py-2 text-sm font-medium",
                isActive
                  ? "border-zinc-100 text-zinc-100"
                  : "border-transparent text-zinc-400 hover:text-zinc-200",
              ].join(" ")}
            >
              {section.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}