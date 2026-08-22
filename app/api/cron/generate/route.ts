import { NextRequest, NextResponse } from 'next/server';
import { generateArticle } from '@/lib/blog/generate-article';
import { composeArticleBody } from '@/lib/blog/generate-prompt';
import { autoFixArticle, type AutoFixOutcome } from '@/lib/blog/auto-fix';
import { pickTopic, toGenerateInputFromTopic } from '@/lib/blog/topic-queue';
import {
  listAllSlugs,
  getBlogSettings,
  createDraftPost,
  updatePostStatus,
  updatePostContentAndPublish,
} from '@/lib/blog/supabase';

/**
 * AIブログの手動実行／定期実行エンドポイント。
 *
 * フロー: 認証 → 既存slug取得 → テーマ決定 → 生成 → 必ずdraftで保存 →
 *   settings.auto_publish && !needs_review のときのみ published に更新。
 *
 * 認証: Authorization: Bearer <CRON_SECRET> を検証。CRON_SECRET 未設定の環境では
 * 常に 401 を返し、誰でも生成を走らせられる状態を作らない。
 * （Vercel Cron 登録は 3-4 で別途行う。vercel.json はまだ変更しない。）
 *
 * 保存先は service_role の Supabase。ANTHROPIC_API_KEY 未設定時はスタブ記事＋
 * needsReview:true になり、公開されず下書きに留まる。
 */

// 毎回その時点の設定・記事一覧を読むため、静的化させない。
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

