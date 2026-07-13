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

      {/* ——— 侧视（与实物一致：板与楔座贴合为一体） ——— */}
      <line x1="398" y1="343" x2="626" y2="343" stroke={soft} strokeWidth="1.5" />
      {/* 墙面（虚线）：自画框贴墙点 (563,66) 垂直落地，楔座右下角离墙一条缝（踢脚线位） */}
      <line x1="563" y1="66" x2="563" y2="343" stroke={soft} strokeWidth="1.2" strokeDasharray="4 5" />
      {/*
       * 几何（对照供应商侧视原图）：板以 70° 斜倚，板脚平切落地；
       * 楔座 = 全锐角三角形：apex 贴在板背面 80% 高度 (541,127)，
       * 背边向后下方展开到 (556,343)（底比顶宽、右下角是底座最靠后
       * 的点），但仍比板顶后缘的墙线 (x=567) 缩进一条踢脚线缝。
       */}
      <polygon
        points="462,343 541,127 556,343"
        fill="var(--cream-warm)"
        stroke={ink}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* 斜倚画板：侧视为真长方形（底端方切、垂直于板轴），
          底后角 (462,343) 落地，前角 (447,337.5) 微微离地，顶端后缘触墙 */}
      <polygon
        points="447,337.5 548,60 563,66 462,343"
        fill="var(--paper)"
        stroke={ink}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />

      {/* 35mm = 板厚，标在板顶端断面 */}
      <line x1="551" y1="52" x2="557" y2="35" stroke={soft} strokeWidth="1.2" strokeDasharray="3 4" />
      <line x1="566" y1="57" x2="572" y2="40" stroke={soft} strokeWidth="1.2" strokeDasharray="3 4" />
      <line x1="556" y1="38" x2="571" y2="43" stroke={soft} strokeWidth="1.5" />
      <text x="582" y="42" fontFamily={display} fontWeight="700" fontSize="14" fill={dim}>
        35 mm
      </text>

      {/* 70° = 板脚与地面夹角 */}
      <path d="M478 343 A33 33 0 0 0 456.3 312" fill="none" stroke="var(--orange)" strokeWidth="2" />
      <text x="488" y="325" fontFamily={display} fontWeight="700" fontSize="14" fill={dim}>
        70°
      </text>
      <text x="512" y="374" textAnchor="middle" fontFamily={display} fontWeight="700" fontSize="11.5" letterSpacing="2.5" fill={soft}>
        THE LEAN
      </text>
    </svg>
  );
}
