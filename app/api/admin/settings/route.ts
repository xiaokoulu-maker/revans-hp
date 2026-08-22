import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/api';
import { getBlogSettings, updateBlogSettings, type BlogSettingsValues } from '@/lib/blog/supabase';

// ブログ設定（auto_publish / default_author / posts_per_page）の取得・更新。
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const settings = await getBlogSettings();
  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'リクエストが不正です。' }, { status: 400 });
  }

  const patch: Partial<BlogSettingsValues> = {};
  if (typeof body.autoPublish === 'boolean') patch.autoPublish = body.autoPublish;
  if (typeof body.autoFix === 'boolean') patch.autoFix = body.autoFix;
  if (typeof body.defaultAuthor === 'string') patch.defaultAuthor = body.defaultAuthor;
  if (body.postsPerPage !== undefined) {
    const n = Number(body.postsPerPage);
    if (Number.isFinite(n) && n >= 1 && n <= 60) patch.postsPerPage = Math.floor(n);
  }

  const settings = await updateBlogSettings(patch);
  return NextResponse.json({ settings });
}
