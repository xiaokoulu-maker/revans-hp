import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/api';
import { listPostsAdmin } from '@/lib/admin/posts';

// 全記事一覧（下書き・非公開・要確認を含む）。service_role 経由。
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const posts = await listPostsAdmin();
  return NextResponse.json({ posts });
}
