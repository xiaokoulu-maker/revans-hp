import test from 'node:test';
import assert from 'node:assert/strict';

import { autoFixArticle, type AutoFixModelResult } from '@/lib/blog/auto-fix';
import { checkArticleSafety } from '@/lib/blog/safety-check';
import { REVIEW_MARKER, type GeneratedArticle } from '@/lib/blog/generate-prompt';

// ─────────────────────────────────────────────────────────────
// auto-fix.ts の単体テスト。実 AI は使わず deps.callModel をモックする。
// 実行: node --import ./scripts/test-loader.mjs --test lib/blog/auto-fix.test.ts
// ─────────────────────────────────────────────────────────────

function makeArticle(overrides: Partial<GeneratedArticle> = {}): GeneratedArticle {
  return {
    title: 'Web集客の始め方',
    slug: 'web-shukyaku',
    seoTitle: 'Web集客の始め方｜REVANS',
    metaDescription: '中小企業向けにWeb集客の基本を解説します。',
    intro: 'Web集客をはじめて検討する経営者に向けた記事です。',
    headings: [{ level: 2, text: 'はじめに' }],
    body: '## はじめに\n\nWeb集客は積み上げ型です。',
    faq: [{ question: '相談は無料ですか？', answer: 'はい、無料相談を承っています。' }],
    summary: 'Web集客のポイントをまとめました。',
    ctaText: 'まずは無料相談から。',
    ...overrides,
  };
}

/** callModel モック: 与えた記事オブジェクトをそのまま JSON テキストとして返す。 */
function respondWith(article: GeneratedArticle, wrap = false): AutoFixModelResult {
  const json = JSON.stringify({
    title: article.title,
    seoTitle: article.seoTitle,
    metaDescription: article.metaDescription,
    intro: article.intro,
    body: article.body,
    summary: article.summary,
    ctaText: article.ctaText,
    faq: article.faq,
  });
  const text = wrap ? `修正しました。\n${json}\nご確認ください。` : json;
  return { text, usage: { inputTokens: 1000, outputTokens: 500, cacheCreationInputTokens: 0, cacheReadInputTokens: 0, estimatedCostUsd: 0.0105 } };
}

test('[要確認]マーカー入り本文 → 修正でマーカー消滅し再チェック通過', async () => {
  const dirty = makeArticle({
    body: `## はじめに\n\n費用については${REVIEW_MARKER}をご確認ください。Web集客は積み上げ型です。`,
  });
  const initial = checkArticleSafety(dirty);
  assert.equal(initial.needsReview, true, '前提: 初回は needsReview=true');

  const cleaned = makeArticle({
    body: '## はじめに\n\n費用は内容により異なる場合があります。Web集客は積み上げ型です。',
  });

  const outcome = await autoFixArticle(dirty, initial, {
    callModel: async () => respondWith(cleaned),
  });

  assert.equal(outcome.fixed, true);
  assert.equal(outcome.attempts, 1);
  assert.equal(outcome.finalReasons.length, 0);
  assert.equal(outcome.detected.marker, true);
  assert.ok(!outcome.article.body.includes(REVIEW_MARKER), 'マーカーが残っていないこと');
});

test('金額表現入り本文 → 非断定表現に置換され再チェック通過', async () => {
  const dirty = makeArticle({
    body: '## 料金\n\n制作費はおよそ30万円かかります。',
  });
  const initial = checkArticleSafety(dirty);
  assert.equal(initial.needsReview, true);
  assert.equal(initial.reasons.some((r) => r.includes('金額')), true);

  const cleaned = makeArticle({
    body: '## 料金\n\n制作費は内容やご予算に応じて個別にお見積りします。',
  });

  const outcome = await autoFixArticle(dirty, initial, {
    callModel: async () => respondWith(cleaned),
  });

  assert.equal(outcome.fixed, true);
  assert.equal(outcome.detected.price, true);
  assert.ok(!/\d\s*万円/.test(outcome.article.body), '金額の数字が残っていないこと');
});

test('コードフェンス無しでも前後にプロズがある応答から JSON を抽出できる', async () => {
  const dirty = makeArticle({ body: `本文に${REVIEW_MARKER}が含まれます。` });
  const initial = checkArticleSafety(dirty);
  const cleaned = makeArticle({ body: '本文は一般的な内容にとどめます。' });

  const outcome = await autoFixArticle(dirty, initial, {
    callModel: async () => respondWith(cleaned, true),
  });

  assert.equal(outcome.fixed, true);
});

test('2回試しても通らない → draft フォールバック（fixed=false, attempts=2）', async () => {
  const dirty = makeArticle({ body: `ずっと${REVIEW_MARKER}が残る本文。` });
  const initial = checkArticleSafety(dirty);

  let calls = 0;
  const outcome = await autoFixArticle(dirty, initial, {
    callModel: async () => {
      calls += 1;
      // 常にマーカーが残ったまま返す（修正失敗を再現）
      return respondWith(makeArticle({ body: `まだ${REVIEW_MARKER}が残っています。` }));
    },
  });

  assert.equal(outcome.fixed, false);
  assert.equal(outcome.attempts, 2);
  assert.equal(calls, 2, '最大試行回数だけ呼ばれること');
  assert.ok(outcome.finalReasons.length > 0);
});

test('AI 呼び出し失敗 → draft フォールバック（fixed=false, error 有り, attempts=0）', async () => {
  const dirty = makeArticle({ body: `本文に${REVIEW_MARKER}。` });
  const initial = checkArticleSafety(dirty);

  const outcome = await autoFixArticle(dirty, initial, {
    callModel: async () => {
      throw new Error('API error: 529 overloaded');
    },
  });

  assert.equal(outcome.fixed, false);
  assert.equal(outcome.attempts, 0);
  assert.ok(outcome.error && outcome.error.includes('529'));
});

test('不正な JSON 応答 → 元記事を保持し再チェックで落ちてフォールバック', async () => {
  const dirty = makeArticle({ body: `本文に${REVIEW_MARKER}。` });
  const initial = checkArticleSafety(dirty);

  const outcome = await autoFixArticle(dirty, initial, {
    callModel: async () => ({ text: 'すみません、JSONを返せません。' }),
  });

  assert.equal(outcome.fixed, false);
  assert.equal(outcome.attempts, 2);
  assert.ok(outcome.article.body.includes(REVIEW_MARKER), '元本文が保持されていること');
});
