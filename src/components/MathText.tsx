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

// Block: $$...$$ or \[...\]. Inline: $...$ or \(...\).
// LLMs (Claude, Groq) commonly emit the \[ \] / \( \) LaTeX-native forms
// instead of Markdown-style $ $, so both need to render.
const BLOCK_REGEX = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]/g;
const INLINE_REGEX = /\$([^$\n]+?)\$|\\\(([^)]+?)\\\)/g;

/** Renders text containing $inline$/\(inline\) and $$block$$/\[block\] LaTeX via KaTeX. */
export default function MathText({ text, className }: MathTextProps) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const pushInline = (segment: string) => {
    const inlineRegex = new RegExp(INLINE_REGEX);
    let m: RegExpExecArray | null;
    let cursor = 0;
    while ((m = inlineRegex.exec(segment)) !== null) {
      if (m.index > cursor) parts.push(<span key={key++}>{segment.slice(cursor, m.index)}</span>);
      const tex = m[1] ?? m[2] ?? "";
      const html = renderMath(tex, false);
      if (html) {
        parts.push(<span key={key++} dangerouslySetInnerHTML={{ __html: html }} />);
      } else {
        parts.push(<span key={key++}>{m[0]}</span>);
      }
      cursor = m.index + m[0].length;
    }
    if (cursor < segment.length) parts.push(<span key={key++}>{segment.slice(cursor)}</span>);
  };

  const blockRegex = new RegExp(BLOCK_REGEX);
  while ((match = blockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) pushInline(text.slice(lastIndex, match.index));
    const tex = match[1] ?? match[2] ?? "";
    const html = renderMath(tex, true);
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
