import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";
import { autoCategory } from "@/lib/money-categories";
import {
  buildMoneyGuidance,
  type MoneyGuidance,
  type MoneyGuidanceRecord,
} from "@/lib/mag/money-guidance";

export type MoneyRecord = {
  id: string;
  kind: "income" | "expense";
  amount_cents: number;
  category: string;
  description: string | null;
  entry_date: string;
  is_recurring: boolean;
  due_day: number | null;
  recurrence_status: "active" | "paused" | "cancelled";
  recurrence_parent: string | null;
  /** Recebimento fixo ainda não confirmado: mostra como "Previsto" e não soma ao saldo. */
  is_pending: boolean;
};

export type MoneyOverview = {
  from: string;
  to: string;
  income_cents: number;
  expense_cents: number;
  balance_cents: number;
  records: MoneyRecord[];
  insights: string[];
  /** Total mensal previsto de despesas fixas ativas, em centavos. */
  recurring_monthly_cents: number;
  /** Total mensal previsto de receitas fixas ativas, em centavos. */
  recurring_income_monthly_cents: number;
  /** Recebimentos previstos (não confirmados) no período, em centavos. */
  pending_income_cents: number;
};

const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Range = z.object({ from: LocalDate, to: LocalDate });

const RecordInput = z.object({
  kind: z.enum(["income", "expense"]),
  amount_cents: z.number().int().positive().max(100_000_000),
  category: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200).nullable().optional(),
  entry_date: LocalDate,
  is_recurring: z.boolean().optional(),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
});

const SELECT =
  "id, kind, amount_cents, category, description, entry_date, is_recurring, due_day, recurrence_status, recurrence_parent, is_pending";


function labelOf(kind: string, key: string): string {
  const map: Record<string, string> = {
    salario: "Salário",
    pacientes: "Pacientes",
    vendas: "Vendas",
    servicos: "Serviços",
    pix: "PIX",
    alimentacao: "Alimentação",
    transporte: "Transporte",
    moradia: "Moradia",
    lazer: "Lazer",
    educacao: "Educação",
    assinaturas: "Assinaturas",
    compras: "Compras",
    contas: "Contas",
    saude: "Saúde",
    outros: "Outros",
  };
  return map[key] ?? key;
}

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export function buildInsights(records: MoneyRecord[], periodLabel: string): string[] {
  if (records.length === 0) return [];
  const out: string[] = [];
  const income = records.filter((r) => r.kind === "income");
  const expense = records.filter((r) => r.kind === "expense");
  const sum = (rs: MoneyRecord[]) => rs.reduce((a, r) => a + r.amount_cents, 0);

  if (income.length > 0) out.push(`Você recebeu ${brl(sum(income))} ${periodLabel}.`);

  if (expense.length > 0) {
    const byCat = new Map<string, number>();
    for (const r of expense) byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amount_cents);
    const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0]!;
    out.push(`Seu maior gasto foi com ${labelOf("expense", top[0])} (${brl(top[1])}).`);
  }

  const balance = sum(income) - sum(expense);
  if (income.length > 0 && expense.length > 0) {
    out.push(
      balance >= 0
        ? `Saldo positivo de ${brl(balance)} ${periodLabel}.`
        : `Você gastou ${brl(-balance)} a mais do que recebeu ${periodLabel}.`,
    );
  }
  return out.slice(0, 3);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Meses (YYYY-MM) cobertos por um intervalo. */
function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = [Number(from.slice(0, 4)), Number(from.slice(5, 7))];
  const endY = Number(to.slice(0, 4));
  const endM = Number(to.slice(5, 7));
  while (y < endY || (y === endY && m <= endM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
    if (out.length > 24) break;
  }
  return out;
}

/**
 * Materializa as despesas e receitas fixas ativas nos meses do intervalo.
 * O índice único (recorrência + mês) garante que nunca haja duplicidade.
 * Receitas geradas nascem como "previstas" (is_pending) e só entram no
 * saldo real depois que o usuário confirmar o recebimento.
 */
