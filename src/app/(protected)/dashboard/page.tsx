import Link from "next/link";

import { getMenuItems } from "@/lib/cookbook-data";
import { getReconciliationDashboardV2 } from "@/lib/cookbook-v2/reconciliation-data";
import { getRecipeNutrition } from "@/lib/nutrition-data";
import { getIngredients, getRecipes } from "@/lib/recipe-data";

function MetricCard({
  label,
  value,
  detail,
  href,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  detail: string;
  href?: string;
  tone?: "neutral" | "warning" | "good";
}) {
  const toneClasses =
    tone === "warning"
      ? "border-amber-800 bg-amber-950/20"
      : tone === "good"
        ? "border-emerald-900 bg-emerald-950/20"
        : "border-zinc-800 bg-zinc-950";

  const content = (
    <div className={`h-full border p-4 ${toneClasses}`}>
      <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-bold text-zinc-100">{value}</div>
      <p className="mt-2 text-sm text-zinc-400">{detail}</p>
    </div>
  );

  return href ? (
    <Link href={href} className="block hover:brightness-125">
      {content}
    </Link>
  ) : (
    content
  );
}

const quickLinks = [
  {
    href: "/planning/reconciliation",
    title: "Reconciliation",
    detail: "Fix missing recipes, source matches, and drafts.",
  },
  {
    href: "/production/list",
    title: "Production List",
    detail: "See what actually needs to be made this week.",
  },
  {
    href: "/production/shopping",
    title: "Shopping List",
    detail: "Turn recipe knowledge into things to buy.",
  },
  {
    href: "/cook/this-week",
    title: "Cook This Week",
    detail: "Open the kitchen recipe binder.",
  },
  {
    href: "/planning/ingredients",
    title: "Ingredients",
    detail: "Fix names, labels, units, and ingredient data.",
  },
  {
    href: "/planning/nutrition",
    title: "Nutrition",
    detail: "Review recipe and ingredient nutrition estimates.",
  },
];

