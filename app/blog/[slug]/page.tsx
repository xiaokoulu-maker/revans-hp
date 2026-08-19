import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubpageFrame, SubpageCTA } from '../../site-chrome';
import ArticleCta from '@/components/blog/ArticleCta';
import ArticleBody from '@/components/blog/ArticleBody';
import TableOfContents from '@/components/blog/TableOfContents';
import Faq from '@/components/blog/Faq';
import JsonLd from '@/components/blog/JsonLd';
import {
  getPostBySlug,
  getAllPublishedSlugs,
  getRelatedPosts,
  getHeadings,
  formatPostDate,
  readingMinutes,
  pickInlineCtaHeadingId,
} from '@/lib/blog';
import { SITE } from '@/lib/site';
import styles from './page.module.css';

/** 公開記事を静的生成 */
export async function generateStaticParams() {
  const slugs = await getAllPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) return {};

  const title = post.seoTitle ?? post.title;
  const description = post.metaDescription ?? post.excerpt;
  const url = `/blog/${post.slug}`;
  const image = post.coverImage ?? SITE.ogImage;

  return {
    title,
    description,
    keywords: post.targetKeywords,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: `${title}｜${SITE.name}`,
      description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: [post.author ?? SITE.name],
      tags: post.targetKeywords,
      images: [{ url: image, width: 1200, height: 630, alt: post.title }],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  const headings = getHeadings(post);
  const related = await getRelatedPosts(post);
  const readMin = readingMinutes(post.body);
  const ctaBeforeId = pickInlineCtaHeadingId(headings);
  // 更新日は公開日と異なるときだけ表示する
  const showUpdated = post.updatedAt && post.updatedAt.slice(0, 10) !== post.publishedAt.slice(0, 10);
  const url = `${SITE.url}/blog/${post.slug}`;
  const image = `${SITE.url}${post.coverImage ?? SITE.ogImage}`;

  // ── 構造化データ ──
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    headline: post.title,
    description: post.metaDescription ?? post.excerpt,
    image,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    author: { '@type': 'Organization', name: post.author ?? SITE.name },
    publisher: {
      '@type': 'Organization',
      name: SITE.name,
      logo: { '@type': 'ImageObject', url: `${SITE.url}${SITE.ogImage}` },
    },
    ...(post.targetKeywords ? { keywords: post.targetKeywords.join(', ') } : {}),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ホーム', item: SITE.url },
      { '@type': 'ListItem', position: 2, name: 'コラム', item: `${SITE.url}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  };

  const faqLd =
    post.faq && post.faq.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: post.faq.map((f) => ({
            '@type': 'Question',
            name: f.question,
            acceptedAnswer: { '@type': 'Answer', text: f.answer },
          })),
        }
      : null;

  return (
    <SubpageFrame active="/blog">
      <JsonLd data={articleLd} />
      <JsonLd data={breadcrumbLd} />
      {faqLd && <JsonLd data={faqLd} />}

      {/* 記事ヒーロー（新デザイン・白基調） */}
      <section className="article-hero">
        <div className="sub-hero-grid" aria-hidden="true" />
        <div className="shell article-hero-inner">
          <nav className="article-crumbs" aria-label="パンくず">
            <Link href="/">ホーム</Link>
            <span>/</span>
            <Link href="/blog">コラム</Link>
            <span>/</span>
            <span className="article-crumbs-current">{post.title}</span>
          </nav>
          <p className="eyebrow"><span /> {post.category ?? 'COLUMN'}</p>
          <h1>{post.title}</h1>
          <div className="article-meta">
            <span>
              <small className="font-en">公開</small>
              <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
            </span>
            {showUpdated && (
              <span>
                <small className="font-en">更新</small>
                <time dateTime={post.updatedAt}>{formatPostDate(post.updatedAt!)}</time>
              </span>
            )}
            <span>約{readMin}分で読めます</span>
          </div>
        </div>
      </section>

      <section className={styles.sec}>
        <div className={styles.layout}>
          <article className={styles.article}>
            {/* 目次：本文冒頭（最初の H2 の前）に配置 */}
            {headings.length > 0 && <TableOfContents headings={headings} />}

            <ArticleBody body={post.body} ctaBeforeId={ctaBeforeId} />

            {post.faq && post.faq.length > 0 && (
              <div className={styles.faqBlock}>
                <div className="article-section-head">
                  <p className="eyebrow"><span /> FAQ</p>
                  <h2>よくある質問</h2>
                </div>
                <div className={styles.faqInner}>
                  <Faq items={post.faq} />
                </div>
              </div>
            )}
          </article>
        </div>
      </section>

      <ArticleCta body={post.ctaText} />

      {related.length > 0 && (
        <section className={styles.related}>
          <div className={styles.relatedInner}>
            <div className="article-section-head" data-reveal="up">
              <p className="eyebrow"><span /> RELATED</p>
              <h2>関連記事</h2>
            </div>
            <div className={styles.relatedGrid}>
              {related.map((r) => (
                <Link className="related-card" href={`/blog/${r.slug}`} key={r.slug}>
                  <small className="font-en">{r.category ?? 'COLUMN'}</small>
                  <h3>{r.title}</h3>
                  <p>{r.excerpt}</p>
                  <b>
                    {formatPostDate(r.publishedAt)}
                    {r.readingMinutes ? ` ・ 約${r.readingMinutes}分` : ''} READ ↓
                  </b>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <SubpageCTA title="この記事に関連する相談も、お気軽にどうぞ。" />
    </SubpageFrame>
  );
}
