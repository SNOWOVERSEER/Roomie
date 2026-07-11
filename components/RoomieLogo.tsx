/*
 * Roomie 字标 —— 按用户提供的 logo.png 用 SVG 重建：
 * 胖圆气泡字、字母轻微高低错落与倾斜、蓝色错位投影、
 * 词尾上方一枚歪着的爪印。换成正式 logo 文件时替换此组件即可。
 */

interface Props {
  height?: number;
  variant?: "brand" | "cream";
  className?: string;
}

export default function RoomieLogo({
  height = 42,
  variant = "brand",
  className,
}: Props) {
  const fill = variant === "brand" ? "var(--orange)" : "var(--cream)";
  const shadow = variant === "brand" ? "var(--blue)" : "var(--navy)";

  const word = (
    <>
      <tspan rotate="-4">R</tspan>
      <tspan dy="4" rotate="3">
        o
      </tspan>
      <tspan dy="-9" rotate="-4">
        o
      </tspan>
      <tspan dy="7" rotate="4">
        m
      </tspan>
      <tspan dy="-5" rotate="-3">
        i
      </tspan>
      <tspan dy="4" rotate="4">
        e
      </tspan>
    </>
  );

  const paw = (fillColor: string, dx = 0, dy = 0) => (
    <g
      transform={`translate(${205 + dx} ${14 + dy}) rotate(20) scale(0.82)`}
      fill={fillColor}
    >
      <path d="M-1.6 3.2 Q7 1 10.4 8.4 Q13 15 5.4 17.2 Q-8.4 20.6 -9.6 12.4 Q-10.2 7 -1.6 3.2Z" />
      <ellipse cx="-10.5" cy="-4.5" rx="4.4" ry="5.6" transform="rotate(-26 -10.5 -4.5)" />
      <ellipse cx="-0.5" cy="-8.5" rx="4.4" ry="5.8" transform="rotate(-4 -0.5 -8.5)" />
      <ellipse cx="9.5" cy="-5.5" rx="4.2" ry="5.4" transform="rotate(20 9.5 -5.5)" />
      <ellipse cx="16.5" cy="2.5" rx="3.4" ry="4.4" transform="rotate(52 16.5 2.5)" />
    </g>
  );

  return (
    <svg
      viewBox="0 0 246 84"
      height={height}
      className={className}
      role="img"
      aria-label="Roomie"
      style={{ overflow: "visible" }}
    >
      <g
        fontFamily="var(--font-display), sans-serif"
        fontWeight={800}
        fontSize="57"
        letterSpacing="-1.5"
      >
        <text x="2" y="57" fill={shadow} aria-hidden="true">
          {word}
        </text>
        {paw(shadow, -3.5, -3.5)}
        <text x="6" y="61" fill={fill}>
          {word}
        </text>
        {paw(fill)}
      </g>
    </svg>
  );
}
