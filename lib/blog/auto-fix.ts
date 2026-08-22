import {
  REVIEW_MARKER,
  type GeneratedArticle,
} from '@/lib/blog/generate-prompt';
import { checkArticleSafety, type SafetyCheckResult } from '@/lib/blog/safety-check';
import type { GenerationUsage } from '@/lib/blog/generate-article';

// ─────────────────────────────────────────────────────────────
// 生成記事の自動修正パス（サーバー専用）。
//
// 週次 cron の safety-check で needsReview=true になった記事に対し、公開前に
// もう1パス AI で修正を試みる。修正後に再度 safety-check を通ればクリーンとして
// 公開できる。2回試しても通らない／AI 呼び出し自体が失敗した場合は、修正せず
// draft 据え置き（＝現状挙動へのフォールバック）にする。
//
// 適用範囲は cron 経由の自動生成のみ。generate-prompt.ts（生成プロンプト本体）と
// safety-check.ts（検出ロジック）自体は一切変更しない。このファイルは検出後の
// 「修正の追加」だけを担う。
//
// 【テスト容易性】Anthropic SDK はこのファイルの import では読み込まず、実 AI を
// 呼ぶ defaultCallModel の中で動的 import する。これにより autoFixArticle は
// deps.callModel をモックすれば SDK 抜きで単体テストできる。
// ─────────────────────────────────────────────────────────────

/** 自動修正に使うモデル。BLOG_AUTOFIX_MODEL で上書き可。既定は Sonnet 4.6。 */
export function getAutoFixModel(): string {
  const override = process.env.BLOG_AUTOFIX_MODEL?.trim();
  return override && override.length > 0 ? override : 'claude-sonnet-4-6';
}

/** 出力トークン上限。生成本体と同等（記事全体を返させるため）。 */
export const AUTOFIX_MAX_TOKENS = 12000;

/**
 * 修正モデル（Sonnet 4.6）の100万トークンあたり単価（USD）。差し替えはここ1箇所。
 * ※ BLOG_AUTOFIX_MODEL で別モデルに変えた場合、コスト概算はこの単価での目安になる。
 */
export const AUTOFIX_PRICE_PER_MTOK = { input: 3, output: 15 } as const;

/** 修正試行の最大回数。これを超えて safety-check を通らなければ draft 据え置き。 */
export const AUTOFIX_MAX_ATTEMPTS = 2;

/** callModel の返り値（AI 1回分のテキストと usage）。 */
export interface AutoFixModelResult {
  /** AI 応答テキスト（修正後記事の JSON を想定） */
  text: string;
  /** トークン使用量・コスト概算（省略時は 0 埋め） */
  usage?: GenerationUsage;
}

/** テストで差し替え可能な依存。 */
export interface AutoFixDeps {
  /** AI を1回呼び、修正後記事の JSON テキストと usage を返す */
  callModel: (system: string, user: string) => Promise<AutoFixModelResult>;
  /** 安全チェック関数（既定 checkArticleSafety）。テスト差し替え用。 */
  check: (article: Partial<GeneratedArticle>) => SafetyCheckResult;
}

/** 自動修正の結果。cron 側のログ・レスポンス・公開判定に使う。 */
export interface AutoFixOutcome {
  /** 自動修正を試みたか（この関数は常に true。呼ばれた時点で needsReview 前提） */
  attempted: boolean;
  /** true=修正後クリーンになり公開可能。false=通らず draft 据え置き。 */
  fixed: boolean;
  /** 実際に走らせた修正回数（AI 失敗時は 0） */
  attempts: number;
  /** 最終記事（fixed=true なら修正済み、false なら最後の状態） */
  article: GeneratedArticle;
  /** 検出された理由（初回） */
  initialReasons: string[];
  /** 最終チェックで残った理由（fixed=true なら空） */
  finalReasons: string[];
  /** 検出種別（ログ用）。marker=[要確認] / price=金額表現。 */
  detected: { marker: boolean; price: boolean };
  /** 各修正試行の usage */
  usages: GenerationUsage[];
  /** usage 合計の概算コスト（USD） */
  totalCostUsd: number;
  /** AI 呼び出しが失敗した場合の説明（成功時 undefined） */
  error?: string;
}

const ZERO_USAGE: GenerationUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputTokens: 0,
  estimatedCostUsd: 0,
};

