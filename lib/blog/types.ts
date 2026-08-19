// ブログ/コラムのドメイン型。
// 将来 advans-ai-lp と同じ Supabase `blog_posts` へ差し替える前提で、
// UI から独立した「記事データの形」をここで確定させておく。
//
// 【DBカラム（snake_case）との対応】
//   TS 側は camelCase で持ち、DB の snake_case（published_at / seo_title /
//   meta_description / target_keywords 等）とのマッピングは lib/blog/index.ts の
//   データ取得層 1 箇所で行う。UI コンポーネントはこの型にのみ依存させること。

/** 公開状態。Supabase `status` 列に対応 */
export type PostStatus = 'draft' | 'published' | 'archived';

/** FAQ 1件（記事末尾 FAQ ＆ FAQPage 構造化データに使用） */
export interface FaqItem {
  question: string;
  answer: string;
}

/** 目次の1項目。id は本文見出しに付く anchor（rehype-slug と同一ロジックで算出） */
export interface PostHeading {
  /** 見出しレベル（目次は 2・3 を対象） */
  level: number;
  text: string;
  /** アンカー slug（本文 heading の id と一致） */
  id: string;
}

/**
 * 記事1件。advans-ai-lp `blog_posts` スキーマ準拠。
 * 必須は表示に最低限必要なもののみ。SEO 系・構造系は任意（無ければ本文/抜粋から補完）。
 */
export interface BlogPost {
  /** URL slug（`/blog/[slug]`） */
  slug: string;
  title: string;
  /** 本文（Markdown 文字列） */
  body: string;
  /** 抜粋（一覧カード・OGP・meta description 補完に使用） */
  excerpt: string;
  status: PostStatus;
  /** 公開日 ISO 文字列（DB: published_at） */
  publishedAt: string;
  /** 最終更新日 ISO 文字列（DB: updated_at）。無ければ publishedAt を使う */
  updatedAt?: string;

  // ── SEO ──
  /** DB: seo_title。無ければ title */
  seoTitle?: string;
  /** DB: meta_description。無ければ excerpt */
  metaDescription?: string;
  /** DB: target_keywords。meta keywords / OGP 補助 */
  targetKeywords?: string[];

  // ── 構造 ──
  /** DB: headings。目次データ。無ければ本文 Markdown から導出する */
  headings?: PostHeading[];
  /** DB: faq。記事末尾 FAQ ＆ FAQPage 構造化データ */
  faq?: FaqItem[];
  /** DB: summary。記事冒頭のリード/要約（PageHero lead 等に使用） */
  summary?: string;
  /** DB: cta_text。CTA 帯の文言差し替え（無ければ既定文言） */
  ctaText?: string;

  // ── 表示補助 ──
  /** カバー画像 URL（OGP/カード）。未指定はサイト既定 OGP */
  coverImage?: string;
  /** カテゴリ（カード tag・パンくず補助） */
  category?: string;
  /** 著者名（JSON-LD author）。無ければ運営者名 */
  author?: string;
  /** 関連記事の slug 参照。無ければ同カテゴリ等から自動選定 */
  relatedSlugs?: string[];
}

/** 一覧カード表示に必要な最小サマリー */
export interface BlogPostSummary {
  slug: string;
  title: string;
  excerpt: string;
  publishedAt: string;
  category?: string;
  /** アイキャッチ画像 URL（DB: eyecatch_url）。無ければカードは画像なし表示 */
  coverImage?: string;
  /** 読了時間（分）。本文文字数から算出（一覧・関連カードの表示用） */
  readingMinutes?: number;
}

/** ページネーション結果 */
export interface PaginatedPosts {
  posts: BlogPostSummary[];
  /** 公開記事の総数 */
  total: number;
  /** 現在ページ（1始まり） */
  page: number;
  perPage: number;
  totalPages: number;
}
