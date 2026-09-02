import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Camera, FileText, Image as ImageIcon, Loader2, Paperclip, Plus, X } from "lucide-react";
import {
  ACCEPT_DOC,
  ACCEPT_IMAGE,
  readAttachment,
  type LocalAttachment,
} from "@/lib/attachments";
import { haptic } from "@/lib/haptics";
import { useMagTheme } from "@/lib/use-mag-theme";

const BLUE = "#335CFF";
const INK = "#111111";
const MUTED = "#7A7A80";
const FIELD = "#ECECEF";

/**
 * Botão "+" único com menu compacto (câmera, galeria, arquivo).
 * A permissão só é pedida quando o usuário escolhe a opção.
 * O tema (claro/escuro) segue a preferência de aparência da MAG.
 */
export function AttachButton({
  onFiles,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}) {
  const { resolved: magTheme } = useMagTheme();
  const dark = magTheme === "dark";
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(ref: React.RefObject<HTMLInputElement | null>) {
    setOpen(false);
    haptic(6);
    ref.current?.click();
  }

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) onFiles(files);
    e.target.value = "";
  }

  const items = [
    { label: "Tirar foto", icon: Camera, ref: cameraRef },
    { label: "Escolher da galeria", icon: ImageIcon, ref: galleryRef },
    { label: "Anexar arquivo", icon: Paperclip, ref: fileRef },
  ] as const;

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        aria-label="Adicionar foto ou arquivo"
        aria-expanded={open}
        onClick={() => {
          haptic(6);
          setOpen((v) => !v);
        }}
        className="grid h-10 w-10 place-items-center rounded-full transition active:opacity-80 disabled:opacity-30"
        style={{
          border: `1px solid ${open ? BLUE : dark ? "var(--mag-border)" : FIELD}`,
          background: dark ? "#111A30" : "#FFFFFF",
          color: open ? BLUE : dark ? "#A9BBE8" : INK,
        }}
      >
        <Plus
          className="h-4.5 w-4.5 transition-transform"
          strokeWidth={1.9}
          style={{ transform: open ? "rotate(45deg)" : undefined }}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-[calc(100%+8px)] left-0 z-30 w-[212px] overflow-hidden rounded-[16px]"
            style={{
              background: dark ? "var(--mag-surface)" : "#FFFFFF",
              border: `1px solid ${dark ? "var(--mag-border)" : FIELD}`,
              boxShadow: "0 18px 40px -24px rgba(15,23,42,0.4)",
            }}
          >
            {items.map((it, i) => (
              <button
                key={it.label}
                type="button"
                onClick={() => pick(it.ref)}
                className="flex w-full items-center gap-3 px-3.5 py-3 text-left text-[13.5px] transition active:opacity-60"
                style={{
                  color: dark ? "#F3F6FF" : INK,
                  borderTop: i > 0 ? `1px solid ${dark ? "var(--mag-border)" : FIELD}` : undefined,
                }}
              >
                <it.icon className="h-4 w-4 shrink-0" strokeWidth={1.7} style={{ color: BLUE }} />
                {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handle}
      />
      <input ref={galleryRef} type="file" accept={ACCEPT_IMAGE} multiple className="hidden" onChange={handle} />
      <input ref={fileRef} type="file" accept={ACCEPT_DOC} multiple className="hidden" onChange={handle} />
    </div>
  );
}

/** Miniaturas (imagens) e chips compactos (documentos). */
export function AttachmentStrip({
  items,
  onRemove,
}: {
  items: LocalAttachment[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2.5 flex flex-wrap gap-2">
      {items.map((a) =>
        a.kind === "image" && a.previewUrl ? (
          <span
            key={a.id}
            className="relative h-[56px] w-[56px] overflow-hidden rounded-[12px]"
            style={{ border: `1px solid ${a.status === "error" ? "#F0C0C0" : FIELD}` }}
          >
            <img src={a.previewUrl} alt={a.name} className="h-full w-full object-cover" />
            {a.status === "loading" && (
              <span className="absolute inset-0 grid place-items-center bg-white/70">
                <Loader2 className="h-4 w-4 animate-spin" style={{ color: BLUE }} />
              </span>
            )}
            <RemoveDot onClick={() => onRemove(a.id)} />
          </span>
        ) : (
          <span
            key={a.id}
            className="relative flex max-w-[190px] items-center gap-2 rounded-full bg-white py-1.5 pl-3 pr-7 text-[12px]"
            style={{
              border: `1px solid ${a.status === "error" ? "#F0C0C0" : FIELD}`,
              color: a.status === "error" ? "#C24545" : INK,
            }}
          >
            {a.status === "loading" ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" style={{ color: BLUE }} />
            ) : (
              <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} style={{ color: BLUE }} />
            )}
            <span className="truncate">{a.name}</span>
            <RemoveDot onClick={() => onRemove(a.id)} inline />
          </span>
        ),
      )}
      {items.some((a) => a.status === "error") && (
        <span className="w-full text-[11.5px] leading-[1.4]" style={{ color: MUTED }}>
          {items.find((a) => a.status === "error")?.error}
        </span>
      )}
    </div>
  );
}

function RemoveDot({ onClick, inline }: { onClick: () => void; inline?: boolean }) {
  return (
    <button
      type="button"
      aria-label="Remover anexo"
      onClick={onClick}
      className={`absolute grid h-[18px] w-[18px] place-items-center rounded-full text-white transition active:opacity-70 ${
        inline ? "right-1 top-1/2 -translate-y-1/2" : "right-1 top-1"
      }`}
      style={{ background: "rgba(17,17,17,0.62)" }}
    >
      <X className="h-3 w-3" strokeWidth={2.4} />
    </button>
  );
}

/** Estado compartilhado dos anexos. */
export function useAttachments() {
  const [items, setItems] = useState<LocalAttachment[]>([]);

  async function add(files: File[]) {
    for (const file of files.slice(0, 5)) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const placeholder: LocalAttachment = {
        id,
        name: file.name || "arquivo",
        mediaType: file.type,
        size: file.size,
        kind: file.type.startsWith("image/") ? "image" : "doc",
        status: "loading",
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
        file,
      };
      setItems((prev) => [...prev, placeholder]);
      const done = await readAttachment(file);
      setItems((prev) => prev.map((a) => (a.id === id ? { ...done, id } : a)));
    }
  }

  const remove = (id: string) => setItems((prev) => prev.filter((a) => a.id !== id));
  const clear = () => setItems([]);
  const ready = items.filter((a) => a.status === "ready");

  return { items, add, remove, clear, ready };
}
