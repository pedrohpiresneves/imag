import { createFileRoute, redirect } from "@tanstack/react-router";

/** A Home foi removida: Atividade é a tela principal do iMAG. */
export const Route = createFileRoute("/app")({
  beforeLoad: () => {
    throw redirect({ to: "/atividade" });
  },
});
