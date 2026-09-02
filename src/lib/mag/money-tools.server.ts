/**
 * Ferramentas de "Meu dinheiro" para o chat da MAG.
 * A MAG interpreta frases como "recebi R$ 900 de uma paciente" ou
 * "gastei R$ 32 no Uber", confirma com o usuário e persiste no banco.
 */
import { tool } from "ai";
import { z } from "zod";
import { autoCategory } from "@/lib/money-categories";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

const INCOME = ["salario", "pacientes", "vendas", "servicos", "pix", "outros"] as const;
const EXPENSE = [
  "alimentacao",
  "transporte",
  "saude",
  "moradia",
  "contas",
  "assinaturas",
  "compras",
  "lazer",
  "educacao",
  "outros",
] as const;

function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function buildMoneyBlock(todayIso: string, focusText?: string | null): string {
  const focusLine = focusText?.trim()
    ? `\nFOCO DA SEMANA DECLARADO: "${focusText.trim()}". Se o foco tiver relação com dinheiro (economizar, faturar, poupar, dívidas), compare ativamente os lançamentos com essa meta usando money_summary antes de responder. Aponte o item exato e uma ação concreta ("3 gastos com Uber somando R$ 87 — quer um limite semanal pra transporte?"), nunca "você gastou muito". No fim da semana, conte a história do dinheiro em linguagem natural, ligando ao foco. Tom calmo, nunca culpa ou pressão.`
    : "";
  return focusLine + `\n\n─────────────────────────────\nMEU DINHEIRO\n─────────────────────────────\nO usuário tem o módulo "Meu dinheiro" (ícone de carteira na barra superior). Hoje é ${todayIso}.\nQuando ele disser algo como "recebi R$ 900 de uma paciente" ou "gastei 32 no Uber":\n1. Identifique tipo (recebimento/gasto), valor e categoria a partir da frase.\n2. Categorias de recebimento: salario, pacientes, vendas, servicos, pix, outros.\n   Categorias de gasto: alimentacao, transporte, saude, moradia, contas, assinaturas, compras, lazer, educacao, outros.\n   iFood, restaurantes, delivery, supermercado e lanches entram em alimentacao. Uber, 99, táxi, combustível, estacionamento e transporte público entram em transporte. Sempre guarde o nome do estabelecimento na descrição, ex.: categoria transporte, descrição "Uber — Casa/SES".\n   Classifique como saude tudo que envolver plano de saúde, Unimed e outros convênios, farmácia, medicamentos, consultas, exames, dentista, terapia e tratamentos.\n3. Pergunte SOMENTE o que faltar. Se tipo, valor e categoria estiverem claros, peça apenas uma confirmação curta ("Confirmo: gasto de R$ 32 em Uber, hoje?").\n4. Após o "sim", chame money_add e responda em UMA frase curta com o novo saldo.\n5. Despesa fixa (aluguel, plano de saúde, internet, mensalidade, assinatura) e receita fixa (salário, aposentadoria, aluguel recebido, mensalidade, contrato recorrente, pagamento fixo) podem ser sugeridas — mas SEMPRE peça confirmação antes de ativar ("Isso se repete todo mês? Em que dia?") e só então chame money_add com is_recurring e due_day. Nunca marque recebimentos variáveis (pacientes, vendas avulsas) como fixos.\n6. Use money_summary quando ele perguntar quanto recebeu/gastou. Nunca invente valores.\nSem planilha, sem gráfico, sem conselho de investimento.`;
}

export function createMoneyTools(client: Client, userId: string, todayIso: string) {
  const money_add = tool({
    description:
      "Registra um recebimento ou gasto no módulo Meu dinheiro. Chame apenas após o usuário confirmar tipo, valor e categoria.",
    inputSchema: z.object({
      kind: z.enum(["income", "expense"]).describe("income = recebeu, expense = gastou"),
      amount_brl: z.number().positive().describe("Valor em reais, ex.: 32.5"),
      category: z.string().describe("Chave da categoria, ex.: pacientes, transporte, alimentacao"),
      description: z.string().max(200).optional().describe("Descrição curta opcional"),
      entry_date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("Data do registro (YYYY-MM-DD). Padrão: hoje."),
      is_recurring: z
        .boolean()
        .optional()
        .describe("Só true depois de o usuário confirmar que se repete todo mês."),
      due_day: z
        .number()
        .int()
        .min(1)
        .max(31)
        .optional()
        .describe("Dia do vencimento (gasto) ou dia previsto para receber (recebimento)."),
    }),
    execute: async (input) => {
      const allowed: readonly string[] = input.kind === "income" ? INCOME : EXPENSE;
      const raw = allowed.includes(input.category) ? input.category : "outros";
      const category = autoCategory(input.kind, raw, input.description ?? null);
      const cents = Math.round(input.amount_brl * 100);
      if (cents <= 0) return { ok: false, error: "Valor inválido." };
      const entryDate = input.entry_date ?? todayIso;
      const { error } = await client.from("money_records").insert({
        user_id: userId,
        kind: input.kind,
        amount_cents: cents,
        category,
        description: input.description?.trim() || null,
        entry_date: entryDate,
        is_recurring: input.is_recurring === true,
        due_day: input.is_recurring
          ? (input.due_day ?? Number(entryDate.slice(8, 10)))
          : null,
      });
      if (error) return { ok: false, error: error.message };
      return {
        ok: true,
        saved: {
          kind: input.kind,
          amount: brl(cents),
          category,
          recurring: input.is_recurring === true,
        },
      };
    },
  });


  const money_summary = tool({
    description:
      "Consulta o resumo financeiro do usuário (recebido, gasto e saldo) num intervalo de datas.",
    inputSchema: z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
    execute: async (input) => {
      const { data, error } = await client
        .from("money_records")
        .select("kind, amount_cents, category")
        .eq("user_id", userId)
        .gte("entry_date", input.from)
        .lte("entry_date", input.to);
      if (error) return { ok: false, error: error.message };
      const rows = (data ?? []) as Array<{ kind: string; amount_cents: number; category: string }>;
      const income = rows.filter((r) => r.kind === "income").reduce((a, r) => a + r.amount_cents, 0);
      const expense = rows
        .filter((r) => r.kind === "expense")
        .reduce((a, r) => a + r.amount_cents, 0);
      const byCat = new Map<string, number>();
      for (const r of rows.filter((x) => x.kind === "expense"))
        byCat.set(r.category, (byCat.get(r.category) ?? 0) + r.amount_cents);
      const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
      return {
        ok: true,
        income: brl(income),
        expense: brl(expense),
        balance: brl(income - expense),
        top_expense_category: top ? { category: top[0], total: brl(top[1]) } : null,
      };
    },
  });

  return { money_add, money_summary };
}
