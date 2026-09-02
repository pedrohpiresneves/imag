import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/checkout")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/planos" });
  },
  component: () => null,
});