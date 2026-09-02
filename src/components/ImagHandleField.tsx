import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import {
  checkHandleAvailable,
  isValidHandleBody,
  normalizeHandleBody,
  suggestHandles,
} from "@/lib/handle.functions";

type Status = "idle" | "checking" | "available" | "taken" | "invalid" | "error";

export type ImagHandleFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onStatusChange?: (status: Status) => void;
  autoFocus?: boolean;
  disabled?: boolean;
  suggestFrom?: string; // seed for suggestions (e.g. full name / email)
  currentHandle?: string | null; // identidade atual do próprio usuário
  label?: string;
  helper?: string;
};

/**
 * Campo padronizado para "Sua identidade iMAG".
 * Prefixo `im.` fixo; usuário digita apenas o complemento.
 * Faz normalização, checagem de disponibilidade em tempo real
 * e sugere alternativas quando indisponível.
 */
export function ImagHandleField({
  value,
  onChange,
  onStatusChange,
  autoFocus,
  disabled,
  suggestFrom,
  currentHandle,
  label = "Sua identidade iMAG",
  helper = "Seu identificador exclusivo dentro da iMAG.",
}: ImagHandleFieldProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => onStatusChange?.(status), [status, onStatusChange]);

  const normalized = value;
  const preview = normalized.length > 0 ? `im.${normalized}` : "im.";

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSuggestions([]);
    if (!normalized) {
      setStatus("idle");
      return;
    }
    if (!isValidHandleBody(normalized)) {
      setStatus("invalid");
      return;
    }
    // Mantendo a própria identidade atual: sempre disponível.
    if (currentHandle && normalized === currentHandle) {
      setStatus("available");
      return;
    }
    setStatus("checking");
    let cancelled = false;
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await checkHandleAvailable({ data: { handle: normalized } });
        if (cancelled) return;
        if (res.error) {
          if (import.meta.env.DEV) {
            console.warn("[iMAG handle] verificação falhou", {
              handle: normalized,
              code: res.code,
              message: res.error,
            });
          }
          setStatus("error");
          autoRetryRef.current = setTimeout(() => setAttempt((n) => n + 1), 4000);
          return;
        }
        if (res.available) {
          setStatus("available");
        } else {
          setStatus("taken");
          try {
            const { suggestions } = await suggestHandles({
              data: { base: suggestFrom || normalized },
            });
            if (!cancelled) setSuggestions(suggestions.slice(0, 3));
          } catch {
            /* ignore */
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (import.meta.env.DEV) {
          console.warn("[iMAG handle] erro de rede/autenticação na verificação", err);
        }
        setStatus("error");
        // Reconsulta automaticamente em alguns segundos.
        autoRetryRef.current = setTimeout(() => setAttempt((n) => n + 1), 4000);
      }
    }, 500);
    return () => {
      cancelled = true;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (autoRetryRef.current) clearTimeout(autoRetryRef.current);
    };
  }, [normalized, suggestFrom, currentHandle, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const helperText = useMemo(() => {
    if (status === "invalid" && normalized.length > 0)
      return "Use apenas letras, números, ponto ou underline (3 a 30 caracteres).";
    if (status === "taken") return "Essa identidade já está em uso. Escolha outra.";
    if (status === "available") return `${preview} está disponível.`;
    if (status === "error") return "Não conseguimos verificar agora.";
    if (status === "checking") return "Verificando disponibilidade…";
    return helper;
  }, [status, helper, preview, normalized.length]);

  const helperColor =
    status === "invalid" || status === "taken" || status === "error"
      ? "#C0453B"
      : status === "available"
        ? "#177245"
        : "#667085";

  return (
    <div className="w-full">
      <label className="mb-1.5 block text-[13px] font-medium text-neutral-800">
        {label}
      </label>
      <div
        className="flex items-center gap-1 rounded-[14px] border bg-white px-3.5 py-3 transition focus-within:border-[color:var(--blue)]"
        style={{ borderColor: "#E4E7EC" }}
      >
        <span className="select-none text-[15px] font-medium text-neutral-400">im.</span>
        <input
          type="text"
          value={normalized}
          onChange={(e) => onChange(normalizeHandleBody(e.target.value))}
          onPaste={(e) => {
            e.preventDefault();
            const t = e.clipboardData.getData("text");
            onChange(normalizeHandleBody(t.replace(/^im\./i, "")));
          }}
          disabled={disabled}
          autoFocus={autoFocus}
          inputMode="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="brunathais ou dra.bruna"
          className="flex-1 bg-transparent text-[15px] text-neutral-900 outline-none placeholder:text-neutral-400"
        />
        <StatusIcon status={status} />
      </div>
      <p className="mt-1.5 text-[12.5px]" style={{ color: helperColor }}>
        {helperText}
      </p>
      {status === "error" && (
        <button
          type="button"
          onClick={retry}
          className="mt-2 text-[12.5px] font-medium text-[color:var(--blue)] underline underline-offset-2"
        >
          Tentar novamente
        </button>
      )}
      {status === "taken" && suggestions.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              className="rounded-full border border-[color:var(--blue-tint)] bg-[color:var(--blue-tint)] px-3 py-1 text-[12.5px] font-medium text-[color:var(--blue)] transition hover:brightness-95"
            >
              im.{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "checking")
    return <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />;
  if (status === "available")
    return <Check className="h-4 w-4" style={{ color: "#177245" }} />;
  if (status === "error")
    return <AlertCircle className="h-4 w-4" style={{ color: "#C0453B" }} />;
  if (status === "taken" || status === "invalid")
    return <X className="h-4 w-4" style={{ color: "#C0453B" }} />;
  return null;
}