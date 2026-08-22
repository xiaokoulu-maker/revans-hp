import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/api';
import { generateArticle, toGenerateInput } from '@/lib/blog/generate-article';
import { composeArticleBody } from '@/lib/blog/generate-prompt';
import { listAllSlugs, createDraftPost } from '@/lib/blog/supabase';

// 手動生成: テーマ等を受け取り、既存の生成エンジンでその場で1本生成する。
// 生成物は必ず draft として保存し、レスポンスで編集画面へ誘導する id を返す。
// 自動公開の判定は行わない（週次 cron の挙動には一切関与しない）。
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** slug 衝突時に -2,-3... で一意化 */
function ensureUniqueSlug(base: string, existing: string[]): string {
  const set = new Set(existing);
  const safeBase = base || `manual-draft-${Date.now()}`;
  if (!set.has(safeBase)) return safeBase;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${safeBase}-${n}`;
    if (!set.has(candidate)) return candidate;
  }
  return `${safeBase}-${Date.now()}`;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'リクエストが不正です。' }, { status: 400 });
  }

  const input = toGenerateInput(body);
  if (!input.theme) {
    return NextResponse.json({ error: 'テーマを入力してください。' }, { status: 400 });
  }

  const existingSlugs = await listAllSlugs();

  // 記事生成（APIキーが無ければスタブ記事＋needsReview:true）
  const result = await generateArticle(input);
  if (!result.article) {
    return NextResponse.json(
      { ok: false, error: result.error ?? '記事を生成できませんでした。' },
      { status: 502 },
    );
  }

  const article = result.article;
  const needsReview = result.needsReview ?? true;
  const composedBody = composeArticleBody(article);
  const excerpt = (article.metaDescription || article.intro || '').trim();
  const slug = ensureUniqueSlug(article.slug || '', existingSlugs);

  try {
    const created = await createDraftPost({
      slug,
      title: article.title,
      body: composedBody,
      excerpt,
      seoTitle: article.seoTitle,
      metaDescription: article.metaDescription,
      targetKeywords: result.targetKeywords ?? [],
      faq: article.faq,
      summary: article.summary,
      ctaText: article.ctaText,
      needsReview,
    });

    return NextResponse.json({
      ok: true,
      id: created.id,
      slug: created.slug,
      title: created.title,
      stub: result.stub,
      needsReview,
      reasons: result.reasons ?? [],
      usage: result.usage ?? null,
      charCount: composedBody.length,
    });
  } catch (error) {
    // 保存失敗時も、API費用をかけた生成本文は破棄せず rescued として返す。
    return NextResponse.json(
      {
        ok: false,
        error: (error as Error).message,
        rescued: {
          title: article.title,
          slug,
          seoTitle: article.seoTitle,
          metaDescription: article.metaDescription,
          body: composedBody,
        },
      },
      { status: 500 },
    );
  }
}
