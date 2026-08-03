/**
 * 猫爪印。全站唯一的爪印几何来源。
 *
 * 猫的前爪是 4 趾 + 1 掌垫。站里原先有两处各自手写的爪印（滚动提示
 * 的一对、进度环里的一个）都只画了 3 趾 —— 同一个错抄了三遍。做成
 * 组件之后就不会再有第四遍。
 *
 * 只画形状、不带颜色与尺寸：`fill` 和 `width` 由调用方的 class 决定。
 */
export default function PawMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 18" aria-hidden>
      {/* 掌垫 */}
      <ellipse cx="10" cy="12.6" rx="4.7" ry="3.9" />
      {/* 4 趾，外侧两趾略向外倾，读起来才像一只真爪子而不是一排点 */}
      <ellipse
        cx="3.5"
        cy="7.1"
        rx="1.75"
        ry="2.25"
        transform="rotate(-22 3.5 7.1)"
      />
      <ellipse cx="7.6" cy="4.2" rx="1.75" ry="2.35" />
      <ellipse cx="12.4" cy="4.2" rx="1.75" ry="2.35" />
      <ellipse
        cx="16.5"
        cy="7.1"
        rx="1.75"
        ry="2.25"
        transform="rotate(22 16.5 7.1)"
      />
    </svg>
  );
}
