import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/meu-dia")({
  beforeLoad: () => {
    throw redirect({ to: "/atividade" });
  },
});
