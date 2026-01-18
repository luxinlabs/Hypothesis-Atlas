"use client";

import { useEffect, useRef } from "react";

interface Word {
  text: string;
  value: number;
}

interface WordCloudProps {
  words: Word[];
  onWordClick: (word: string) => void;
}

interface PlacedWord {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function WordCloudComponent({
  words,
  onWordClick,
}: WordCloudProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const container = canvasRef.current;
    container.innerHTML = "";

    const width = container.clientWidth;
    const height = 600;

    const maxValue = Math.max(...words.map((w) => w.value));
    const minValue = Math.min(...words.map((w) => w.value));

    const placedWords: PlacedWord[] = [];

    const checkCollision = (
      x: number,
      y: number,
      w: number,
      h: number,
    ): boolean => {
      const padding = 12;
      for (const placed of placedWords) {
        if (
          x < placed.x + placed.width + padding &&
          x + w + padding > placed.x &&
          y < placed.y + placed.height + padding &&
          y + h + padding > placed.y
        ) {
          return true;
        }
      }
      return false;
    };

    const findPosition = (
      wordWidth: number,
      wordHeight: number,
    ): { x: number; y: number } | null => {
      const centerX = width / 2;
      const centerY = height / 2;
      const maxAttempts = 500;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * Math.min(width, height) * 0.4;

        const x = centerX + Math.cos(angle) * radius - wordWidth / 2;
        const y = centerY + Math.sin(angle) * radius - wordHeight / 2;

        if (
          x >= 10 &&
          x + wordWidth <= width - 10 &&
          y >= 10 &&
          y + wordHeight <= height - 10 &&
          !checkCollision(x, y, wordWidth, wordHeight)
        ) {
          return { x, y };
        }
      }

      for (let attempt = 0; attempt < 200; attempt++) {
        const x = Math.random() * (width - wordWidth - 20) + 10;
        const y = Math.random() * (height - wordHeight - 20) + 10;

        if (!checkCollision(x, y, wordWidth, wordHeight)) {
          return { x, y };
        }
      }

      return null;
    };

    const sortedWords = [...words].sort((a, b) => b.value - a.value);

    sortedWords.forEach((word, index) => {
      const span = document.createElement("span");
      span.textContent = word.text;
      span.className = "word-cloud-item";

      const normalizedSize =
        ((word.value - minValue) / (maxValue - minValue)) * 28 + 16;
      span.style.fontSize = `${normalizedSize}px`;

      const colorPalette = [
        "rgb(59, 130, 246)",
        "rgb(147, 51, 234)",
        "rgb(236, 72, 153)",
        "rgb(14, 165, 233)",
        "rgb(168, 85, 247)",
        "rgb(249, 115, 22)",
        "rgb(34, 197, 94)",
        "rgb(239, 68, 68)",
      ];
      span.style.color = colorPalette[index % colorPalette.length];

      span.style.cursor = "pointer";
      span.style.position = "absolute";
      span.style.fontWeight = "700";
      span.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";
      span.style.padding = "6px 12px";
      span.style.borderRadius = "8px";
      span.style.whiteSpace = "nowrap";
      span.style.userSelect = "none";
      span.style.opacity = "0";

      container.appendChild(span);

      const rect = span.getBoundingClientRect();
      const wordWidth = rect.width;
      const wordHeight = rect.height;

      const position = findPosition(wordWidth, wordHeight);

      if (position) {
        span.style.left = `${position.x}px`;
        span.style.top = `${position.y}px`;

        setTimeout(() => {
          span.style.opacity = "1";
        }, index * 30);

        placedWords.push({
          x: position.x,
          y: position.y,
          width: wordWidth,
          height: wordHeight,
        });

        span.addEventListener("mouseenter", () => {
          span.style.transform = "scale(1.15) translateY(-2px)";
          span.style.backgroundColor = "rgba(99, 102, 241, 0.1)";
          span.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
          span.style.zIndex = "10";
        });

        span.addEventListener("mouseleave", () => {
          span.style.transform = "scale(1) translateY(0)";
          span.style.backgroundColor = "transparent";
          span.style.boxShadow = "none";
          span.style.zIndex = "1";
        });

        span.addEventListener("click", () => {
          span.style.transform = "scale(0.95)";
          setTimeout(() => {
            onWordClick(word.text);
          }, 100);
        });
      } else {
        container.removeChild(span);
      }
    });
  }, [words, onWordClick]);

  return (
    <div
      ref={canvasRef}
      className="relative w-full"
      style={{ height: "600px", minHeight: "600px" }}
    />
  );
}
