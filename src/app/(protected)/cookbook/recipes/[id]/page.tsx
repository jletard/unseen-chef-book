import Link from "next/link";
import { notFound } from "next/navigation";

import { getApprovedRecipeEditorData } from "@/lib/recipe-data";

function formatQuantity(value: number) {
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(2)).toString();
}

export default async function CookbookRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const recipe = await getApprovedRecipeEditorData(id);

  if (!recipe) notFound();

  return (
    <article className="mx-auto max-w-5xl">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <Link href="/cookbook" className="text-sm text-zinc-400 hover:text-white">
          ← Cookbook
        </Link>
        <Link
          href={"/planning/recipes/" + recipe.recipeId}
          className="text-xs text-zinc-600 hover:text-zinc-300"
        >
          Edit recipe
        </Link>
      </div>

      <header className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500">
          {recipe.recipeType.replaceAll("_", " ")}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight md:text-5xl">
          {recipe.name}
        </h1>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-400">
          <span>
            Yield: {formatQuantity(recipe.baseYield)} {recipe.yieldUnit}
          </span>
          {recipe.portionQuantity && recipe.portionUnit ? (
            <span>
              Portion: {formatQuantity(recipe.portionQuantity)} {recipe.portionUnit}
            </span>
          ) : null}
        </div>
        {recipe.chefNotes ? (
          <p className="mt-5 whitespace-pre-line text-base leading-7 text-zinc-300">
            {recipe.chefNotes}
          </p>
        ) : null}
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(280px,0.8fr)_1.4fr]">
        <section>
          <h2 className="border-b border-zinc-800 pb-2 text-lg font-semibold">
            Ingredients
          </h2>
          <ul className="divide-y divide-zinc-900">
            {recipe.items.map((item) => (
              <li key={item.id} className="grid grid-cols-[100px_1fr] gap-3 py-3 text-sm">
                <div className="font-medium text-zinc-300">
                  {formatQuantity(item.quantity)} {item.unit}
                </div>
                <div>
                  <div className="text-zinc-100">{item.name}</div>
                  {item.preparationNote ? (
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {item.preparationNote}
                    </div>
                  ) : null}
                  {item.kind === "recipe" ? (
                    <div className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-600">
                      component
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="border-b border-zinc-800 pb-2 text-lg font-semibold">
            Method
          </h2>
          {recipe.steps.length ? (
            <ol className="mt-1 space-y-0">
              {recipe.steps.map((step, index) => (
                <li
                  key={step.id}
                  className="grid grid-cols-[36px_1fr] gap-3 border-b border-zinc-900 py-4"
                >
                  <div className="text-sm font-semibold text-zinc-600">{index + 1}</div>
                  <p className="text-sm leading-6 text-zinc-200">{step.instruction}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">Method has not been written yet.</p>
          )}
        </section>
      </div>
    </article>
  );
}
