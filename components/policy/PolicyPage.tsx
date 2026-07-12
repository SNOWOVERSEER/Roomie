import Nav from "@/components/Nav";
import Footer from "@/components/sections/Footer";
import Reveal from "@/components/Reveal";
import styles from "./PolicyPage.module.css";

/* Policy/指南页共享布局：奶油页头 + 纸面板正文（prose 样式见 module） */
export default function PolicyPage({
  eyebrow,
  title,
  lede,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <Nav />
      <main className={styles.wrap}>
        <div className={`shell ${styles.head}`}>
          <Reveal>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1 className={styles.title}>{title}</h1>
            {lede && <p className={styles.lede}>{lede}</p>}
            {updated && (
              <p className={styles.updated}>Last updated {updated}</p>
            )}
          </Reveal>
        </div>
        <Reveal className={`shell ${styles.bodyShell}`} delay={90}>
          <div className={styles.body}>{children}</div>
        </Reveal>
      </main>
      <Footer />
    </>
  );
}
