'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from '@/components/admin/admin.module.css';
import GenerateDialog from '@/components/admin/GenerateDialog';
import type { AdminPost } from '@/lib/admin/posts';

type Filter = 'all' | 'published' | 'draft' | 'needs_review';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function StatusBadge({ post }: { post: AdminPost }) {
  const map: Record<AdminPost['status'], { cls: string; label: string }> = {
    published: { cls: styles.badgePublished, label: '公開' },
    draft: { cls: styles.badgeDraft, label: '下書き' },
    private: { cls: styles.badgePrivate, label: '非公開' },
  };
  const s = map[post.status];
  return (
    <span className={styles.badgeRow}>
      <span className={`${styles.badge} ${s.cls}`}>{s.label}</span>
      {post.needsReview && <span className={`${styles.badge} ${styles.badgeReview}`}>要確認</span>}
    </span>
  );
}

const nf = new Intl.NumberFormat('ja-JP');

export default function AdminBlogListPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [pvByPath, setPvByPath] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/posts', { cache: 'no-store' });
      if (res.status === 401) {
        setError('セッションが切れました。再度ログインしてください。');
        return;
      }
      if (!res.ok) {
        setError('記事の取得に失敗しました。');
        return;
      }
      const data = await res.json();
      setPosts(data.posts ?? []);
    } catch {
      setError('記事の取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  // 30日PV は補助情報。取得失敗しても一覧は表示する（別 fetch・非ブロッキング）。
  const loadPv = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analytics/posts?days=30', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setPvByPath(data.byPath ?? {});
    } catch {
      /* PV は補助のため失敗は無視 */
    }
  }, []);

  useEffect(() => {
    load();
    loadPv();
  }, [load, loadPv]);

  const pvOf = useCallback((slug: string) => pvByPath[`/blog/${slug}`] ?? 0, [pvByPath]);

  const counts = useMemo(
    () => ({
      all: posts.length,
      published: posts.filter((p) => p.status === 'published').length,
      draft: posts.filter((p) => p.status === 'draft').length,
      needs_review: posts.filter((p) => p.needsReview).length,
    }),
    [posts],
  );

  const filtered = useMemo(() => {
    if (filter === 'needs_review') return posts.filter((p) => p.needsReview);
    if (filter === 'all') return posts;
    return posts.filter((p) => p.status === filter);
  }, [posts, filter]);

  const approve = async (post: AdminPost) => {
    if (busyId) return;
    setBusyId(post.id);
    try {
      const res = await fetch(`/api/admin/posts/${post.id}/approve`, { method: 'POST' });
      if (!res.ok) {
        setError('承認・公開に失敗しました。');
        return;
      }
      const data = await res.json();
      setPosts((prev) => prev.map((p) => (p.id === post.id ? data.post : p)));
    } catch {
      setError('承認・公開に失敗しました。');
    } finally {
      setBusyId(null);
    }
  };

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'すべて' },
    { key: 'published', label: '公開' },
    { key: 'draft', label: '下書き' },
    { key: 'needs_review', label: '要確認' },
  ];

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>記事一覧</h1>
          <p className={styles.pageDesc}>公開・下書き・要確認の記事を管理します。</p>
        </div>
        <div className={styles.headActions}>
          <Link href="/admin/blog/calendar" className={styles.btn}>
            投稿カレンダー
          </Link>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setDialogOpen(true)}>
            AIで記事を作成
          </button>
        </div>
      </div>

      {error && <div className={`${styles.notice} ${styles.noticeErr}`}>{error}</div>}

      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`${styles.filterChip} ${filter === f.key ? styles.filterChipActive : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className={styles.filterCount}>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.empty}>読み込み中…</div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>該当する記事がありません。</div>
      ) : (
        <>
          {/* デスクトップ：テーブル */}
          <table className={styles.table}>
            <thead>
              <tr>
                <th>タイトル</th>
                <th>ステータス</th>
                <th>種別</th>
                <th>カテゴリ</th>
                <th style={{ textAlign: 'right' }}>30日PV</th>
                <th>公開日</th>
                <th style={{ textAlign: 'right' }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((post) => (
                <tr key={post.id}>
                  <td>
                    <div className={styles.rowTitle}>{post.title}</div>
                    <div className={styles.rowSlug}>/blog/{post.slug}</div>
                  </td>
                  <td>
                    <StatusBadge post={post} />
                  </td>
                  <td>
                    <span
                      className={`${styles.badge} ${post.source === 'ai' ? styles.badgeAi : styles.badgeManual}`}
                    >
                      {post.source === 'ai' ? 'AI' : '手動'}
                    </span>
                  </td>
                  <td>
                    {post.category ? (
                      <span className={`${styles.badge} ${styles.badgeCat}`}>{post.category}</span>
                    ) : (
                      <span className={styles.rowSlug}>未設定</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                    {post.status === 'published' ? nf.format(pvOf(post.slug)) : '—'}
                  </td>
                  <td>{formatDate(post.publishedAt)}</td>
                  <td>
                    <div className={styles.rowActions}>
                      {post.needsReview && (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnApprove} ${styles.btnSm}`}
                          onClick={() => approve(post)}
                          disabled={busyId === post.id}
                        >
                          承認して公開
                        </button>
                      )}
                      <Link href={`/admin/blog/${post.id}/edit`} className={`${styles.btn} ${styles.btnSm}`}>
                        編集
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* モバイル：カード */}
          <div className={styles.cards}>
            {filtered.map((post) => (
              <div key={post.id} className={styles.postCard}>
                <div className={styles.badgeRow}>
                  <StatusBadge post={post} />
                  <span
                    className={`${styles.badge} ${post.source === 'ai' ? styles.badgeAi : styles.badgeManual}`}
                  >
                    {post.source === 'ai' ? 'AI' : '手動'}
                  </span>
                  {post.category && <span className={`${styles.badge} ${styles.badgeCat}`}>{post.category}</span>}
                </div>
                <h3>{post.title}</h3>
                <div className={styles.postCardMeta}>
                  <span>/blog/{post.slug}</span>
                  <span>・{formatDate(post.publishedAt)}</span>
                  {post.status === 'published' && <span>・30日PV {nf.format(pvOf(post.slug))}</span>}
                </div>
                <div className={styles.postCardActions}>
                  {post.needsReview && (
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnApprove} ${styles.btnSm}`}
                      onClick={() => approve(post)}
                      disabled={busyId === post.id}
                    >
                      承認して公開
                    </button>
                  )}
                  <Link href={`/admin/blog/${post.id}/edit`} className={`${styles.btn} ${styles.btnSm}`}>
                    編集
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <GenerateDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onCreated={load} />
    </>
  );
}
