/**
 * Classificação automática do formato de uma direção.
 *
 * - external : a execução depende do mundo real (ligar, enviar, caminhar) → só concluir.
 * - internal : a direção pede escrever/listar/refletir → responder dentro do iMAG.
 * - quick    : basta uma escolha, escala ou sim/não.
 *
 * Módulo puro (sem acesso a rede/DB) para poder rodar no cliente e no servidor.
 */

export type DirectionKind = "external" | "internal" | "quick" | "message";

export type QuickOption = { value: string; label: string };

export type DirectionField = {
  key: string;
  label: string;
  placeholder?: string;
  optional?: boolean;
  /** Campo numérico/valor — pode ser omitido pelo usuário. */
  sensitive?: boolean;
};

export type DirectionFormat = {
  kind: DirectionKind;
  /** Modelo de resposta interna. */
  template: "expenses" | "list" | "reflection" | "none";
  lifeArea: LifeArea;
  /** Título/descrição sobrescritos quando a direção pedia sair do app. */
  title?: string;
  description?: string;
  /** Grupos repetíveis (ex.: Gasto 1, Gasto 2). */
  group?: { label: string; min: number; fields: DirectionField[] };
  /** Campos simples. */
  fields?: DirectionField[];
  /** Rótulo do opt-out de dados sensíveis. */
  optOutLabel?: string;
  /** Opções de resposta rápida. */
  options?: QuickOption[];
  question?: string;
};

export type LifeArea =
  | "financas"
  | "saude"
  | "relacionamentos"
  | "trabalho"
  | "pessoal";

const AREA_HINTS: [LifeArea, RegExp][] = [
  [
    "financas",
    /\b(gast|financ|dinheiro|orçament|orcament|receita|fatura|d[ií]vida|custo|invest|pre[çc]o|caixa)/i,
  ],
  [
    "saude",
    /\b(sa[uú]de|sono|dormir|treino|exerc[ií]cio|caminhad|alimenta|[aá]gua|energia|m[eé]dic)/i,
  ],
  [
    "relacionamentos",
    /\b(fam[ií]lia|amigo|parceir|relacionament|filho|conversa com|c[oô]njuge|esposa|marido)/i,
  ],
  [
    "trabalho",
    /\b(cliente|paciente|equipe|venda|trabalho|neg[oó]cio|projeto|reuni[aã]o|proposta|agenda)/i,
  ],
];

const INTERNAL_VERBS =
  /\b(list[ae]r?|liste|anot[ae]r?|escrev[ae]r?|escreva|registr[ae]r?|reflit[ae]|reflet[ei]r|defin[ai]r?|defina|avali[ae]r?|descrev[ae]r?|descreva|mape[ai]r?|identifiqu[ae]|prioriz[ae]r?|planej[ae]r?|enumer[ae]r?|responda por escrito)\b/i;

const NOTES_APP =
  /\b(bloco de notas|aplicativo de notas|app de notas|caderno|papel|planilha|notas do celular)\b/i;

const QUICK_HINTS =
  /\b(sim ou n[aã]o|de 0 a 10|de 1 a 5|escolha (?:uma|entre)|decida entre|responda apenas)\b/i;

const EXTERNAL_VERBS =
  /\b(envi[ae]r?|lig[ue]r?|ligue|telefon|caminh|and[ae]r?|treinar|beber|marc[ae]r?|agend[ae]r?|visit[ae]r?|entreg[ae]r?|publiqu[ae]|poste|converse com|procure|compre|resolva)\b/i;

/** Direção que se resolve enviando uma mensagem (WhatsApp, DM, e-mail). */
const MESSAGE_HINTS =
  /\b((envi[ae]r?|envie|mand[ae]r?|mande|escrev[ae]r?|responda|retorne)\s+(uma\s+|um\s+)?(mensagem|msg|whats|whatsapp|dm|direct|e-?mail|[aá]udio)|mensagem (curta|r[aá]pida|para)|pelo whatsapp|via whatsapp|no whatsapp|por dm)\b/i;

export function detectLifeArea(text: string): LifeArea {
  for (const [area, re] of AREA_HINTS) if (re.test(text)) return area;
  return "pessoal";
}

/** Decide o formato de resposta de uma direção a partir do texto dela. */
export function classifyDirection(
  title: string | null | undefined,
  description?: string | null,
): DirectionFormat {
  const raw = `${title ?? ""} ${description ?? ""}`.trim();
  const lifeArea = detectLifeArea(raw);

  /* Direções de envio de mensagem: a MAG entrega o texto pronto para copiar. */
  if (MESSAGE_HINTS.test(raw)) {
    return { kind: "message", template: "none", lifeArea };
  }

  const isExpenses =
    lifeArea === "financas" && /\bgast/i.test(raw) && (INTERNAL_VERBS.test(raw) || NOTES_APP.test(raw));

  if (isExpenses) {
    return {
      kind: "internal",
      template: "expenses",
      lifeArea,
      title: "Liste os dois maiores gastos que você teve nos últimos 7 dias.",
      description:
        "Registre rapidamente os gastos que mais pesaram no seu orçamento. Você não precisa fazer uma análise agora. A MAG usará essas informações para entender melhor seu momento e personalizar as próximas direções.",
      group: {
        label: "Gasto",
        min: 2,
        fields: [
          { key: "label", label: "Com o que você gastou?", placeholder: "Ex.: mercado" },
          { key: "value", label: "Valor", placeholder: "Opcional", optional: true, sensitive: true },
        ],
      },
      optOutLabel: "Prefiro não informar valores",
    };
  }

  if (QUICK_HINTS.test(raw)) {
    return {
      kind: "quick",
      template: "none",
      lifeArea,
      question: "Qual é a sua resposta?",
      options: [
        { value: "sim", label: "Sim" },
        { value: "nao", label: "Não" },
        { value: "talvez", label: "Ainda não sei" },
      ],
    };
  }

  const wantsWriting = INTERNAL_VERBS.test(raw) || NOTES_APP.test(raw);
  if (wantsWriting) {
    const isList = /\b(list[ae]r?|liste|enumer|prioriz|tr[êe]s|dois|duas|cinco)\b/i.test(raw);
    if (isList) {
      return {
        kind: "internal",
        template: "list",
        lifeArea,
        group: {
          label: "Item",
          min: 2,
          fields: [{ key: "label", label: "Escreva aqui", placeholder: "Sua resposta" }],
        },
      };
    }
    return {
      kind: "internal",
      template: "reflection",
      lifeArea,
      fields: [
        {
          key: "text",
          label: "Sua resposta",
          placeholder: "Escreva o que vier — pode ser curto.",
        },
      ],
    };
  }

  if (EXTERNAL_VERBS.test(raw)) {
    return { kind: "external", template: "none", lifeArea };
  }

  return { kind: "external", template: "none", lifeArea };
}
