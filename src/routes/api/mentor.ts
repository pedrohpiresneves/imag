import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import {
  MENTOR_SYSTEM_PROMPT_WITH_TOOLS,
  buildUserContextBlock,
} from "@/lib/mentor-prompt";
import type { Database } from "@/integrations/supabase/types";
import { buildPersonalContextBlock } from "@/lib/mag/personal-context";
import { languageInstruction } from "@/lib/i18n/ai-language.server";
import { ORCHESTRATION_PRINCIPLE } from "@/lib/mag/domains";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { buildPlanningBlock, createPlanningTools } from "@/lib/mag/planning-tools.server";
import { buildMoneyBlock, createMoneyTools } from "@/lib/mag/money-tools.server";

type ChatBody = { messages?: UIMessage[] };

export const Route = createFileRoute("/api/mentor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatBody;
        if (!Array.isArray(messages)) {
          return new Response("messages required", { status: 400 });
        }
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Acesso restrito", { status: 401 });

        const accessClient = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          },
        );
        const { data: userData, error: userError } = await accessClient.auth.getUser(token);
        if (userError || !userData.user) return new Response("Acesso restrito", { status: 401 });
        const userId = userData.user.id;
        const { data: profile } = await accessClient
          .from("profiles")
          .select("full_name, profession, area, city, goal, challenge, language")
          .eq("id", userId)
          .maybeSingle();
        const { data: access } = await accessClient.rpc("get_my_access_status");
        if (!access || typeof access !== "object" || !("has_access" in access) || access.has_access !== true) {
          return new Response("Acesso restrito · assine ou ative seu teste.", { status: 403 });
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);

        // Load magnetic profile + current active plan for richer context.
        const [{ data: magnetic }, { data: activePlan }, { data: reflections }] = await Promise.all([
          accessClient
            .from("magnetic_profile")
            .select("identity, audience, business, communication, mindset, objectives, instagram, completeness")
            .eq("user_id", userId)
            .maybeSingle(),
          accessClient
            .from("user_plans")
            .select("priority_title, priority_reason, first_action, next_actions, generated_at")
            .eq("user_id", userId)
            .eq("is_active", true)
            .order("generated_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          accessClient
            .from("plan_reflections")
            .select("outcome, note, energy, reflected_for")
            .eq("user_id", userId)
            .order("reflected_for", { ascending: false })
            .limit(7),
        ]);

        const contextBlock =
          (profile ? buildUserContextBlock(profile) : "") +
          buildMagneticBlock(magnetic) +
          buildActivePlanBlock(activePlan) +
          buildReflectionsBlock(reflections) +
          buildPersonalContextBlock(
            (magnetic?.mindset ?? null) as Record<string, unknown> | null,
          );

        const setDirectionTool = tool({
          description:
            "Registra ou atualiza a Direção Inteligente do usuário quando você concluir um diagnóstico e definir a prioridade dos próximos dias. Chame apenas quando tiver clareza real sobre a prioridade e a primeira ação. Substitui o plano ativo anterior.",
          inputSchema: z.object({
            priority_title: z.string().min(3).max(200).describe("A prioridade central em uma frase curta e clara."),
            priority_reason: z.string().min(10).max(1000).describe("Por que essa é a prioridade agora, com base no diagnóstico."),
            first_action: z.string().min(3).max(500).describe("A primeira ação concreta que o usuário deve executar."),
            next_actions: z
              .array(z.object({ title: z.string().min(1).max(280) }))
              .max(6)
              .default([])
              .describe("Próximas ações complementares (até 6), pequenas e executáveis."),
          }),
          execute: async (input) => {
            const today = new Intl.DateTimeFormat("en-CA", {
              timeZone: "America/Sao_Paulo",
            }).format(new Date());
            await accessClient
              .from("user_plans")
              .update({ is_active: false })
              .eq("user_id", userId)
              .eq("is_active", true);
            const actions = (input.next_actions ?? []).slice(0, 6).map((a, i) => ({
              id: `a${Date.now()}-${i}`,
              title: a.title,
              done: false,
            }));
            const payload = {
              user_id: userId,
              priority_title: input.priority_title.slice(0, 200),
              priority_reason: input.priority_reason.slice(0, 1000),
              first_action: input.first_action.slice(0, 500),
              next_actions: actions,
              source: "mag",
              meta_date: today,
              status: "active",
              is_active: true,
            };
            const { error: upsertError } = await accessClient
              .from("user_plans")
              .upsert(payload, { onConflict: "user_id,meta_date" });
            if (upsertError) return { ok: false, error: upsertError.message };
            return { ok: true };
          },
        });

        const { data: prefs } = await accessClient
          .from("notification_preferences")
          .select("timezone")
          .eq("user_id", userId)
          .maybeSingle();
        const tz = (prefs?.timezone as string | null) || "America/Sao_Paulo";
        const planningTools = createPlanningTools(accessClient, userId, tz);

        // Foco da Semana já salvo — base obrigatória para atualizar a Direção do Dia.
        const { data: focusRow } = await accessClient
          .from("weekly_focus")
          .select("id, raw_text, interpreted, main_goal, start_date, end_date")
          .eq("user_id", userId)
          .eq("status", "active")
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        const focusText =
          (focusRow?.interpreted as string | null) ||
          (focusRow?.raw_text as string | null) ||
          null;

        const refreshDirectionTool = tool({
          description:
            "Regenera a Direção do Dia de hoje a partir do Foco da Semana já salvo pelo usuário. Use quando o usuário pedir para atualizar/refazer a direção do dia conforme o foco. Não faça perguntas se o foco já estiver definido: chame a tool e confirme em uma única mensagem curta.",
          inputSchema: z.object({
            reason: z
              .string()
              .max(200)
              .default("pedido do usuário")
              .describe("Motivo curto da atualização."),
          }),
          execute: async () => {
            if (!focusRow) {
              return {
                ok: false,
                error:
                  "Não há foco da semana ativo. Pergunte qual será o foco antes de gerar a direção.",
              };
            }
            const { invalidateOpenDirections } = await import("@/lib/mag/focus-invalidate.server");
            try {
              await invalidateOpenDirections(
                accessClient as never,
                userId,
                "manual_retry",
                null,
              );
            } catch (e) {
              return { ok: false, error: (e as Error).message };
            }
            return { ok: true, focus: focusText };
          },
        });


        const todayLocal = new Intl.DateTimeFormat("en-CA", {
          timeZone: tz,
        }).format(new Date());

        const addPriorityTool = tool({
          description:
            "Adiciona uma prioridade ao dia de hoje do usuário (mesma lista da aba Hoje). Use apenas após o usuário confirmar. Máximo de 3 prioridades por dia.",
          inputSchema: z.object({
            title: z.string().min(1).max(140).describe("A prioridade, curta e executável."),
          }),
          execute: async (input) => {
            const { count } = await accessClient
              .from("day_priorities")
              .select("id", { count: "exact", head: true })
              .eq("user_id", userId)
              .eq("day_date", todayLocal);
            if ((count ?? 0) >= 3) {
              return { ok: false, error: "Já existem 3 prioridades hoje. Pergunte qual sai." };
            }
            const { error } = await accessClient.from("day_priorities").insert({
              user_id: userId,
              day_date: todayLocal,
              title: input.title.trim(),
              position: count ?? 0,
            });
            if (error) return { ok: false, error: error.message };
            return { ok: true, title: input.title.trim() };
          },
        });

        const addEventTool = tool({
          description:
            "Adiciona um compromisso na agenda de hoje do usuário (mesma agenda da aba Hoje). Use apenas após o usuário confirmar horário e título.",
          inputSchema: z.object({
            start_time: z.string().regex(/^\d{2}:\d{2}$/).describe("Horário no formato HH:MM."),
            title: z.string().min(1).max(140).describe("O compromisso."),
          }),
          execute: async (input) => {
            const { error } = await accessClient.from("day_events").insert({
              user_id: userId,
              day_date: todayLocal,
              start_time: input.start_time,
              title: input.title.trim(),
            });
            if (error) return { ok: false, error: error.message };
            return { ok: true, start_time: input.start_time, title: input.title.trim() };
          },
        });

        const moneyTools = createMoneyTools(accessClient, userId, todayLocal);

        const result = streamText({
          model: gateway("google/gemini-3.1-pro-preview"),

          system:
            MENTOR_SYSTEM_PROMPT_WITH_TOOLS +
            ORCHESTRATION_PRINCIPLE +
            contextBlock +
            buildPlanningBlock(tz) +
            buildWeeklyFocusBlock(focusText) +
            buildMoneyBlock(todayLocal, focusText) +
            languageInstruction(
              isLocale(profile?.language) ? profile.language : DEFAULT_LOCALE,
            ),
          messages: await convertToModelMessages(messages),
          tools: {
            set_direction: setDirectionTool,
            refresh_day_direction: refreshDirectionTool,
            add_priority: addPriorityTool,
            add_event: addEventTool,
            plan_create: planningTools.plan_create,
            plan_search: planningTools.plan_search,
            plan_update: planningTools.plan_update,
            plan_delete: planningTools.plan_delete,
            plan_find_slot: planningTools.plan_find_slot,
            money_add: moneyTools.money_add,
            money_summary: moneyTools.money_summary,
          },
          stopWhen: stepCountIs(50),
        });
        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});

