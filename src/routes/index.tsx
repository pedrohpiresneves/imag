import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { track } from "@/lib/analytics";
import { ImagLogo } from "@/components/ImagLogo";
import { MagFull } from "@/components/mag/MagMascot";


const OG_IMAGE_URL = "https://imag.net.br/imag-whatsapp-share-v3.png";

/* Três cores. Nada mais. */
const INK = "#111111";
const BLUE = "#335CFF"; // ação / CTA
const BLUE_DARK = "#335CFF";
const MUTED = "#7B7F89";
const HAIR = "#E8EAF0";
const EASE = [0.22, 1, 0.36, 1] as const;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "iMAG — Direção para a vida real." },
      {
        name: "description",
        content:
          "Uma inteligência amiga que organiza sua vida e mostra seu próximo passo. 10 dias grátis.",
      },
      { property: "og:title", content: "iMAG — Direção para a vida real." },
      {
        property: "og:description",
        content:
          "Uma inteligência amiga que organiza sua vida e mostra seu próximo passo. 10 dias grátis.",
      },
      { property: "og:site_name", content: "iMAG" },
      { property: "og:url", content: "https://imag.net.br" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: OG_IMAGE_URL },
      { property: "og:image:secure_url", content: OG_IMAGE_URL },
      { property: "og:image:type", content: "image/png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "iMAG — Inteligência que direciona" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "iMAG — Direção para a vida real." },
      {
        name: "twitter:description",
        content:
          "Uma inteligência amiga que organiza sua vida e mostra seu próximo passo. 10 dias grátis.",
      },
      { name: "twitter:image", content: OG_IMAGE_URL },
    ],
    links: [{ rel: "canonical", href: "https://imag.net.br/" }],
  }),
  component: LandingPage,
});

function LandingPage() {
  useEffect(() => {
    track("page_view", { page: "landing" });
  }, []);

  return (
    <div
      className="min-h-screen bg-white"
      style={{
        color: INK,
        fontFamily:
          "'Geist', -apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
        <Header />
        <main>
          <Hero />
          <HowItWorks />
          <FinalCta />
        </main>
        <Footer />
    </div>
  );
}

/* ---------------- Primitives ---------------- */

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={className}>
      <div className="mx-auto max-w-[1120px] px-6 py-10 sm:px-10 sm:py-[72px]">{children}</div>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="max-w-[18ch] text-[30px] font-bold leading-[1.08] tracking-[-0.03em] sm:text-[40px]"
      style={{ color: INK }}
    >
      {children}
    </h2>
  );
}

