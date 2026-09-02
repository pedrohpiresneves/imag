import imagLogoAsset from "@/assets/imag-logo.png.asset.json";

export type ShareTemplateId = "checkin" | "streak" | "level" | "result" | "week";

export type ShareFormat = "story" | "square";

export type ShareOptions = {
  background: "white" | "blue";
  showNumbers: boolean;
  onlyPhrase: boolean;
  hideMetaText: boolean;
  format?: ShareFormat;
};

export type ShareData = {
  userFirstName?: string;
  level?: { name: string; rings?: number };
  field?: {
    total: number;
    focus: number;
    consistency: number;
    authority: number;
    magnetism: number;
  };
  phrase?: string;
  streak?: number;
  missionsTotal?: number;
  missionsWeek?: number;
  actionsWeek?: number;
  opportunitiesWeek?: number;
  checkinsWeek?: number;
  metaText?: string;
  resultOpportunities?: number;
};

export const TEMPLATES: { id: ShareTemplateId; label: string }[] = [
  { id: "checkin", label: "Check-in" },
  { id: "streak", label: "Sequência" },
  { id: "level", label: "Nível" },
  { id: "result", label: "Resultado" },
  { id: "week", label: "Semana" },
];

const STORY_W = 1080;
const STORY_H = 1920;
const SQUARE_SIZE = 1080;
let W = STORY_W;
let H = STORY_H;

const SANS =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

type Palette = {
  bg: string;
  ink: string;
  muted: string;
  accent: string;
  badgeBg: string;
  ringSoft: string;
  ringSofter: string;
  logo: string;
  footer: string;
};

