import Anthropic from '@anthropic-ai/sdk';
import { buildCompanyContext } from '@/lib/blog/company-context';
import { services } from '@/lib/data';
import { buildTopicCandidates } from '@/lib/blog/topic-queue';

// ─────────────────────────────────────────────────────────────
// 手動生成ダイアログ用のテーマ候補生成（サーバー専用）。
// Sonnet で 6〜8 件のテーマ案を出し、既存タイトルとの重複を避ける。
// ANTHROPIC_API_KEY 未設定時は、ローテーション候補（topic-queue）からの
// フォールバックを返す（API を消費しない）。
// ─────────────────────────────────────────────────────────────

/** テーマ候補（クリックで生成フォームを丸ごと埋められる形） */
export interface TopicSuggestion {
  theme: string;
  keywords: string;
  audience: string;
  purpose: string;
  service: string;
}

export interface SuggestTopicsResult {
  ok: boolean;
  /** true=APIキー未設定でローテーション候補を返した */
  stub: boolean;
  topics: TopicSuggestion[];
  error?: string;
}

/** 使用モデル（テーマ提案は軽量な Sonnet を使う） */
const SUGGEST_MODEL = 'claude-sonnet-5';
const SUGGEST_MAX_TOKENS = 1500;

/** ローテーション候補から既存を避けて suggestion を作る（フォールバック/最終手段） */
function fallbackTopics(existingTitles: string[], count = 8): TopicSuggestion[] {
  const existing = new Set(existingTitles.map((t) => t.trim()));
  const candidates = buildTopicCandidates();
  const picked: TopicSuggestion[] = [];
  for (const c of candidates) {
    if (existing.has(c.theme.trim())) continue;
    picked.push({
      theme: c.theme,
      keywords: c.keywords,
      audience: c.audience,
      purpose: c.purpose,
      service: c.service,
    });
    if (picked.length >= count) break;
  }
  // すべて既存だった場合でも空にせず、先頭から埋める
  if (picked.length === 0) {
    return candidates.slice(0, count).map((c) => ({
      theme: c.theme,
      keywords: c.keywords,
      audience: c.audience,
      purpose: c.purpose,
      service: c.service,
    }));
  }
  return picked;
}

function extractJsonArray(text: string): unknown {
  try {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return null;
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function normalize(raw: unknown): TopicSuggestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const e = (item ?? {}) as Record<string, unknown>;
      return {
        theme: String(e.theme ?? '').trim(),
        keywords: String(e.keywords ?? '').trim(),
        audience: String(e.audience ?? '中小企業の経営者').trim(),
        purpose: String(e.purpose ?? '').trim(),
        service: String(e.service ?? '').trim(),
      };
    })
    .filter((t) => t.theme)
    .slice(0, 8);
}

/**
 * テーマ候補を 6〜8 件返す。
 * @param existingTitles 既存記事タイトル（重複回避に使う）
 */
export async function suggestTopics(existingTitles: string[]): Promise<SuggestTopicsResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ok: true, stub: true, topics: fallbackTopics(existingTitles) };
  }

  const serviceList = services.map((s) => `${s.title}（/services/${s.slug}）`).join('、');
  const avoid = existingTitles.length
    ? existingTitles.map((t) => `・${t}`).join('\n')
    : '（まだ記事はありません）';

  const system = [
    'あなたは、中小企業向けにWeb集客・広告・AI活用・採用支援を提供する会社「REVANS」のオウンドメディア編集者です。',
    '次の「根拠データ」に基づき、中小企業の経営者が検索しそうな実用的な記事テーマ案を6〜8件提案してください。',
    '',
    '━━━ 根拠データ ━━━',
    buildCompanyContext(),
    '',
    `━━━ 扱えるサービス領域 ━━━\n${serviceList}`,
    '',
    '━━━ すでにある記事タイトル（これらと重複・酷似するテーマは避ける） ━━━',
    avoid,
    '',
    '━━━ 各テーマの条件 ━━━',
    '・1テーマ＝1検索意図。誇大表現や根拠データに無い数値・実績は使わない。',
    '・audience は原則「中小企業の経営者」。purpose は記事の狙いを一文で。',
    '・keywords は対策キーワードをカンマ区切りで3〜5語。service は上記サービス領域のいずれかの名称。',
    '',
    '━━━ 出力形式（厳守） ━━━',
    '次のJSON配列のみを出力すること。前置き・後書き・コードフェンス（```）は付けない。',
    '[',
    '  { "theme": "テーマ", "keywords": "キーワード1, キーワード2", "audience": "中小企業の経営者", "purpose": "記事の狙い", "service": "サービス領域名" }',
    ']',
  ].join('\n');

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: SUGGEST_MODEL,
      max_tokens: SUGGEST_MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: '上記条件でテーマ案をJSON配列のみで出力してください。' }],
    });

    const first = response.content[0];
    const text = first && first.type === 'text' ? first.text : '';
    const topics = normalize(extractJsonArray(text));

    if (topics.length === 0) {
      return { ok: true, stub: false, topics: fallbackTopics(existingTitles) };
    }
    return { ok: true, stub: false, topics };
  } catch (error) {
    console.error('[admin] suggestTopics failed:', error);
    // 失敗してもフォールバックで候補は返す（UI を空にしない）
    return {
      ok: true,
      stub: true,
      topics: fallbackTopics(existingTitles),
      error: `テーマAI提案に失敗したため、既定候補を表示しています: ${(error as Error).message}`,
    };
  }
}
