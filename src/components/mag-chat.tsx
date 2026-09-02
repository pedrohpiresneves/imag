import { useEffect, useRef, useState, type ReactNode } from "react";
import { MagAvatarMascot } from "@/components/mag/MagMascot";
import { AttachButton } from "@/components/mag/AttachControl";
import { ArrowUp, Mic, Square } from "lucide-react";


export const MAG_BLUE = "#335CFF";
export const MAG_BLUE_SOFT = "#EEF3FF";
export const MAG_BLUE_BORDER = "#DCE5FF";
/* Tema do chat MAG (claro por padrão, escuro via data-mag-theme="dark") */
export const MAG_DARK_BG = "var(--mag-bg)";
export const MAG_DARK_BUBBLE = "var(--mag-bubble)";
export const MAG_DARK_BORDER = "var(--mag-border)";
export const MAG_DARK_TEXT = "var(--mag-text)";
export const MAG_DARK_MUTED = "var(--mag-muted)";
export const MAG_SURFACE = "var(--mag-surface)";

export function BubbleTime({ time, align = "left" }: { time?: string; align?: "left" | "right" }) {
  if (!time) return null;
  return (
    <p
      className={`mt-1 text-[11px] ${align === "right" ? "text-right" : ""}`}
      style={{ color: "var(--mag-muted)", opacity: 0.85 }}
    >
      {time}
    </p>
  );
}