function palette(bg: "white" | "blue"): Palette {
  if (bg === "blue") {
    return {
      bg: "#335CFF",
      ink: "#FFFFFF",
      muted: "rgba(255,255,255,0.72)",
      accent: "#FFFFFF",
      badgeBg: "rgba(255,255,255,0.12)",
      ringSoft: "rgba(255,255,255,0.24)",
      ringSofter: "rgba(255,255,255,0.12)",
      logo: "#FFFFFF",
      footer: "rgba(255,255,255,0.6)",
    };
  }
  return {
    bg: "#FFFFFF",
    ink: "#0A0A0A",
    muted: "#6B6B70",
    accent: "#335CFF",
    badgeBg: "#F5F6F8",
    ringSoft: "rgba(51, 92, 255,0.10)",
    ringSofter: "rgba(51, 92, 255,0.055)",
    logo: "#335CFF",
    footer: "#8A8A90",
  };
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

async function drawLogo(ctx: CanvasRenderingContext2D, p: Palette, y = 220) {
  try {
    const logo = await loadImage(imagLogoAsset.url);
    const logoH = 88;
    const logoW = logoH * (logo.width / logo.height);
    const off = document.createElement("canvas");
    off.width = Math.ceil(logoW);
    off.height = Math.ceil(logoH);
    const octx = off.getContext("2d")!;
    octx.drawImage(logo, 0, 0, logoW, logoH);
    octx.globalCompositeOperation = "source-in";
    octx.fillStyle = p.logo;
    octx.fillRect(0, 0, logoW, logoH);
    ctx.drawImage(off, (W - logoW) / 2, y);
  } catch {
    ctx.fillStyle = p.logo;
    ctx.font = `600 64px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText("iMAG", W / 2, y + 60);
  }
}

function drawEyebrow(ctx: CanvasRenderingContext2D, p: Palette, text: string, y: number) {
  ctx.fillStyle = p.muted;
  ctx.font = `500 28px ${SANS}`;
  ctx.textAlign = "center";
  ctx.fillText(text, W / 2, y);
}

function drawHalo(ctx: CanvasRenderingContext2D, p: Palette, cx: number, cy: number, r = 250) {
  const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, r);
  const stop0 = p.bg === "#335CFF" ? "rgba(255,255,255,0.16)" : "rgba(51, 92, 255,0.10)";
  const stop1 = p.bg === "#335CFF" ? "rgba(255,255,255,0.04)" : "rgba(51, 92, 255,0.035)";
  const stop2 = p.bg === "#335CFF" ? "rgba(255,255,255,0)" : "rgba(51, 92, 255,0)";
  g.addColorStop(0, stop0);
  g.addColorStop(0.55, stop1);
  g.addColorStop(1, stop2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = p.ringSoft;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = p.ringSofter;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
  ctx.stroke();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawCheckBadge(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  text: string,
  y: number,
) {
  ctx.font = `500 32px ${SANS}`;
  const tw = ctx.measureText(text).width;
  const iconSize = 26;
  const gap = 14;
  const padX = 36;
  const bh = 72;
  const bw = tw + iconSize + gap + padX * 2;
  const bx = W / 2 - bw / 2;
  ctx.fillStyle = p.badgeBg;
  drawRoundedRect(ctx, bx, y, bw, bh, bh / 2);
  ctx.fill();

  const iconX = bx + padX;
  const iconY = y + bh / 2;
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(iconX, iconY + 1);
  ctx.lineTo(iconX + iconSize * 0.38, iconY + iconSize * 0.35);
  ctx.lineTo(iconX + iconSize, iconY - iconSize * 0.42);
  ctx.stroke();

  ctx.fillStyle = p.ink;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.fillText(text, iconX + iconSize + gap, iconY + 2);
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
}

function drawFooter(ctx: CanvasRenderingContext2D, p: Palette, brand: "imag" | "url") {
  ctx.fillStyle = p.footer;
  ctx.font = `500 26px ${SANS}`;
  ctx.textAlign = "center";
  ctx.fillText(brand === "url" ? "imag.net.br" : "iMAG", W / 2, H - 140);
}

function drawBrandPhrase(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  phrase: string,
  y = H - 260,
) {
  ctx.fillStyle = p.ink;
  ctx.font = `500 38px ${SANS}`;
  ctx.textAlign = "center";
  const lines = phrase.split("\n");
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + i * 52));
}

function drawCenteredText(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  color: string,
  size: number,
  weight = 500,
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${SANS}`;
  ctx.textAlign = "center";
  ctx.fillText(text, W / 2, y);
}

// ── Templates ───────────────────────────────────────────────

const FIELD_RINGS: {
  key: "focus" | "consistency" | "authority" | "magnetism";
  color: string;
}[] = [
  { key: "focus", color: "#335CFF" },
  { key: "consistency", color: "#6C8CFF" },
  { key: "authority", color: "#9DB2FF" },
  { key: "magnetism", color: "#C4D0FF" },
];

function clamp100(n: number) {
  return Math.max(0, Math.min(100, Math.round(n || 0)));
}

/**
 * Gráfico circular oficial do Campo Magnético (mesmos 4 anéis da tela "Campo"),
 * desenhado no canvas do card. Dados reais, sem valores fictícios.
 */
function drawFieldChart(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  field: NonNullable<ShareData["field"]>,
  cx: number,
  cy: number,
  outerR: number,
) {
  const stroke = outerR * 0.12;
  const gap = outerR * 0.06;
  const track = o_isBlue(p) ? "rgba(255,255,255,0.16)" : "#F1F4FC";

  ctx.save();
  ctx.lineCap = "round";
  FIELD_RINGS.forEach((ring, i) => {
    const r = outerR - i * (stroke + gap);
    const v = clamp100(field[ring.key]);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.lineWidth = stroke;
    ctx.strokeStyle = track;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    if (v > 0) {
      if (o_isBlue(p)) {
        ctx.strokeStyle = `rgba(255,255,255,${0.92 - i * 0.2})`;
      } else {
        ctx.strokeStyle = ring.color;
      }
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, (Math.PI * 2 * v) / 100);
      ctx.stroke();
    }
    ctx.restore();
  });
  ctx.restore();

  // Centro totalmente limpo (sem halo/preenchimento azulado)
  const innerR = outerR - 3 * (stroke + gap) - stroke * 0.65;
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0, innerR), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.fillStyle = p.bg;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.max(0, innerR), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Centro: apenas o número centralizado
  const numSize = Math.round(outerR * 0.24);
  const numText = String(clamp100(field.total));
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const baseY = cy + numSize * 0.34;
  ctx.fillStyle = p.accent;
  ctx.font = `600 ${numSize}px ${SANS}`;
  ctx.fillText(numText, cx, baseY);
  ctx.textAlign = "center";
}

const FIELD_METRICS: {
  key: "focus" | "consistency" | "authority" | "magnetism";
  label: string;
}[] = [
  { key: "focus", label: "Foco" },
  { key: "consistency", label: "Consistência" },
  { key: "authority", label: "Execução" },
  { key: "magnetism", label: "Impacto" },
];

