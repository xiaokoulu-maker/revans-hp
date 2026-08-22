import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BlogPost, FaqItem, PostStatus } from './types';

// ─────────────────────────────────────────────────────────────
// Supabase クライアント（読み取り専用・匿名キー）。
// 接続情報は環境変数からのみ取得し、コードに直書きしない。
//   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// 未設定なら null を返し、呼び出し側はフォールバック（空配列/undefined）する。
// ─────────────────────────────────────────────────────────────

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // 環境変数が無ければ接続しない（ビルド/実行を落とさない）
    cached = null;
    return null;
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

/** blog_posts の1行（Supabase 返却カラム。snake_case） */
export interface BlogPostRow {
  slug: string;
  title: string;
  body: string | null;
  excerpt: string | null;
  eyecatch_url: string | null;
  status: string;
  published_at: string | null;
  seo_title: string | null;
  meta_description: string | null;
  target_keywords: string[] | null;
  headings: unknown;
  faq: unknown;
  summary: string | null;
  cta_text: string | null;
  category?: string | null;
  created_at: string;
  updated_at: string | null;
}

/**
 * 取得に使うカラム列（select 指定を1箇所に集約）。
 * category は追加マイグレーション（0002）で入る任意列。未適用環境でも公開側が
 * 落ちないよう、BASE（category 抜き）と FULL（category 付き）を用意し、
 * データ取得層で FULL→BASE のフォールバックを行う。
 */
export const POST_COLUMNS_BASE =
  'slug, title, body, excerpt, eyecatch_url, status, published_at, seo_title, meta_description, target_keywords, faq, summary, cta_text, created_at, updated_at';
export const POST_COLUMNS = `${POST_COLUMNS_BASE}, category`;

/** PostgREST の「列が存在しない」エラー（未適用マイグレーション）判定 */
export function isUndefinedColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42703' || /column .*category.* does not exist/i.test(error.message ?? '');
}

const emptyToUndef = (v: string | null | undefined): string | undefined =>
  v && v.trim() !== '' ? v : undefined;

/** jsonb の faq を FaqItem[] へ（不正な要素は除外）。空なら undefined */
function mapFaq(raw: unknown): FaqItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .map((it) => {
      const e = (it ?? {}) as { question?: unknown; answer?: unknown };
      return { question: String(e.question ?? '').trim(), answer: String(e.answer ?? '').trim() };
    })
    .filter((e) => e.question && e.answer);
  return items.length > 0 ? items : undefined;
}

/**
 * DB 行 → BlogPost（camelCase）へマッピング。
 *
 * ・headings は DB 側の形（{level,text}／未整備）を使わず undefined にする。
 *   目次アンカーは本文 Markdown から rehype-slug と同一ロジックで導出するため
 *   （lib/blog/index.ts の getHeadings）、本文由来のみで id 整合を保つ。
 * ・category / author / relatedSlugs は ../advans-ai-lp スキーマに無いので undefined。
 *   UI 側はフォールバック（en='COLUMN'、著者=SITE名、関連=新着）で動作する。
 */
export function mapRow(row: BlogPostRow): BlogPost {
  return {
    slug: row.slug,
    title: row.title,
    body: row.body ?? '',
    excerpt: row.excerpt ?? '',
    status: (row.status as PostStatus) ?? 'published',
    publishedAt: row.published_at ?? row.created_at,
    updatedAt: row.updated_at ?? undefined,
    seoTitle: emptyToUndef(row.seo_title),
    metaDescription: emptyToUndef(row.meta_description),
    targetKeywords:
      row.target_keywords && row.target_keywords.length > 0 ? row.target_keywords : undefined,
    headings: undefined,
    faq: mapFaq(row.faq),
    summary: emptyToUndef(row.summary),
    ctaText: emptyToUndef(row.cta_text),
    coverImage: row.eyecatch_url ?? undefined,
    // category は 0002 マイグレーション適用後のみ値が入る。未適用時は undefined で
    // 従来どおり UI 側フォールバック（'COLUMN'）になる。
    category: emptyToUndef(row.category),
    author: undefined,
    relatedSlugs: undefined,
  };
}

// ═════════════════════════════════════════════════════════════
// 書き込み経路（サーバー専用・service_role）
//
// 匿名キー（getSupabase 上部）は RLS により published の SELECT しかできない。
// AI下書きの INSERT / 公開への UPDATE は RLS をバイパスする service_role が必要。
// SUPABASE_SERVICE_ROLE_KEY は NEXT_PUBLIC_ を付けず、サーバー側でのみ使う。
//
// このセクションの関数はサーバー（app/api/cron/generate 等）からのみ呼ぶこと。
// クライアントバンドルに混入したら例外を投げるガードを入れている。
// ═════════════════════════════════════════════════════════════

let serviceCached: SupabaseClient | null | undefined;

/**
 * service_role キーで作るサーバー専用クライアント。
 * ・ブラウザ環境で呼ばれたら即例外（サービスキーの露出防止）。
 * ・キー未設定なら null を返し、呼び出し側が扱えるようにする。
 */
export function getServiceSupabase(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[blog] getServiceSupabase() はサーバー専用です。クライアント側から呼び出さないでください。',
    );
  }

  if (serviceCached !== undefined) return serviceCached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    serviceCached = null;
    return null;
  }

  serviceCached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceCached;
}

