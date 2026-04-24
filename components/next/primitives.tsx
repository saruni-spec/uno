"use client";

import { useEffect, type CSSProperties, type ReactNode } from "react";

type CardProps = {
  color?: "red" | "yellow" | "green" | "blue" | "wild";
  value?: string;
  sym?: string;
  size?: "xs" | "sm" | "md" | "lg";
  back?: boolean;
  className?: string;
};

export function Card({
  color = "red",
  value = "0",
  sym,
  size = "md",
  back = false,
  className = "",
}: CardProps) {
  const cls = [
    "card",
    back ? "back" : color,
    size === "sm" ? "sm" : size === "xs" ? "xs" : size === "lg" ? "lg" : "",
    className,
  ].join(" ");

  const label =
    value === "skip"
      ? "🚫"
      : value === "reverse"
        ? "↺"
        : value === "draw2"
          ? "+2"
          : value === "wild"
            ? "✦"
            : value === "wild4"
              ? "+4"
              : value;

  if (back) {
    return (
      <div className={cls}>
        <div className="card-face">
          <div className="back-logo">N🏠</div>
        </div>
      </div>
    );
  }

  const isAction = ["skip", "reverse", "draw2", "wild", "wild4"].includes(value);
  return (
    <div className={cls}>
      <div className="card-face">
        <div className="corner tl">{label}</div>
        {isAction ? <div className="symbol">{sym || label}</div> : <div className="num">{label}</div>}
        <div className="corner br">{label}</div>
      </div>
    </div>
  );
}

export function Avatar({
  av,
  bg,
  size = 36,
}: {
  av: string;
  bg: string;
  size?: number;
}) {
  return (
    <div
      className="av"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        fontSize: size * 0.55,
      }}
    >
      {av}
    </div>
  );
}

export function Sticker({
  className = "",
  children,
  style,
}: {
  className?: string;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <span className={`sticker ${className}`} style={style}>
      {children}
    </span>
  );
}

export function Confetti({ onDone }: { onDone?: () => void }) {
  const colors = ["#ff3c7a", "#ffd23f", "#3ddcc8", "#7b5cff", "#4a8cff", "#3ddc84"];
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.2,
    color: colors[i % colors.length],
    rot: Math.random() * 360,
  }));
  useEffect(() => {
    if (!onDone) return;
    const t = setTimeout(() => onDone(), 1600);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="burst">
      {pieces.map((p, i) => (
        <div
          key={i}
          className="p"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rot}deg)`,
          }}
        />
      ))}
    </div>
  );
}
