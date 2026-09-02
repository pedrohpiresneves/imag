import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar, Wallet, Users, TrendingUp, MessageCircle, Send, Plus, Pencil, Check } from "lucide-react";
import { MagFull } from "@/components/mag/MagMascot";

const INK = "#111111";
const BLUE = "#335CFF";
const MUTED = "#7B7F89";
const HAIR = "#E8EAF0";
const BLUE_CARD = "#EDF1FF";
const BLUE_CARD_BORDER = "#D9E0FA";
const EASE = [0.22, 1, 0.36, 1] as const;

type ScreenKey = "Hoje" | "MAG" | "Dinheiro" | "Círculos" | "Progresso";

const screens: ScreenKey[] = ["Hoje", "MAG", "Dinheiro", "Círculos", "Progresso"];

/* ---------- Helpers ---------- */
function classNames(...c: (string | false | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

function PhoneFrame({
  children,
  label,
  isCenter,
}: {
  children: React.ReactNode;
  label: string;
  isCenter?: boolean;
}) {
  return (
    <div
      className={classNames(
        "relative shrink-0 rounded-[34px] border border-[#D9DFEA] bg-white p-[10px] shadow-[0_20px_50px_-20px_rgba(17,17,17,0.14)] transition-all duration-500",
        isCenter ? "scale-100 opacity-100" : "scale-[0.92] opacity-60 md:scale-[0.88]"
      )}
      style={{ width: "var(--phone-w)", height: "var(--phone-h)" }}
    >
      <div className="relative h-full w-full overflow-hidden rounded-[24px] bg-white">
        {children}
        <div
          className="pointer-events-none absolute inset-0 rounded-[24px]"
          style={{ boxShadow: "inset 0 0 0 1px rgba(17,17,17,0.04)" }}
        />
      </div>
      <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[12.5px] font-medium tracking-[-0.01em]" style={{ color: isCenter ? INK : MUTED }}>
        {label}
      </div>
    </div>
  );
}


/* ---------- Screen mocks ---------- */
function StatusBar() {
  return (
    <div className="flex items-center justify-between px-5 py-2 text-[10px] font-medium" style={{ color: INK }}>
      <span>12:07</span>
      <span className="flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: HAIR }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: HAIR }} />
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: HAIR }} />
      </span>
    </div>
  );
}

