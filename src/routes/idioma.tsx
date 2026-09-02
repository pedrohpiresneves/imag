import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ChevronLeft } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { useI18n, LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n";

const HAIR = "#E9EBEF";
const BLUE = "var(--blue)";

export const Route = createFileRoute("/idioma")({
  ssr: false,
  component: LanguagePage,
  head: () => ({
    meta: [
      { title: "Idioma · iMAG" },
      {
        name: "description",
        content: "Escolha o idioma da iMAG: Português (Brasil), English ou Español.",
      },
      { property: "og:title", content: "Idioma · iMAG" },
      {
        property: "og:description",
        content: "Escolha o idioma da iMAG e da MAG.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function LanguagePage() {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[560px] items-center gap-1 px-6 py-4">
          <Link
            to="/configuracoes"
            className="-ml-2 inline-flex items-center gap-1 text-[14.5px] font-medium text-neutral-500"
          >
            <ChevronLeft className="h-5 w-5" />
            {t("settings", "title")}
          </Link>
        </div>
      </header>

      <main
        className="mx-auto max-w-[560px] px-6"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 128px)" }}
      >
        <div className="pt-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-400">
            {t("settings", "preferencesSection")}
          </p>
          <h1 className="mt-1.5 text-[32px] font-semibold leading-[1.05] tracking-[-0.03em]">
            {t("language", "title")}
          </h1>
          <p className="mt-2 text-[14.5px] text-neutral-500">{t("language", "subtitle")}</p>
        </div>

        <section
          className="mt-7 overflow-hidden rounded-[20px] border bg-white shadow-[0_1px_2px_rgba(16,24,40,0.03)]"
          style={{ borderColor: HAIR }}
        >
          {LOCALES.map((code: Locale, i) => {
            const active = locale === code;
            return (
              <div key={code}>
                {i > 0 && <div className="ml-4 h-px" style={{ background: HAIR }} />}
                <button
                  type="button"
                  onClick={() => setLocale(code)}
                  aria-current={active}
                  className="flex min-h-[58px] w-full items-center gap-3 px-4 text-left transition hover:bg-neutral-50"
                >
                  <span
                    className="flex-1 text-[15.5px] tracking-[-0.01em]"
                    style={{ fontWeight: active ? 600 : 400 }}
                  >
                    {LOCALE_LABELS[code]}
                  </span>
                  {active && <Check className="h-[18px] w-[18px]" style={{ color: BLUE }} />}
                </button>
              </div>
            );
          })}
        </section>

        <p className="mt-3 px-1 text-[12.5px] text-neutral-400">{t("language", "note")}</p>
      </main>

      <BottomNav />
    </div>
  );
}