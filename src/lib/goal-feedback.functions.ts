import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";

export type GoalFeedback = "liked" | "disliked";

const SubmitInput = z.object({
  goal_id: z.string().uuid(),
  feedback: z.enum(["liked", "disliked"]),
  goal_title: z.string().max(500).optional().nullable(),
  goal_category: z.string().max(120).optional().nullable(),
  goal_context: z.string().max(4000).optional().nullable(),
});

export const getGoalFeedback = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ goal_id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }): Promise<{ feedback: GoalFeedback; at: string | null } | null> => {
    const { data: row, error } = await context.supabase
      .from("mag_goal_feedback")
      .select("feedback, created_at, updated_at")
      .eq("user_id", context.userId)
      .eq("goal_id", data.goal_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return {
      feedback: row.feedback as GoalFeedback,
      at: (row.updated_at as string | null) ?? (row.created_at as string | null) ?? null,
    };
  });

export const submitGoalFeedback = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => SubmitInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("mag_goal_feedback")
      .upsert(
        {
          user_id: context.userId,
          goal_id: data.goal_id,
          feedback: data.feedback,
          goal_title: data.goal_title ?? null,
          goal_category: data.goal_category ?? null,
          goal_context: data.goal_context ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,goal_id" },
      );
    if (error) throw new Error(error.message);
    // Aprende também com o "não": guarda o motivo para não repetir a abordagem.
    try {
      const { learnFromRejection, recordDirectionSignal } = await import(
        "./mag/direction-engine.server"
      );
      const { strategyKey } = await import("./mag/text");
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("profession, goal")
        .eq("id", context.userId)
        .maybeSingle();
      if (data.feedback === "disliked") {
        await learnFromRejection(context.supabase, context.userId, {
          title: data.goal_title ?? null,
          reason: data.goal_context ?? null,
        });
      }
      if (data.goal_title) {
        await recordDirectionSignal(context.supabase, {
          strategyKey: strategyKey(data.goal_title),
          profession: profile?.profession ?? null,
          objective: profile?.goal ?? null,
          executed: false,
          positive: data.feedback === "liked",
          timeBucket: null,
        });
      }
    } catch (err) {
      console.error("[submitGoalFeedback] aprendizado falhou", err);
    }
    return { ok: true };
  });