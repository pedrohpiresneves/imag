/**
 * Humaniza o título da direção: transforma comandos frios
 * ("Envie mensagem para 3 leads…") em uma fala pessoal da MAG
 * ("Ana, hoje vamos enviar mensagem para 3 leads…").
 *
 * Regra de ouro: nunca inventa contexto — só reescreve a abertura
 * do texto que a IA (ou o fallback) já gerou a partir de dados reais.
 * O nome vem sempre do campo principal do perfil, normalizado.
 */

import { normalizeFirstName } from "./name";
import { isCoherentSentence } from "./direction-validator";


const IRREGULAR: Record<string, string> = {
  faça: "fazer",
  peça: "pedir",
  escreva: "escrever",
  responda: "responder",
  conclua: "concluir",
  defina: "definir",
  reveja: "rever",
  diga: "dizer",
  traga: "trazer",
  ponha: "colocar",
  vá: "ir",
  seja: "ser",
  tenha: "ter",
  mantenha: "manter",
  proponha: "propor",
  envie: "enviar",
  ligue: "ligar",
};

/**
 * Converte SOMENTE verbos conhecidos para o infinitivo. Qualquer palavra fora
 * do mapa retorna null — inventar conjugação já produziu texto corrompido na
 * interface ("bibiemic"), então aqui a regra é: na dúvida, não transforma.
 */
const REGULAR: Record<string, string> = {
  liste: "listar",
  registre: "registrar",
  identifique: "identificar",
  analise: "analisar",
  organize: "organizar",
  execute: "executar",
  realize: "realizar",
  anote: "anotar",
  revise: "revisar",
  separe: "separar",
  escolha: "escolher",
  marque: "marcar",
  agende: "agendar",
  planeje: "planejar",
  publique: "publicar",
  compare: "comparar",
  calcule: "calcular",
  confirme: "confirmar",
  retome: "retomar",
  reative: "reativar",
  avalie: "avaliar",
  ajuste: "ajustar",
  finalize: "finalizar",
  prepare: "preparar",
  reserve: "reservar",
  monte: "montar",
  descreva: "descrever",
  atualize: "atualizar",
  contate: "contatar",
  converse: "conversar",
  pergunte: "perguntar",
  cadastre: "cadastrar",
  some: "somar",
  divida: "dividir",
  escolher: "escolher",
};

function toInfinitive(word: string): string | null {
  const w = word.toLowerCase().normalize("NFC");
  if (IRREGULAR[w]) return IRREGULAR[w];
  if (REGULAR[w]) return REGULAR[w];
  return null;
}

/** Aberturas alternadas — evita "Nome, hoje vamos…" todos os dias. */
const OPENERS = [
  (n: string) => (n ? `${n}, hoje vamos ` : "Hoje vamos "),
  (n: string) => (n ? `${n}, que tal ` : "Que tal "),
  (n: string) => (n ? `${n}, hoje o foco é ` : "Hoje o foco é "),
  (n: string) => (n ? `${n}, vamos começar por ` : "Vamos começar por "),
  (n: string) => (n ? `${n}, uma ação simples para hoje: ` : "Uma ação simples para hoje: "),
  (n: string) => (n ? `${n}, para avançar hoje vale ` : "Para avançar hoje vale "),
];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function firstNameOf(fullName: string | null | undefined): string {
  return normalizeFirstName(fullName);
}


/** Já está em tom de conversa? (começa com o nome ou com abertura pessoal) */
export function isConversational(title: string, firstName: string): boolean {
  const t = title.trim().toLowerCase();
  if (firstName && t.startsWith(firstName.toLowerCase())) return true;
  return /^(hoje|que tal|vamos|uma ação simples|para avançar|percebi que|hoje o foco)/.test(t);
}

/** Remove ruído burocrático que deixa a fala robótica. */
function deburocratize(text: string): string {
  return text
    .replace(/\s*,?\s*para (a )?sua execu[çc][ãa]o\b/gi, "")
    .replace(/\s*,?\s*conforme (o )?planejado\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Dia sequencial (a partir de uma data ISO no seed) para alternar aberturas. */
function dayIndex(seed: string): number {
  const m = seed.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return 0;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

export function humanizeDirectionTitle(
  rawTitle: string,
  fullName: string | null | undefined,
  seed = "",
): string {
  const title = deburocratize((rawTitle ?? "").trim());
  if (!title) return title;
  const name = firstNameOf(fullName);
  if (isConversational(title, name)) return title.slice(0, 140);

  // "Registre sua resposta: X" e prefixos semelhantes: humaniza o miolo.
  const words = title.split(/\s+/);
  const first = words[0]!.replace(/[:,]$/, "");
  const infinitive = toInfinitive(first);
  const rest = words.slice(1).join(" ");
  if (!infinitive || !rest) {
    return (name ? `${name}, ${title.charAt(0).toLocaleLowerCase("pt-BR")}${title.slice(1)}` : title).slice(
      0,
      140,
    );
  }

  // Abertura alterna a cada dia (nunca repete em dias consecutivos) e varia
  // por usuário — sem depender de nomes ou contas específicas.
  const idx = (hash(seed.replace(/\d{4}-\d{2}-\d{2}/, "")) + dayIndex(seed)) % OPENERS.length;
  const opener = OPENERS[idx]!(name);
  let body = `${infinitive} ${rest}`;
  body = body.charAt(0).toLowerCase() + body.slice(1);
  let out = `${opener}${body}`.replace(/\s+/g, " ").trim();

  out = out.replace(/[.\s]+$/, "");
  if (out.length > 140) {
    // Corta na última fronteira de palavra antes do limite, sem reticências feias.
    const cut = out.slice(0, 139);
    out = cut.slice(0, Math.max(cut.lastIndexOf(" "), 100)).replace(/[\s,;:]+$/, "");
  }
  const final = /[?!.…]$/.test(out) ? out : `${out}.`;
  // Rede de segurança: se a reescrita produziu texto incoerente, devolve o
  // original — melhor um título seco do que uma frase corrompida na tela.
  return isCoherentSentence(final) ? final : title.slice(0, 140);
}
