import Link from "next/link";
import { notFound } from "next/navigation";

import { getCookbookEventChapter } from "@/lib/cookbook-presentation";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value + "T12:00:00"));
}

export default async function EventChapterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const chapter = await getCookbookEventChapter(id);

  if (!chapter) notFound();

  return (
    <article className="mx-auto max-w-5xl">
      <div className="mb-8 border-b border-zinc-800 pb-4">
        <Link href="/cookbook" className="text-sm text-zinc-400 hover:text-white">
          ← Cookbook
        </Link>
      </div>

      <header className="max-w-4xl">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">
          Event Chapter
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">
          {chapter.title}
        </h1>
        <p className="mt-3 text-sm uppercase tracking-wide text-zinc-500">
          {formatDate(chapter.eventDate)}
          {chapter.guestCount ? " · " + chapter.guestCount + " guests" : ""}
          {chapter.occasion ? " · " + chapter.occasion : ""}
        </p>
      </header>

      <div className="mt-8 grid min-h-64 place-items-center border border-dashed border-zinc-800 bg-zinc-950 text-center">
        <div className="max-w-md p-8">
          <div className="text-sm font-medium text-zinc-300">Event photograph</div>
          <p className="mt-2 text-xs leading-5 text-zinc-600">
            This chapter is ready for its photos. The images can be attached without changing the menu or story.
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[0.85fr_1.15fr]">
        <section>
          <h2 className="text-xl font-semibold">The dinner</h2>
          <p className="mt-4 whitespace-pre-line text-base leading-7 text-zinc-300">
            {chapter.story}
          </p>
        </section>

        <section>
          <div className="border-b border-zinc-800 pb-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Menu
            </p>
          </div>
          <div className="divide-y divide-zinc-900">
            {chapter.menu.map((item) => (
              <div key={item.id} className="grid gap-1 py-4 sm:grid-cols-[110px_1fr] sm:gap-5">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                  {item.course}
                </div>
                <div>
                  <div className="font-medium text-zinc-100">{item.name}</div>
                  {item.description ? (
                    <p className="mt-1 text-sm leading-6 text-zinc-500">{item.description}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </article>
  );
}
