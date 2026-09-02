/** Utilitários puros da semana do foco (fuso local do usuário). */

export function addDays(localDate: string, n: number): string {
  const d = new Date(`${localDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** O foco semanal sempre termina no domingo. */
export function sundayEnd(localDate: string, nextWeek = false): string {
  const d = new Date(`${localDate}T12:00:00Z`);
  const toSunday = (7 - d.getUTCDay()) % 7;
  return addDays(localDate, nextWeek ? toSunday + 7 : toSunday);
}

export function isSunday(localDate: string): boolean {
  return new Date(`${localDate}T12:00:00Z`).getUTCDay() === 0;
}

/** Próxima segunda-feira (nunca hoje). */
export function nextMonday(localDate: string): string {
  const day = new Date(`${localDate}T12:00:00Z`).getUTCDay();
  const delta = day === 1 ? 7 : (8 - day) % 7 || 7;
  return addDays(localDate, delta);
}

export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00Z`).getTime();
  const b = new Date(`${to}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Organiza a frase preservando a intenção original. */
export function interpretFocus(raw: string): string {
  const t = (raw ?? "").trim().replace(/\s+/g, " ").replace(/[.;]+$/, "");
  if (!t) return t;
  return (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 200);
}
