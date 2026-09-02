import imagLogoAsset from "@/assets/imag-logo.png.asset.json";

export type ImpactCardData = {
  profession: string;
  metaText: string;
  impactText: string;
  authorName?: string | null;
};

export type ImpactCardFormat = "stories" | "square" | "feed";

export const IMPACT_FORMATS: Record<ImpactCardFormat, { w: number; h: number; label: string }> = {
  stories: { w: 1080, h: 1920, label: "Stories" },
  square: { w: 1080, h: 1080, label: "Quadrado" },
  feed: { w: 1080, h: 1350, label: "Feed" },
};

const SANS =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const INK = "#0A0A0A";
const MUTED = "#8A8D96";
const HAIRLINE = "#EDEDF0";
const BLUE = "#335CFF";

/** Primeira letra maiúscula, restante em minúsculas. */
function sentenceCase(text: string) {
  const t = text.trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Reduz a fonte até o texto caber em `maxLines` linhas. Nunca corta conteúdo. */
function fitLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  weight: number,
  maxLines: number,
  minSize: number,
): { lines: string[]; size: number } {
  let s = size;
  for (;;) {
    ctx.font = `${weight} ${s}px ${SANS}`;
    const lines = wrap(ctx, text, maxWidth);
    if (lines.length <= maxLines || s <= minSize) return { lines, size: s };
    s -= 2;
  }
}

function drawCheckMark(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  // Ondas sutis
  ctx.save();
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, r + i * r * 0.42, 0, Math.PI * 2);
    ctx.strokeStyle = BLUE;
    ctx.globalAlpha = 0.1 / i;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.strokeStyle = BLUE;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = r * 0.14;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.36, cy + r * 0.03);
  ctx.lineTo(cx - r * 0.08, cy + r * 0.3);
  ctx.lineTo(cx + r * 0.38, cy - r * 0.3);
  ctx.stroke();
  ctx.restore();
}

function drawUserIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
  ctx.save();
  ctx.strokeStyle = MUTED;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.28, s * 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy + s * 0.62, s * 0.6, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();
}

function hairline(ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number) {
  ctx.save();
  ctx.strokeStyle = HAIRLINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.restore();
}

