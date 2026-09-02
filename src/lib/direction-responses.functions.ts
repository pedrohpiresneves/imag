import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";

export type DirectionResponseContent = {
  kind: "expenses" | "list" | "reflection" | "quick" | "structured";
  interaction_type?: string | null;
  choices?: string[] | null;
  items?: { label: string; value?: string | null }[];
  text?: string | null;
  choice?: string | null;
  skip_values?: boolean;
};

export type DirectionResponse = {
  id: string;
  plan_id: string | null;
  direction_title: string | null;
  life_area: string | null;
  response_type: string;
  content: DirectionResponseContent;
  learning: string | null;
  influences_future: boolean;
  created_at: string;
  updated_at: string;
};

const ContentSchema = z.object({
  kind: z.enum(["expenses", "list", "reflection", "quick", "structured"]),
  interaction_type: z.string().max(40).nullable().optional(),
  choices: z.array(z.string().trim().max(160)).max(12).nullable().optional(),
  items: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(200),
        value: z.string().trim().max(2000).nullable().optional(),
      }),
    )
    .max(12)
    .optional(),
  text: z.string().trim().max(4000).nullable().optional(),
  choice: z.string().trim().max(120).nullable().optional(),
  skip_values: z.boolean().optional(),
});

const SaveInput = z.object({
  plan_id: z.string().uuid(),
  direction_title: z.string().max(300).nullable().optional(),
  life_area: z.string().max(40).nullable().optional(),
  content: ContentSchema,
  complete: z.boolean().default(true),
});

/** Resumo textual curto da resposta, usado como base para o aprendizado. */
function summarize(content: DirectionResponseContent): string {
  if (content.items?.length) {
    return content.items
      .map((i) => (i.value ? `${i.label} (${i.value})` : i.label))
      .join("; ");
  }
  if (content.text) return content.text;
  if (content.choices?.length) return content.choices.join("; ");
  if (content.choice) return content.choice;
  return "";
}

async function buildLearning(
  directionTitle: string | null,
  lifeArea: string | null,
  content: DirectionResponseContent,
): Promise<string | null> {
  const summary = summarize(content);
  if (!summary) return null;
  const key = process.env.LOVABLE_API_KEY;
  const fallback = `Área ${lifeArea ?? "pessoal"}: ${summary}`.slice(0, 280);
  if (!key) return fallback;
  try {
    const { generateObject } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("./ai-gateway.server");
    const gateway = createLovableAiGatewayProvider(key);
    const out = await generateObject({
      model: gateway("google/gemini-2.5-flash"),
      schema: z.object({ learning: z.string().min(6).max(240) }),
      system:
        "Você é a MAG, mentora estratégica da iMAG. Receba a resposta que o usuário registrou dentro do app e escreva UM aprendizado curto (uma frase, português BR, sem emojis, sem julgamento) que ajude a personalizar as próximas direções. Fale sobre o padrão observado, não repita a resposta literalmente.",
      prompt: `Direção: ${directionTitle ?? "—"}\nÁrea: ${lifeArea ?? "pessoal"}\nResposta do usuário: ${summary}`,
    });
    return out.object.learning;
  } catch (err) {
    console.error("[direction-responses] aprendizado falhou", err);
    return fallback;
  }
}

export const getDirectionResponse = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ plan_id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }): Promise<DirectionResponse | null> => {
    const { data: row, error } = await context.supabase
      .from("direction_responses")
      .select(
        "id, plan_id, direction_title, life_area, response_type, content, learning, influences_future, created_at, updated_at",
      )
      .eq("user_id", context.userId)
      .eq("plan_id", data.plan_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return null;
    return { ...row, content: (row.content ?? {}) as DirectionResponseContent } as DirectionResponse;
  });

export const saveDirectionResponse = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => SaveInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { data: plan, error: planError } = await context.supabase
      .from("user_plans")
      .select("id, priority_title, status")
      .eq("id", data.plan_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (planError) throw new Error(planError.message);
    if (!plan) throw new Error("Direção não encontrada");

    const title = data.direction_title ?? plan.priority_title ?? null;
    const learning = await buildLearning(title, data.life_area ?? null, data.content);

    const { error } = await context.supabase.from("direction_responses").upsert(
      {
        user_id: context.userId,
        plan_id: data.plan_id,
        direction_title: title,
        life_area: data.life_area ?? null,
        response_type: data.content.kind,
        content: data.content as unknown as never,
        learning,
        influences_future: true,
      },
      { onConflict: "user_id,plan_id" },
    );
    if (error) throw new Error(error.message);

    // Conclusão + recompensa em operação atômica e idempotente no banco.
    let awarded = false;
    let balance = 0;
    if (data.complete) {
      const { data: result, error: completeError } = await context.supabase.rpc(
        "complete_direction_with_reward",
        { _plan_id: plan.id },
      );
      if (completeError) throw new Error(completeError.message);
      const res = (result ?? {}) as { awarded?: boolean; balance?: number };
      awarded = res.awarded === true;
      balance = res.balance ?? 0;
    }

    return { ok: true, learning, awarded, balance };
  });


export const deleteDirectionResponse = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ plan_id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("direction_responses")
      .delete()
      .eq("user_id", context.userId)
      .eq("plan_id", data.plan_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
