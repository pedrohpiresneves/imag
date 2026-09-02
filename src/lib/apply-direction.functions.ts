import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";
import { generateObject } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export type AdaptedDirection = {
  action: string;
  tip: string;
  why: string;
  when: string;
};

const AdaptInput = z.object({
  direction: z.string().min(3).max(600),
  variant: z.number().int().min(0).max(10).default(0),
});

export const adaptDirection = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => AdaptInput.parse(raw))
  .handler(async ({ context, data }): Promise<AdaptedDirection> => {
    const [{ data: profile }, { data: magnetic }] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("full_name, profession, area, city, goal, challenge")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("magnetic_profile")
        .select("identity, audience, business, communication, mindset, objectives")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);

    const fallback: AdaptedDirection = {
      action: data.direction,
      tip: "Faça em uma janela curta, sem interrupções.",
      why: "Direções validadas por outros profissionais tendem a gerar resultado quando aplicadas rápido.",
      when: "Hoje, idealmente até 18h.",
    };

    const key = process.env.LOVABLE_API_KEY;
    if (!key) return fallback;

    try {
      const gateway = createLovableAiGatewayProvider(key);
      const ctx = [
        profile?.profession ? `Profissão: ${profile.profession}` : null,
        profile?.area ? `Área: ${profile.area}` : null,
        profile?.goal ? `Objetivo: ${profile.goal}` : null,
        profile?.challenge ? `Desafio: ${profile.challenge}` : null,
        magnetic ? `Perfil magnético: ${JSON.stringify(magnetic).slice(0, 1500)}` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const result = await generateObject({
        model: gateway("google/gemini-2.5-flash"),
        schema: z.object({
          action: z.string().min(6).max(220),
          tip: z.string().min(6).max(200),
          why: z.string().min(10).max(260),
          when: z.string().min(3).max(80),
        }),
        system:
          "Você é a MAG, mentora estratégica da iMAG. Recebe uma direção validada por outro profissional e a adapta ao momento de quem está lendo. Português BR, tom direto, sem emojis, sem preâmbulo. 'action' é uma ação única, concreta, executável hoje, com número quando fizer sentido. 'tip' é uma orientação curta de execução. 'why' explica em uma frase por que pode funcionar para essa pessoa. 'when' é o momento ideal do dia (ex.: 'Hoje, idealmente até 18h.'). Use o vocabulário da profissão (saúde: paciente; comércio/serviço: cliente; empresa: equipe).",
        prompt: `Direção original: "${data.direction}"\n\nContexto do usuário:\n${ctx || "Sem contexto detalhado."}\n\n${
          data.variant > 0
            ? `Esta é a variação nº ${data.variant + 1}: gere um ângulo DIFERENTE da mesma direção, sem repetir a versão anterior.`
            : "Adapte a direção agora."
        }`,
      });
      return result.object;
    } catch (err) {
      console.error("[adaptDirection] falhou", err);
      return fallback;
    }
  });

const AddInput = z.object({
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.string().min(3).max(280),
});

export const addDirectionToToday = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => AddInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { data: plan, error } = await context.supabase
      .from("user_plans")
      .select("id, next_actions")
      .eq("user_id", context.userId)
      .eq("meta_date", data.local_date)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const newAction = { id: `imp-${Date.now()}`, title: data.action, done: false };

    if (!plan) {
      const { error: insertError } = await context.supabase.from("user_plans").insert({
        user_id: context.userId,
        priority_title: data.action,
        priority_reason: null,
        first_action: data.action,
        next_actions: [],
        source: "mag",
        meta_date: data.local_date,
      });
      if (insertError) throw new Error(insertError.message);
      return { ok: true, created: true };
    }

    const current = Array.isArray(plan.next_actions)
      ? (plan.next_actions as Array<{ id: string; title: string; done: boolean }>)
      : [];
    const { error: updateError } = await context.supabase
      .from("user_plans")
      .update({ next_actions: [...current, newAction] })
      .eq("id", plan.id)
      .eq("user_id", context.userId);
    if (updateError) throw new Error(updateError.message);
    return { ok: true, created: false };
  });