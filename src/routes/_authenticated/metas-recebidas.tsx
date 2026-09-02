import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/metas-recebidas")({
  beforeLoad: () => {
    throw redirect({ to: "/historico", search: { f: "received" }, replace: true });
  },
});
