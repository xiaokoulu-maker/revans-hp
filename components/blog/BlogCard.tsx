import Link from 'next/link';
import { formatPostDate } from '@/lib/blog';
import type { BlogPostSummary } from '@/lib/blog/types';
import styles from './BlogCard.module.css';

/**
 * 記事カード（一覧・関連記事で使用）。カード全体が記事ページへのリンク。
 * variant='light' は白背景側（関連記事）用のトーン。
 */
export default function BlogCard({
  post,
  variant = 'dark',
}: {
  post: BlogPostSummary;
  variant?: 'dark' | 'light';
}) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className={`${styles.card} ${variant === 'light' ? styles.light : ''}`}
    >
      <div className={styles.meta}>
        {post.category && <span className={`${styles.tag} font-en`}>{post.category}</span>}
        <time className={`${styles.date} font-en`} dateTime={post.publishedAt}>
          {formatPostDate(post.publishedAt)}
        </time>
        {post.readingMinutes && (
          <span className={styles.read}>約{post.readingMinutes}分</span>
        )}
      </div>
      <h3 className={styles.title}>{post.title}</h3>
      <p className={styles.excerpt}>{post.excerpt}</p>
      <span className={styles.more}>続きを読む →</span>
      <span className={styles.bar} aria-hidden />
    </Link>
  );
}