export default async function DashboardPage() {
  const [reconciliation, menuItems, recipes, ingredients, recipeNutrition] =
    await Promise.all([
      getReconciliationDashboardV2(),
      getMenuItems(),
      getRecipes(),
      getIngredients(),
      getRecipeNutrition(),
    ]);

  const activeIngredients = ingredients.filter((ingredient) => ingredient.active);
  const unreviewedIngredients = activeIngredients.filter(
    (ingredient) => ingredient.labelReviewStatus !== "confirmed",
  );
  const draftRecipes = recipes.filter((recipe) => recipe.status === "draft");
  const completeRecipes = recipes.filter((recipe) => recipe.status === "complete");
  const nutritionProblems = recipeNutrition.filter(
    (recipe) => !recipe.nutritionComplete || recipe.nutritionIssueCount > 0,
  );
  const nutritionIssueCount = nutritionProblems.reduce(
    (total, recipe) => total + recipe.nutritionIssueCount,
    0,
  );

  const reconciliationCount =
    reconciliation.missingRecipes +
    reconciliation.openIdentityDecisions +
    reconciliation.drafts.length;

  const queuePreview = reconciliation.queue.slice(0, 6);

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Cookbook Home</h1>
          <p className="mt-2 max-w-3xl text-sm text-zinc-400">
            The useful stuff first: what is incomplete, what needs attention,
            and where to go next.
          </p>
        </div>

        <div className="border border-zinc-800 bg-zinc-950 px-4 py-3 text-right">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Chef status
          </div>
          <div className="mt-1 font-semibold text-emerald-300">
            Extremely good looking
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            No corrective action required.
          </div>
        </div>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Needs Attention</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Things that can make planning, shopping, labels, or nutrition less trustworthy.
            </p>
          </div>
          <Link
            href="/planning/reconciliation#candidates"
            className="text-sm font-medium text-blue-300 hover:underline"
          >
            Open Reconciliation →
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Reconciliation"
            value={reconciliationCount}
            detail={`${reconciliation.missingRecipes} missing recipes · ${reconciliation.openIdentityDecisions} identity decisions · ${reconciliation.drafts.length} drafts ready`}
            href="/planning/reconciliation#candidates"
            tone={reconciliationCount > 0 ? "warning" : "good"}
          />
          <div className={`h-full border p-4 ${
            draftRecipes.length > 0
              ? "border-amber-800 bg-amber-950/20"
              : "border-emerald-900 bg-emerald-950/20"
          }`}>
            <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Draft Recipes
            </div>
            <div className="mt-2 text-3xl font-bold text-zinc-100">
              {draftRecipes.length}
            </div>
            {draftRecipes.length > 0 ? (
              <div className="mt-3 space-y-1">
                {draftRecipes.map((recipe) => (
                  <Link
                    key={recipe.id}
                    href={`/planning/recipes/${recipe.id}`}
                    className="block text-sm font-medium text-blue-300 hover:underline"
                  >
                    {recipe.name}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">
                No recipe records still marked draft.
              </p>
            )}
          </div>
          <MetricCard
            label="Ingredient Label Review"
            value={unreviewedIngredients.length}
            detail={`${activeIngredients.length} active ingredients total.`}
            href="/planning/ingredients/review"
            tone={unreviewedIngredients.length > 0 ? "warning" : "good"}
          />
          <MetricCard
            label="Nutrition Issues"
            value={nutritionProblems.length}
            detail={
              nutritionProblems.length
                ? `${nutritionIssueCount} total nutrition issues across affected recipes.`
                : "Current approved recipe nutrition looks complete."
            }
            href="/planning/nutrition"
            tone={nutritionProblems.length > 0 ? "warning" : "good"}
          />
        </div>
      </section>

      {queuePreview.length > 0 ? (
        <section className="mt-6 border border-zinc-800 bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
            <div>
              <h2 className="font-bold">First Things to Reconcile</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                A quick look at the front of the reconciliation queue.
              </p>
            </div>
            <Link
              href="/planning/reconciliation#candidates"
              className="border border-blue-500 px-3 py-1.5 text-xs font-medium text-blue-200 hover:bg-blue-950/30"
            >
              Fix Them
            </Link>
          </div>

          <div className="divide-y divide-zinc-800">
            {queuePreview.map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="font-medium">{item.name}</div>
                  <div className="mt-0.5 text-xs capitalize text-zinc-500">
                    {item.taskType.replaceAll("_", " ")} · {item.kind.replaceAll("_", " ")}
                  </div>
                </div>
                <span className="text-xs text-amber-300">{item.taskStatus}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-6 border border-emerald-900 bg-emerald-950/20 p-4">
          <h2 className="font-bold text-emerald-300">Reconciliation is clear</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Book does not currently have anything queued for reconciliation.
          </p>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xl font-bold">Book at a Glance</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Menu Items"
            value={menuItems.length}
            detail="Customer-facing items known to Book."
            href="/planning/menu-items"
          />
          <MetricCard
            label="Complete Recipes"
            value={completeRecipes.length}
            detail={`${recipes.length} recipe records total · ${draftRecipes.length} still marked draft in the recipe table.`}
            href="/planning/recipes"
          />
          <MetricCard
            label="Ingredients"
            value={activeIngredients.length}
            detail={`${ingredients.length} ingredient records total.`}
            href="/planning/ingredients"
          />
          <MetricCard
            label="Production Items"
            value={reconciliation.totalProductionItems}
            detail="Weekly and bulk food items covered by production knowledge."
            href="/planning/reconciliation#candidates"
          />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-xl font-bold">Go Do Something Useful</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {quickLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="border border-zinc-800 bg-zinc-950 p-4 hover:border-zinc-600 hover:bg-zinc-900"
            >
              <div className="font-semibold text-zinc-100">{item.title}</div>
              <p className="mt-1 text-sm text-zinc-400">{item.detail}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
