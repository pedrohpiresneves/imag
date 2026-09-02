import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { z } from "zod";

export type ImagPerson = {
  id: string;
  handle: string | null;
  full_name: string | null;
  avatar_url: string | null;
  profession: string | null;
};

export type SharedDirection = {
  id: string;
  sender_id: string;
  recipient_id: string;
  title: string;
  description: string;
  reason: string | null;
  message: string | null;
  status: "pending" | "accepted" | "declined" | "archived" | "later";
  created_at: string;
  responded_at: string | null;
  executed_at: string | null;
  person: ImagPerson | null;
};

const SELECT =
  "id, sender_id, recipient_id, title, description, reason, message, status, created_at, responded_at, executed_at";

/** Busca pessoas da iMAG por nome ou identidade (mínimo 2 caracteres). */
export const searchImagPeople = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => z.object({ q: z.string().max(80) }).parse(raw))
  .handler(async ({ context, data }): Promise<ImagPerson[]> => {
    const q = data.q.trim();
    if (q.length < 2) return [];
    const { data: rows, error } = await context.supabase.rpc("search_imag_people", { _q: q });
    if (error) throw new Error(error.message);
    return (rows as ImagPerson[] | null) ?? [];
  });

/** Contatos recentes: pessoas com quem já houve troca de direções. */
export const listRecentContacts = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }): Promise<ImagPerson[]> => {
    const { data, error } = await context.supabase.rpc("recent_direction_contacts");
    if (error) throw new Error(error.message);
    return (data as ImagPerson[] | null) ?? [];
  });

const ShareInput = z.object({
  recipient_ids: z.array(z.string().uuid()).min(1).max(5),
  plan_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  reason: z.string().max(1000).nullable().optional(),
  message: z.string().max(120).nullable().optional(),
});

export const shareDirection = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => ShareInput.parse(raw))
  .handler(async ({ context, data }) => {
    const rows = data.recipient_ids
      .filter((id) => id !== context.userId)
      .map((id) => ({
        sender_id: context.userId,
        recipient_id: id,
        plan_id: data.plan_id ?? null,
        title: data.title,
        description: data.description,
        reason: data.reason ?? null,
        message: data.message?.trim() ? data.message.trim() : null,
        status: "pending",
      }));
    if (rows.length === 0) return { ok: true, count: 0 };
    const { error } = await context.supabase.from("shared_directions").insert(rows);
    if (error) throw new Error(error.message);
    return { ok: true, count: rows.length };
  });

async function hydratePeople(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  rows: Array<Record<string, unknown>>,
  key: "sender_id" | "recipient_id",
): Promise<SharedDirection[]> {
  const ids = Array.from(new Set(rows.map((r) => r[key] as string)));
  let people: Record<string, ImagPerson> = {};
  if (ids.length > 0) {
    const { data } = await supabase
      .from("profiles")
      .select("id, handle, full_name, avatar_url, profession")
      .in("id", ids);
    people = Object.fromEntries(((data ?? []) as ImagPerson[]).map((p) => [p.id, p]));
  }
  return rows.map((r) => ({
    ...(r as unknown as SharedDirection),
    person: people[r[key] as string] ?? null,
  }));
}

/** Convites pendentes recebidos. */
export const listPendingDirections = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }): Promise<SharedDirection[]> => {
    const { data, error } = await context.supabase
      .from("shared_directions")
      .select(SELECT)
      .eq("recipient_id", context.userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return hydratePeople(context.supabase, (data ?? []) as Array<Record<string, unknown>>, "sender_id");
  });

/** Direções recebidas e aceitas (a área "Direções compartilhadas"). */
export const listSharedDirections = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z
      .object({ include_archived: z.boolean().default(false) })
      .parse(raw ?? {}),
  )
  .handler(async ({ context, data }): Promise<SharedDirection[]> => {
    const statuses = data.include_archived ? ["accepted", "archived"] : ["accepted"];
    const { data: rows, error } = await context.supabase
      .from("shared_directions")
      .select(SELECT)
      .eq("recipient_id", context.userId)
      .in("status", statuses)
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return hydratePeople(context.supabase, (rows ?? []) as Array<Record<string, unknown>>, "sender_id");
  });

/** Direções que eu enviei (para acompanhar quem executou). */
export const listSentDirections = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }): Promise<SharedDirection[]> => {
    const { data, error } = await context.supabase
      .from("shared_directions")
      .select(SELECT)
      .eq("sender_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw new Error(error.message);
    return hydratePeople(context.supabase, (data ?? []) as Array<Record<string, unknown>>, "recipient_id");
  });

const RespondInput = z.object({
  id: z.string().uuid(),
  action: z.enum(["accept", "decline", "archive", "execute", "later", "reconsider"]),
});

export const respondToDirection = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => RespondInput.parse(raw))
  .handler(async ({ context, data }) => {
    const now = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: any =
      data.action === "accept"
        ? { status: "accepted", responded_at: now }
        : data.action === "decline"
          ? { status: "declined", responded_at: now }
          : data.action === "archive"
            ? { status: "archived" }
            : data.action === "later"
              ? { status: "later", responded_at: now }
              : data.action === "reconsider"
                ? { status: "pending", responded_at: null }
                : { executed_at: now };
    const { error } = await context.supabase
      .from("shared_directions")
      .update(patch)
      .eq("id", data.id)
      .eq("recipient_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Impacto no Campo Magnético: direções executadas (recebidas e enviadas). */
export const getSharedImpact = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }): Promise<{ executedReceived: number; executedSent: number }> => {
    const [received, sent] = await Promise.all([
      context.supabase
        .from("shared_directions")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", context.userId)
        .not("executed_at", "is", null),
      context.supabase
        .from("shared_directions")
        .select("id", { count: "exact", head: true })
        .eq("sender_id", context.userId)
        .not("executed_at", "is", null),
    ]);
    return {
      executedReceived: received.count ?? 0,
      executedSent: sent.count ?? 0,
    };
  });
