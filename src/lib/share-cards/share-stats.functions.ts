import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { computeScore } from "@/lib/campo-magnetico/score";
import type { Reflection } from "@/lib/reflections.functions";

export type ShareLevelKey =
  | "coletando"
  | "despertando"
  | "polarizando"
  | "expandindo"
  | "campo_forte"
  | "alta_atracao";

export type ShareStats = {
  streak: number;
  missionsTotal: number;
  missionsWeek: number;
  checkinsWeek: number;
  magnetism: number | null;
  field: {
    total: number;
    focus: number;
    consistency: number;
    authority: number;
    magnetism: number;
  } | null;
  level: { key: ShareLevelKey; name: string; phrase: string };
  updatedAt: string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

function levelFromMagnetism(m: number | null): ShareStats["level"] {
  if (m == null) {
    return {
      key: "coletando",
      name: "Coletando dados",
      phrase: "Meu campo está começando a se formar.",
    };
  }
  if (m < 20)
    return { key: "despertando", name: "Despertando", phrase: "Meu campo está despertando." };
  if (m < 40)
    return { key: "polarizando", name: "Polarizando", phrase: "Estou criando consistência." };
  if (m < 60)
    return { key: "expandindo", name: "Expandindo", phrase: "Meu campo está se expandindo." };
  if (m < 80)
    return {
      key: "campo_forte",
      name: "Campo forte",
      phrase: "Minha presença está ficando mais forte.",
    };
  return { key: "alta_atracao", name: "Alta atração", phrase: "Estou atraindo com mais intenção." };
}

export const getShareStats = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }): Promise<ShareStats> => {
    const { supabase, userId } = context;

    // Puxa todo o histórico de reflexões — necessário para totais reais
    // e para reaproveitar a mesma lógica do Campo Magnético.
    const { data: rows, error } = await supabase
      .from("plan_reflections")
      .select("id, plan_id, outcome, note, energy, reflected_for, created_at, activity_text")
      .eq("user_id", userId)
      .order("reflected_for", { ascending: false });
    if (error) throw new Error(error.message);

    const reflections: Reflection[] = (rows ?? []).map((d) => ({
      id: d.id,
      plan_id: d.plan_id,
      outcome: d.outcome as Reflection["outcome"],
      note: d.note,
      energy: d.energy,
      reflected_for: d.reflected_for,
      created_at: d.created_at,
      activity_text: (d as { activity_text: string | null }).activity_text ?? null,
    }));

    const { data: mag } = await supabase
      .from("magnetic_profile")
      .select("completeness")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: prof } = await supabase
      .from("profiles")
      .select("goal, challenge")
      .eq("id", userId)
      .maybeSingle();

    const completeness = mag?.completeness ?? 0;
    const hasClearGoal = !!(prof?.goal && prof.goal.trim().length > 3);

    const score = computeScore({
      reflections,
      profileCompleteness: completeness,
      hasClearGoal,
    });

    const today = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(today.getDate() - 6);
    const weekStart = iso(weekAgo);

    const missionsTotal = reflections.filter((r) => r.outcome === "done").length;
    const missionsWeek = reflections.filter(
      (r) => r.outcome === "done" && r.reflected_for >= weekStart,
    ).length;
    const checkinsWeek = reflections.filter((r) => r.reflected_for >= weekStart).length;

    // Streak com a mesma regra do Campo Magnético (score.ts).
    const goodDays = new Set(
      reflections
        .filter((r) => r.outcome === "done" || r.outcome === "partial")
        .map((r) => r.reflected_for),
    );
    let streak = 0;
    const cursor = new Date();
    if (!goodDays.has(iso(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (goodDays.has(iso(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return {
      streak,
      missionsTotal,
      missionsWeek,
      checkinsWeek,
      magnetism: score.magnetism.value,
      field:
        score.total != null
          ? {
              total: score.total,
              focus: score.focus.value ?? 0,
              consistency: score.consistency.value ?? 0,
              authority: score.authority.value ?? 0,
              magnetism: score.magnetism.value ?? 0,
            }
          : null,
      level: levelFromMagnetism(score.magnetism.value),
      updatedAt: new Date().toISOString(),
    };
  });