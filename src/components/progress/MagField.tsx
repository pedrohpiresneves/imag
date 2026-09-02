import { MagHead } from "@/components/mag/MagHead";
import { levelForMagnetos } from "@/lib/antenna";

/**
 * Campo circular da MAG — arco fino de ritmo com a cabeça frontal ao centro.
 * A MAG permanece idêntica ao original: só o raio existente muda de cor.
 */
export function MagField({
  progress,
  size = 160,
  magnetos = 0,
}: {
  progress: number;
  size?: number;
  magnetos?: number;
  pulse?: boolean;
}) {
  const p = Math.max(0, Math.min(1, progress));
  const stroke = 1.5;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const angle = -Math.PI / 2 + p * 2 * Math.PI;
  const dotX = cx + r * Math.cos(angle);
  const dotY = cx + r * Math.sin(angle);

  const level = levelForMagnetos(magnetos);
  const tone = level.color;
  const headSize = size * 0.42;

  return (
    <span
      className="relative inline-block shrink-0"
      style={{ width: size, height: size }}
      aria-label={`Seu campo — ${level.name}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#E9ECF3" strokeWidth={stroke} />
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * p} ${c}`}
          transform={`rotate(-90 ${cx} ${cx})`}
          style={{ transition: "stroke-dasharray 900ms cubic-bezier(0.22,1,0.36,1)" }}
        />
        {p > 0 && <circle cx={dotX} cy={dotY} r={3.5} fill={tone} />}
      </svg>

      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%]"
        style={{
          bottom: size * 0.24,
          width: size * 0.3,
          height: Math.max(3, size * 0.035),
          background: "rgba(15,23,42,0.12)",
          filter: "blur(4px)",
        }}
      />
      <MagHead
        size={headSize}
        level={level}
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      />
    </span>
  );
}

