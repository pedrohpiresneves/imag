import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import { validateDirection } from "./mag/direction-validator";
import { resolveInteraction } from "./mag/interaction";
import { humanizeDirectionTitle } from "./mag/humanize-title";
import type { UserPlan } from "./plans.functions";
import { rowToPlan } from "./plans.functions";

const RefreshInput = z.object({
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timezone: z.string().max(64).optional(),
});

const RefreshDirectionSchema = z.object({
  title: z.string().min(8).max(140),
  description: z.string().min(10).max(300),
  reason: z.string().min(10).max(400),
});

const ENGINE_VERSION = "v3_master_logic";
const CONTEXT_VERSION = "refresh_v1";

function normalizeDirectionText(s: string): string {
  return s
    .replace(/```json|```/g, "")
    .replace(/\*/g, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Caminho robusto de "Tentar novamente" para a Direção do Dia.
 *
 * 1. Consulta o foco semanal ativo.
 * 2. Gera uma direção curta, prática e relacionada ao foco via IA.
 * 3. Normaliza e valida a resposta.
 * 4. Persiste por upsert na tabela user_plans.
 * 5. Invalida a direção anterior do mesmo dia, se houver.
 *
 * Cada etapa emite um log específico para diagnóstico. Erros reais
 * nunca são mascarados com mensagens genéricas.
 */
export const refreshTodayDirection = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => RefreshInput.parse(raw))
  .handler(async ({ context, data }): Promise<UserPlan> => {
    const localDate = data.local_date;
    const requestId = crypto.randomUUID();

    // 1. Foco semanal vigente.
    const { data: focusRow, error: focusError } = await context.supabase
      .from("weekly_focus")
      .select("id, end_date, interpreted, clarify_question, clarify_answer")
      .eq("user_id", context.userId)
      .eq("status", "active")
      .lte("start_date", localDate)
      .maybeSingle();

    if (focusError || !focusRow) {
      console.error("[refresh-direction] focus_fetch_failed", {
        userId: context.userId,
        localDate,
        error: focusError ? { message: focusError.message, code: focusError.code } : "no_active_focus",
      });
      throw new Error("focus_fetch_failed");
    }

    const focus = focusRow as {
      id: string;
      end_date: string;
      interpreted: string | null;
      clarify_question: string | null;
      clarify_answer: string | null;
    };

    if (focus.end_date < localDate) {
      console.error("[refresh-direction] focus_fetch_failed", {
        userId: context.userId,
        localDate,
        endDate: focus.end_date,
        reason: "focus_expired",
      });
      throw new Error("focus_fetch_failed");
    }

    if (focus.clarify_question && !(focus.clarify_answer ?? "").trim()) {
      console.error("[refresh-direction] focus_fetch_failed", {
        userId: context.userId,
        localDate,
        reason: "clarify_pending",
      });
      throw new Error("focus_fetch_failed");
    }

    const focusText = focus.interpreted ?? focus.clarify_answer ?? "";

    // 2. Geração pela IA.
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) {
      console.error("[refresh-direction] ai_generation_failed", {
        userId: context.userId,
        localDate,
        reason: "LOVABLE_API_KEY_missing",
      });
      throw new Error("ai_generation_failed");
    }

    let generated: z.infer<typeof RefreshDirectionSchema>;
    try {
      const gateway = createLovableAiGatewayProvider(key);
      const result = await generateObject({
        model: gateway("google/gemini-2.5-flash"),
        schema: RefreshDirectionSchema,
        system:
          "Você é a MAG, mentora estratégica da iMAG. Sua tarefa é criar uma DIREÇÃO DO DIA curta, prática e segura baseada exclusivamente no FOCO DA SEMANA do usuário.\n" +
          "Regras obrigatórias:\n" +
          "- Responda em português do Brasil, sem emojis.\n" +
          "- title: uma ação concreta que a pessoa pode realizar hoje (máx. 120 caracteres).\n" +
          "- description: como fazer, em 1-2 frases curtas (máx. 250 caracteres).\n" +
          "- reason: por que essa ação importa no contexto do foco (máx. 300 caracteres).\n" +
          "- NUNCA faça diagnóstico médico, prescreva tratamento ou dê aconselhamento de saúde.\n" +
          "- Para temas de saúde, alimentação, exercícios, rotina pessoal, estudos ou finanças: sugira organização, registro ou hábitos, nunca prescrição.\n" +
          "- Evite frases genéricas como 'organize a rotina', 'beba água', 'caminhe cinco minutos' sem conexão específica com o foco.\n" +
          "- Evite transferir a decisão ao usuário: não use 'escolha uma ação', 'defina um miniobjetivo', 'decida por onde começar'.",
        messages: [
          {
            role: "user",
            content: `Hoje é ${localDate}. FOCO DA SEMANA: "${focusText}". Gere a direção do dia.`,
          },
        ],
      });
      generated = result.object;
    } catch (err) {
      console.error("[refresh-direction] ai_generation_failed", {
        userId: context.userId,
        localDate,
        focusText,
        message: err instanceof Error ? err.message : String(err),
      });
      throw new Error("ai_generation_failed");
    }

    // 3. Normalização antes da validação.
    const normalized = {
      title: normalizeDirectionText(generated.title),
      description: normalizeDirectionText(generated.description),
      reason: normalizeDirectionText(generated.reason),
    };

    const check = validateDirection({
      title: normalized.title,
      description: normalized.description,
      reason: normalized.reason,
      focusText,
    });

    if (!check.ok) {
      console.error("[refresh-direction] invalid_ai_response", {
        userId: context.userId,
        localDate,
        focusText,
        reasons: check.reasons,
        raw: generated,
        normalized,
      });
      throw new Error("invalid_ai_response");
    }

    // 4. Monta a interface de execução.
    const { data: nameRow } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();

    const title = humanizeDirectionTitle(
      normalized.title,
      nameRow?.full_name ?? null,
      `${context.userId}:${localDate}`,
    );

    const interaction = resolveInteraction(title, normalized.description);

    // 5. Busca direção anterior do mesmo dia para reutilizar o id (preserva referências).
    const { data: existingPlan } = await context.supabase
      .from("user_plans")
      .select("id")
      .eq("user_id", context.userId)
      .eq("meta_date", localDate)
      .maybeSingle();

    const base = {
      user_id: context.userId,
      priority_title: title,
      priority_reason: normalized.reason,
      first_action: interaction.description || normalized.description,
      interaction_type: interaction.type,
      interaction_config: interaction.config as never,
      next_actions: [],
      source: "mag",
      meta_date: localDate,
      status: "active" as const,
      is_active: true,
      weekly_focus_id: focus.id,
      weekly_focus_text: focusText,
      timezone: data.timezone ?? null,
      context_version: CONTEXT_VERSION,
      engine_version: ENGINE_VERSION,
      request_id: requestId,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      invalidated_at: null,
      invalidation_reason: null,
    };

    let persisted;
    if (existingPlan?.id) {
      const { data: updated, error: updateError } = await context.supabase
        .from("user_plans")
        .update({ ...base, id: existingPlan.id })
        .eq("id", existingPlan.id)
        .select(
          "id, priority_title, priority_reason, first_action, next_actions, context_summary, source, generated_at, updated_at, meta_date, status, completed_at, continuity_mode, interaction_type, interaction_config, started_at, outcome, outcome_at, skip_reason, weekly_focus_id, engine_version",
        )
        .maybeSingle();

      if (updateError || !updated) {
        console.error("[refresh-direction] direction_upsert_failed", {
          userId: context.userId,
          localDate,
          stage: "update_existing",
          message: updateError?.message ?? "no_row_returned",
          code: updateError?.code ?? null,
        });
        throw new Error("direction_upsert_failed");
      }
      persisted = updated;
    } else {
      const { data: inserted, error: insertError } = await context.supabase
        .from("user_plans")
        .insert(base)
        .select(
          "id, priority_title, priority_reason, first_action, next_actions, context_summary, source, generated_at, updated_at, meta_date, status, completed_at, continuity_mode, interaction_type, interaction_config, started_at, outcome, outcome_at, skip_reason, weekly_focus_id, engine_version",
        )
        .maybeSingle();

      if (insertError || !inserted) {
        console.error("[refresh-direction] direction_upsert_failed", {
          userId: context.userId,
          localDate,
          stage: "insert",
          message: insertError?.message ?? "no_row_returned",
          code: insertError?.code ?? null,
        });
        throw new Error("direction_upsert_failed");
      }
      persisted = inserted;
    }

    console.log("[refresh-direction] direction_saved", {
      userId: context.userId,
      localDate,
      planId: persisted.id,
      focusId: focus.id,
      focusText,
      title,
    });

    return rowToPlan(persisted);
  });
