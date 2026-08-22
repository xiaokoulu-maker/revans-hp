import { buildTopicCandidates } from '@/lib/blog/topic-queue';

// ─────────────────────────────────────────────────────────────
// 投稿予定（カレンダー）の算出。
//
// 週次 cron は vercel.json の "0 0 * * 1"（毎週月曜 00:00 UTC ＝ 09:00 JST）で
// 1本ずつ生成する。ここでは「今後どのテーマがいつ生成されるか」を予測して返す。
//
// 予測ロジックは topic-queue.pickTopic と同じ考え方:
//   各月曜の weekIndex を起点に、既存/予定済み slugBase を避けて次のテーマを選ぶ。
// 実際の生成では生成順に slug が増えるため、この一覧はあくまで予定プレビュー。
//
// 日付は UTC で扱う（cron が月曜 00:00 UTC ＝ JST の月曜当日9時に対応するため、
// UTC の年月日 = JST の月曜のカレンダー日付になる）。
// ─────────────────────────────────────────────────────────────

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ScheduledPost {
  /** 生成予定日（ISO・月曜 00:00 UTC） */
  date: string;
  theme: string;
  service: string;
  slugBase: string;
  /** すでに同 slugBase の記事が存在する（生成済み見込み） */
  alreadyExists: boolean;
}

/** now 以降で最初に到来する「月曜 00:00 UTC」を返す（今日が月曜でも既に過ぎていれば翌週）。 */
function nextMonday(now: Date): Date {
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const day = new Date(midnight).getUTCDay(); // 0=日..6=土
  const offset = (1 - day + 7) % 7; // 月曜までの日数
  let monday = midnight + offset * MS_PER_DAY;
  if (monday <= now.getTime()) monday += MS_PER_WEEK;
  return new Date(monday);
}

/**
 * 今後 weeks 週分の生成予定を返す。
 * @param weeks 予定を出す週数
 * @param existingSlugs 既存記事の slug 一覧（重複回避＝生成済み判定に使う）
 */
export function upcomingSchedule(
  weeks: number,
  existingSlugs: string[] = [],
  now: Date = new Date(),
): ScheduledPost[] {
  const topics = buildTopicCandidates();
  if (topics.length === 0) return [];

  const existing = new Set(existingSlugs);
  const used = new Set(existingSlugs);
  const result: ScheduledPost[] = [];

  let monday = nextMonday(now);
  const count = Math.max(1, Math.min(weeks, 52));

  for (let i = 0; i < count; i += 1) {
    const start = Math.floor(monday.getTime() / MS_PER_WEEK) % topics.length;
    let chosen = topics[start];
    for (let j = 0; j < topics.length; j += 1) {
      const candidate = topics[(start + j) % topics.length];
      if (!used.has(candidate.slugBase)) {
        chosen = candidate;
        break;
      }
    }
    used.add(chosen.slugBase);
    result.push({
      date: monday.toISOString(),
      theme: chosen.theme,
      service: chosen.service,
      slugBase: chosen.slugBase,
      alreadyExists: existing.has(chosen.slugBase),
    });
    monday = new Date(monday.getTime() + MS_PER_WEEK);
  }

  return result;
}
