import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";
import { ANTENNA_LEVELS, levelForMagnetos, nextLevelFor } from "./antenna";

export type AntennaState = {
  total: number;
  levelKey: string;
  nextKey: string | null;
  missing: number;
  unlocked: string[];
  /** Nível recém desbloqueado ainda não celebrado. */
  celebrate: string | null;
  /** Total de direções geradas ou recebidas (histórico completo). */
  directions: number;
  /** Direções realmente concluídas (histórico completo). */
  completed: number;
  /** Execução = concluídas ÷ totais × 100, arredondado. */
  execution: number;
  /** Dias distintos com direção concluída nos últimos 7 dias (0..7). */
  constancy: number;
  /** Dias distintos com direção concluída em toda a jornada. */
  historyDays: number;
};

const POINTS_PER_DIRECTION = 10;

/** Data local (YYYY-MM-DD) de um instante, no fuso do usuário. */
function localDate(iso: string, tzOffsetMinutes: number): string {
  const t = new Date(iso).getTime();
  return new Date(t - tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

export const getAntennaState = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z
      .object({ tzOffsetMinutes: z.number().int().min(-840).max(840).default(180) })
      .parse(raw ?? {}),
  )
  .handler(async ({ context, data }): Promise<AntennaState> => {
    const supabase = context.supabase;
    const userId = context.userId;
    const tz = data.tzOffsetMinutes;

    // 1) Fonte única de verdade: as direções do usuário.
    const { data: plans } = await supabase
      .from("user_plans")
      .select("id, status, completed_at, meta_date, generated_at")
      .eq("user_id", userId);

    const all = plans ?? [];
    const completedPlans = all.filter((p) => p.status === "completed");
    const directions = all.length;
    const completed = completedPlans.length;
    const execution = directions > 0 ? Math.round((completed / directions) * 100) : 0;

    // 2) Magnetos: 10 por direção concluída, uma única vez por direção.
    const { data: awards } = await supabase
      .from("magneto_awards")
      .select("id, plan_id, points")
      .eq("user_id", userId);

    const completedIds = new Set(completedPlans.map((p) => p.id));
    const awardedIds = new Set<string>();
    const staleAwardIds: string[] = [];
    for (const a of awards ?? []) {
      const pid = a.plan_id as string | null;
      // Remove concessões duplicadas, órfãs ou de direções não concluídas.
      if (!pid || !completedIds.has(pid) || awardedIds.has(pid)) {
        staleAwardIds.push(a.id as string);
        continue;
      }
      awardedIds.add(pid);
    }
    if (staleAwardIds.length > 0) {
      await supabase.from("magneto_awards").delete().in("id", staleAwardIds);
    }

    const missingRows = completedPlans
      .filter((p) => !awardedIds.has(p.id))
      .map((p) => ({
        user_id: userId,
        plan_id: p.id,
        source: "direction",
        points: POINTS_PER_DIRECTION,
        created_at: p.completed_at ?? new Date().toISOString(),
      }));
    if (missingRows.length > 0) {
      await supabase.from("magneto_awards").insert(missingRows);
    }

    // Saldo real: soma das transações de Magnetos registradas no banco.
    const { data: txs } = await supabase
      .from("magnet_transactions")
      .select("amount")
      .eq("user_id", userId);
    const txTotal = (txs ?? []).reduce((acc, t) => acc + (t.amount ?? 0), 0);
    const total = txTotal > 0 ? txTotal : completed * POINTS_PER_DIRECTION;

    // 3) Constância e marcos: dias distintos com direção concluída.
    const doneDates = new Set(
      completedPlans.map((p) =>
        p.completed_at
          ? localDate(p.completed_at, tz)
          : (p.meta_date ?? localDate(p.generated_at, tz)),
      ),
    );
    const todayLocal = localDate(new Date().toISOString(), tz);
    const last7 = new Set<string>();
    for (let i = 0; i < 7; i++) {
      const d = new Date(`${todayLocal}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - i);
      last7.add(d.toISOString().slice(0, 10));
    }
    const constancy = Array.from(doneDates).filter((d) => last7.has(d)).length;
    const historyDays = doneDates.size;

    // 4) Registra desbloqueios de antena (histórico, nunca removido).
    const { data: unlockRows } = await supabase
      .from("antenna_unlocks")
      .select("level_key, seen")
      .eq("user_id", userId);
    const unlockedSet = new Set((unlockRows ?? []).map((u) => u.level_key));
    const reached = ANTENNA_LEVELS.filter((l) => total >= l.threshold);
    const isFirstSync = (unlockRows ?? []).length === 0;
    const toInsert = reached
      .filter((l) => !unlockedSet.has(l.key))
      .map((l) => ({ user_id: userId, level_key: l.key, threshold: l.threshold, seen: isFirstSync }));
    if (toInsert.length > 0) {
      await supabase.from("antenna_unlocks").insert(toInsert);
      for (const r of toInsert) unlockedSet.add(r.level_key);
    }

    const pendingFromDb = (unlockRows ?? []).find((u) => !u.seen)?.level_key ?? null;
    const pendingNew = isFirstSync ? null : (toInsert[toInsert.length - 1]?.level_key ?? null);
    const celebrateKey = pendingNew ?? pendingFromDb;
    // Nunca celebrar a antena inicial.
    const celebrate = celebrateKey && celebrateKey !== "blue" ? celebrateKey : null;

    const current = levelForMagnetos(total);
    const next = nextLevelFor(total);
    return {
      total,
      levelKey: current.key,
      nextKey: next?.key ?? null,
      missing: next ? Math.max(0, next.threshold - total) : 0,
      unlocked: ANTENNA_LEVELS.filter((l) => unlockedSet.has(l.key)).map((l) => l.key),
      celebrate,
      directions,
      completed,
      execution,
      constancy,
      historyDays,
    };
  });

export const markAntennaSeen = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ levelKey: z.string().max(20) }).parse(raw))
  .handler(async ({ context, data }) => {
    await context.supabase
      .from("antenna_unlocks")
      .update({ seen: true })
      .eq("user_id", context.userId)
      .eq("level_key", data.levelKey);
    return { ok: true };
  });
