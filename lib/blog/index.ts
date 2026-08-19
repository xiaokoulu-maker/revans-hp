import GithubSlugger from 'github-slugger';
import type {
  BlogPost,
  BlogPostSummary,
  PaginatedPosts,
  PostHeading,
} from './types';
import { getSupabase, mapRow, POST_COLUMNS, type BlogPostRow } from './supabase';

// ─────────────────────────────────────────────────────────────
// ブログ データ取得層（唯一の“供給元”）。
//
// Supabase `blog_posts` から公開記事（status='published'）のみを取得する。
// UI コンポーネントはこの層の関数のみに依存し、返り値の型（./types）に依存する。
//
// 【フォールバック方針】
//   接続情報が無い／DB エラー時は例外を投げず、空配列 or undefined を返す。
//   これにより DB 未接続・空でもビルド/表示が落ちない（一覧0件・個別は notFound）。
// ─────────────────────────────────────────────────────────────

/** 一覧の1ページあたり件数 */
export const POSTS_PER_PAGE = 9;

/**
 * 公開済み記事を公開日の新しい順で取得。
 * 接続不可・エラー時は空配列を返す（呼び出し側は一覧0件になる）。
 */
async function loadPublishedPosts(): Promise<BlogPost[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(POST_COLUMNS)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (error) {
      console.error('[blog] failed to load posts:', error.message);
      return [];
    }
    return ((data as BlogPostRow[]) ?? []).map(mapRow);
  } catch (e) {
    console.error('[blog] unexpected error loading posts:', e);
    return [];
  }
}

/** 記事 → カード表示用サマリーへ変換 */
function toSummary(p: BlogPost): BlogPostSummary {
  return {
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    publishedAt: p.publishedAt,
    category: p.category,
    coverImage: p.coverImage,
    readingMinutes: readingMinutes(p.body),
  };
}

/**
 * 本文 Markdown から読了時間（分）を算出する。
 * 日本語は約550字/分。Markdown 記号・URL・空白はノイズなので概算で除外し、
 * 最低1分を返す。
 */
export function readingMinutes(markdown: string, cpm = 550): number {
  const text = (markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ') // コードブロック除外
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, ' ') // 画像・リンクの記法除外
    .replace(/[#>*_`~|\-\s]/g, ''); // Markdown記号・空白除外
  return Math.max(1, Math.round(text.length / cpm));
}

/**
 * 本文中間に差し込むインラインCTAの直前に置く h2 見出し id を選ぶ。
 * h2 が3つ以上あるときだけ、（先頭と末尾＝まとめ を避けた）中央付近の h2 を1つ返す。
 * 少ない記事では null（挿入しない ＝ 控えめ運用）。
 */
export function pickInlineCtaHeadingId(headings: PostHeading[]): string | null {
  const h2s = headings.filter((h) => h.level === 2);
  if (h2s.length < 3) return null;
  // 先頭は避け、末尾（まとめ等）も避けた中央付近
  const candidates = h2s.slice(1, h2s.length - 1);
  if (candidates.length === 0) return null;
  return candidates[Math.floor((candidates.length - 1) / 2)].id;
}

/**
 * 公開記事をページネーションして取得。
 * @param page 1始まり。範囲外は 1..totalPages にクランプ。
 */
export async function getPosts(page = 1, perPage = POSTS_PER_PAGE): Promise<PaginatedPosts> {
  const all = await loadPublishedPosts();
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), totalPages);
  const start = (current - 1) * perPage;
  const posts = all.slice(start, start + perPage).map(toSummary);
  return { posts, total, page: current, perPage, totalPages };
}

/** 公開記事の全 slug（generateStaticParams / sitemap 用） */
export async function getAllPublishedSlugs(): Promise<string[]> {
  const all = await loadPublishedPosts();
  return all.map((p) => p.slug);
}

/** 公開記事のうち sitemap に必要な最小情報（slug と更新日） */
export async function getSitemapEntries(): Promise<{ slug: string; lastModified: string }[]> {
  const all = await loadPublishedPosts();
  return all.map((p) => ({ slug: p.slug, lastModified: p.updatedAt ?? p.publishedAt }));
}

/**
 * slug から公開記事を1件取得（下書き等は返さない）。
 * 接続不可・エラー・該当なしは undefined（呼び出し側は notFound）。
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | undefined> {
  const supabase = getSupabase();
  if (!supabase) return undefined;

  try {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(POST_COLUMNS)
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();

    if (error) {
      console.error('[blog] failed to load post:', error.message);
      return undefined;
    }
    return data ? mapRow(data as BlogPostRow) : undefined;
  } catch (e) {
    console.error('[blog] unexpected error loading post:', e);
    return undefined;
  }
}

/**
 * 関連記事を取得。
 * relatedSlugs があればそれを優先し、不足分は同カテゴリ→新着で補完。
 */
export async function getRelatedPosts(post: BlogPost, limit = 3): Promise<BlogPostSummary[]> {
  const all = await loadPublishedPosts();
  const pool = all.filter((p) => p.slug !== post.slug);

  const picked: BlogPost[] = [];
  const pushUnique = (p?: BlogPost) => {
    if (p && !picked.some((x) => x.slug === p.slug)) picked.push(p);
  };

  // 1) 明示指定
  (post.relatedSlugs ?? []).forEach((s) => pushUnique(pool.find((p) => p.slug === s)));
  // 2) 同カテゴリ
  if (picked.length < limit && post.category) {
    pool.filter((p) => p.category === post.category).forEach(pushUnique);
  }
  // 3) 新着で補完
  pool.forEach(pushUnique);

  return picked.slice(0, limit).map(toSummary);
}

/**
 * 目次データの取得。
 * post.headings があればそれを使い、無ければ本文 Markdown の h2/h3 から導出する。
 * 導出時の id は rehype-slug と同じ GithubSlugger で算出し、本文アンカーと一致させる。
 */
export function getHeadings(post: BlogPost): PostHeading[] {
  if (post.headings && post.headings.length > 0) return post.headings;
  return deriveHeadings(post.body);
}

/** Markdown 本文から h2/h3 見出しを抽出して目次を生成 */
export function deriveHeadings(markdown: string): PostHeading[] {
  const slugger = new GithubSlugger();
  const headings: PostHeading[] = [];
  let inCodeBlock = false;

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trimEnd();
    // ``` で囲まれたコードブロック内の見出し記号は無視
    if (/^\s*```/.test(line)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const m = /^(#{2,3})\s+(.+?)\s*#*$/.exec(line);
    if (!m) continue;
    const level = m[1].length;
    // 見出しテキストから Markdown 強調記号・インラインコードを除去
    const text = m[2].replace(/[*_`]/g, '').trim();
    headings.push({ level, text, id: slugger.slug(text) });
  }
  return headings;
}

/** 公開日 ISO 文字列を "YYYY.MM.DD" 表示へ整形（表示用） */
export function formatPostDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}

export type { BlogPost, BlogPostSummary, PaginatedPosts, PostHeading } from './types';
