import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import {
  ONBOARDING_SYSTEM_PROMPT,
  buildOnboardingContextBlock,
} from "@/lib/onboarding-prompt";
import type { Database } from "@/integrations/supabase/types";
import { languageInstruction } from "@/lib/i18n/ai-language.server";

type ChatBody = { messages?: UIMessage[] };

function extractText(message: UIMessage): string {
  const parts = (message as { parts?: Array<{ type: string; text?: string }> }).parts;
  if (Array.isArray(parts)) {
    return parts
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string)
      .join("");
  }
  const content = (message as { content?: unknown }).content;
  if (typeof content === "string") return content;
  return "";
}

function makeAccessClient(token: string) {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );
}

function mergeDimensions(
  current: Record<string, unknown>,
  incoming: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!incoming) return current;
  return { ...current, ...incoming };
}

function computeCompleteness(profile: {
  identity: Record<string, unknown>;
  audience: Record<string, unknown>;
  business: Record<string, unknown>;
  communication: Record<string, unknown>;
  mindset: Record<string, unknown>;
  objectives: Record<string, unknown>;
  instagram: Record<string, unknown>;
}): number {
  const weights: Array<[Record<string, unknown>, number]> = [
    [profile.identity, 20],
    [profile.audience, 15],
    [profile.business, 15],
    [profile.communication, 15],
    [profile.objectives, 20],
    [profile.mindset, 8],
    [profile.instagram, 7],
  ];
  let score = 0;
  for (const [dim, weight] of weights) {
    const keys = Object.keys(dim).length;
    score += Math.min(weight, keys * (weight / 3));
  }
  return Math.min(100, Math.round(score));
}

