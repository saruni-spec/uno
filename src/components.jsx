// Card UI primitives

function Card({
  color = "red",
  value,
  sym,
  size = "md",
  back = false,
  onClick,
  className = "",
  playable,
  jumpable,
  style,
}) {
  const cls = [
    "card",
    back ? "back" : color,
    size === "sm" ? "sm" : size === "xs" ? "xs" : size === "lg" ? "lg" : "",
    playable === true ? "playable" : playable === false ? "unplayable" : "",
    jumpable ? "jumpable" : "",
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
      <div className={cls} onClick={onClick} style={style}>
        <div className="card-face">
          <div className="back-logo">N🏠</div>
        </div>
      </div>
    );
  }

  const isAction = ["skip", "reverse", "draw2", "wild", "wild4"].includes(
    value,
  );

  return (
    <div className={cls} onClick={onClick} style={style}>
      <div className="card-face">
        <div className="corner tl">{label}</div>
        {isAction ? (
          <div className="symbol">{sym || label}</div>
        ) : (
          <div className="num">{label}</div>
        )}
        <div className="corner br">{label}</div>
      </div>
    </div>
  );
}

function MiniCard({ color, value, angle = 0, x = 0, y = 0, size = "sm" }) {
  return (
    <Card
      color={color}
      value={value}
      size={size}
      style={{ transform: `translate(${x}px, ${y}px) rotate(${angle}deg)` }}
    />
  );
}

function Avatar({ av, bg, size = 36 }) {
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

function Switch({ on, onChange }) {
  return (
    <div className={`switch ${on ? "on" : ""}`} onClick={() => onChange(!on)}>
      <div className="knob" />
    </div>
  );
}

function Sticker({ className = "", children, style }) {
  return (
    <span className={`sticker ${className}`} style={style}>
      {children}
    </span>
  );
}

function Confetti({ onDone }) {
  const colors = [
    "#ff3c7a",
    "#ffd23f",
    "#3ddcc8",
    "#7b5cff",
    "#4a8cff",
    "#3ddc84",
  ];
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.3,
    color: colors[i % colors.length],
    rot: Math.random() * 360,
  }));
  React.useEffect(() => {
    const t = setTimeout(() => onDone && onDone(), 1800);
    return () => clearTimeout(t);
  }, []);
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

Object.assign(window, { Card, MiniCard, Avatar, Switch, Sticker, Confetti });
