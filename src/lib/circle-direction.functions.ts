import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { generateObject } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  id: z.string().uuid(),
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const DirectionSchema = z.object({
  direction: z.string().min(12).max(180),
});

function normalize(s: string): string {
  return s
    .replace(/```json|```/g, "")
    .replace(/[*"“”]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Direção coletiva do círculo: uma única direção por dia, igual para
 * todos os membros, gerada a partir do foco em comum do grupo.
 */
export const ensureCircleDirection = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ context, data }): Promise<{ ok: boolean; direction: string | null }> => {
    const { data: existing } = await context.supabase
      .from("circle_directions")
      .select("text")
      .eq("circle_id", data.id)
      .eq("local_date", data.local_date)
      .maybeSingle();

    if (existing?.text) return { ok: true, direction: existing.text };

    const { data: circle, error: circleError } = await context.supabase
      .from("circles")
      .select("name, focus_label, challenge_text")
      .eq("id", data.id)
      .maybeSingle();

    if (circleError || !circle) {
      console.error("[circle-direction] circle_fetch_failed", {
        circleId: data.id,
        error: circleError?.message ?? "not_found",
      });
      return { ok: false, direction: null };
    }

    const focus = (circle.focus_label ?? circle.challenge_text ?? "").trim();
    const key = process.env["LOVABLE_API_KEY"];
    let text = "";

    if (key && focus) {
      try {
        const gateway = createLovableAiGatewayProvider(key);
        const res = await generateObject({
          model: gateway("google/gemini-2.5-flash"),
          schema: DirectionSchema,
          system:
            "Você é a MAG, mentora da iMAG. Escreva UMA direção coletiva do dia para um círculo de pessoas com o mesmo foco.\n" +
            "Regras:\n" +
            "- Português do Brasil, sem emojis, sem aspas.\n" +
            "- Fale com o grupo no plural (ex.: 'Anotem', 'Evitem').\n" +
            "- Uma ação concreta, simples e realizável hoje por qualquer membro (máx. 150 caracteres).\n" +
            "- Nunca faça diagnóstico médico nem prescrição de tratamento.\n" +
            "- Nada genérico: a ação precisa se conectar diretamente ao foco do círculo.",
          messages: [
            {
              role: "user",
              content: `Hoje é ${data.local_date}. Círculo: "${circle.name}". Foco em comum: "${focus}". Gere a direção coletiva de hoje.`,
            },
          ],
        });
        text = normalize(res.object.direction);
      } catch (err) {
        console.error("[circle-direction] ai_generation_failed", {
          circleId: data.id,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!text) {
      text = focus
        ? `Deem hoje um passo simples em ${focus.toLowerCase()} e registrem o que fizeram.`
        : "Deem hoje um passo simples no foco do círculo e registrem o que fizeram.";
    }

    const { error: saveError } = await context.supabase.rpc("set_circle_direction", {
      _circle_id: data.id,
      _local_date: data.local_date,
      _text: text,
    });

    if (saveError) {
      console.error("[circle-direction] direction_save_failed", {
        circleId: data.id,
        error: saveError.message,
      });
      return { ok: false, direction: null };
    }

    const { data: saved } = await context.supabase
      .from("circle_directions")
      .select("text")
      .eq("circle_id", data.id)
      .eq("local_date", data.local_date)
      .maybeSingle();

    return { ok: true, direction: saved?.text ?? text };
  });