/* ------------------------------------------------------------------ *
 * Metas recebidas — janela de permanência de 72h a partir do envio.
 * ------------------------------------------------------------------ */

export const RECEIVED_WINDOW_HOURS = 72;

export type ReceivedDirection = SharedDirection & {
  expires_at: string;
  hours_left: number;
  added: boolean;
  later: boolean;
};

function decorate(rows: SharedDirection[]): ReceivedDirection[] {
  const now = Date.now();
  return rows.map((r) => {
    const created = new Date(r.created_at).getTime();
    const expires = created + RECEIVED_WINDOW_HOURS * 3600_000;
    return {
      ...r,
      expires_at: new Date(expires).toISOString(),
      hours_left: Math.max(0, Math.ceil((expires - now) / 3600_000)),
      added: r.status === "accepted",
      later: r.status === "later",
    };
  });
}

/** Metas recebidas — aba "Ativas" (dentro de 72h) ou "Expiradas". */
export const listReceivedDirections = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) =>
    z.object({ tab: z.enum(["active", "expired"]).default("active") }).parse(raw ?? {}),
  )
  .handler(async ({ context, data }): Promise<ReceivedDirection[]> => {
    const cutoff = new Date(Date.now() - RECEIVED_WINDOW_HOURS * 3600_000).toISOString();
    let query = context.supabase
      .from("shared_directions")
      .select(SELECT)
      .eq("recipient_id", context.userId)
      .in("status", ["pending", "later", "accepted"])
      .order("created_at", { ascending: false })
      .limit(60);
    query = data.tab === "active" ? query.gte("created_at", cutoff) : query.lt("created_at", cutoff);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const hydrated = await hydratePeople(
      context.supabase,
      (rows ?? []) as Array<Record<string, unknown>>,
      "sender_id",
    );
    return decorate(hydrated);
  });

/** Quantidade de metas recebidas ativas (badge da barra lateral). */
export const countActiveReceived = createServerFn({ method: "GET" })
  .middleware([requirePaidAccess])
  .handler(async ({ context }): Promise<number> => {
    const cutoff = new Date(Date.now() - RECEIVED_WINDOW_HOURS * 3600_000).toISOString();
    const { count } = await context.supabase
      .from("shared_directions")
      .select("id", { count: "exact", head: true })
      .eq("recipient_id", context.userId)
      .in("status", ["pending", "later"])
      .gte("created_at", cutoff);
    return count ?? 0;
  });

const AddToDayInput = z.object({
  id: z.string().uuid(),
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/** Adiciona uma meta recebida ao dia, sem substituir a MAG Meta principal. */
export const addSharedToMyDay = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => AddToDayInput.parse(raw))
  .handler(async ({ context, data }) => {
    const { data: shared, error } = await context.supabase
      .from("shared_directions")
      .select("id, sender_id, title, description, reason, status, added_at")
      .eq("id", data.id)
      .eq("recipient_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!shared) throw new Error("Meta não encontrada.");

    const { data: sender } = await context.supabase
      .from("profiles")
      .select("full_name, handle")
      .eq("id", shared.sender_id)
      .maybeSingle();
    const senderName =
      ((sender?.full_name ?? sender?.handle ?? "alguém") as string).split(" ")[0] ?? "alguém";

    const { data: plan } = await context.supabase
      .from("user_plans")
      .select("id, next_actions")
      .eq("user_id", context.userId)
      .eq("meta_date", data.local_date)
      .maybeSingle();

    const action = { id: `sh-${shared.id.slice(0, 8)}`, title: shared.description, done: false };

    if (!plan) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const insert: any = {
        user_id: context.userId,
        priority_title: shared.title,
        priority_reason: shared.reason,
        first_action: shared.description,
        next_actions: [],
        source: "mag",
        meta_date: data.local_date,
        origin_kind: "shared",
        origin_label: senderName,
        shared_direction_id: shared.id,
      };
      const { error: insertError } = await context.supabase.from("user_plans").insert(insert);
      if (insertError) throw new Error(insertError.message);
    } else {
      const current = Array.isArray(plan.next_actions)
        ? (plan.next_actions as Array<{ id: string; title: string; done: boolean }>)
        : [];
      if (!current.some((a) => a.id === action.id)) {
        const { error: updateError } = await context.supabase
          .from("user_plans")
          .update({ next_actions: [...current, action] })
          .eq("id", plan.id)
          .eq("user_id", context.userId);
        if (updateError) throw new Error(updateError.message);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const patch: any = {
      status: "accepted",
      responded_at: new Date().toISOString(),
      added_at: new Date().toISOString(),
    };
    await context.supabase
      .from("shared_directions")
      .update(patch)
      .eq("id", shared.id)
      .eq("recipient_id", context.userId);

    return { ok: true };
  });
