import { getServiceSupabase } from '@/lib/blog/supabase';
import { REVIEW_MARKER } from '@/lib/blog/generate-prompt';
import type { FaqItem } from '@/lib/blog/types';

// ─────────────────────────────────────────────────────────────
// 管理画面用のデータ層（service_role 経由・サーバー専用）。
//
// 公開側（lib/blog/index.ts の getPosts/getPostBySlug）は変更せず、下書き・
// 非公開・要確認を含む全記事の読み書きはここに集約する。service_role キーは
// getServiceSupabase() の中だけで参照し、クライアントには露出させない。
//
// category 列は追加マイグレーション（supabase/migrations/0002）で入る想定。
// 未適用でも管理画面が 500 にならないよう、category 無しの列でリトライする
// フォールバックを持たせている（列適用後は自動でフル列に載る）。
// ─────────────────────────────────────────────────────────────

export type AdminPostStatus = 'draft' | 'published' | 'private';
export type AdminPostSource = 'manual' | 'ai';

/** 管理画面が扱う記事1件（全 status・camelCase） */
export interface AdminPost {
  id: string;
  slug: string;
  title: string;
  body: string;
  excerpt: string;
  eyecatchUrl: string | null;
  category: string | null;
  status: AdminPostStatus;
  publishedAt: string | null;
  seoTitle: string;
  metaDescription: string;
  targetKeywords: string[];
  faq: FaqItem[];
  summary: string;
  ctaText: string;
  source: AdminPostSource;
  needsReview: boolean;
  createdAt: string;
  updatedAt: string | null;
}

/** 編集で更新しうるフィールド（すべて任意・与えられたものだけ更新） */
export interface AdminPostPatch {
  title?: string;
  slug?: string;
  body?: string;
  excerpt?: string;
  eyecatchUrl?: string | null;
  category?: string | null;
  status?: AdminPostStatus;
  publishedAt?: string | null;
  seoTitle?: string;
  metaDescription?: string;
  targetKeywords?: string[];
  faq?: FaqItem[];
  summary?: string;
  ctaText?: string;
  needsReview?: boolean;
}

const BASE_COLUMNS =
  'id, slug, title, body, excerpt, eyecatch_url, status, published_at, seo_title, meta_description, target_keywords, faq, summary, cta_text, source, needs_review, created_at, updated_at';
const FULL_COLUMNS = `${BASE_COLUMNS}, category`;

/** PostgREST の「列が存在しない」エラー（未適用マイグレーション）判定 */
function isUndefinedColumn(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42703' || /column .*category.* does not exist/i.test(error.message ?? '');
}

interface RawRow {
  id: string;
  slug: string;
  title: string;
  body: string | null;
  excerpt: string | null;
  eyecatch_url: string | null;
  category?: string | null;
  status: string;
  published_at: string | null;
  seo_title: string | null;
  meta_description: string | null;
  target_keywords: string[] | null;
  faq: unknown;
  summary: string | null;
  cta_text: string | null;
  source: string | null;
  needs_review: boolean | null;
  created_at: string;
  updated_at: string | null;
}

function mapFaq(raw: unknown): FaqItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      const e = (it ?? {}) as { question?: unknown; answer?: unknown };
      return { question: String(e.question ?? '').trim(), answer: String(e.answer ?? '').trim() };
    })
    .filter((e) => e.question && e.answer);
}

function mapRow(row: RawRow): AdminPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    body: row.body ?? '',
    excerpt: row.excerpt ?? '',
    eyecatchUrl: row.eyecatch_url ?? null,
    category: row.category ?? null,
    status: (row.status as AdminPostStatus) ?? 'draft',
    publishedAt: row.published_at ?? null,
    seoTitle: row.seo_title ?? '',
    metaDescription: row.meta_description ?? '',
    targetKeywords: Array.isArray(row.target_keywords) ? row.target_keywords : [],
    faq: mapFaq(row.faq),
    summary: row.summary ?? '',
    ctaText: row.cta_text ?? '',
    source: (row.source as AdminPostSource) ?? 'manual',
    needsReview: Boolean(row.needs_review),
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
  };
}

/** camelCase パッチ → snake_case ペイロード（与えられたキーのみ）。 */
function toRowPayload(patch: AdminPostPatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (patch.title !== undefined) out.title = patch.title;
  if (patch.slug !== undefined) out.slug = patch.slug;
  if (patch.body !== undefined) out.body = patch.body;
  if (patch.excerpt !== undefined) out.excerpt = patch.excerpt;
  if (patch.eyecatchUrl !== undefined) out.eyecatch_url = patch.eyecatchUrl || null;
  if (patch.category !== undefined) out.category = patch.category || null;
  if (patch.status !== undefined) out.status = patch.status;
  if (patch.publishedAt !== undefined) out.published_at = patch.publishedAt;
  if (patch.seoTitle !== undefined) out.seo_title = patch.seoTitle;
  if (patch.metaDescription !== undefined) out.meta_description = patch.metaDescription;
  if (patch.targetKeywords !== undefined) out.target_keywords = patch.targetKeywords;
  if (patch.faq !== undefined) out.faq = patch.faq;
  if (patch.summary !== undefined) out.summary = patch.summary;
  if (patch.ctaText !== undefined) out.cta_text = patch.ctaText;
  if (patch.needsReview !== undefined) out.needs_review = patch.needsReview;
  return out;
}

