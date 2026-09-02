import { createFileRoute, redirect } from "@tanstack/react-router";

/** Rota legada: /planos é a única página oficial de assinatura. */
export const Route = createFileRoute("/assinar")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/planos" });
  },
  component: () => null,
});
