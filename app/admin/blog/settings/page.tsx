'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from '@/components/admin/admin.module.css';
import type { BlogSettingsValues } from '@/lib/blog/supabase';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<BlogSettingsValues | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/settings', { cache: 'no-store' });
        if (!res.ok) {
          setResult({ ok: false, message: '設定の取得に失敗しました。' });
          return;
        }
        const data = await res.json();
        setSettings(data.settings);
      } catch {
        setResult({ ok: false, message: '設定の取得に失敗しました。' });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = <K extends keyof BlogSettingsValues>(key: K, value: BlogSettingsValues[K]) =>
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));

  const save = async () => {
    if (!settings || saving) return;
    setSaving(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoPublish: settings.autoPublish,
          defaultAuthor: settings.defaultAuthor,
          postsPerPage: settings.postsPerPage,
        }),
      });
      if (!res.ok) {
        setResult({ ok: false, message: '保存に失敗しました。' });
        return;
      }
      const data = await res.json();
      setSettings(data.settings);
      setResult({ ok: true, message: '設定を保存しました。' });
    } catch {
      setResult({ ok: false, message: '保存に失敗しました。' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.empty}>読み込み中…</div>;
  if (!settings)
    return (
      <div className={styles.panel}>
        <div className={`${styles.notice} ${styles.noticeErr}`}>{result?.message ?? '設定を読み込めませんでした。'}</div>
      </div>
    );

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>設定</h1>
          <p className={styles.pageDesc}>ブログの基本設定。既存の blog_settings 構造に沿った最小限の項目です。</p>
        </div>
        <div className={styles.headActions}>
          <Link href="/admin/blog" className={styles.btn}>
            記事一覧
          </Link>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save} disabled={saving}>
            {saving ? <span className={styles.spin} /> : '保存する'}
          </button>
        </div>
      </div>

      {result && (
        <div className={`${styles.notice} ${result.ok ? styles.noticeOk : styles.noticeErr}`}>{result.message}</div>
      )}

      <div className={styles.panel} style={{ maxWidth: 560 }}>
        <div className={styles.field}>
          <label className={styles.label}>自動公開（auto_publish）</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={settings.autoPublish}
              onChange={(e) => set('autoPublish', e.target.checked)}
            />
            <span style={{ fontSize: 13 }}>
              ONにすると、週次生成で安全チェックを通過した記事を自動公開します（要確認は下書きのまま）。
            </span>
          </label>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>既定の著者名</label>
          <input
            className={styles.input}
            value={settings.defaultAuthor}
            onChange={(e) => set('defaultAuthor', e.target.value)}
            placeholder="例）REVANS編集部"
          />
        </div>

        <div className={styles.field} style={{ marginBottom: 0 }}>
          <label className={styles.label}>1ページの表示件数（posts_per_page）</label>
          <input
            type="number"
            min={1}
            max={60}
            className={styles.input}
            value={settings.postsPerPage}
            onChange={(e) => set('postsPerPage', Number(e.target.value))}
            style={{ maxWidth: 140 }}
          />
        </div>
      </div>
    </>
  );
}
