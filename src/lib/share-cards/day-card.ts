import imagLogoAsset from "@/assets/imag-logo.png.asset.json";

export type DayCardFormat = "stories" | "square";

export const DAY_FORMATS: Record<DayCardFormat, { w: number; h: number; label: string }> = {
  stories: { w: 1080, h: 1920, label: "Stories" },
  square: { w: 1080, h: 1080, label: "Quadrado" },
};

export type DayCardData = {
  /** Quantidade de prioridades concluídas hoje. */
  done: number;
  /** Total de prioridades do dia. */
  total: number;
};

const SANS =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const INK = "#0A0A0A";
const MUTED = "#8A8D96";
const BLUE = "#335CFF";
const HAIRLINE = "#EDEDF0";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Card compartilhável de "Meu dia" — versão privada.
 *
 * Não exibe títulos de prioridades, compromissos, notas ou qualquer dado
 * pessoal da rotina. Mostra apenas o progresso agregado do dia, com a
 * mesma identidade visual premium dos cards iMAG.
 */
export async function drawDayCard(
  canvas: HTMLCanvasElement,
  data: DayCardData,
  format: DayCardFormat = "stories",
) {
  const { w: W, h: H } = DAY_FORMATS[format];
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;

  try {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    /* ignora */
  }

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  const cx = W / 2;
  const isStories = format === "stories";

  ctx.textAlign = "center";

  // --- Logo
  const logoY = isStories ? 280 : 180;
  try {
    const logo = await loadImage(imagLogoAsset.url);
    const logoH = 44;
    const logoW = logoH * (logo.width / logo.height);
    const off = document.createElement("canvas");
    off.width = Math.ceil(logoW);
    off.height = Math.ceil(logoH);
    const octx = off.getContext("2d")!;
    octx.drawImage(logo, 0, 0, logoW, logoH);
    octx.globalCompositeOperation = "source-in";
    octx.fillStyle = INK;
    octx.fillRect(0, 0, logoW, logoH);
    ctx.drawImage(off, cx - logoW / 2, logoY);
  } catch {
    ctx.fillStyle = INK;
    ctx.font = `600 40px ${SANS}`;
    ctx.fillText("iMAG", cx, logoY + 44);
  }

  // --- Título
  const titleY = isStories ? 460 : 320;
  ctx.fillStyle = INK;
  ctx.font = `600 ${isStories ? 78 : 68}px ${SANS}`;
  ctx.fillText("Meu dia", cx, titleY);

  // --- Elemento central: progresso
  const centerY = isStories ? 960 : 560;
  const total = Math.max(0, data.total);
  const done = Math.max(0, Math.min(data.done, total));

  // Linha fina acima do número
  const lineW = 88;
  ctx.save();
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - lineW / 2, centerY - 100);
  ctx.lineTo(cx + lineW / 2, centerY - 100);
  ctx.stroke();
  ctx.restore();

  // Número: "3/3"
  const numberSize = isStories ? 150 : 120;
  ctx.fillStyle = BLUE;
  ctx.font = `500 ${numberSize}px ${SANS}`;
  const numberText = total > 0 ? `${done}/${total}` : "0/0";
  ctx.fillText(numberText, cx, centerY);

  // Legenda
  const labelY = centerY + 52;
  ctx.fillStyle = MUTED;
  ctx.font = `400 ${isStories ? 30 : 26}px ${SANS}`;
  ctx.fillText("prioridades concluídas", cx, labelY);

  // --- Frase de fechamento
  const phraseY = isStories ? 1440 : 840;
  ctx.fillStyle = INK;
  ctx.font = `600 ${isStories ? 42 : 36}px ${SANS}`;
  const complete = total > 0 && done === total;
  ctx.fillText(complete ? "Dia concluído." : "Foco, direção e ação.", cx, phraseY);

  // --- Rodapé
  ctx.fillStyle = MUTED;
  ctx.font = `500 24px ${SANS}`;
  ctx.letterSpacing = "4px";
  ctx.fillText("imag.net.br", cx, H - 78);
  ctx.letterSpacing = "0px";
}
