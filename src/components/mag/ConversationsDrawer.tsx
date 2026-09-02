import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, MoreHorizontal, Pencil, Pin, PinOff, Plus, Search, SquarePen, Trash2 } from "lucide-react";
import magHeadOfficial from "@/assets/mag-head-official.png.asset.json";
import { MAG_BLUE, MAG_DARK_BORDER, MAG_DARK_MUTED, MAG_DARK_TEXT } from "@/components/mag-chat";

export type Conversation = {
  id: string;
  title: string;
  pinned: boolean;
  last_message_at: string;
  created_at: string;
  preview?: string;
};

const easeOut = [0.22, 1, 0.36, 1] as const;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function bucketOf(iso: string): "hoje" | "ontem" | "anteriores" {
  const t = startOfDay(new Date(iso));
  const today = startOfDay(new Date());
  if (t === today) return "hoje";
  if (t === today - 86_400_000) return "ontem";
  return "anteriores";
}

function stampOf(iso: string) {
  const d = new Date(iso);
  const b = bucketOf(iso);
  if (b === "hoje") return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (b === "ontem") return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export function ConversationsDrawer({
  open,
  onClose,
  conversations,
  activeId,
  onSelect,
  onNew,
  onRename,
  onTogglePin,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onTogglePin: (id: string, pinned: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setMenuId(null);
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = conversations.filter(
      (c) =>
        !term ||
        c.title.toLowerCase().includes(term) ||
        (c.preview ?? "").toLowerCase().includes(term),
    );
    return [
      { key: "Hoje", items: list.filter((c) => bucketOf(c.last_message_at) === "hoje") },
      { key: "Ontem", items: list.filter((c) => bucketOf(c.last_message_at) === "ontem") },
      { key: "Anteriores", items: list.filter((c) => bucketOf(c.last_message_at) === "anteriores") },
    ].filter((g) => g.items.length > 0);
  }, [conversations, q]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[95]">
          <motion.button
            type="button"
            aria-label="Fechar conversas"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 h-full w-full"
            style={{ background: "rgba(3,6,15,0.6)", backdropFilter: "blur(2px)" }}
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ duration: 0.32, ease: easeOut }}
            className="absolute inset-y-0 left-0 flex w-[82%] max-w-[400px] flex-col rounded-r-[24px]"
            style={{
              background: "#0A1020",
              borderRight: `1px solid ${MAG_DARK_BORDER}`,
              boxShadow: "0 18px 60px rgba(0,0,0,0.55)",
            }}
            onClick={() => setMenuId(null)}
          >
            <div
              className="px-4"
              style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fechar"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border transition active:opacity-60"
                  style={{ borderColor: MAG_DARK_BORDER, color: MAG_BLUE }}
                >
                  <ChevronLeft className="h-4.5 w-4.5" strokeWidth={2} />
                </button>
                <h2
                  className="flex-1 text-[20px] font-semibold tracking-[-0.02em]"
                  style={{ color: "#FFFFFF" }}
                >
                  Conversas
                </h2>
                <button
                  type="button"
                  onClick={onNew}
                  aria-label="Nova conversa"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border transition active:opacity-60"
                  style={{ borderColor: MAG_DARK_BORDER, color: MAG_BLUE }}
                >
                  <SquarePen className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>

              <div
                className="mt-3 flex h-11 items-center gap-2 rounded-full px-3.5"
                style={{ border: `1px solid ${MAG_DARK_BORDER}`, background: "var(--mag-surface)" }}
              >
                <Search className="h-4 w-4 shrink-0" strokeWidth={1.7} style={{ color: MAG_DARK_MUTED }} />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar conversa"
                  className="w-full bg-transparent text-[14.5px] placeholder:text-[#5E6E96] focus:outline-none"
                  style={{ color: MAG_DARK_TEXT }}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-3 pt-4">
              {groups.length === 0 ? (
                <p className="px-2 pt-10 text-center text-[14px]" style={{ color: MAG_DARK_MUTED }}>
                  Suas conversas aparecerão aqui
                </p>
              ) : (
                groups.map((g) => (
                  <section key={g.key} className="mb-4">
                    <p className="px-2 pb-1.5 text-[13px]" style={{ color: MAG_DARK_MUTED }}>
                      {g.key}
                    </p>
                    <div className="flex flex-col gap-1">
                      {g.items.map((c) => {
                        const active = c.id === activeId;
                        return (
                          <div
                            key={c.id}
                            className="relative flex items-start gap-3 rounded-[16px] px-2.5 py-2.5 transition"
                            style={{
                              background: active ? "rgba(51,92,255,0.14)" : "transparent",
                              border: `1px solid ${active ? "rgba(51,92,255,0.28)" : "transparent"}`,
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                onSelect(c.id);
                                onClose();
                              }}
                              className="flex min-w-0 flex-1 items-start gap-3 text-left"
                            >
                              <img
                                src={magHeadOfficial.url}
                                alt=""
                                aria-hidden
                                className="h-9 w-9 shrink-0 select-none rounded-full object-contain"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="flex items-baseline gap-2">
                                  <span
                                    className="min-w-0 flex-1 truncate text-[15px] font-medium"
                                    style={{ color: "#FFFFFF" }}
                                  >
                                    {c.pinned ? "📌 " : ""}
                                    {c.title}
                                  </span>
                                  <span className="shrink-0 text-[12px]" style={{ color: MAG_DARK_MUTED }}>
                                    {stampOf(c.last_message_at)}
                                  </span>
                                </span>
                                <span
                                  className="mt-0.5 block truncate text-[13.5px]"
                                  style={{ color: MAG_DARK_MUTED }}
                                >
                                  {c.preview || "Sem mensagens ainda."}
                                </span>
                              </span>
                            </button>
                            <button
                              type="button"
                              aria-label="Opções da conversa"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuId((m) => (m === c.id ? null : c.id));
                              }}
                              className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full transition active:opacity-60"
                              style={{ color: MAG_DARK_MUTED }}
                            >
                              <MoreHorizontal className="h-4.5 w-4.5" strokeWidth={1.8} />
                            </button>

                            {menuId === c.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-2 top-11 z-10 w-[176px] overflow-hidden rounded-[14px]"
                                style={{
                                  background: "#111C33",
                                  border: `1px solid ${MAG_DARK_BORDER}`,
                                  boxShadow: "0 12px 34px rgba(0,0,0,0.5)",
                                }}
                              >
                                <MenuItem
                                  icon={c.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                                  label={c.pinned ? "Desafixar" : "Fixar"}
                                  onClick={() => {
                                    onTogglePin(c.id, !c.pinned);
                                    setMenuId(null);
                                  }}
                                />
                                <MenuItem
                                  icon={<Pencil className="h-4 w-4" />}
                                  label="Renomear"
                                  onClick={() => {
                                    const next = window.prompt("Novo título da conversa", c.title);
                                    if (next && next.trim()) onRename(c.id, next.trim().slice(0, 80));
                                    setMenuId(null);
                                  }}
                                />
                                <MenuItem
                                  icon={<Trash2 className="h-4 w-4" />}
                                  label="Excluir"
                                  danger
                                  onClick={() => {
                                    onDelete(c.id);
                                    setMenuId(null);
                                  }}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}
            </div>

            <div
              className="px-4 pt-2"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
            >
              <button
                type="button"
                onClick={onNew}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-[18px] border text-[15px] font-medium transition active:opacity-70"
                style={{ borderColor: "rgba(51,92,255,0.4)", background: "rgba(51,92,255,0.10)", color: MAG_BLUE }}
              >
                <Plus className="h-4.5 w-4.5" strokeWidth={2} />
                Nova conversa
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left text-[14px] transition active:opacity-60"
      style={{ color: danger ? "#FF6B6B" : MAG_DARK_TEXT }}
    >
      {icon}
      {label}
    </button>
  );
}
