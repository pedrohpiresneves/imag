/**
 * Camada canônica de interação das Direções do Dia.
 *
 * A interface exibida NUNCA é inferida por palavras no momento do render:
 * ela nasce do `interaction_type`/`interaction_config` salvo na direção e é
 * reduzida aqui para um dos 6 tipos canônicos suportados pelo produto.
 *
 * Direções antigas (sem tipo salvo) caem em `no_input`, o fallback seguro.
 */

import type { InteractionConfig, InteractionField, InteractionType } from "./interaction";

export type CanonicalType =
  | "no_input"
  | "single_text"
  | "short_list"
  | "choice"
  | "suggested_message"
  | "checklist";

export type CanonicalInteraction = {
  type: CanonicalType;
  /** Campos efetivos (vazio em no_input e suggested_message). */
  fields: InteractionField[];
  options: { value: string; label: string }[];
  multiple: boolean;
  selectionLabel: string | null;
  helper: string | null;
  completionLabel: string;
};

const MAX_FIELDS = 3;

const LEGACY_MAP: Record<InteractionType, CanonicalType> = {
  message_to_send: "suggested_message",
  checklist: "checklist",
  single_choice: "choice",
  multiple_choice: "choice",
  text_response: "single_text",
  fixed_list: "short_list",
  flexible_list: "short_list",
  priority_selection: "short_list",
  hybrid: "short_list",
  numeric_input: "short_list",
  date_time: "single_text",
  external_action: "no_input",
  information_review: "no_input",
  conversation: "no_input",
};

function completionLabelFor(type: CanonicalType): string {
  if (type === "suggested_message") return "Já enviei";
  if (type === "no_input") return "Concluir direção";
  return "Salvar e concluir";
}

/**
 * Título da área de execução — varia conforme a natureza da ação,
 * nunca "Como fazer" genérico.
 */
export function actionTitleFor(canonical: CanonicalInteraction, text: string): string {
  const t = text.toLowerCase();
  switch (canonical.type) {
    case "choice":
      return "Escolha uma opção";
    case "checklist":
      return "Marque o que concluiu";
    case "suggested_message":
      return "Escreva sua mensagem";
    case "single_text":
      if (/\bresultado|quanto|faturou|vendeu\b/.test(t)) return "Registre o resultado";
      if (/\bdefin|escolh|decid/.test(t)) return "Defina agora";
      return "Responda aqui";
    case "short_list":
      if (/\borganiz|planej|agend/.test(t)) return "Organize aqui";
      return "Crie sua lista";
    default:
      return "Primeiro passo";
  }
}


/** Reduz qualquer configuração salva ao contrato canônico e coerente. */
export function toCanonicalInteraction(
  storedType: string | null | undefined,
  config: InteractionConfig | null | undefined,
): CanonicalInteraction {
  const legacy = (storedType ?? "") as InteractionType;
  const type: CanonicalType = LEGACY_MAP[legacy] ?? "no_input";

  const rawFields = Array.isArray(config?.fields) ? config!.fields : [];
  const options = config?.selection?.options ?? [];
  const multiple = config?.selection?.type === "multiple";

  if (type === "no_input" || type === "suggested_message") {
    return {
      type,
      fields: [],
      options: [],
      multiple: false,
      selectionLabel: null,
      helper: config?.helper ?? null,
      completionLabel: completionLabelFor(type),
    };
  }

  if (type === "choice") {
    // Sem opções predeterminadas não há escolha possível: vira leitura simples.
    if (!options.length) {
      return {
        type: "no_input",
        fields: [],
        options: [],
        multiple: false,
        selectionLabel: null,
        helper: null,
        completionLabel: completionLabelFor("no_input"),
      };
    }
    return {
      type,
      fields: [],
      options,
      multiple,
      selectionLabel: config?.selection?.label ?? "Qual é a sua resposta?",
      helper: config?.helper ?? null,
      completionLabel: completionLabelFor(type),
    };
  }

  if (type === "checklist") {
    const items = rawFields.filter((f) => f.type === "checkbox").slice(0, MAX_FIELDS);
    if (!items.length) {
      return {
        type: "no_input",
        fields: [],
        options: [],
        multiple: false,
        selectionLabel: null,
        helper: null,
        completionLabel: completionLabelFor("no_input"),
      };
    }
    return {
      type,
      fields: items,
      options: [],
      multiple: false,
      selectionLabel: null,
      helper: config?.helper ?? null,
      completionLabel: completionLabelFor(type),
    };
  }

  const inputs = rawFields.filter((f) => f.type !== "checkbox");
  if (!inputs.length) {
    return {
      type: "no_input",
      fields: [],
      options: [],
      multiple: false,
      selectionLabel: null,
      helper: null,
      completionLabel: completionLabelFor("no_input"),
    };
  }

  if (type === "single_text") {
    return {
      type,
      fields: [{ ...inputs[0]!, required: true }],
      options: [],
      multiple: false,
      selectionLabel: null,
      helper: config?.helper ?? null,
      completionLabel: completionLabelFor(type),
    };
  }

  // short_list: no máximo 3 campos, nunca formulários longos automáticos.
  const fields = inputs.slice(0, MAX_FIELDS).map((f, i) => ({ ...f, required: i === 0 }));
  return {
    type: "short_list",
    fields,
    options: [],
    multiple: false,
    selectionLabel: null,
    helper: config?.helper ?? null,
    completionLabel: completionLabelFor("short_list"),
  };
}

/** Coerência mínima entre a copy e a interface antes de exibir/salvar. */
export function isCoherent(text: string, canonical: CanonicalInteraction): boolean {
  if (canonical.fields.length > MAX_FIELDS) return false;
  if (canonical.type === "choice" && canonical.options.length < 2) return false;
  if (/```|<\/?[a-z]+>|\*\*/i.test(text)) return false;
  return true;
}
