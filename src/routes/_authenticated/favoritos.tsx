import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "@/components/AppHeader";
import { MODULES } from "@/lib/modules";
import { fetchFavorites } from "@/lib/user-data";

export const Route = createFileRoute("/_authenticated/favoritos")({
  component: FavoritesPage,
});

function FavoritesPage() {
  const { user } = Route.useRouteContext() as { user: { id: string } };
  const { data: favorites = [] } = useQuery({
    queryKey: ["favorites", user.id],
    queryFn: () => fetchFavorites(user.id),
  });

  const items = MODULES.filter((m) => favorites.includes(m.slug));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader />
      <main className="mx-auto max-w-[420px] px-6 py-10 sm:max-w-[560px] sm:px-10 sm:py-14">
        <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          Seus favoritos
        </p>
        <h1 className="mt-3 text-3xl font-medium tracking-[-0.04em]">Marcadores</h1>

        <div className="mt-12 space-y-6">
          {items.length === 0 && (
            <p className="text-muted-foreground">
              Você ainda não favoritou nenhum capítulo. Toque em ☆ enquanto lê para marcar.
            </p>
          )}
          {items.map((m) => (
            <Link
              key={m.slug}
              to="/modulo/$slug"
              params={{ slug: m.slug }}
              className="block border-b border-border pb-6"
            >
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Capítulo {String(m.number).padStart(2, "0")}
              </span>
              <h4 className="mt-1 text-xl font-medium tracking-[-0.03em]">{m.title}</h4>
              <p className="mt-1 text-sm text-muted-foreground">{m.subtitle}</p>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
