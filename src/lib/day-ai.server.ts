import { z } from "zod";

export const AttachmentSchema = z.object({
  name: z.string().trim().max(200),
  mediaType: z.string().trim().max(120),
  kind: z.enum(["image", "doc"]),
  dataUrl: z.string().max(16_000_000).optional(),
  text: z.string().max(20000).optional(),
});

export const DayAiInput = z
  .object({
    text: z.string().trim().max(2000).default(""),
    local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    attachments: z.array(AttachmentSchema).max(5).default([]),
  })
  .refine((v) => v.text.length >= 2 || v.attachments.length > 0, {
    message: "Escreva, fale ou anexe algo.",
  });


export const DayPlanSchema = z.object({
  priorities: z.array(z.string().min(2).max(90)).max(3),
  events: z
    .array(
      z.object({
        title: z.string().min(2).max(90),
        start_time: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .max(5),
  note: z.string().max(400).nullable(),
});

export type DayPlan = z.infer<typeof DayPlanSchema>;

export const ApplyInput = z.object({
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  priorities: z.array(z.string().trim().min(1).max(90)).max(3),
  events: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(90),
        start_time: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .max(5),
  note: z.string().trim().max(400).nullable(),
});

export const DAY_AI_SYSTEM =
  "Você é a MAG, mentora estratégica da iMAG. Recebe um despejo livre do usuário sobre o dia dele (texto, ditado e/ou anexos como prints, fotos, PDFs e planilhas) e organiza SOMENTE em três campos existentes: prioridades (até 3 ações curtas no imperativo, verbo + alvo, máx. 80 caracteres), compromissos (itens com horário explícito, formato HH:MM 24h) e nota (qualquer informação restante, em uma frase curta; null se não houver). Leia os anexos e extraia deles compromissos, horários, tarefas e prioridades. Português BR, sem emojis, sem inventar itens que o usuário não mencionou. Não crie categorias novas.";


/** Organização determinística usada quando a IA não está disponível. */
export function fallbackPlan(text: string): DayPlan {
  const parts = text
    .split(/[\n;]+|,\s+|\se\s(?=[a-zA-ZÀ-ÿ]{3,})/g)
    .map((t) => t.trim().replace(/^[-•*]\s*/, ""))
    .filter((t) => t.length > 2);

  const priorities: string[] = [];
  const events: DayPlan["events"] = [];
  const rest: string[] = [];

  for (const raw of parts) {
    const m = raw.match(/\b([01]?\d|2[0-3])(?:[:h]([0-5]\d))?\s*(?:h|horas)?\b/);
    const hasTime = m && /\b(às|as|\d{1,2}h|\d{1,2}:\d{2})\b/i.test(raw);
    if (hasTime && events.length < 5) {
      const title = raw
        .replace(/\b(tenho|hoje|uma|um)\b/gi, " ")
        .replace(/\b(às|as)\s*[\d:h]+\s*(h|horas)?/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      events.push({
        title: (title || raw).slice(0, 90),
        start_time: `${m![1]!.padStart(2, "0")}:${m![2] ?? "00"}`,
      });
      continue;
    }
    if (priorities.length < 3) {
      const t = raw.replace(/^(hoje\s+)?(preciso|tenho que|quero)\s+/i, "");
      priorities.push((t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 90));
    } else rest.push(raw);
  }

  return { priorities, events, note: rest.length ? rest.join("; ").slice(0, 400) : null };
}
