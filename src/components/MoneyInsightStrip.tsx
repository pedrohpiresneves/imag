/**
 * Faixa compacta de insight da MAG na tela "Meu dinheiro".
 * Menos ruído: uma linha de leitura, dois links discretos e dispensar.
 */
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { haptic } from "@/lib/haptics";
import magHeadOfficial from "@/assets/mag-head-official.png.asset.json";
import type { MoneyGuidance } from "@/lib/mag/money-guidance";
import { categoryLabel, formatBRL } from "@/lib/money-categories";

const BLUE = "#335CFF";
const INK = "#111111";
const MUTED = "#6B6B70";

const DISMISS_KEY = "imag.money.dismissed";

export function isDismissed(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    return raw ? (JSON.parse(raw) as string[]).includes(key) : false;
  } catch {
    return false;
  }
}

function dismiss(key: string) {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const list = raw ? (JSON.parse(raw) as string[]) : [];
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify([...list.slice(-20), key]));
  } catch {
    /* silencioso — dispensar nunca pode quebrar a tela */
  }
}

/** Texto curto e dinâmico: valor real + categoria identificada. */
export function insightHeadline(guidance: MoneyGuidance): string {
  if (guidance.category && guidance.category_cents > 0) {
    return `${formatBRL(guidance.category_cents)} em ${categoryLabel("expense", guidance.category)} esta semana`;
  }
  return guidance.message;
}

export function MoneyInsightStrip({
  guidance,
  onDismiss,
  onSetLimit,
  onAnalyse,
}: {
  guidance: MoneyGuidance;
  onDismiss: () => void;
  onSetLimit: () => void;
  onAnalyse: () => void;
}) {
  const count = guidance.category_count;

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="relative mt-4 flex max-h-[110px] items-center gap-3 overflow-hidden rounded-[16px] px-3 py-2.5"
      style={{ background: "#F2F5FF", border: "1px solid #DCE4FF" }}
    >
      <img
        src={magHeadOfficial.url}
        alt=""
        aria-hidden
        className="h-8 w-8 shrink-0 object-contain"
      />

      <div className="min-w-0 flex-1 pr-5">
        <p
          className="truncate text-[14px] font-medium leading-[1.25]"
          style={{ color: INK, letterSpacing: "-0.01em" }}
        >
          {insightHeadline(guidance)}
        </p>
        {count > 1 && guidance.category && (
          <p className="truncate text-[12px] leading-[1.3]" style={{ color: MUTED }}>
            {count} lançamentos
          </p>
        )}
        <div className="mt-1 flex items-center gap-4">
          {guidance.category && (
            <button
              type="button"
              onClick={() => {
                haptic(5);
                onSetLimit();
              }}
              className="text-[12.5px] font-medium transition active:opacity-70"
              style={{ color: BLUE }}
            >
              Definir limite →
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              haptic(4);
              onAnalyse();
            }}
            className="text-[12.5px] transition active:opacity-70"
            style={{ color: MUTED }}
          >
            Ver análise
          </button>
        </div>
      </div>

      <button
        type="button"
        aria-label="Dispensar insight"
        onClick={() => {
          haptic(3);
          dismiss(guidance.key);
          onDismiss();
        }}
        className="absolute right-2 top-2 p-1 transition active:opacity-60"
        style={{ color: MUTED }}
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </motion.section>
  );
}
