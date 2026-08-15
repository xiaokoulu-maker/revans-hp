import Link from 'next/link';
import { SITE } from '@/lib/site';
import styles from './ArticleCta.module.css';

type Props = {
  /** 記事固有の誘導文（post.ctaText）。無ければ既定文言 */
  body?: string;
};

/**
 * 記事末の白背景CTA。サイト共通の CtaBand（ダーク帯）とは別に、
 * 記事本文（白背景）に映えるトーンで用意する。
 */
export default function ArticleCta({ body }: Props) {
  return (
    <section className={styles.sec}>
      <div className={styles.card}>
        <span className={styles.eyebrow}>CONTACT</span>
        <h2 className={styles.title}>無料相談・お見積りはこちら</h2>
        <p className={styles.body}>
          {body ??
            'まずは、現状の集客・採用の課題をお聞かせください。料金はヒアリングのうえ、内容に応じて個別にお見積りします。'}
        </p>
        <div className={styles.actions}>
          <Link href="/contact" className={`${styles.btn} ${styles.primary}`}>
            無料で相談する
          </Link>
          <a href={`mailto:${SITE.email}`} className={`${styles.btn} ${styles.ghost}`}>
            メールで問い合わせる
          </a>
        </div>
      </div>
    </section>
  );
}
