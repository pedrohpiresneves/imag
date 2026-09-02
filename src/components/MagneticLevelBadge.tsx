import { CSSProperties } from "react";

type Props = {
  size?: number;
  progress?: number; // 0..1
  color?: string;
  track?: string;
};

/**
 * Símbolo abstrato de magnetismo: linhas de campo curvadas ao redor de um
 * núcleo luminoso, envoltas por um arco de progresso.
 */
export function MagneticLevelBadge({
  size = 64,
  progress = 0,
  color = "#1E56E0",
  track = "#EAEEF5",
}: Props) {
  const stroke = Math.max(3, Math.round(size * 0.075));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * Math.min(1, Math.max(0, progress));
  const cx = size / 2;
  const cy = size / 2;

  const style: CSSProperties = { width: size, height: size };

  return (
    <span
      aria-label="Nível magnético"
      className="relative inline-grid shrink-0 place-items-center"
      style={style}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        <g
          transform={`translate(${cx}, ${cy}) rotate(-135) scale(${size / 30}) translate(-12, -12)`}
          fill="none"
          stroke={color}
          strokeWidth={1}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Ferradura — contornos externo e interno, traço fino */}
          <path d="M5.5 18 V11 A6.5 6.5 0 0 1 18.5 11 V18" />
          <path d="M9 18 V11 A3 3 0 0 1 15 11 V18" />
          <path d="M5.5 18 H9" />
          <path d="M15 18 H18.5" />
          {/* Marcações discretas dos polos */}
          <path d="M6.2 15.6 H8.3" opacity={0.7} />
          <path d="M15.7 15.6 H17.8" opacity={0.7} />

          {/* Brilhos delicados */}
          <g strokeWidth={0.8} opacity={0.85}>
            <path d="M20.4 5.6 V7.2 M19.6 6.4 H21.2" />
            <path d="M17.6 3.6 V4.6 M17.1 4.1 H18.1" />
          </g>
        </g>
      </svg>
    </span>
  );
}