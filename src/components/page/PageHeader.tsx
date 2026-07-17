// src/components/page/PageHeader.tsx
// Compact application header.

import Link from "next/link";
import ProductionWeekSelect from "./ProductionWeekSelect";

type Props = {
  userName: string;
};

export default function PageHeader({ userName }: Props) {
  return (
    <header
      className="border-b border-zinc-800 bg-zinc-950"
      data-print-hidden="true"
    >
      <div className="mx-auto flex min-h-12 w-full max-w-screen-2xl items-center justify-between gap-3 px-3 py-2 md:px-4">
        <Link
          href="/"
          className="shrink-0 text-sm font-semibold tracking-wide text-zinc-100"
        >
          <span className="hidden sm:inline">Unseen Chef Cookbook</span>

          <span className="sm:hidden">Cookbook</span>
        </Link>

        <div className="flex min-w-0 items-center gap-3 text-sm">
          <ProductionWeekSelect />
          <span className="hidden max-w-32 truncate text-zinc-400 sm:inline">
            {userName}
          </span>

          {/* TODO: Add sign out if multi-user support or shared devices become a requirement. */}

        </div>
      </div>
    </header>
  );
}
