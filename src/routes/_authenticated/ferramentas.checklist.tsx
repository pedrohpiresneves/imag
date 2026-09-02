import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { loadChecklist, setChecklistItem } from "@/lib/workspace.functions";
import { PaywallLock } from "@/components/PaywallLock";

export const Route = createFileRoute("/_authenticated/ferramentas/checklist")({
  component: Checklist,
});

const ITEMS = [
  { key: "perfil", pillar: "Perfil", text: "Perfil otimizado (nome, @, foto profissional)." },
  { key: "bio", pillar: "Perfil", text: "Bio clara com resultado que você entrega." },
  { key: "cta-bio", pillar: "Perfil", text: "CTA da bio funcionando (link direto para WhatsApp / agenda)." },
  { key: "destaques", pillar: "Perfil", text: "Destaques organizados: prova, serviços, bastidor, FAQ." },
  { key: "whats", pillar: "Atendimento", text: "WhatsApp Business configurado com mensagem de saudação." },
  { key: "fotos", pillar: "Autoridade", text: "Fotos profissionais do seu trabalho e do consultório." },
  { key: "prova", pillar: "Autoridade", text: "Prova social visível: depoimentos e antes/depois." },
  { key: "frequencia", pillar: "Conteúdo", text: "Frequência de postagem consistente (mínimo 3x/semana)." },
  { key: "autoridade", pillar: "Autoridade", text: "Autoridade construída: você aparece explicando, não só divulgando." },
  { key: "indicacao", pillar: "Escala", text: "Estratégia de indicação ativa com pacientes atuais." },
  { key: "posicionamento", pillar: "Fundação", text: "Consigo dizer em uma frase quem é meu cliente ideal." },
  { key: "preco", pillar: "Posicionamento", text: "Meu preço reflete meu posicionamento (não a concorrência)." },
  { key: "objecao", pillar: "Conversão", text: "Sei responder à objeção de preço sem me justificar." },
  { key: "pos", pillar: "Fidelização", text: "Ritual de pós-atendimento que gera indicação natural." },
  { key: "meta", pillar: "Escala", text: "Sei quantos clientes preciso atender esta semana para bater a meta." },
];

function Checklist() {
  const qc = useQueryClient();
  const { data: state = [] } = useQuery({ queryKey: ["checklist"], queryFn: () => loadChecklist() });
  const map = new Map(state.map((s) => [s.item_key, s.done]));
  const done = ITEMS.filter((i) => map.get(i.key)).length;

  const setItem = useMutation({
    mutationFn: (v: { item_key: string; done: boolean }) => setChecklistItem({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist"] }),
  });

  const pct = Math.round((done / ITEMS.length) * 100);
  return (
    <div className="surface-light min-h-screen fade-rise bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-[860px] px-6 pt-16 pb-32 sm:px-10 sm:pt-20">
        <Link to="/ferramentas" className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-[#8B7355] transition hover:text-[#0A0A0A]">
          ← Ferramentas
        </Link>
        <p className="mt-10 text-[11px] uppercase tracking-[0.4em] text-[#8B7355]">Ferramenta · 06</p>
        <h1
          className="mt-5 text-[clamp(36px,5.4vw,60px)] font-medium leading-[1.02] text-[#0A0A0A]"
          style={{ letterSpacing: "-0.04em" }}
        >
          Checklist de Captação
        </h1>
        <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-[#4A4A4A]">
          15 sinais silenciosos de que sua fundação está pronta. Progresso salvo automaticamente.
        </p>

        <div className="mt-12 flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#8B7355]">Concluído</p>
          <p className="text-[13px] tabular-nums text-[#0A0A0A]">{done}/{ITEMS.length}</p>
        </div>
        <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-[#E6E4DE]">
          <div className="h-full bg-[#C6A15B] transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
        </div>

        <PaywallLock label="Marque seu progresso após liberar seu acesso." compact>
          <ul className="mt-10 space-y-2">
            {ITEMS.map((i) => {
              const isDone = !!map.get(i.key);
              return (
                <li key={i.key}>
                  <button
                    type="button"
                    onClick={() => setItem.mutate({ item_key: i.key, done: !isDone })}
                    className={`flex w-full items-start gap-4 rounded-[18px] border p-5 text-left transition ${
                      isDone
                        ? "border-transparent bg-[#F5F1E6]"
                        : "border-[rgba(0,0,0,0.06)] bg-white hover:border-[rgba(0,0,0,0.14)]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition ${
                        isDone ? "bg-[#0A0A0A] text-white" : "border border-[rgba(0,0,0,0.2)]"
                      }`}
                      aria-hidden
                    >
                      {isDone ? (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6.2L4.8 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </span>
                    <div className="flex-1">
                      <p className={`text-[15px] leading-snug ${isDone ? "text-[#8B7355] line-through" : "text-[#0A0A0A]"}`}>{i.text}</p>
                      <p className="mt-1.5 text-[10px] uppercase tracking-[0.32em] text-[#8B7355]">{i.pillar}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </PaywallLock>
      </main>
    </div>
  );
}