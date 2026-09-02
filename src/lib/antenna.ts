export type AntennaLevel = {
  key: string;
  name: string;
  threshold: number;
  color: string;
  /** Fundo do ponto da antena (permite acabamento metálico). */
  fill: string;
  glow: string;
  ring?: string;
};

export const ANTENNA_LEVELS: AntennaLevel[] = [
  { key: "blue", name: "Antena Azul", threshold: 0, color: "#335CFF", fill: "#335CFF", glow: "rgba(51,92,255,0.45)" },
  { key: "green", name: "Antena Verde", threshold: 100, color: "#12A150", fill: "#12A150", glow: "rgba(18,161,80,0.42)" },
  { key: "orange", name: "Antena Laranja", threshold: 300, color: "#FF8A34", fill: "#FF8A34", glow: "rgba(255,138,52,0.42)" },
  { key: "pink", name: "Antena Rosa", threshold: 700, color: "#EC4899", fill: "#EC4899", glow: "rgba(236,72,153,0.42)" },
  { key: "purple", name: "Antena Roxa", threshold: 1500, color: "#7C3AED", fill: "#7C3AED", glow: "rgba(124,58,237,0.42)" },
  { key: "teal", name: "Antena Azul-turquesa", threshold: 3000, color: "#16BFC4", fill: "#16BFC4", glow: "rgba(22,191,196,0.42)" },
  {
    key: "gold",
    name: "Antena Dourada",
    threshold: 6000,
    color: "#C9A227",
    fill: "linear-gradient(140deg,#F7E3A1 0%,#D6B155 45%,#9C7A14 100%)",
    glow: "rgba(201,162,39,0.45)",
  },
];

export function levelForMagnetos(total: number): AntennaLevel {
  let current = ANTENNA_LEVELS[0]!;
  for (const l of ANTENNA_LEVELS) if (total >= l.threshold) current = l;
  return current;
}

export function nextLevelFor(total: number): AntennaLevel | null {
  return ANTENNA_LEVELS.find((l) => l.threshold > total) ?? null;
}

/** Progresso 0..1 entre o nível atual e o próximo. */
export function levelProgress(total: number): number {
  const cur = levelForMagnetos(total);
  const next = nextLevelFor(total);
  if (!next) return 1;
  const span = next.threshold - cur.threshold;
  if (span <= 0) return 1;
  return Math.max(0, Math.min(1, (total - cur.threshold) / span));
}
