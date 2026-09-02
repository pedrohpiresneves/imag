import type { CSSProperties } from "react";
import imagLogoAsset from "@/assets/imag-logo.png.asset.json";

interface LogoProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

// Official iMAG logo — Magnetic M mark and "iMAG" wordmark as a single,
// indivisible horizontal lockup. Native aspect ratio ~ 692x209.
const LOGO_RATIO = 692 / 209;

/**
 * Official iMAG logo. Renders the exact brand file, tintable via `color`
 * (defaults to `currentColor` so it inherits text color for dark/light modes).
 * `size` sets the rendered height in px.
 */
export function ImagLogo({ size = 40, className, style, color = "currentColor" }: LogoProps & { color?: string }) {
  const width = size * LOGO_RATIO;
  return (
    <span
      role="img"
      aria-label="iMAG"
      className={className}
      style={{
        display: "inline-block",
        width: `${width}px`,
        height: `${size}px`,
        backgroundColor: color,
        WebkitMaskImage: `url(${imagLogoAsset.url})`,
        maskImage: `url(${imagLogoAsset.url})`,
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        ...style,
      }}
    />
  );
}

/**
 * Backwards-compatible aliases. The official brand file is one indivisible
 * lockup, so both the "mark" and the "lockup" now render the same asset.
 * `size` is treated as the visual height reference; the lockup scales up
 * slightly to preserve the previous visual weight in headers.
 */
export function ImagMark(props: LogoProps & { color?: string }) {
  return <ImagLogo {...props} />;
}

export function ImagWordmark({ size = 22, className, style }: LogoProps) {
  return <ImagLogo size={size * 1.6} className={className} style={style} />;
}

export function ImagLockup({ size = 22, className, style }: LogoProps) {
  return <ImagLogo size={size * 1.8} className={className} style={style} />;
}