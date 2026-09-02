/**
 * Leitura da MAG sobre o dinheiro — interpretação, não planilha.
 * Regras determinísticas: comparam os lançamentos da semana com o
 * Foco da Semana declarado e devolvem no máximo uma sugestão por vez,
 * sempre em tom calmo e não punitivo.
 */

export type MoneyGuidanceRecord = {
  kind: "income" | "expense";
  amount_cents: number;
  category: string;
  entry_date: string;
};

export type MoneyGuidanceAction = "adjust_goal" | "ignore" | "details";

export type MoneyGuidance = {
  /** Chave estável para o usuário poder dispensar a sugestão da semana. */
  key: string;
  kind: "alert" | "recap";
  /** Texto principal, no estilo do card do "Hoje". */
  message: string;
  /** Explicação do raciocínio ("Por que a MAG sugeriu isso?"). */
  reason: string;
  focus_text: string | null;
  actions: MoneyGuidanceAction[];
  /** Categoria envolvida, quando a sugestão for específica. */
  category: string | null;
  /** Quantidade de lançamentos da categoria no período. */
  category_count: number;
  /** Total gasto na categoria no período, em centavos. */
  category_cents: number;
};

const LABELS: Record<string, string> = {
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

/** Sugestão de limite por categoria — linguagem do usuário, não contábil. */
const LIMIT_HINT: Record<string, string> = {
  transporte: "transporte",
  alimentacao: "alimentação",
  moradia: "moradia",
  lazer: "lazer",
  educacao: "educação",
  compras: "compras",
  assinaturas: "assinaturas",
  contas: "contas",
  saude: "saúde",
  outros: "gastos avulsos",
};

const FOCUS_MONEY_WORDS = [
  "econom",
  "poupar",
  "guardar dinheiro",
  "dinheiro",
  "gasto",
  "gastar",
  "financ",
  "renda",
  "faturar",
  "faturamento",
  "receita",
  "vender",
  "vendas",
  "dívida",
  "divida",
  "orçamento",
  "orcamento",
  "caixa",
];

export function label(category: string): string {
  return LABELS[category] ?? category;
}

export function brl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function isMoneyFocus(text: string | null | undefined, kind?: string | null): boolean {
  const t = `${text ?? ""} ${kind ?? ""}`.toLowerCase();
  if (!t.trim()) return false;
  return FOCUS_MONEY_WORDS.some((w) => t.includes(w));
}

/** É fim de semana (sábado ou domingo) na data local informada? */
export function isWeekEnd(localDate: string): boolean {
  const day = new Date(`${localDate}T12:00:00`).getDay();
  return day === 0 || day === 6;
}

type BuildInput = {
  localDate: string;
  records: MoneyGuidanceRecord[];
  focusText: string | null;
  focusKind: string | null;
  /** Meta numérica em centavos, quando o foco tiver valor declarado. */
  targetCents: number | null;
};

function totals(records: MoneyGuidanceRecord[]) {
  const income = records
    .filter((r) => r.kind === "income")
    .reduce((a, r) => a + r.amount_cents, 0);
  const expense = records
    .filter((r) => r.kind === "expense")
    .reduce((a, r) => a + r.amount_cents, 0);
  return { income, expense, balance: income - expense };
}

function topCategory(records: MoneyGuidanceRecord[]) {
  const by = new Map<string, { total: number; count: number }>();
  for (const r of records.filter((x) => x.kind === "expense")) {
    const cur = by.get(r.category) ?? { total: 0, count: 0 };
    by.set(r.category, { total: cur.total + r.amount_cents, count: cur.count + 1 });
  }
  const sorted = [...by.entries()].sort((a, b) => b[1].total - a[1].total);
  const first = sorted[0];
  return first ? { category: first[0], ...first[1] } : null;
}

/**
 * Monta a leitura da semana. Devolve `null` quando não há nada relevante
 * a dizer — silêncio é preferível a ruído.
 */
export function buildMoneyGuidance(input: BuildInput): MoneyGuidance | null {
  const { records, localDate } = input;
  const money = isMoneyFocus(input.focusText, input.focusKind);
  const { income, expense, balance } = totals(records);
  const top = topCategory(records);
  const weekKey = localDate.slice(0, 10);

  /* ── Resumo narrado no fim da semana ── */
  if (isWeekEnd(localDate) && records.length >= 2) {
    const parts: string[] = [];
    if (income > 0) parts.push(`entraram ${brl(income)}`);
    if (expense > 0) parts.push(`saíram ${brl(expense)}`);
    const head = parts.length > 0 ? `Nesta semana ${parts.join(" e ")}.` : "";
    const middle =
      top && expense > 0
        ? ` O que mais pesou foi ${label(top.category)} (${brl(top.total)}${top.count > 1 ? `, em ${top.count} lançamentos` : ""}).`
        : "";
    const tail = money
      ? balance >= 0
        ? ` Isso caminha com o seu foco de ${input.focusText}: você fechou com ${brl(balance)} de sobra.`
        : ` Seu foco é ${input.focusText}, e a semana fechou ${brl(-balance)} abaixo. Sem drama: dá pra ajustar uma categoria só na próxima.`
      : balance >= 0
        ? ` Você fechou com ${brl(balance)} de sobra.`
        : ` A semana fechou ${brl(-balance)} abaixo do que entrou.`;
    return {
      key: `recap:${weekKey}`,
      kind: "recap",
      message: `${head}${middle}${tail}`.trim(),
      reason:
        "Fechei a semana lendo os seus lançamentos e comparei com o que você declarou como foco. Prefiro te entregar a história do dinheiro em vez de te deixar interpretando números sozinha.",
      focus_text: input.focusText,
      actions: money ? ["adjust_goal", "details", "ignore"] : ["details", "ignore"],
      category: top?.category ?? null,
      category_count: top?.count ?? 0,
      category_cents: top?.total ?? 0,
    };
  }

  if (records.length === 0) return null;

  /* ── Meta numérica declarada e já ultrapassada ── */
  if (money && input.targetCents && input.targetCents > 0 && expense > input.targetCents) {
    return {
      key: `target:${weekKey}`,
      kind: "alert",
      message: `Sua meta da semana é ${input.focusText}, com ${brl(input.targetCents)} de referência — os gastos já somam ${brl(expense)}. Quer revisar a meta ou segurar uma categoria até domingo?`,
      reason: `Comparei o total gasto (${brl(expense)}) com o valor declarado no seu Foco da Semana (${brl(input.targetCents)}). Não é cobrança: é só pra você decidir com informação.`,
      focus_text: input.focusText,
      actions: ["adjust_goal", "details", "ignore"],
      category: top?.category ?? null,
      category_count: top?.count ?? 0,
      category_cents: top?.total ?? 0,
    };
  }

  /* ── Padrão específico numa categoria durante foco financeiro ── */
  if (money && top && top.count >= 3) {
    const hint = LIMIT_HINT[top.category] ?? label(top.category).toLowerCase();
    return {
      key: `pattern:${top.category}:${weekKey}:${top.count}`,
      kind: "alert",
      message: `Identifiquei ${top.count} gastos com ${label(top.category)} essa semana somando ${brl(top.total)} — quer que eu sugira um limite semanal pra ${hint}?`,
      reason: `Seu foco é ${input.focusText}. Somei os lançamentos por categoria e ${label(top.category)} apareceu ${top.count} vezes, sendo o maior peso da semana. Apontar o item exato ajuda mais que falar em "gastar menos".`,
      focus_text: input.focusText,
      actions: ["adjust_goal", "details", "ignore"],
      category: top.category,
      category_count: top.count,
      category_cents: top.total,
    };
  }

  /* ── Saldo negativo durante foco financeiro ── */
  if (money && balance < 0) {
    return {
      key: `negative:${weekKey}`,
      kind: "alert",
      message: `Você está ${brl(-balance)} abaixo nesta semana${top ? `, e ${label(top.category)} responde por ${brl(top.total)}` : ""}. Dá pra segurar essa categoria até domingo e proteger o seu foco de ${input.focusText}.`,
      reason:
        "Comparei o que entrou com o que saiu no período e cruzei com o seu Foco da Semana. Trago isso agora porque ainda dá tempo de ajustar uma coisa só.",
      focus_text: input.focusText,
      actions: ["adjust_goal", "details", "ignore"],
      category: top?.category ?? null,
      category_count: top?.count ?? 0,
      category_cents: top?.total ?? 0,
    };
  }

  /* ── Padrão forte mesmo sem foco financeiro ── */
  if (!money && top && top.count >= 4) {
    const hint = LIMIT_HINT[top.category] ?? label(top.category).toLowerCase();
    return {
      key: `pattern-nofocus:${top.category}:${weekKey}:${top.count}`,
      kind: "alert",
      message: `${top.count} lançamentos de ${label(top.category)} nesta semana, somando ${brl(top.total)}. Quer transformar isso num limite semanal pra ${hint}?`,
      reason:
        "Notei repetição na mesma categoria. Só te mostro o padrão — a decisão continua sendo sua.",
      focus_text: input.focusText,
      actions: ["details", "ignore"],
      category: top.category,
      category_count: top.count,
      category_cents: top.total,
    };
  }

  return null;
}