async function materializeRecurring(
  supabase: { from: (t: "money_records") => any },
  userId: string,
  from: string,
  to: string,
) {
  const { data: templates } = await supabase
    .from("money_records")
    .select("id, kind, amount_cents, category, description, due_day, entry_date")
    .eq("user_id", userId)
    .eq("is_recurring", true)
    .eq("recurrence_status", "active")
    .is("recurrence_parent", null);

  const list = (templates ?? []) as Array<{
    id: string;
    kind: "income" | "expense";
    amount_cents: number;
    category: string;
    description: string | null;
    due_day: number | null;
    entry_date: string;
  }>;
  if (list.length === 0) return;

  const rows: Array<Record<string, unknown>> = [];
  for (const t of list) {
    for (const ym of monthsBetween(from, to)) {
      if (ym <= t.entry_date.slice(0, 7)) continue;
      const [y, m] = [Number(ym.slice(0, 4)), Number(ym.slice(5, 7))];
      const day = Math.min(t.due_day ?? Number(t.entry_date.slice(8, 10)), daysInMonth(y, m));
      rows.push({
        user_id: userId,
        kind: t.kind,
        amount_cents: t.amount_cents,
        category: t.category,
        description: t.description,
        entry_date: `${ym}-${String(day).padStart(2, "0")}`,
        is_recurring: true,
        due_day: t.due_day,
        recurrence_status: "active",
        recurrence_parent: t.id,
        is_pending: t.kind === "income",
      });
    }
  }
  if (rows.length === 0) return;


  const { data: existing } = await supabase
    .from("money_records")
    .select("recurrence_parent, entry_date")
    .eq("user_id", userId)
    .not("recurrence_parent", "is", null)
    .gte("entry_date", `${from.slice(0, 7)}-01`)
    .lte("entry_date", to);
  const seen = new Set(
    ((existing ?? []) as Array<{ recurrence_parent: string; entry_date: string }>).map(
      (e) => `${e.recurrence_parent}:${e.entry_date.slice(0, 7)}`,
    ),
  );
  const missing = rows.filter(
    (r) => !seen.has(`${r["recurrence_parent"] as string}:${(r["entry_date"] as string).slice(0, 7)}`),
  );
  if (missing.length === 0) return;
  // Índice único garante que corridas paralelas não dupliquem o mesmo mês.
  await supabase.from("money_records").insert(missing);
}

export const getMoneyOverview = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    Range.extend({ period: z.enum(["week", "month"]).default("week") }).parse(raw),
  )
  .handler(async ({ context, data }): Promise<MoneyOverview> => {
    try {
      await materializeRecurring(context.supabase as never, context.userId, data.from, data.to);
    } catch {
      /* recorrência nunca pode impedir a leitura do período */
    }
    const { data: rows, error } = await context.supabase
      .from("money_records")
      .select(SELECT)
      .eq("user_id", context.userId)
      .gte("entry_date", data.from)
      .lte("entry_date", data.to)
      .order("entry_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const records = (rows ?? []) as MoneyRecord[];
    // Recebimentos previstos (fixos ainda não confirmados) ficam fora do saldo real.
    const income_cents = records
      .filter((r) => r.kind === "income" && !r.is_pending)
      .reduce((a, r) => a + r.amount_cents, 0);
    const pending_income_cents = records
      .filter((r) => r.kind === "income" && r.is_pending)
      .reduce((a, r) => a + r.amount_cents, 0);
    const expense_cents = records
      .filter((r) => r.kind === "expense")
      .reduce((a, r) => a + r.amount_cents, 0);

    const { data: fixedRows } = await context.supabase
      .from("money_records")
      .select("kind, amount_cents")
      .eq("user_id", context.userId)
      .eq("is_recurring", true)
      .eq("recurrence_status", "active")
      .is("recurrence_parent", null);
    const fixed = (fixedRows ?? []) as Array<{ kind: string; amount_cents: number }>;
    const recurringMonthly = fixed
      .filter((r) => r.kind === "expense")
      .reduce((a, r) => a + r.amount_cents, 0);
    const recurringIncomeMonthly = fixed
      .filter((r) => r.kind === "income")
      .reduce((a, r) => a + r.amount_cents, 0);

    return {
      from: data.from,
      to: data.to,
      income_cents,
      expense_cents,
      balance_cents: income_cents - expense_cents,
      records,
      insights: buildInsights(
        records.filter((r) => !r.is_pending),
        data.period === "week" ? "esta semana" : "este mês",
      ),
      recurring_monthly_cents: recurringMonthly,
      recurring_income_monthly_cents: recurringIncomeMonthly,
      pending_income_cents,
    };
  });


export const createMoneyRecord = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => RecordInput.parse(raw))
  .handler(async ({ context, data }): Promise<MoneyRecord> => {
    const { data: row, error } = await context.supabase
      .from("money_records")
      .insert({
        user_id: context.userId,
        kind: data.kind,
        amount_cents: data.amount_cents,
        category: autoCategory(data.kind, data.category, data.description ?? null),
        description: data.description?.trim() || null,
        entry_date: data.entry_date,
        is_recurring: data.is_recurring === true,
        due_day: data.is_recurring
          ? (data.due_day ?? Number(data.entry_date.slice(8, 10)))
          : null,

      })
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    return row as MoneyRecord;
  });

