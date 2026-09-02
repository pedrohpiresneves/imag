import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns the number of unread admin messages for the signed-in student.
 * Live via Realtime; falls back to a single query on mount.
 */
export function useSupportUnread(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let convId: string | null = null;
    let userId: string | null = null;
    let cancelled = false;

    async function refresh() {
      if (!userId) return;
      const { data: conv } = await supabase
        .from("support_conversations")
        .select("id,user_last_read_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (!conv) {
        if (!cancelled) setCount(0);
        return;
      }
      convId = conv.id;
      const { count: c } = await supabase
        .from("support_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conv.id)
        .eq("sender_role", "admin")
        .gt("created_at", conv.user_last_read_at);
      if (!cancelled) setCount(c ?? 0);
    }

    supabase.auth.getUser().then(({ data }) => {
      userId = data.user?.id ?? null;
      if (!userId) return;
      refresh();
    });

    const channel = supabase
      .channel("support-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages" },
        (payload) => {
          const row = payload.new as { conversation_id: string; sender_role: string };
          if (row.sender_role === "admin" && row.conversation_id === convId) {
            setCount((c) => c + 1);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "support_conversations" },
        () => refresh(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  return count;
}