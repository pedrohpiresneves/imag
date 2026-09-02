export type MoneyKind = "income" | "expense";

export const INCOME_CATEGORIES = [
  { key: "salario", label: "Salário" },
  { key: "pacientes", label: "Pacientes" },
  { key: "vendas", label: "Vendas" },
  { key: "servicos", label: "Serviços" },
  { key: "pix", label: "PIX" },
  { key: "outros", label: "Outros" },
] as const;

export const EXPENSE_CATEGORIES = [
  { key: "alimentacao", label: "Alimentação" },
  { key: "transporte", label: "Transporte" },
  { key: "saude", label: "Saúde" },
  { key: "moradia", label: "Moradia" },
  { key: "contas", label: "Contas" },
  { key: "assinaturas", label: "Assinaturas" },
  { key: "compras", label: "Compras" },
  { key: "lazer", label: "Lazer" },
  { key: "educacao", label: "Educação" },
  { key: "outros", label: "Outros" },
] as const;

/** Categorias antigas mapeadas para as unificadas. */
const LEGACY: Record<string, string> = { ifood: "alimentacao", uber: "transporte" };

/** Normaliza chaves antigas (iFood, Uber) para as categorias atuais. */
export function normalizeCategory(kind: MoneyKind, key: string): string {
  if (kind !== "expense") return key;
  return LEGACY[key] ?? key;
}

export function categoriesFor(kind: MoneyKind) {
  return kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function categoryLabel(kind: MoneyKind, key: string): string {
  const found = categoriesFor(kind).find((c) => c.key === normalizeCategory(kind, key));
  return found?.label ?? "Outros";
}

/** Termos que indicam gasto com saúde — usados pela MAG e pelo registro manual. */
export const HEALTH_TERMS = [
  "plano de saude",
  "plano de saúde",
  "unimed",
  "hapvida",
  "amil",
  "bradesco saude",
  "sulamerica",
  "sulamérica",
  "farmacia",
  "farmácia",
  "drogaria",
  "droga raia",
  "drogasil",
  "pague menos",
  "remedio",
  "remédio",
  "medicamento",
  "consulta",
  "exame",
  "laboratorio",
  "laboratório",
  "dentista",
  "odonto",
  "terapia",
  "terapeuta",
  "psicolog",
  "psiquiatr",
  "fisioterapia",
  "tratamento",
  "hospital",
  "clinica",
  "clínica",
  "medico",
  "médico",
  "vacina",
];

/** Palavras-chave por categoria — o estabelecimento continua na descrição. */
const KEYWORDS: Array<[string, string[]]> = [
  [
    "alimentacao",
    ["ifood", "rappi", "delivery", "restaurante", "lanche", "lanchonete", "padaria", "pizzaria", "hamburg", "mercado", "supermercado", "feira", "almoco", "almoço", "jantar", "cafe", "café"],
  ],
  [
    "transporte",
    ["uber", "99", "taxi", "táxi", "indriver", "combustivel", "combustível", "gasolina", "etanol", "posto", "estacionamento", "onibus", "ônibus", "metro", "metrô", "passagem", "bilhete unico", "transporte"],
  ],
  ["saude", HEALTH_TERMS],
  ["moradia", ["aluguel", "condominio", "condomínio", "iptu", "reforma", "mobilia", "mobília", "faxina", "diarista"]],
  ["contas", ["energia", "luz", "agua", "água", "gas", "gás", "internet", "wifi", "telefone", "celular", "boleto", "fatura"]],
  ["assinaturas", ["netflix", "spotify", "prime", "disney", "hbo", "max", "youtube premium", "icloud", "assinatura"]],
  ["educacao", ["curso", "faculdade", "escola", "mensalidade escolar", "livro", "apostila", "aula", "mentoria", "workshop"]],
  ["lazer", ["cinema", "show", "bar", "viagem", "passeio", "festa", "jogo", "hotel", "airbnb"]],
];

/**
 * Classificação automática de saúde. Só reclassifica gastos marcados como
 * "outros" (ou sem categoria) — escolhas explícitas do usuário são respeitadas.
 */
export function autoCategory(
  kind: MoneyKind,
  category: string,
  description?: string | null,
): string {
  if (kind !== "expense") return category;
  const current = normalizeCategory("expense", category);
  if (current && current !== "outros") return current;
  const text = (description ?? "").toLowerCase();
  if (!text.trim()) return current || "outros";
  for (const [key, terms] of KEYWORDS) {
    if (terms.some((t) => text.includes(t))) return key;
  }
  return current || "outros";
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

/** Termos que costumam indicar despesa fixa mensal. */
export const FIXED_TERMS = [
  "plano de saude",
  "plano de saúde",
  "unimed",
  "hapvida",
  "amil",
  "aluguel",
  "condominio",
  "condomínio",
  "internet",
  "wifi",
  "energia",
  "luz",
  "agua",
  "água",
  "gas",
  "gás",
  "mensalidade",
  "escola",
  "faculdade",
  "academia",
  "assinatura",
  "netflix",
  "spotify",
  "seguro",
  "financiamento",
  "parcela",
  "telefone",
  "celular",
  "plano",
];

/** Sugestão (nunca ativação automática) de despesa fixa. */
export function looksFixed(category: string, description?: string | null): boolean {
  if (category === "assinaturas" || category === "contas") return true;
  const text = (description ?? "").toLowerCase();
  if (!text.trim()) return false;
  return FIXED_TERMS.some((t) => text.includes(t));
}

/** Termos que costumam indicar receita fixa mensal. */
export const FIXED_INCOME_TERMS = [
  "salario",
  "salário",
  "aposentadoria",
  "inss",
  "pensao",
  "pensão",
  "aluguel recebido",
  "aluguel do",
  "mensalidade",
  "contrato",
  "recorrente",
  "pagamento fixo",
  "pro labore",
  "pró-labore",
  "bolsa",
];

/**
 * Sugestão (nunca ativação automática) de receita fixa.
 * Recebimentos variáveis — pacientes, vendas avulsas, PIX solto — nunca sugerem.
 */
export function looksFixedIncome(category: string, description?: string | null): boolean {
  if (category === "pacientes" || category === "vendas") return false;
  if (category === "salario") return true;
  const text = (description ?? "").toLowerCase();
  if (!text.trim()) return false;
  return FIXED_INCOME_TERMS.some((t) => text.includes(t));
}

