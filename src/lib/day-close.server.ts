/** Regras de horário do encerramento do dia. Server-safe, sem dependências. */

function toMinutes(value: string) {
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/**
 * Horário-alvo do encerramento em minutos locais:
 * padrão do usuário (20h), ou 30 min após o último compromisso, nunca depois de 21h30.
 */
export function dayCloseTargetMinutes(baseHour: number, eventTimes: string[]) {
  const base = Math.max(0, Math.min(23, Math.round(baseHour || 20))) * 60;
  const last = eventTimes
    .map(toMinutes)
    .filter((v): v is number => v !== null)
    .sort((a, b) => b - a)[0];
  const target = last !== undefined && last + 30 > base ? last + 30 : base;
  return Math.min(target, 21 * 60 + 30);
}
