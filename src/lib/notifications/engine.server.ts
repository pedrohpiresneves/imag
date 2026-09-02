/** Motor de decisão contextual da MAG. Server-only. */
import {
  deliverMagNotification,
  inQuietHours,
  localDate,
  localHour,
  PREFS_COLUMNS,
  type MagNotificationSpec,
  type Prefs,
} from "./dispatch.server";

function firstName(fullName?: string | null) {
  const name = (fullName ?? "").trim().split(/\s+/)[0];
  return name && name.length > 1 ? name : null;
}

/** Deixa o texto natural dentro da frase, sem aspas. */
function lowerFirst(value: string) {
  const t = value.trim();
  if (!t) return t;
  if (t.length > 1 && t.slice(1) !== t.slice(1).toLowerCase()) return t; // siglas/nomes próprios
  return t.charAt(0).toLowerCase() + t.slice(1);
}

function minutesFromHHMM(value: string) {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export type Candidate = MagNotificationSpec;

/** Constrói o melhor candidato para o usuário agora — ou null se não houver nada útil. */
export async function buildCandidate(prefs: Prefs, now = new Date()): Promise<Candidate | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tz = prefs.timezone;
  const today = localDate(tz, now);
  const hour = localHour(tz, now);
  const minutes = hour * 60 + Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, minute: "2-digit" }).format(now),
  );

  const [{ data: profile }, { data: events }, { data: priorities }, { data: plan }, { data: checkin }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("full_name").eq("id", prefs.user_id).maybeSingle(),
      supabaseAdmin
        .from("day_events")
        .select("id, title, start_time")
        .eq("user_id", prefs.user_id)
        .eq("day_date", today),
      supabaseAdmin
        .from("day_priorities")
        .select("id, title, done")
        .eq("user_id", prefs.user_id)
        .eq("day_date", today)
        .order("position"),
      supabaseAdmin
        .from("user_plans")
        .select("id, priority_title, status, first_action")
        .eq("user_id", prefs.user_id)
        .eq("meta_date", today)
        .eq("is_active", true)
        .maybeSingle(),
      supabaseAdmin
        .from("daily_checkins")
        .select("id")
        .eq("user_id", prefs.user_id)
        .eq("checkin_date", today)
        .maybeSingle(),
    ]);

  const name = firstName(profile?.full_name);
  const greet = name ? `${name}, ` : "";

  const upcoming = (events ?? [])
    .map((e) => ({ ...e, min: minutesFromHHMM(e.start_time) }))
    .filter((e): e is { id: string; title: string; start_time: string; min: number } =>
      e.min !== null && e.min > minutes,
    )
    .sort((a, b) => a.min - b.min);
  const next = upcoming[0] ?? null;

  const pending = (priorities ?? []).filter((p) => !p.done);

  // 1) Próximo compromisso (aviso entre 45 e 90 minutos antes)
  if (next && prefs.appointments_enabled) {
    const delta = next.min - minutes;
    if (delta >= 45 && delta <= 90) {
      const time = next.start_time.slice(0, 5);
      return {
        type: "appointment",
        category: "appointments",
        body: `Seu próximo compromisso é às ${time}. Quer revisar o que precisa estar pronto?`,
        targetRoute: `/atividade?focus=appointment&id=${next.id}`,
        entityId: next.id,
        dedupeKey: `appointment:${next.id}:${today}`,
        expiresAt: new Date(now.getTime() + delta * 60 * 1000).toISOString(),
      };
    }
  }

  // 2) Firmeza: prioridade adiada de forma recorrente (evidência real, nunca 1 ocorrência)
  if (pending.length > 0 && prefs.priorities_enabled) {
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { data: history } = await supabaseAdmin
      .from("day_priorities")
      .select("title, done, day_date")
      .eq("user_id", prefs.user_id)
      .gte("day_date", since)
      .lt("day_date", today);
    const postponed = new Map<string, number>();
    for (const row of history ?? []) {
      if (row.done) continue;
      const key = row.title.trim().toLowerCase();
      postponed.set(key, (postponed.get(key) ?? 0) + 1);
    }
    const repeated = pending.find((p) => (postponed.get(p.title.trim().toLowerCase()) ?? 0) >= 2);
    if (repeated && hour >= 9) {
      return {
        type: "firmness",
        category: "priorities",
        body: `Vou ser sincera: ${repeated.title} já ficou para depois mais de uma vez. Que tal resolver hoje ou replanejar?`,
        targetRoute: `/atividade?focus=priority&id=${repeated.id}`,
        entityId: repeated.id,
        dedupeKey: `firmness:${repeated.title.trim().toLowerCase()}:${today}`,
      };
    }
  }

  // 3) Contexto: janela livre relevante antes do próximo compromisso
  if (next && pending.length > 0 && prefs.priorities_enabled) {
    const delta = next.min - minutes;
    if (delta >= 150 && hour >= 8) {
      const hours = Math.floor(delta / 60);
      const target = pending[0];
      return {
        type: "context",
        category: "priorities",
        body: `${greet}você tem ${hours} ${hours === 1 ? "hora livre" : "horas livres"} antes de ${next.title}. Que tal começar por ${lowerFirst(target.title)}?`,
        targetRoute: `/atividade?focus=priority&id=${target.id}`,
        entityId: target.id,
        dedupeKey: `context:${target.id}:${today}`,
        expiresAt: new Date(now.getTime() + delta * 60 * 1000).toISOString(),
      };
    }
  }

  // 4) Direção do dia ainda em aberto, com tempo razoável para agir
  if (plan && plan.status !== "completed" && prefs.direction_enabled && hour >= 12 && hour <= 17) {
    return {
      type: "direction",
      category: "direction",
      body: "Sua direção ainda está em aberto. Quer transformá-la em um passo de 10 minutos?",
      targetRoute: "/atividade?focus=direction",
      entityId: plan.id,
      dedupeKey: `direction:${plan.id}:${today}`,
    };
  }

  // 5) Encerramento do dia — padrão 20h, ou 30 min após o último compromisso (nunca após 21h30)
  if (prefs.day_close_enabled !== false) {
    const { dayCloseTargetMinutes } = await import("@/lib/day-close.server");
    const target = dayCloseTargetMinutes(
      prefs.day_close_hour ?? 20,
      (events ?? []).map((e) => e.start_time),
    );
    const worthIt = pending.length > 0 || (plan && plan.status !== "completed") || !checkin;
    const { data: closure } = await supabaseAdmin
      .from("day_closures")
      .select("id")
      .eq("user_id", prefs.user_id)
      .eq("day_date", today)
      .maybeSingle();
    if (worthIt && !closure && minutes >= target && minutes <= target + 59) {
      return {
        type: "day_close",
        category: "day_close",
        body: `${greet}vamos encerrar o dia? Organizo com você o que ficou pendente e deixamos amanhã mais leve.`,
        targetRoute: "/atividade?focus=day-close",
        entityId: null,
        dedupeKey: `day_close:${today}`,
      };
    }
  }

  // 6) Check-in do fim do dia
  if (!checkin && prefs.checkin_enabled && hour >= 19 && !inQuietHours(prefs, now)) {
    if (plan || pending.length > 0) {
      return {
        type: "checkin",
        category: "checkin",
        body: "Como foi seu dia? Faça seu check-in e deixe amanhã mais leve.",
        targetRoute: "/atividade?checkin=true",
        entityId: plan?.id ?? null,
        dedupeKey: `checkin:${today}`,
      };
    }
  }

  return null;
}

export type SweepResult = { evaluated: number; sent: number; skipped: number };

/** Varredura periódica: avalia cada usuário elegível e envia no máximo uma notificação. */
export async function runMagNotificationSweep(): Promise<SweepResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows } = await supabaseAdmin
    .from("notification_preferences")
    .select(PREFS_COLUMNS)
    .eq("enabled", true);

  const list = (rows ?? []) as unknown as Prefs[];
  let sent = 0;
  let skipped = 0;

  for (const prefs of list) {
    try {
      if (inQuietHours(prefs)) {
        skipped += 1;
        continue;
      }
      const candidate = await buildCandidate(prefs);
      if (!candidate) {
        skipped += 1;
        continue;
      }
      const result = await deliverMagNotification(prefs.user_id, candidate);
      if (result.ok) sent += 1;
      else skipped += 1;
    } catch (e) {
      skipped += 1;
      console.error("[push] falha ao avaliar usuário", e instanceof Error ? e.message : "unknown");
    }
  }

  return { evaluated: list.length, sent, skipped };
}
