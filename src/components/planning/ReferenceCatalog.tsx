import type { ReferenceRecord } from "@/types/cookbook-data";

export default function ReferenceCatalog({
  records,
  emptyMessage,
}: {
  records: ReferenceRecord[];
  emptyMessage: string;
}) {
  if (records.length === 0) {
    return (
      <p className="mt-6 border border-dashed border-zinc-700 p-4 text-sm text-zinc-400">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {records.map((record) => (
        <div
          key={record.id}
          className={
            "flex items-center justify-between border border-zinc-800 px-3 py-2 text-sm " +
            (record.active ? "" : "text-zinc-500")
          }
        >
          <span>{record.name}</span>
          <span
            className={
              "text-xs " +
              (record.active ? "text-emerald-400" : "text-zinc-600")
            }
          >
            {record.active ? "Active" : "Inactive"}
          </span>
        </div>
      ))}
    </div>
  );
}
