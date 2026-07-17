// src/components/page/PageFooter.tsx
// Application footer.

export default function PageFooter() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex h-8 w-full max-w-screen-2xl items-center justify-between px-3 text-xs text-zinc-500 md:px-4">
        <span>book.theunseenchef.com</span>

        <span>Version 0.1</span>
      </div>
    </footer>
  );
}