/** Divide o texto da MAG em balões curtos (mesma lógica do onboarding). */
export function splitChunks(text: string): string[] {
  const raw = text
    .split(/\n+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const block of raw) {
    if (block.length <= 190) {
      out.push(block);
      continue;
    }
    const sentences = block.match(/[^.!?]+[.!?]*\s*/g) ?? [block];
    let buf = "";
    for (const s of sentences) {
      if ((buf + s).trim().length > 190 && buf.trim()) {
        out.push(buf.trim());
        buf = s;
      } else {
        buf += s;
      }
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out;
}


/** Marcador de respostas rápidas: [[opcoes: A | B]] ou [[opcoes-multi: A | B]] */
const OPTIONS_RE = /\[\[opcoes(-multi)?:([^\]]+)\]\]/i;

export function parseChatOptions(text: string): {
  text: string;
  options: string[];
  multi: boolean;
} {
  const m = text.match(OPTIONS_RE);
  if (!m) return { text, options: [], multi: false };
  const options = (m[2] ?? "")
    .split("|")
    .map((o) => o.trim())
    .filter(Boolean)
    .slice(0, 8);
  return { text: text.replace(OPTIONS_RE, "").trim(), options, multi: !!m[1] };
}

/** Chips de resposta rápida (seleção única ou múltipla), estética iMAG. */
export function QuickOptions({
  options,
  multi,
  onSend,
  onFreeText,
}: {
  options: string[];
  multi: boolean;
  onSend: (value: string) => void;
  onFreeText?: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  if (options.length === 0) return null;

  const isFreeText = (o: string) =>
    /^(outro|outra|outro valor|quero explicar|prefiro explicar|explicar)/i.test(o.trim());

  function toggle(option: string) {
    if (isFreeText(option)) {
      setSelected([]);
      onFreeText?.();
      return;
    }
    if (!multi) {
      onSend(option);
      return;
    }
    setSelected((prev) =>
      prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option],
    );
  }

  return (
    <div className="ml-[42px] flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              onClick={() => toggle(option)}
              className="rounded-full border px-3.5 py-2 text-[13.5px] transition"
              style={{
                borderColor: active ? MAG_BLUE : MAG_DARK_BORDER,
                background: active ? MAG_BLUE : "var(--mag-surface)",
                color: active ? "#FFFFFF" : MAG_DARK_TEXT,
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
      {multi && (
        <button
          type="button"
          disabled={selected.length === 0}
          onClick={() => onSend(selected.join(", "))}
          className="rounded-full px-4 py-2 text-[13.5px] font-medium transition disabled:opacity-30"
          style={{ background: "#F3F6FF", color: "#0B1220" }}
        >
          Continuar
        </button>
      )}
    </div>
  );
}

function renderBold(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
    /^\*\*[^*]+\*\*$/.test(chunk) ? (
      <strong key={i} className="font-semibold">
        {chunk.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{chunk}</span>
    ),
  );
}

export function MagAvatar() {
  return (
    <div
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
      style={{ background: "var(--mag-accent-soft)", border: `1px solid ${MAG_DARK_BORDER}` }}
      aria-hidden
    >
      <MagAvatarMascot state="neutral" size={22} />
    </div>
  );
}

export function MagGroup({ chunks, time }: { chunks: string[]; time?: string }) {
  return (
    <div className="flex gap-2.5">
      <div className="w-8 shrink-0">
        <div className="sticky top-0">
          <MagAvatar />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {chunks.map((c, i) => (
          <div
            key={i}
            className="max-w-[78%] animate-fade-in self-start rounded-[18px] rounded-tl-[6px] px-4 py-2.5 text-[15.5px] leading-[1.5]"
            style={{
              background: MAG_DARK_BUBBLE,
              color: MAG_DARK_TEXT,
              border: `1px solid ${MAG_DARK_BORDER}`,
            }}
          >
            {renderBold(c)}
          </div>
        ))}
        <BubbleTime time={time} />
      </div>
    </div>
  );
}

export function UserBubble({ text, time }: { text: string; time?: string }) {
  return (
    <div className="flex flex-col items-end">
      <div
        className="max-w-[78%] animate-fade-in rounded-[18px] rounded-br-[6px] px-4 py-2.5 text-[15.5px] leading-[1.5]"
        style={{
          background: MAG_BLUE,
          color: "#FFFFFF",
        }}
      >
        {text.split("\n").map((line, i) => (
          <p key={i} className={i > 0 ? "mt-1.5" : ""}>
            {line}
          </p>
        ))}
      </div>
      <BubbleTime time={time} align="right" />
    </div>
  );
}

export function TypingBubble({ label = "MAG está digitando…" }: { label?: string }) {
  return (
    <div className="flex animate-fade-in gap-2.5">
      <MagAvatar />
      <div
        className="flex items-center gap-2 rounded-[18px] rounded-tl-[6px] px-4 py-3"
        style={{ background: MAG_DARK_BUBBLE, border: `1px solid ${MAG_DARK_BORDER}` }}
      >
        <span className="flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:0ms]"
            style={{ background: "#5B7CFF" }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:150ms]"
            style={{ background: "#5B7CFF" }}
          />
          <span
            className="h-1.5 w-1.5 animate-bounce rounded-full [animation-delay:300ms]"
            style={{ background: "#5B7CFF" }}
          />
        </span>
        <span className="text-[13px]" style={{ color: MAG_DARK_MUTED }}>
          {label}
        </span>
      </div>
    </div>
  );
}

export function MagComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  sending,
  placeholder = "Fale com a MAG",
  autoFocusKey,
  onFiles,
  attachmentsSlot,
  canSend,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  sending?: boolean;
  placeholder?: string;
  autoFocusKey?: unknown;
  onFiles?: (files: File[]) => void;
  attachmentsSlot?: ReactNode;
  canSend?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const baseRef = useRef("");

  useEffect(() => {
    if (!disabled && !sending) ref.current?.focus();
  }, [disabled, sending, autoFocusKey]);

  useEffect(() => () => recRef.current?.stop?.(), []);

  function toggleVoice() {
    if (listening) {
      recRef.current?.stop?.();
      return;
    }
    const Ctor =
      typeof window !== "undefined"
        ? ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition)
        : null;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    baseRef.current = value ? `${value} ` : "";
    rec.onresult = (e: any) => {
      let out = "";
      for (let i = 0; i < e.results.length; i += 1) out += e.results[i][0].transcript;
      onChange(baseRef.current + out);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  const enabled = canSend ?? !!value.trim();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        recRef.current?.stop?.();
        onSubmit();
      }}
      className="px-4 pb-4 pt-1 sm:px-8"
      style={{ background: "transparent" }}
    >
      <div className="mx-auto max-w-[640px]">
        {attachmentsSlot}
        <div
          className="mt-2 flex min-h-[52px] items-end gap-1.5 rounded-[24px] px-2 py-1.5 transition-all"
          style={{
            border: `1px solid ${focused ? MAG_BLUE : MAG_DARK_BORDER}`,
            background: "var(--mag-surface)",
            boxShadow: "none",
          }}
        >
          {onFiles && <AttachButton onFiles={onFiles} disabled={disabled} />}
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit();
              }
            }}
            rows={1}
            disabled={disabled}
            placeholder={placeholder}
            className="max-h-[120px] min-h-[24px] w-full resize-none bg-transparent py-2 text-[15px] leading-relaxed placeholder:text-[#5E6E96] focus:outline-none focus:shadow-none focus-visible:shadow-none disabled:opacity-40"
            style={{ color: MAG_DARK_TEXT, caretColor: MAG_BLUE, ["--shadow-focus" as never]: "none" }}
          />
          <button
            type="button"
            onClick={toggleVoice}
            disabled={disabled}
            aria-label={listening ? "Parar ditado" : "Falar"}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full transition active:opacity-70 disabled:opacity-30"
            style={
              listening
                ? { background: MAG_BLUE, color: "#FFFFFF" }
                : { color: MAG_DARK_MUTED, background: "transparent" }
            }
          >
            {listening ? <Square className="h-3.5 w-3.5" /> : <Mic className="h-4 w-4" strokeWidth={1.8} />}
          </button>
          <button
            type="submit"
            disabled={!enabled || sending || disabled}
            aria-label="Enviar"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white transition disabled:cursor-not-allowed disabled:opacity-30"
            style={{ background: MAG_BLUE }}
          >
            <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </form>
  );
}


/** Revelação progressiva dos balões da MAG, com ritmo de digitação. */
export function useProgressiveReveal(
  messages: Array<{ id: string; role: string }>,
  textOf: (m: { id: string; role: string }) => string,
  isStreaming: boolean,
  preRevealed: string[] = [],
) {
  const [revealed, setRevealed] = useState<Record<string, number>>({});

  useEffect(() => {
    if (preRevealed.length === 0) return;
    setRevealed((prev) => {
      const next = { ...prev };
      for (const id of preRevealed) next[id] = 999;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preRevealed.join("|")]);

  useEffect(() => {
    if (isStreaming) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const chunks = splitChunks(textOf(last));
    const shown = revealed[last.id] ?? 0;
    if (shown >= chunks.length) return;
    const delay = shown === 0 ? 900 : 800 + Math.min(chunks[shown]?.length ?? 0, 90) * 6;
    const t = setTimeout(() => {
      setRevealed((prev) => ({ ...prev, [last.id]: (prev[last.id] ?? 0) + 1 }));
    }, Math.min(delay, 1500));
    return () => clearTimeout(t);
  }, [messages, revealed, isStreaming, textOf]);

  return revealed;
}