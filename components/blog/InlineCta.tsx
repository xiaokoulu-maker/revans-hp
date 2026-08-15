import Link from 'next/link';
import styles from './InlineCta.module.css';

/**
 * 本文中間（H2の区切り）へ控えめに差し込むインラインCTA。
 * 白背景の本文に馴染む横長カード。挿入位置は ArticleBody 側で決める。
 */
export default function InlineCta() {
  return (
    <aside className={styles.wrap} aria-label="お問い合わせのご案内">
      <div className={styles.text}>
        <span className={styles.label}>REVANSに相談する</span>
        <p className={styles.body}>
          集客・採用の課題を整理するところから。無料相談・お見積りを承っています。
        </p>
      </div>
      <Link href="/contact" className={styles.btn}>
        無料で相談する
        <span className={styles.arrow} aria-hidden>
          →
        </span>
      </Link>
    </aside>
  );
}
