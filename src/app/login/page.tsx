// src/app/login/page.tsx
// Login page for admin access.

import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center justify-center p-8">
      <div className="w-full rounded border border-gray-700 p-6">
        <h1 className="mb-4 text-3xl font-bold">Unseen Chef Book Login</h1>
        <p className="mb-6 text-sm text-gray-300">
          Sign in with an approved Google account.
        </p>
        <GoogleSignInButton />
      </div>
    </main>
  );
}