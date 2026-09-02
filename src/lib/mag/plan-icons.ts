/**
 * Classificação semântica dos itens de Planejamento.
 * Puro: recebe título + descrição, devolve a chave da categoria.
 * O mapeamento chave → componente de ícone vive na camada de UI.
 */

export const PLAN_ICON_KEYS = [
  "shopping",
  "pharmacy",
  "person",
  "meeting",
  "appointment",
  "work",
  "study",
  "gym",
  "food",
  "travel",
  "payment",
  "reminder",
  "task",
] as const;

export type PlanIconKey = (typeof PLAN_ICON_KEYS)[number];

export const PLAN_ICON_LABEL: Record<PlanIconKey, string> = {
  shopping: "Compras",
  pharmacy: "Farmácia",
  person: "Pessoa",
  meeting: "Reunião",
  appointment: "Consulta",
  work: "Trabalho",
  study: "Estudo",
  gym: "Academia",
  food: "Alimentação",
  travel: "Viagem",
  payment: "Pagamento",
  reminder: "Lembrete",
  task: "Tarefa",
};

export function isPlanIconKey(v: unknown): v is PlanIconKey {
  return typeof v === "string" && (PLAN_ICON_KEYS as readonly string[]).includes(v);
}

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Radicais (não palavras inteiras) para tolerar plural e pequenas variações:
 * "compra", "compras", "comprar" → "compr".
 */
const RULES: Array<{ key: PlanIconKey; any: string[] }> = [
  { key: "pharmacy", any: ["farmac", "remedi", "medicament", "medicin", "receita medic", "drogaria", "vacina", "comprimid", "capsul"] },
  { key: "appointment", any: ["consulta", "dentist", "medic", "exame", "terapia", "psicolog", "fisioter", "check up", "checkup"] },
  { key: "meeting", any: ["reuniao", "reunioes", "meeting", "call", "alinhament", "equipe", "time ", "apresentacao", "workshop", "mentoria em grupo"] },
  { key: "shopping", any: ["shopping", "compr", "mercado", "supermercad", "feira", "lista de compras", "loja", "pedido"] },
  { key: "payment", any: ["pagament", "pagar", "boleto", "fatura", "conta de", "cartao", "pix", "transferenc", "cobranc", "recebiment", "salario", "imposto"] },
  { key: "travel", any: ["viagem", "viajar", "voo", "aeroport", "passagem", "embarque", "hotel", "hospedag", "check in"] },
  { key: "gym", any: ["academia", "treino", "treinar", "musculac", "corrida", "correr", "pilates", "cross", "yoga", "caminhada", "exercic"] },
  { key: "food", any: ["almoc", "jantar", "cafe da manha", "lanche", "restaurant", "aliment", "dieta", "refeic", "cardapi", "cozinh"] },
  { key: "study", any: ["estud", "aula", "curso", "prova", "leitura", "ler ", "livro", "faculdade", "escola", "modulo", "certificac"] },
  { key: "work", any: ["trabalh", "reuniao de trabalho", "escritori", "projeto", "entrega do", "relatori", "proposta", "contrato", "expediente", "job", "freela"] },
  { key: "person", any: ["paciente", "cliente", "lead", "atendiment", "aluno", "seguidor", "contato com", "ligar para", "falar com", "visita de"] },
  { key: "reminder", any: ["lembre", "lembrar", "prazo", "vencimento", "deadline", "aviso", "renovac", "aniversari"] },
];

/** Devolve a categoria detectada; "task" quando nada é identificado. */
export function classifyPlanIcon(title: string, info?: string | null): PlanIconKey {
  const text = ` ${normalize(`${title ?? ""} ${info ?? ""}`)} `;
  if (!text.trim()) return "task";
  for (const rule of RULES) {
    if (rule.any.some((frag) => text.includes(frag))) return rule.key;
  }
  return "task";
}

/** Ícone efetivo: escolha manual do usuário tem prioridade sobre a automática. */
export function resolvePlanIcon(
  manual: string | null | undefined,
  title: string,
  info?: string | null,
): PlanIconKey {
  if (isPlanIconKey(manual)) return manual;
  return classifyPlanIcon(title, info);
}