/** 応答テキストから最初の JSON オブジェクトを防御的に抽出する。 */
function extractJson(text: string): unknown {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

/** usage（snake_case）→ GenerationUsage（Sonnet 単価で概算）。 */
function toAutoFixUsage(usage: {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}): GenerationUsage {
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheCreationInputTokens = usage.cache_creation_input_tokens ?? 0;
  const cacheReadInputTokens = usage.cache_read_input_tokens ?? 0;

  const cost =
    ((inputTokens + cacheCreationInputTokens) * AUTOFIX_PRICE_PER_MTOK.input +
      cacheReadInputTokens * AUTOFIX_PRICE_PER_MTOK.input * 0.1 +
      outputTokens * AUTOFIX_PRICE_PER_MTOK.output) /
    1_000_000;

  return {
    inputTokens,
    outputTokens,
    cacheCreationInputTokens,
    cacheReadInputTokens,
    estimatedCostUsd: Math.round(cost * 10000) / 10000,
  };
}

/** 修正指示（system プロンプト）を組み立てる。生成プロンプト本体には手を入れない。 */
export function buildAutoFixSystemPrompt(): string {
  return [
    'あなたは、中小企業向けWeb集客会社「REVANS」のオウンドメディア記事を校正する日本語の編集者です。',
    '与えられた記事JSONには、公開前に確認が必要な箇所が含まれています。以下のルールに従い、記事を安全に公開できる状態へ最小限の修正だけを行ってください。',
    '',
    '━━━ 修正ルール ━━━',
    `1. 「${REVIEW_MARKER}」というマーカーとその対象箇所を、削除するか、安全な一般表現に書き直すこと（「〜が一般的です」「〜の場合があります」等の非断定表現にする）。マーカー文字列「${REVIEW_MARKER}」は本文中に一切残さないこと。`,
    '2. 具体的な金額・価格（○円／○万円 等の数字を伴う金額表現）は、「業者や条件により異なります」「内容に応じた個別見積りです」等の非断定表現に置換するか、削除すること。金額の数字を本文中に残さないこと。',
    '3. 記事の他の部分・全体の構成・見出し・文字数の分量感は極力変えないこと。修正は該当箇所に限定する。',
    '4. 新しい事実・数値・料金額・実績・会社情報を新たに追加しないこと。あくまで問題箇所の除去・言い換えのみを行う。',
    '',
    '━━━ 出力形式（厳守） ━━━',
    '修正後の記事を、次のキーを持つJSONオブジェクトのみで出力すること。前置き・後書き・コードフェンス（```）は一切付けない。',
    '各テキストフィールドは修正後の全文を返すこと（省略しない）。',
    '{',
    '  "title": "記事タイトル",',
    '  "seoTitle": "検索結果用タイトル",',
    '  "metaDescription": "検索結果用の説明文",',
    '  "intro": "導入文",',
    '  "body": "本文Markdown",',
    '  "summary": "まとめ",',
    '  "ctaText": "問い合わせ誘導文",',
    '  "faq": [{ "question": "質問", "answer": "回答" }]',
    '}',
  ].join('\n');
}

/** 修正対象の記事＋検出理由を user メッセージにまとめる。 */
export function buildAutoFixUserPrompt(article: GeneratedArticle, reasons: string[]): string {
  const payload = {
    title: article.title,
    seoTitle: article.seoTitle,
    metaDescription: article.metaDescription,
    intro: article.intro,
    body: article.body,
    summary: article.summary,
    ctaText: article.ctaText,
    faq: article.faq,
  };
  return [
    '次の記事に、公開前の確認が必要な箇所が検出されました。',
    `検出理由: ${reasons.length ? reasons.join(' / ') : '（詳細不明）'}`,
    '',
    '対象記事（JSON）:',
    JSON.stringify(payload, null, 2),
    '',
    '上記の修正ルールに従い、修正後の記事をJSONのみで出力してください。',
  ].join('\n');
}

/**
 * AI が返した修正JSONを元記事にマージする。
 * ・返ってきたフィールドだけを差し替え、欠損時は元の値を保持する（安全側）。
 * ・slug / headings は元記事の値を維持する（構造は変えない）。
 */
function mergeFixedArticle(
  original: GeneratedArticle,
  fix: Record<string, unknown>,
): GeneratedArticle {
  const str = (key: keyof GeneratedArticle): string => {
    const v = fix[key as string];
    return typeof v === 'string' && v.trim() ? v.trim() : (original[key] as string);
  };

  const faq = Array.isArray(fix.faq)
    ? fix.faq
        .map((item: unknown) => {
          const e = (item ?? {}) as { question?: unknown; answer?: unknown };
          return { question: String(e.question ?? '').trim(), answer: String(e.answer ?? '').trim() };
        })
        .filter((e) => e.question && e.answer)
    : original.faq;

  return {
    ...original,
    title: str('title'),
    seoTitle: str('seoTitle'),
    metaDescription: str('metaDescription'),
    intro: str('intro'),
    body: str('body'),
    summary: str('summary'),
    ctaText: str('ctaText'),
    faq,
    // slug / headings は据え置き（構造・URL を変えない）
    slug: original.slug,
    headings: original.headings,
  };
}

/** 実 AI を呼ぶ既定の callModel。SDK はここでだけ動的 import する。 */
async function defaultCallModel(system: string, user: string): Promise<AutoFixModelResult> {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: getAutoFixModel(),
    max_tokens: AUTOFIX_MAX_TOKENS,
    // temperature は送らない（トーンはプロンプトで担保。Opus 系との整合も取る）。
    system,
    messages: [{ role: 'user', content: user }],
  });

  const first = response.content[0];
  const text = first && first.type === 'text' ? first.text : '';
  return { text, usage: toAutoFixUsage(response.usage ?? {}) };
}

