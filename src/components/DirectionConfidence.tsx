import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { getDirectionConfidence } from "@/lib/impact.functions";

const MUTED = "#6B6B70";
const HAIRLINE = "#ECEBE5";
const BLUE = "#335CFF";

const nf = new Intl.NumberFormat("pt-BR");

/** Card discreto abaixo da MAG Meta: prova coletiva antes da execução. */
export function DirectionConfidence({ title }: { title: string }) {
  const fetchConfidence = useServerFn(getDirectionConfidence);
  const { data } = useQuery({
    queryKey: ["direction-confidence", title],
    queryFn: () => fetchConfidence({ data: { title } }),
    enabled: !!title,
    staleTime: 60 * 60_000,
  });

  // Prova social apenas com amostra real suficiente. Nunca números simulados.
  if (!data || data.applied < 5 || data.pct <= 0) return null;

  return (
    <motion.p
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mt-3 rounded-[16px] px-4 py-3 text-[12.5px] font-light leading-relaxed"
      style={{ border: `1px solid ${HAIRLINE}`, background: "#FFFFFF", color: MUTED }}
    >
      Esta direção já foi aplicada por{" "}
      <span style={{ color: BLUE, fontWeight: 500 }}>{nf.format(data.applied)}</span>{" "}
      profissionais.{" "}
      <span style={{ color: BLUE, fontWeight: 500 }}>{data.pct}%</span> disseram que
      trouxe resultado.
    </motion.p>
  );
}