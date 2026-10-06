/**
 * Red seal stamp (印章). Glyphs are set in the brush font and stacked
 * vertically, two per column, read right-to-left as on a real seal.
 */
export default function InkSeal({
  text = "图谱",
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
  return (
    <span
      className={`ink-seal ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size / (cols === 2 ? 2.4 : glyphs.length > 1 ? 2.3 : 1.5),
        writingMode: "vertical-rl",
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
