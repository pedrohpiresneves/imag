import type { SupabaseClient } from "@supabase/supabase-js";
import { similarity } from "./text";

type Db = SupabaseClient<any, any, any>;

export type FallbackMeta = { title: string; description: string; strategic_reason: string };

/** Hash determinístico e estável por usuário+dia (evita repetir a mesma rota). */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function isHealth(profession: string) {
  return /dent|médic|medic|fisio|nutri|psic|enferm|terapeut|estétic|estetic|saúde|saude/.test(
    profession.toLowerCase(),
  );
}

type Ctx = {
  person: string;
  personSing: string;
  profession: string;
  goal: string;
  challenge: string;
  city: string;
  short: number;
};

/**
 * Rotas de fallback: cada uma monta VERBO + ALVO + QUANTIDADE + CANAL + OBJETIVO
 * usando dados reais do usuário. A quantidade varia com o tempo disponível.
 */
const ROUTES: Array<(c: Ctx) => FallbackMeta> = [
  (c) => ({
    title: `Envie mensagem no WhatsApp para ${c.short ? 3 : 5} ${c.person} que pediram valores e não fecharam`,
    description: `Abra o WhatsApp, localize os ${c.short ? 3 : 5} últimos ${c.person} que pediram valores e não retornaram e envie a cada um uma mensagem curta retomando o assunto com um horário concreto. Meta: reabrir 1 conversa hoje.`,
    strategic_reason: `Quem já perguntou preço está a um passo de fechar. É o caminho mais curto${c.goal ? ` para ${c.goal.slice(0, 90)}` : " para um retorno hoje"}.`,
  }),
  (c) => ({
    title: `Retome contato com ${c.short ? 3 : 6} ${c.person} atendidos nos últimos 90 dias`,
    description: `Liste ${c.short ? 3 : 6} ${c.person} que você atendeu nos últimos 3 meses e não voltaram. Mande uma mensagem individual perguntando como está o resultado e oferecendo o próximo passo${c.profession ? ` de ${c.profession.toLowerCase()}` : ""}. Meta: 1 reagendamento.`,
    strategic_reason: `Reativar quem já confiou em você custa menos que atrair gente nova${c.challenge ? ` e ataca direto: ${c.challenge.slice(0, 80)}` : ""}.`,
  }),
  (c) => ({
    title: `Publique 1 conteúdo respondendo a dúvida mais comum dos seus ${c.person}`,
    description: `Escreva a pergunta que seus ${c.person} mais fazem antes de contratar e responda em 1 post ou story de até 60 segundos, terminando com um convite direto para conversar no WhatsApp. Meta: 2 respostas na DM.`,
    strategic_reason: `Conteúdo que responde objeção real converte; conteúdo genérico só ocupa tempo${c.goal ? `. Isso encurta o caminho para ${c.goal.slice(0, 80)}` : ""}.`,
  }),
  (c) => ({
    title: `Peça indicação a ${c.short ? 2 : 4} ${c.person} satisfeitos, um por um`,
    description: `Escolha ${c.short ? 2 : 4} ${c.person} que tiveram bom resultado com você e mande uma mensagem pessoal pedindo que indiquem 1 pessoa específica que viva o mesmo problema. Meta: 1 indicação nova hoje.`,
    strategic_reason: `Indicação chega pré-convencida e com menos objeção de preço — é o canal mais barato que você tem hoje.`,
  }),
  (c) => ({
    title: `Defina e escreva sua oferta de entrada para ${c.personSing} novo`,
    description: `Em uma página só: o que está incluso, para quem é, quanto custa e qual o próximo passo. Deixe pronta para colar no WhatsApp quando alguém perguntar "quanto é?". Meta: oferta pronta e enviada a 1 pessoa.`,
    strategic_reason: `Sem oferta clara, cada conversa recomeça do zero e você perde o fechamento na hesitação${c.city ? ` — inclusive em ${c.city}` : ""}.`,
  }),
  (c) => ({
    title: `Faça follow-up telefônico com ${c.short ? 2 : 3} ${c.person} parados há mais de 15 dias`,
    description: `Ligue (não mande texto) para ${c.short ? 2 : 3} ${c.person} que sumiram no meio da conversa. Pergunte o que travou e ofereça 2 horários concretos. Meta: 1 agendamento confirmado.`,
    strategic_reason: `A ligação resolve em 3 minutos o que a mensagem arrasta por semanas${c.challenge ? ` e destrava ${c.challenge.slice(0, 70)}` : ""}.`,
  }),
  (c) => ({
    title: `Revise os últimos ${c.short ? 5 : 10} atendimentos e registre o que gerou retorno`,
    description: `Liste seus últimos ${c.short ? 5 : 10} atendimentos${c.profession ? ` de ${c.profession.toLowerCase()}` : ""} e marque de onde veio cada um (indicação, Instagram, WhatsApp, presencial). Meta: identificar o canal que mais traz ${c.person} e dobrar nele amanhã.`,
    strategic_reason: `Você não pode ampliar o que não mediu. Uma hora de clareza aqui vale semanas de esforço espalhado.`,
  }),
];