/** blog_settings（単一行）の値。未取得時は autoPublish=false 扱い。 */
export interface BlogSettingsValues {
  autoPublish: boolean;
  postsPerPage: number;
  defaultAuthor: string;
}

const DEFAULT_SETTINGS: BlogSettingsValues = {
  autoPublish: false,
  postsPerPage: 9,
  defaultAuthor: '',
};

/**
 * blog_settings を1行取得する。行が無い／接続不可なら autoPublish=false の既定を返す。
 * 「行が無ければ非公開扱い」で、意図せぬ自動公開を防ぐ。
 */
export async function getBlogSettings(): Promise<BlogSettingsValues> {
  const supabase = getServiceSupabase();
  if (!supabase) return DEFAULT_SETTINGS;

  const { data, error } = await supabase
    .from('blog_settings')
    .select('auto_publish, posts_per_page, default_author')
    .limit(1)
    .maybeSingle();

  if (error || !data) return DEFAULT_SETTINGS;

  return {
    autoPublish: Boolean((data as { auto_publish?: unknown }).auto_publish),
    postsPerPage: Number((data as { posts_per_page?: unknown }).posts_per_page) || 9,
    defaultAuthor: String((data as { default_author?: unknown }).default_author ?? ''),
  };
}

/**
 * blog_settings（単一行）を更新する。存在しなければ1行 insert する。
 * 管理画面の設定保存から呼ぶ（service_role 経由）。更新後の値を返す。
 */
export async function updateBlogSettings(
  patch: Partial<BlogSettingsValues>,
): Promise<BlogSettingsValues> {
  const supabase = getServiceSupabase();
  if (!supabase) return { ...DEFAULT_SETTINGS, ...patch };

  const payload: Record<string, unknown> = {};
  if (patch.autoPublish !== undefined) payload.auto_publish = patch.autoPublish;
  if (patch.defaultAuthor !== undefined) payload.default_author = patch.defaultAuthor;
  if (patch.postsPerPage !== undefined) payload.posts_per_page = patch.postsPerPage;

  const { data: existing } = await supabase.from('blog_settings').select('id').limit(1).maybeSingle();

  if (existing && (existing as { id?: string }).id) {
    const { error } = await supabase
      .from('blog_settings')
      .update(payload)
      .eq('id', (existing as { id: string }).id);
    if (error) console.error('[blog] updateBlogSettings update failed:', error.message);
  } else {
    const { error } = await supabase.from('blog_settings').insert(payload);
    if (error) console.error('[blog] updateBlogSettings insert failed:', error.message);
  }

  return getBlogSettings();
}

/** blog_posts の全 slug（下書き含む・全 status）。テーマ重複回避と slug 一意化に使う。 */
export async function listAllSlugs(): Promise<string[]> {
  const supabase = getServiceSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase.from('blog_posts').select('slug');
  if (error || !data) {
    if (error) console.error('[blog] listAllSlugs failed:', error.message);
    return [];
  }
  return (data as { slug: string }[]).map((r) => r.slug);
}

/** 下書き作成の入力（camelCase） */
export interface CreateDraftInput {
  slug: string;
  title: string;
  body: string;
  excerpt: string;
  seoTitle: string;
  metaDescription: string;
  targetKeywords: string[];
  faq: FaqItem[];
  summary: string;
  ctaText: string;
  needsReview: boolean;
}

/** 作成結果（camelCase） */
export interface CreatedPost {
  id: string;
  slug: string;
  title: string;
  status: string;
  needsReview: boolean;
}

/**
 * AI記事を status='draft' / source='ai' で1件保存する。
 * headings は保存しない（表示側は本文Markdownから導出するため '[]' を入れる）。
 * service_role 未設定時は例外（呼び出し側で 500 相当のレスポンスにする）。
 */
export async function createDraftPost(input: CreateDraftInput): Promise<CreatedPost> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY が未設定のため、記事を保存できません。');
  }

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      slug: input.slug,
      title: input.title,
      body: input.body,
      excerpt: input.excerpt,
      status: 'draft',
      published_at: null,
      seo_title: input.seoTitle,
      meta_description: input.metaDescription,
      target_keywords: input.targetKeywords,
      headings: [],
      faq: input.faq,
      summary: input.summary,
      cta_text: input.ctaText,
      source: 'ai',
      needs_review: input.needsReview,
    })
    .select('id, slug, title, status, needs_review')
    .single();

  if (error || !data) {
    throw new Error(`記事の保存に失敗しました: ${error?.message ?? '不明なエラー'}`);
  }

  const row = data as { id: string; slug: string; title: string; status: string; needs_review: boolean };
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    needsReview: row.needs_review,
  };
}

/**
 * 記事の公開状態を更新する（下書き→公開など）。
 * status='published' のときは publishedAt をセットする。成否を boolean で返す。
 */
export async function updatePostStatus(
  id: string,
  status: 'draft' | 'published' | 'private',
  publishedAt: string | null,
): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;

  const { error } = await supabase
    .from('blog_posts')
    .update({ status, published_at: publishedAt })
    .eq('id', id);

  if (error) {
    console.error('[blog] updatePostStatus failed:', error.message);
    return false;
  }
  return true;
}
