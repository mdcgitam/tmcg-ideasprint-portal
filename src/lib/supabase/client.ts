import { createBrowserClient } from "@supabase/ssr";

// Browser-side Supabase client for use in Client Components. Runs under the
// anon key + RLS — only ever used for reads/RPCs that are safe pre-auth
// (availability checks) or scoped by a logged-in user's own session.
//
// Untyped (no <Database> generic): this supabase-js version's generic
// inference for .rpc() doesn't cleanly resolve against a hand-written
// Database type (see src/types/database.ts's row/RPC shapes) — callers
// annotate `.rpc()` results explicitly instead of relying on client-level
// inference. Revisit once `supabase gen types` produces a CLI-generated type.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
