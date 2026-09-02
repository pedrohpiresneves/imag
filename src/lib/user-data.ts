import { supabase } from "@/integrations/supabase/client";

export async function fetchPurchase(userId: string) {
  const { data } = await supabase
    .from("purchases")
    .select("status, paid_at")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function fetchProgress(userId: string) {
  const { data } = await supabase
    .from("module_progress")
    .select("module_slug, completed, last_read_at")
    .eq("user_id", userId);
  return data ?? [];
}

export async function fetchFavorites(userId: string) {
  const { data } = await supabase
    .from("favorites")
    .select("module_slug")
    .eq("user_id", userId);
  return (data ?? []).map((r) => r.module_slug);
}

export async function markModuleRead(userId: string, slug: string, completed = false) {
  await supabase.from("module_progress").upsert(
    {
      user_id: userId,
      module_slug: slug,
      completed,
      last_read_at: new Date().toISOString(),
    },
    { onConflict: "user_id,module_slug" },
  );
}

export async function toggleFavorite(userId: string, slug: string, on: boolean) {
  if (on) {
    await supabase.from("favorites").insert({ user_id: userId, module_slug: slug });
  } else {
    await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("module_slug", slug);
  }
}

export async function fetchProfile(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle();
  return data;
}
