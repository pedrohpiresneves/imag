import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Mic, Plus, Trash2 } from "lucide-react";
import { haptic } from "@/lib/haptics";
import type { InteractionConfig, InteractionField, LifeArea } from "@/lib/mag/interaction";
import {
  deleteDirectionResponse,
  getDirectionResponse,
  saveDirectionResponse,
  type DirectionResponseContent,
} from "@/lib/direction-responses.functions";

const WHITE_FIELD = {
  background: "#FFFFFF",
  border: `1px solid #D9E0FA`,
  boxShadow: "0 1px 2px rgba(17,17,17,0.03)",
} as const;
const SOLID_FIELD = {
  background: "#FFFFFF",
  border: "1px solid #E6E8EE",
  boxShadow: "0 1px 2px rgba(17,17,17,0.04)",
} as const;
const INK = "#111111";
const BLUE = "#335CFF";
const MUTED = "#7A7A80";

type Row = { key: string; label: string; type: InteractionField["type"]; value: string; required: boolean; placeholder?: string };

function inputMode(type: InteractionField["type"]): "text" | "decimal" | "numeric" {
  if (type === "currency") return "decimal";
  if (type === "number" || type === "duration") return "numeric";
  return "text";
}

function htmlType(type: InteractionField["type"]): string {
  if (type === "date") return "date";
  if (type === "time") return "time";
  return "text";
}

/**
 * Interface de execução adaptativa: renderizada a partir do `interaction_config`
 * salvo na direção — nunca por checagem de palavras no momento do render.
 */
