import magHeadOfficial from "@/assets/mag-head-official.png.asset.json";
import type { AntennaLevel } from "@/lib/antenna";

/** Máscara com a silhueta exata do raio original da MAG (mesma tela da imagem oficial). */
const ANTENNA_MASK = "/mag-antenna-mask.png";

/**
 * Cabeça oficial da MAG, sem qualquer elemento adicionado.
 * A única variação possível é a COR do raio original, aplicada por máscara
 * pixel a pixel sobre a própria silhueta da antena.
 */
export function MagHead({
  size,
  level,
  className = "",
  style,
}: {
  size: number;
  level?: AntennaLevel | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  const tint = level && level.key !== "blue" ? level.fill : null;

  return (
    <span
      className={`relative inline-block shrink-0 select-none ${className}`}
      style={{ width: size, height: size, ...style }}
    >
      <img
        src={magHeadOfficial.url}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full select-none object-contain"
      />
      {tint && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: tint,
            WebkitMaskImage: `url(${ANTENNA_MASK})`,
            maskImage: `url(${ANTENNA_MASK})`,
            maskMode: "alpha",


            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            transition: "background 600ms ease",
          }}
        />
      )}
    </span>
  );
}