/** Ícones vetoriais (mesma linguagem da tela Campo), monocromáticos. */
function drawMetricIcon(
  ctx: CanvasRenderingContext2D,
  key: string,
  cx: number,
  cy: number,
  r: number,
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.2);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
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
    ctx.arc(cx, cy + r * 0.35, r * 0.34, 0, Math.PI * 2);
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

/** Quatro métricas do Campo, distribuídas horizontalmente, em tamanho reduzido. */
function drawFieldMetrics(
  ctx: CanvasRenderingContext2D,
  p: Palette,
  field: NonNullable<ShareData["field"]>,
  y: number,
  scale = 1,
) {
  const colW = (W * 0.78) / FIELD_METRICS.length;
  const startX = W / 2 - (colW * FIELD_METRICS.length) / 2 + colW / 2;
  ctx.textAlign = "center";
  const numberColor = o_isBlue(p) ? "#FFFFFF" : "#111111";
  const iconColor = o_isBlue(p) ? "#FFFFFF" : "#335CFF";
  FIELD_METRICS.forEach((m, i) => {
    const x = startX + i * colW;
    drawMetricIcon(ctx, m.key, x, y - 10 * scale, 15 * scale, iconColor);
    ctx.fillStyle = numberColor;
    ctx.font = `600 ${Math.round(38 * scale)}px ${SANS}`;
    ctx.fillText(String(clamp100(field[m.key])), x, y + 52 * scale);
    ctx.fillStyle = p.muted;
    ctx.font = `500 ${Math.round(20 * scale)}px ${SANS}`;
    ctx.fillText(m.label, x, y + 90 * scale);
  });
}

function o_isBlue(p: Palette) {
  return p.bg === "#335CFF";
}

async function tCheckin(
  ctx: CanvasRenderingContext2D,
  d: ShareData,
  o: ShareOptions,
) {
  const p = palette(o.background);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);
  await drawLogo(ctx, p);

  const CY = H * 0.42;
  drawHalo(ctx, p, W / 2, CY - 40, 220);
  // Big check circle
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(W / 2, CY - 40, 90, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(W / 2 - 42, CY - 42);
  ctx.lineTo(W / 2 - 10, CY - 10);
  ctx.lineTo(W / 2 + 44, CY - 66);
  ctx.stroke();

  drawCenteredText(ctx, "MAG Meta", CY + 130, p.ink, 68, 500);
  drawCenteredText(ctx, "concluída ✓", CY + 210, p.accent, 68, 600);

  if (!o.onlyPhrase) {
    const metaLine =
      d.metaText && !o.hideMetaText
        ? truncate(d.metaText, 44)
        : "Hoje eu cumpri o que precisava.";
    drawCenteredText(ctx, metaLine, CY + 320, p.muted, 32, 400);
  }

  drawBrandPhrase(ctx, p, "Menos ruído.\nMais direção.", H - 340);
  drawFooter(ctx, p, "imag");
}

async function tStreak(
  ctx: CanvasRenderingContext2D,
  d: ShareData,
  o: ShareOptions,
) {
  const p = palette(o.background);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);
  await drawLogo(ctx, p);

  const streak = d.streak;
  const missions = d.missionsTotal ?? d.missionsWeek;

  if (o.onlyPhrase) {
    drawBrandPhrase(ctx, p, "Menos ruído.\nMais direção.", H / 2 - 40);
  } else if (streak === undefined) {
    // Sem dado real de sequência — usa apenas frase de marca.
    drawBrandPhrase(ctx, p, "Menos ruído.\nMais direção.", H / 2 - 40);
  } else {
    drawEyebrow(
      ctx,
      p,
      `${streak} ${streak === 1 ? "DIA" : "DIAS"} EM MOVIMENTO`.toUpperCase(),
      460,
    );

    if (o.showNumbers) {
      drawHalo(ctx, p, W / 2, 780, 260);
      drawCenteredText(ctx, String(streak), 890, p.accent, 320, 600);
      drawCenteredText(
        ctx,
        streak === 1 ? "dia de consistência" : "dias de consistência",
        970,
        p.muted,
        32,
        500,
      );

      if (missions !== undefined && missions > 0) {
        // divider
        ctx.strokeStyle = p.ringSoft;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(W / 2 - 40, 1040);
        ctx.lineTo(W / 2 + 40, 1040);
        ctx.stroke();

        drawCenteredText(ctx, String(missions), 1180, p.ink, 200, 600);
        drawCenteredText(
          ctx,
          missions === 1 ? "meta concluída" : "metas concluídas",
          1250,
          p.muted,
          30,
          500,
        );
      }
    } else {
      drawCenteredText(ctx, "Consistência em movimento.", 900, p.ink, 52, 500);
    }

    drawBrandPhrase(ctx, p, d.phrase ?? "Menos ruído.\nMais direção.", H - 340);
  }

  drawFooter(ctx, p, "url");
}

