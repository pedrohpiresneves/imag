import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Invalida direções abertas quando o foco muda.
 *
 * Direções já concluídas (ou com resultado registrado) nunca são tocadas:
 * histórico, resposta, magnetos e resultado permanecem intactos.
 * As invalidadas ficam apenas para auditoria — não aparecem na Home,
 * não geram magnetos e não contam no Progresso.
 */
export async function invalidateOpenDirections(
  supabase: SupabaseClient,
  userId: string,
  reason: string,
  keepFocusId?: string | null,
): Promise<number> {
  let query = supabase
    .from("user_plans")
    .select("id")
    .eq("user_id", userId)
    .is("completed_at", null)
    .is("outcome", null)
    .not("status", "in", '("completed","invalidated_by_focus_change")');

  if (keepFocusId) query = query.neq("weekly_focus_id", keepFocusId);

  const { data } = await query;
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (!ids.length) return 0;

  await supabase
    .from("user_plans")
    .update({
      status: "invalidated_by_focus_change",
      is_active: false,
      invalidated_at: new Date().toISOString(),
      invalidation_reason: reason,
    })
    .in("id", ids)
    .eq("user_id", userId);

  return ids.length;
}
