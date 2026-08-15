import type { PostHeading } from '@/lib/blog/types';
import styles from './TableOfContents.module.css';

/**
 * 記事冒頭に置く目次。id は本文見出し（rehype-slug 付与）と一致する。
 *
 * - PC・モバイル共通で本文の冒頭（最初の H2 の前）に配置する。
 * - 既定で展開（<details open>）。summary の「目次」トグルで開閉できる。
 * - H2 は連番、H3 は字下げで階層を表す。
 * - ジャンプは href アンカー＋ CSS の scroll-behavior: smooth と、見出し側の
 *   scroll-margin-top（固定ヘッダー分のオフセット）で成立するため JS 不要。
 */
export default function TableOfContents({ headings }: { headings: PostHeading[] }) {
  if (headings.length === 0) return null;

  let h2Count = 0;

  return (
    <details className={styles.toc} open>
      <summary className={styles.summary}>
        <span className={`${styles.label} font-en`}>CONTENTS</span>
        <span className={styles.summaryText}>目次</span>
        <span className={styles.chevron} aria-hidden />
      </summary>
      <nav aria-label="目次">
        <ul className={styles.list}>
          {headings.map((h) => {
            const isSub = h.level === 3;
            if (!isSub) h2Count += 1;
            return (
              <li key={h.id} className={`${styles.item} ${isSub ? styles.sub : ''}`}>
                <a href={`#${h.id}`} className={styles.link}>
                  {!isSub && (
                    <span className={styles.num} aria-hidden>
                      {h2Count}
                    </span>
                  )}
                  <span className={styles.text}>{h.text}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </details>
  );
}
