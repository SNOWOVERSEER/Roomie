/*
 * 规格线稿（自绘 SVG，替代供应商截图）：正视 430×630 + 侧视 70° 斜倚、
 * 35mm 木条。风格与 design tokens 同源：墨线 + 橙色标注 + display 字体。
 * 尺寸数据来源：供应商物料（430mm × 630mm × 35mm，70°）。
 */
export default function SpecDrawing({ className }: { className?: string }) {
  const dim = "var(--orange-deep)";
  const ink = "var(--ink)";
  const soft = "var(--ink-soft)";
  const display = "var(--font-display), sans-serif";
  return (
    <svg
      viewBox="0 0 640 400"
      role="img"
      aria-label="Dimensions: 430 by 630 millimetres face, 35 millimetre pine rails, 70 degree lean"
      className={className}
    >
      {/* ——— 正视 ——— */}
      <rect x="60" y="50" width="200" height="293" rx="4" fill="var(--paper)" stroke={ink} strokeWidth="2.5" />
      <rect x="74" y="64" width="172" height="265" rx="2" fill="var(--cream)" stroke={soft} strokeWidth="1.5" />

      {/* 宽度尺寸 */}
      <line x1="60" y1="46" x2="60" y2="26" stroke={soft} strokeWidth="1.2" strokeDasharray="3 4" />
      <line x1="260" y1="46" x2="260" y2="26" stroke={soft} strokeWidth="1.2" strokeDasharray="3 4" />
      <line x1="66" y1="31" x2="254" y2="31" stroke={soft} strokeWidth="1.5" />
      <path d="M60 31l7 -3.5v7z" fill={soft} />
      <path d="M260 31l-7 -3.5v7z" fill={soft} />
      <text x="160" y="20" textAnchor="middle" fontFamily={display} fontWeight="700" fontSize="15" fill={dim}>
        430 mm
      </text>

      {/* 高度尺寸 */}
      <line x1="264" y1="50" x2="284" y2="50" stroke={soft} strokeWidth="1.2" strokeDasharray="3 4" />
      <line x1="264" y1="343" x2="284" y2="343" stroke={soft} strokeWidth="1.2" strokeDasharray="3 4" />
      <line x1="279" y1="56" x2="279" y2="337" stroke={soft} strokeWidth="1.5" />
      <path d="M279 50l-3.5 7h7z" fill={soft} />
      <path d="M279 343l-3.5 -7h7z" fill={soft} />
      <text
        x="296"
        y="200"
        textAnchor="middle"
        fontFamily={display}
        fontWeight="700"
        fontSize="15"
        fill={dim}
        transform="rotate(90 296 200)"
      >
        630 mm
      </text>
      <text x="160" y="374" textAnchor="middle" fontFamily={display} fontWeight="700" fontSize="11.5" letterSpacing="2.5" fill={soft}>
        THE FACE
      </text>

      {/* ——— 侧视 ——— */}
      <line x1="398" y1="343" x2="626" y2="343" stroke={soft} strokeWidth="1.5" />
      {/* 楔形背板 */}
      <polygon points="500,343 585,343 585,104" fill="var(--cream-warm)" stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      {/* 斜倚木条（70°） */}
      <polygon points="462,340 565,57 581,63 478,346" fill="var(--paper)" stroke={ink} strokeWidth="2.5" strokeLinejoin="round" />

      {/* 35mm 引注 */}
      <line x1="585" y1="152" x2="610" y2="144" stroke={soft} strokeWidth="1.2" strokeDasharray="3 4" />
      <text x="614" y="148" fontFamily={display} fontWeight="700" fontSize="14" fill={dim}>
        35
      </text>
      <text x="614" y="163" fontFamily={display} fontWeight="600" fontSize="10.5" fill={soft}>
        mm
      </text>

      {/* 70° 角 */}
      <path d="M504 343 A34 34 0 0 0 481.5 311" fill="none" stroke="var(--orange)" strokeWidth="2" />
      <text x="514" y="322" fontFamily={display} fontWeight="700" fontSize="14" fill={dim}>
        70°
      </text>
      <text x="512" y="374" textAnchor="middle" fontFamily={display} fontWeight="700" fontSize="11.5" letterSpacing="2.5" fill={soft}>
        THE LEAN
      </text>
    </svg>
  );
}
