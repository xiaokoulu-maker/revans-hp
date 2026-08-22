import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/api';
import { approveAndPublish } from '@/lib/admin/posts';

// 要確認記事を「承認して公開」する。
// [要確認]マーカー除去 → needs_review 解除 → published 化＋published_at → /blog を revalidate。
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const post = await approveAndPublish(id);
  if (!post) return NextResponse.json({ error: '承認・公開に失敗しました。' }, { status: 500 });

  revalidatePath('/blog');
  revalidatePath(`/blog/${post.slug}`);

  return NextResponse.json({ post });
}
