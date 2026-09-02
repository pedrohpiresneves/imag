import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Moon, PanelLeft, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BottomNav } from "@/components/BottomNav";
import { supabase } from "@/integrations/supabase/client";
import {
  MagComposer,
  MagGroup,
  TypingBubble,
  UserBubble,
  splitChunks,
  useProgressiveReveal,
  MAG_BLUE,
  MAG_DARK_BG,
  MAG_DARK_BORDER,
  MAG_DARK_MUTED,
  MAG_DARK_TEXT,
} from "@/components/mag-chat";
import { AttachmentStrip, useAttachments } from "@/components/mag/AttachControl";
import { MAGCharacter } from "@/components/mag/MAGCharacter";
import { ConversationsDrawer, type Conversation } from "@/components/mag/ConversationsDrawer";
import { PlanActionCard, type PlanToolResult } from "@/components/mag/PlanActionCard";
import {
  createConversation,
  deleteConversation,
  listConversations,
  loadMentorHistory,
  saveMentorMessage,
  updateConversation,
} from "@/lib/mentor.functions";
import { useAccess } from "@/lib/use-access";
import { THINKING_LINES } from "@/lib/mag/chat-intents";
import { useMagTheme } from "@/lib/use-mag-theme";


/** Fluxo guiado de decisão — a MAG conduz, não decide sozinha. */
const DECISION_PROMPT =
  "Preciso tomar uma decisão. Me conduza passo a passo, uma pergunta por vez: 1) o que eu preciso decidir, 2) quais são as opções, 3) o que mais pesa para mim agora. Depois me entregue uma recomendação clara, os motivos e uma ação possível — sem decidir arbitrariamente por mim.";


export const Route = createFileRoute("/mentor")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "MAG · iMAG" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MentorPage,
});

/* ---------- parsing ---------- */

const OPTIONS_RE = /\[\[\s*op(?:ç|c)oes?\s*:([^\]]*)\]\]/i;

