import Link from "next/link";

export default function ProductionRecipesPage() {
  return (
    <div className="max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">
        Production Book
      </p>
      <h1 className="mt-2 text-3xl font-bold">Recipes for this production week</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
        This is the kitchen binder side of Book. The next step is wiring the selected
        production week into scaled recipe quantities so someone else can cook the menu
        without doing recipe math by hand.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/production/list"
          className="border border-zinc-800 bg-zinc-950 p-4 hover:border-zinc-600"
        >
          <div className="font-semibold">Start with production totals</div>
          <p className="mt-1 text-sm text-zinc-500">
            See exactly what is being made and how many portions are required.
          </p>
        </Link>
        <Link
          href="/cookbook"
          className="border border-zinc-800 bg-zinc-950 p-4 hover:border-zinc-600"
        >
          <div className="font-semibold">Browse the cookbook</div>
          <p className="mt-1 text-sm text-zinc-500">
            Open clean recipe pages while scaled production recipes are being wired in.
          </p>
        </Link>
      </div>
    </div>
  );
}
