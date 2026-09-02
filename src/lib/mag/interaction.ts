/**
 * Lógica adaptativa GLOBAL das direções da MAG.
 *
 * Toda direção é classificada em um `interaction_type` e ganha um
 * `interaction_config` — a interface é renderizada a partir desses dados,
 * nunca por verificações frágeis de palavras no momento do render.
 *
 * Módulo puro (sem rede/DB): roda no servidor (na geração) e no cliente
 * (compatibilidade com direções antigas, ainda sem config salvo).
 */

export type InteractionType =
  | "text_response"
  | "fixed_list"
  | "flexible_list"
  | "priority_selection"
  | "checklist"
  | "single_choice"
  | "multiple_choice"
  | "numeric_input"
  | "date_time"
  | "message_to_send"
  | "external_action"
  | "conversation"
  | "information_review"
  | "hybrid";

export type InteractionField = {
  key: string;
  /** text | number | currency | duration | date | time | checkbox */
  type: "text" | "number" | "currency" | "duration" | "date" | "time" | "checkbox";
  label: string;
  placeholder?: string;
  required: boolean;
};

export type InteractionOption = { value: string; label: string };

export type InteractionSelection = {
  type: "single" | "multiple";
  label: string;
  required: boolean;
  /** Quando vazio, a seleção acontece sobre os próprios campos preenchidos. */
  options?: InteractionOption[];
};

export type InteractionConfig = {
  type: InteractionType;
  fields: InteractionField[];
  /** Permite adicionar/remover campos (listas flexíveis). */
  allow_add: boolean;
  min_fields: number;
  max_fields: number;
  selection?: InteractionSelection;
  helper?: string;
  completion_label: string;
  /** Critério de conclusão legível (auditoria/validação). */
  completion_rule: string;
  reward_magnetos: number;
};

export type ResolvedInteraction = {
  type: InteractionType;
  config: InteractionConfig;
  /** Texto já limpo de ferramentas externas desnecessárias. */
  title: string;
  description: string | null;
  lifeArea: LifeArea;
};

export type LifeArea = "financas" | "saude" | "relacionamentos" | "trabalho" | "pessoal";

const AREA_HINTS: [LifeArea, RegExp][] = [
  ["financas", /\b(gast|financ|dinheiro|or[çc]ament|receita|fatura|d[ií]vida|custo|invest|pre[çc]o|caixa)/i],
  ["saude", /\b(sa[uú]de|sono|dormir|treino|exerc[ií]cio|caminhad|alimenta|[aá]gua|m[eé]dic)/i],
  ["relacionamentos", /\b(fam[ií]lia|amigo|parceir|relacionament|filho|c[oô]njuge|esposa|marido)/i],
  ["trabalho", /\b(cliente|paciente|equipe|venda|trabalho|neg[oó]cio|projeto|reuni[aã]o|proposta|lead)/i],
];

export function detectLifeArea(text: string): LifeArea {
  for (const [area, re] of AREA_HINTS) if (re.test(text)) return area;
  return "pessoal";
}

/* ------------------------------------------------------------------ */
/* Ferramentas externas desnecessárias                                 */
/* ------------------------------------------------------------------ */

const EXTERNAL_TOOL_PATTERNS: RegExp[] = [
  /,?\s*(usando|com|em|no|na|use|use|pegue|utilizando|utilize|abra|anote em)\s+(um|uma|o|a|seu|sua)?\s*(papel e caneta|papel|caneta|bloco de notas|bloco|caderno|planilha|excel|agenda do celular|agenda|calculadora|app de notas|aplicativo de notas|notas do celular|outro aplicativo|outro app)\b[^.;]*/gi,
  /\b(pegue|pegar|separe)\s+(um\s+)?(papel|caderno|bloco)[^.;]*/gi,
  /\banote\s+(em|no|numa|em uma)\s+[^.;]*/gi,
];

/** Remove orientações do tipo "pegue papel e caneta", "anote no bloco de notas". */
export function stripExternalTools(text: string | null | undefined): string {
  if (!text) return "";
  let out = text;
  for (const re of EXTERNAL_TOOL_PATTERNS) out = out.replace(re, "");
  return out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([.,;!?])/g, "$1")
    .replace(/[,;]\s*\./g, ".")
    .replace(/\.\s*\./g, ".")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Detecção de quantidade                                              */
/* ------------------------------------------------------------------ */

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tr: 3, "três": 3, tres: 3, quatro: 4,
  cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
};

