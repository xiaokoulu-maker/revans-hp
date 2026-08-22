import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/api';
import { upcomingSchedule } from '@/lib/blog/schedule';
import { listAllSlugs } from '@/lib/blog/supabase';

// 投稿予定カレンダー用の予定一覧（cron＝毎週月曜9:00 JST 前提）。
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const weeksParam = Number(request.nextUrl.searchParams.get('weeks'));
  const weeks = Number.isFinite(weeksParam) && weeksParam > 0 ? Math.min(weeksParam, 52) : 12;

  const existingSlugs = await listAllSlugs();
  const schedule = upcomingSchedule(weeks, existingSlugs);

  return NextResponse.json({ weeks, schedule });
}
