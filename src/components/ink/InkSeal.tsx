/**
 * Red seal stamp (印章). Glyphs are set in the brush font and stacked
 * vertically, two per column, read right-to-left as on a real seal.
 */
export default function InkSeal({
  text = "HA",
  size = 44,
  className = "",
  title,
}: {
  text?: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const glyphs = Array.from(text);
  const cols = glyphs.length > 2 ? 2 : 1;
  // Latin text (e.g. "HA") is set horizontally in the display serif, so it
  // reads as letters; the vertical brush layout is only for CJK glyphs.
  const latin = /^[\x00-\x7F]+$/.test(text);
  return (
    <span
      className={`ink-seal ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: latin ? size * 0.42 : size / (cols === 2 ? 2.4 : glyphs.length > 1 ? 2.3 : 1.5),
        writingMode: latin ? "horizontal-tb" : "vertical-rl",
        ...(latin ? { fontFamily: "var(--font-display), Georgia, serif", fontWeight: 600, letterSpacing: "0.04em" } : {}),
        transform: "rotate(-2deg)",
        padding: size * 0.08,
        letterSpacing: 0,
      }}
      title={title}
      aria-hidden={title ? undefined : true}
    >
      {glyphs.join("")}
    </span>
  );
}
