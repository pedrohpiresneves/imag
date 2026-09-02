import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Download, Share2, X } from "lucide-react";
import { drawDayCard, type DayCardData, type DayCardFormat } from "@/lib/share-cards/day-card";

type Props = {
  open: boolean;
  onClose: () => void;
  data: DayCardData;
};

/** Modal de compartilhamento do "Meu dia" (Stories | Quadrado). */
export function ShareDayModal({ open, onClose, data }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [format, setFormat] = useState<DayCardFormat>("stories");
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    let cancelled = false;
    setReady(false);
    setDataUrl(null);
    drawDayCard(canvasRef.current, data, format).then(() => {
      if (cancelled || !canvasRef.current) return;
      setReady(true);
      try {
        setDataUrl(canvasRef.current.toDataURL("image/png"));
      } catch {}
    });
    return () => {
      cancelled = true;
    };
  }, [open, format, data]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "imag-meu-dia.png";
    a.click();
  }

  async function shareNative() {
    if (!dataUrl) return;
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], "imag-meu-dia.png", { type: "image/png" });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({
          files: [file],
          title: "Meu dia na iMAG",
          text: "Menos ruído. Mais direção. imag.net.br",
        });
        return;
      }
    } catch {
      return;
    }
    download();
  }

  const canShareNative =
    typeof navigator !== "undefined" &&
    typeof (navigator as Navigator & { share?: unknown }).share === "function";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
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

            <div className="mb-3 inline-flex rounded-full bg-[#F5F6F8] p-1">
              {(["stories", "square"] as const).map((f) => {
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
                    {f === "stories" ? "Stories" : "Quadrado"}
                  </button>
                );
              })}
            </div>

            <div className="overflow-hidden rounded-[18px] bg-[#F7F8FA]">
              {dataUrl ? (
                <img src={dataUrl} alt="Card Meu dia · iMAG" className="block h-auto w-full" />
              ) : (
                <div
                  className="w-full animate-pulse"
                  style={{ aspectRatio: format === "square" ? "1 / 1" : "9 / 16" }}
                />
              )}
              <canvas ref={canvasRef} className="hidden" />
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
              {format === "square" ? "Quadrado · 1080 × 1080" : "Stories · 1080 × 1920"}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
