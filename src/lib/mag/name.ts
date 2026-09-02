/**
 * Normalização global do nome do usuário.
 *
 * Regra: o nome vem EXCLUSIVAMENTE do campo principal do perfil (`full_name`).
 * Nunca concatenar apelido, handle, username ou e-mail. Quando o valor for
 * vazio, inválido ou uma sequência sem separação confiável, o resultado é
 * string vazia — e a copy deve ser gerada sem mencionar nome.
 */

const INVALID_CHARS = /[^\p{L}\p{M}\s'-]/gu;

function hasVowel(word: string): boolean {
  return /[aeiouáàâãéêíóôõúü]/i.test(word);
}

function capitalize(word: string): string {
  return word.charAt(0).toLocaleUpperCase("pt-BR") + word.slice(1).toLocaleLowerCase("pt-BR");
}

/** Extrai o primeiro nome confiável a partir do nome completo do perfil. */
export function normalizeFirstName(fullName: string | null | undefined): string {
  const raw = (fullName ?? "").normalize("NFC").trim();
  if (!raw) return "";
  // E-mails, handles e usernames não são nomes.
  if (/[@\d_]/.test(raw) || raw.includes(".")) return "";

  const cleaned = raw.replace(INVALID_CHARS, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  // Duplicações do tipo "Ana Ana Souza" ou "ANA ana".
  const tokens = cleaned
    .split(" ")
    .filter((t, i, arr) => i === 0 || t.toLocaleLowerCase() !== arr[i - 1]!.toLocaleLowerCase());

  const first = tokens[0] ?? "";
  if (first.length < 2 || first.length > 20) return "";
  if (!hasVowel(first)) return "";
  // Sequência sem separação confiável (ex.: "anapaulasouza") — não usar.
  if (tokens.length === 1 && first.length > 12) return "";

  return first
    .split("-")
    .map(capitalize)
    .join("-");
}
