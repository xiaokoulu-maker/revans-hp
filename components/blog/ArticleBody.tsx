import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import InlineCta from './InlineCta';
import styles from './ArticleBody.module.css';

/**
 * 記事本文（Markdown）レンダラ。Server Component。
 *
 * - react-markdown は Markdown を React 要素へ変換する（dangerouslySetInnerHTML 不使用）。
 *   生 HTML はデフォルト無効のため、本文由来の XSS が構造的に発生しない。
 * - remark-gfm: 表・打ち消し線・自動リンク等の GFM 記法。
 * - rehype-slug: 見出しへ id を自動付与（目次アンカーのジャンプ先）。
 * - 装飾は .prose 配下の子孫セレクタ（ArticleBody.module.css）で当てる。
 *   一部要素（リンク／引用ボックス／表／見出し）だけ components で上書きする。
 *
 * 【標準Markdownの範囲で成立させる方針】
 *   ボックスは blockquote の先頭テキストで種別判定する（HTML拡張やMDXは使わない）。
 *   例: 「> 💡 …」→ポイント（青） / 「> ⚠️ …」→注意（橙） /
 *       「> 📌 この記事でわかること」→冒頭サマリー枠。
 *   マーカーが無い引用はそのまま通常の引用として表示する（既存記事も崩れない）。
 */

/** hast ノードから素のテキストを連結して取り出す（種別判定用） */
function nodeText(node: unknown): string {
  const n = node as { value?: string; children?: unknown[] } | undefined;
  if (!n) return '';
  if (typeof n.value === 'string') return n.value;
  if (Array.isArray(n.children)) return n.children.map(nodeText).join('');
  return '';
}

type CalloutKind = 'point' | 'warn' | 'toc' | 'quote';

/** blockquote 先頭テキストからボックス種別を判定する */
function classifyCallout(text: string): CalloutKind {
  const t = text.replace(/\s/g, '');
  if (t.includes('この記事でわかること')) return 'toc';
  if (/^(💡|✅|👉|ポイント|POINT)/i.test(t)) return 'point';
  if (/^(⚠️|⚠|❗|❕|注意|NOTE|CAUTION)/i.test(t)) return 'warn';
  return 'quote';
}

/**
 * @param body        本文 Markdown
 * @param ctaBeforeId この id を持つ h2 の直前にインラインCTAを差し込む（null なら挿入しない）
 */
export default function ArticleBody({
  body,
  ctaBeforeId = null,
}: {
  body: string;
  ctaBeforeId?: string | null;
}) {
  const components: Components = {
    a({ href, children }) {
      const url = href ?? '';
      const isInternal = url.startsWith('/') || url.startsWith('#');
      if (isInternal) {
        return (
          <Link href={url} className={styles.link}>
            {children}
          </Link>
        );
      }
      return (
        <a href={url} className={styles.link} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },

    // 見出しの直前へインラインCTAを差し込む（対象の h2 のみ）
    h2({ children, id }) {
      const heading = <h2 id={id}>{children}</h2>;
      if (ctaBeforeId && id && id === ctaBeforeId) {
        return (
          <>
            <InlineCta />
            {heading}
          </>
        );
      }
      return heading;
    },

    // blockquote → 種別付きボックス（標準Markdownの記法で成立）
    // マーカー（💡 / ⚠️ / 「この記事でわかること」）で種別を判定し、
    // 中身はそのまま表示（ラベルの二重表示を避け、装飾はボックス側で行う）。
    blockquote({ node, children }) {
      const kind = classifyCallout(nodeText(node));
      if (kind === 'quote') {
        return <blockquote className={styles.quote}>{children}</blockquote>;
      }
      const boxClass =
        kind === 'point' ? styles.point : kind === 'warn' ? styles.warn : styles.tocBox;
      return (
        <div className={`${styles.callout} ${boxClass}`} role="note">
          {children}
        </div>
      );
    },

    // 表は横スクロール可能なラッパで包む（白背景・モバイル対応）
    table({ children }) {
      return (
        <div className={styles.tableWrap}>
          <table>{children}</table>
        </div>
      );
    },
  };

  return (
    <div className={styles.prose}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={components}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