/**
 * Fallback quando o motor de IA não decide: NUNCA devolve o mesmo texto
 * para usuários diferentes — usa perfil real + rotação determinística
 * por usuário/dia e evita repetir as direções recentes daquela conta.
 */
export async function buildPersonalFallback(
  db: Db,
  userId: string,
  localDate: string,
  opts?: { focusText?: string | null; fullName?: string | null },
): Promise<FallbackMeta> {
  // Fallback coerente: nunca recupera direção antiga e nunca ignora o foco
  // ativo. Havendo foco, a sugestão simples nasce direto dele.
  const focusText = (opts?.focusText ?? "").trim();
  if (focusText) {
    return buildFocusFallback(focusText, opts?.fullName ?? null, `${userId}:${localDate}`);
  }

  const [{ data: profile }, { data: history }, { data: events }] = await Promise.all([
    db.from("profiles").select("goal, challenge, profession, city").eq("id", userId).maybeSingle(),
    db
      .from("user_plans")
      .select("priority_title")
      .eq("user_id", userId)
      .order("meta_date", { ascending: false })
      .limit(7),
    db
      .from("day_events")
      .select("id")
      .eq("user_id", userId)
      .eq("day_date", localDate),
  ]);

  const profession = profile?.profession ?? "";
  const health = isHealth(profession);
  const ctx: Ctx = {
    person: health ? "pacientes" : "clientes",
    personSing: health ? "paciente" : "cliente",
    profession,
    goal: (profile?.goal ?? "").trim(),
    challenge: (profile?.challenge ?? "").trim(),
    city: (profile?.city ?? "").trim(),
    short: (events?.length ?? 0) >= 4 ? 1 : 0,
  };

  const recent = (history ?? []).map((h) => String(h.priority_title ?? ""));
  const offset = hash(`${userId}:${localDate}`) % ROUTES.length;

  for (let i = 0; i < ROUTES.length; i += 1) {
    const candidate = ROUTES[(offset + i) % ROUTES.length]!(ctx);
    const repeated = recent.some((t) => similarity(t, candidate.title) > 0.5);
    if (!repeated) return candidate;
  }
  return ROUTES[offset]!(ctx);
}
/**
 * Sugestão simples ancorada exclusivamente no foco ativo da semana.
 * Serve a qualquer foco (emagrecer, vender mais, estudar…): a frase é
 * construída sobre o próprio texto do foco, sem tema de outra direção.
 */
export function buildFocusFallback(
  focusText: string,
  fullName: string | null,
  seed: string,
): FallbackMeta {
  const focus = focusText.trim().replace(/\.$/, "").toLowerCase();
  const first = (fullName ?? "").trim().split(/\s+/)[0] ?? "";
  const who = first ? `${first}, ` : "";

  const ROUTES_FOCUS: Array<FallbackMeta> = [
    {
      title: `${who}escolha hoje uma única mudança concreta que aproxime você de ${focus}.`,
      description: `Defina em uma frase o que você vai fazer diferente hoje por causa de "${focus}" e execute ainda hoje. Anote a escolha para não depender da memória.`,
      strategic_reason: `Uma decisão pequena e clara mantém o foco "${focus}" vivo no dia de hoje.`,
    },
    {
      title: `${who}planeje antecipadamente o próximo passo de ${focus} antes do fim do dia.`,
      description: `Reserve 10 minutos, escreva o que precisa acontecer hoje para avançar em "${focus}" e deixe tudo preparado com antecedência.`,
      strategic_reason: `Planejar antes evita decidir no cansaço, que é onde o foco "${focus}" costuma se perder.`,
    },
    {
      title: `${who}registre hoje um sinal real do seu progresso em ${focus}.`,
      description: `Ao fim do dia, anote em uma linha o que você fez hoje em relação a "${focus}" e o que atrapalhou.`,
      strategic_reason: `Medir o dia mostra o padrão que trava "${focus}" e permite ajustar amanhã.`,
    },
    {
      title: `${who}remova hoje um obstáculo que atrapalha ${focus}.`,
      description: `Identifique o que mais atrapalhou você em "${focus}" nos últimos dias e elimine ou reduza esse obstáculo hoje, com uma ação concreta.`,
      strategic_reason: `Tirar um obstáculo do caminho rende mais que aumentar esforço em "${focus}".`,
    },
  ];

  const idx = hash(seed) % ROUTES_FOCUS.length;
  return ROUTES_FOCUS[idx]!;
}
