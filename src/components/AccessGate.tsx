import { ButtonLink, Eyebrow } from "@/components/ui-imag";
import { Check } from "lucide-react";

type Variant = "chapter" | "mentor" | "generic";

const COPY: Record<"generic", { eyebrow: string; title: string; body: string }> = {
  generic: {
    eyebrow: "Acesso completo",
    title: "Desbloqueie o manual inteiro.",
    body:
      "Assine para ter acesso completo aos 9 capítulos, ao PDF, aos exercícios e à MAG.",
  },
};

const CHAPTER_BENEFITS = [
  "Biblioteca completa",
  "9 capítulos exclusivos",
  "PDF Premium",
  "Exercícios práticos",
  "MAG ilimitado",
  "MAGcast",
  "Atualizações contínuas",
];

const MENTOR_BENEFITS = [
  "MAG ilimitado",
  "Biblioteca completa",
  "9 capítulos exclusivos",
  "Exercícios práticos",
  "PDF Premium",
  "MAGcast",
  "Atualizações contínuas",
];

export function AccessGate({
  variant = "generic",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  if (variant === "chapter" || variant === "mentor") {
    const benefits = variant === "chapter" ? CHAPTER_BENEFITS : MENTOR_BENEFITS;
    const subtitle =
      variant === "chapter"
        ? "Seu próximo capítulo começa agora. Continue construindo sua autoridade com a experiência completa da iMAG."
        : "Continue conversando com o MAG sem limitações. Desbloqueie o acesso completo e libere toda a Biblioteca, exercícios, PDF Premium e o MAGcast.";
    return (
      <section
        className={`fade-rise border-t border-[color:var(--hair)] pt-16 pb-10 text-center sm:pt-20 ${className}`}
      >
        <Eyebrow>Acesso completo</Eyebrow>
        <h2 className="mx-auto mt-5 max-w-[24ch] text-[28px] font-semibold leading-[1.12] tracking-[-0.025em] text-[color:var(--ink)] sm:text-[38px]">
          Você chegou ao fim da prévia.
        </h2>
        <p className="mx-auto mt-5 max-w-[46ch] text-[15px] leading-relaxed text-[color:var(--text-secondary)]">
          {subtitle}
        </p>

        <ul className="mx-auto mt-12 flex max-w-sm flex-col gap-4 text-left">
          {benefits.map((b) => (
            <li
              key={b}
              className="flex items-center gap-3 text-[14px] text-[color:var(--ink-soft)]"
            >
              <span
                aria-hidden
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                style={{ background: "var(--blue-tint)", color: "var(--blue)" }}
              >
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
              <span>{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-12 flex flex-col items-center gap-3">
          <ButtonLink to="/planos" variant="primary" size="lg">
            Ver planos
          </ButtonLink>
        </div>
      </section>
    );
  }

  const c = COPY.generic;
  return (
    <div
      className={`rounded-[20px] border border-[color:var(--hair)] bg-[color:var(--surface)] p-8 text-center shadow-[var(--shadow-card)] sm:p-10 ${className}`}
    >
      <Eyebrow>{c.eyebrow}</Eyebrow>
      <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.02em] text-[color:var(--ink)] sm:text-[26px]">
        {c.title}
      </h2>
      <p className="mx-auto mt-3 max-w-[46ch] text-[14px] leading-relaxed text-[color:var(--text-secondary)]">
        {c.body}
      </p>
      <ButtonLink to="/planos" variant="primary" size="lg" className="mt-8">
        Ver planos
      </ButtonLink>
    </div>
  );
}