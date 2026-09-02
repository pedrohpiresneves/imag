import { createServerFn } from "@tanstack/react-start";
import { requirePaidAccess } from "@/integrations/supabase/paid-access-middleware";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const WhatsInput = z.object({
  objective: z.enum([
    "cobranca",
    "retorno",
    "fechamento",
    "pos-venda",
    "recuperacao-lead",
    "indicacao",
  ]),
  tone: z.enum(["elegante", "acolhedor", "direto", "provocador"]).default("elegante"),
  context: z.string().max(400).optional().default(""),
});

const OBJECTIVE_LABEL: Record<string, string> = {
  cobranca: "cobrança de pagamento em aberto",
  retorno: "retorno de paciente/cliente inativo",
  fechamento: "fechamento de venda / convite para agendar",
  "pos-venda": "pós-venda / acompanhamento após atendimento",
  "recuperacao-lead": "recuperação de lead que sumiu no meio da conversa",
  indicacao: "pedido de indicação a um cliente satisfeito",
};

export const generateWhatsappMessages = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => WhatsInput.parse(raw))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const result = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system:
        "Você é o MAG, mentor da Agenda Magnética. Escreve mensagens de WhatsApp curtas, magnéticas, sem cara de robô, em português BR. No máximo 1 emoji. Nunca implora atenção. Sempre linguagem de resultado, nunca de processo.",
      prompt: `Gere exatamente 3 versões de mensagem de WhatsApp para o objetivo abaixo, respeitando o tom desejado.

Objetivo: ${OBJECTIVE_LABEL[data.objective]}
Tom desejado: ${data.tone}
${data.context ? `Contexto adicional: ${data.context}` : ""}

Formato de saída (siga EXATAMENTE, sem introdução, sem comentários):

### ELEGANTE
<mensagem elegante, sofisticada, no máximo 4 linhas>

### PERSUASIVA
<mensagem persuasiva, com gatilho de valor claro, no máximo 4 linhas>

### OBJETIVA
<mensagem direta ao ponto, no máximo 3 linhas>`,
    });
    return parseThreeVariations(result.text);
  });

function parseThreeVariations(text: string) {
  const clean = text.replace(/\r/g, "").trim();
  const grab = (label: string, next?: string) => {
    const re = new RegExp(
      `###\\s*${label}\\s*\\n([\\s\\S]*?)${next ? `(?=###\\s*${next})` : "$"}`,
      "i",
    );
    const m = clean.match(re);
    return (m?.[1] ?? "").trim();
  };
  return {
    elegante: grab("ELEGANTE", "PERSUASIVA") || clean,
    persuasiva: grab("PERSUASIVA", "OBJETIVA"),
    objetiva: grab("OBJETIVA"),
  };
}

const CaptionInput = z.object({
  theme: z.string().min(1).max(400),
  format: z.enum(["carrossel", "reels", "post"]).default("post"),
});

export const generateInstagramCaption = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => CaptionInput.parse(raw))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const result = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system:
        "Você é o MAG, mentor da Agenda Magnética. Escreve conteúdo de Instagram magnético — gancho impossível de ignorar, legenda com valor real, CTA sutil, hashtags de nicho e direção visual clara. Português BR. Zero clichê.",
      prompt: `Crie um pacote completo de conteúdo para Instagram (formato: ${data.format}) sobre: ${data.theme}

Formato de saída (siga EXATAMENTE, sem introdução, sem comentários):

### GANCHO
<uma única linha de abertura magnética, no máximo 90 caracteres>

### LEGENDA
<3 a 5 parágrafos curtos com valor real, sem repetir o gancho, sem CTA e sem hashtags>

### CTA
<uma única linha de CTA sutil, no formato de convite>

### HASHTAGS
<até 8 hashtags de nicho separadas por espaço, começando com #>

### IMAGENS
<3 ideias visuais em bullets começando com "- ", cada uma com no máximo 120 caracteres, descrevendo cena/composição>`,
    });
    const clean = result.text.replace(/\r/g, "").trim();
    const grab = (label: string, next?: string) => {
      const re = new RegExp(
        `###\\s*${label}\\s*\\n([\\s\\S]*?)${next ? `(?=###\\s*${next})` : "$"}`,
        "i",
      );
      const m = clean.match(re);
      return (m?.[1] ?? "").trim();
    };
    return {
      hook: grab("GANCHO", "LEGENDA"),
      caption: grab("LEGENDA", "CTA") || clean,
      cta: grab("CTA", "HASHTAGS"),
      hashtags: grab("HASHTAGS", "IMAGENS"),
      images: grab("IMAGENS"),
    };
  });

const PlanInput = z.object({
  goal: z.string().min(3).max(300),
  currentStage: z.enum(["comecando", "instavel", "faturando", "escalando"]).default("instavel"),
  hoursPerWeek: z.number().min(1).max(60).default(10),
  focus: z.enum(["autoridade", "atracao", "conversao", "fidelizacao"]).default("atracao"),
});

export const generateMagneticPlan = createServerFn({ method: "POST" })
  .middleware([requirePaidAccess])
  .inputValidator((raw: unknown) => PlanInput.parse(raw))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);
    const result = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system:
        "Você é o MAG, mentor da Agenda Magnética. Escreve planos de 30 dias em português BR: linguagem de resultado, ações concretas, sem enrolação. Cada ação cabe em uma linha, é executável hoje, sem jargão de guru.",
      prompt: `Crie um Plano Magnético de 30 dias dividido em 4 semanas.

Objetivo do usuário: ${data.goal}
Estágio atual: ${data.currentStage}
Horas disponíveis por semana: ${data.hoursPerWeek}h
Foco principal: ${data.focus}

Formato de saída (siga EXATAMENTE, sem introdução, sem comentários):

### DIAGNOSTICO
<2 a 3 linhas dizendo qual é o gargalo real que este plano vai destravar>

### SEMANA 1
- <ação 1>
- <ação 2>
- <ação 3>
- <ação 4>

### SEMANA 2
- <ação 1>
- <ação 2>
- <ação 3>
- <ação 4>

### SEMANA 3
- <ação 1>
- <ação 2>
- <ação 3>
- <ação 4>

### SEMANA 4
- <ação 1>
- <ação 2>
- <ação 3>
- <ação 4>

### RITUAL DIARIO
- <hábito diário 1>
- <hábito diário 2>
- <hábito diário 3>`,
    });
    const clean = result.text.replace(/\r/g, "").trim();
    const grab = (label: string, next?: string) => {
      const re = new RegExp(
        `###\\s*${label}\\s*\\n([\\s\\S]*?)${next ? `(?=###\\s*${next})` : "$"}`,
        "i",
      );
      const m = clean.match(re);
      return (m?.[1] ?? "").trim();
    };
    return {
      diagnosis: grab("DIAGNOSTICO", "SEMANA 1"),
      week1: grab("SEMANA 1", "SEMANA 2"),
      week2: grab("SEMANA 2", "SEMANA 3"),
      week3: grab("SEMANA 3", "SEMANA 4"),
      week4: grab("SEMANA 4", "RITUAL DIARIO"),
      ritual: grab("RITUAL DIARIO"),
    };
  });