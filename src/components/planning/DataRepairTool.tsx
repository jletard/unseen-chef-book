"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  MenuItemRecord,
  ReferenceRecord,
} from "@/types/cookbook-data";

type RepairDataset = "sides" | "categories" | "proteinTypes";

type Props = {
  menuItems: MenuItemRecord[];
  records: Record<RepairDataset, ReferenceRecord[]>;
};

const labels: Record<RepairDataset, string> = {
  sides: "Sides",
  categories: "Categories",
  proteinTypes: "Protein Types",
};

function referencedBy(
  dataset: RepairDataset,
  selectedNames: Set<string>,
  item: MenuItemRecord,
) {
  if (dataset === "sides") {
    return item.sides.some((side) => selectedNames.has(side));
  }

  if (dataset === "categories") {
    return Boolean(item.category && selectedNames.has(item.category));
  }

  return selectedNames.has(item.proteinType);
}

export default function DataRepairTool({ menuItems, records }: Props) {
  const router = useRouter();
  const [dataset, setDataset] = useState<RepairDataset>("sides");
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [canonicalChoice, setCanonicalChoice] = useState("");
  const [customName, setCustomName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentRecords = records[dataset];
  const matches = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();

    if (!search) {
      return [];
    }

    return currentRecords.filter((record) =>
      record.name.toLocaleLowerCase().includes(search),
    );
  }, [currentRecords, query]);

  const selectedRecords = currentRecords.filter((record) =>
    selectedIds.includes(record.id),
  );
  const usingOther = canonicalChoice === "__other__";
  const usingRemove = canonicalChoice === "__remove__";
  const canonicalRecordId = usingOther
    ? selectedRecords[0]?.id
    : usingRemove
      ? undefined
      : canonicalChoice;
  const duplicateRecords = usingRemove
    ? selectedRecords
    : selectedRecords.filter((record) => record.id !== canonicalRecordId);
  const selectedNames = new Set(
    (usingOther || usingRemove ? selectedRecords : duplicateRecords).map(
      (record) => record.name,
    ),
  );
  const affectedMenuItems = menuItems.filter((item) =>
    referencedBy(dataset, selectedNames, item),
  );
  const canonical = selectedRecords.find(
    (record) => record.id === canonicalChoice,
  );
  const targetName = usingRemove
    ? "Remove completely"
    : usingOther
      ? customName.trim()
      : canonical?.name ?? "";

  function reset(nextDataset?: RepairDataset) {
    if (nextDataset) {
      setDataset(nextDataset);
    }

    setQuery("");
    setSelectedIds([]);
    setCanonicalChoice("");
    setCustomName("");
    setMessage("");
    setError("");
  }

  function toggleRecord(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
    setMessage("");
    setError("");
  }

  async function merge() {
    const canonicalId = canonicalRecordId;

    if (usingRemove && selectedRecords.length === 0) {
      setError("Select at least one side to remove.");
      return;
    }

    if (!usingRemove && (!canonicalId || !targetName)) {
      setError(
        usingOther
          ? "Enter the new canonical name."
          : "Choose which selected value to keep.",
      );
      return;
    }

    if (!usingOther && !usingRemove && duplicateRecords.length === 0) {
      setError("Select at least one duplicate to merge.");
      return;
    }

    const duplicateList = duplicateRecords
      .map((record) => record.name)
      .join(", ");
    const confirmed = window.confirm(
      usingRemove
        ? "Remove " +
            duplicateList +
            " from current menu items and permanently delete the selected side records? Historical orders will not change."
        : 'Merge ' +
            duplicateList +
            ' into "' +
            targetName +
            '"? This updates current menu items and permanently removes the duplicate catalog records. Historical orders will not change.',
    );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/data-repair/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataset,
          action: usingRemove ? "remove" : "merge",
          canonicalId,
          canonicalName: usingOther ? targetName : undefined,
          duplicateIds: duplicateRecords.map((record) => record.id),
        }),
      });
      const result = (await response.json()) as {
        error?: string;
        canonicalName?: string;
        mergedCount?: number;
        changedMenuItems?: string[];
      };

      if (!response.ok) {
        throw new Error(result.error || "The merge failed.");
      }

      setMessage(
        "Merged " +
          result.mergedCount +
          ' duplicate' +
          (result.mergedCount === 1 ? "" : "s") +
          ' into "' +
          result.canonicalName +
          '". Updated ' +
          (result.changedMenuItems?.length ?? 0) +
          " current menu item" +
          ((result.changedMenuItems?.length ?? 0) === 1 ? "." : "s."),
      );
      setQuery("");
      setSelectedIds([]);
      setCanonicalChoice("");
      setCustomName("");
      router.refresh();
    } catch (mergeError) {
      setError(
        mergeError instanceof Error ? mergeError.message : "The merge failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <section className="border border-zinc-700 bg-zinc-950 p-4">
        <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <label className="text-sm">
            <span className="mb-2 block font-semibold text-zinc-200">
              Repair
            </span>
            <select
              value={dataset}
              onChange={(event) =>
                reset(event.target.value as RepairDataset)
              }
              className="w-full border border-zinc-600 bg-black px-3 py-2"
            >
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-2 block font-semibold text-zinc-200">
              Search for similar values
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={'Try "vegetable", "beans", or "potato"'}
              className="w-full border border-zinc-600 bg-black px-3 py-2"
            />
          </label>
        </div>
      </section>

      {query.trim() && (
        <section>
          <h2 className="text-lg font-semibold">
            Matches ({matches.length})
          </h2>
          {matches.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No matches found.</p>
          ) : (
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {matches.map((record) => (
                <label
                  key={record.id}
                  className="flex cursor-pointer items-center gap-3 border border-zinc-700 p-3"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(record.id)}
                    onChange={() => toggleRecord(record.id)}
                  />
                  <span className="flex-1">{record.name}</span>
                  <span
                    className={
                      record.active ? "text-emerald-400" : "text-zinc-500"
                    }
                  >
                    {record.active ? "Active" : "Inactive"}
                  </span>
                </label>
              ))}
            </div>
          )}
        </section>
      )}

      {selectedRecords.length > 0 && (
        <section className="border border-blue-700 bg-zinc-950 p-4">
          <h2 className="text-lg font-semibold">Merge preview</h2>
          <label className="mt-4 block max-w-xl text-sm">
            <span className="mb-2 block font-semibold text-zinc-200">
              Keep this canonical value
            </span>
            <select
              value={canonicalChoice}
              onChange={(event) => {
                setCanonicalChoice(event.target.value);
                setCustomName("");
              }}
              className="w-full border border-zinc-600 bg-black px-3 py-2"
            >
              <option value="">Choose the value to keep</option>
              {selectedRecords.map((record) => (
                <option key={record.id} value={record.id}>
                  {record.name}
                </option>
              ))}
              <option value="__other__">-- Other --</option>
              {dataset === "sides" && (
                <option value="__remove__">-- Remove completely --</option>
              )}
            </select>
          </label>

          {usingOther && (
            <label className="mt-4 block max-w-xl text-sm">
              <span className="mb-2 block font-semibold text-zinc-200">
                New canonical name
              </span>
              <input
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                placeholder="Seasonal Vegetables"
                className="w-full border border-zinc-600 bg-black px-3 py-2"
                autoFocus
              />
            </label>
          )}

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-300">
                Duplicate records to remove
              </h3>
              {duplicateRecords.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">
                  {usingOther
                    ? "The selected record will be renamed; no duplicate row will be removed."
                    : usingRemove
                      ? "Select at least one side to remove."
                      : "Select a canonical value and at least one other record."}
                </p>
              ) : (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {duplicateRecords.map((record) => (
                    <li key={record.id}>{record.name}</li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="text-sm font-semibold text-zinc-300">
                Current menu items to update ({affectedMenuItems.length})
              </h3>
              {affectedMenuItems.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-500">
                  No current menu items refer to the selected duplicates.
                </p>
              ) : (
                <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-auto pl-5 text-sm">
                  {affectedMenuItems.map((item) => (
                    <li key={item.id}>{item.name}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <p className="mt-5 text-sm text-amber-300">
            Historical order snapshots will not be changed.
          </p>

          <button
            type="button"
            disabled={
              busy ||
              !targetName ||
              (!usingOther && !usingRemove && duplicateRecords.length === 0)
            }
            onClick={merge}
            className="mt-4 border border-red-500 px-4 py-2 font-semibold text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy
              ? "Merging..."
              : usingRemove
                ? "Remove selected sides completely"
                : targetName
                  ? (usingOther ? "Rename and merge into " : "Merge into ") +
                    targetName
                  : usingOther
                    ? "Enter canonical name"
                    : "Choose canonical value"}
          </button>
        </section>
      )}

      {message && (
        <p className="border border-emerald-700 p-3 text-emerald-300">
          {message}
        </p>
      )}
      {error && (
        <p className="border border-red-700 p-3 text-red-300">{error}</p>
      )}
    </div>
  );
}
