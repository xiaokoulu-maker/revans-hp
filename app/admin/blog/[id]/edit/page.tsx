'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import styles from '@/components/admin/admin.module.css';
import type { AdminPost, AdminPostStatus } from '@/lib/admin/posts';
import type { FaqItem } from '@/lib/blog/types';

type Tab = 'body' | 'seo' | 'faq' | 'cta';

interface FormState {
  title: string;
  slug: string;
  body: string;
  excerpt: string;
  seoTitle: string;
  metaDescription: string;
  targetKeywords: string;
  summary: string;
  ctaText: string;
  faq: FaqItem[];
  category: string;
  eyecatchUrl: string;
  status: AdminPostStatus;
  publishedAt: string; // date input 用 YYYY-MM-DD
}

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromDateInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(`${v}T09:00:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toForm(post: AdminPost): FormState {
  return {
    title: post.title,
    slug: post.slug,
    body: post.body,
    excerpt: post.excerpt,
    seoTitle: post.seoTitle,
    metaDescription: post.metaDescription,
    targetKeywords: post.targetKeywords.join(', '),
    summary: post.summary,
    ctaText: post.ctaText,
    faq: post.faq.length ? post.faq : [],
    category: post.category ?? '',
    eyecatchUrl: post.eyecatchUrl ?? '',
    status: post.status,
    publishedAt: toDateInput(post.publishedAt),
  };
}

export default function AdminBlogEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [form, setForm] = useState<FormState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('body');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/posts/${id}`, { cache: 'no-store' });
        if (res.status === 401) {
          setLoadError('セッションが切れました。再度ログインしてください。');
          return;
        }
        if (!res.ok) {
          setLoadError('記事が見つかりませんでした。');
          return;
        }
        const data = await res.json();
        setForm(toForm(data.post as AdminPost));
      } catch {
        setLoadError('記事の取得に失敗しました。');
      }
    })();
  }, [id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const setFaq = (i: number, key: keyof FaqItem, value: string) =>
    setForm((prev) => {
      if (!prev) return prev;
      const faq = prev.faq.map((f, idx) => (idx === i ? { ...f, [key]: value } : f));
      return { ...prev, faq };
    });
  const addFaq = () => setForm((prev) => (prev ? { ...prev, faq: [...prev.faq, { question: '', answer: '' }] } : prev));
  const removeFaq = (i: number) =>
    setForm((prev) => (prev ? { ...prev, faq: prev.faq.filter((_, idx) => idx !== i) } : prev));

  const upload = async (file: File) => {
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? 'アップロードに失敗しました。' });
        return;
      }
      set('eyecatchUrl', data.url);
    } catch {
      setResult({ ok: false, message: 'アップロードに失敗しました。' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const save = async () => {
    if (!form || saving) return;
    if (!form.title.trim()) {
      setResult({ ok: false, message: 'タイトルを入力してください。' });
      return;
    }
    setSaving(true);
    setResult(null);
    try {
      const payload = {
        title: form.title,
        slug: form.slug,
        body: form.body,
        excerpt: form.excerpt,
        seoTitle: form.seoTitle,
        metaDescription: form.metaDescription,
        targetKeywords: form.targetKeywords.split(',').map((k) => k.trim()).filter(Boolean),
        summary: form.summary,
        ctaText: form.ctaText,
        faq: form.faq.filter((f) => f.question.trim() && f.answer.trim()),
        category: form.category.trim() || null,
        eyecatchUrl: form.eyecatchUrl.trim() || null,
        status: form.status,
        publishedAt:
          form.status === 'published' && !form.publishedAt
            ? new Date().toISOString()
            : fromDateInput(form.publishedAt),
        safetyCheck: true,
      };
      const res = await fetch(`/api/admin/posts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, message: data.error ?? '保存に失敗しました。' });
        return;
      }
      setForm(toForm(data.post as AdminPost));
      const safety = data.safety as { needsReview: boolean; reasons: string[] } | undefined;
      if (safety?.needsReview) {
        setResult({
          ok: false,
          message: `保存しました。安全チェックで「要確認」と判定されました（公開状態は維持・要確認バッジを表示）: ${safety.reasons.join(' / ')}`,
        });
      } else {
        setResult({ ok: true, message: '保存しました。' });
      }
    } catch {
      setResult({ ok: false, message: '保存に失敗しました。' });
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return (
      <div className={styles.panel}>
        <div className={`${styles.notice} ${styles.noticeErr}`}>{loadError}</div>
        <Link href="/admin/blog" className={styles.btn}>
          一覧へ戻る
        </Link>
      </div>
    );
  }
  if (!form) return <div className={styles.empty}>読み込み中…</div>;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'body', label: '本文' },
    { key: 'seo', label: 'SEO' },
    { key: 'faq', label: `FAQ（${form.faq.length}）` },
    { key: 'cta', label: 'まとめ・CTA' },
  ];

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>記事の編集</h1>
          <p className={styles.pageDesc}>保存時に安全チェックを再実行します（公開済みは公開を維持したままバッジ表示）。</p>
        </div>
        <div className={styles.headActions}>
          <Link href="/admin/blog" className={styles.btn}>
            一覧へ戻る
          </Link>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={save} disabled={saving}>
            {saving ? <span className={styles.spin} /> : '保存する'}
          </button>
        </div>
      </div>

      {result && (
        <div className={`${styles.notice} ${result.ok ? styles.noticeOk : styles.noticeWarn}`}>{result.message}</div>
      )}

      <div className={styles.editorGrid}>
        {/* 左：本文・SEO・FAQ・CTA */}
        <div className={styles.panel}>
          <div className={styles.field}>
            <label className={styles.label}>タイトル</label>
            <input className={styles.input} value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          <div className={styles.tabs}>
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'body' && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>抜粋（一覧カード・meta description 補完）</label>
                <textarea
                  className={styles.textarea}
                  rows={2}
                  value={form.excerpt}
                  onChange={(e) => set('excerpt', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>本文（Markdown）</label>
                <textarea
                  className={`${styles.textarea} ${styles.mono}`}
                  rows={22}
                  value={form.body}
                  onChange={(e) => set('body', e.target.value)}
                />
                <p className={styles.hint}>[要確認] マーカーが含まれる場合、保存時に要確認と判定されます。</p>
              </div>
            </>
          )}

          {tab === 'seo' && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>SEOタイトル</label>
                <input className={styles.input} value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>メタディスクリプション</label>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={form.metaDescription}
                  onChange={(e) => set('metaDescription', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>対策キーワード（カンマ区切り）</label>
                <input
                  className={styles.input}
                  value={form.targetKeywords}
                  onChange={(e) => set('targetKeywords', e.target.value)}
                />
              </div>
            </>
          )}

          {tab === 'faq' && (
            <>
              {form.faq.map((f, i) => (
                <div key={i} className={styles.faqItem}>
                  <div className={styles.field}>
                    <label className={styles.label}>質問 {i + 1}</label>
                    <input className={styles.input} value={f.question} onChange={(e) => setFaq(i, 'question', e.target.value)} />
                  </div>
                  <div className={styles.field} style={{ marginBottom: 8 }}>
                    <label className={styles.label}>回答</label>
                    <textarea
                      className={styles.textarea}
                      rows={2}
                      value={f.answer}
                      onChange={(e) => setFaq(i, 'answer', e.target.value)}
                    />
                  </div>
                  <button type="button" className={`${styles.btn} ${styles.btnDanger} ${styles.btnSm}`} onClick={() => removeFaq(i)}>
                    この質問を削除
                  </button>
                </div>
              ))}
              <button type="button" className={styles.btn} onClick={addFaq}>
                ＋ FAQを追加
              </button>
            </>
          )}

          {tab === 'cta' && (
            <>
              <div className={styles.field}>
                <label className={styles.label}>まとめ（リード／要約）</label>
                <textarea
                  className={styles.textarea}
                  rows={4}
                  value={form.summary}
                  onChange={(e) => set('summary', e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>CTA文言</label>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={form.ctaText}
                  onChange={(e) => set('ctaText', e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {/* 右：公開設定・カテゴリ・アイキャッチ */}
        <div className={styles.sideStack}>
          <div className={styles.panel}>
            <div className={styles.field}>
              <label className={styles.label}>ステータス</label>
              <select
                className={styles.select}
                value={form.status}
                onChange={(e) => set('status', e.target.value as AdminPostStatus)}
              >
                <option value="draft">下書き</option>
                <option value="published">公開</option>
                <option value="private">非公開</option>
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>公開日</label>
              <input
                type="date"
                className={styles.input}
                value={form.publishedAt}
                onChange={(e) => set('publishedAt', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>slug</label>
              <input
                className={`${styles.input} ${styles.mono}`}
                value={form.slug}
                onChange={(e) => set('slug', e.target.value)}
              />
              <p className={styles.hint}>/blog/{form.slug || '（未設定）'}</p>
            </div>
            <div className={styles.field} style={{ marginBottom: 0 }}>
              <label className={styles.label}>カテゴリ</label>
              <input
                className={styles.input}
                value={form.category}
                onChange={(e) => set('category', e.target.value)}
                placeholder="例）MEO"
              />
            </div>
          </div>

          <div className={styles.panel}>
            <label className={styles.label}>アイキャッチ画像</label>
            {form.eyecatchUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.eyecatchPreview} src={form.eyecatchUrl} alt="アイキャッチ" />
            ) : (
              <div className={styles.eyecatchPreview} />
            )}
            <div className={styles.field}>
              <label className={styles.label}>URLで指定</label>
              <input
                className={styles.input}
                value={form.eyecatchUrl}
                onChange={(e) => set('eyecatchUrl', e.target.value)}
                placeholder="https://…"
              />
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) upload(file);
              }}
            />
            <button
              type="button"
              className={styles.btn}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ width: '100%' }}
            >
              {uploading ? 'アップロード中…' : '画像をアップロード'}
            </button>
            <p className={styles.hint}>JPEG / PNG / WebP / GIF / AVIF・5MBまで。バケット未作成の場合はマイグレーションを実行してください。</p>
          </div>
        </div>
      </div>
    </>
  );
}