export const updateMoneyRecord = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => RecordInput.extend({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }): Promise<MoneyRecord> => {
    const { data: row, error } = await context.supabase
      .from("money_records")
      .update({
        kind: data.kind,
        amount_cents: data.amount_cents,
        category: data.category,
        description: data.description?.trim() || null,
        entry_date: data.entry_date,
        is_recurring: data.is_recurring === true,
        due_day: data.is_recurring
          ? (data.due_day ?? Number(data.entry_date.slice(8, 10)))
          : null,

      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select(SELECT)
      .single();
    if (error) throw new Error(error.message);
    return row as MoneyRecord;
  });

/**
 * Confirma (ou volta a marcar como previsto) um recebimento fixo.
 * Só depois da confirmação o valor entra no saldo real.
 */
export const setIncomePending = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), pending: z.boolean() }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("money_records")
      .update({ is_pending: data.pending })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .eq("kind", "income");
    if (error) throw new Error(error.message);
    return { ok: true, pending: data.pending };
  });


export const deleteMoneyRecord = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("money_records")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * Leitura da MAG sobre o dinheiro da semana, cruzada com o Foco da Semana.
 * Determinística e barata: sem chamada de IA, sem gráfico, sem planilha.
 */
export const getMoneyGuidance = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z.object({ local_date: LocalDate, from: LocalDate, to: LocalDate }).parse(raw),
  )
  .handler(async ({ context, data }): Promise<MoneyGuidance | null> => {
    const [{ data: rows }, { data: focusRows }] = await Promise.all([
      context.supabase
        .from("money_records")
        .select("kind, amount_cents, category, entry_date")
        .eq("user_id", context.userId)
        .gte("entry_date", data.from)
        .lte("entry_date", data.to),
      context.supabase
        .from("weekly_focus")
        .select("interpreted, raw_text, focus_kind, metric_label, metric_target, status")
        .eq("user_id", context.userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const focus = ((focusRows ?? []) as Array<{
      interpreted: string | null;
      raw_text: string | null;
      focus_kind: string | null;
      metric_label: string | null;
      metric_target: number | null;
    }>)[0];

    const focusText = focus?.interpreted?.trim() || focus?.raw_text?.trim() || null;
    const target =
      focus?.metric_target && focus.metric_target > 0 ? Math.round(focus.metric_target * 100) : null;

    return buildMoneyGuidance({
      localDate: data.local_date,
      records: (rows ?? []) as MoneyGuidanceRecord[],
      focusText,
      focusKind: focus?.focus_kind ?? null,
      targetCents: target,
    });
  });

/**
 * Pausa, retoma ou cancela uma despesa fixa. Nunca apaga lançamentos
 * anteriores: só interrompe a geração dos próximos meses.
 */
export const setRecurrenceStatus = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["active", "paused", "cancelled"]),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("money_records")
      .select("id, recurrence_parent")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .single();
    if (error) throw new Error(error.message);
    const targetId = (row as { id: string; recurrence_parent: string | null }).recurrence_parent ?? data.id;
    const { error: upErr } = await context.supabase
      .from("money_records")
      .update({ recurrence_status: data.status })
      .eq("id", targetId)
      .eq("user_id", context.userId);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, status: data.status };
  });
