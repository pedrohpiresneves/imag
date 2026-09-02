import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { generateObject } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";
import {
  ApplyInput,
  DayAiInput,
  DayPlanSchema,
  DAY_AI_SYSTEM,
  fallbackPlan,
  type DayPlan,
} from "./day-ai.server";

export type { DayPlan } from "./day-ai.server";

/** Interpreta texto e/ou anexos e devolve um preview para o Meu dia (não grava nada). */
export const planMyDay = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => DayAiInput.parse(raw))
  .handler(async ({ data, context }): Promise<DayPlan> => {
    const inlineText = [
      data.text,
      ...data.attachments
        .filter((a) => a.text)
        .map((a) => `Conteúdo do arquivo "${a.name}":\n${a.text}`),
    ]
      .filter(Boolean)
      .join("\n\n");

    let plan = fallbackPlan(inlineText || "");
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      console.error("[day-ai] LOVABLE_API_KEY ausente — usando organização determinística", {
        userId: context.userId,
      });
    }
    if (key) {
      try {
        const gateway = createLovableAiGatewayProvider(key);
        const parts: Array<Record<string, unknown>> = [
          {
            type: "text",
            text: `Data de hoje: ${data.local_date}.\n\nTexto do usuário:\n"""${inlineText || "(sem texto — use os anexos)"}"""`,
          },
        ];
        for (const a of data.attachments) {
          if (!a.dataUrl) continue;
          if (a.kind === "image") parts.push({ type: "image", image: a.dataUrl });
          else
            parts.push({
              type: "file",
              data: a.dataUrl.split(",")[1] ?? "",
              mediaType: a.mediaType || "application/pdf",
              filename: a.name,
            });
        }
        const result = await generateObject({
          model: gateway("google/gemini-2.5-flash"),
          schema: DayPlanSchema,
          system: DAY_AI_SYSTEM,
          messages: [{ role: "user", content: parts as never }],
        });
        const o = result.object;
        if (o.priorities.length || o.events.length || o.note) plan = o;
      } catch (e) {
        // mantém o fallback determinístico
        console.error("[day-ai] geração pela IA falhou — usando fallback", {
          userId: context.userId,
          stage: "generate",
          chars: inlineText.length,
          attachments: data.attachments.length,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }
    return plan;
  });



/** Grava o plano confirmado nos blocos existentes do Meu dia. */
export const applyMyDay = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => ApplyInput.parse(raw))
  .handler(async ({ context, data }) => {
    const norm = (s: string) => s.trim().toLowerCase();
    let written = 0;
    let failures = 0;

    const [{ data: existingP }, { data: existingE }] = await Promise.all([
      context.supabase
        .from("day_priorities")
        .select("title")
        .eq("user_id", context.userId)
        .eq("day_date", data.local_date),
      context.supabase
        .from("day_events")
        .select("title, start_time")
        .eq("user_id", context.userId)
        .eq("day_date", data.local_date),
    ]);

    const seenP = new Set((existingP ?? []).map((r) => norm(r.title)));
    const seenE = new Set(
      (existingE ?? []).map((r) => `${norm(r.title)}@${String(r.start_time).slice(0, 5)}`),
    );
    let position = (existingP ?? []).length;

    for (const title of data.priorities) {
      if (position >= 3) break;
      if (seenP.has(norm(title))) continue; // idempotente: não duplica em novo toque
      const { error } = await context.supabase.from("day_priorities").insert({
        user_id: context.userId,
        day_date: data.local_date,
        title,
        position,
      });
      if (error) {
        failures += 1;
        console.error("[day-ai] falha ao gravar prioridade", {
          userId: context.userId,
          message: error.message,
          code: error.code,
        });
      } else {
        seenP.add(norm(title));
        position += 1;
        written += 1;
      }
    }

    for (const ev of data.events) {
      const key = `${norm(ev.title)}@${ev.start_time}`;
      if (seenE.has(key)) continue;
      const { error } = await context.supabase.from("day_events").insert({
        user_id: context.userId,
        day_date: data.local_date,
        title: ev.title,
        start_time: ev.start_time,
      });
      if (error) {
        failures += 1;
        console.error("[day-ai] falha ao gravar compromisso", {
          userId: context.userId,
          message: error.message,
          code: error.code,
        });
      } else {
        seenE.add(key);
        written += 1;
      }
    }

    if (data.note) {
      const { data: existing } = await context.supabase
        .from("day_notes")
        .select("id, body")
        .eq("user_id", context.userId)
        .eq("day_date", data.local_date)
        .maybeSingle();
      const already = (existing?.body ?? "").includes(data.note.trim());
      if (!already) {
        const body = existing?.body ? `${existing.body}\n${data.note}` : data.note;
        const res = existing?.id
          ? await context.supabase.from("day_notes").update({ body }).eq("id", existing.id)
          : await context.supabase
              .from("day_notes")
              .insert({ user_id: context.userId, day_date: data.local_date, body });
        if (res.error) {
          failures += 1;
          console.error("[day-ai] falha ao gravar nota", {
            userId: context.userId,
            message: res.error.message,
            code: res.error.code,
          });
        } else {
          written += 1;
        }
      }
    }

    // Nada gravado e houve erro real → o cliente precisa poder tentar de novo.
    if (written === 0 && failures > 0) {
      throw new Error("persist_failed");
    }

    return { ok: true, written };
  });

