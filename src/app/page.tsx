// src/app/page.tsx

import { redirect } from "next/navigation";

export default function Home() {
  redirect("/planning/menu-items");
}