function buildWeeklyFocusBlock(focusText: string | null): string {
  if (!focusText) {
    return `\n\n─────────────────────────────\nFOCO DA SEMANA\n─────────────────────────────\nO usuário ainda não tem foco ativo. Se ele pedir para atualizar a Direção do Dia, pergunte em uma frase qual será o foco desta semana.`;
  }
  return `\n\n─────────────────────────────\nFOCO DA SEMANA (já salvo)\n─────────────────────────────\nFoco ativo: "${focusText}".\nEsse foco pode ser de qualquer área da vida — trabalho, estudos, finanças, casa, rotina, saúde, alimentação, exercício, sono. Nunca recuse o tema nem diga que só atua no profissional.\nQuando o usuário pedir para atualizar/refazer a Direção do Dia conforme o foco: NÃO faça perguntas redundantes. Chame a tool refresh_day_direction imediatamente e responda com UMA única mensagem curta confirmando que a direção de hoje foi atualizada com base nesse foco e que já está no card da tela Hoje.\nEm temas sensíveis (saúde, peso, alimentação, exercício, emoções) a direção é sempre de organização, rotina, registro ou hábito seguro — sem diagnóstico, dieta, treino prescrito ou promessa de resultado.`;
}

function buildMagneticBlock(
  m: {
    identity?: unknown;
    audience?: unknown;
    business?: unknown;
    communication?: unknown;
    mindset?: unknown;
    objectives?: unknown;
    instagram?: unknown;
    completeness?: number | null;
  } | null,
): string {
  if (!m) return "";
  const parts: string[] = [];
  const push = (label: string, val: unknown) => {
    if (!val || typeof val !== "object") return;
    const obj = val as Record<string, unknown>;
    const keys = Object.keys(obj).filter((k) => obj[k] != null && obj[k] !== "");
    if (keys.length === 0) return;
    parts.push(`\n${label}:`);
    for (const k of keys) parts.push(`  - ${k}: ${JSON.stringify(obj[k])}`);
  };
  push("IDENTIDADE", m.identity);
  push("PÚBLICO", m.audience);
  push("NEGÓCIO", m.business);
  push("COMUNICAÇÃO", m.communication);
  push("MENTALIDADE", m.mindset);
  push("OBJETIVOS", m.objectives);
  push("INSTAGRAM", m.instagram);
  if (parts.length === 0) return "";
  return `\n\n─────────────────────────────\nPERFIL MAGNÉTICO (dossiê construído pela MAG)\n─────────────────────────────\nUse este dossiê como base do diagnóstico. Não peça de novo o que já está aqui. Se algum dado estiver desatualizado, peça confirmação naturalmente.${parts.join("")}`;
}