function splitQuickReplies(raw: string): { text: string; options: string[] } {
  const m = raw.match(OPTIONS_RE);
  if (!m) return { text: raw.trim(), options: [] };
  const options = (m[1] ?? "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  return { text: raw.replace(OPTIONS_RE, "").trim(), options };
}

/** Resultados das tools de Planejamento dentro de uma mensagem da MAG. */
function planToolResults(m: UIMessage): PlanToolResult[] {
  const out: PlanToolResult[] = [];
  for (const p of m.parts as Array<Record<string, unknown>>) {
    const type = String(p["type"] ?? "");
    if (!type.startsWith("tool-plan_")) continue;
    if (p["state"] !== "output-available") continue;
    const output = p["output"] as PlanToolResult | undefined;
    if (output && output.ok && output.action && output.action !== "searched") out.push(output);
  }
  return out;
}

function messageText(m: UIMessage): string {
  return m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
}

/* ---------- page ---------- */

function MentorPage() {
  const { isPaid, isLoggedIn, isLoading } = useAccess();
  const qc = useQueryClient();
  const enabled = isLoggedIn && isPaid;

  const [activeId, setActiveId] = useState<string | null>(null);
  /** Só muda quando o usuário troca/cria conversa — evita remontar o chat em uso. */
  const [chatKey, setChatKey] = useState("default");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const listFn = useServerFn(listConversations);
  const createFn = useServerFn(createConversation);
  const updateFn = useServerFn(updateConversation);
  const deleteFn = useServerFn(deleteConversation);
  const historyFn = useServerFn(loadMentorHistory);

  const { data: conversations = [], isFetched: convFetched } = useQuery({
    queryKey: ["mentor_conversations"],
    queryFn: () => listFn() as Promise<Conversation[]>,
    enabled,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["mentor_history", chatKey],
    queryFn: () => historyFn({ data: { conversation_id: activeId } }),
    enabled,
  });

  const initialMessages: UIMessage[] = useMemo(
    () =>
      history.map((m, i) => ({
        id: `db_${m.id ?? i}`,
        role: m.role as "user" | "assistant",
        parts: [{ type: "text", text: m.content }],
      })),
    [history],
  );

  const ensureConversation = useCallback(async () => {
    if (activeId) return activeId;
    const conv = (await createFn()) as Conversation;
    setActiveId(conv.id);
    void qc.invalidateQueries({ queryKey: ["mentor_conversations"] });
    return conv.id;
  }, [activeId, createFn, qc]);

  function openConversation(id: string | null) {
    setActiveId(id);
    setChatKey(id ?? `new_${Date.now()}`);
    setDrawerOpen(false);
  }

  async function handleNew() {
    const conv = (await createFn()) as Conversation;
    setGreeting(null);
    openConversation(conv.id);
    await qc.invalidateQueries({ queryKey: ["mentor_conversations"] });
  }

  /* Sessão viva: retoma a conversa recente ou abre outra após 6h / virada de dia. */
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const [greeting, setGreeting] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);
  const resolved = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setResolving(false);
      return;
    }
    if (resolved.current || !convFetched) return;
    resolved.current = true;
    const recent = [...conversations].sort((a, b) =>
      String(b.last_message_at ?? b.created_at ?? "").localeCompare(
        String(a.last_message_at ?? a.created_at ?? ""),
      ),
    )[0];
    const stamp = recent?.last_message_at ?? recent?.created_at ?? null;
    const time = stamp ? new Date(stamp).getTime() : 0;
    const sameDay =
      !!stamp &&
      new Date(stamp).toLocaleDateString("en-CA") === new Date().toLocaleDateString("en-CA");
    const isEmptyConv = !!recent && !(recent as { preview?: string }).preview;
    const canContinue = !!recent && (isEmptyConv || (Date.now() - time < SIX_HOURS && sameDay));

    if (canContinue && recent) {
      setActiveId(recent.id);
      setChatKey(recent.id);
      setResolving(false);
      return;
    }
    void (async () => {
      try {
        const conv = (await createFn()) as Conversation;
        const hour = new Date().getHours();
        const salut = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
        setGreeting(`${salut}. Por onde vamos começar?`);
        setActiveId(conv.id);
        setChatKey(conv.id);
        void qc.invalidateQueries({ queryKey: ["mentor_conversations"] });
      } catch {
        /* segue na conversa padrão */
      } finally {
        setResolving(false);
      }
    })();
  }, [enabled, convFetched, conversations, createFn, qc, SIX_HOURS]);

  const { resolved: magTheme } = useMagTheme();

  return (
    <div
      className="flex min-h-[100dvh] flex-col"
      style={{
        background: MAG_DARK_BG,
        color: MAG_DARK_TEXT,
        fontFamily: "var(--font-sans)",
      }}
    >
      {isLoading || (enabled && resolving) ? (
        <div className="px-6 py-24 text-center text-[13px]" style={{ color: MAG_DARK_MUTED }}>
          Carregando…
        </div>
      ) : (
        <MentorChat
          key={chatKey}
          initial={initialMessages}
          greeting={greeting}
          isPaid={isPaid}
          isLoggedIn={isLoggedIn}
          conversationId={activeId}
          ensureConversation={ensureConversation}
          onOpenHistory={() => setDrawerOpen(true)}
        />
      )}
      <ConversationsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => openConversation(id)}
        onNew={() => void handleNew()}
        onRename={async (id, title) => {
          await updateFn({ data: { id, title } });
          await qc.invalidateQueries({ queryKey: ["mentor_conversations"] });
        }}
        onTogglePin={async (id, pinned) => {
          await updateFn({ data: { id, pinned } });
          await qc.invalidateQueries({ queryKey: ["mentor_conversations"] });
        }}
        onDelete={async (id) => {
          await deleteFn({ data: { id } });
          if (id === activeId) openConversation(null);
          await qc.invalidateQueries({ queryKey: ["mentor_conversations"] });
        }}

      />
      <BottomNav dark={magTheme === "dark"} spacer={false} />
    </div>
  );
}

