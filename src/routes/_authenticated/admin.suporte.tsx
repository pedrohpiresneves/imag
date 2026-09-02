import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Send, Loader2, Search, CheckCircle2, RotateCcw } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/suporte")({
  component: AdminSuporte,
  head: () => ({
    meta: [
      { title: "Suporte · Admin · Agenda Magnética" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

type Conv = {
  id: string;
  user_id: string;
  status: string;
  last_message_at: string;
  last_message_preview: string | null;
  admin_last_read_at: string;
  profile?: { full_name: string | null; email: string | null } | null;
};

type Msg = {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: "user" | "admin";
  body: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function AdminSuporte() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [userTyping, setUserTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const activeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Auth check
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setIsAdmin(false);
        return;
      }
      setAdminId(u.user.id);
      const { data } = await supabase.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
      setIsAdmin(!!data);
    })();
  }, []);

  // Load conversations + subscribe to list updates
  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;

    async function load() {
      const { data: rows } = await supabase
        .from("support_conversations")
        .select("id,user_id,status,last_message_at,last_message_preview,admin_last_read_at")
        .order("last_message_at", { ascending: false });
      const list = (rows ?? []) as Conv[];
      if (list.length) {
        const ids = list.map((c) => c.user_id);
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p]));
        for (const c of list) {
          const p = map.get(c.user_id) as { full_name: string | null; email: string | null } | undefined;
          c.profile = p ?? null;
        }
      }
      if (!cancelled) setConvs(list);
    }
    load();

    const channel = supabase
      .channel("admin-support-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        () => load(),
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  // Load messages when active changes + subscribe
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      if (!cancelled) setMessages((data as Msg[]) ?? []);
      await supabase
        .from("support_conversations")
        .update({ admin_last_read_at: new Date().toISOString() })
        .eq("id", activeId);
    })();

    const channel = supabase
      .channel(`support:${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_role === "user") {
            setUserTyping(false);
            supabase
              .from("support_conversations")
              .update({ admin_last_read_at: new Date().toISOString() })
              .eq("id", activeId);
          }
        },
      )
      .on("broadcast", { event: "typing" }, (p) => {
        if ((p.payload as { role?: string })?.role === "user") {
          setUserTyping(true);
          window.setTimeout(() => setUserTyping(false), 3000);
        }
      })
      .subscribe();
    activeChannelRef.current = channel;
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      activeChannelRef.current = null;
    };
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, userTyping]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return convs;
    return convs.filter((c) => {
      const name = c.profile?.full_name?.toLowerCase() ?? "";
      const email = c.profile?.email?.toLowerCase() ?? "";
      return name.includes(q) || email.includes(q) || (c.last_message_preview ?? "").toLowerCase().includes(q);
    });
  }, [convs, query]);

  const active = convs.find((c) => c.id === activeId) ?? null;

  async function send() {
    const body = text.trim();
    if (!body || !activeId || !adminId || sending) return;
    setSending(true);
    setText("");
    const { error } = await supabase.from("support_messages").insert({
      conversation_id: activeId,
      sender_id: adminId,
      sender_role: "admin",
      body,
    });
    setSending(false);
    if (error) {
      toast.error("Falha ao enviar.");
      setText(body);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeId || !adminId) return;
    setUploading(true);
    const path = `${adminId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const up = await supabase.storage.from("support-attachments").upload(path, file);
    if (up.error) {
      setUploading(false);
      toast.error("Falha no anexo.");
      return;
    }
    const { data: signed } = await supabase.storage
      .from("support-attachments")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    await supabase.from("support_messages").insert({
      conversation_id: activeId,
      sender_id: adminId,
      sender_role: "admin",
      attachment_url: signed?.signedUrl ?? null,
      attachment_name: file.name,
    });
    setUploading(false);
  }

  async function toggleResolved() {
    if (!active) return;
    const next = active.status === "resolved" ? "open" : "resolved";
    await supabase.from("support_conversations").update({ status: next }).eq("id", active.id);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    } else {
      activeChannelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { role: "admin" },
      });
    }
  }

  if (isAdmin === null) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-xl px-5 py-24 text-center">
          <h1 className="text-2xl font-bold text-accent">Acesso restrito</h1>
          <p className="mt-3 text-sm text-muted-foreground">Esta área é exclusiva de administradores.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <div className="mb-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Admin</p>
          <h1 className="text-2xl font-bold text-accent">Suporte · Conversas</h1>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* Sidebar */}
          <aside className="flex flex-col overflow-hidden rounded-2xl border border-hairline bg-background/60">
            <div className="border-b border-hairline p-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar aluno…"
                  className="w-full rounded-lg border border-hairline bg-background py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
                />
              </div>
            </div>
            <div className="max-h-[70vh] flex-1 overflow-y-auto">
              {filtered.length === 0 && (
                <p className="p-6 text-center text-xs text-muted-foreground">Nenhuma conversa.</p>
              )}
              {filtered.map((c) => {
                const unread = new Date(c.last_message_at) > new Date(c.admin_last_read_at);
                const label = c.profile?.full_name || c.profile?.email || c.user_id.slice(0, 8);
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveId(c.id)}
                    className={`flex w-full flex-col gap-1 border-b border-hairline/70 px-4 py-3 text-left transition hover:bg-accent/5 ${
                      activeId === c.id ? "bg-accent/10" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{label}</span>
                      <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                        {fmtDate(c.last_message_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="line-clamp-1 flex-1 text-xs text-muted-foreground">
                        {c.last_message_preview ?? "—"}
                      </p>
                      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
                    </div>
                    {c.status === "resolved" && (
                      <span className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em] text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" /> Resolvida
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Thread */}
          <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-hairline bg-background/60">
            {!active ? (
              <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
                Selecione uma conversa
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-hairline px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {active.profile?.full_name || active.profile?.email || "Aluno"}
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {active.profile?.email ?? active.user_id.slice(0, 8)}
                    </p>
                  </div>
                  <button
                    onClick={toggleResolved}
                    className="inline-flex items-center gap-2 rounded-lg border border-hairline px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition hover:border-accent hover:text-accent"
                  >
                    {active.status === "resolved" ? (
                      <>
                        <RotateCcw className="h-3 w-3" /> Reabrir
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3" /> Marcar resolvida
                      </>
                    )}
                  </button>
                </div>

                <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-5 sm:px-6">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.sender_role === "admin" ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[75%] space-y-1">
                        <div
                          className={
                            m.sender_role === "admin"
                              ? "rounded-2xl rounded-br-sm border border-accent/40 bg-accent/15 px-4 py-2 text-[14px] text-foreground"
                              : "rounded-2xl rounded-bl-sm border border-hairline bg-background/80 px-4 py-2 text-[14px] text-foreground"
                          }
                        >
                          {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                          {m.attachment_url && (
                            <a
                              href={m.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-1 inline-flex items-center gap-2 text-xs text-accent underline"
                            >
                              <Paperclip className="h-3 w-3" /> {m.attachment_name ?? "anexo"}
                            </a>
                          )}
                        </div>
                        <div
                          className={`font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70 ${
                            m.sender_role === "admin" ? "text-right" : "text-left"
                          }`}
                        >
                          {fmtTime(m.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {userTyping && (
                    <div className="pl-1 text-xs text-muted-foreground">Aluno está digitando…</div>
                  )}
                </div>

                <div className="border-t border-hairline p-3">
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={uploading}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-hairline text-muted-foreground transition hover:border-accent hover:text-accent disabled:opacity-50"
                      aria-label="Anexar"
                    >
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                    </button>
                    <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
                    <textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      onKeyDown={onKeyDown}
                      rows={1}
                      placeholder="Responder…"
                      className="max-h-40 min-h-[40px] flex-1 resize-none rounded-xl border border-hairline bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={send}
                      disabled={!text.trim() || sending}
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-background transition hover:brightness-110 disabled:opacity-40"
                      aria-label="Enviar"
                    >
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}