import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/api';
import { suggestTopics } from '@/lib/blog/suggest-topics-server';
import { listPostsAdmin } from '@/lib/admin/posts';

// テーマAI候補（Sonnetで6〜8件・既存タイトル重複回避）。
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const posts = await listPostsAdmin();
  const existingTitles = posts.map((p) => p.title);

  const result = await suggestTopics(existingTitles);
  return NextResponse.json(result);
}
