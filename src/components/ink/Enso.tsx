import { useId } from "react";

/**
 * Ensō (圆相): a single open brush circle, thick where the brush lands and
 * thinning as it lifts. Children (an icon, a numeral) sit in the middle.
 */
export default function Enso({
  size = 56,
  color = "currentColor",
  className = "",
  children,
}: {
  size?: number;
  color?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const fid = `enso-${useId().replace(/:/g, "")}`;
  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg aria-hidden viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" style={{ color }}>
        <defs>
          <filter id={fid} x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="3" seed="6" />
            <feDisplacementMap in="SourceGraphic" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <g filter={`url(#${fid})`} fill="currentColor">
          {/* Outer arc swells from the landing point (lower left) and tapers out before closing. */}
          <path d="M22 72 C 6 52, 14 18, 46 10 C 76 3, 96 28, 90 56 C 86 76, 66 92, 44 90 C 60 86, 80 74, 83 54 C 87 30, 70 14, 48 17 C 24 21, 13 48, 26 70 Z" opacity="0.85" />
          <path d="M44 90 C 36 89, 30 86, 26 82 C 32 85, 38 87, 46 87 Z" opacity="0.5" />
        </g>
      </svg>
      <span className="relative">{children}</span>
    </span>
  );
}
