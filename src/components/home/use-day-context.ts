import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDayPanel, type DayEvent, type DayPriority } from "@/lib/day-panel.functions";

/** Data local (YYYY-MM-DD) do dispositivo. */
export function localDateNow(d = new Date()) {
  return d.toLocaleDateString("en-CA");
}

/**
 * Data local viva: acompanha a virada do dia (timer + volta ao app) e
 * invalida os caches de direção e do painel para que nada de ontem
 * permaneça visível como conteúdo de hoje.
 */
export function useLocalDate(): string {
  const qc = useQueryClient();
  const [date, setDate] = useState(() => localDateNow());

  useEffect(() => {
    const check = () => {
      const next = localDateNow();
      setDate((prev) => {
        if (prev === next) return prev;
        qc.removeQueries({ queryKey: ["today-meta"] });
        qc.removeQueries({ queryKey: ["day-panel"] });
        qc.removeQueries({ queryKey: ["day-context"] });
        qc.removeQueries({ queryKey: ["direction-response"] });
        qc.invalidateQueries({ queryKey: ["goal-feedback"] });
        return next;
      });
    };
    const id = setInterval(check, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [qc]);

  return date;
}

/** Relógio compartilhado — minutos desde 00:00, atualizado a cada minuto. */
export function useNowMinutes() {
  const [m, setM] = useState(() => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date();
      setM(d.getHours() * 60 + d.getMinutes());
    }, 30_000);
    return () => clearInterval(id);
  }, []);
  return m;
}

export function formatIn(minutes: number): string {
  if (minutes <= 0) return "agora";
  if (minutes < 60) return `em ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `em ${h}h`;
  return `em ${h}h${String(rest).padStart(2, "0")}`;
}

export type DayContext = {
  priorities: DayPriority[];
  events: DayEvent[];
  note: string;
  isToday: boolean;
  nextEvent: DayEvent | undefined;
  minutesToNextEvent: number | null;
  /** Compromissos cujo horário já passou e ainda não foram confirmados. */
  pastPendingEvents: DayEvent[];
  /** Compromissos já confirmados como realizados. */
  doneEvents: DayEvent[];
  doneCount: number;
  totalCount: number;
  loaded: boolean;
};

/** Contexto vivo do dia — base para mensagens dinâmicas e progresso. */
export function useDayContext(localDate: string): DayContext {
  const fetchPanel = useServerFn(getDayPanel);
  const nowMinutes = useNowMinutes();
  const { data, isFetched } = useQuery<{
    priorities: DayPriority[];
    events: DayEvent[];
    note: string;
  }>({
    queryKey: ["day-panel", localDate],
    queryFn: () => fetchPanel({ data: { local_date: localDate } }),
    retry: false,
  });

  const priorities = data?.priorities ?? [];
  const events = data?.events ?? [];
  const isToday = localDate === localDateNow();

  const { nextEvent, minutesToNextEvent, pastPendingEvents, doneEvents } = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.start_time.localeCompare(b.start_time));
    const done = sorted.filter((e) => e.status === "done");
    const open = sorted.filter((e) => e.status !== "done");
    const minutes = (e: DayEvent) => {
      const [h, m] = e.start_time.split(":");
      return Number(h) * 60 + Number(m);
    };
    if (!isToday) {
      return {
        nextEvent: open[0],
        minutesToNextEvent: null,
        pastPendingEvents: [] as DayEvent[],
        doneEvents: done,
      };
    }
    const found = open.find((e) => minutes(e) >= nowMinutes);
    const past = open.filter((e) => minutes(e) < nowMinutes);
    return {
      nextEvent: found,
      minutesToNextEvent: found ? minutes(found) - nowMinutes : null,
      pastPendingEvents: past,
      doneEvents: done,
    };
  }, [events, isToday, nowMinutes]);


  return {
    priorities,
    events,
    note: data?.note ?? "",
    isToday,
    nextEvent,
    minutesToNextEvent,
    pastPendingEvents,
    doneEvents,

    doneCount: priorities.filter((p) => p.done).length,
    totalCount: priorities.length,
    loaded: isFetched,
  };
}

/** Microfrase de status do cabeçalho — curta, sem progresso numérico. */
export function useContextualHeadline(): string {
  const ctx = useDayContext(localDateNow());
  const nowMinutes = useNowMinutes();
  const hour = Math.floor(nowMinutes / 60);

  if (!ctx.loaded) return "Uma direção clara muda o dia.";

  const pending = ctx.totalCount - ctx.doneCount;

  // 1. Compromisso iminente — o movimento mais próximo no tempo.
  if (ctx.nextEvent && ctx.minutesToNextEvent !== null && ctx.minutesToNextEvent <= 240) {
    return ctx.minutesToNextEvent <= 15
      ? "Seu compromisso começa agora."
      : `Você tem ${formatIn(ctx.minutesToNextEvent).replace("em ", "")} até o próximo compromisso.`;
  }

  // 2. Fim do dia.
  if (hour >= 21) {
    if (ctx.totalCount > 0 && pending === 0) return "Você moveu o que importava.";
    return "Hora de fechar o dia.";
  }

  // 3. Nada definido ainda.
  if (ctx.totalCount === 0) {
    if (hour < 12) return "Comece pelo que mais importa.";
    if (hour < 18) return "Ainda dá tempo de escolher o essencial.";
    return "Escolha um movimento simples.";
  }

  // 4. Tudo concluído.
  if (pending === 0) return "Você moveu o que importava.";

  // 5. Em execução.
  if (pending >= 3) return "Escolha o que vem primeiro.";
  if (ctx.doneCount === 0 && hour >= 14) return "Retome sua direção de hoje.";
  return "Seu próximo movimento já está claro.";
}
