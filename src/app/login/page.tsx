"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ERROR_MESSAGES: Record<string, string> = {
  domain_not_allowed: "Only GITAM university accounts (@student.gitam.edu or gitam.in) can sign in.",
  not_registered: "This account isn't registered yet. Register your team first, then come back to log in.",
  auth_failed: "Something went wrong signing you in. Please try again.",
};

function LoginContent() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.auth_failed) : null;

  async function handleGoogleLogin() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-void px-6 text-center">
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/10 blur-[140px]"
        aria-hidden
      />
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface px-8 py-12 shadow-2xl shadow-black/40">
        <p className="font-mono text-xs tracking-[0.3em] text-gold uppercase">TMCG IdeaSprint 4.0</p>
        <h1 className="mt-4 font-display text-4xl text-ink sm:text-5xl">Sign in</h1>
        <p className="mt-3 font-heading text-sm text-ink-muted">
          Only registered participants with a GITAM university Google account can sign in.
        </p>

        {errorMessage && (
          <p className="mt-6 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 font-heading text-sm text-red-300">
            {errorMessage}
          </p>
        )}

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-8 w-full rounded-full bg-gold px-8 py-3 font-heading text-sm font-medium text-void transition-colors hover:bg-gold-light disabled:opacity-60"
        >
          {loading ? "Redirecting…" : "Continue with Google"}
        </button>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