/* ---------- chat ---------- */

function MentorChat({
  initial,
  greeting: openingGreeting = null,
  isPaid,
  isLoggedIn,
  conversationId,
  ensureConversation,
  onOpenHistory,
}: {
  initial: UIMessage[];
  greeting?: string | null;
  isPaid: boolean;
  isLoggedIn: boolean;
  conversationId: string | null;
  ensureConversation: () => Promise<string>;
  onOpenHistory: () => void;
}) {

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/mentor",
        prepareSendMessagesRequest: async ({ messages, headers }) => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return {
            body: { messages },
            headers: token ? { ...headers, Authorization: `Bearer ${token}` } : headers,
          };
        },
      }),
    [],
  );
  const { messages, sendMessage, setMessages, status } = useChat({ messages: initial, transport });
  const [input, setInput] = useState("");
  const att = useAttachments();

  const scrollRef = useRef<HTMLDivElement>(null);
  const timesRef = useRef<Map<string, string>>(new Map());
  function timeFor(id: string) {
    let t = timesRef.current.get(id);
    if (!t) {
      t = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      timesRef.current.set(id, t);
    }
    return t;
  }
  const savedIds = useRef<Set<string>>(new Set(initial.map((m) => m.id)));
  const busy = status === "streaming" || status === "submitted";
  const { setAppearance, resolved } = useMagTheme();

  const prefillSent = useRef(false);
  useEffect(() => {
    if (prefillSent.current || !isPaid) return;
    try {
      const p = sessionStorage.getItem("mag_prefill");
      if (p) {
        sessionStorage.removeItem("mag_prefill");
        prefillSent.current = true;
        sendMessage({ text: p });
      }
    } catch {}
  }, [isPaid, sendMessage]);

  /* Abertura vinda de "Organizar com a MAG" — contexto do dia já na conversa. */
  const seedApplied = useRef(false);
  useEffect(() => {
    if (seedApplied.current || !isPaid) return;
    try {
      const seed = sessionStorage.getItem("mag_seed");
      if (!seed) return;
      sessionStorage.removeItem("mag_seed");
      seedApplied.current = true;
      setMessages((prev) => [
        ...prev,
        { id: `seed_${Date.now()}`, role: "assistant", parts: [{ type: "text", text: seed }] },
      ]);
    } catch {}
  }, [isPaid, setMessages]);

  /* Nova sessão após 6h ou virada de dia — saudação contextual da MAG. */
  const greetApplied = useRef(false);
  useEffect(() => {
    if (greetApplied.current || !isPaid || !openingGreeting) return;
    if (initial.length > 0) return;
    greetApplied.current = true;
    setMessages((prev) =>
      prev.length > 0
        ? prev
        : [
            {
              id: `greet_${Date.now()}`,
              role: "assistant",
              parts: [{ type: "text", text: openingGreeting }],
            },
          ],
    );
  }, [isPaid, openingGreeting, initial.length, setMessages]);


  const convRef = useRef<string | null>(conversationId);
  const qcChat = useQueryClient();
  const saveMut = useMutation({
    mutationFn: (v: { role: "user" | "assistant"; content: string }) =>
      saveMentorMessage({ data: { ...v, conversation_id: convRef.current } }),
    onSuccess: () => {
      void qcChat.invalidateQueries({ queryKey: ["mentor_conversations"] });
    },
  });


  useEffect(() => {
    if (!isPaid || busy) return;
    for (const m of messages) {
      if (savedIds.current.has(m.id)) continue;
      if (m.role !== "user" && m.role !== "assistant") continue;
      const text = messageText(m);
      if (!text.trim()) continue;
      savedIds.current.add(m.id);
      saveMut.mutate({ role: m.role, content: text });
    }
  }, [messages, busy, saveMut, isPaid]);

  const isEmpty = messages.length === 0;

  const { data: profileName } = useQuery({
    queryKey: ["mentor_profile_name"],
    queryFn: async () => {
      const { data: session } = await supabase.auth.getUser();
      const uid = session.user?.id;
      if (!uid) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", uid)
        .maybeSingle();
      return (data?.full_name as string | null) ?? null;
    },
    enabled: isLoggedIn,
  });
  const firstName = (profileName ?? "").trim().split(/\s+/)[0] ?? "";

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    const salut = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
    return firstName ? `${salut}, ${firstName}.` : `${salut}.`;
  }, [firstName]);

  const contextLine = "Como posso ajudar você hoje?";
  const intents = useMemo(
    () => [
      { label: "O que faço agora?", prompt: "Com o que já está no meu dia, o que eu faço agora?" },
      { label: "Organizar meu dia", prompt: "Quero organizar meu dia." },
      { label: "Decidir algo", prompt: DECISION_PROMPT },
    ],
    [],
  );




  const thinkingLine = useMemo(
    () => THINKING_LINES[Math.floor(Math.random() * THINKING_LINES.length)]!,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages.length],
  );


  const preRevealed = useMemo(() => initial.map((m) => m.id), [initial]);
  const cleanText = useMemo(
    () => (m: { id: string; role: string }) =>
      splitQuickReplies(messageText(m as unknown as UIMessage)).text,
    [],
  );
  const revealed = useProgressiveReveal(
    messages as unknown as Array<{ id: string; role: string }>,
    cleanText,
    busy,
    preRevealed,
  );

  const last = messages[messages.length - 1];
  const pendingReveal =
    !!last &&
    last.role === "assistant" &&
    (revealed[last.id] ?? 0) < splitChunks(splitQuickReplies(messageText(last)).text).length;
  const showTyping = busy || pendingReveal;

  function submit(text: string) {
    if (!isPaid) return;
    const ready = att.ready;
    const inlineText = ready
      .filter((a) => a.text)
      .map((a) => `Conteúdo do arquivo "${a.name}":\n${a.text}`)
      .join("\n\n");
    const t = [text.trim(), inlineText].filter(Boolean).join("\n\n");
    const files = ready
      .filter((a) => a.dataUrl)
      .map((a) => ({
        type: "file" as const,
        filename: a.name,
        mediaType: a.mediaType,
        url: a.dataUrl!,
      }));
    if ((!t && files.length === 0) || busy) return;
    if (!convRef.current) {
      void ensureConversation()
        .then((id) => {
          convRef.current = id;
        })
        .catch(() => {});
    }
    sendMessage({ text: t || "Analise o anexo e me ajude com isso.", files });
    setInput("");
    att.clear();
  }



  /* Posição de leitura por conversa — retoma na primeira mensagem não lida. */
  const readKey = `mag_read_${conversationId ?? "default"}`;
  const firstOpen = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (firstOpen.current) {
      firstOpen.current = false;
      let anchor: string | null = null;
      try {
        const lastRead = localStorage.getItem(readKey);
        if (lastRead) {
          const idx = initial.findIndex((m) => m.id === lastRead);
          if (idx >= 0 && idx < initial.length - 1) anchor = initial[idx + 1]?.id ?? null;
        }
      } catch {}
      const node = anchor ? el.querySelector(`[data-mid="${anchor}"]`) : null;
      if (node instanceof HTMLElement) {
        el.scrollTo({ top: Math.max(node.offsetTop - 12, 0), behavior: "auto" });
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: "auto" });
      }
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, status, revealed, initial, readKey]);

  /* Marca a última mensagem vista para retomar a leitura depois. */
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;
    try {
      localStorage.setItem(readKey, lastMsg.id);
    } catch {}
  }, [messages, readKey]);

  // Planejamento salvo pela MAG → Hoje, Semana, Mês, Ano e Agenda do dia em tempo real.
  const syncedPlans = useRef<Set<string>>(new Set());
  useEffect(() => {
    let changed = false;
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const r of planToolResults(m)) {
        const key = `${m.id}:${r.action}:${(r.items ?? r.previous ?? []).map((i) => i.id).join(",")}`;
        if (syncedPlans.current.has(key)) continue;
        syncedPlans.current.add(key);
        changed = true;
      }
    }
    if (!changed) return;
    void qcChat.invalidateQueries({ queryKey: ["planning"] });
    void qcChat.invalidateQueries({ queryKey: ["day-panel"] });
    void qcChat.invalidateQueries({ queryKey: ["day-context"] });
  }, [messages, qcChat]);

  // Direção do Dia atualizada pela MAG → card da tela Hoje recarrega.
  const syncedDirection = useRef<Set<string>>(new Set());
  useEffect(() => {
    let changed = false;
    for (const m of messages) {
      if (m.role !== "assistant") continue;
      for (const part of m.parts as Array<{ type?: string }>) {
        const t = part?.type ?? "";
        if (t !== "tool-refresh_day_direction" && t !== "tool-set_direction") continue;
        const key = `${m.id}:${t}`;
        if (syncedDirection.current.has(key)) continue;
        syncedDirection.current.add(key);
        changed = true;
      }
    }
    if (!changed) return;
    void qcChat.invalidateQueries({ queryKey: ["today-meta"] });
    void qcChat.invalidateQueries({ queryKey: ["day-context"] });
    void qcChat.invalidateQueries({ queryKey: ["weekly-focus"] });
  }, [messages, qcChat]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastParsed = lastAssistant ? splitQuickReplies(messageText(lastAssistant)) : null;
  const quickReplies = !busy && !pendingReveal && lastParsed ? lastParsed.options : [];

  return (
    <>
      <header
        className="sticky top-0 z-20 backdrop-blur-xl"
        style={{
          background: "color-mix(in srgb, var(--mag-bg) 82%, transparent)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        <div className="mx-auto flex h-14 max-w-[640px] items-center gap-1 px-3 sm:px-6">
          <button
            type="button"
            onClick={onOpenHistory}
            aria-label="Histórico de conversas"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:opacity-60"
            style={{ color: MAG_DARK_TEXT }}
          >
            <PanelLeft className="h-5 w-5" strokeWidth={1.8} />
          </button>
          <Link
            to="/atividade"
            aria-label="Voltar"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:opacity-60"
            style={{ color: MAG_DARK_TEXT }}
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={1.8} />
          </Link>

          <div className="min-w-0">
            <p className="text-[17px] font-semibold leading-tight tracking-[-0.02em]" style={{ color: MAG_DARK_TEXT }}>
              MAG
            </p>
            <p className="text-[12px] leading-tight" style={{ color: MAG_DARK_MUTED }}>
              Inteligência da iMAG
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAppearance(resolved === "dark" ? "light" : "dark")}
            aria-label={resolved === "dark" ? "Usar tema claro" : "Usar tema escuro"}
            className="ml-auto grid h-10 w-10 shrink-0 place-items-center rounded-full transition active:opacity-60"
            style={{ color: MAG_DARK_MUTED }}
          >
            {resolved === "dark" ? (
              <Sun className="h-5 w-5" strokeWidth={1.8} />
            ) : (
              <Moon className="h-5 w-5" strokeWidth={1.8} />
            )}
          </button>
        </div>
      </header>

      <main ref={scrollRef} className="flex flex-1 flex-col overflow-y-auto px-5 pb-1 pt-3 sm:px-8">
        <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-5">
          {isEmpty && isPaid && (
            <section className="flex flex-1 flex-col items-center justify-center text-center">
              <MAGCharacter state="idle" framing="full" size={100} />
              <h1
                className="mt-2 text-[24px] font-semibold leading-[1.15]"
                style={{ color: MAG_DARK_TEXT, letterSpacing: "-0.03em" }}
              >
                {greeting}
              </h1>
              <p
                className="mt-1 max-w-[19rem] text-[16px] leading-[1.4]"
                style={{ color: MAG_DARK_MUTED, letterSpacing: "-0.01em" }}
              >
                {contextLine}
              </p>
            </section>
          )}


          {messages.map((m) => {
            if (m.role === "user") {
              const t = messageText(m);
              if (!t.trim()) return null;
              return (
                <div key={m.id} data-mid={m.id}>
                  <UserBubble text={t} time={timeFor(m.id)} />
                </div>
              );
            }
            const { text } = splitQuickReplies(messageText(m));
            const chunks = splitChunks(text);
            const shown = chunks.slice(0, Math.min(revealed[m.id] ?? 0, chunks.length));
            const planResults = planToolResults(m);
            if (shown.length === 0 && planResults.length === 0) return null;
            return (
              <div key={m.id} data-mid={m.id} className="flex flex-col gap-2">
                {shown.length > 0 && <MagGroup chunks={shown} time={timeFor(m.id)} />}
                {planResults.map((r, i) => (
                  <PlanActionCard key={`${m.id}_plan_${i}`} result={r} />
                ))}
              </div>
            );
          })}

          {showTyping && isPaid && <TypingBubble label={thinkingLine} />}

          {quickReplies.length > 0 && isPaid && (
            <div className="flex flex-wrap gap-2 pl-[42px]">
              {quickReplies.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => submit(q)}
                  className="rounded-full border px-3.5 py-2 text-left text-[14px] transition active:opacity-60"
                  style={{
                    borderColor: MAG_DARK_BORDER,
                    background: "var(--mag-surface)",
                    color: MAG_DARK_TEXT,
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {!isPaid && (
            <>
              <MagGroup
                chunks={[
                  "Gostaria de continuar te acompanhando.",
                  "Para continuar nossa conversa e receber orientações personalizadas sempre que precisar, escolha um plano abaixo.",
                ]}
              />
              <div className="pl-[42px]">
                <Link
                  to="/planos"
                  className="inline-flex items-center justify-center rounded-full px-6 py-3 text-[14px] font-medium text-white transition hover:opacity-90"
                  style={{ background: MAG_BLUE }}
                >
                  Desbloquear a MAG
                </Link>
                {!isLoggedIn && (
                  <p className="mt-4 text-[13px]" style={{ color: MAG_DARK_MUTED }}>
                    Já tem acesso?{" "}
                    <Link to="/auth" className="underline underline-offset-4">
                      Entrar
                    </Link>
                  </p>
                )}
              </div>
            </>
          )}
          <div className="h-1" />
        </div>
      </main>

      <div
        className="sticky bottom-0 z-20 backdrop-blur-xl"
        style={{
          background: "color-mix(in srgb, var(--mag-bg) 88%, transparent)",
          borderTop: "1px solid var(--mag-border)",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 70px)",
        }}
      >
        {isEmpty && isPaid && (
          <div className="mx-auto max-w-[640px] px-4 pt-2 sm:px-8">
            <div
              className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {intents.map((intent) => (
                <button
                  key={intent.label}
                  type="button"
                  onClick={() => submit(intent.prompt)}
                  className="flex h-9 shrink-0 items-center rounded-full border px-3.5 text-[13px] transition active:opacity-60"
                  style={{
                    borderColor: "var(--mag-border)",
                    background: "var(--mag-surface)",
                    color: MAG_DARK_MUTED,
                  }}
                >
                  {intent.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <MagComposer
          value={input}
          onChange={setInput}
          onSubmit={() => submit(input)}
          disabled={!isPaid}
          sending={busy}
          onFiles={att.add}
          attachmentsSlot={<AttachmentStrip items={att.items} onRemove={att.remove} />}
          canSend={!!input.trim() || att.ready.length > 0}
          placeholder={
            isPaid ? "Converse com a MAG…" : "Libere seu acesso para conversar"
          }
          autoFocusKey={messages.length}
        />
      </div>

    </>
  );
}