/** Quantidade exata pedida no texto ("liste 3 tarefas", "dois gastos"). */
export function detectCount(text: string): number | null {
  const digit = text.match(/\b(\d{1,2})\s+(?![minutos|minuto|min|horas|hora|dias|dia|%]\b)[a-zçãáéíóúâêô]{3,}/i);
  if (digit) {
    const n = Number(digit[1]);
    if (n >= 1 && n <= 10) return n;
  }
  const word = text
    .toLowerCase()
    .match(/\b(um|uma|dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez)\b\s+[a-zçãáéíóúâêô]{3,}/i);
  if (word?.[1]) {
    const n = NUMBER_WORDS[word[1].replace("ê", "ê")] ?? NUMBER_WORDS[word[1]];
    if (n) return n;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Regras de classificação                                             */
/* ------------------------------------------------------------------ */

const RE = {
  message:
    /\b((envi[ae]r?|envie|mand[ae]r?|mande|escrev[ae]r?|responda|retorne)\s+(uma\s+|um\s+)?(mensagem|msg|whats|whatsapp|dm|direct|e-?mail|[aá]udio)|mensagem (curta|r[aá]pida|para|pronta)|pelo whatsapp|via whatsapp|no whatsapp|por dm)\b/i,
  money: /\b(gast|valor|quanto (custa|gastou|entrou|saiu)|receita|fatura|or[çc]amento|reais|r\$|d[ií]vida|pre[çc]o)\b/i,
  duration: /\b(quantos minutos|quanto tempo|dura[çc][aã]o|horas de sono|minutos de)\b/i,
  quantity: /\b(quantas|quantos|registre o n[uú]mero|anote o total|quantidade)\b/i,
  date: /\b(defina (uma|a) data|escolha (uma|a) data|marque (no|na) (agenda|calend[aá]rio)|agende (para|um hor[aá]rio)|prazo|hor[aá]rio para|data limite)\b/i,
  priority: /\b(prioridade|priorize|qual delas|escolha (a|uma) (mais|principal)|merece sua aten[çc][aã]o|ordem de import[aâ]ncia)\b/i,
  list: /\b(list[ae]r?|liste|enumer|relacione|escreva\s+\d|anote\s+\d|registre\s+\d)\b/i,
  checklist: /\b(checklist|passo a passo|etapas|marque cada|conclua os itens|siga os passos)\b/i,
  choose: /\b(escolha (uma|entre)|decida entre|opte por|selecione (uma|a) op[çc][aã]o|sim ou n[aã]o)\b/i,
  chooseMany: /\b(selecione (as|todas|quantas)|escolha (as|todos os|quantos)|marque (as|os) que)\b/i,
  reflection:
    /\b(reflit[ae]|reflet[ei]r|escrev[ae]r?|escreva|descrev[ae]r?|descreva|responda|registre como|anote como|avalie|pense sobre)\b/i,
  conversation: /\b(converse com a mag|fale com a mag|discuta|aprofunde|pe[çc]a ajuda [àa] mag)\b/i,
  review: /\b(revis[ae]r?|leia|releia|entenda|compreenda|observe|analise sem)\b/i,
  external:
    /\b(lig[ue]r?|ligue|telefon|caminh|and[ae]r?|treinar|beber|visit[ae]r?|entreg[ae]r?|publiqu[ae]|poste|grave|compre|durma|almo[çc]e|saia)\b/i,
};

function field(
  key: string,
  label: string,
  type: InteractionField["type"] = "text",
  placeholder?: string,
  required = true,
): InteractionField {
  return { key, type, label, required, ...(placeholder ? { placeholder } : {}) };
}

function baseConfig(type: InteractionType, partial: Partial<InteractionConfig>): InteractionConfig {
  return {
    type,
    fields: [],
    allow_add: false,
    min_fields: 0,
    max_fields: 0,
    completion_label: "Salvar e concluir",
    completion_rule: "Preencher os campos obrigatórios",
    reward_magnetos: 10,
    ...partial,
  };
}

function listFields(count: number, label: string, placeholder?: string): InteractionField[] {
  return Array.from({ length: count }, (_, i) =>
    field(`item_${i + 1}`, `${label} ${i + 1}`, "text", placeholder),
  );
}

/** Escolhe o tipo de interação e monta a interface correspondente. */
export function resolveInteraction(
  rawTitle: string | null | undefined,
  rawDescription?: string | null,
): ResolvedInteraction {
  const title = stripExternalTools(rawTitle) || (rawTitle ?? "").trim();
  const description = stripExternalTools(rawDescription) || null;
  const text = `${title} ${description ?? ""}`.trim();
  const lifeArea = detectLifeArea(text);
  const count = detectCount(text);

  const make = (config: InteractionConfig): ResolvedInteraction => ({
    type: config.type,
    config,
    title,
    description,
    lifeArea,
  });

  /* 1. Mensagem pronta */
  if (RE.message.test(text)) {
    return make(
      baseConfig("message_to_send", {
        completion_label: "Já enviei",
        completion_rule: "Confirmar o envio da mensagem",
        helper: "A MAG escreve a mensagem. Você só revisa, copia e envia.",
      }),
    );
  }

  /* 2. Valores / números */
  if (RE.money.test(text) || RE.duration.test(text) || RE.quantity.test(text)) {
    const n = count ?? 2;
    const money = RE.money.test(text);
    const kind: InteractionField["type"] = money ? "currency" : RE.duration.test(text) ? "duration" : "number";
    const label = money ? "Gasto" : RE.duration.test(text) ? "Registro" : "Item";
    const fields: InteractionField[] = [];
    for (let i = 0; i < n; i += 1) {
      fields.push(field(`label_${i + 1}`, `${label} ${i + 1}`, "text", "Com o que foi?"));
      fields.push(
        field(
          `value_${i + 1}`,
          money ? "Valor (R$)" : kind === "duration" ? "Tempo (min)" : "Quantidade",
          kind,
          "Opcional",
          false,
        ),
      );
    }
    return make(
      baseConfig("numeric_input", {
        fields,
        min_fields: n,
        max_fields: n * 2,
        allow_add: count === null,
        helper: money ? "Os valores são opcionais — o importante é registrar." : undefined,
        completion_rule: `Descrever ${n} ${label.toLowerCase()}(s)`,
      }),
    );
  }

  /* 3. Data / horário */
  if (RE.date.test(text)) {
    return make(
      baseConfig("date_time", {
        fields: [
          field("date", "Data", "date"),
          field("time", "Horário", "time", undefined, false),
          field("what", "O que vai acontecer", "text", "Ex.: retorno ao cliente", false),
        ],
        min_fields: 1,
        max_fields: 3,
        completion_rule: "Definir uma data",
      }),
    );
  }

  /* 4. Lista + prioridade (híbrido) */
  if (RE.priority.test(text) && (RE.list.test(text) || count)) {
    const n = count ?? 3;
    return make(
      baseConfig("hybrid", {
        fields: listFields(n, "Tarefa", "Escreva aqui"),
        min_fields: n,
        max_fields: n,
        selection: { type: "single", label: "Qual delas merece sua atenção primeiro?", required: true },
        completion_rule: `Preencher ${n} itens e escolher 1 prioridade`,
      }),
    );
  }

  /* 5. Só escolher prioridade entre itens */
  if (RE.priority.test(text)) {
    return make(
      baseConfig("priority_selection", {
        fields: listFields(3, "Opção", "Escreva aqui"),
        min_fields: 2,
        max_fields: 5,
        allow_add: true,
        selection: { type: "single", label: "Qual é a prioridade?", required: true },
        completion_rule: "Registrar as opções e escolher 1 prioridade",
      }),
    );
  }

  /* 6. Checklist */
  if (RE.checklist.test(text)) {
    const n = count ?? 3;
    return make(
      baseConfig("checklist", {
        fields: Array.from({ length: n }, (_, i) =>
          field(`step_${i + 1}`, `Etapa ${i + 1}`, "checkbox"),
        ),
        min_fields: n,
        max_fields: n,
        completion_label: "Concluir",
        completion_rule: "Marcar todas as etapas",
      }),
    );
  }

  /* 7. Escolha múltipla / única */
  if (RE.chooseMany.test(text)) {
    return make(
      baseConfig("multiple_choice", {
        selection: {
          type: "multiple",
          label: "Selecione o que se aplica",
          required: true,
          options: [
            { value: "sim", label: "Sim" },
            { value: "parcial", label: "Em parte" },
            { value: "nao", label: "Não" },
          ],
        },
        completion_label: "Confirmar",
        completion_rule: "Selecionar ao menos 1 opção",
      }),
    );
  }
  if (RE.choose.test(text)) {
    return make(
      baseConfig("single_choice", {
        selection: {
          type: "single",
          label: "Qual é a sua resposta?",
          required: true,
          options: [
            { value: "sim", label: "Sim" },
            { value: "nao", label: "Não" },
            { value: "ainda_nao_sei", label: "Ainda não sei" },
          ],
        },
        completion_label: "Confirmar",
        completion_rule: "Escolher 1 opção",
      }),
    );
  }

  /* 8. Listas */
  if (RE.list.test(text)) {
    if (count) {
      return make(
        baseConfig("fixed_list", {
          fields: listFields(count, "Item", "Escreva aqui"),
          min_fields: count,
          max_fields: count,
          completion_rule: `Preencher ${count} itens`,
        }),
      );
    }
    return make(
      baseConfig("flexible_list", {
        fields: listFields(2, "Item", "Escreva aqui"),
        min_fields: 2,
        max_fields: 10,
        allow_add: true,
        completion_rule: "Preencher ao menos 2 itens",
      }),
    );
  }

  /* 9. Conversa com a MAG */
  if (RE.conversation.test(text)) {
    return make(
      baseConfig("conversation", {
        completion_label: "Conversar com a MAG sobre isso",
        completion_rule: "Conversar com a MAG",
      }),
    );
  }

  /* 10. Revisão / leitura */
  if (RE.review.test(text) && !RE.reflection.test(text)) {
    return make(
      baseConfig("information_review", {
        completion_label: "Entendi",
        completion_rule: "Confirmar a leitura",
      }),
    );
  }

  /* 11. Resposta aberta */
  if (RE.reflection.test(text)) {
    return make(
      baseConfig("text_response", {
        fields: [field("text", "Sua resposta", "text", "Escreva o que vier — pode ser curto.")],
        min_fields: 1,
        max_fields: 1,
        completion_rule: "Escrever uma resposta",
      }),
    );
  }

  /* 12. Ação que acontece fora do app */
  if (RE.external.test(text)) {
    return make(
      baseConfig("external_action", {
        completion_label: "Já fiz",
        completion_rule: "Confirmar a execução",
      }),
    );
  }

  return make(
    baseConfig("external_action", {
      completion_label: "Já fiz",
      completion_rule: "Confirmar a execução",
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Validação antes de exibir/salvar                                    */
/* ------------------------------------------------------------------ */

const KNOWN_TYPES: InteractionType[] = [
  "text_response", "fixed_list", "flexible_list", "priority_selection", "checklist",
  "single_choice", "multiple_choice", "numeric_input", "date_time", "message_to_send",
  "external_action", "conversation", "information_review", "hybrid",
];

/** Config salvo é confiável? Se não, recalculamos a partir do texto. */
export function parseStoredInteraction(
  type: unknown,
  config: unknown,
): { type: InteractionType; config: InteractionConfig } | null {
  if (typeof type !== "string" || !KNOWN_TYPES.includes(type as InteractionType)) return null;
  if (!config || typeof config !== "object") return null;
  const c = config as Partial<InteractionConfig>;
  if (!Array.isArray(c.fields)) return null;
  if (typeof c.completion_label !== "string") return null;
  return {
    type: type as InteractionType,
    config: {
      type: type as InteractionType,
      fields: c.fields as InteractionField[],
      allow_add: c.allow_add === true,
      min_fields: typeof c.min_fields === "number" ? c.min_fields : 0,
      max_fields: typeof c.max_fields === "number" ? c.max_fields : 0,
      ...(c.selection ? { selection: c.selection } : {}),
      ...(c.helper ? { helper: c.helper } : {}),
      completion_label: c.completion_label,
      completion_rule: typeof c.completion_rule === "string" ? c.completion_rule : "",
      reward_magnetos: typeof c.reward_magnetos === "number" ? c.reward_magnetos : 10,
    },
  };
}

/**
 * Coerência texto ↔ interface. Se a instrução pede uma quantidade exata,
 * a interface precisa ter exatamente essa quantidade de campos.
 */
export function validateInteraction(
  text: string,
  resolved: { type: InteractionType; config: InteractionConfig },
): boolean {
  const count = detectCount(text);
  const inputFields = resolved.config.fields.filter((f) => f.type !== "checkbox");
  if (count && (resolved.type === "fixed_list" || resolved.type === "hybrid")) {
    if (inputFields.length !== count) return false;
  }
  if (resolved.type === "fixed_list" && resolved.config.allow_add) return false;
  if (
    (resolved.type === "single_choice" || resolved.type === "multiple_choice") &&
    !resolved.config.selection
  ) {
    return false;
  }
  if (/```|<\/?[a-z]+>|\*\*/i.test(text)) return false;
  return true;
}
