// src/components/navigation/SecondaryTabs.tsx
// Sub-navigation for the active workflow.

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navigationSections } from "./navigation";

export default function SecondaryTabs() {
  const pathname = usePathname();

  const activeSection = navigationSections.find((section) =>
    pathname.startsWith(section.matchPath),
  );

  if (!activeSection) {
    return null;
  }

  return (
    <nav
      aria-label={`${activeSection.label} navigation`}
      className="border-b border-zinc-800 bg-zinc-900/40"
      data-print-hidden="true"
    >
      <div className="mx-auto flex w-full max-w-screen-2xl overflow-x-auto px-3 md:px-4">
        {activeSection.children.map((item) => {
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                "shrink-0 border-b-2 px-3 py-1.5 text-xs font-medium",
                isActive
                  ? "border-zinc-300 text-zinc-100"
                  : "border-transparent text-zinc-500 hover:text-zinc-300",
              ].join(" ")}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}