export function DirectionInteraction({
  planId,
  directionTitle,
  lifeArea,
  config,
  done,
  onCompleted,
  ensureStarted,
  completeOnSave = true,
}: {
  planId: string;
  directionTitle: string;
  lifeArea: LifeArea;
  config: InteractionConfig;
  done: boolean;
  onCompleted: (awarded: boolean) => void;
  /** Garante que a direção foi iniciada antes de salvar (estado pendente). */
  ensureStarted?: () => Promise<unknown>;
  /** Quando falso, salvar apenas registra a resposta — o status vem no check-in. */
  completeOnSave?: boolean;
}) {
  const qc = useQueryClient();
  const fetchResponse = useServerFn(getDirectionResponse);
  const save = useServerFn(saveDirectionResponse);
  const remove = useServerFn(deleteDirectionResponse);

  const { data: saved, isLoading } = useQuery({
    queryKey: ["direction-response", planId],
    queryFn: () => fetchResponse({ data: { plan_id: planId } }),
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const initialRows = useMemo<Row[]>(
    () =>
      config.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type,
        value: "",
        required: f.required,
        ...(f.placeholder ? { placeholder: f.placeholder } : {}),
      })),
    [config],
  );

  const [rows, setRows] = useState<Row[]>(initialRows);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [selection, setSelection] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  /* Ditado por voz — usa o reconhecimento nativo do navegador quando existe. */
  const SpeechRec = useMemo(
    () =>
      typeof window !== "undefined"
        ? ((window as unknown as Record<string, unknown>).SpeechRecognition ??
          (window as unknown as Record<string, unknown>).webkitSpeechRecognition)
        : null,
    [],
  );
  const recRef = useRef<{ stop: () => void } | null>(null);
  const [recording, setRecording] = useState<string | null>(null);

  function toggleDictation(rowKey: string, idx: number) {
    if (!SpeechRec) return;
    haptic(5);
    if (recording) {
      recRef.current?.stop();
      return;
    }
    const rec = new (SpeechRec as new () => any)();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      const t = Array.from(e.results as ArrayLike<ArrayLike<{ transcript: string }>>)
        .map((r) => r[0].transcript)
        .join(" ")
        .trim();
      if (t) {
        setRows((arr) =>
          arr.map((r, i) => (i === idx ? { ...r, value: r.value ? `${r.value} ${t}` : t } : r)),
        );
      }
    };
    rec.onend = () => setRecording(null);
    rec.onerror = () => setRecording(null);
    recRef.current = rec;
    setRecording(rowKey);
    rec.start();
  }

  useEffect(() => setRows(initialRows), [initialRows]);

  useEffect(() => {
    if (!saved?.content) return;
    const c = saved.content;
    if (c.items?.length) {
      setRows((prev) =>
        prev.map((r, i) => ({ ...r, value: c.items?.[i]?.value ?? c.items?.[i]?.label ?? r.value })),
      );
    }
    if (c.choices?.length) setSelection(c.choices);
    else if (c.choice) setSelection([c.choice]);
  }, [saved]);

  const isChecklist = config.type === "checklist";
  const selectionOptions = config.selection?.options ?? [];
  /* Seleção sobre os próprios campos preenchidos (prioridade). */
  const fieldOptions = rows.filter((r) => r.type !== "checkbox" && r.value.trim().length > 1);

  const requiredFilled = rows
    .filter((r) => r.required && r.type !== "checkbox")
    .every((r) => r.value.trim().length > 0);
  const checklistDone = !isChecklist || rows.every((r) => checked[r.key]);
  const selectionOk =
    !config.selection?.required || selection.length >= 1;
  const canComplete = requiredFilled && checklistDone && selectionOk;

  const content: DirectionResponseContent = useMemo(() => {
    const items = rows
      .filter((r) => r.type !== "checkbox")
      .map((r) => ({ label: r.label, value: r.value.trim() || null }))
      .filter((i) => i.value);
    const checks = rows.filter((r) => r.type === "checkbox" && checked[r.key]).map((r) => ({ label: r.label, value: "feito" }));
    return {
      kind: "structured",
      interaction_type: config.type,
      items: [...items, ...checks],
      choices: selection,
      text:
        rows.length === 1 && rows[0]?.type === "text"
          ? rows[0].value.trim() || null
          : null,
    };
  }, [rows, checked, selection, config.type]);

  const mutation = useMutation({
    mutationFn: async () => {
      /* Resposta a partir do estado pendente: marca o início antes de salvar. */
      if (ensureStarted) await ensureStarted();
      return save({
        data: {
          plan_id: planId,
          direction_title: directionTitle,
          life_area: lifeArea,
          content,
          /* Direção que pede resposta: salvar já conclui e concede os magnetos. */
          complete: completeOnSave && !done,
        },
      });
    },
    onSuccess: (res) => {
      haptic([10, 40, 14]);
      setEditing(false);
      setJustSaved(true);
      qc.invalidateQueries({ queryKey: ["direction-response", planId] });
      qc.invalidateQueries({ queryKey: ["today-meta"] });
      qc.invalidateQueries({ queryKey: ["current-plan"] });
      qc.invalidateQueries({ queryKey: ["goal-history"] });
      qc.invalidateQueries({ queryKey: ["magnetic-field"] });
      onCompleted(res?.awarded === true);
    },
    onError: (err) => console.error("[direction-interaction] falha ao salvar", err),
  });

  const removal = useMutation({
    mutationFn: () => remove({ data: { plan_id: planId } }),
    onSuccess: () => {
      setRows(initialRows);
      setChecked({});
      setSelection([]);
      setJustSaved(false);
      setEditing(true);
      qc.invalidateQueries({ queryKey: ["direction-response", planId] });
    },
  });


  if (isLoading) {
    return <div className="mt-3 h-[76px] animate-pulse rounded-[16px]" style={WHITE_FIELD} />;
  }

  if (saved && !editing) {
    const resumo =
      saved.content?.text?.trim() ||
      (saved.content?.items ?? [])
        .map((i) => (i.value && i.value !== "feito" ? i.value : i.label))
        .filter(Boolean)
        .join(", ");

    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => {
            haptic(5);
            setDetailsOpen((v) => !v);
          }}
          aria-expanded={detailsOpen}
          className="flex w-full items-center gap-2 rounded-[14px] px-3.5 py-2.5 text-left"
          style={SOLID_FIELD}
        >
          <span
            className={`min-w-0 flex-1 text-[13.5px] font-normal leading-[1.4] ${detailsOpen ? "" : "truncate"}`}
            style={{ color: INK }}
          >
            <span style={{ color: MUTED }}>Registrado: </span>
            {resumo}
          </span>
          <ChevronDown
            className="h-[16px] w-[16px] shrink-0 transition-transform duration-300"
            strokeWidth={1.8}
            style={{ color: MUTED, transform: detailsOpen ? "rotate(180deg)" : "none" }}
          />
        </button>

        <AnimatePresence initial={false}>
          {detailsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 flex items-center gap-4 px-1">
                <button
                  type="button"
                  onClick={() => {
                    haptic(6);
                    setDetailsOpen(false);
                    setEditing(true);
                  }}
                  className="text-[12.5px] font-medium transition active:opacity-70"
                  style={{ color: BLUE }}
                >
                  Editar
                </button>
                <button
                  type="button"
                  disabled={removal.isPending}
                  onClick={() => {
                    haptic(6);
                    removal.mutate();
                  }}
                  className="flex items-center gap-1 text-[12.5px] font-light transition active:opacity-70"
                  style={{ color: MUTED }}
                >
                  <Trash2 className="h-[13px] w-[13px]" strokeWidth={1.8} /> Excluir
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }


  const toggleSelection = (value: string) => {
    haptic(6);
    setSelection((prev) => {
      if (config.selection?.type === "multiple") {
        return prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value];
      }
      return prev[0] === value ? [] : [value];
    });
  };

  return (
    <div className="mt-3.5">
      {config.helper && (
        <p className="text-[11.5px] font-light leading-[1.4]" style={{ color: MUTED }}>{config.helper}</p>
      )}

      {rows.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {rows.map((row, idx) =>
            row.type === "checkbox" ? (
              <button
                key={row.key}
                type="button"
                onClick={() => {
                  haptic(5);
                  setChecked((c) => ({ ...c, [row.key]: !c[row.key] }));
                }}
                className="flex w-full items-center gap-2.5 rounded-[16px] px-3.5 py-3 text-left"
                style={WHITE_FIELD}
              >
                <span
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                  style={{
                    background: checked[row.key] ? "#FFFFFF" : "rgba(51,92,255,0.08)",
                    border: checked[row.key] ? `1px solid ${BLUE}` : "1px solid rgba(51,92,255,0.14)",
                  }}
                >
                  {checked[row.key] && <Check className="h-3 w-3" strokeWidth={3} style={{ color: BLUE }} />}
                </span>
                <span className="text-[13.5px] font-medium" style={{ color: INK }}>{row.label}</span>
              </button>
            ) : (
              <div key={row.key} className="rounded-[14px] px-3.5 py-2.5" style={SOLID_FIELD}>
                {/^\s*(item\s*\d+|sua resposta|resposta)\s*$/i.test(row.label) ? null : (
                  <label
                    htmlFor={`${planId}-${row.key}`}
                    className="text-[12px] font-normal"
                    style={{ color: MUTED }}
                  >
                    {row.label}
                  </label>
                )}
                {row.type === "text" ? (
                  <div className="relative">
                    <textarea
                      id={`${planId}-${row.key}`}
                      value={row.value}
                      rows={1}
                      onInput={(e) => {
                        const el = e.currentTarget;
                        el.style.height = "auto";
                        el.style.height = `${Math.min(112, Math.max(44, el.scrollHeight))}px`;
                      }}
                      onChange={(e) =>
                        setRows((arr) =>
                          arr.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)),
                        )
                      }
                      placeholder={row.placeholder ?? row.label ?? "Escreva sua resposta"}
                      className="w-full resize-none overflow-y-auto bg-transparent pr-9 text-[14px] font-normal leading-[1.45] outline-none placeholder:text-[#9AA0AB]"
                      style={{ color: INK, height: 44, maxHeight: 112 }}
                    />


                    {SpeechRec ? (
                      <button
                        type="button"
                        onClick={() => toggleDictation(row.key, idx)}
                        aria-label={recording === row.key ? "Parar ditado" : "Ditar por voz"}
                        className="absolute right-0 bottom-0.5 grid h-8 w-8 place-items-center rounded-full transition active:opacity-70"
                        style={{ background: recording === row.key ? "#FEE2E2" : "#F1F4FF" }}
                      >
                        <Mic
                          className="h-[15px] w-[15px]"
                          strokeWidth={1.9}
                          style={{ color: recording === row.key ? "#DC2626" : BLUE }}
                        />
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <input
                    id={`${planId}-${row.key}`}
                    value={row.value}
                    type={htmlType(row.type)}
                    inputMode={inputMode(row.type)}
                    onChange={(e) =>
                      setRows((arr) => arr.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))
                    }
                    placeholder={row.placeholder ?? (row.required ? "Sua resposta" : "Opcional")}
                    className="mt-1 w-full bg-transparent text-[15px] font-normal outline-none placeholder:text-[#9AA0AB]"
                    style={{ color: INK }}
                  />
                )}
              </div>
            ),
          )}
        </div>
      )}

      {config.allow_add && rows.filter((r) => r.type !== "checkbox").length < config.max_fields && (
        <div className="mt-2.5 flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              haptic(6);
              setRows((arr) => [
                ...arr,
                {
                  key: `extra_${arr.length + 1}`,
                  label: `Item ${arr.length + 1}`,
                  type: "text",
                  value: "",
                  required: false,
                },
              ]);
            }}
            className="flex items-center gap-1.5 text-[12.5px] font-medium transition active:opacity-70"
            style={{ color: BLUE }}
          >
            <Plus className="h-[14px] w-[14px]" strokeWidth={2} /> Adicionar item
          </button>
          {rows.length > config.min_fields && (
            <button
              type="button"
              onClick={() => {
                haptic(4);
                setRows((arr) => arr.slice(0, -1));
              }}
              className="text-[12.5px] font-light transition active:opacity-70"
              style={{ color: MUTED }}
            >
              Remover último
            </button>
          )}
        </div>
      )}

      {config.selection && (
        <div className="mt-4">
          <p className="text-[12.5px] font-medium" style={{ color: INK }}>{config.selection.label}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {(selectionOptions.length ? selectionOptions : fieldOptions.map((r) => ({ value: r.value.trim(), label: r.value.trim() }))).map(
              (opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleSelection(opt.value)}
                  className="max-w-full rounded-full px-3.5 py-2 text-left text-[13px] font-medium transition active:scale-[0.98]"
                  style={{
                    background: selection.includes(opt.value) ? "#FFFFFF" : "rgba(51,92,255,0.08)",
                    color: selection.includes(opt.value) ? BLUE : INK,
                    border: selection.includes(opt.value) ? `1px solid ${BLUE}` : "1px solid transparent",
                  }}
                >
                  {opt.label}
                </button>
              ),
            )}
          </div>
          {!selectionOptions.length && !fieldOptions.length && (
            <p className="mt-1.5 text-[11.5px] font-light" style={{ color: MUTED }}>
              Preencha os campos acima para escolher.
            </p>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-center">
        <button
          type="button"
          disabled={!canComplete || mutation.isPending}
          onClick={() => {
            haptic(8);
            mutation.mutate();
          }}
          className="h-[42px] rounded-full px-6 text-[14px] font-semibold transition active:opacity-80"
          style={
            !canComplete || mutation.isPending
              ? { background: "rgba(51,92,255,0.08)", color: "#8A8F98" }
              : { background: BLUE, color: "#FFFFFF" }
          }
        >
          {mutation.isPending
            ? "Salvando…"
            : done
              ? "Salvar resposta"
              : completeOnSave
                ? config.completion_label
                : "Salvar e continuar"}
        </button>
      </div>
      {mutation.isError && (
        <p className="mt-2 text-[12px] font-light" style={{ color: "#DC2626" }}>
          Não consegui salvar agora. Tente novamente.
        </p>
      )}
      <div className="h-[env(safe-area-inset-bottom)]" />

      <AnimatePresence>
        {justSaved && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium"
            style={{ color: INK }}
          >
            <Check className="h-[13px] w-[13px]" strokeWidth={3} style={{ color: "#2FA36B" }} /> Resposta registrada.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
