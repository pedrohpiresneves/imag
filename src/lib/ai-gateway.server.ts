import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(lovableApiKey: string) {
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    // Sem isso o gateway ignora o JSON Schema e devolve texto livre,
    // fazendo todo generateObject falhar (AI_NoObjectGeneratedError).
    supportsStructuredOutputs: true,
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  } as Parameters<typeof createOpenAICompatible>[0]);
}