/** Renderiza o card de impacto em qualquer um dos 3 formatos, adaptando escala e respiro. */
export async function drawImpactCardFormat(
  canvas: HTMLCanvasElement,
  data: ImpactCardData,
  format: ImpactCardFormat = "feed",
) {
  const { w: W, h: H } = IMPACT_FORMATS[format];
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  const margin = 104;
  const contentW = W - margin * 2;
  const cx = W / 2;
  // Fator de respiro: stories tem muito espaço, quadrado é apertado.
  const air = format === "stories" ? 1.5 : format === "feed" ? 1.05 : 0.78;

  ctx.textAlign = "center";

  // --- Topo: logo
  let y = Math.round(120 * air) + 40;
  try {
    const logo = await loadImage(imagLogoAsset.url);
    const logoH = 46;
    const logoW = logoH * (logo.width / logo.height);
    const off = document.createElement("canvas");
    off.width = Math.ceil(logoW);
    off.height = Math.ceil(logoH);
    const octx = off.getContext("2d")!;
    octx.drawImage(logo, 0, 0, logoW, logoH);
    octx.globalCompositeOperation = "source-in";
    octx.fillStyle = INK;
    octx.fillRect(0, 0, logoW, logoH);
    ctx.drawImage(off, cx - logoW / 2, y - logoH);
  } catch {
    ctx.fillStyle = INK;
    ctx.font = `600 40px ${SANS}`;
    ctx.fillText("iMAG", cx, y);
  }

  // --- Check com ondas
  const ringR = 52;
  y += Math.round(96 * air) + ringR;
  drawCheckMark(ctx, cx, y, ringR);
  y += ringR;

  // --- Título
  const titleSize = format === "square" ? 68 : 78;
  y += Math.round(110 * air);
  ctx.fillStyle = INK;
  ctx.font = `600 ${titleSize}px ${SANS}`;
  ctx.fillText("Uma direção", cx, y);
  y += titleSize * 1.16;
  const w1 = ctx.measureText("gerou ").width;
  const w2 = ctx.measureText("resultado.").width;
  const startX = cx - (w1 + w2) / 2;
  ctx.textAlign = "left";
  ctx.fillStyle = INK;
  ctx.fillText("gerou ", startX, y);
  ctx.fillStyle = BLUE;
  ctx.fillText("resultado.", startX + w1, y);
  ctx.textAlign = "center";

  // --- Blocos de informação (linhas finas, sem caixas)
  const labelSize = 24;
  y += Math.round(120 * air);

  hairline(ctx, margin, W - margin, y);
  y += Math.round(58 * air) + 6;
  ctx.fillStyle = MUTED;
  ctx.font = `600 ${labelSize}px ${SANS}`;
  ctx.letterSpacing = "3px";
  ctx.fillText("MAG META", cx, y);
  ctx.letterSpacing = "0px";
  y += 54;
  const meta = fitLines(ctx, sentenceCase(data.metaText), contentW, format === "square" ? 42 : 46, 400, 3, 32);
  ctx.fillStyle = INK;
  ctx.font = `400 ${meta.size}px ${SANS}`;
  meta.lines.forEach((l, i) => ctx.fillText(l, cx, y + i * meta.size * 1.35));
  y += (meta.lines.length - 1) * meta.size * 1.35 + Math.round(60 * air) + 12;

  hairline(ctx, margin, W - margin, y);
  y += Math.round(58 * air) + 6;
  ctx.fillStyle = MUTED;
  ctx.font = `600 ${labelSize}px ${SANS}`;
  ctx.letterSpacing = "3px";
  ctx.fillText("IMPACTO", cx, y);
  ctx.letterSpacing = "0px";
  y += 62;
  const imp = fitLines(ctx, data.impactText, contentW, format === "square" ? 54 : 60, 500, 3, 38);
  ctx.fillStyle = BLUE;
  ctx.font = `500 ${imp.size}px ${SANS}`;
  imp.lines.forEach((l, i) => ctx.fillText(l, cx, y + i * imp.size * 1.32));
  y += (imp.lines.length - 1) * imp.size * 1.32 + Math.round(58 * air) + 12;

  hairline(ctx, margin, W - margin, y);

  // --- Identificação
  y += Math.round(56 * air) + 14;
  const author = data.authorName?.trim() || data.profession;
  ctx.font = `400 28px ${SANS}`;
  const aw = ctx.measureText(author).width;
  drawUserIcon(ctx, cx - aw / 2 - 26, y - 10, 16);
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.fillText(author, cx - aw / 2, y);
  ctx.textAlign = "center";

  // --- Rodapé
  const footSize = 34;
  const footY = H - Math.round(120 + 40 * air);
  ctx.fillStyle = INK;
  ctx.font = `500 ${footSize}px ${SANS}`;
  ctx.fillText("Menos ruído.", cx, footY);
  ctx.fillStyle = BLUE;
  ctx.fillText("Mais movimento.", cx, footY + footSize * 1.32);

  ctx.fillStyle = MUTED;
  ctx.font = `500 24px ${SANS}`;
  ctx.letterSpacing = "4px";
  ctx.fillText("iMAG", cx, H - 78);
  ctx.letterSpacing = "0px";
}

/** Stories 1080x1920. */
export async function drawImpactCard(canvas: HTMLCanvasElement, data: ImpactCardData) {
  await drawImpactCardFormat(canvas, data, "stories");
}

/** Feed 1080x1350. */
export async function drawImpactPostCard(canvas: HTMLCanvasElement, data: ImpactCardData) {
  await drawImpactCardFormat(canvas, data, "feed");
}