/* Identidade: círculos magnéticos 2–4% de opacidade */
function MagneticField({ className, size = 720 }: { className?: string; size?: number }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute ${className ?? ""}`}>
      <svg width={size} height={size} viewBox="0 0 720 720" fill="none">
        {[150, 250, 350].map((r, i) => (
          <circle
            key={r}
            cx="360"
            cy="360"
            r={r}
            stroke={INK}
            strokeWidth="1"
            opacity={0.025 - i * 0.005}
          />
        ))}
      </svg>
    </div>
  );
}

/* ---------------- Header ---------------- */

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const links = [
    { href: "#o-que-e", label: "O que é" },
    { href: "#como-funciona", label: "Como funciona" },
  ];
  return (
    <header
      className="sticky top-0 z-50 backdrop-blur-xl transition-colors duration-300"
      style={{
        background: scrolled ? "rgba(255,255,255,0.72)" : "#FFFFFF",
        borderBottom: `1px solid ${scrolled ? "rgba(17,17,17,0.05)" : "transparent"}`,
      }}
    >
      <div className="mx-auto flex h-[56px] max-w-[1120px] items-center justify-between px-6 sm:h-[72px] sm:px-10">
        <Link to="/" aria-label="iMAG" className="inline-flex items-center">
          <ImagLogo size={15} color={INK} />
        </Link>
        <nav className="hidden items-center gap-9 text-[13.5px] md:flex" style={{ color: MUTED }}>
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="transition-colors duration-200 hover:text-[#111111]"
            >
              {l.label}
            </a>
          ))}
          <Link
            to="/auth"
            onClick={() => track("cta_click", { location: "header", target: "auth" })}
            className="font-medium transition-colors duration-200 hover:text-[#111111]"
            style={{ color: INK }}
          >
            Entrar
          </Link>
        </nav>
        <button
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen((v) => !v)}
          className="-mr-2 grid h-9 w-9 place-items-center md:hidden"
          style={{ color: INK }}
        >
          {open ? <X className="h-5 w-5" strokeWidth={1.5} /> : <Menu className="h-5 w-5" strokeWidth={1.5} />}
        </button>
      </div>
      {open && (
        <div className="md:hidden" style={{ borderTop: `1px solid ${HAIR}` }}>
          <nav className="mx-auto flex max-w-[1120px] flex-col px-6 py-2 text-[15px]">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="py-4"
                style={{ color: INK, borderBottom: `1px solid ${HAIR}` }}
              >
                {l.label}
              </a>
            ))}
            <Link to="/auth" onClick={() => setOpen(false)} className="py-4 font-medium" style={{ color: INK }}>
              Entrar
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <MagneticField size={560} className="left-1/2 top-[-170px] -translate-x-1/2" />
      <div className="relative z-10 mx-auto flex max-w-[1120px] flex-col items-center px-6 pb-12 pt-6 text-center sm:px-10 sm:pb-16 sm:pt-8">
        <motion.div
          className="flex flex-col items-center"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <MagFull state="confident" size={112} className="opacity-95" />

          <h1
            className="mt-3 text-[34px] font-bold leading-[1.06] tracking-[-0.04em] sm:text-[46px] lg:text-[52px]"
            style={{ color: INK }}
          >
            Direção para
            <br />
            <span style={{ color: BLUE }}>a vida real.</span>
          </h1>

          <p
            className="mx-auto mt-3 max-w-[38ch] text-[15.5px] leading-[1.55]"
            style={{ color: MUTED }}
          >
            Sua IA amiga que facilita sua vida
            <br />
            com foco, organização e direção.
          </p>

          <Link
            to="/auth"
            search={{ intent: "signup" }}
            onClick={() => track("cta_click", { location: "hero", target: "auth_primary" })}
            className="mt-6 inline-flex items-center justify-center rounded-full px-8 py-[12px] text-[14.5px] font-medium text-white transition-all duration-200 hover:-translate-y-[1px]"
            style={{ background: BLUE, boxShadow: "0 6px 18px -10px rgba(51,92,255,0.55)" }}
          >
            Começar grátis
          </Link>
          <p className="mt-3 text-[11.5px]" style={{ color: MUTED }}>
            10 dias grátis · sem compromisso
          </p>
          <Link
            to="/auth"
            search={{ intent: "login" }}
            className="mt-3 text-[13px] transition-colors duration-200 hover:text-[#111111]"
            style={{ color: MUTED }}
          >
            Já tenho acesso
          </Link>
        </motion.div>
      </div>
    </section>
  );
}


function HowItWorks() {
  const steps = [
    { n: "01", title: "Entende", desc: "Seu contexto." },
    { n: "02", title: "Organiza", desc: "O que importa." },
    { n: "03", title: "Direciona", desc: "Seu próximo passo." },
    { n: "04", title: "Acompanha", desc: "Sua evolução." },
  ];
  return (
    <Section id="como-funciona">
      <Reveal>
        <SectionTitle>Como funciona</SectionTitle>
      </Reveal>
      <div className="mt-1 max-w-[680px]">
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 0.05}>
            <div
              className="flex items-start gap-6 py-4 sm:gap-10"
              style={{ borderTop: i === 0 ? undefined : "1px solid rgba(17,17,17,0.07)" }}
            >
              <span
                className="w-[34px] shrink-0 pt-[4px] text-[11.5px] tabular-nums tracking-[0.08em]"
                style={{ color: i === 1 ? BLUE_DARK : "rgba(17,17,17,0.35)" }}
              >
                {s.n}
              </span>
              <div className="min-w-0">
                <div
                  className="text-[18px] font-semibold tracking-[-0.025em] sm:text-[20px]"
                  style={{ color: i === 1 ? BLUE_DARK : INK }}
                >
                  {s.title}
                </div>
                <div className="mt-1 text-[14.5px] leading-[1.5]" style={{ color: MUTED }}>
                  {s.desc}
                </div>
              </div>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}




/* ---------------- CTA final ---------------- */

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-white" style={{ borderTop: `1px solid ${HAIR}` }}>
      <div className="relative z-10 mx-auto max-w-[1120px] px-6 pb-12 pt-10 text-center sm:px-10 sm:pb-16 sm:pt-14">
        <Reveal>
          <p
            className="mx-auto whitespace-nowrap text-[clamp(20px,5.4vw,44px)] font-bold leading-[1.15] tracking-[-0.035em]"
          >
            <span style={{ color: INK }}>Organização inteligente.</span>
            <br />
            <span style={{ color: BLUE }}>Inteligência amiga.</span>
          </p>
        </Reveal>
        <Reveal delay={0.12}>
          <div className="mt-7 flex flex-col items-center">
            <Link
              to="/auth"
              search={{ intent: "signup" }}
              onClick={() => track("cta_click", { location: "final", target: "auth_primary" })}
              className="inline-flex items-center justify-center rounded-full px-8 py-[12px] text-[14.5px] font-medium text-white transition-all duration-200 hover:-translate-y-[1px]"
              style={{ background: BLUE, boxShadow: "0 6px 18px -10px rgba(51,92,255,0.55)" }}
            >
              Começar grátis
            </Link>
            <p className="mt-2.5 text-[11.5px]" style={{ color: MUTED }}>
              10 dias grátis · sem compromisso
            </p>
            <Link
              to="/auth"
              search={{ intent: "login" }}
              className="mt-3 text-[13px] transition-colors duration-200 hover:text-[#111111]"
              style={{ color: MUTED }}
            >
              Já tenho acesso
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}



/* ---------------- Footer ---------------- */

function Footer() {
  return (
    <footer className="bg-white" style={{ borderTop: `1px solid ${HAIR}` }}>
      <div className="mx-auto max-w-[1120px] px-6 py-8 sm:px-10">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <ImagLogo size={14} color={INK} />
            <p className="text-[12.5px] font-medium" style={{ color: BLUE_DARK }}>
              Menos ruído. Mais direção.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]" style={{ color: MUTED }}>
            <a href="#o-que-e" className="transition-colors duration-200 hover:text-[#111111]">O que é</a>
            <a href="#como-funciona" className="transition-colors duration-200 hover:text-[#111111]">Como funciona</a>
            <Link to="/auth" className="transition-colors duration-200 hover:text-[#111111]">Entrar</Link>
          </nav>
        </div>
        <div
          className="mt-6 flex flex-col gap-2 pt-5 text-[12px] sm:flex-row sm:items-center sm:justify-between"
          style={{ borderTop: `1px solid ${HAIR}`, color: MUTED }}
        >
          <div className="flex gap-5">
            <Link to="/privacidade" className="hover:text-[#111111]">Privacidade</Link>
            <Link to="/termos" className="hover:text-[#111111]">Termos</Link>
          </div>
          <div>© iMAG {new Date().getFullYear()}</div>
        </div>
      </div>
    </footer>
  );
}
