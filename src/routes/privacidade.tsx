import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — iMAG" },
      {
        name: "description",
        content:
          "Como tratamos seus dados na iMAG e no programa Círculo iMAG, seguindo os princípios da LGPD.",
      },
      { property: "og:title", content: "Política de Privacidade — iMAG" },
      {
        property: "og:description",
        content: "Como tratamos seus dados, seguindo os princípios da LGPD.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://imag.net.br/privacidade" },
    ],
    links: [{ rel: "canonical", href: "https://imag.net.br/privacidade" }],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="surface-light min-h-screen bg-white text-neutral-900">
      <AppHeader />
      <main className="mx-auto max-w-[760px] px-5 py-12 sm:px-8 sm:py-16">
        <Link
          to="/"
          className="inline-flex items-center text-[13px] text-neutral-500 transition hover:text-[#335CFF]"
        >
          ← Voltar
        </Link>
        <h1 className="mt-6 text-[34px] font-semibold tracking-[-0.02em] text-neutral-900 sm:text-[42px]">
          Política de Privacidade
        </h1>
        <p className="mt-3 text-[13px] text-neutral-500">
          Atualizada em {new Date().toLocaleDateString("pt-BR")}
        </p>

        <div className="mt-10 space-y-6 text-[15.5px] leading-[1.75] text-neutral-700">
          <section className="space-y-3">
            <h2 className="text-[20px] font-semibold text-neutral-900">1. Dados que coletamos</h2>
            <p>
              Coletamos apenas os dados necessários para prestar o serviço: nome, e-mail, dados de
              pagamento (via processador terceirizado) e informações de uso da plataforma.
            </p>
          </section>

          <section className="space-y-3 border-t border-neutral-200 pt-6">
            <h2 className="text-[20px] font-semibold text-neutral-900">2. Programa Círculo iMAG</h2>
            <p>
              Ao participar do programa de indicação, armazenamos: seu código único de indicação,
              registros anônimos de cliques (com IP hasheado — não reversível), atribuições de
              visitantes (cookie opaco de 30 dias), comissões geradas, chave PIX cadastrada por você
              e histórico de pagamentos. Esses dados são visíveis apenas para você e para os
              administradores autorizados.
            </p>
            <p>
              Comissões pagas são retidas pelo período fiscal exigido por lei. Você pode solicitar
              a exclusão de dados pessoais não fiscais a qualquer momento pelo e-mail de suporte.
            </p>
          </section>

          <section className="space-y-3 border-t border-neutral-200 pt-6">
            <h2 className="text-[20px] font-semibold text-neutral-900">3. Cookies de indicação</h2>
            <p>
              Quando um visitante acessa a plataforma através de um link de indicação, gravamos
              dois cookies: <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px] text-neutral-800">am_ref_v</code> (identificador opaco, HttpOnly) e{" "}
              <code className="rounded bg-neutral-100 px-1.5 py-0.5 text-[13px] text-neutral-800">am_ref_c</code> (código de indicação, legível). Ambos expiram em 30 dias e
              servem exclusivamente para atribuir corretamente a comissão a quem indicou.
            </p>
          </section>

          <section className="space-y-3 border-t border-neutral-200 pt-6">
            <h2 className="text-[20px] font-semibold text-neutral-900">4. Base legal (LGPD)</h2>
            <p>
              O tratamento é fundamentado em execução de contrato (art. 7º, V), obrigação legal
              (art. 7º, II — para comissões pagas) e legítimo interesse (art. 7º, IX — para
              prevenção de fraude no programa de indicação).
            </p>
          </section>

          <section className="space-y-3 border-t border-neutral-200 pt-6">
            <h2 className="text-[20px] font-semibold text-neutral-900">5. Seus direitos</h2>
            <p>
              Você pode a qualquer momento acessar, corrigir, portar ou solicitar exclusão dos
              seus dados. Escreva para o e-mail de suporte informado no site.
            </p>
          </section>

          <section className="space-y-3 border-t border-neutral-200 pt-6">
            <h2 className="text-[20px] font-semibold text-neutral-900">6. Contato</h2>
            <p>
              Encarregado (DPO):{" "}
              <a href="mailto:contato@imag.net.br" className="text-[#335CFF] hover:underline">
                contato@imag.net.br
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}