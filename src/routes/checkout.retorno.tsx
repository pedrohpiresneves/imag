import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect } from "react";
import { ImagLockup } from "@/components/ImagLogo";

export const Route = createFileRoute("/checkout/retorno")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    p: typeof search.p === "string" ? search.p : "",
    transaction_nsu: typeof search.transaction_nsu === "string" ? search.transaction_nsu : "",
    receipt_url: typeof search.receipt_url === "string" ? search.receipt_url : "",
    slug: typeof search.slug === "string" ? search.slug : "",
    order_nsu: typeof search.order_nsu === "string" ? search.order_nsu : "",
  }),
  head: () => ({
    meta: [
      { title: "Confirmando pagamento · iMAG" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RetornoPage,
});

function RetornoPage() {
  const search = useSearch({ from: "/checkout/retorno" });

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.p) params.set("p", search.p);
    if (search.transaction_nsu) params.set("transaction_nsu", search.transaction_nsu);
    if (search.receipt_url) params.set("receipt_url", search.receipt_url);
    if (search.slug) params.set("slug", search.slug);
    if (search.order_nsu) params.set("order_nsu", search.order_nsu);
    window.location.replace(`/pagamento/confirmando?${params.toString()}`);
  }, [search.p, search.transaction_nsu, search.receipt_url, search.slug, search.order_nsu]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex min-h-screen max-w-[560px] flex-col items-center justify-center px-6 text-center sm:px-10">
        <span className="inline-flex items-center">
          <ImagLockup size={18} />
        </span>
        <h1 className="mt-6 font-sans text-3xl font-semibold tracking-[-0.01em]">Pagamento recebido</h1>
        <p className="mt-3 font-sans font-semibold tracking-[-0.01em] text-muted-foreground">
          Encaminhando para a confirmação segura…
        </p>
        <span className="mt-8 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
      </main>
    </div>
  );
}