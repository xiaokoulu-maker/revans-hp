import Link from 'next/link';
import styles from './PageHero.module.css';

export type Crumb = { label: string; href?: string };

type Props = {
  crumbs: Crumb[];
  en: string;
  title: string;
  lead?: string;
  /** 見出し下に置くメタ情報（公開日・更新日・読了時間など）。任意 */
  meta?: React.ReactNode;
};

/** 下層ページ共通のヒーロー帯（パンくず＋eyebrow＋見出し＋リード） */
export default function PageHero({ crumbs, en, title, lead, meta }: Props) {
  return (
    <section className={styles.hero}>
      <div className={styles.grid} aria-hidden />
      <div className={styles.glow} aria-hidden />
      <div className={styles.inner}>
        <nav className={styles.crumbs} aria-label="パンくず">
          {crumbs.map((c, i) => (
            <span key={`${c.label}-${i}`}>
              {c.href ? (
                <Link href={c.href} className={styles.crumbLink}>
                  {c.label}
                </Link>
              ) : (
                <span className={styles.crumbCurrent}>{c.label}</span>
              )}
              {i < crumbs.length - 1 && <span className={styles.sep}>/</span>}
            </span>
          ))}
        </nav>
        <span className={`${styles.en} font-en`}>{en}</span>
        <h1 className={styles.title}>{title}</h1>
        {lead && <p className={`${styles.lead} pretty`}>{lead}</p>}
        {meta && <div className={styles.meta}>{meta}</div>}
      </div>
    </section>
  );
}
