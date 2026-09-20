"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import SecretAIImportBox, { type SecretAIFormSchema } from "@/components/SecretAIImportBox/SecretAIImportBox";
import { allergenLabels, type AllergenKey, type LabelIngredient } from "@/lib/labeling-types";
import type {
  IngredientComponentRecord,
  IngredientKind,
  IngredientRecord,
} from "@/types/cookbook-data";

const allergenEntries = Object.entries(allergenLabels) as Array<[AllergenKey, string]>;

type AIChildIngredient = {
  name: string;
  measurementKind: IngredientRecord["measurementKind"];
};

type Draft = {
  id: string;
  name: string;
  measurementKind: IngredientRecord["measurementKind"];
  ingredientKind: IngredientKind;
  labelName: string;
  ingredientStatement: string;
  allergenKeys: AllergenKey[];
  allergenDetails: Partial<Record<AllergenKey, string>>;
  dietaryFlags: string[];
  excludeFromShopping: boolean;
};

export default function IngredientReviewWorkspace({
  ingredients,
  labeling,
  components,
}: {
  ingredients: IngredientRecord[];
  labeling: LabelIngredient[];
  components: IngredientComponentRecord[];
}) {
  const router = useRouter();
  const labelingById = useMemo(
    () => new Map(labeling.map((ingredient) => [ingredient.id, ingredient])),
    [labeling],
  );
  const ingredientById = useMemo(
    () => new Map(ingredients.map((ingredient) => [ingredient.id, ingredient])),
    [ingredients],
  );
  const componentsByParent = useMemo(() => {
    const map = new Map<string, IngredientComponentRecord[]>();
    for (const component of components) {
      const rows = map.get(component.parentIngredientId) ?? [];
      rows.push(component);
      map.set(component.parentIngredientId, rows);
    }
    return map;
  }, [components]);

  const initialDrafts = useMemo(() => {
    const result: Record<string, Draft> = {};
    for (const ingredient of ingredients) {
      const label = labelingById.get(ingredient.id);
      if (!ingredient.active || ingredient.labelReviewStatus === "confirmed") continue;
      result[ingredient.id] = {
        id: ingredient.id,
        name: ingredient.name,
        measurementKind: ingredient.measurementKind,
        ingredientKind: ingredient.ingredientKind,
        labelName: label?.labelName ?? ingredient.labelName,
        ingredientStatement: label?.ingredientStatement ?? ingredient.ingredientStatement,
        allergenKeys: label?.allergenKeys ?? [],
        allergenDetails: label?.allergenDetails ?? {},
        dietaryFlags: label?.dietaryFlags ?? [],
        excludeFromShopping: ingredient.excludeFromShopping,
      };
    }
    return result;
  }, [ingredients, labelingById]);

  const [drafts, setDrafts] = useState<Record<string, Draft>>(initialDrafts);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [newChildByParent, setNewChildByParent] = useState<Record<string, string>>({});
  const [aiChildrenByParent, setAiChildrenByParent] = useState<Record<string, AIChildIngredient[]>>({});

  const aiSchema = useMemo<SecretAIFormSchema>(() => ({
    name: "Ingredient review batch",
    description:
      "Review every listed purchased ingredient. For a true single ingredient such as fresh ginger, keep it simple and use the ingredient itself as the declaration. For packaged or compound foods such as graham cracker crumbs or Greek yogurt, fill in a useful ingredient declaration, mark it compound, identify major allergens, and list the child ingredients that should exist in the cookbook. Use common culinary knowledge when the product is generic; the chef will review before saving. Do not add products that are not in the supplied list.",
    fields: {
      reviews: {
        type: "array",
        required: true,
        items: {
          type: "object",
          fields: {
            name: {
              type: "string",
              required: true,
              description: "Must exactly match one supplied ingredient name.",
            },
            labelName: { type: "string", required: true },
            ingredientKind: {
              type: "enum",
              required: true,
              values: ["simple", "compound"],
            },
            measurementKind: {
              type: "enum",
              required: true,
              values: ["solid", "liquid", "countable"],
            },
            ingredientStatement: {
              type: "string",
              required: true,
              description:
                "Consumer ingredient declaration. For a simple ingredient, normally just the ingredient name. For a compound product, provide the ingredient list in label-ready wording.",
            },
            allergenKeys: {
              type: "array",
              required: true,
              items: {
                type: "enum",
                values: Object.keys(allergenLabels),
              },
            },
            vegetarian: { type: "boolean", required: true },
            childIngredients: {
              type: "array",
              required: true,
              description:
                "For compound products, list the purchased ingredient's constituent ingredients that should be linked as structured child ingredients. Leave empty for simple ingredients.",
              items: {
                type: "object",
                fields: {
                  name: { type: "string", required: true },
                  measurementKind: {
                    type: "enum",
                    required: true,
                    values: ["solid", "liquid", "countable"],
                  },
                },
              },
            },
          },
        },
      },
    },
  }), []);

  const normalizedQuery = query.trim().toLowerCase();
  const shownDrafts = Object.values(drafts).filter((draft) =>
    !normalizedQuery
      || draft.name.toLowerCase().includes(normalizedQuery)
      || draft.labelName.toLowerCase().includes(normalizedQuery),
  );

  const aiCurrentValues = useMemo(() => ({
    reviews: Object.values(drafts).map((draft) => ({
      name: draft.name,
      labelName: draft.labelName,
      ingredientKind: draft.ingredientKind,
      measurementKind: draft.measurementKind,
      ingredientStatement: draft.ingredientStatement,
      allergenKeys: draft.allergenKeys,
      vegetarian: draft.dietaryFlags.includes("vegetarian"),
      childIngredients: (componentsByParent.get(draft.id) ?? []).map((row) => {
        const child = ingredientById.get(row.childIngredientId);
        return {
          name: child?.name ?? "Unknown ingredient",
          measurementKind: child?.measurementKind ?? "solid",
        };
      }),
    })),
  }), [componentsByParent, drafts, ingredientById]);

  function importAI(values: Record<string, unknown>) {
    const reviews = Array.isArray(values.reviews) ? values.reviews : [];
    const byName = new Map(
      Object.values(drafts).map((draft) => [draft.name.trim().toLowerCase(), draft.id]),
    );
    let importedCount = 0;

    for (const review of reviews) {
      if (typeof review !== "object" || review === null || Array.isArray(review)) continue;
      const row = review as Record<string, unknown>;
      const name = typeof row.name === "string" ? row.name.trim() : "";
      const id = byName.get(name.toLowerCase());
      if (!id) continue;

      const allergens = Array.isArray(row.allergenKeys)
        ? row.allergenKeys.filter((key): key is AllergenKey => typeof key === "string" && key in allergenLabels)
        : [];
      const children = Array.isArray(row.childIngredients)
        ? row.childIngredients.flatMap((child) => {
            if (typeof child !== "object" || child === null || Array.isArray(child)) return [];
            const childRow = child as Record<string, unknown>;
            const childName = typeof childRow.name === "string" ? childRow.name.trim() : "";
            const measurementKind =
              childRow.measurementKind === "liquid" || childRow.measurementKind === "countable"
                ? childRow.measurementKind
                : "solid";
            return childName ? [{ name: childName, measurementKind }] : [];
          })
        : [];

      patchDraft(id, {
        labelName: typeof row.labelName === "string" ? row.labelName : drafts[id].labelName,
        ingredientKind: row.ingredientKind === "compound" ? "compound" : "simple",
        measurementKind:
          row.measurementKind === "liquid" || row.measurementKind === "countable"
            ? row.measurementKind
            : "solid",
        ingredientStatement:
          typeof row.ingredientStatement === "string"
            ? row.ingredientStatement
            : drafts[id].ingredientStatement,
        allergenKeys: allergens,
        dietaryFlags: row.vegetarian === true ? ["vegetarian"] : [],
      });
      setAiChildrenByParent((current) => ({ ...current, [id]: children }));
      importedCount += 1;
    }

    setMessage(`AI filled ${importedCount} ingredient review cards. Nothing has been saved yet.`);
  }

  function patchDraft(id: string, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  function toggleAllergen(id: string, key: AllergenKey) {
    const draft = drafts[id];
    const next = draft.allergenKeys.includes(key)
      ? draft.allergenKeys.filter((value) => value !== key)
      : [...draft.allergenKeys, key];
    patchDraft(id, { allergenKeys: next });
  }

  async function persistSuggestedChildren(targetDrafts: Draft[]) {
    const resolvedByName = new Map(
      ingredients.map((ingredient) => [ingredient.name.trim().toLowerCase(), ingredient.id]),
    );

    for (const draft of targetDrafts) {
      const suggestions = aiChildrenByParent[draft.id] ?? [];
      if (suggestions.length === 0) continue;

      const existingChildIds = new Set(
        (componentsByParent.get(draft.id) ?? []).map((row) => row.childIngredientId),
      );

      for (const child of suggestions) {
        const key = child.name.trim().toLowerCase();
        if (!key) continue;

        let childId = resolvedByName.get(key);
        if (!childId) {
          const createResponse = await fetch("/api/ingredients", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: child.name,
              measurementKind: child.measurementKind,
              ingredientKind: "simple",
            }),
          });
          const created = await createResponse.json() as { id?: string; error?: string };
          if (!createResponse.ok || !created.id) {
            throw new Error(created.error ?? `Could not create child ingredient ${child.name}.`);
          }
          childId = created.id;
          resolvedByName.set(key, childId);
        }

        if (existingChildIds.has(childId)) continue;

        const relationResponse = await fetch(`/api/ingredients/${draft.id}/components`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ childIngredientId: childId, sourceText: child.name }),
        });
        const relation = await relationResponse.json() as { error?: string };
        if (!relationResponse.ok && relationResponse.status !== 409) {
          throw new Error(relation.error ?? `Could not add ${child.name} to ${draft.name}.`);
        }
        existingChildIds.add(childId);
      }
    }
  }

  async function saveAll() {
    if (shownDrafts.length === 0) return;
    setBusy(true);
    setMessage(`Saving and reviewing ${shownDrafts.length} ingredients…`);
    try {
      const response = await fetch("/api/ingredients/review/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: shownDrafts.map((draft) => ({ ...draft, confirmed: true })),
        }),
      });
      const result = await response.json() as { savedCount?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Bulk review save failed.");

      await persistSuggestedChildren(shownDrafts);

      setMessage(`Saved and reviewed ${result.savedCount ?? shownDrafts.length} ingredients, including AI-suggested child ingredients.`);
      setDrafts((current) => {
        const next = { ...current };
        shownDrafts.forEach((draft) => delete next[draft.id]);
        return next;
      });
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bulk review save failed.");
    } finally {
      setBusy(false);
    }
  }

  async function addChild(parentId: string) {
    const childId = newChildByParent[parentId];
    const parent = drafts[parentId];
    if (!childId || !parent) return;

    setBusy(true);
    setMessage("");
    try {
      if (parent.ingredientKind !== "compound") {
        const parentUpdate = { ...parent, ingredientKind: "compound", confirmed: false };
        const parentResponse = await fetch("/api/ingredients/review/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: [parentUpdate] }),
        });
        const parentResult = await parentResponse.json() as { error?: string };
        if (!parentResponse.ok) throw new Error(parentResult.error ?? "Could not make ingredient compound.");
        patchDraft(parentId, { ingredientKind: "compound" });
      }

      const response = await fetch(`/api/ingredients/${parentId}/components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childIngredientId: childId, sourceText: "" }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not add child ingredient.");

      setNewChildByParent((current) => ({ ...current, [parentId]: "" }));
      setMessage("Child ingredient added.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add child ingredient.");
    } finally {
      setBusy(false);
    }
  }

  async function removeChild(parentId: string, componentId: string) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/ingredients/${parentId}/components`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ componentId }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not remove child ingredient.");
      setMessage("Child ingredient removed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not remove child ingredient.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border border-zinc-700 bg-zinc-950 p-3 shadow-xl">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search things that need review"
          className="min-w-60 flex-1 border border-zinc-700 bg-black px-3 py-2"
        />
        <span className="text-sm text-zinc-400">{shownDrafts.length} shown · {Object.keys(drafts).length} remaining</span>
        <button
          type="button"
          onClick={saveAll}
          disabled={busy || shownDrafts.length === 0}
          className="border border-emerald-500 bg-emerald-950/40 px-5 py-2 font-bold text-emerald-200 disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save all shown & mark reviewed"}
        </button>
      </div>

      <SecretAIImportBox
        formSchema={aiSchema}
        currentValues={aiCurrentValues}
        onImport={importAI}
        successMessage="AI review data loaded into the open ingredient cards."
        disabled={busy || Object.keys(drafts).length === 0}
      />

      {message && <div className="border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-300">{message}</div>}

      {shownDrafts.map((draft) => {
        const childRows = componentsByParent.get(draft.id) ?? [];
        const existingChildIds = new Set(childRows.map((row) => row.childIngredientId));
        const availableChildren = ingredients.filter(
          (candidate) => candidate.id !== draft.id && !existingChildIds.has(candidate.id),
        );

        return (
          <section key={draft.id} className="border border-amber-900/70 bg-zinc-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">{draft.name}</h2>
              <span className="text-sm text-amber-300">Needs review</span>
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(12rem,1fr)_10rem_10rem]">
              <label className="text-sm text-zinc-300">
                Label name
                <input
                  value={draft.labelName}
                  onChange={(event) => patchDraft(draft.id, { labelName: event.target.value })}
                  className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2 text-white"
                />
              </label>
              <label className="text-sm text-zinc-300">
                Type
                <select
                  value={draft.ingredientKind}
                  onChange={(event) => patchDraft(draft.id, { ingredientKind: event.target.value as IngredientKind })}
                  className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2"
                >
                  <option value="simple">Simple</option>
                  <option value="compound">Compound</option>
                </select>
              </label>
              <label className="text-sm text-zinc-300">
                Measure as
                <select
                  value={draft.measurementKind}
                  onChange={(event) => patchDraft(draft.id, { measurementKind: event.target.value as IngredientRecord["measurementKind"] })}
                  className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2"
                >
                  <option value="solid">Solid</option>
                  <option value="liquid">Liquid</option>
                  <option value="countable">Countable</option>
                </select>
              </label>
            </div>

            <label className="mt-3 block text-sm text-zinc-300">
              Ingredient declaration
              <textarea
                value={draft.ingredientStatement}
                onChange={(event) => patchDraft(draft.id, { ingredientStatement: event.target.value })}
                rows={3}
                placeholder="Paste the supplier ingredient list here."
                className="mt-1 block w-full border border-zinc-700 bg-black px-3 py-2 text-white"
              />
              <span className="mt-1 block text-xs text-zinc-500">
                Simple item? Leave the ingredient itself. Commercial product? Paste the package ingredient declaration.
              </span>
            </label>

            <div className="mt-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Major allergens</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
                {allergenEntries.map(([key, label]) => {
                  const selected = draft.allergenKeys.includes(key);
                  return (
                    <button
                      type="button"
                      key={key}
                      onClick={() => toggleAllergen(draft.id, key)}
                      className={selected
                        ? "min-h-11 border border-amber-500 bg-amber-950/50 px-2 py-2 text-xs font-bold text-amber-100"
                        : "min-h-11 border border-zinc-700 px-2 py-2 text-xs text-zinc-500"}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={draft.dietaryFlags.includes("vegetarian")}
                onChange={(event) => patchDraft(draft.id, { dietaryFlags: event.target.checked ? ["vegetarian"] : [] })}
              />
              Vegetarian
            </label>

            {(draft.ingredientKind === "compound" || (aiChildrenByParent[draft.id]?.length ?? 0) > 0) && (
              <div className="mt-4 border-t border-zinc-800 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">Structured child ingredients</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      Add the actual ingredients inside this purchased product. The pasted declaration above remains the supplier wording.
                    </p>
                  </div>
                  {childRows.length === 0 && <span className="text-sm text-amber-300">No child ingredients yet</span>}
                </div>

                {(aiChildrenByParent[draft.id]?.length ?? 0) > 0 && (
                  <div className="mb-3 border border-purple-900/70 bg-purple-950/20 p-3">
                    <div className="text-xs font-semibold uppercase tracking-wide text-purple-300">AI suggested children</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(aiChildrenByParent[draft.id] ?? []).map((child, index) => (
                        <span key={`${child.name}-${index}`} className="border border-purple-800 px-2 py-1 text-xs text-purple-200">
                          {child.name}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">These will be linked when you save all shown. Missing child ingredients will be created automatically.</p>
                  </div>
                )}

                <div className="mt-3 space-y-2">
                  {childRows.map((row) => (
                    <div key={row.id} className="flex flex-wrap items-center gap-3 border border-zinc-800 bg-black px-3 py-2">
                      <span className="min-w-0 flex-1">{ingredientById.get(row.childIngredientId)?.name ?? "Unknown ingredient"}</span>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => removeChild(draft.id, row.id)}
                        className="border border-red-900 px-2 py-1 text-xs text-red-300 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <select
                    value={newChildByParent[draft.id] ?? ""}
                    onChange={(event) => setNewChildByParent((current) => ({ ...current, [draft.id]: event.target.value }))}
                    className="min-w-64 flex-1 border border-zinc-700 bg-black px-3 py-2"
                  >
                    <option value="">Choose child ingredient…</option>
                    {availableChildren.map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>{candidate.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy || !newChildByParent[draft.id]}
                    onClick={() => addChild(draft.id)}
                    className="border border-blue-600 px-4 py-2 text-blue-300 disabled:opacity-40"
                  >
                    Add child
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}

      {Object.keys(drafts).length === 0 && (
        <div className="border border-emerald-900 bg-emerald-950/20 p-4 text-emerald-300">
          Ingredient review is clear.
        </div>
      )}
    </div>
  );
}
