'use client';

import { useEffect, useRef, useState } from 'react';
import type { PostHeading } from '@/lib/blog/types';
import styles from './TableOfContents.module.css';

/**
 * 記事の目次。id は本文見出し（rehype-slug 付与）と一致する。
 *
 * - PC（1024px以上）: 親側の sticky サイドバーに追従。IntersectionObserver で
 *   現在読んでいる見出しをハイライトする。<details> は常時 open（summary は非表示）。
 * - モバイル: 記事冒頭の折りたたみ（<details>/<summary>）。初期は閉じた状態。
 */
export default function TableOfContents({ headings }: { headings: PostHeading[] }) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [activeId, setActiveId] = useState<string>('');

  // 見出しのスクロール追従ハイライト
  useEffect(() => {
    if (headings.length === 0) return;
    const targets = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // 画面上部の判定バンドに入っている見出しのうち、最も上のものを採用
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  // PC幅では details を常時開く（summary は CSS で非表示）
  useEffect(() => {
    const el = detailsRef.current;
    if (!el) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      if (mq.matches) el.open = true;
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (headings.length === 0) return null;

  return (
    <details ref={detailsRef} className={styles.toc}>
      <summary className={styles.summary}>
        <span className={`${styles.label} font-en`}>CONTENTS</span>
        <span className={styles.chevron} aria-hidden />
      </summary>
      <nav aria-label="目次">
        <ul className={styles.list}>
          {headings.map((h) => (
            <li key={h.id} className={`${styles.item} ${h.level === 3 ? styles.sub : ''}`}>
              <a
                href={`#${h.id}`}
                className={`${styles.link} ${activeId === h.id ? styles.active : ''}`}
                aria-current={activeId === h.id ? 'true' : undefined}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </details>
  );
}
