import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, Pencil, Undo2, Check } from "lucide-react";
import {
  createPlanningItem,
  deletePlanningItem,
  updatePlanningItem,
  type PlanKind,
} from "@/lib/planning.functions";
import { MAG_BLUE, MAG_DARK_BORDER, MAG_DARK_MUTED, MAG_DARK_TEXT } from "@/components/mag-chat";

export type PlanToolItem = {
  id: string;
  kind: string;
  title: string;
  info?: string | null;
  date?: string | null;
  time?: string | null;
};

export type PlanToolResult = {
  ok?: boolean;
  action?: "created" | "updated" | "deleted" | "searched";
  items?: PlanToolItem[];
  previous?: PlanToolItem[];
};

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatWhen(date?: string | null, time?: string | null) {
  if (!date) return time ? `às ${time}` : "sem data";
  const [y, m, d] = date.split("-").map(Number);
  const label = `${d} de ${MONTHS[(m ?? 1) - 1]}`;
  return time ? `${label} · ${time}` : label;
}

/** Cartão compacto com as ações após a MAG salvar algo no Planejamento. */
export function PlanActionCard({ result }: { result: PlanToolResult }) {
  const qc = useQueryClient();
  const createFn = useServerFn(createPlanningItem);
  const updateFn = useServerFn(updatePlanningItem);
  const deleteFn = useServerFn(deletePlanningItem);
  const [undone, setUndone] = useState(false);
  const [busy, setBusy] = useState(false);

  const action = result.action;
  if (!result.ok || !action || action === "searched") return null;

  const shown = action === "deleted" ? (result.previous ?? []) : (result.items ?? []);
  if (shown.length === 0) return null;
  const first = shown[0]!;

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["planning"] });
    void qc.invalidateQueries({ queryKey: ["day-panel"] });
    void qc.invalidateQueries({ queryKey: ["day-context"] });
  }

  async function undo() {
    if (busy) return;
    setBusy(true);
    try {
      if (action === "created") {
        for (const i of result.items ?? []) await deleteFn({ data: { id: i.id } });
      } else if (action === "updated") {
        for (const p of result.previous ?? []) {
          await updateFn({
            data: { id: p.id, title: p.title, date: p.date ?? null, time: p.time ?? null },
          });
        }
      } else if (action === "deleted") {
        for (const p of result.previous ?? []) {
          await createFn({
            data: {
              kind: (p.kind as PlanKind) ?? "task",
              title: p.title,
              date: p.date ?? null,
              time: p.time ?? null,
            },
          });
        }
      }
      setUndone(true);
      invalidate();
    } finally {
      setBusy(false);
    }
  }

  const calendarSearch: { d?: string; edit?: string } = first.date ? { d: first.date } : {};
  const editSearch: { d?: string; edit?: string } = first.date
    ? { d: first.date, edit: first.id }
    : { edit: first.id };

  return (
    <div
      className="ml-[42px] max-w-[85%] rounded-[16px] px-3.5 py-3"
      style={{ background: "var(--mag-surface)", border: `1px solid ${MAG_DARK_BORDER}` }}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full"
          style={{ background: "rgba(51,92,255,0.16)", color: MAG_BLUE }}
        >
          <Check className="h-4 w-4" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14.5px] font-medium" style={{ color: MAG_DARK_TEXT }}>
            {first.title}
            {shown.length > 1 ? ` · ${shown.length} datas` : ""}
          </p>
          <p className="text-[12.5px]" style={{ color: MAG_DARK_MUTED }}>
            {action === "deleted" ? "Removido · " : ""}
            {formatWhen(first.date, first.time)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          to="/planejamento"
          search={calendarSearch}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition active:opacity-60"
          style={{ borderColor: MAG_DARK_BORDER, color: "#A9BBE8" }}
        >
          <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.8} />
          Ver no calendário
        </Link>
        {action !== "deleted" && (
          <Link
            to="/planejamento"
            search={editSearch}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition active:opacity-60"
            style={{ borderColor: MAG_DARK_BORDER, color: "#A9BBE8" }}
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
            Editar
          </Link>
        )}
        <button
          type="button"
          onClick={undo}
          disabled={undone || busy}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition active:opacity-60 disabled:opacity-40"
          style={{ borderColor: MAG_DARK_BORDER, color: "#A9BBE8" }}
        >
          <Undo2 className="h-3.5 w-3.5" strokeWidth={1.8} />
          {undone ? "Desfeito" : "Desfazer"}
        </button>
      </div>
    </div>
  );
}