async function tLevel(
  ctx: CanvasRenderingContext2D,
  d: ShareData,
  o: ShareOptions,
) {
  const p = palette(o.background);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);
  await drawLogo(ctx, p);

  const levelName = d.level?.name ?? "Coletando dados";
  const streak = d.streak;
  const missions = d.missionsTotal ?? d.missionsWeek;

  drawEyebrow(ctx, p, "CAMPO MAGNÉTICO", 460);
  drawCenteredText(ctx, levelName, 560, p.accent, 74, 600);

  if (!o.onlyPhrase && d.field) {
    // Gráfico do Campo Magnético como elemento central (~42% da altura)
    const outerR = 400;
    const cy = 1060;
    drawFieldChart(ctx, p, d.field, W / 2, cy, outerR);
    drawFieldMetrics(ctx, p, d.field, 1650, 1.15);
    drawFooter(ctx, p, "url");
    return;
  } else if (!o.onlyPhrase && o.showNumbers && streak !== undefined) {
    drawHalo(ctx, p, W / 2, 880, 240);
    drawCenteredText(ctx, String(streak), 950, p.ink, 200, 600);
    drawCenteredText(
      ctx,
      streak === 1 ? "dia de consistência" : "dias de consistência",
      1040,
      p.muted,
      30,
      500,
    );
    if (missions !== undefined && missions > 0) {
      drawCheckBadge(
        ctx,
        p,
        `${missions} ${missions === 1 ? "meta concluída" : "metas concluídas"}`,
        1150,
      );
    }
  } else if (o.onlyPhrase) {
    // just phrase
  } else {
    drawCenteredText(ctx, "Seu campo está em expansão.", 900, p.ink, 48, 500);
  }

  drawBrandPhrase(ctx, p, d.phrase ?? "Meu campo está se expandindo.", H - 260);
  drawFooter(ctx, p, "url");
}

async function tResult(
  ctx: CanvasRenderingContext2D,
  d: ShareData,
  o: ShareOptions,
) {
  const p = palette(o.background);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);
  await drawLogo(ctx, p);

  const n = d.resultOpportunities;

  drawCenteredText(ctx, "UMA AÇÃO.", 470, p.ink, 42, 600);
  drawCenteredText(ctx, "UM NOVO RESULTADO.", 520, p.accent, 42, 600);

  if (!o.onlyPhrase && n !== undefined) {
    drawCenteredText(ctx, "A meta de hoje gerou:", 640, p.muted, 32, 400);
    drawHalo(ctx, p, W / 2, 900, 220);

    // trend arrow icon (small, above number)
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(W / 2 - 60, 830);
    ctx.lineTo(W / 2 - 20, 790);
    ctx.lineTo(W / 2 + 20, 820);
    ctx.lineTo(W / 2 + 70, 760);
    ctx.stroke();
    // arrow head
    ctx.beginPath();
    ctx.moveTo(W / 2 + 40, 760);
    ctx.lineTo(W / 2 + 70, 760);
    ctx.lineTo(W / 2 + 70, 790);
    ctx.stroke();

    if (o.showNumbers) {
      drawCenteredText(ctx, String(n), 990, p.accent, 220, 600);
      drawCenteredText(
        ctx,
        n === 1 ? "nova oportunidade" : "novas oportunidades",
        1090,
        p.muted,
        32,
        500,
      );
    } else {
      drawCenteredText(ctx, "Algo se movimentou hoje.", 990, p.ink, 46, 500);
    }
  } else if (!o.onlyPhrase) {
    drawCenteredText(ctx, "Algo se movimentou hoje.", 900, p.ink, 46, 500);
  }

  drawBrandPhrase(
    ctx,
    p,
    "Pequenas ações também\nmovimentam negócios.",
    H - 340,
  );
  drawFooter(ctx, p, "imag");
}

