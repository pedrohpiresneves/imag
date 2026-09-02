import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";

export type MagnetAward = { reason: string; amount: number; label: string };
export type ClaimResult = { ok: boolean; awards: MagnetAward[]; balance: number };

/**
 * Concede as recompensas de Magnetos pendentes do usuário.
 * A idempotência é garantida no banco (chave única por ação).
 * Não inclui marcos por dias com direção — esse sistema já existe e é preservado.
 */
export const claimMagnetRewards = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z
      .object({ localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
      .parse(raw ?? {}),
  )
  .handler(async ({ context, data }): Promise<ClaimResult> => {
    const { data: row, error } = await context.supabase.rpc("claim_magnet_rewards", {
      _local_date: data.localDate,
    });
    if (error) return { ok: false, awards: [], balance: 0 };
    const res = (row ?? {}) as { ok?: boolean; awards?: MagnetAward[]; balance?: number };
    return { ok: !!res.ok, awards: res.awards ?? [], balance: res.balance ?? 0 };
  });
