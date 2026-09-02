import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";

export type CircleSummary = {
  id: string;
  name: string;
  status: "active" | "finished";
  challengeText: string;
  focusLabel?: string | null;
  todayDirection?: string | null;
  daysLeft: number;
  totalDays?: number;
  initials?: string[];
  members: number;
  isAdmin: boolean;
  inviteCode: string;
};

export type CircleInvite = {
  id: string;
  circleId: string;
  circleName: string;
  challengeText: string;
  from: string;
};

export type CircleMemberRow = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  isMe: boolean;
  steps: number;
  streak: number;
  activeDays: number;
};

export type CircleDetail = {
  ok: boolean;
  reason?: string;
  circle: {
    id: string;
    name: string;
    challengeKind: string;
    challengeText: string;
    focusLabel: string | null;
    targetCount: number | null;
    durationDays: number;
    startsAt: string;
    endsAt: string;
    status: "active" | "finished";
    daysLeft: number;
    inviteCode: string;
    isAdmin: boolean;
  };
  today: {
    date: string;
    direction: string | null;
    checkins: CircleCheckin[];
    doneCount: number;
    iDid: boolean;
  };
  me: { steps: number; streak: number; activeDays: number };
  goalPerMember: number;
  ranking: CircleMemberRow[];
  group: {
    members: number;
    steps: number;
    pct: number;
    consistency: number;
    daysElapsed: number;
  };
};

export type CircleCheckin = {
  userId: string;
  name: string;
  note: string | null;
  isMe: boolean;
  at: string;
};

export type ActiveCircleMember = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isMe: boolean;
  streak: number;
  doneToday: boolean;
};

export type ActiveCircle = {
  id: string;
  name: string;
  members: ActiveCircleMember[];
  memberCount: number;
  doneToday: number;
  weekProgress: number;
  daysLeft: number;
} | null;

/** Meus círculos + convites pendentes. */
export const listMyCircles = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }): Promise<{ circles: CircleSummary[]; invites: CircleInvite[] }> => {
    const { data, error } = await context.supabase.rpc("get_my_circles");
    if (error) throw new Error(error.message);
    return (data as unknown as { circles: CircleSummary[]; invites: CircleInvite[] }) ?? {
      circles: [],
      invites: [],
    };
  });

/** Detalhe do círculo: desafio, meu progresso, ranking e progresso coletivo. */
export const getCircle = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }): Promise<CircleDetail> => {
    const { data: row, error } = await context.supabase.rpc("get_circle_detail", {
      _circle_id: data.id,
    });
    if (error) throw new Error(error.message);
    return row as unknown as CircleDetail;
  });

const CreateInput = z.object({
  name: z.string().min(1).max(60),
  challengeKind: z.enum(["daily", "streak", "count", "custom"]),
  challengeText: z.string().min(1).max(200),
  targetCount: z.number().int().min(1).max(999).nullable().optional(),
  durationDays: z.number().int().min(1).max(365),
});

/** Cria um círculo privado e adiciona o criador como administrador. */
export const createCircle = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => CreateInput.parse(raw))
  .handler(async ({ context, data }): Promise<{ ok: boolean; id?: string; reason?: string }> => {
    const { data: res, error } = await context.supabase.rpc("create_circle", {
      _name: data.name,
      _challenge_kind: data.challengeKind,
      _challenge_text: data.challengeText,
      _target_count: (data.targetCount ?? null) as unknown as number,
      _duration_days: data.durationDays,
    });
    if (error) throw new Error(error.message);
    return res as unknown as { ok: boolean; id?: string; reason?: string };
  });

/** Entra em um círculo usando o código do convite. */
export const joinCircle = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ code: z.string().min(4).max(40) }).parse(raw))
  .handler(async ({ context, data }): Promise<{ ok: boolean; id?: string; reason?: string }> => {
    const { data: res, error } = await context.supabase.rpc("join_circle_by_code", {
      _code: data.code,
    });
    if (error) throw new Error(error.message);
    return res as unknown as { ok: boolean; id?: string; reason?: string };
  });

/** Convida pessoas da iMAG para o círculo. */
export const inviteToCircle = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z
      .object({ circleId: z.string().uuid(), userIds: z.array(z.string().uuid()).min(1).max(10) })
      .parse(raw),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; sent?: number }> => {
    const { data: res, error } = await context.supabase.rpc("invite_to_circle", {
      _circle_id: data.circleId,
      _user_ids: data.userIds,
    });
    if (error) throw new Error(error.message);
    return res as unknown as { ok: boolean; sent?: number };
  });

/** Aceita ou recusa um convite. */
export const respondInvite = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z.object({ inviteId: z.string().uuid(), accept: z.boolean() }).parse(raw),
  )
  .handler(async ({ context, data }): Promise<{ ok: boolean; circle_id?: string }> => {
    const { data: res, error } = await context.supabase.rpc("respond_circle_invite", {
      _invite_id: data.inviteId,
      _accept: data.accept,
    });
    if (error) throw new Error(error.message);
    return res as unknown as { ok: boolean; circle_id?: string };
  });

/** Sai do círculo. */
export const leaveCircle = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("leave_circle", { _circle_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Encerra o círculo (somente administrador). */
export const endCircle = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ context, data }) => {
    const { data: res, error } = await context.supabase.rpc("end_circle", { _circle_id: data.id });
    if (error) throw new Error(error.message);
    return res as unknown as { ok: boolean; reason?: string };
  });

/** Edita o desafio do círculo (somente administrador). */
export const updateCircleChallenge = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        challengeKind: z.enum(["daily", "streak", "count", "custom"]),
        challengeText: z.string().min(1).max(200),
        targetCount: z.number().int().min(1).max(999).nullable().optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { data: res, error } = await context.supabase.rpc("update_circle_challenge", {
      _circle_id: data.id,
      _challenge_kind: data.challengeKind,
      _challenge_text: data.challengeText,
      _target_count: (data.targetCount ?? null) as unknown as number,
    });
    if (error) throw new Error(error.message);
    return res as unknown as { ok: boolean; reason?: string };
  });

/** Atalho contextual: círculo ativo mais recente do usuário. */
export const getActiveCircle = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }): Promise<ActiveCircle> => {
    const { data, error } = await context.supabase.rpc("get_active_circle_summary");
    if (error) return null;
    return (data as unknown as ActiveCircle) ?? null;
  });

/** Define o foco em comum do círculo (somente dono). */
export const setCircleFocus = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z.object({ id: z.string().uuid(), focus: z.string().min(2).max(60) }).parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { data: res, error } = await context.supabase.rpc("set_circle_focus", {
      _circle_id: data.id,
      _focus: data.focus,
    });
    if (error) throw new Error(error.message);
    return res as unknown as { ok: boolean; reason?: string };
  });

/** Registra o check-in do participante na direção coletiva do dia. */
export const checkinCircleDirection = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        note: z.string().max(240).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { data: res, error } = await context.supabase.rpc("checkin_circle_direction", {
      _circle_id: data.id,
      _local_date: data.local_date,
      _note: (data.note ?? null) as unknown as string,
    });
    if (error) throw new Error(error.message);
    return res as unknown as { ok: boolean; reason?: string };
  });
