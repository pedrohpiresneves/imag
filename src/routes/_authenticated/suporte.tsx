import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Paperclip, Send, Loader2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suporte")({
  component: SuporteChat,
  head: () => ({
    meta: [
      { title: "Suporte · Agenda Magnética" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

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

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function fmtDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (same(d, today)) return "Hoje";
  if (same(d, yest)) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function SuporteChat() {
  const [userId, setUserId] = useState<string | null>(null);
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user || cancelled) return;
      setUserId(u.user.id);

      // ensure conversation exists
      let { data: conv } = await supabase
        .from("support_conversations")
        .select("id")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (!conv) {
        const ins = await supabase
          .from("support_conversations")
          .insert({ user_id: u.user.id })
          .select("id")
          .single();
        conv = ins.data;
      }
      if (!conv || cancelled) return;
      setConvId(conv.id);

      const { data: msgs } = await supabase
        .from("support_messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true });
      if (!cancelled) setMessages((msgs as Msg[]) ?? []);

      // mark as read
      await supabase
        .from("support_conversations")
        .update({ user_last_read_at: new Date().toISOString() })
        .eq("id", conv.id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Realtime new messages + admin typing
  useEffect(() => {
    if (!convId) return;
    const channel = supabase
      .channel(`support:${convId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          const m = payload.new as Msg;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_role === "admin") {
            setAdminTyping(false);
            supabase
              .from("support_conversations")
              .update({ user_last_read_at: new Date().toISOString() })
              .eq("id", convId);
          }
        },
      )
      .on("broadcast", { event: "typing" }, (p) => {
        if ((p.payload as { role?: string })?.role === "admin") {
          setAdminTyping(true);
          window.setTimeout(() => setAdminTyping(false), 3000);
        }
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      typingChannelRef.current = null;
    };
  }, [convId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, adminTyping]);

  const grouped = useMemo(() => {
    const groups: { day: string; items: Msg[] }[] = [];
    for (const m of messages) {
      const day = fmtDay(m.created_at);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(m);
      else groups.push({ day, items: [m] });
    }
    return groups;
  }, [messages]);

  async function send() {
    const body = text.trim();
    if (!body || !convId || !userId || sending) return;
    setSending(true);
    setText("");
    const { error } = await supabase.from("support_messages").insert({
      conversation_id: convId,
      sender_id: userId,
      sender_role: "user",
      body,
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar. Tente novamente.");
      setText(body);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !convId || !userId) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo acima de 10MB.");
      return;
    }
    setUploading(true);
    const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const up = await supabase.storage.from("support-attachments").upload(path, file);
    if (up.error) {
      setUploading(false);
      toast.error("Falha no envio do anexo.");
      return;
    }
    const { data: signed } = await supabase.storage
      .from("support-attachments")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    await supabase.from("support_messages").insert({
      conversation_id: convId,
      sender_id: userId,
      sender_role: "user",
      body: null,
      attachment_url: signed?.signedUrl ?? null,
      attachment_name: file.name,
    });
    setUploading(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    } else {
      // notify admin panel that user is typing
      typingChannelRef.current?.send({
        type: "broadcast",
        event: "typing",
        payload: { role: "user" },
      });
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[820px] flex-1 flex-col px-4 py-6 sm:px-8 sm:py-10">
        {/* Header */}
        <div className="mb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            Estamos aqui
          </p>
          <h1
            className="mt-2 text-3xl font-bold tracking-[-0.01em] text-accent sm:text-4xl"
            style={{ fontFamily: "'Manrope', ui-sans-serif, system-ui, sans-serif" }}
          >
            Suporte
          </h1>
          <p className="mt-2 text-[14px] text-foreground/80">
            Fale diretamente com nossa equipe. Estamos aqui para ajudar.
          </p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-hairline bg-background/60 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/80">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
            Responde em poucos minutos
          </div>
        </div>

        {/* Chat */}
        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-hairline bg-background/60 shadow-[0_1px_0_0_hsl(var(--accent)/0.15)_inset]">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6" style={{ minHeight: 380 }}>
            {grouped.length === 0 ? (
              <div className="grid h-full place-items-center py-12 text-center text-sm text-muted-foreground">
                <div>
                  <p>Nenhuma mensagem ainda.</p>
                  <p className="mt-1 text-xs">Envie sua primeira mensagem — respondemos rapidinho.</p>
                </div>
              </div>
            ) : (
              grouped.map((g) => (
                <div key={g.day} className="space-y-3">
                  <div className="my-2 flex items-center gap-3">
                    <div className="h-px flex-1 bg-hairline" />
                    <span className="font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                      {g.day}
                    </span>
                    <div className="h-px flex-1 bg-hairline" />
                  </div>
                  {g.items.map((m) => (
                    <MessageBubble key={m.id} m={m} mine={m.sender_role === "user"} />
                  ))}
                </div>
              ))
            )}
            {adminTyping && (
              <div className="flex items-center gap-2 pl-1 text-xs text-muted-foreground">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-accent" />
                </span>
                Administrador está digitando…
              </div>
            )}
          </div>

          {/* Composer */}
          <div className="border-t border-hairline bg-background/80 p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-hairline text-muted-foreground transition hover:border-accent hover:text-accent disabled:opacity-50"
                aria-label="Anexar arquivo"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </button>
              <input ref={fileRef} type="file" className="hidden" onChange={onPickFile} />
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Escreva sua mensagem…"
                rows={1}
                className="max-h-40 min-h-[40px] flex-1 resize-none rounded-xl border border-hairline bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-accent focus:outline-none"
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
            <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">
              Enter para enviar · Shift+Enter para nova linha
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function MessageBubble({ m, mine }: { m: Msg; mine: boolean }) {
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] space-y-1 ${mine ? "items-end" : "items-start"}`}>
        <div
          className={
            mine
              ? "rounded-2xl rounded-br-sm border border-accent/40 bg-accent/15 px-4 py-2 text-[14px] leading-relaxed text-foreground"
              : "rounded-2xl rounded-bl-sm border border-hairline bg-background/80 px-4 py-2 text-[14px] leading-relaxed text-foreground"
          }
        >
          {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
          {m.attachment_url && (
            <a
              href={m.attachment_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-2 text-xs text-accent underline underline-offset-2"
            >
              <Paperclip className="h-3 w-3" /> {m.attachment_name ?? "anexo"}
            </a>
          )}
        </div>
        <div
          className={`font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70 ${mine ? "text-right" : "text-left"}`}
        >
          {fmtTime(m.created_at)}
        </div>
      </div>
    </div>
  );
}