import type { Metadata } from 'next';
import Link from 'next/link';
import { PageIntro, SubpageCTA, SubpageFrame } from '../site-chrome';
import JsonLd from '@/components/blog/JsonLd';
import { getPosts, formatPostDate, POSTS_PER_PAGE } from '@/lib/blog';
import { SITE } from '@/lib/site';

const DESC =
  'REVANS（レバンス）のコラム。中小企業の集客・採用に役立つWeb制作・MEO・AI活用・広告・採用支援の実践的なノウハウを、実務目線で発信します。';

/** ?page=N を反映した canonical / title を返す */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { page } = await searchParams;
  const p = Math.max(1, Number(page) || 1);
  const canonical = p > 1 ? `/blog?page=${p}` : '/blog';
  const title = p > 1 ? `コラム（${p}ページ目）` : 'コラム';
  return {
    title,
    description: DESC,
    alternates: { canonical },
    openGraph: { url: canonical, title: `${title}｜${SITE.name}`, description: DESC, type: 'website' },
  };
}

export default async function BlogIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const { posts, page: current, totalPages } = await getPosts(Number(page) || 1);

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'ホーム', item: SITE.url },
      { '@type': 'ListItem', position: 2, name: 'コラム', item: `${SITE.url}/blog` },
    ],
  };

  const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <SubpageFrame active="/blog">
      <JsonLd data={breadcrumbLd} />
      <PageIntro
        index="04"
        label="INSIGHTS"
        accent="JOURNAL"
        title={<>WebとAIを、<br /><em>実務の言葉で。</em></>}
        description="流行の言葉を並べるのではなく、中小企業の現場でどう使うかを、わかりやすく整理します。"
      />

      <section className="content-section journal-index-section">
        <div className="shell">
          {posts.length > 0 ? (
            <>
              <div className="journal-index" data-reveal="up">
                {posts.map((post, i) => {
                  const number = String((current - 1) * POSTS_PER_PAGE + i + 1).padStart(2, '0');
                  return (
                    <Link
                      href={`/blog/${post.slug}`}
                      key={post.slug}
                      className={post.coverImage ? 'has-thumb' : undefined}
                    >
                      {post.coverImage && (
                        // アイキャッチ（DB: eyecatch_url）。外部ストレージURLに対応するため素の img で表示。
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="journal-thumb" src={post.coverImage} alt="" loading="lazy" />
                      )}
                      <span>{number}</span>
                      <small>{post.category ?? 'COLUMN'}</small>
                      <h2>{post.title}</h2>
                      <p>{post.excerpt}</p>
                      <b>
                        {formatPostDate(post.publishedAt)}
                        {post.readingMinutes ? ` ・ 約${post.readingMinutes}分` : ''} READ ↓
                      </b>
                    </Link>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <nav className="blog-pager" aria-label="ページ送り">
                  {current > 1 && (
                    <Link className="blog-pager-arrow" href={current - 1 === 1 ? '/blog' : `/blog?page=${current - 1}`} rel="prev">
                      ← 前へ
                    </Link>
                  )}
                  <div className="blog-pager-nums">
                    {pageNumbers.map((n) => (
                      <Link
                        key={n}
                        href={n === 1 ? '/blog' : `/blog?page=${n}`}
                        aria-current={n === current ? 'page' : undefined}
                        className={n === current ? 'is-current' : undefined}
                      >
                        {n}
                      </Link>
                    ))}
                  </div>
                  {current < totalPages && (
                    <Link className="blog-pager-arrow" href={`/blog?page=${current + 1}`} rel="next">
                      次へ →
                    </Link>
                  )}
                </nav>
              )}
            </>
          ) : (
            <p className="journal-empty">記事は準備中です。近日公開いたします。</p>
          )}
        </div>
      </section>

      <SubpageCTA title="WebやAIの相談を、難しく考える必要はありません。" />
    </SubpageFrame>
  );
}
