import styles from "./PartnerMark.module.css";

/*
 * GlugGlug 合作品牌标（露出口径见 HANDOVER §1.1，2026-07-19 松绑版）。
 * 供应商的品牌视觉 = 衬线 bold 字标 + 灰圆白 g 徽章（源：产品框顶印字、
 * D3 贴纸角签）。用字体栈原地重建（Georgia 最接近原字形），不引入抠图
 * 资产，任意 DPI 干净；配色走 --pm-mark（主色）/--pm-bg（徽章内 g 的
 * 底色）两个变量，由使用处按所在底色设定。
 */
export default function PartnerMark({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span className={`${styles.mark} ${className}`}>
      <span className={styles.badge} aria-hidden>
        g
      </span>
      GlugGlug
    </span>
  );
}
