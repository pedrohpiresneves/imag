import { Toaster } from "sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { PLAUSIBLE_DOMAIN } from "@/lib/analytics";
import { ThemeProvider, THEME_INIT_SCRIPT } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { registerServiceWorker } from "@/lib/pwa";
import { PodcastPlayerProvider } from "@/lib/podcast/player-context";
import { CastMiniPlayer } from "@/components/CastMiniPlayer";
import { AccessGuard } from "@/components/AccessGuard";

const APPLE_SPLASH_SCREENS: { width: number; height: number; ratio: number }[] = [
  { width: 750, height: 1334, ratio: 2 },
  { width: 828, height: 1792, ratio: 2 },
  { width: 1125, height: 2436, ratio: 3 },
  { width: 1170, height: 2532, ratio: 3 },
  { width: 1179, height: 2556, ratio: 3 },
  { width: 1206, height: 2622, ratio: 3 },
  { width: 1242, height: 2688, ratio: 3 },
  { width: 1284, height: 2778, ratio: 3 },
  { width: 1290, height: 2796, ratio: 3 },
  { width: 1320, height: 2868, ratio: 3 },
  { width: 1536, height: 2048, ratio: 2 },
  { width: 1668, height: 2388, ratio: 2 },
  { width: 2048, height: 2732, ratio: 2 },
];

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">404</p>
        <h1 className="mt-4 font-serif text-3xl italic">Página não encontrada</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          O endereço que você buscou não existe ou foi movido.
        </p>
        <Link
          to="/"
          className="mt-8 inline-block border-b border-foreground pb-1 font-mono text-[10px] uppercase tracking-[0.2em]"
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Erro</p>
        <h1 className="mt-4 font-serif text-2xl italic">Algo interrompeu esta página</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Tente novamente ou volte para o início.
        </p>
        <div className="mt-8 flex justify-center gap-6">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="border-b border-foreground pb-1 font-mono text-[10px] uppercase tracking-[0.2em]"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="border-b border-muted-foreground pb-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
          >
            Ir para o início
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "iMAG — Sistema de Inteligência Magnética" },
      {
        name: "description",
        content:
          "A plataforma inteligente para atrair, converter e fidelizar clientes através de autoridade, posicionamento e inteligência artificial.",
      },
      { name: "author", content: "Bruna Thaís" },
      { property: "og:title", content: "iMAG — Sistema de Inteligência Magnética" },
      {
        property: "og:description",
        content:
          "A plataforma inteligente para atrair, converter e fidelizar clientes através de autoridade, posicionamento e inteligência artificial.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "iMAG" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#335CFF" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "iMAG" },
      { name: "application-name", content: "iMAG" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap",
      },
      { rel: "icon", type: "image/png", sizes: "64x64", href: "/mag-app-icon-v4-64.png" },
      { rel: "icon", type: "image/png", sizes: "192x192", href: "/mag-app-icon-v4-192.png" },
      { rel: "shortcut icon", type: "image/png", href: "/mag-app-icon-v4-64.png" },
      { rel: "manifest", href: "/manifest.webmanifest?v=4" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/mag-app-icon-v4-180.png" },
      ...APPLE_SPLASH_SCREENS.map(({ width, height, ratio }) => ({
        rel: "apple-touch-startup-image",
        href: `/splash/splash-${width}x${height}.png`,
        media: `(device-width: ${width / ratio}px) and (device-height: ${height / ratio}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)`,
      })),
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "iMAG",
          url: "https://imag.net.br",
          founder: { "@type": "Person", name: "Bruna Thaís" },
        }),
      },
      ...(PLAUSIBLE_DOMAIN
        ? [
            {
              defer: true,
              "data-domain": PLAUSIBLE_DOMAIN,
              src: "https://plausible.io/js/script.js",
            } as unknown as { src: string },
            {
              children:
                "window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}",
            },
          ]
        : []),
      { children: THEME_INIT_SCRIPT },
      {
        children:
          "try{var p=localStorage.getItem('imag:appearance')||'light';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-mag-theme',d?'dark':'light')}catch(e){}",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <ThemeProvider>
          <PodcastPlayerProvider>
            <AccessGuard>
              <Outlet />
            </AccessGuard>
            <CastMiniPlayer />
            <Toaster position="top-center" richColors />
          </PodcastPlayerProvider>
        </ThemeProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
