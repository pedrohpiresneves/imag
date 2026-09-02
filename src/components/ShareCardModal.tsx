import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Share2, X, Check } from "lucide-react";
import {
  drawShareCard,
  TEMPLATES,
  type ShareData,
  type ShareOptions,
  type ShareTemplateId,
  type ShareFormat,
} from "@/lib/share-cards/renderer";

type Props = {
  open: boolean;
  onClose: () => void;
  data: ShareData;
  initialTemplate?: ShareTemplateId;
  availableTemplates?: ShareTemplateId[];
  onOpen?: () => void | Promise<unknown>;
  refreshing?: boolean;
};

export function ShareCardModal({
  open,
  onClose,
  data,
  initialTemplate = "streak",
  availableTemplates,
  onOpen,
  refreshing = false,
}: Props) {
  const templates = availableTemplates && availableTemplates.length
    ? TEMPLATES.filter((t) => availableTemplates.includes(t.id))
    : TEMPLATES;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [template, setTemplate] = useState<ShareTemplateId>(
    templates.some((t) => t.id === initialTemplate) ? initialTemplate : templates[0].id,
  );
  const [format, setFormat] = useState<ShareFormat>("story");
  const [background, setBackground] = useState<"white" | "blue">("white");
  const [showNumbers, setShowNumbers] = useState(true);
  const [onlyPhrase, setOnlyPhrase] = useState(false);
  const [hideMetaText, setHideMetaText] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const options: ShareOptions = useMemo(
    () => ({ background, showNumbers, onlyPhrase, hideMetaText, format }),
    [background, showNumbers, onlyPhrase, hideMetaText, format],
  );

  useEffect(() => {
    if (!open) return;
    setTemplate(
      templates.some((t) => t.id === initialTemplate) ? initialTemplate : templates[0].id,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialTemplate, availableTemplates?.join(",")]);

  // Sempre que abrir o modal, busca os dados mais recentes do usuário
  // antes de renderizar o card (evita cache antigo).
  useEffect(() => {
    if (!open || !onOpen) return;
    void onOpen();
  }, [open, onOpen]);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    let cancelled = false;
    setReady(false);
    setDataUrl(null);
    drawShareCard(canvasRef.current, template, data, options).then(() => {
      if (cancelled || !canvasRef.current) return;
      setReady(true);
      try {
        setDataUrl(canvasRef.current.toDataURL("image/png"));
      } catch {}
    });
    return () => {
      cancelled = true;
    };
  }, [open, template, data, options]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `imag-${template}.png`;
    a.click();
  }

  async function shareNative() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `imag-${template}.png`, { type: "image/png" });
      const nav = navigator as Navigator & {
        canShare?: (d: ShareData) => boolean;
        share?: (d: ShareData) => Promise<void>;
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyNav = nav as any;
      if (anyNav.canShare && anyNav.share && anyNav.canShare({ files: [file] })) {
        await anyNav.share({
          files: [file],
          title: "Minha evolução na iMAG",
          text: "Menos ruído. Mais direção.",
        });
        return;
      }
    } catch {}
    download();
  }

  const canShareNative =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { share?: unknown }).share === "function";

  const canHideMeta = template === "checkin" && !!data.metaText;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-sm rounded-[24px] bg-white p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full text-[#6B6B70] hover:bg-black/5"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Template chips */}
            <div className="mb-3 flex flex-wrap gap-1.5 pr-8">
              {templates.map((t) => {
                const active = t.id === template;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTemplate(t.id)}
                    className="rounded-full px-3 py-1 text-[11.5px] font-medium transition"
                    style={{
                      background: active ? "#335CFF" : "#F5F6F8",
                      color: active ? "#fff" : "#0A0A0A",
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Format toggle */}
            <div className="mb-3 inline-flex rounded-full bg-[#F5F6F8] p-1">
              {(["story", "square"] as const).map((f) => {
                const active = f === format;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFormat(f)}
                    className="rounded-full px-3.5 py-1 text-[11.5px] font-medium transition"
                    style={{
                      background: active ? "#FFFFFF" : "transparent",
                      color: active ? "#335CFF" : "#6B6B70",
                      boxShadow: active ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                    }}
                  >
                    {f === "story" ? "Stories" : "Quadrado"}
                  </button>
                );
              })}
            </div>

            {/* Preview */}
            <div className="overflow-hidden rounded-[18px] bg-[#F7F8FA]">
              {dataUrl && !refreshing ? (
                <img src={dataUrl} alt="Cartão iMAG" className="block h-auto w-full" />
              ) : (
                <div
                  className="w-full animate-pulse"
                  style={{ aspectRatio: format === "square" ? "1 / 1" : "9 / 16" }}
                />
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Options */}
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <ToggleChip
                active={background === "blue"}
                onClick={() => setBackground(background === "blue" ? "white" : "blue")}
                label={background === "blue" ? "Fundo azul" : "Fundo branco"}
              />
              <ToggleChip
                active={showNumbers}
                onClick={() => setShowNumbers((v) => !v)}
                label="Mostrar números"
              />
              <ToggleChip
                active={onlyPhrase}
                onClick={() => setOnlyPhrase((v) => !v)}
                label="Somente frase"
              />
              {canHideMeta && (
                <ToggleChip
                  active={hideMetaText}
                  onClick={() => setHideMetaText((v) => !v)}
                  label="Ocultar meta"
                />
              )}
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={canShareNative ? shareNative : download}
                disabled={!ready}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#335CFF] px-5 py-3 text-[13.5px] font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {canShareNative ? (
                  <>
                    <Share2 className="h-4 w-4" strokeWidth={1.8} />
                    Compartilhar
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" strokeWidth={1.8} />
                    Baixar imagem
                  </>
                )}
              </button>
              {canShareNative && (
                <button
                  type="button"
                  onClick={download}
                  disabled={!ready}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[#EDECE8] bg-white px-5 py-2.5 text-[13px] font-medium text-[#0A0A0A] transition hover:border-[#335CFF]/40 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" strokeWidth={1.6} />
                  Salvar imagem
                </button>
              )}
            </div>
            <p className="mt-3 text-center text-[11.5px] text-[#8A8A90]">
              {format === "story" ? "Formato story · 1080 × 1920" : "Formato quadrado · 1080 × 1080"}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ToggleChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition"
      style={{
        background: active ? "#EEF2FF" : "#FFFFFF",
        borderColor: active ? "#335CFF" : "#EDECE8",
        color: active ? "#335CFF" : "#0A0A0A",
      }}
    >
      {active && <Check className="h-3 w-3" strokeWidth={2.2} />}
      {label}
    </button>
  );
}