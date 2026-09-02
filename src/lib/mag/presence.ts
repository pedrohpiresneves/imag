/**
 * Presença viva da MAG — regras de quando ela fala dentro do app.
 *
 * A MAG deve ser percebida como presença, não como interrupção:
 * cada mensagem aparece uma única vez por contexto, com intervalo
 * mínimo entre falas e sem repetir algo que o usuário já resolveu.
 */

const KEY = "mag_presence_v1";
/** Intervalo mínimo entre falas contextuais (não vale para o tour guiado). */
export const CONTEXT_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export type PresenceState = {
  /** id da fala -> ISO da última exibição */
  seen: Record<string, string>;
  /** ISO da última fala contextual exibida */
  lastContextAt?: string;
  /** tour guiado concluído */
  tourDone?: boolean;
  /** quantas falas o usuário dispensou sem agir (reduz frequência) */
  dismissals?: number;
};

function read(): PresenceState {
  if (typeof window === "undefined") return { seen: {} };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { seen: {} };
    const parsed = JSON.parse(raw) as PresenceState;
    return {
      seen: parsed.seen ?? {},
      lastContextAt: parsed.lastContextAt,
      tourDone: parsed.tourDone,
      dismissals: parsed.dismissals ?? 0,
    };
  } catch {
    return { seen: {} };
  }
}

function write(state: PresenceState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function loadPresence(): PresenceState {
  return read();
}

export function wasSeen(id: string): boolean {
  return Boolean(read().seen[id]);
}

export function seenAt(id: string): number | null {
  const iso = read().seen[id];
  return iso ? new Date(iso).getTime() : null;
}

export function markSeen(id: string, opts?: { context?: boolean }): PresenceState {
  const state = read();
  const now = new Date().toISOString();
  state.seen[id] = now;
  if (opts?.context) state.lastContextAt = now;
  write(state);
  return state;
}

export function finishTour(): PresenceState {
  const state = read();
  state.tourDone = true;
  write(state);
  return state;
}

/** Fechar sem agir reduz temporariamente a frequência das falas. */
export function noteDismiss(): PresenceState {
  const state = read();
  state.dismissals = (state.dismissals ?? 0) + 1;
  write(state);
  return state;
}

/** Agir zera a fadiga — a MAG volta ao ritmo normal. */
export function resetDismissals(): PresenceState {
  const state = read();
  state.dismissals = 0;
  write(state);
  return state;
}

/** Respeita o intervalo mínimo entre falas contextuais (cresce com dispensas). */
export function contextCooldownOk(state = read()): boolean {
  if (!state.lastContextAt) return true;
  const factor = Math.min(1 + (state.dismissals ?? 0) * 0.5, 4);
  return Date.now() - new Date(state.lastContextAt).getTime() > CONTEXT_COOLDOWN_MS * factor;
}

/** Uma vez por dia para a mesma fala contextual. */
export function seenToday(id: string, state = read()): boolean {
  const iso = state.seen[id];
  if (!iso) return false;
  return new Date(iso).toLocaleDateString("en-CA") === new Date().toLocaleDateString("en-CA");
}

export type MagState =
  | "neutral"
  | "thinking"
  | "confident"
  | "happy"
  | "empathetic"
  | "celebrating";

export type PresenceMessage = {
  id: string;
  text: string;
  cta?: string;
  /** rota para navegar ao clicar no CTA */
  to?: string;
  /** evento global a disparar ao clicar no CTA */
  event?: string;
  mood: MagState;
  /** falas do tour guiado ignoram o cooldown */
  tour?: boolean;
  /** falas subsequentes exibidas na sequência (encerramento do tour) */
  then?: string[];
};