/** 全記事を作成日の新しい順で取得（全 status）。接続不可なら空配列。 */
export async function listPostsAdmin(): Promise<AdminPost[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];

  const first = await supabase.from('blog_posts').select(FULL_COLUMNS).order('created_at', { ascending: false });
  let data = first.data as RawRow[] | null;
  let error = first.error as { code?: string; message?: string } | null;

  if (error && isUndefinedColumn(error)) {
    const retry = await supabase.from('blog_posts').select(BASE_COLUMNS).order('created_at', { ascending: false });
    data = retry.data as RawRow[] | null;
    error = retry.error as { code?: string; message?: string } | null;
  }

  if (error || !data) {
    if (error) console.error('[admin] listPostsAdmin failed:', error.message);
    return [];
  }
  return data.map(mapRow);
}

/** 1件取得（全 status）。該当なし/接続不可は null。 */
export async function getPostAdmin(id: string): Promise<AdminPost | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const first = await supabase.from('blog_posts').select(FULL_COLUMNS).eq('id', id).maybeSingle();
  let data = first.data as RawRow | null;
  let error = first.error as { code?: string; message?: string } | null;

  if (error && isUndefinedColumn(error)) {
    const retry = await supabase.from('blog_posts').select(BASE_COLUMNS).eq('id', id).maybeSingle();
    data = retry.data as RawRow | null;
    error = retry.error as { code?: string; message?: string } | null;
  }

  if (error || !data) return null;
  return mapRow(data);
}

/** slug で1件取得（全 status）。重複 slug 検出に使う。 */
export async function getPostAdminBySlug(slug: string): Promise<AdminPost | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const first = await supabase.from('blog_posts').select(FULL_COLUMNS).eq('slug', slug).maybeSingle();
  let data = first.data as RawRow | null;
  let error = first.error as { code?: string; message?: string } | null;
  if (error && isUndefinedColumn(error)) {
    const retry = await supabase.from('blog_posts').select(BASE_COLUMNS).eq('slug', slug).maybeSingle();
    data = retry.data as RawRow | null;
    error = retry.error as { code?: string; message?: string } | null;
  }
  if (error || !data) return null;
  return mapRow(data);
}

/**
 * 記事を更新する。category 列が未適用の場合はそのキーを落として再試行する。
 * 更新後の行を返す（失敗時は null）。
 */
export async function updatePostAdmin(id: string, patch: AdminPostPatch): Promise<AdminPost | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;

  const payload = toRowPayload(patch);

  const first = await supabase.from('blog_posts').update(payload).eq('id', id).select(FULL_COLUMNS).maybeSingle();
  let data = first.data as RawRow | null;
  let error = first.error as { code?: string; message?: string } | null;

  // category 列が無い環境: category を外して更新し、返却は base 列で行う
  if (error && isUndefinedColumn(error)) {
    const { category: _omit, ...rest } = payload;
    void _omit;
    const retry = await supabase.from('blog_posts').update(rest).eq('id', id).select(BASE_COLUMNS).maybeSingle();
    data = retry.data as RawRow | null;
    error = retry.error as { code?: string; message?: string } | null;
  }

  if (error || !data) {
    if (error) console.error('[admin] updatePostAdmin failed:', error.message);
    return null;
  }
  return mapRow(data);
}

/** 文字列から [要確認] マーカーを取り除き、前後の余分な空白を整える。 */
function stripMarker(text: string): string {
  return text.split(REVIEW_MARKER).join('').replace(/[ \t]{2,}/g, ' ');
}

/**
 * 要確認記事を「承認して公開」する。
 * ・本文などから [要確認] マーカーを除去
 * ・needs_review を解除
 * ・status を published にし、published_at 未設定なら現在時刻をセット
 * revalidate は呼び出し側（route）で行う。更新後の記事を返す。
 */
export async function approveAndPublish(id: string): Promise<AdminPost | null> {
  const post = await getPostAdmin(id);
  if (!post) return null;

  const publishedAt = post.publishedAt ?? new Date().toISOString();

  return updatePostAdmin(id, {
    title: stripMarker(post.title),
    body: stripMarker(post.body),
    excerpt: stripMarker(post.excerpt),
    summary: stripMarker(post.summary),
    ctaText: stripMarker(post.ctaText),
    seoTitle: stripMarker(post.seoTitle),
    metaDescription: stripMarker(post.metaDescription),
    status: 'published',
    needsReview: false,
    publishedAt,
  });
}
