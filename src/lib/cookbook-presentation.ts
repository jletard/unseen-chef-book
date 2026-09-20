import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type CookbookEventMenuItem = {
  id: string;
  course: string;
  name: string;
  description: string | null;
  sortOrder: number;
};

export type CookbookEventChapter = {
  id: string;
  title: string;
  eventDate: string;
  guestCount: number | null;
  occasion: string | null;
  story: string;
  imagePath: string | null;
  menu: CookbookEventMenuItem[];
};

const eventStories: Record<string, string> = {
  "cd8bee17-2f42-472d-b6e7-fd7fb62d6613":
    "A birthday dinner built as a long, generous progression: charcuterie and focaccia, bright summer salad, handmade pasta, two centerpiece meats, roasted vegetables, and a fresh fig finish. This is the kind of dinner worth remembering as a whole evening, not only as a collection of recipe records.",
  "0bbade33-5372-4cff-93a3-23ba67981847":
    "A family-style birthday dinner for fourteen, designed to feel abundant without turning service into a restaurant line. Charcuterie opened the table, followed by Caesar salad, fresh cavatelli, roasted Brussels sprouts, chicken thighs, red-wine braised short ribs, and focaccia.",
};

const seededNancyMenu: CookbookEventMenuItem[] = [
  { id: "nancy-charcuterie", course: "Appetizer", name: "Charcuterie Board", description: null, sortOrder: 0 },
  { id: "nancy-focaccia", course: "Bread", name: "Rosemary Focaccia", description: null, sortOrder: 1 },
  { id: "nancy-salad", course: "Salad", name: "Arugula & Peach Salad", description: null, sortOrder: 2 },
  { id: "nancy-cavatelli", course: "Pasta", name: "Fresh Cavatelli with Wild Mushrooms", description: null, sortOrder: 3 },
  { id: "nancy-short-ribs", course: "Entree", name: "Dr Pepper Braised Short Ribs", description: null, sortOrder: 4 },
  { id: "nancy-lamb", course: "Entree", name: "Rack of Lamb", description: null, sortOrder: 5 },
  { id: "nancy-vegetables", course: "Side", name: "Roasted Vegetables", description: null, sortOrder: 6 },
  { id: "nancy-shortcake", course: "Dessert", name: "Fresh Fig Shortcake", description: null, sortOrder: 7 },
];

export async function getCookbookEventChapters(): Promise<CookbookEventChapter[]> {
  const ids = Object.keys(eventStories);

  const [eventsResult, menuResult] = await Promise.all([
    supabaseAdmin
      .from("private_dining_events")
      .select("id, title, event_date, guest_count, occasion")
      .in("id", ids),
    supabaseAdmin
      .from("private_dining_menu_items")
      .select("id, event_id, course, name, description, sort_order")
      .in("event_id", ids)
      .order("sort_order", { ascending: true }),
  ]);

  const error = eventsResult.error ?? menuResult.error;
  if (error) throw new Error("Failed to load cookbook event chapters: " + error.message);

  const menuByEvent = new Map<string, CookbookEventMenuItem[]>();
  for (const row of menuResult.data ?? []) {
    const eventId = String(row.event_id);
    const items = menuByEvent.get(eventId) ?? [];
    items.push({
      id: String(row.id),
      course: String(row.course ?? "Course"),
      name: String(row.name),
      description: row.description ? String(row.description) : null,
      sortOrder: Number(row.sort_order ?? 0),
    });
    menuByEvent.set(eventId, items);
  }

  return (eventsResult.data ?? [])
    .map((row) => {
      const id = String(row.id);
      let menu = menuByEvent.get(id) ?? [];
      if (id === "cd8bee17-2f42-472d-b6e7-fd7fb62d6613" && menu.length === 0) {
        menu = seededNancyMenu;
      }

      return {
        id,
        title:
          id === "0bbade33-5372-4cff-93a3-23ba67981847"
            ? "The Corley Birthday Dinner"
            : "The Nancy Alley Birthday Dinner",
        eventDate: String(row.event_date),
        guestCount: row.guest_count === null ? null : Number(row.guest_count),
        occasion: row.occasion ? String(row.occasion) : null,
        story: eventStories[id] ?? "",
        imagePath: null,
        menu,
      };
    })
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));
}

export async function getCookbookEventChapter(id: string) {
  const chapters = await getCookbookEventChapters();
  return chapters.find((chapter) => chapter.id === id) ?? null;
}
