import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type ImpactStory = {
  id: string;
  profession: string | null;
  story: string;
  validations: number;
  reacted?: boolean;
  direction: string | null;
  howApplied: string | null;
  fullResult: string | null;
  hoursAgo: number | null;
  authorName?: string | null;
  isMine?: boolean;
  isDemo?: boolean;
};

export type ImpactRankingItem = {
  id: string;
  position: number;
  title: string;
  successPct: number;
};

export type ImpactCommunity = {
  professionalsToday: number;
  newClients: number;
  usefulPct: number;
  metasMonth: number;
};

export type ImpactOverview = {
  stories: ImpactStory[];
  ranking: ImpactRankingItem[];
  community: ImpactCommunity;
};

export const getImpactOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImpactOverview> => {
    const client = context.supabase as unknown as {
      rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data, error } = await client.rpc("get_impact_overview");
    if (error) throw new Error(error.message);
    return data as ImpactOverview;
  });

export const getDirectionConfidence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ title: z.string().max(500) }).parse(raw))
  .handler(async ({ context, data }): Promise<{ applied: number; pct: number }> => {
    const client = context.supabase as unknown as {
      rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    const { data: row, error } = await client.rpc("get_direction_confidence", { _title: data.title });
    if (error) throw new Error(error.message);
    return row as { applied: number; pct: number };
  });

const ImpactInput = z.object({
  goal_id: z.string().uuid().nullable().optional(),
  useful: z.boolean(),
  outcome_text: z.string().max(300).nullable().optional(),
  direction_title: z.string().max(500).nullable().optional(),
  published: z.boolean().optional(),
  author_name: z.string().max(120).nullable().optional(),
  profession: z.string().max(120).nullable().optional(),
});

export type DirectionImpactRecord = {
  useful: boolean;
  outcome_text: string | null;
  published: boolean;
  created_at: string | null;
};

export const getDirectionImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ goal_id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }): Promise<DirectionImpactRecord | null> => {
    const client = context.supabase as unknown as {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            c: string,
            v: string,
          ) => {
            eq: (
              c: string,
              v: string,
            ) => {
              maybeSingle: () => Promise<{
                data: Record<string, unknown> | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      };
    };
    const { data: row, error } = await client
      .from("direction_impacts")
      .select("useful, outcome_text, published, created_at")
      .eq("user_id", context.userId)
      .eq("goal_id", data.goal_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      useful: Boolean(row['useful']),
      outcome_text: (row['outcome_text'] as string | null) ?? null,
      published: Boolean(row['published']),
      created_at: (row['created_at'] as string | null) ?? null,
    };
  });

export const submitDirectionImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => ImpactInput.parse(raw))
  .handler(async ({ context, data }) => {
    const client = context.supabase as unknown as {
      from: (t: string) => {
        upsert: (
          v: Record<string, unknown>,
          o?: Record<string, unknown>,
        ) => Promise<{ error: { message: string } | null }>;
      };
    };
    const { error } = await client.from("direction_impacts").upsert(
      {
        user_id: context.userId,
        goal_id: data.goal_id ?? null,
        useful: data.useful,
        outcome_text: data.outcome_text ?? null,
        direction_title: data.direction_title ?? null,
        ...(data.published ? { published: true } : {}),
        ...(data.author_name ? { author_name: data.author_name } : {}),
        ...(data.profession ? { profession: data.profession } : {}),
      },
      { onConflict: "user_id,goal_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove apenas a publicação pública do mural. Mantém meta, check-in e histórico. */
export const unpublishDirectionImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const client = context.supabase as unknown as {
      from: (t: string) => {
        update: (v: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      };
    };
    const { error } = await client
      .from("direction_impacts")
      .update({ published: false })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type PendingImpact = {
  id: string;
  outcome_text: string;
  direction_title: string | null;
};

type ReadChain = {
  select: (c: string) => ReadChain;
  eq: (c: string, v: unknown) => ReadChain;
  not: (c: string, op: string, v: unknown) => ReadChain;
  order: (c: string, o: Record<string, unknown>) => ReadChain;
  limit: (n: number) => ReadChain;
  maybeSingle: () => Promise<{
    data: Record<string, unknown> | null;
    error: { message: string } | null;
  }>;
};

/** Último resultado registrado pelo usuário que ainda não foi publicado no mural. */
export const getPendingImpact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PendingImpact | null> => {
    const client = context.supabase as unknown as { from: (t: string) => ReadChain };
    const { data: row, error } = await client
      .from("direction_impacts")
      .select("id, outcome_text, direction_title")
      .eq("user_id", context.userId)
      .eq("published", false)
      .not("outcome_text", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const text = (row?.['outcome_text'] as string | null) ?? null;
    if (!row || !text?.trim()) return null;
    return {
      id: String(row['id']),
      outcome_text: text,
      direction_title: (row['direction_title'] as string | null) ?? null,
    };
  });

/** Marca/desmarca "Boa direção" (1 reação por usuário por publicação). */
export const toggleImpactReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z.object({ impact_id: z.string().uuid(), on: z.boolean() }).parse(raw),
  )
  .handler(async ({ context, data }): Promise<{ reacted: boolean; count: number }> => {
    const client = context.supabase as unknown as {
      rpc: (
        fn: string,
        args?: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    };
    // A função no banco é atômica e resolve o estado real (toggle) para auth.uid(),
    // funcionando também em publicações de outros usuários.
    const { data: row, error } = await client.rpc("toggle_impact_reaction", {
      _impact_id: data.impact_id,
    });
    if (error) throw new Error(error.message);
    const res = (row ?? {}) as { ok?: boolean; reason?: string; reacted?: boolean; count?: number };
    if (!res.ok) throw new Error(res.reason ?? "reaction_failed");
    let reacted = Boolean(res.reacted);
    let count = Number(res.count ?? 0);
    // Idempotência: se o estado final não bate com a intenção, alterna uma vez mais.
    if (reacted !== data.on) {
      const { data: row2, error: err2 } = await client.rpc("toggle_impact_reaction", {
        _impact_id: data.impact_id,
      });
      if (err2) throw new Error(err2.message);
      const res2 = (row2 ?? {}) as { reacted?: boolean; count?: number };
      reacted = Boolean(res2.reacted);
      count = Number(res2.count ?? count);
    }
    return { reacted, count };
  });

/** Publica no mural um impacto já registrado. */
export const publishImpactById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        author_name: z.string().max(120).nullable().optional(),
        profession: z.string().max(120).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const client = context.supabase as unknown as {
      from: (t: string) => {
        update: (v: Record<string, unknown>) => {
          eq: (c: string, v: string) => {
            eq: (c: string, v: string) => Promise<{ error: { message: string } | null }>;
          };
        };
      };
    };
    const { error } = await client
      .from("direction_impacts")
      .update({
        published: true,
        ...(data.author_name ? { author_name: data.author_name } : {}),
        ...(data.profession ? { profession: data.profession } : {}),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