async function tWeek(
  ctx: CanvasRenderingContext2D,
  d: ShareData,
  o: ShareOptions,
) {
  const p = palette(o.background);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);
  await drawLogo(ctx, p);

  drawEyebrow(ctx, p, "MINHA SEMANA", 460);
  drawCenteredText(ctx, "EM MOVIMENTO", 510, p.accent, 34, 600);

  if (o.onlyPhrase) {
    drawBrandPhrase(ctx, p, "Consistência também\npode ser medida.", H / 2 - 40);
    drawFooter(ctx, p, "url");
    return;
  }

  const allRows: { icon: "check" | "users" | "star"; num: number | undefined; label: (n: number) => string }[] = [
    { icon: "check", num: d.missionsWeek, label: (n) => (n === 1 ? "meta concluída" : "metas concluídas") },
    { icon: "users", num: d.actionsWeek, label: (n) => (n === 1 ? "ação de visibilidade" : "ações de visibilidade") },
    { icon: "star", num: d.opportunitiesWeek, label: (n) => (n === 1 ? "oportunidade gerada" : "oportunidades geradas") },
  ];
  const rows = allRows.filter((r) => r.num !== undefined && r.num > 0) as {
    icon: "check" | "users" | "star";
    num: number;
    label: (n: number) => string;
  }[];

  if (rows.length === 0 && (d.checkinsWeek ?? 0) > 0) {
    rows.push({
      icon: "check",
      num: d.checkinsWeek!,
      label: (n) => (n === 1 ? "check-in feito" : "check-ins feitos"),
    });
  }

  if (rows.length === 0) {
    drawBrandPhrase(ctx, p, "Consistência também\npode ser medida.", H / 2 - 40);
    drawFooter(ctx, p, "url");
    return;
  }

  const startY = rows.length === 1 ? 900 : rows.length === 2 ? 800 : 720;
  const rowH = 200;
  rows.forEach((r, i) => {
    const y = startY + i * rowH;
    // icon box
    const boxSize = 92;
    const bx = W / 2 - 260;
    const by = y - boxSize / 2;
    ctx.fillStyle = p.badgeBg;
    drawRoundedRect(ctx, bx, by, boxSize, boxSize, 22);
    ctx.fill();
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (r.icon === "check") {
      ctx.beginPath();
      ctx.moveTo(bx + 26, by + 50);
      ctx.lineTo(bx + 42, by + 66);
      ctx.lineTo(bx + 68, by + 34);
      ctx.stroke();
    } else if (r.icon === "users") {
      ctx.beginPath();
      ctx.arc(bx + 36, by + 40, 12, 0, Math.PI * 2);
      ctx.arc(bx + 58, by + 40, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx + 22, by + 70);
      ctx.quadraticCurveTo(bx + 46, by + 56, bx + 70, by + 70);
      ctx.stroke();
    } else {
      // star
      ctx.beginPath();
      const cx = bx + boxSize / 2;
      const cy = by + boxSize / 2;
      for (let k = 0; k < 5; k++) {
        const a = (Math.PI / 2) + (k * 2 * Math.PI) / 5;
        const px = cx + Math.cos(a) * 26;
        const py = cy - Math.sin(a) * 26;
        if (k === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }

    // number
    if (o.showNumbers) {
      ctx.fillStyle = p.accent;
      ctx.font = `600 96px ${SANS}`;
      ctx.textAlign = "left";
      ctx.fillText(String(r.num), bx + boxSize + 40, y + 24);
    }

    // label
    ctx.fillStyle = p.ink;
    ctx.font = `500 32px ${SANS}`;
    ctx.textAlign = "left";
    ctx.fillText(r.label(r.num), bx + boxSize + 40 + (o.showNumbers ? 140 : 0), y + 12);
  });

  ctx.textAlign = "center";
  drawBrandPhrase(ctx, p, "Consistência também\npode ser medida.", H - 340);
  drawFooter(ctx, p, "url");
}

function truncate(s: string, n: number) {
  const t = s.trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
}

export async function drawShareCard(
  canvas: HTMLCanvasElement,
  template: ShareTemplateId,
  data: ShareData,
  options: ShareOptions,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const format = options.format ?? "story";
  if (format === "square") {
    W = SQUARE_SIZE;
    H = SQUARE_SIZE;
  } else {
    W = STORY_W;
    H = STORY_H;
  }
  canvas.width = W;
  canvas.height = H;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  if (format === "square") {
    return drawSquare(ctx, template, data, options);
  }

  switch (template) {
    case "checkin":
      return tCheckin(ctx, data, options);
    case "streak":
      return tStreak(ctx, data, options);
    case "level":
      return tLevel(ctx, data, options);
    case "result":
      return tResult(ctx, data, options);
    case "week":
      return tWeek(ctx, data, options);
  }
}

// ── Square (1:1) unified layout ─────────────────────────────

type SquareContent = {
  eyebrow: string;
  title?: string;
  bigNumber?: string;
  bigLabel?: string;
  badgeText?: string;
  phrase: string;
  footer: "imag" | "url";
};

function squareContent(
  template: ShareTemplateId,
  d: ShareData,
  o: ShareOptions,
): SquareContent {
  switch (template) {
    case "checkin": {
      const meta =
        d.metaText && !o.hideMetaText
          ? truncate(d.metaText, 44)
          : "Hoje eu cumpri o que precisava.";
      return {
        eyebrow: "MAG META",
        title: "Concluída",
        bigLabel: o.onlyPhrase ? undefined : meta,
        phrase: "Menos ruído. Mais direção.",
        footer: "imag",
      };
    }
    case "streak": {
      const s = d.streak;
      if (s === undefined) {
        return {
          eyebrow: "MOVIMENTO",
          phrase: d.phrase ?? "Menos ruído. Mais direção.",
          footer: "url",
        };
      }
      const missions = d.missionsTotal ?? d.missionsWeek;
      return {
        eyebrow: `${s} ${s === 1 ? "DIA" : "DIAS"} EM MOVIMENTO`,
        bigNumber: o.onlyPhrase || !o.showNumbers ? undefined : String(s),
        bigLabel:
          o.onlyPhrase
            ? undefined
            : s === 1
              ? "dia de consistência"
              : "dias de consistência",
        badgeText:
          !o.onlyPhrase && o.showNumbers && missions !== undefined && missions > 0
            ? `${missions} ${missions === 1 ? "meta concluída" : "metas concluídas"}`
            : undefined,
        phrase: d.phrase ?? "Menos ruído. Mais direção.",
        footer: "url",
      };
    }
    case "level": {
      const s = d.streak;
      const m = d.missionsTotal ?? d.missionsWeek;
      return {
        eyebrow: "CAMPO MAGNÉTICO",
        title: d.level?.name ?? "Coletando dados",
        bigNumber:
          o.onlyPhrase || !o.showNumbers || s === undefined ? undefined : String(s),
        bigLabel:
          o.onlyPhrase || s === undefined
            ? undefined
            : s === 1
              ? "dia de consistência"
              : "dias de consistência",
        badgeText:
          !o.onlyPhrase && o.showNumbers && m !== undefined && m > 0
            ? `${m} ${m === 1 ? "meta concluída" : "metas concluídas"}`
            : undefined,
        phrase: d.phrase ?? "Meu campo está mudando.",
        footer: "url",
      };
    }
    case "result": {
      const n = d.resultOpportunities;
      if (n === undefined) {
        return {
          eyebrow: "UMA AÇÃO. UM NOVO RESULTADO.",
          bigLabel: o.onlyPhrase ? undefined : "Algo se movimentou hoje.",
          phrase: "Pequenas ações movimentam negócios.",
          footer: "imag",
        };
      }
      return {
        eyebrow: "UMA AÇÃO. UM NOVO RESULTADO.",
        bigNumber: o.onlyPhrase || !o.showNumbers ? undefined : String(n),
        bigLabel:
          o.onlyPhrase
            ? undefined
            : n === 1
              ? "nova oportunidade"
              : "novas oportunidades",
        phrase: "Pequenas ações movimentam negócios.",
        footer: "imag",
      };
    }
    case "week": {
      const m = d.missionsWeek ?? d.checkinsWeek;
      const isCheckins = d.missionsWeek === undefined && (d.checkinsWeek ?? 0) > 0;
      if (m === undefined || m === 0) {
        return {
          eyebrow: "MINHA SEMANA",
          phrase: "Consistência também pode ser medida.",
          footer: "url",
        };
      }
      return {
        eyebrow: "MINHA SEMANA EM MOVIMENTO",
        bigNumber: o.onlyPhrase || !o.showNumbers ? undefined : String(m),
        bigLabel:
          o.onlyPhrase
            ? undefined
            : isCheckins
              ? m === 1
                ? "check-in feito"
                : "check-ins feitos"
              : m === 1
                ? "meta concluída"
                : "metas concluídas",
        badgeText:
          !o.onlyPhrase && o.showNumbers && d.opportunitiesWeek !== undefined && d.opportunitiesWeek > 0
            ? `${d.opportunitiesWeek} ${d.opportunitiesWeek === 1 ? "oportunidade" : "oportunidades"}`
            : undefined,
        phrase: "Consistência também pode ser medida.",
        footer: "url",
      };
    }
  }
}

async function drawSquare(
  ctx: CanvasRenderingContext2D,
  template: ShareTemplateId,
  d: ShareData,
  o: ShareOptions,
) {
  const p = palette(o.background);
  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, W, H);

  const c = squareContent(template, d, o);

  // Logo (top)
  await drawLogoAt(ctx, p, 130, 64);

  // Eyebrow
  ctx.fillStyle = p.muted;
  ctx.font = `500 24px ${SANS}`;
  ctx.textAlign = "center";
  ctx.fillText(c.eyebrow.toUpperCase(), W / 2, 268);

  // Title
  if (c.title) {
    drawCenteredText(ctx, c.title, 336, p.accent, 58, 600);
  }

  // Nível: gráfico do Campo Magnético como protagonista (~42% da altura)
  if (template === "level" && d.field && !o.onlyPhrase) {
    const outerR = 225;
    const cy = 620;
    drawFieldChart(ctx, p, d.field, W / 2, cy, outerR);
    drawFieldMetrics(ctx, p, d.field, 945, 0.78);
    ctx.fillStyle = p.footer;
    ctx.font = `500 22px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText("imag.net.br", W / 2, H - 60);
    return;
  }

  // Big number with halo
  const centerY = c.title ? 560 : 520;
  if (c.bigNumber) {
    drawHalo(ctx, p, W / 2, centerY - 30, 220);
    drawCenteredText(ctx, c.bigNumber, centerY + 60, p.accent, 240, 600);
    if (c.bigLabel) {
      drawCenteredText(ctx, c.bigLabel, centerY + 130, p.muted, 26, 500);
    }
  } else if (c.bigLabel) {
    drawCenteredText(ctx, c.bigLabel, centerY + 20, p.ink, 32, 500);
  }

  // Badge
  if (c.badgeText) {
    drawCheckBadge(ctx, p, c.badgeText, H - 340);
  }

  // Brand phrase
  ctx.fillStyle = p.ink;
  ctx.font = `500 30px ${SANS}`;
  ctx.textAlign = "center";
  ctx.fillText(c.phrase, W / 2, H - 200);

  // Footer
  ctx.fillStyle = p.footer;
  ctx.font = `500 22px ${SANS}`;
  ctx.fillText(c.footer === "url" ? "imag.net.br" : "iMAG", W / 2, H - 90);
}

async function drawLogoAt(ctx: CanvasRenderingContext2D, p: Palette, y: number, height = 88) {
  try {
    const logo = await loadImage(imagLogoAsset.url);
    const logoH = height;
    const logoW = logoH * (logo.width / logo.height);
    const off = document.createElement("canvas");
    off.width = Math.ceil(logoW);
    off.height = Math.ceil(logoH);
    const octx = off.getContext("2d")!;
    octx.drawImage(logo, 0, 0, logoW, logoH);
    octx.globalCompositeOperation = "source-in";
    octx.fillStyle = p.logo;
    octx.fillRect(0, 0, logoW, logoH);
    ctx.drawImage(off, (W - logoW) / 2, y);
  } catch {
    ctx.fillStyle = p.logo;
    ctx.font = `600 ${Math.round(height * 0.7)}px ${SANS}`;
    ctx.textAlign = "center";
    ctx.fillText("iMAG", W / 2, y + height * 0.75);
  }
}