import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { Check, Plus, Trash2 } from "lucide-react";
import { haptic } from "@/lib/haptics";
import type { DirectionFormat } from "@/lib/mag/direction-format";
import {
  deleteDirectionResponse,
  getDirectionResponse,
  saveDirectionResponse,
  type DirectionResponseContent,
} from "@/lib/direction-responses.functions";

const WHITE_FIELD = "rgba(255,255,255,0.14)";
/** Campo sólido branco — legibilidade sobre o azul do card. */
const SOLID_FIELD = {
  background: "#FFFFFF",
  border: "1px solid #E6E8EE",
  boxShadow: "0 1px 2px rgba(17,17,17,0.04)",
} as const;
const INK = "#111111";
const BLUE = "#335CFF";

type Item = { label: string; value: string };

function emptyItems(min: number): Item[] {
  return Array.from({ length: Math.max(min, 1) }, () => ({ label: "", value: "" }));
}

/**
 * Resposta interna a uma direção — o usuário escreve dentro do próprio iMAG.
 * Renderizado somente com o card da direção expandido.
 */
export function DirectionResponse({
  planId,
  directionTitle,
  format,
  done,
  onCompleted,
}: {
  planId: string;
  directionTitle: string;
  format: DirectionFormat;
  done: boolean;
  onCompleted: (awarded: boolean) => void;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchResponse = useServerFn(getDirectionResponse);
  const save = useServerFn(saveDirectionResponse);
  const remove = useServerFn(deleteDirectionResponse);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const { data: saved, isLoading } = useQuery({
    queryKey: ["direction-response", planId],
    queryFn: () => fetchResponse({ data: { plan_id: planId } }),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const minItems = format.group?.min ?? 2;
  const [items, setItems] = useState<Item[]>(() => emptyItems(minItems));
  const [text, setText] = useState("");
  const [choice, setChoice] = useState<string | null>(null);
  const [skipValues, setSkipValues] = useState(false);
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (!saved) return;
    const c = saved.content ?? {};
    if (c.items?.length) {
      setItems(c.items.map((i) => ({ label: i.label, value: i.value ?? "" })));
    }
    if (typeof c.text === "string") setText(c.text);
    if (typeof c.choice === "string") setChoice(c.choice);
    if (c.skip_values) setSkipValues(true);
  }, [saved]);

  const hasValues = Boolean(format.group?.fields.some((f) => f.sensitive));

  const filled = useMemo(() => {
    if (format.kind === "quick") return Boolean(choice);
    if (format.group) return items.filter((i) => i.label.trim().length > 1).length >= minItems;
    return text.trim().length > 2;
  }, [format, items, text, choice, minItems]);

  const content: DirectionResponseContent = useMemo(() => {
    if (format.kind === "quick") return { kind: "quick", choice };
    if (format.group) {
      return {
        kind: format.template === "expenses" ? "expenses" : "list",
        items: items
          .filter((i) => i.label.trim())
          .map((i) => ({ label: i.label.trim(), value: skipValues ? null : i.value.trim() || null })),
        skip_values: skipValues,
      };
    }
    return { kind: "reflection", text: text.trim() };
  }, [format, items, text, choice, skipValues]);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          plan_id: planId,
          direction_title: directionTitle,
          life_area: format.lifeArea,
          content,
          complete: true,
        },
      }),
    onSuccess: (res) => {
      haptic([10, 40, 14]);
      setEditing(false);
      setJustSaved(true);
      qc.invalidateQueries({ queryKey: ["direction-response", planId] });
      qc.invalidateQueries({ queryKey: ["today-meta"] });
      qc.invalidateQueries({ queryKey: ["current-plan"] });
      qc.invalidateQueries({ queryKey: ["goal-history"] });
      qc.invalidateQueries({ queryKey: ["active-circle"] });
      qc.invalidateQueries({ queryKey: ["magnetic-field"] });
      onCompleted(res?.awarded === true);
    },
    onError: (err) => {
      console.error("[direction-response] falha ao salvar", err);
    },
  });

  const removal = useMutation({
    mutationFn: () => remove({ data: { plan_id: planId } }),
    onSuccess: () => {
      setItems(emptyItems(minItems));
      setText("");
      setChoice(null);
      setSkipValues(false);
      setJustSaved(false);
      setEditing(true);
      qc.invalidateQueries({ queryKey: ["direction-response", planId] });
    },
  });

  function talkToMag() {
    haptic(6);
    const summary =
      content.items?.map((i) => (i.value ? `${i.label} (${i.value})` : i.label)).join(", ") ||
      content.text ||
      content.choice ||
      "";
    try {
      sessionStorage.setItem(
        "mag_prefill",
        `Sobre a direção "${directionTitle}", registrei: ${summary}. Pode me ajudar a pensar nisso?`,
      );
    } catch {
      /* sessionStorage indisponível */
    }
    navigate({ to: "/mentor" });
  }

  if (isLoading) {
    return <div className="mt-3 h-[76px] animate-pulse rounded-[16px]" style={{ background: WHITE_FIELD }} />;
  }

  /* Modo leitura — resposta já salva. */
  if (saved && !editing) {
    return (
      <div className="mt-3.5">
        {justSaved && (
          <p className="mb-2.5 text-[13px] font-medium leading-[1.45] text-white">
            Entendi. Vou considerar essas informações nas suas próximas direções
            {format.lifeArea === "financas" ? " financeiras" : ""}.
          </p>
        )}
        <div className="rounded-[16px] px-3.5 py-3" style={{ background: WHITE_FIELD }}>
          {saved.content?.items?.length ? (
            <ul className="space-y-1.5">
              {saved.content.items.map((i, idx) => (
                <li key={idx} className="text-[13px] font-light leading-[1.4] text-white/90">
                  {i.label}
                  {i.value ? ` — ${i.value}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="whitespace-pre-line text-[13px] font-light leading-[1.5] text-white/90">
              {saved.content?.text || saved.content?.choice}
            </p>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={() => {
              haptic(6);
              setEditing(true);
            }}
            className="text-[12.5px] font-medium text-white transition active:opacity-70"
          >
            Editar resposta
          </button>
          <button
            type="button"
            disabled={removal.isPending}
            onClick={() => {
              haptic(6);
              removal.mutate();
            }}
            className="flex items-center gap-1 text-[12.5px] font-light text-white/75 transition active:opacity-70"
          >
            <Trash2 className="h-[13px] w-[13px]" strokeWidth={1.8} /> Excluir
          </button>
          <button
            type="button"
            onClick={talkToMag}
            className="ml-auto text-[12.5px] font-light text-white/85 underline underline-offset-2 transition active:opacity-70"
          >
            Conversar com a MAG sobre isso
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3.5">
      <p className="text-[11.5px] font-light leading-[1.4] text-white/70">
        Suas respostas ajudam a MAG a personalizar suas próximas direções.
      </p>

      {format.kind === "quick" ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {(format.options ?? []).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                haptic(6);
                setChoice(opt.value);
              }}
              className="rounded-full px-3.5 py-2 text-[13px] font-medium transition active:scale-[0.98]"
              style={{
                background: choice === opt.value ? "#FFFFFF" : "rgba(255,255,255,0.18)",
                color: choice === opt.value ? "#335CFF" : "#FFFFFF",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : format.group ? (
        <div className="mt-3 space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-[16px] px-3.5 py-3" style={SOLID_FIELD}>
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.1em]"
                style={{ color: BLUE }}
              >
                {format.group!.label} {idx + 1}
              </p>
              <input
                value={item.label}
                onChange={(e) =>
                  setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, label: e.target.value } : it)))
                }
                placeholder={format.group!.fields[0]?.placeholder ?? "Sua resposta"}
                aria-label={`${format.group!.label} ${idx + 1} — ${format.group!.fields[0]?.label}`}
                className="mt-1.5 w-full bg-transparent text-[15px] font-normal outline-none placeholder:text-[#9AA0AB]"
                style={{ color: INK }}
              />
              {hasValues && !skipValues && (
                <input
                  value={item.value}
                  inputMode="decimal"
                  onChange={(e) =>
                    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, value: e.target.value } : it)))
                  }
                  placeholder="Valor (opcional)"
                  aria-label={`Valor do ${format.group!.label.toLowerCase()} ${idx + 1}`}
                  className="mt-2 w-full bg-transparent text-[13.5px] font-normal outline-none placeholder:text-[#9AA0AB]"
                  style={{ color: "#4A4F58" }}
                />
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => {
              haptic(6);
              setItems((arr) => [...arr, { label: "", value: "" }]);
            }}
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-white transition active:opacity-70"
          >
            <Plus className="h-[14px] w-[14px]" strokeWidth={2} />
            {format.template === "expenses" ? "Adicionar outro gasto" : "Adicionar outro item"}
          </button>

          {hasValues && (
            <button
              type="button"
              onClick={() => {
                haptic(4);
                setSkipValues((v) => !v);
              }}
              className="block text-[11.5px] font-light text-white/65 transition active:opacity-70"
            >
              {skipValues ? "Informar valores" : (format.optOutLabel ?? "Prefiro não informar valores")}
            </button>
          )}
        </div>
      ) : (
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={format.fields?.[0]?.placeholder ?? "Escreva aqui"}
          aria-label={format.fields?.[0]?.label ?? "Sua resposta"}
          className="mt-3 w-full resize-none rounded-[16px] px-3.5 py-3 text-[15px] font-normal outline-none placeholder:text-[#9AA0AB]"
          style={{ ...SOLID_FIELD, color: INK }}
        />
      )}

      <button
        type="button"
        disabled={!filled || mutation.isPending}
        onClick={() => {
          haptic(8);
          mutation.mutate();
          bottomRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }}
        className="mt-4 w-full rounded-full px-4 py-3 text-[14px] font-semibold transition active:opacity-80"
        style={
          !filled || mutation.isPending
            ? { background: "rgba(255,255,255,0.72)", color: "#8A8F98" }
            : { background: "#FFFFFF", color: BLUE }
        }
      >
        {mutation.isPending ? "Salvando…" : done ? "Salvar resposta" : "Salvar e concluir"}
      </button>
      {mutation.isError && (
        <p className="mt-2 text-[12px] font-light text-white/80">
          Não consegui salvar agora. Tente novamente.
        </p>
      )}
      <div ref={bottomRef} className="h-[env(safe-area-inset-bottom)]" />

      <AnimatePresence>
        {justSaved && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-white"
          >
            <Check className="h-[13px] w-[13px]" strokeWidth={3} /> Resposta registrada.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
