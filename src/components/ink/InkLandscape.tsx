"use client";

import { useId } from "react";

export type InkVariant = "paper" | "night" | "jade";

/**
 * A full-bleed shan shui (山水) scene painted in SVG: a cinnabar sun (a moon at
 * night), three ranges of mountains receding into mist, a pine leaning out from
 * a cliff, a lone fishing boat, and birds. The centre is left empty (留白) so a
 * page's headline can sit in the sky.
 *
 * Brush character comes from SVG filters rather than images:
 *   rough — turbulence-driven displacement, for ragged ridgelines and foliage
 *   cun   — streaky noise cut into a shape, the dry-brush texture strokes (皴法)
 *   wash  — a soft blur, for distant ranges and mist
 *
 * Purely decorative: aria-hidden and pointer-events: none.
 *
 * `tone` scales the whole painting's opacity. The landing page uses it at full
 * strength; scripts/gen-ink-scenes.tsx renders a quiet copy of each variant to
 * public/ink/ for the fixed backdrop behind every other page (.ink-paper etc.).
 */
export default function InkLandscape({
  variant = "paper",
  className = "",
  tone = 1,
}: {
  variant?: InkVariant;
  className?: string;
  tone?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `${name}-${uid}`;
  const url = (name: string) => `url(#${id(name)})`;

  const night = variant === "night";
  const jade = variant === "jade";

  // Ink is dense ink on paper; at night the ranges are moonlit mist on ink.
  const ink = night ? "#e9e3d6" : "#1f1c19";
  const paperTone = night ? "#12100e" : jade ? "#f3efe2" : "#f5f0e4";
  const sun = night ? "#efe9db" : "#b54a33";

  // 青绿山水: mineral blue-green peaks over an ochre base.
  const peakTop = jade ? "#3d6166" : ink;
  const peakMid = jade ? "#567d5e" : ink;
  const peakBase = jade ? "#c19248" : ink;

  return (
    <svg
      aria-hidden
      className={`pointer-events-none select-none ${className}`}
      viewBox="0 0 1440 900"
      preserveAspectRatio="xMidYMax slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id={id("rough")} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014" numOctaves="4" seed="3" />
          <feDisplacementMap in="SourceGraphic" scale="22" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={id("roughFine")} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="8" />
          <feDisplacementMap in="SourceGraphic" scale="10" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={id("cun")} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.02 0.065" numOctaves="4" seed="21" result="n" />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.6 1.75"
            result="streaks"
          />
          <feComposite in="SourceGraphic" in2="streaks" operator="in" result="tex" />
          <feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="5" result="d" />
          <feDisplacementMap in="tex" in2="d" scale="18" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id={id("wash")} x="-10%" y="-20%" width="120%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <filter id={id("mist")} x="-20%" y="-100%" width="140%" height="300%">
          <feGaussianBlur stdDeviation="22" />
        </filter>
        <filter id={id("glow")} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>

        {/* Mountains fade out downward, their feet lost in mist. */}
        <linearGradient id={id("fadeFar")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={peakTop} stopOpacity={night ? 0.16 : 0.13} />
          <stop offset="0.7" stopColor={peakMid} stopOpacity={night ? 0.06 : 0.05} />
          <stop offset="1" stopColor={peakBase} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("fadeMid")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={peakTop} stopOpacity={night ? 0.32 : jade ? 0.55 : 0.42} />
          <stop offset="0.55" stopColor={peakMid} stopOpacity={night ? 0.14 : jade ? 0.32 : 0.18} />
          <stop offset="1" stopColor={peakBase} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id("fadeNear")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={ink} stopOpacity={night ? 0.5 : 0.85} />
          <stop offset="0.6" stopColor={jade ? peakTop : ink} stopOpacity={night ? 0.3 : 0.55} />
          <stop offset="1" stopColor={ink} stopOpacity="0.1" />
        </linearGradient>
        {/* Fades the scene out at the bottom so it melts into whatever page background is below. */}
        <linearGradient id={id("groundFade")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.72" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id={id("ground")} maskUnits="userSpaceOnUse" x="0" y="0" width="1440" height="900">
          <rect width="1440" height="900" fill={url("groundFade")} />
        </mask>
        <radialGradient id={id("halo")}>
          <stop offset="0" stopColor={sun} stopOpacity={night ? 0.35 : 0.18} />
          <stop offset="1" stopColor={sun} stopOpacity="0" />
        </radialGradient>
      </defs>

      <g mask={url("ground")} opacity={tone}>
      {/* ── Sky: sun / moon, birds ─────────────────────────────────────── */}
      <circle cx="1130" cy="175" r="120" fill={url("halo")} />
      <circle cx="1130" cy="175" r="44" fill={sun} opacity={night ? 0.92 : 0.82} filter={url("roughFine")} />

      <g stroke={ink} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity={night ? 0.5 : 0.62}>
        <path d="M1000 112 q 9 -8 17 0 q 8 -9 17 -1" />
        <path d="M1046 92 q 6 -5 12 0 q 6 -6 12 -1" strokeWidth="1.8" />
        <path d="M1062 128 q 7 -6 13 0 q 7 -7 13 -1" strokeWidth="1.6" />
        <path d="M972 140 q 5 -4 10 0 q 5 -5 10 -1" strokeWidth="1.4" />
      </g>

      {/* ── Far range: pale wash across the horizon, low in the centre ─── */}
      <g filter={url("wash")}>
        <path
          fill={url("fadeFar")}
          d="M0 470 C 70 430, 130 380, 210 400 C 260 412, 300 360, 360 372 C 430 386, 470 460, 560 500 C 640 535, 720 548, 800 540 C 880 532, 950 498, 1010 468 C 1070 438, 1110 400, 1180 410 C 1240 418, 1290 376, 1350 382 C 1400 386, 1420 400, 1440 410 L 1440 900 L 0 900 Z"
        />
      </g>

      {/* ── Mid range: textured peaks rising at left and right ─────────── */}
      <g filter={url("rough")}>
        <path
          fill={url("fadeMid")}
          d="M0 560 C 40 520, 80 470, 130 478 C 170 484, 190 420, 236 396 C 270 378, 300 420, 330 452 C 360 484, 380 470, 410 500 C 450 540, 500 580, 560 610 C 620 640, 680 660, 740 680 C 800 700, 850 770, 900 900 L 0 900 Z"
        />
        <path
          fill={url("fadeMid")}
          opacity="0.8"
          d="M690 900 C 730 820, 780 740, 820 700 C 880 650, 930 610, 990 600 C 1040 592, 1060 550, 1100 540 C 1140 530, 1170 560, 1200 548 C 1250 528, 1300 500, 1360 508 C 1400 514, 1420 520, 1440 530 L 1440 900 Z"
        />
      </g>
      {/* Texture strokes (皴) cut into the left peak's shoulders. */}
      <g filter={url("cun")} opacity={night ? 0.25 : 0.34}>
        <path
          fill={jade ? peakTop : ink}
          d="M110 500 C 150 470, 190 430, 236 404 C 262 392, 290 420, 316 456 C 300 470, 270 470, 240 500 C 210 530, 160 540, 110 540 Z"
        />
        <path fill={jade ? peakMid : ink} d="M340 470 C 380 490, 420 520, 470 560 C 430 570, 380 560, 340 520 Z" />
      </g>

      {/* ── Mist band crossing in front of the mid range ───────────────── */}
      <g filter={url("mist")} className="ink-drift">
        <ellipse cx="420" cy="640" rx="520" ry="46" fill={paperTone} opacity="0.9" />
        <ellipse cx="1120" cy="660" rx="420" ry="40" fill={paperTone} opacity="0.85" />
      </g>

      {/* ── Near cliff with a pine, right ──────────────────────────────── */}
      <g filter={url("rough")}>
        <path
          fill={url("fadeNear")}
          d="M1440 470 C 1400 476, 1360 486, 1320 500 C 1290 512, 1268 540, 1250 576 C 1236 606, 1214 632, 1206 668 C 1196 712, 1176 760, 1170 820 L 1166 900 L 1440 900 Z"
        />
      </g>
      <g filter={url("cun")} opacity={night ? 0.3 : 0.5}>
        <path fill={ink} d="M1440 480 C 1390 490, 1340 506, 1312 530 C 1300 560, 1290 600, 1300 640 C 1340 600, 1390 560, 1440 540 Z" />
      </g>

      {/* Pine: trunk leaning out over the void, needle clusters as rough fans. */}
      <g stroke={ink} fill="none" strokeLinecap="round" filter={url("roughFine")} opacity={night ? 0.75 : 0.92}>
        <path d="M1318 508 C 1300 470, 1278 446, 1246 428 C 1214 410, 1180 402, 1140 392" strokeWidth="9" />
        <path d="M1246 428 C 1238 410, 1236 392, 1244 374" strokeWidth="5" />
        <path d="M1192 405 C 1176 418, 1160 428, 1138 434" strokeWidth="4" />
        <path d="M1286 462 C 1270 470, 1250 476, 1226 478" strokeWidth="4" />
      </g>
      <g fill={jade ? "#37523d" : ink} filter={url("roughFine")} opacity={night ? 0.6 : 0.85}>
        <ellipse cx="1124" cy="386" rx="46" ry="13" />
        <ellipse cx="1176" cy="370" rx="34" ry="10" />
        <ellipse cx="1246" cy="366" rx="30" ry="10" />
        <ellipse cx="1130" cy="430" rx="38" ry="11" />
        <ellipse cx="1218" cy="474" rx="36" ry="11" />
        <ellipse cx="1206" cy="404" rx="28" ry="9" />
      </g>

      {/* ── Water: a few horizontal strokes and a lone boat ────────────── */}
      <g stroke={ink} strokeLinecap="round" fill="none" opacity={night ? 0.25 : 0.32} filter={url("roughFine")}>
        <path d="M120 760 h 140" strokeWidth="1.6" />
        <path d="M300 782 h 90" strokeWidth="1.4" />
        <path d="M600 770 h 160" strokeWidth="1.6" />
        <path d="M820 798 h 70" strokeWidth="1.2" />
        <path d="M980 776 h 120" strokeWidth="1.4" />
      </g>
      <g stroke={ink} fill="none" strokeLinecap="round" opacity={night ? 0.7 : 0.85}>
        <path d="M486 742 C 500 752, 540 752, 566 738" strokeWidth="4" />
        <path d="M520 741 L 522 718" strokeWidth="2.2" />
        <path d="M510 720 L 522 708 L 534 720 Z" fill={ink} strokeWidth="1.5" />
        <path d="M528 730 L 600 690" strokeWidth="1" opacity="0.7" />
      </g>

      </g>
    </svg>
  );
}