function HojeScreen() {
  return (
    <div className="flex h-full flex-col" style={{ color: INK, fontFamily: "var(--font-sans), system-ui, sans-serif" }}>
      <StatusBar />

      <div className="px-5 pt-1">
        <h1 className="text-[26px] font-semibold tracking-[-0.03em]" style={{ color: INK }}>Hoje</h1>
      </div>

      <div className="space-y-2.5 overflow-hidden p-3 pt-2">
        {/* Foco da semana */}
        <div className="rounded-[18px] px-3.5 py-2.5" style={{ background: "#F7F8FB" }}>
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: BLUE_CARD }}>
              <div className="h-3.5 w-3.5 rounded-full" style={{ border: `2px solid ${BLUE}` }}>
                <div className="m-[3px] h-[5px] w-[5px] rounded-full" style={{ background: BLUE }} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[9px] font-medium uppercase tracking-[0.08em]" style={{ color: MUTED }}>Foco da semana</div>
              <div className="mt-0.5 text-[13.5px] font-semibold tracking-[-0.01em]">Quero emagrecer</div>
            </div>
            <div className="grid h-7 w-7 place-items-center rounded-full" style={{ background: "#F0F2F8" }}>
              <Pencil className="h-3.5 w-3.5" style={{ color: BLUE }} />
            </div>
          </div>
        </div>

        {/* Card MAG */}
        <div className="rounded-[18px] px-3.5 py-3" style={{ background: BLUE_CARD, border: `1px solid ${BLUE_CARD_BORDER}` }}>
          <div className="flex items-start gap-2.5">
            <MagFull state="confident" size={26} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-semibold" style={{ color: INK }}>MAG</span>
                <span className="flex items-center gap-1 text-[11px]" style={{ color: MUTED }}>
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#F59E0B" }} />
                  Em andamento
                </span>
              </div>
              <p className="mt-1.5 text-[14px] font-semibold leading-[1.35]" style={{ color: INK }}>
                Que tal listarmos o que você comeu nas últimas 24 horas?
              </p>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0" style={{ color: BLUE }} />
          </div>
        </div>

        {/* Atalhos circulares */}
        <div className="flex justify-center gap-4 py-1">
          {[
            { label: "Agenda", icon: Calendar },
            { label: "Dinheiro", icon: Wallet },
            { label: "Círculos", icon: Users },
          ].map(({ label, icon: Icon }) => (
            <div key={label} className="flex flex-col items-center gap-1.5">
              <div className="grid h-10 w-10 place-items-center rounded-full" style={{ background: "#F7F8FB" }}>
                <Icon className="h-[18px] w-[18px]" style={{ color: BLUE }} />
              </div>
              <span className="text-[10px] font-medium" style={{ color: INK }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Compromissos */}
        <div className="rounded-[18px] bg-white p-3.5" style={{ border: "1px solid #E8EAF0" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Calendar className="h-5 w-5" style={{ color: BLUE }} />
              <span className="text-[15px] font-semibold">Compromissos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-full" style={{ background: "#F7F8FB" }}>
                <Plus className="h-4 w-4" style={{ color: BLUE }} />
              </div>
              <ChevronRight className="h-4 w-4" style={{ color: MUTED }} />
            </div>
          </div>
        </div>

        {/* Tarefas */}
        <div className="rounded-[18px] bg-white p-3.5" style={{ border: "1px solid #E8EAF0" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-5 w-5 place-items-center rounded" style={{ background: BLUE_CARD }}>
                <Check className="h-3 w-3" style={{ color: BLUE }} />
              </div>
              <span className="text-[15px] font-semibold">Tarefas</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-full" style={{ background: "#F7F8FB" }}>
                <Plus className="h-4 w-4" style={{ color: BLUE }} />
              </div>
              <ChevronRight className="h-4 w-4" style={{ color: MUTED }} />
            </div>
          </div>
          <p className="mt-2 text-[12px]" style={{ color: MUTED }}>Nenhuma tarefa</p>
        </div>
      </div>
    </div>
  );
}

function MagScreen() {
  return (
    <div className="flex h-full flex-col" style={{ color: INK, fontFamily: "var(--font-sans), system-ui, sans-serif" }}>
      <StatusBar />
      <div className="flex items-center justify-center border-b px-4 py-2.5" style={{ borderColor: "#E8EAF0" }}>
        <span className="text-[15px] font-semibold">MAG</span>
      </div>

      <div className="flex-1 space-y-3 overflow-hidden bg-[#FAFBFC] p-3">
        <div className="flex gap-2">
          <div className="h-7 w-7 shrink-0 rounded-full" style={{ background: HAIR }} />
          <div className="max-w-[78%] rounded-2xl rounded-tl-md bg-white px-3 py-2" style={{ border: "1px solid #E8EAF0" }}>
            <div className="text-[10.5px] leading-snug">Quero organizar minha semana</div>
          </div>
        </div>

        <div className="flex flex-row-reverse gap-2">
          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full" style={{ background: BLUE }}>
            <MagFull state="confident" size={28} className="-ml-0.5 -mt-0.5" />
          </div>
          <div className="max-w-[82%] rounded-2xl rounded-tr-md px-3 py-2.5 text-white" style={{ background: BLUE }}>
            <div className="text-[10.5px] leading-snug">Perfeito. Vou montar sua Direção do Dia com base no que importa hoje.</div>
          </div>
        </div>

        <div className="flex flex-row-reverse gap-2">
          <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full" style={{ background: BLUE }}>
            <MagFull state="confident" size={28} className="-ml-0.5 -mt-0.5" />
          </div>
          <div className="max-w-[82%] rounded-2xl rounded-tr-md px-3 py-2.5" style={{ background: BLUE_CARD, border: `1px solid ${BLUE_CARD_BORDER}` }}>
            <div className="text-[10.5px] leading-snug" style={{ color: INK }}>
              1. Foco da semana: Saúde<br />2. 3 tarefas priorizadas<br />3. Check-in à noite
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t px-3 py-2.5" style={{ borderColor: "#E8EAF0" }}>
        <div className="flex-1 rounded-full px-3 py-2 text-[11px]" style={{ background: "#F7F8FB", color: MUTED }}>
          Converse com a MAG...
        </div>
        <div className="grid h-8 w-8 place-items-center rounded-full text-white" style={{ background: BLUE }}>
          <Send className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}

function DinheiroScreen() {
  return (
    <div className="flex h-full flex-col" style={{ color: INK, fontFamily: "var(--font-sans), system-ui, sans-serif" }}>
      <StatusBar />
      <div className="flex items-center justify-center border-b px-4 py-2.5" style={{ borderColor: "#E8EAF0" }}>
        <span className="text-[15px] font-semibold">Meu dinheiro</span>
      </div>

      <div className="space-y-2.5 overflow-hidden p-3">
        <div className="flex gap-2">
          {["Semana", "Mês"].map((t, i) => (
            <div
              key={t}
              className="rounded-full px-3 py-1 text-[10px] font-semibold"
              style={{ background: i === 1 ? BLUE : "#F7F8FB", color: i === 1 ? "#fff" : MUTED }}
            >
              {t}
            </div>
          ))}
        </div>

        <div className="rounded-[18px] px-4 py-3" style={{ background: BLUE_CARD, border: `1px solid ${BLUE_CARD_BORDER}` }}>
          <div className="text-[11px] font-medium" style={{ color: MUTED }}>Saldo do período</div>
          <div className="mt-1 text-[22px] font-bold tracking-[-0.02em]" style={{ color: INK }}>R$ 1.247,00</div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-[16px] px-3 py-2.5" style={{ background: "#F7F8FB" }}>
            <div className="text-[10px] font-medium" style={{ color: MUTED }}>Receitas</div>
            <div className="mt-0.5 text-[14px] font-bold" style={{ color: "#16A34A" }}>+R$ 3.200</div>
          </div>
          <div className="rounded-[16px] px-3 py-2.5" style={{ background: "#F7F8FB" }}>
            <div className="text-[10px] font-medium" style={{ color: MUTED }}>Gastos</div>
            <div className="mt-0.5 text-[14px] font-bold" style={{ color: "#DC2626" }}>-R$ 1.953</div>
          </div>
        </div>

        <div className="rounded-[18px] bg-white p-3.5" style={{ border: "1px solid #E8EAF0" }}>
          <div className="text-[13px] font-semibold">Últimos registros</div>
          <div className="mt-2.5 space-y-2">
            {[
              { t: "Salário", v: "+ R$ 4.500,00" },
              { t: "Mercado", v: "- R$ 420,00" },
              { t: "Academia", v: "- R$ 120,00" },
            ].map(({ t, v }) => (
              <div key={t} className="flex items-center justify-between text-[11px]">
                <span style={{ color: MUTED }}>{t}</span>
                <span className="font-semibold">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-6 right-5 grid h-10 w-10 place-items-center rounded-full text-white shadow-lg" style={{ background: BLUE }}>
        <Plus className="h-5 w-5" />
      </div>
    </div>
  );
}

function CirculosScreen() {
  return (
    <div className="flex h-full flex-col" style={{ color: INK, fontFamily: "var(--font-sans), system-ui, sans-serif" }}>
      <StatusBar />
      <div className="flex items-center justify-center border-b px-4 py-2.5" style={{ borderColor: "#E8EAF0" }}>
        <span className="text-[15px] font-semibold">Círculos</span>
      </div>

      <div className="space-y-2.5 overflow-hidden p-3">
        <div className="rounded-[18px] px-4 py-3" style={{ background: BLUE_CARD, border: `1px solid ${BLUE_CARD_BORDER}` }}>
          <div className="text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ color: BLUE }}>Foco em comum</div>
          <div className="mt-1 text-[15px] font-semibold">Leitura diária</div>
          <div className="mt-2.5 flex -space-x-1.5">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-7 w-7 rounded-full border-2 border-white"
                style={{ background: `hsl(${220 + i * 15}, 72%, ${78 + i * 2}%)` }}
              />
            ))}
            <div className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-white text-[9px] font-semibold" style={{ color: MUTED }}>
              +2
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "#E8EAF0" }}>
            <div className="h-full rounded-full" style={{ width: "68%", background: BLUE }} />
          </div>
          <div className="mt-1 text-[10px]" style={{ color: MUTED }}>68% da constância desta semana</div>
        </div>

        <div className="rounded-[18px] bg-white p-3.5" style={{ border: "1px solid #E8EAF0" }}>
          <div className="text-[13px] font-semibold">Direção do Círculo</div>
          <div className="mt-1.5 text-[12px] leading-snug" style={{ color: MUTED }}>
            Hoje todos leem 10 páginas e marcam o check-in.
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressoScreen() {
  return (
    <div className="flex h-full flex-col" style={{ color: INK, fontFamily: "var(--font-sans), system-ui, sans-serif" }}>
      <StatusBar />
      <div className="flex items-center justify-center border-b px-4 py-2.5" style={{ borderColor: "#E8EAF0" }}>
        <span className="text-[15px] font-semibold">Progresso</span>
      </div>

      <div className="space-y-2.5 overflow-hidden p-3">
        <div className="rounded-[18px] px-4 py-3" style={{ background: BLUE_CARD, border: `1px solid ${BLUE_CARD_BORDER}` }}>
          <div className="flex items-center gap-3">
            <div
              className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 text-white"
              style={{ borderColor: BLUE, background: BLUE }}
            >
              <span className="text-[13px] font-bold">A</span>
            </div>
            <div className="min-w-0">
              <div className="text-[15px] font-semibold">Antena Azul</div>
              <div className="text-[12px]" style={{ color: MUTED }}>41 Magnetos</div>
            </div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full" style={{ background: "rgba(51,92,255,0.12)" }}>
            <div className="h-full rounded-full" style={{ width: "41%", background: BLUE }} />
          </div>
          <div className="mt-1.5 text-[10px] font-medium" style={{ color: MUTED }}>59 para Antena Verde</div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-[16px] px-3 py-2.5" style={{ background: "#F7F8FB" }}>
            <div className="text-[10px] font-medium" style={{ color: MUTED }}>Direções</div>
            <div className="mt-0.5 text-[16px] font-bold">41</div>
          </div>
          <div className="rounded-[16px] px-3 py-2.5" style={{ background: "#F7F8FB" }}>
            <div className="text-[10px] font-medium" style={{ color: MUTED }}>Execução</div>
            <div className="mt-0.5 text-[16px] font-bold">56%</div>
          </div>
        </div>

        <div className="rounded-[18px] bg-white p-3.5" style={{ border: "1px solid #E8EAF0" }}>
          <div className="text-[13px] font-semibold">Próximo marco</div>
          <div className="mt-1 text-[12px]" style={{ color: MUTED }}>30 dias com direção</div>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full" style={{ background: "#E8EAF0" }}>
            <div className="h-full rounded-full" style={{ width: "72%", background: BLUE }} />
          </div>
        </div>
      </div>
    </div>
  );
}

const screenComponents: Record<ScreenKey, React.FC> = {
  Hoje: HojeScreen,
  MAG: MagScreen,
  Dinheiro: DinheiroScreen,
  Círculos: CirculosScreen,
  Progresso: ProgressoScreen,
};

/* ---------- Carousel ---------- */
export function ProductCarousel() {
  const [active, setActive] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(index, screens.length - 1));
    setActive(clamped);
    const el = itemRefs.current[clamped];
    if (el && trackRef.current) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  };

  const onScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const center = track.scrollLeft + track.clientWidth / 2;
    let closest = 0;
    let min = Infinity;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const diff = Math.abs(el.offsetLeft + el.offsetWidth / 2 - center);
      if (diff < min) {
        min = diff;
        closest = i;
      }
    });
    setActive(closest);
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  const slidePrev = () => goTo(active - 1);
  const slideNext = () => goTo(active + 1);

  return (
    <section id="o-que-e" className="relative overflow-hidden bg-white py-16 sm:py-24">
      <style>{`
        .product-carousel {
          --phone-w: 260px;
          --phone-h: 520px;
        }
        @media (min-width: 768px) {
          .product-carousel {
            --phone-w: 290px;
            --phone-h: 580px;
          }
        }
        .product-track {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .product-track::-webkit-scrollbar {
          display: none;
        }
      `}</style>

      <div className="mx-auto max-w-[1120px] px-6 text-center sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          <h2
            className="mx-auto max-w-[16ch] text-[32px] font-bold leading-[1.05] tracking-[-0.035em] sm:text-[44px]"
            style={{ color: INK }}
          >
            A iMAG organiza
            <br />
            <span style={{ color: BLUE }}>tudo pra você.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-[42ch] text-[15px] leading-[1.55]" style={{ color: MUTED }}>
            Conheça as principais telas e veja como a iMAG organiza, direciona e acompanha sua rotina.
          </p>
        </motion.div>
      </div>

      <div className="product-carousel relative mt-12 sm:mt-16">
        {/* Subtle brand mascot */}
        <div className="pointer-events-none absolute left-[max(12px,calc(50%-560px))] top-1/2 z-10 hidden -translate-y-1/2 lg:block">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.3 }}
          >
            <MagFull state="confident" size={72} className="opacity-90" />
          </motion.div>
        </div>

        <div className="relative flex items-center justify-center">
          <button
            aria-label="Tela anterior"
            onClick={slidePrev}
            disabled={active === 0}
            className="absolute left-2 z-20 grid h-10 w-10 place-items-center rounded-full border bg-white shadow-sm transition-all duration-200 hover:scale-105 disabled:opacity-30 sm:left-4 md:left-8 lg:left-[max(16px,calc(50%-500px))]"
            style={{ borderColor: HAIR, color: INK }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div
            ref={trackRef}
            className="product-track flex w-full gap-5 overflow-x-auto px-[calc((100%-var(--phone-w))/2)] py-4 md:gap-6"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {screens.map((screen, i) => {
              const Screen = screenComponents[screen];
              return (
                <div
                  key={screen}
                  ref={(el) => { itemRefs.current[i] = el; }}
                  style={{ scrollSnapAlign: "center" }}
                >
                  <PhoneFrame label={screen} isCenter={i === active}>
                    <Screen />
                  </PhoneFrame>
                </div>
              );
            })}
          </div>

          <button
            aria-label="Próxima tela"
            onClick={slideNext}
            disabled={active === screens.length - 1}
            className="absolute right-2 z-20 grid h-10 w-10 place-items-center rounded-full border bg-white shadow-sm transition-all duration-200 hover:scale-105 disabled:opacity-30 sm:right-4 md:right-8 lg:right-[max(16px,calc(50%-500px))]"
            style={{ borderColor: HAIR, color: INK }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Indicators */}
        <div className="mt-6 flex justify-center gap-2">
          {screens.map((_, i) => (
            <button
              key={i}
              aria-label={`Ir para tela ${i + 1}`}
              onClick={() => goTo(i)}
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: i === active ? 20 : 8,
                background: i === active ? BLUE : HAIR,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
