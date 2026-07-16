// src/app/page.tsx

import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data, error } = await supabase
    .from("menu_items_v2")
    .select("id, name")
    .order("name")
    .limit(10);

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold">Unseen Chef Cookbook</h1>

      {error ? (
        <p className="mt-4 text-red-400">
          Failed to load menu items: {error.message}
        </p>
      ) : (
        <>
          <p className="mt-4 text-zinc-400">
            Connected to Supabase. Found {data.length} menu items.
          </p>

          <ul className="mt-6 space-y-1">
            {data.map((item) => (
              <li key={item.id}>{item.name}</li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}