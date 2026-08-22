import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/api';
import { getPostPvMap } from '@/lib/analytics/queries';

// 記事一覧の「30日PV」列用。パス別 PV マップ { '/blog/slug': 12 } を返す。
// 既存の /api/admin/posts は変更せず、PV は別エンドポイントで取得して結合する。
export const dynamic = 'force-dynamic';

const ALLOWED_DAYS = new Set([7, 30, 90]);

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const daysParam = Number(new URL(request.url).searchParams.get('days'));
  const days = ALLOWED_DAYS.has(daysParam) ? daysParam : 30;

  const byPath = await getPostPvMap(days, Date.now());
  return NextResponse.json({ days, byPath });
}
