import { CSSProperties } from "react";

const DISPLAY: CSSProperties = {
  fontFamily:
    '"Geist", "Inter", ui-sans-serif, system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
};

type Props = {
  size?: number;
  progress?: number; // 0..1
  color?: string;
  track?: string;
};

export function MagnetosRing({
  size = 48,
  progress = 0.72,
  color = "#1E4FE0",
  track = "#ECEDEF",
}: Props) {
  const stroke = Math.max(3, Math.round(size * 0.09));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * Math.min(1, Math.max(0, progress));
  const fontSize = Math.round(size * 0.44);
  return (
    <span
      aria-label="MAGnetos"
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span
        className="relative leading-none"
        style={{
          ...DISPLAY,
          fontSize,
          fontWeight: 600,
          color,
          letterSpacing: "-0.02em",
        }}
      >
        M
      </span>
    </span>
  );
}