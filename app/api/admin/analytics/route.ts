import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/api';
import { getAnalyticsDashboard } from '@/lib/analytics/queries';
import { listPostsAdmin } from '@/lib/admin/posts';

// アクセス分析ダッシュボードの集計を返す。集計は DB 側（RPC）で行う。
// ?days=7|30|90（既定 30）。記事別ランキングにはタイトル・公開日を付与する。
export const dynamic = 'force-dynamic';

const ALLOWED_DAYS = new Set([7, 30, 90]);

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const daysParam = Number(new URL(request.url).searchParams.get('days'));
  const days = ALLOWED_DAYS.has(daysParam) ? daysParam : 30;

  const [dashboard, posts] = await Promise.all([
    getAnalyticsDashboard(days, Date.now()),
    listPostsAdmin(),
  ]);

  // 記事別ランキングのパスにタイトル・公開日を紐づける（/blog/{slug} で突合）
  const bySlug = new Map(posts.map((p) => [p.slug, p]));
  const topPosts = dashboard.range.topPosts.map((t) => {
    const slug = t.path.replace(/^\/blog\//, '');
    const post = bySlug.get(slug);
    return {
      path: t.path,
      pv: t.pv,
      title: post?.title ?? t.path,
      publishedAt: post?.publishedAt ?? null,
    };
  });

  return NextResponse.json({
    available: dashboard.available,
    cards: dashboard.cards,
    range: { ...dashboard.range, topPosts },
  });
}