/** slugBase が既存slugと衝突する場合に -2, -3... を付けて一意化する */
function ensureUniqueSlug(base: string, existing: string[]): string {
  const set = new Set(existing);
  const safeBase = base || `ai-draft-${Date.now()}`;
  if (!set.has(safeBase)) return safeBase;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${safeBase}-${n}`;
    if (!set.has(candidate)) return candidate;
  }
  return `${safeBase}-${Date.now()}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: '認証に失敗しました。' }, { status: 401 });
  }

  // a. 既存slugを取得し、テーマ決定と slug 一意化に使う
  const existingSlugs = await listAllSlugs();

  // b. 次のテーマを決定
  const topic = pickTopic(existingSlugs);
  const input = toGenerateInputFromTopic(topic);

  // c. 記事生成（APIキーが無ければスタブ記事＋needsReview:true）
  const result = await generateArticle(input);
  if (!result.article) {
    return NextResponse.json({
      ok: false,
      theme: topic.theme,
      error: result.error ?? '記事を生成できませんでした。',
    });
  }

  const article = result.article;
  const needsReview = result.needsReview ?? true;
  const body = composeArticleBody(article);
  const excerpt = (article.metaDescription || article.intro || '').trim();
  const slug = ensureUniqueSlug(topic.slugBase, existingSlugs);

  // d. まず必ず draft として保存する（AI生成をいきなり公開状態で作らない）
  let created;
  try {
    created = await createDraftPost({
      slug,
      title: article.title,
      body,
      excerpt,
      seoTitle: article.seoTitle,
      metaDescription: article.metaDescription,
      targetKeywords: result.targetKeywords ?? [],
      faq: article.faq,
      summary: article.summary,
      ctaText: article.ctaText,
      needsReview,
    });
  } catch (error) {
    // 保存に失敗しても、生成済みの本文はAPI費用をかけて得た成果物なので破棄せず返す。
    // （エラー扱い＝ok:false のまま。呼び出し側で本文だけ救出できる形にする）
    return NextResponse.json(
      {
        ok: false,
        theme: topic.theme,
        slug,
        error: (error as Error).message,
        stub: result.stub,
        needsReview,
        reasons: result.reasons ?? [],
        usage: result.usage ?? null,
        rescued: {
          title: article.title,
          slug,
          seoTitle: article.seoTitle,
          metaDescription: article.metaDescription,
          body,
          charCount: body.length,
        },
      },
      { status: 500 },
    );
  }

  // e. 公開判定
  //   ・auto_publish OFF          → draft 据え置き（現状どおり）
  //   ・needsReview=false         → そのまま published
  //   ・needsReview=true          → auto_fix ON かつ実生成なら AI 修正を試み、
  //                                 通れば修正内容で published。ダメなら draft 据え置き。
  const settings = await getBlogSettings();

  let published = false;
  let finalStatus: 'published' | 'draft' = 'draft';
  let reason: string;
  let autoFix: ReturnType<typeof summarizeAutoFix> | null = null;
  const publishedAt = new Date().toISOString();

  if (!settings.autoPublish) {
    reason = '自動公開設定がOFFのため、下書きとして保存しました。';
  } else if (!needsReview) {
    published = await updatePostStatus(created.id, 'published', publishedAt);
    finalStatus = published ? 'published' : 'draft';
    reason = published
      ? '自動公開設定がONで、安全チェックも通過したため公開しました。'
      : '公開への更新に失敗したため下書きのままです。';
  } else if (settings.autoFix && !result.stub) {
    // 要確認記事の自動修正パス（公開まで完結させる）。
    const outcome = await autoFixArticle(
      article,
      { needsReview: true, reasons: result.reasons ?? [], notes: [] },
    );
    autoFix = summarizeAutoFix(outcome);

    if (outcome.fixed) {
      const fixedBody = composeArticleBody(outcome.article);
      const fixedExcerpt = (outcome.article.metaDescription || outcome.article.intro || '').trim();
      published = await updatePostContentAndPublish(
        created.id,
        {
          title: outcome.article.title,
          body: fixedBody,
          excerpt: fixedExcerpt,
          seoTitle: outcome.article.seoTitle,
          metaDescription: outcome.article.metaDescription,
          faq: outcome.article.faq,
          summary: outcome.article.summary,
          ctaText: outcome.article.ctaText,
        },
        publishedAt,
      );
      finalStatus = published ? 'published' : 'draft';
      reason = published
        ? `要確認と判定されましたが、AIが自動修正し公開しました（試行${outcome.attempts}回・検出: ${describeDetected(outcome)}）。`
        : '自動修正は成功しましたが、公開への更新に失敗したため下書きのままです。';
    } else {
      reason = outcome.error
        ? `AI修正の呼び出しに失敗したため、下書きのままにしました（${outcome.error}）。`
        : `AI修正を${outcome.attempts}回試みましたが安全チェックを通らず、下書きのままにしました（残: ${outcome.finalReasons.join(' / ') || '理由不明'}）。`;
    }
  } else {
    // auto_fix OFF、またはスタブ記事 → 現状どおり draft 据え置き。
    reason = result.stub
      ? 'APIキー未設定のスタブ記事のため、自動修正はスキップし下書きとして保存しました。'
      : `安全チェックで確認が必要と判定されたため、下書きのままにしました（${(result.reasons ?? []).join(' / ') || '理由不明'}）。`;
  }

  return NextResponse.json({
    ok: true,
    stub: result.stub,
    theme: topic.theme,
    postId: created.id,
    title: created.title,
    slug: created.slug,
    charCount: body.length,
    status: finalStatus,
    published,
    needsReview,
    autoFix,
    reason,
    reasons: result.reasons ?? [],
    usage: result.usage ?? null,
  });
}

/** cron レスポンス／ログ用に AutoFixOutcome を要約する。 */
function summarizeAutoFix(outcome: AutoFixOutcome) {
  return {
    attempted: outcome.attempted,
    fixed: outcome.fixed,
    attempts: outcome.attempts,
    detected: describeDetected(outcome),
    initialReasons: outcome.initialReasons,
    finalReasons: outcome.finalReasons,
    totalCostUsd: outcome.totalCostUsd,
    usages: outcome.usages,
    error: outcome.error ?? null,
  };
}

function describeDetected(outcome: AutoFixOutcome): string {
  const parts: string[] = [];
  if (outcome.detected.marker) parts.push('[要確認]');
  if (outcome.detected.price) parts.push('金額表現');
  return parts.length ? parts.join('・') : '不明';
}
