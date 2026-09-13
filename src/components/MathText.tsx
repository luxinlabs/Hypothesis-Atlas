"use client";

import katex from "katex";

interface MathTextProps {
  text: string;
  className?: string;
}

function renderMath(tex: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      output: "html",
    });
  } catch {
    return null;
  }
}

/** Renders text containing $inline$ and $$block$$ LaTeX via KaTeX. */
export default function MathText({ text, className }: MathTextProps) {
  const parts: React.ReactNode[] = [];
  // Split on $$...$$ blocks first, then $...$ inline within the rest
  const blockRegex = /\$\$([\s\S]+?)\$\$/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  let inlineCursor = 0;

  const pushInline = (segment: string) => {
    const inlineRegex = /\$([^$\n]+?)\$/g;
    let m: RegExpExecArray | null;
    let cursor = 0;
    while ((m = inlineRegex.exec(segment)) !== null) {
      if (m.index > cursor) parts.push(<span key={key++}>{segment.slice(cursor, m.index)}</span>);
      const html = renderMath(m[1], false);
      if (html) {
        parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: html }} />);
      } else {
        parts.push(<span key={key++}>{m[0]}</span>);
      }
      cursor = m.index + m[0].length;
    }
    if (cursor < segment.length) parts.push(<span key={key++}>{segment.slice(cursor)}</span>);
    inlineCursor += segment.length;
  };

  while ((match = blockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) pushInline(text.slice(lastIndex, match.index));
    const html = renderMath(match[1], true);
    if (html) {
      parts.push(
        <div
          key={key++}
          className="my-2 overflow-x-auto text-center"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } else {
      parts.push(<span key={key++}>{match[0]}</span>);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) pushInline(text.slice(lastIndex));

  return <span className={className}>{parts}</span>;
}
