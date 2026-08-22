import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/api';
import {
  getPostAdmin,
  updatePostAdmin,
  getPostAdminBySlug,
  type AdminPostPatch,
  type AdminPostStatus,
} from '@/lib/admin/posts';
import { checkArticleSafety } from '@/lib/blog/safety-check';
import type { FaqItem } from '@/lib/blog/types';

// 記事1件の取得・更新。編集保存では safetyCheck による再チェックを行う。
export const dynamic = 'force-dynamic';

const STATUSES: AdminPostStatus[] = ['draft', 'published', 'private'];

function revalidateBlog(slug?: string) {
  revalidatePath('/blog');
  if (slug) revalidatePath(`/blog/${slug}`);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const post = await getPostAdmin(id);
  if (!post) return NextResponse.json({ error: '記事が見つかりません。' }, { status: 404 });
  return NextResponse.json({ post });
}

/** 任意の入力から更新パッチを組み立てる（与えられたキーのみ） */
function buildPatch(body: Record<string, unknown>): AdminPostPatch {
  const patch: AdminPostPatch = {};
  if (typeof body.title === 'string') patch.title = body.title;
  if (typeof body.slug === 'string') patch.slug = body.slug.trim();
  if (typeof body.body === 'string') patch.body = body.body;
  if (typeof body.excerpt === 'string') patch.excerpt = body.excerpt;
  if ('eyecatchUrl' in body) patch.eyecatchUrl = body.eyecatchUrl ? String(body.eyecatchUrl) : null;
  if ('category' in body) patch.category = body.category ? String(body.category) : null;
  if (typeof body.status === 'string' && STATUSES.includes(body.status as AdminPostStatus)) {
    patch.status = body.status as AdminPostStatus;
  }
  if ('publishedAt' in body) patch.publishedAt = body.publishedAt ? String(body.publishedAt) : null;
  if (typeof body.seoTitle === 'string') patch.seoTitle = body.seoTitle;
  if (typeof body.metaDescription === 'string') patch.metaDescription = body.metaDescription;
  if (Array.isArray(body.targetKeywords)) {
    patch.targetKeywords = body.targetKeywords.map((k) => String(k).trim()).filter(Boolean);
  }
  if (Array.isArray(body.faq)) {
    patch.faq = (body.faq as unknown[])
      .map((it) => {
        const e = (it ?? {}) as { question?: unknown; answer?: unknown };
        return { question: String(e.question ?? '').trim(), answer: String(e.answer ?? '').trim() };
      })
      .filter((e) => e.question && e.answer) as FaqItem[];
  }
  if (typeof body.summary === 'string') patch.summary = body.summary;
  if (typeof body.ctaText === 'string') patch.ctaText = body.ctaText;
  if (typeof body.needsReview === 'boolean') patch.needsReview = body.needsReview;
  return patch;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'リクエストが不正です。' }, { status: 400 });
  }

  const existing = await getPostAdmin(id);
  if (!existing) return NextResponse.json({ error: '記事が見つかりません。' }, { status: 404 });

  const patch = buildPatch(body);

  // slug を変更する場合、他の記事と衝突していないか確認
  if (patch.slug && patch.slug !== existing.slug) {
    const dup = await getPostAdminBySlug(patch.slug);
    if (dup && dup.id !== id) {
      return NextResponse.json({ error: `slug「${patch.slug}」は既に使われています。` }, { status: 409 });
    }
  }

  // 編集保存時の再安全チェック（フェーズ⑩相当）:
  // 公開済みが要確認化しても status は変えず（公開維持）、needs_review バッジのみ立てる。
  let safety: { needsReview: boolean; reasons: string[] } | undefined;
  if (body.safetyCheck === true) {
    const merged = { ...existing, ...patch };
    const result = checkArticleSafety({
      title: merged.title,
      body: merged.body,
      summary: merged.summary,
      ctaText: merged.ctaText,
      faq: merged.faq,
    });
    patch.needsReview = result.needsReview;
    safety = { needsReview: result.needsReview, reasons: result.reasons };
  }

  const post = await updatePostAdmin(id, patch);
  if (!post) return NextResponse.json({ error: '更新に失敗しました。' }, { status: 500 });

  revalidateBlog(post.slug);
  if (existing.slug !== post.slug) revalidateBlog(existing.slug);

  return NextResponse.json({ post, safety });
}
