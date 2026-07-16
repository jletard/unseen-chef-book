// src/app/page.tsx
// Cookbook landing page.
// Redirects unauthenticated users to the login page.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-4xl font-bold">
        Unseen Chef Cookbook
      </h1>

      <p className="mt-4 text-zinc-400">
        Welcome, {user.email}
      </p>

      <p className="mt-8 text-zinc-500">
        The production system behind The Unseen Chef.
      </p>
    </main>
  );
}