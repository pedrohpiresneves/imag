/**
 * Ferramentas de Planejamento para o chat da MAG.
 * A MAG interpreta linguagem natural, converte datas relativas em datas
 * absolutas (no fuso do usuário) e persiste no planejamento do usuário logado.
 */
import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { classifyPlanIcon } from "@/lib/mag/plan-icons";

type Client = SupabaseClient<Database>;

const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const Time = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");
const Kind = z.enum(["event", "task", "goal_week", "goal_month", "goal_year", "deadline"]);

export type MagPlanItem = {
  id: string;
  kind: string;
  title: string;
  info: string | null;
  date: string | null;
  time: string | null;
  icon: string | null;
  done?: boolean;
};

const WEEKDAY_PT = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
];

export function localTodayIso(tz: string, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(at);
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(at);
  }
}

export function localTimeHm(tz: string, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
    }).format(at);
  } catch {
    return "09:00";
  }
}

function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Bloco temporal + regras de planejamento injetado no system prompt. */
export function buildPlanningBlock(tz: string, at = new Date()): string {
  const today = localTodayIso(tz, at);
  const now = localTimeHm(tz, at);
  const wd = WEEKDAY_PT[weekdayOf(today)];
  return `\n\n─────────────────────────────
PLANEJAMENTO POR LINGUAGEM NATURAL
─────────────────────────────
Fuso do usuário: ${tz}. Hoje é ${wd}, ${today}, agora são ${now}.
Amanhã: ${addDays(today, 1)}. Depois de amanhã: ${addDays(today, 2)}.

Quando o usuário pedir para agendar, lembrar, marcar, mudar, cancelar ou consultar algo, use as tools de planejamento (plan_create, plan_search, plan_update, plan_delete). Nunca finja ter salvo.

Regras:
- Converta sempre expressões relativas ("hoje", "amanhã", "sábado", "próxima semana", "fim do mês", "daqui a duas horas") em data absoluta YYYY-MM-DD e horário HH:MM antes de chamar a tool. Dias da semana sem qualificação significam a próxima ocorrência futura.
- Se a solicitação estiver completa e sem ambiguidade, salve imediatamente e responda em uma frase curta, confirmando o que foi salvo com data em português (ex.: "Dentista agendado para sábado, 5 de setembro, às 18h.").
- Se faltar uma informação indispensável (ex.: horário de um compromisso), faça só UMA pergunta objetiva. Não repita o que já foi dito.
- Peça confirmação antes de salvar apenas quando houver ambiguidade real, data no passado ou conflito de horário.
- Para editar ou excluir, primeiro use plan_search para localizar o item. Se houver dois itens parecidos, pergunte qual deles. Nunca edite nem exclua um item ambíguo em silêncio.
- Recorrência ("toda segunda e quarta às 7h"): use repeat_weekdays no plan_create.
- Consultas ("o que tenho no sábado?"): use plan_search e responda em linhas curtas.
- Execute de imediato quando estiver claro. Não peça confirmação por hábito: só pergunte quando houver dúvida real, conflito ou risco de registrar errado.
- Horário livre ("encontre um horário para estudar esta semana"): use plan_find_slot e proponha uma opção concreta.
- Se plan_create retornar conflito, avise em uma frase e pergunte se quer manter os dois, mudar o horário ou substituir. Ao confirmar, chame plan_create com confirm_conflict: true.
- Tudo que for criado com data de hoje já aparece automaticamente na rotina do dia.
- Respostas humanas e breves: menos ruído, mais direção.`;
}

function toItem(row: Record<string, unknown>, kind: "event" | "item"): MagPlanItem {
  if (kind === "event") {
    return {
      id: `event:${row["id"]}`,
      kind: "event",
      title: String(row["title"] ?? ""),
      info: null,
      date: (row["day_date"] as string | null) ?? null,
      time: ((row["start_time"] as string | null) ?? "").slice(0, 5) || null,
      icon: (row["icon"] as string | null) ?? null,
    };
  }
  return {
    id: `item:${row["id"]}`,
    kind: String(row["kind"] ?? "task"),
    title: String(row["title"] ?? ""),
    info: (row["info"] as string | null) ?? null,
    date: (row["due_date"] as string | null) ?? null,
    time: (row["due_time"] as string | null) ?? null,
    icon: (row["icon"] as string | null) ?? null,
    done: Boolean(row["done"]),
  };
}

function toMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function fromMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function splitId(id: string) {
  const [prefix, real] = id.split(":");
  return { prefix: prefix ?? "", real: real ?? "" };
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function createPlanningTools(supabase: Client, userId: string, tz: string) {
  const today = localTodayIso(tz);

  const plan_create = tool({
    description:
      "Cria compromisso, tarefa, meta, prazo ou lembrete no Planejamento do usuário. Datas já convertidas para YYYY-MM-DD e horário HH:MM. Use repeat_weekdays para recorrência semanal.",
    inputSchema: z.object({
      kind: Kind.describe(
        "event = compromisso com data/hora; task = tarefa; deadline = prazo ou lembrete; goal_week/goal_month/goal_year = metas.",
      ),
      title: z.string().min(1).max(160).describe("Título curto, sem verbos de comando desnecessários."),
      info: z.string().max(200).optional().describe("Observação curta, se o usuário deu alguma."),
      date: LocalDate.optional().describe("Data absoluta no fuso do usuário."),
      time: Time.optional().describe("Horário no formato 24h."),
      repeat_weekdays: z
        .array(z.number().int().min(0).max(6))
        .max(7)
        .optional()
        .describe("0=domingo … 6=sábado. Cria uma ocorrência por semana em cada dia informado."),
      repeat_weeks: z.number().int().min(1).max(12).optional().describe("Quantas semanas repetir (padrão 8)."),
      confirm_conflict: z
        .boolean()
        .optional()
        .describe("true quando o usuário já confirmou que quer manter o compromisso mesmo com conflito de horário."),
    }),
    execute: async (input) => {
      const icon = classifyPlanIcon(input.title, input.info ?? null);
      const title = input.title.trim();

      const dates: string[] = [];
      if (input.repeat_weekdays && input.repeat_weekdays.length > 0) {
        const weeks = input.repeat_weeks ?? 8;
        const start = input.date ?? today;
        for (let i = 0; i < weeks * 7; i += 1) {
          const d = addDays(start, i);
          if (input.repeat_weekdays.includes(weekdayOf(d))) dates.push(d);
        }
      } else if (input.date) {
        dates.push(input.date);
      }

      if (input.kind === "event") {
        if (dates.length === 0) {
          return { ok: false, error: "Compromisso precisa de data. Pergunte a data ao usuário." };
        }
        if (!input.confirm_conflict && input.time) {
          const { data: sameDay } = await supabase
            .from("day_events")
            .select("id, day_date, start_time, title, icon")
            .eq("user_id", userId)
            .in("day_date", dates);
          const conflicts = (sameDay ?? []).filter((e) => {
            const t = String(e.start_time ?? "").slice(0, 5);
            return t && Math.abs(toMin(t) - toMin(input.time!)) < 60;
          });
          if (conflicts.length > 0) {
            return {
              ok: false,
              action: "conflict" as const,
              conflicts: conflicts.map((e) => toItem(e as Record<string, unknown>, "event")),
              error:
                "Já existe compromisso próximo desse horário. Avise o usuário e pergunte se quer manter os dois, mudar o horário ou substituir. Se ele confirmar, chame plan_create de novo com confirm_conflict: true.",
            };
          }
        }
        const rows = dates.map((d) => ({
          user_id: userId,
          day_date: d,
          start_time: input.time ?? "09:00",
          title,
          icon,
          source: "mag",
        }));
        const { data, error } = await supabase.from("day_events").insert(rows).select("id, day_date, start_time, title, icon");
        if (error) return { ok: false, error: error.message };
        return {
          ok: true,
          action: "created" as const,
          items: (data ?? []).map((r) => toItem(r as Record<string, unknown>, "event")),
        };
      }

      const rows = (dates.length > 0 ? dates : [null]).map((d) => ({
        user_id: userId,
        kind: input.kind,
        title,
        info: input.info?.trim() || null,
        due_date: d,
        due_time: input.time ?? null,
        icon,
        source: "mag",
      }));
      const { data, error } = await supabase
        .from("plan_items")
        .insert(rows)
        .select("id, kind, title, info, due_date, due_time, done, icon");
      if (error) return { ok: false, error: error.message };
      return {
        ok: true,
        action: "created" as const,
        items: (data ?? []).map((r) => toItem(r as Record<string, unknown>, "item")),
      };
    },
  });

  const plan_search = tool({
    description:
      "Busca itens do Planejamento do usuário por texto e/ou intervalo de datas. Use antes de editar, excluir ou responder o que o usuário tem em um dia.",
    inputSchema: z.object({
      query: z.string().max(120).optional().describe("Texto aproximado do título."),
      from: LocalDate.optional().describe("Início do intervalo (inclusive)."),
      to: LocalDate.optional().describe("Fim do intervalo (inclusive)."),
    }),
    execute: async (input) => {
      const from = input.from ?? null;
      const to = input.to ?? null;

      let evQ = supabase
        .from("day_events")
        .select("id, day_date, start_time, title, icon")
        .eq("user_id", userId)
        .order("day_date", { ascending: true })
        .limit(60);
      if (from) evQ = evQ.gte("day_date", from);
      if (to) evQ = evQ.lte("day_date", to);

      const itQ = supabase
        .from("plan_items")
        .select("id, kind, title, info, due_date, due_time, done, icon")
        .eq("user_id", userId)
        .order("due_date", { ascending: true })
        .limit(120);

      const [ev, it] = await Promise.all([evQ, itQ]);
      if (ev.error) return { ok: false, error: ev.error.message };
      if (it.error) return { ok: false, error: it.error.message };

      let items = [
        ...(ev.data ?? []).map((r) => toItem(r as Record<string, unknown>, "event")),
        ...(it.data ?? [])
          .map((r) => toItem(r as Record<string, unknown>, "item"))
          .filter((i) => {
            if (!i.date) return !from && !to ? true : !input.query ? false : true;
            if (from && i.date < from) return false;
            if (to && i.date > to) return false;
            return true;
          }),
      ];
      if (input.query) {
        const q = normalize(input.query);
        const words = q.split(/\s+/).filter(Boolean);
        items = items.filter((i) => {
          const t = normalize(`${i.title} ${i.info ?? ""}`);
          return words.some((w) => t.includes(w));
        });
      }
      return { ok: true, action: "searched" as const, items: items.slice(0, 30) };
    },
  });

  const plan_update = tool({
    description:
      "Atualiza um item do Planejamento (título, data, horário ou conclusão). Requer o id exato retornado por plan_search.",
    inputSchema: z.object({
      id: z.string().min(3).describe("Id no formato event:<uuid> ou item:<uuid>."),
      title: z.string().min(1).max(160).optional(),
      date: LocalDate.optional(),
      time: Time.optional(),
      done: z.boolean().optional(),
    }),
    execute: async (input) => {
      const { prefix, real } = splitId(input.id);
      if (prefix === "event") {
        const { data: before } = await supabase
          .from("day_events")
          .select("id, day_date, start_time, title, icon")
          .eq("id", real)
          .eq("user_id", userId)
          .maybeSingle();
        if (!before) return { ok: false, error: "Item não encontrado." };
        const patch: { title?: string; day_date?: string; start_time?: string } = {};
        if (input.title) patch.title = input.title.trim();
        if (input.date) patch.day_date = input.date;
        if (input.time) patch.start_time = input.time;
        const { data, error } = await supabase
          .from("day_events")
          .update(patch)
          .eq("id", real)
          .eq("user_id", userId)
          .select("id, day_date, start_time, title, icon")
          .maybeSingle();
        if (error) return { ok: false, error: error.message };
        return {
          ok: true,
          action: "updated" as const,
          items: data ? [toItem(data as Record<string, unknown>, "event")] : [],
          previous: [toItem(before as Record<string, unknown>, "event")],
        };
      }
      const { data: before } = await supabase
        .from("plan_items")
        .select("id, kind, title, info, due_date, due_time, done, icon")
        .eq("id", real)
        .eq("user_id", userId)
        .maybeSingle();
      if (!before) return { ok: false, error: "Item não encontrado." };
      const patch: { title?: string; due_date?: string; due_time?: string; done?: boolean } = {};
      if (input.title) patch.title = input.title.trim();
      if (input.date) patch.due_date = input.date;
      if (input.time) patch.due_time = input.time;
      if (input.done !== undefined) patch.done = input.done;
      const { data, error } = await supabase
        .from("plan_items")
        .update(patch)
        .eq("id", real)
        .eq("user_id", userId)
        .select("id, kind, title, info, due_date, due_time, done, icon")
        .maybeSingle();
      if (error) return { ok: false, error: error.message };
      return {
        ok: true,
        action: "updated" as const,
        items: data ? [toItem(data as Record<string, unknown>, "item")] : [],
        previous: [toItem(before as Record<string, unknown>, "item")],
      };
    },
  });

  const plan_delete = tool({
    description:
      "Exclui um item do Planejamento. Requer o id exato de plan_search. Nunca exclua se houver dúvida sobre qual item é.",
    inputSchema: z.object({ id: z.string().min(3) }),
    execute: async (input) => {
      const { prefix, real } = splitId(input.id);
      if (prefix === "event") {
        const { data: before } = await supabase
          .from("day_events")
          .select("id, day_date, start_time, title, icon")
          .eq("id", real)
          .eq("user_id", userId)
          .maybeSingle();
        if (!before) return { ok: false, error: "Item não encontrado." };
        const { error } = await supabase.from("day_events").delete().eq("id", real).eq("user_id", userId);
        if (error) return { ok: false, error: error.message };
        return {
          ok: true,
          action: "deleted" as const,
          items: [],
          previous: [toItem(before as Record<string, unknown>, "event")],
        };
      }
      const { data: before } = await supabase
        .from("plan_items")
        .select("id, kind, title, info, due_date, due_time, done, icon")
        .eq("id", real)
        .eq("user_id", userId)
        .maybeSingle();
      if (!before) return { ok: false, error: "Item não encontrado." };
      const { error } = await supabase.from("plan_items").delete().eq("id", real).eq("user_id", userId);
      if (error) return { ok: false, error: error.message };
      return {
        ok: true,
        action: "deleted" as const,
        items: [],
        previous: [toItem(before as Record<string, unknown>, "item")],
      };
    },
  });

  const plan_find_slot = tool({
    description:
      "Encontra horários livres na agenda do usuário em um intervalo de dias, considerando os compromissos já marcados. Use para pedidos como 'encontre um horário livre para estudar esta semana'.",
    inputSchema: z.object({
      from: LocalDate.describe("Primeiro dia do intervalo."),
      to: LocalDate.describe("Último dia do intervalo."),
      duration_minutes: z.number().int().min(15).max(480).default(60),
      earliest: Time.optional().describe("Hora mais cedo aceitável (padrão 08:00)."),
      latest: Time.optional().describe("Hora mais tarde para terminar (padrão 21:00)."),
    }),
    execute: async (input) => {
      const { data, error } = await supabase
        .from("day_events")
        .select("day_date, start_time, title")
        .eq("user_id", userId)
        .gte("day_date", input.from)
        .lte("day_date", input.to);
      if (error) return { ok: false, error: error.message };

      const dur = input.duration_minutes ?? 60;
      const dayStart = toMin(input.earliest ?? "08:00");
      const dayEnd = toMin(input.latest ?? "21:00");
      const nowMin = toMin(localTimeHm(tz));

      const byDay = new Map<string, number[]>();
      for (const e of data ?? []) {
        const t = String(e.start_time ?? "").slice(0, 5);
        if (!t) continue;
        const list = byDay.get(e.day_date) ?? [];
        list.push(toMin(t));
        byDay.set(e.day_date, list);
      }

      const slots: Array<{ date: string; time: string }> = [];
      for (let d = input.from; d <= input.to; d = addDays(d, 1)) {
        const busy = (byDay.get(d) ?? []).sort((a, b) => a - b);
        const min = d === today ? Math.max(dayStart, nowMin + 30) : dayStart;
        for (let start = Math.ceil(min / 30) * 30; start + dur <= dayEnd; start += 30) {
          const clash = busy.some((b) => start < b + 60 && b < start + dur);
          if (clash) continue;
          slots.push({ date: d, time: fromMin(start) });
          break;
        }
        if (slots.length >= 7) break;
      }
      return { ok: true, action: "searched" as const, slots };
    },
  });

  return { plan_create, plan_search, plan_update, plan_delete, plan_find_slot };
}
