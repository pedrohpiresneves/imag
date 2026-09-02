import { motion, useInView } from "framer-motion";
import { useMemo, useRef } from "react";
import { ImagMark } from "@/components/ImagLogo";

const easeOut = [0.22, 1, 0.36, 1] as const;
const GOLD = "#C6A15B";

interface Props {
  count?: number;
  size?: number;
  className?: string;
}

/**
 * Premium magnetic network illustration for the Círculo iMAG section.
 * — iMAG logo center, gold glow, concentric magnetic waves,
 *   avatars distributed on a perfect circle, thin connection lines,
 *   subtle pulses. All animations are quiet and institutional.
 */
export function MagneticNetwork({ count = 10, size = 460, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-15%" });

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.36;
  const avatarR = Math.max(9, size * 0.028);

  const nodes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        return {
          x: cx + Math.cos(angle) * radius,
          y: cy + Math.sin(angle) * radius,
          delay: 0.9 + i * 0.06,
          pulseDelay: (i % 4) * 0.9,
          pulses: i % 3 === 0,
        };
      }),
    [count, cx, cy, radius],
  );

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: "relative", width: "100%", maxWidth: size, aspectRatio: "1 / 1" }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width="100%"
        height="100%"
        style={{ display: "block", overflow: "visible" }}
        aria-hidden
      >
        <defs>
          <radialGradient id="mn-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={GOLD} stopOpacity="0.28" />
            <stop offset="55%" stopColor={GOLD} stopOpacity="0.05" />
            <stop offset="100%" stopColor={GOLD} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="mn-avatar" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1a1a1a" />
            <stop offset="100%" stopColor="#0d0d0d" />
          </radialGradient>
          <filter id="mn-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Central gold glow */}
        <circle cx={cx} cy={cy} r={radius * 0.9} fill="url(#mn-core)" />

        {/* Concentric magnetic waves */}
        {[0, 1, 2].map((i) => (
          <motion.circle
            key={`wave-${i}`}
            cx={cx}
            cy={cy}
            r={radius * 0.35}
            fill="none"
            stroke={GOLD}
            strokeWidth="0.6"
            initial={{ opacity: 0, scale: 0.4 }}
            animate={
              inView
                ? { opacity: [0, 0.28, 0], scale: [0.4, 1.9, 2.2] }
                : { opacity: 0, scale: 0.4 }
            }
            transition={{
              duration: 5.5,
              delay: 1.2 + i * 1.6,
              repeat: Infinity,
              ease: "easeOut",
            }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          />
        ))}

        {/* Static orbit hairline */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="0.5"
          strokeDasharray="2 4"
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 1.2, delay: 0.4, ease: easeOut }}
        />

        {/* Connection lines: center → avatar */}
        {nodes.map((n, i) => (
          <motion.line
            key={`line-${i}`}
            x1={cx}
            y1={cy}
            x2={n.x}
            y2={n.y}
            stroke={GOLD}
            strokeOpacity="0.18"
            strokeWidth="0.5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 0.28 } : { pathLength: 0, opacity: 0 }}
            transition={{ duration: 0.9, delay: 0.9 + i * 0.05, ease: easeOut }}
          />
        ))}

        {/* Ring lines: avatar → next avatar (subtle web) */}
        {nodes.map((n, i) => {
          const next = nodes[(i + 1) % nodes.length];
          return (
            <motion.line
              key={`ring-${i}`}
              x1={n.x}
              y1={n.y}
              x2={next.x}
              y2={next.y}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="0.4"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={inView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
              transition={{ duration: 0.8, delay: 1.3 + i * 0.04, ease: easeOut }}
            />
          );
        })}

        {/* Avatars */}
        {nodes.map((n, i) => (
          <motion.g
            key={`node-${i}`}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4 }}
            transition={{ duration: 0.6, delay: 0.15 + i * 0.05, ease: easeOut }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
            className="mn-node"
          >
            {n.pulses && (
              <motion.circle
                cx={n.x}
                cy={n.y}
                r={avatarR}
                fill="none"
                stroke={GOLD}
                strokeWidth="0.6"
                animate={{ opacity: [0.5, 0, 0.5], scale: [1, 2, 1] }}
                transition={{
                  duration: 3.2,
                  delay: n.pulseDelay,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                style={{ transformOrigin: `${n.x}px ${n.y}px` }}
              />
            )}
            <circle
              cx={n.x}
              cy={n.y}
              r={avatarR}
              fill="url(#mn-avatar)"
              stroke="rgba(255,255,255,0.14)"
              strokeWidth="0.6"
              className="mn-avatar-bg"
            />
            {/* Minimal silhouette: head + shoulders */}
            <circle
              cx={n.x}
              cy={n.y - avatarR * 0.28}
              r={avatarR * 0.32}
              fill="rgba(255,255,255,0.55)"
              className="mn-avatar-fg"
            />
            <path
              d={`M ${n.x - avatarR * 0.55} ${n.y + avatarR * 0.55}
                  a ${avatarR * 0.55} ${avatarR * 0.5} 0 0 1 ${avatarR * 1.1} 0`}
              fill="rgba(255,255,255,0.55)"
              className="mn-avatar-fg"
            />
          </motion.g>
        ))}
      </svg>

      {/* Central iMAG mark with gold aura */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.8 }}
        transition={{ duration: 1, delay: 0.2, ease: easeOut }}
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "relative",
            padding: size * 0.06,
            borderRadius: "999px",
            background: "radial-gradient(circle, rgba(199,167,108,0.18), transparent 70%)",
          }}
        >
          <motion.div
            animate={{ opacity: [0.75, 1, 0.75] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{
              filter: "drop-shadow(0 0 18px rgba(199,167,108,0.35))",
            }}
          >
            <ImagMark size={size * 0.11} />
          </motion.div>
        </div>
      </motion.div>

      <style>{`
        .mn-node:hover .mn-avatar-bg {
          stroke: ${GOLD};
          stroke-opacity: 0.9;
          transition: stroke 400ms ease;
        }
        .mn-node:hover .mn-avatar-fg {
          fill: ${GOLD};
          transition: fill 400ms ease;
        }
      `}</style>
    </div>
  );
}