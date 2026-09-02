import imagLogoAsset from "@/assets/imag-logo.png.asset.json";

export type CampoCardData = {
  total: number;
  level: string;
  focus: number;
  consistency: number;
  authority: number;
  magnetism: number;
};

const SIZE = 1080;
const BLUE = "#335CFF";
const INK = "#0A0A0A";
const MUTED = "#6E6E73";
const TRACK = "#EEF4FF";
const SANS =
  "Geist, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif";

const RINGS: { key: keyof Omit<CampoCardData, "total" | "level">; grad: [string, string] }[] = [
  { key: "focus", grad: ["#335CFF", "#5C7CFF"] },
  { key: "consistency", grad: ["#2A56C6", "#4F7BF0"] },
  { key: "authority", grad: ["#3B72E8", "#6C9BFF"] },
  { key: "magnetism", grad: ["#6C9BFF", "#A8C4FF"] },
];

const LABELS: Record<string, { label: string; color: string }> = {
  focus: { label: "Foco", color: "#335CFF" },
  consistency: { label: "Consistência", color: "#2A56C6" },
  authority: { label: "Execução", color: "#3B72E8" },
  magnetism: { label: "Impacto", color: "#6C9BFF" },
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n || 0)));
}

/** Ícones vetoriais discretos (mesma linguagem do app: Target, Flame, Shield, Magnet). */
function drawIcon(
  ctx: CanvasRenderingContext2D,
  key: string,
  cx: number,
  cy: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const r = 15;
  if (key === "focus") {
    [r, r * 0.62, r * 0.24].forEach((rr, i) => {
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      if (i === 2) ctx.fill();
      else ctx.stroke();
    });
  } else if (key === "consistency") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.bezierCurveTo(cx + r, cy - r * 0.2, cx + r * 0.7, cy + r, cx, cy + r);
    ctx.bezierCurveTo(cx - r * 0.7, cy + r, cx - r, cy - r * 0.2, cx, cy - r);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.35, r * 0.36, 0, Math.PI * 2);
    ctx.fill();
  } else if (key === "authority") {
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.42, cy + r * 0.04);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.38);
    ctx.lineTo(cx + r * 0.46, cy - r * 0.32);
    ctx.stroke();
  } else {
    // impacto — seta de crescimento
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.9, cy + r * 0.55);
    ctx.lineTo(cx - r * 0.2, cy - r * 0.15);
    ctx.lineTo(cx + r * 0.18, cy + r * 0.23);
    ctx.lineTo(cx + r * 0.9, cy - r * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + r * 0.34, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.9, cy - r * 0.5);
    ctx.lineTo(cx + r * 0.9, cy + r * 0.06);
    ctx.stroke();
  }
  ctx.restore();
}

export async function drawCampoCard(
  canvas: HTMLCanvasElement,
  data: CampoCardData,
): Promise<void> {
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // Garante que a tipografia do app esteja carregada antes de rasterizar
  try {
    await (document as Document & { fonts?: FontFaceSet }).fonts?.ready;
  } catch {
    /* ignora */
  }

  // Fundo branco
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, SIZE, SIZE);

  const cx = SIZE / 2;
  const cy = 560;

  // Halo magnético discreto
  const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, 400);
  halo.addColorStop(0, "rgba(51, 92, 255,0.09)");
  halo.addColorStop(0.5, "rgba(51, 92, 255,0.03)");
  halo.addColorStop(1, "rgba(51, 92, 255,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, cy, 400, 0, Math.PI * 2);
  ctx.fill();

  // Logo
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
    octx.fillStyle = BLUE;
    octx.fillRect(0, 0, logoW, logoH);
    ctx.drawImage(off, cx - logoW / 2, 92);
  } catch {
    ctx.fillStyle = BLUE;
    ctx.font = `600 40px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText("iMAG", cx, 132);
  }

  // Eyebrow
  ctx.textAlign = "center";
  ctx.fillStyle = BLUE;
  ctx.font = `600 20px ${SANS}`;
  const eyebrow = "CAMPO MAGNÉTICO";
  ctx.save();
  let x = cx - measureTracked(ctx, eyebrow, 6) / 2;
  for (const ch of eyebrow) {
    ctx.textAlign = "left";
    ctx.fillText(ch, x, 190);
    x += ctx.measureText(ch).width + 6;
  }
  ctx.restore();

  // Anéis (≈70% da imagem)
  const stroke = 40;
  const gap = 20;
  const outerR = 330;
  ctx.lineCap = "round";
  RINGS.forEach((ring, i) => {
    const r = outerR - i * (stroke + gap);
    const v = clamp(data[ring.key]);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.lineWidth = stroke;
    ctx.strokeStyle = TRACK;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    if (v > 0) {
      const g = ctx.createLinearGradient(-r, -r, r, r);
      g.addColorStop(0, ring.grad[0]);
      g.addColorStop(1, ring.grad[1]);
      ctx.strokeStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, (Math.PI * 2 * v) / 100);
      ctx.stroke();
    }
    ctx.restore();
  });

  // Centro
  ctx.textAlign = "center";
  ctx.fillStyle = BLUE;
  ctx.font = `600 132px ${SANS}`;
  ctx.fillText(String(clamp(data.total)), cx, cy + 18);
  ctx.fillStyle = INK;
  ctx.font = `500 27px ${SANS}`;
  ctx.fillText("Campo Magnético", cx, cy + 66);
  ctx.fillStyle = BLUE;
  ctx.font = `500 26px ${SANS}`;
  ctx.fillText(`${data.level}`, cx, cy + 108);

  // Indicadores
  const baseY = 900;
  const colW = SIZE / 4;
  RINGS.forEach((ring, i) => {
    const ccx = colW * i + colW / 2;
    const meta = LABELS[ring.key];
    if (i > 0) {
      ctx.strokeStyle = "#F0F0F3";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(colW * i, baseY - 34);
      ctx.lineTo(colW * i, baseY + 46);
      ctx.stroke();
    }
    drawIcon(ctx, ring.key, ccx, baseY - 12, meta.color);
    ctx.textAlign = "center";
    ctx.fillStyle = BLUE;
    ctx.font = `600 36px ${SANS}`;
    ctx.fillText(String(clamp(data[ring.key])), ccx, baseY + 26);
    ctx.fillStyle = MUTED;
    ctx.font = `500 17px ${SANS}`;
    ctx.fillText(meta.label.toUpperCase(), ccx, baseY + 54);
  });

  // Rodapé
  ctx.textAlign = "center";
  ctx.fillStyle = INK;
  ctx.font = `500 26px ${SANS}`;
  ctx.fillText("Menos ruído. Mais direção.", cx, 1000);
  ctx.fillStyle = "#8A8A90";
  ctx.font = `500 20px ${SANS}`;
  ctx.fillText("iMAG • Inteligência Magnética", cx, 1036);
}

function measureTracked(ctx: CanvasRenderingContext2D, text: string, tracking: number) {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + tracking;
  return w - tracking;
}
