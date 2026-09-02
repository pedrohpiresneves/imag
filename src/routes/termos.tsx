import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — iMAG" },
      {
        name: "description",
        content:
          "Termos de uso da plataforma iMAG: direitos, deveres e regras de utilização do serviço.",
      },
      { property: "og:title", content: "Termos de Uso — iMAG" },
      {
        property: "og:description",
        content: "Direitos, deveres e regras de utilização da plataforma iMAG.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://imag.net.br/termos" },
    ],
    links: [{ rel: "canonical", href: "https://imag.net.br/termos" }],
  }),
  component: Terms,
});

function Terms() {
  return (
    <div className="surface-light min-h-screen bg-white text-neutral-900">
      <AppHeader />
      <main className="mx-auto max-w-[760px] px-5 py-12 sm:px-8 sm:py-16">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-500">
          Termos de Uso
        </p>
        <h1 className="mt-3 text-[32px] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[40px]">
          Termos de Uso da iMAG
        </h1>
        <p className="mt-4 text-[13px] text-neutral-500">
          Última atualização: {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
        </p>

        <section className="mt-10 space-y-8 text-[15px] leading-[1.7] text-neutral-700">
          <div>
            <h2 className="text-[18px] font-semibold text-neutral-900">1. Sobre a iMAG</h2>
            <p className="mt-2">
              A iMAG é uma plataforma de inteligência estratégica que ajuda profissionais a organizarem prioridades e evoluírem de forma consistente. Ao criar sua conta, você concorda com estes Termos.
            </p>
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-neutral-900">2. Conta e acesso</h2>
            <p className="mt-2">
              Você é responsável pelas informações fornecidas e pela guarda das credenciais. A conta é pessoal e intransferível.
            </p>
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-neutral-900">3. Assinatura e período gratuito</h2>
            <p className="mt-2">
              Novos usuários recebem 10 dias gratuitos. Após esse período, o acesso continua mediante assinatura mensal ou anual, conforme plano contratado. O cancelamento pode ser feito a qualquer momento pela área de configurações.
            </p>
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-neutral-900">4. Uso adequado</h2>
            <p className="mt-2">
              Não é permitido utilizar a plataforma para atividades ilícitas, ofensivas ou que violem direitos de terceiros. Reservamo-nos o direito de suspender contas em caso de descumprimento.
            </p>
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-neutral-900">5. Propriedade intelectual</h2>
            <p className="mt-2">
              Todo o conteúdo, marca, código e materiais da iMAG pertencem à iMAG. É proibida a reprodução sem autorização.
            </p>
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-neutral-900">6. Alterações</h2>
            <p className="mt-2">
              Estes Termos podem ser atualizados periodicamente. Mudanças relevantes serão comunicadas por e-mail ou na própria plataforma.
            </p>
          </div>
          <div>
            <h2 className="text-[18px] font-semibold text-neutral-900">7. Contato</h2>
            <p className="mt-2">
              Dúvidas sobre estes Termos podem ser enviadas para{" "}
              <a href="mailto:contato@imag.net.br" className="underline underline-offset-4">contato@imag.net.br</a>.
            </p>
          </div>
        </section>

        <div className="mt-12 flex gap-6 text-[13px]">
          <Link to="/privacidade" className="underline underline-offset-4 text-neutral-700 hover:text-neutral-900">
            Política de Privacidade
          </Link>
          <Link to="/" className="underline underline-offset-4 text-neutral-700 hover:text-neutral-900">
            Voltar ao início
          </Link>
        </div>
      </main>
    </div>
  );
}