/**
 * needsReview の記事に対し、公開前の自動修正を最大 AUTOFIX_MAX_ATTEMPTS 回まで試みる。
 *
 * ・毎回 AI に修正させ、マージした記事を再度 safety-check にかける。
 * ・クリーンになれば fixed:true で即返す（公開可能）。
 * ・全試行で通らなければ fixed:false（draft 据え置き）。
 * ・AI 呼び出しが例外を投げたら fixed:false + error（draft 据え置き）。例外は投げない。
 */
export async function autoFixArticle(
  article: GeneratedArticle,
  initial: SafetyCheckResult,
  deps: Partial<AutoFixDeps> = {},
): Promise<AutoFixOutcome> {
  const check = deps.check ?? checkArticleSafety;
  const callModel = deps.callModel ?? defaultCallModel;

  const initialReasons = initial.reasons ?? [];
  const detected = {
    marker: initialReasons.some((r) => r.includes(REVIEW_MARKER)),
    price: initialReasons.some((r) => r.includes('金額')),
  };

  const usages: GenerationUsage[] = [];
  let current = article;
  let reasons = initialReasons;

  for (let attempt = 1; attempt <= AUTOFIX_MAX_ATTEMPTS; attempt += 1) {
    let result: AutoFixModelResult;
    try {
      result = await callModel(buildAutoFixSystemPrompt(), buildAutoFixUserPrompt(current, reasons));
    } catch (error) {
      // AI 呼び出し自体が失敗 → 修正できず draft 据え置き（cron 全体は失敗させない）。
      const totalCostUsd = round4(usages.reduce((s, u) => s + u.estimatedCostUsd, 0));
      console.error(
        `[blog] auto-fix aborted (AI error) | detected=${describeDetected(detected)} attempts=${attempt - 1} | ${(error as Error).message}`,
      );
      return {
        attempted: true,
        fixed: false,
        attempts: attempt - 1,
        article: current,
        initialReasons,
        finalReasons: reasons,
        detected,
        usages,
        totalCostUsd,
        error: (error as Error).message || 'AI呼び出しに失敗しました。',
      };
    }

    usages.push(result.usage ?? ZERO_USAGE);

    const parsed = extractJson(result.text);
    if (parsed && typeof parsed === 'object') {
      current = mergeFixedArticle(current, parsed as Record<string, unknown>);
    }
    // JSON を取り出せなければ current は据え置き → 再チェックで落ちて次試行 or フォールバック。

    const recheck = check(current);
    if (!recheck.needsReview) {
      const totalCostUsd = round4(usages.reduce((s, u) => s + u.estimatedCostUsd, 0));
      console.info(
        `[blog] auto-fix ok | detected=${describeDetected(detected)} attempts=${attempt} est=$${totalCostUsd}`,
      );
      return {
        attempted: true,
        fixed: true,
        attempts: attempt,
        article: current,
        initialReasons,
        finalReasons: [],
        detected,
        usages,
        totalCostUsd,
      };
    }
    reasons = recheck.reasons;
  }

  const totalCostUsd = round4(usages.reduce((s, u) => s + u.estimatedCostUsd, 0));
  console.info(
    `[blog] auto-fix failed (draft kept) | detected=${describeDetected(detected)} attempts=${AUTOFIX_MAX_ATTEMPTS} remaining="${reasons.join(' / ')}" est=$${totalCostUsd}`,
  );
  return {
    attempted: true,
    fixed: false,
    attempts: AUTOFIX_MAX_ATTEMPTS,
    article: current,
    initialReasons,
    finalReasons: reasons,
    detected,
    usages,
    totalCostUsd,
  };
}

function describeDetected(d: { marker: boolean; price: boolean }): string {
  const parts: string[] = [];
  if (d.marker) parts.push('marker');
  if (d.price) parts.push('price');
  return parts.length ? parts.join('+') : 'none';
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
