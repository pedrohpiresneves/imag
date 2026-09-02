import imagLogoAsset from "@/assets/imag-logo.png.asset.json";

export type WeeklyCardData = {
  received: number;
  executed: number;
  impacts: number;
  activeDays: number;
  mainMovement: string | null;
  deltaPct: number | null;
  field: { focus: number; consistency: number; authority: number; magnetism: number } | null;
};

const SANS =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const INK = "#0A0A0A";
const MUTED = "#8A8D96";
const HAIRLINE = "#EDEDF0";
const BLUE = "#335CFF";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function ring(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  pct: number,
  width: number,
  alpha: number,
) {
  ctx.save();
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.strokeStyle = HAIRLINE;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = BLUE;
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * Math.max(2, pct)) / 100);
  ctx.stroke();
  ctx.restore();
}

/** Card "Minha semana na iMAG" — Stories 1080x1920. */
export async function drawWeeklyCard(canvas: HTMLCanvasElement, data: WeeklyCardData) {
  const W = 1080;
  const H = 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = W;
  canvas.height = H;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, W, H);

  const margin = 104;
  const cx = W / 2;
  ctx.textAlign = "center";

  // Logo
  let y = 190;
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
    ctx.drawImage(off, cx - logoW / 2, y - logoH);
  } catch {
    ctx.fillStyle = INK;
    ctx.font = `600 40px ${SANS}`;
    ctx.fillText("iMAG", cx, y);
  }

  // Título
  y += 150;
  ctx.fillStyle = INK;
  ctx.font = `600 76px ${SANS}`;
  ctx.fillText("Minha semana", cx, y);
  y += 88;
  ctx.fillStyle = BLUE;
  ctx.fillText("na iMAG", cx, y);

  // Anéis do Campo
  y += 300;
  if (data.field) {
    const f = data.field;
    ring(ctx, cx, y, 210, f.magnetism, 22, 1);
    ring(ctx, cx, y, 168, f.authority, 20, 0.78);
    ring(ctx, cx, y, 126, f.consistency, 18, 0.56);
    ring(ctx, cx, y, 86, f.focus, 16, 0.36);
    if (data.deltaPct != null) {
      ctx.fillStyle = data.deltaPct >= 0 ? BLUE : MUTED;
      ctx.font = `600 60px ${SANS}`;
      ctx.fillText(`${data.deltaPct >= 0 ? "+" : ""}${data.deltaPct}%`, cx, y + 12);
    }
  }
  y += 300;

  // Métricas em grade 2x2
  const stats: Array<[string, string]> = [
    ["Direções recebidas", String(data.received)],
    ["Executadas", String(data.executed)],
    ["Impactos gerados", String(data.impacts)],
    ["Dias em movimento", String(data.activeDays)],
  ];
  const colX = [margin + (W - margin * 2) / 4, W - margin - (W - margin * 2) / 4];
  stats.forEach(([label, value], i) => {
    const x = colX[i % 2]!;
    const ry = y + Math.floor(i / 2) * 190;
    ctx.fillStyle = INK;
    ctx.font = `600 86px ${SANS}`;
    ctx.fillText(value, x, ry);
    ctx.fillStyle = MUTED;
    ctx.font = `400 28px ${SANS}`;
    ctx.fillText(label, x, ry + 48);
  });
  y += 190 + 110;

  if (data.mainMovement) {
    ctx.strokeStyle = HAIRLINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, y - 60);
    ctx.lineTo(W - margin, y - 60);
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.font = `600 24px ${SANS}`;
    ctx.letterSpacing = "3px";
    ctx.fillText("PRINCIPAL MOVIMENTO", cx, y);
    ctx.letterSpacing = "0px";
    ctx.fillStyle = BLUE;
    ctx.font = `500 52px ${SANS}`;
    ctx.fillText(data.mainMovement, cx, y + 68);
  }

  // Rodapé
  const footSize = 34;
  const footY = H - 200;
  ctx.fillStyle = INK;
  ctx.font = `500 ${footSize}px ${SANS}`;
  ctx.fillText("Menos ruído.", cx, footY);
  ctx.fillStyle = BLUE;
  ctx.fillText("Mais direção.", cx, footY + footSize * 1.32);
  ctx.fillStyle = MUTED;
  ctx.font = `500 24px ${SANS}`;
  ctx.letterSpacing = "4px";
  ctx.fillText("iMAG", cx, H - 78);
  ctx.letterSpacing = "0px";
}