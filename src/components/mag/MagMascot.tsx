import { useEffect, useRef, useState } from "react";
import { MAGCharacter } from "./MAGCharacter";
import { MAGSpeechBubble } from "./MAGSpeechBubble";
import type { MAGState } from "./mag-character-state";

export const MAG_BLUE_UI = "#335CFF";

/** Estados semânticos usados pela interface (mapeados para o personagem 3D). */
export type MagState =
  | "neutral"
  | "thinking"
  | "organizing"
  | "success"
  | "attention"
  | "waiting"
  | "happy"
  | "confident"
  | "empathetic"
  | "proud"
  | "celebrating"
  | "sad";

const TO_3D: Record<MagState, MAGState> = {
  neutral: "idle",
  waiting: "idle",
  thinking: "thinking",
  organizing: "thinking",
  attention: "attention",
  success: "happy",
  happy: "happy",
  confident: "attention",
  proud: "happy",
  celebrating: "celebrate",
  empathetic: "sad",
  sad: "sad",
};

export function toMagCharacterState(state: MagState): MAGState {
  return TO_3D[state] ?? "idle";
}

/** Presença compacta do MAG (enquadramento no rosto), personagem 3D real. */
export function MagAvatarMascot({
  state = "neutral",
  size = 28,
  className = "",
}: {
  state?: MagState;
  size?: number;
  className?: string;
}) {
  return (
    <MAGCharacter
      state={toMagCharacterState(state)}
      framing="head"
      size={size}
      className={className}
    />
  );
}

/** Personagem completo — onboarding, telas vazias e momentos especiais. */
export function MagFull({
  state = "neutral",
  size = 132,
  className = "",
}: {
  state?: MagState;
  size?: number;
  className?: string;
}) {
  return (
    <MAGCharacter
      state={toMagCharacterState(state)}
      framing="full"
      size={size}
      className={className}
      shadow
    />
  );
}

/** Balão de fala discreto do MAG — 1 frase curta, desaparece sozinho. */
export const MagBubble = MAGSpeechBubble;

/**
 * Fala contextual do MAG: mostra uma frase curta por alguns segundos e silencia.
 * O MAG só fala quando há motivo real (direcionar, organizar, encorajar, celebrar).
 */
export function useMagSpeech(defaultDuration = 4200) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function say(text: string | null, duration = defaultDuration) {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    if (text && duration > 0) {
      timer.current = setTimeout(() => setMessage(null), duration);
    }
  }

  return { message, say };
}

/** Sorteia uma frase do repertório do MAG (tom calmo e estratégico). */
export function magPhrase(list: readonly string[]) {
  return list[Math.floor(Math.random() * list.length)]!;
}

export const MAG_PHRASES = {
  home: ["Vamos ao que importa?", "Separei sua direção de hoje.", "Tem um próximo passo claro para você."],
  newDirection: ["Essa é sua prioridade agora.", "Foque nisso primeiro.", "Uma ação clara vale mais do que várias soltas."],
  organizeStart: ["Deixa comigo.", "Vou organizar seu dia.", "Vou simplificar isso para você."],
  organizing: ["Analisando o que importa.", "Organizando por prioridade.", "Montando um dia mais leve."],
  done: ["Boa. Mais um passo.", "Você avançou.", "Direção executada.", "Seguimos."],
  journey: ["Estamos avançando.", "Mais um marco.", "Sua constância está funcionando."],
  missed: ["Tudo bem. Vamos ajustar.", "Algo mudou de prioridade?", "Posso reorganizar com você."],
  idle: ["Quer destravar isso agora?", "Posso te ajudar a começar.", "Seu próximo passo pode ser simples."],
  streak: ["Você está mantendo o ritmo.", "Isso é constância.", "Seu avanço está ficando visível."],
  dayEmpty: ["Posso organizar seu dia.", "Me conte o que tem hoje."],
  dayReady: ["Seu dia está organizado.", "Pronto. Comece pelo topo."],
} as const;

/** Linha curta de orientação do MAG (estados vazios, erros, conclusões). */
export function MagLine({
  children,
  state = "neutral",
  size = 24,
}: {
  children: React.ReactNode;
  state?: MagState;
  size?: number;
}) {
  return (
    <span className="inline-flex items-start gap-2">
      <MagAvatarMascot state={state} size={size} className="mt-[1px]" />
      <span className="text-[13px] leading-[1.45]" style={{ color: "#6B6B70" }}>
        {children}
      </span>
    </span>
  );
}