export const Route = createFileRoute("/api/onboarding-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as ChatBody;
        if (!Array.isArray(messages)) {
          return new Response("messages required", { status: 400 });
        }
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return new Response("Não autenticado", { status: 401 });

        const supabase = makeAccessClient(token);
        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData.user) {
          return new Response("Não autenticado", { status: 401 });
        }
        const userId = userData.user.id;

        const { data: profileRow } = await supabase
          .from("profiles")
          .select("full_name, language")
          .eq("id", userId)
          .maybeSingle();

        const onboardingLocale = profileRow?.language ?? null;

        // Ensure magnetic_profile row exists
        await supabase
          .from("magnetic_profile")
          .upsert({ user_id: userId }, { onConflict: "user_id" });

        const { data: mpRow } = await supabase
          .from("magnetic_profile")
          .select(
            "identity, audience, business, communication, mindset, objectives, instagram, completeness",
          )
          .eq("user_id", userId)
          .maybeSingle();

        const currentProfile = {
          identity: (mpRow?.identity as Record<string, unknown>) ?? {},
          audience: (mpRow?.audience as Record<string, unknown>) ?? {},
          business: (mpRow?.business as Record<string, unknown>) ?? {},
          communication: (mpRow?.communication as Record<string, unknown>) ?? {},
          mindset: (mpRow?.mindset as Record<string, unknown>) ?? {},
          objectives: (mpRow?.objectives as Record<string, unknown>) ?? {},
          instagram: (mpRow?.instagram as Record<string, unknown>) ?? {},
        };

        // Persist the latest user message to onboarding_messages
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === "user") {
          const text = extractText(lastMessage);
          if (text.trim()) {
            await supabase
              .from("onboarding_messages")
              .insert({ user_id: userId, role: "user", content: text });
          }
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const gateway = createLovableAiGatewayProvider(key);

        const contextBlock = buildOnboardingContextBlock({
          full_name: profileRow?.full_name ?? null,
          ...currentProfile,
        });

        // Tools: save profile facts and finalize onboarding.
        // Schemas kept intentionally loose (no min/max/enum bounds) per AI SDK best practices.
        const saveFactsTool = tool({
          description:
            "Salva silenciosamente informações aprendidas sobre o profissional. Chame sempre que o usuário fornecer qualquer fato novo relevante, mesmo pequeno. Cada dimensão é um objeto livre com chaves descritivas em português (ex: profissao, cidade, ticket_medio, maior_dificuldade). Passe apenas as dimensões que mudaram.",
          inputSchema: z.object({
            identity: z.record(z.string(), z.unknown()).optional(),
            audience: z.record(z.string(), z.unknown()).optional(),
            business: z.record(z.string(), z.unknown()).optional(),
            communication: z.record(z.string(), z.unknown()).optional(),
            mindset: z.record(z.string(), z.unknown()).optional(),
            objectives: z.record(z.string(), z.unknown()).optional(),
            instagram: z.record(z.string(), z.unknown()).optional(),
          }),
          execute: async (input) => {
            const merged = {
              identity: mergeDimensions(currentProfile.identity, input.identity),
              audience: mergeDimensions(currentProfile.audience, input.audience),
              business: mergeDimensions(currentProfile.business, input.business),
              communication: mergeDimensions(
                currentProfile.communication,
                input.communication,
              ),
              mindset: mergeDimensions(currentProfile.mindset, input.mindset),
              objectives: mergeDimensions(currentProfile.objectives, input.objectives),
              instagram: mergeDimensions(currentProfile.instagram, input.instagram),
            };
            Object.assign(currentProfile, merged);
            const completeness = computeCompleteness(merged);
            await supabase
              .from("magnetic_profile")
              .update({ ...merged, completeness } as never)
              .eq("user_id", userId);
            return { ok: true, completeness };
          },
        });

        const finalizeTool = tool({
          description:
            "Chame apenas quando tiver informação suficiente para criar a Direção Inteligente inicial. Isso encerra o onboarding, gera a direção do usuário e libera o dashboard.",
          inputSchema: z.object({
            direction_title: z.string(),
            direction_reason: z.string(),
            first_action: z.string(),
            next_actions: z.array(z.object({ title: z.string() })),
          }),
          execute: async (input) => {
            // Deactivate previous direction, then insert a fresh one
            await supabase
              .from("user_plans")
              .update({ is_active: false })
              .eq("user_id", userId)
              .eq("is_active", true);

            const actions = (input.next_actions ?? []).slice(0, 6).map((a, i) => ({
              id: `a${Date.now()}-${i}`,
              title: a.title,
              done: false,
            }));
            await supabase.from("user_plans").insert({
              user_id: userId,
              priority_title: input.direction_title.slice(0, 200),
              priority_reason: input.direction_reason.slice(0, 1000),
              first_action: input.first_action.slice(0, 500),
              next_actions: actions,
              source: "mag",
            });

            const completeness = computeCompleteness(currentProfile);
            await supabase
              .from("magnetic_profile")
              .update({
                onboarding_state: "completed",
                onboarding_finished_at: new Date().toISOString(),
                completeness,
              } as never)
              .eq("user_id", userId);

            // Mirror minimum info to legacy profiles fields the mentor context still reads.
            const profession = (currentProfile.identity as Record<string, unknown>)
              .profissao as string | undefined;
            const area = (currentProfile.identity as Record<string, unknown>)
              .especialidade as string | undefined;
            const city = (currentProfile.identity as Record<string, unknown>).cidade as
              | string
              | undefined;
            const goal = (currentProfile.objectives as Record<string, unknown>)
              .objetivo_principal as string | undefined;
            const challenge = (currentProfile.mindset as Record<string, unknown>)
              .maior_dificuldade as string | undefined;
            const legacyPayload: Record<string, string> = {};
            if (profession) legacyPayload.profession = profession;
            if (area) legacyPayload.area = area;
            if (city) legacyPayload.city = city;
            if (goal) legacyPayload.goal = goal;
            if (challenge) legacyPayload.challenge = challenge;
            legacyPayload.onboarding_completed_at = new Date().toISOString();
            await supabase.from("profiles").update(legacyPayload as never).eq("id", userId);

            // Ativa o trial de 10 dias (idempotente — RPC recusa se já usado).
            const { data: trialResult } = await supabase.rpc(
              "activate_trial_for_current_user",
            );
            return { ok: true, trial: trialResult };
          },
        });

        const result = streamText({
          model: gateway("google/gemini-3.1-pro-preview"),
          system:
            ONBOARDING_SYSTEM_PROMPT +
            contextBlock +
            languageInstruction(onboardingLocale),
          messages: await convertToModelMessages(messages),
          tools: {
            save_profile_facts: saveFactsTool,
            finalize_onboarding: finalizeTool,
          },
          stopWhen: stepCountIs(6),
          onFinish: async ({ text }) => {
            if (text && text.trim()) {
              await supabase.from("onboarding_messages").insert({
                user_id: userId,
                role: "assistant",
                content: text.trim(),
              });
            }
          },
        });

        return result.toUIMessageStreamResponse({ originalMessages: messages });
      },
    },
  },
});