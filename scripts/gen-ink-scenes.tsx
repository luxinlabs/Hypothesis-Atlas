/**
 * Renders the ink landscape (src/components/ink/InkLandscape.tsx) to static
 * SVGs used as the fixed page backdrop in src/app/globals.css (.ink-paper,
 * .ink-night, .ink-jade). Re-run after changing the landscape:
 *
 *   npx tsx scripts/gen-ink-scenes.tsx
 */
import { writeFileSync } from "fs";
import { join } from "path";
import React, { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { InkVariant } from "../src/components/ink/InkLandscape";

// The app's tsconfig leaves JSX to Next ("jsx": "preserve"), so tsx falls back
// to the classic runtime, which expects a global React.
(globalThis as { React?: typeof React }).React = React;

const TONE: Record<InkVariant, number> = { paper: 0.5, night: 0.55, jade: 0.55 };

async function main() {
  const { default: InkLandscape } = await import("../src/components/ink/InkLandscape");
  for (const variant of Object.keys(TONE) as InkVariant[]) {
    const svg = renderToStaticMarkup(createElement(InkLandscape, { variant, tone: TONE[variant] }));
    const out = join(__dirname, "..", "public", "ink", `scene-${variant}.svg`);
    writeFileSync(out, svg);
    console.log(`wrote ${out} (${svg.length} bytes)`);
  }
}

main();
