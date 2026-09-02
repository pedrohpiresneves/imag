import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const Input = z.object({
  direction_title: z.string().min(3).max(600),
  direction_description: z.string().max(1200).optional().default(""),
  previous: z.string().max(1200).optional().default(""),
});

/** Mensagem pronta para copiar — gerada a partir da direção do dia. */
export const generateDirectionMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => Input.parse(raw))
  .handler(async ({ data }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("Missing LOVABLE_API_KEY");
    const gateway = createLovableAiGatewayProvider(key);

    const result = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      system:
        "Você é a MAG, mentora da iMAG. Escreve mensagens curtas de WhatsApp em português BR, com tom profissional e acolhedor. No máximo 1 emoji, no máximo 4 linhas, sem assinatura, sem colchetes ou placeholders. Responda SOMENTE com o texto da mensagem, sem aspas e sem comentários.",
      prompt: `Escreva a mensagem que a usuária deve enviar para executar esta direção.

Direção: ${data.direction_title}
${data.direction_description ? `Contexto: ${data.direction_description}` : ""}
${data.previous ? `Versão anterior (NÃO repita, escreva uma alternativa diferente mantendo o mesmo objetivo):\n${data.previous}` : ""}

Use apenas informações presentes acima. Se o nome do contato não estiver disponível, não invente — comece de forma natural sem nome. Foque em uma única dúvida ou em um agendamento rápido.`,
    });

    const text = result.text.replace(/\r/g, "").replace(/^["“]|["”]$/g, "").trim();
    return { message: text };
  });