function buildActivePlanBlock(
  p: {
    priority_title?: string | null;
    priority_reason?: string | null;
    first_action?: string | null;
    next_actions?: unknown;
    generated_at?: string | null;
  } | null,
): string {
  if (!p || !p.priority_title) return "";
  const actions = Array.isArray(p.next_actions)
    ? (p.next_actions as Array<{ title?: string; done?: boolean }>)
        .filter((a) => a && typeof a.title === "string")
        .map((a) => `  - [${a.done ? "x" : " "}] ${a.title}`)
        .join("\n")
    : "";
  return `\n\n─────────────────────────────\nDIREÇÃO INTELIGENTE ATIVA\n─────────────────────────────\nHoje o usuário está seguindo esta direção. Ao conversar, reconheça continuidade. Se ela ainda faz sentido, avance sobre ela. Se o contexto mudou, chame a tool set_direction para atualizar.\n- Prioridade: ${p.priority_title}\n${p.priority_reason ? `- Motivo: ${p.priority_reason}\n` : ""}${p.first_action ? `- Primeira ação: ${p.first_action}\n` : ""}${actions ? `- Próximas ações:\n${actions}\n` : ""}`;
}

function buildReflectionsBlock(
  rows:
    | Array<{
        outcome?: string | null;
        note?: string | null;
        energy?: number | null;
        reflected_for?: string | null;
      }>
    | null,
): string {
  if (!rows || rows.length === 0) return "";
  const labelOf = (o?: string | null) =>
    o === "done"
      ? "concluiu"
      : o === "partial"
        ? "concluiu em parte"
        : o === "blocked"
          ? "ficou travado"
          : o === "skipped"
            ? "não conseguiu"
            : "?";
  const lines = rows
    .filter((r) => r && r.reflected_for)
    .map((r) => {
      const parts = [`- ${r.reflected_for}: ${labelOf(r.outcome)}`];
      if (r.energy != null) parts.push(`energia ${r.energy}/5`);
      if (r.note) parts.push(`"${String(r.note).slice(0, 200)}"`);
      return parts.join(" · ");
    })
    .join("\n");
  return `\n\n─────────────────────────────\nMEMÓRIA ADAPTATIVA (últimos check-ins)\n─────────────────────────────\nUse esse histórico para calibrar o próximo passo. Se o usuário travou várias vezes na mesma ação, ela provavelmente está grande demais, confusa ou desalinhada — investigue antes de repetir. Reconheça avanços concretos sem elogio vazio.\n${lines}`;
}