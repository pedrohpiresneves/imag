import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/direcoes-salvas")({
  beforeLoad: () => {
    throw redirect({ to: "/historico", search: { f: "saved" }, replace: true });
  },
});
