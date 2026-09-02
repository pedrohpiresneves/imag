// Project-specific replacement for the generated `attachSupabaseAuth`.
// The generated version reads `supabase.auth.getSession()` once and, if the
// session is still hydrating from localStorage (common on hard refresh), the
// serverFn fires with no Authorization header and the server middleware throws
// `Unauthorized: No authorization header provided`, blanking the screen.
//
// This variant waits briefly for the session and calls `getUser()` as a
// fallback to force init. If there is still no token, the RPC goes out
// unauthenticated (server may 401), but that is preferable to reporting a
// blank-screen runtime error before the user even loads.
import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "./client";

async function resolveToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;
  // Force init / refresh — supabase-js hydrates from storage during getUser.
  await supabase.auth.getUser().catch(() => null);
  const { data: retry } = await supabase.auth.getSession();
  return retry.session?.access_token ?? null;
}

export const attachSupabaseAuthSafe = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = await resolveToken();
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);