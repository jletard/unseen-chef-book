// src/components/auth/GoogleSignInButton.tsx
// Starts Google OAuth sign-in for the cookbook app.

"use client";

import { createClient } from "@/lib/supabase/client";

export default function GoogleSignInButton() {
  async function handleSignIn() {
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      console.error("Google sign-in failed:", error);
    }
  }

  return (
    <button
      type="button"
      onClick={() => {
        void handleSignIn();
      }}
      className="rounded bg-white px-4 py-2 font-medium text-black"
    >
      Sign in with Google
    </button>
  );
}