import { getServiceSupabase } from '@/lib/blog/supabase';

// ─────────────────────────────────────────────────────────────
// アクセス分析の集計取得（サーバー専用・service_role）。
//
// 集計は必ず DB 側（RPC / SQL）で行い、全行をアプリに引いて JS で集計しない。
// マイグレーション 0003 未適用（RPC 未作成）や DB 未接続でも例外を投げず、
// 空の集計を返す（呼び出し側は「計測開始待ち」を表示する）。
//
// 日別の区切り・日付は日本時間（Asia/Tokyo, UTC+9・DST 無し）で扱う。
// ─────────────────────────────────────────────────────────────

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PeriodTotals {
  pv: number;
  visitors: number;
  contact: number;
}

export interface SummaryCard {
  pv: number;
  visitors: number;
  /** 前期間比（％）。前期間が 0 のときは null（表示側で「—」）。 */
  pvDelta: number | null;
  visitorsDelta: number | null;
}

export interface DailyPoint {
  day: string; // 'YYYY-MM-DD'（JST）
  pv: number;
  visitors: number;
}

export interface BreakdownItem {
  key: string;
  pv: number;
}

export interface TopPost {
  path: string;
  pv: number;
}

export interface AnalyticsDashboard {
  /** RPC が使えた（＝計測基盤が有効）か。false のときは 0 件案内を出す。 */
  available: boolean;
  cards: {
    today: SummaryCard;
    d7: SummaryCard;
    d30: SummaryCard;
  };
  range: {
    days: number;
    pv: number;
    visitors: number;
    contact: number;
    daily: DailyPoint[];
    channels: BreakdownItem[];
    devices: BreakdownItem[];
    topPosts: TopPost[];
  };
}

/** JST 当日の 0:00 を指す UTC 時刻（offsetDays 日ずらす）。 */
function jstMidnight(nowMs: number, offsetDays: number): Date {
  const shifted = nowMs + JST_OFFSET_MS;
  const dayStart = Math.floor(shifted / DAY_MS) * DAY_MS;
  return new Date(dayStart - JST_OFFSET_MS + offsetDays * DAY_MS);
}

const iso = (d: Date) => d.toISOString();

function pct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function toTotals(raw: unknown): PeriodTotals {
  const o = (raw ?? {}) as { pv?: unknown; visitors?: unknown; contact?: unknown };
  return {
    pv: Number(o.pv) || 0,
    visitors: Number(o.visitors) || 0,
    contact: Number(o.contact) || 0,
  };
}

/** RPC analytics_totals を1回呼ぶ。失敗時は null（RPC 未作成の判定に使う）。 */
async function fetchTotals(
  supabase: NonNullable<ReturnType<typeof getServiceSupabase>>,
  start: Date,
  end: Date,
): Promise<PeriodTotals | null> {
  const { data, error } = await supabase.rpc('analytics_totals', {
    p_start: iso(start),
    p_end: iso(end),
  });
  if (error) {
    console.error('[analytics] analytics_totals failed:', error.message);
    return null;
  }
  return toTotals(data);
}

function emptyCard(): SummaryCard {
  return { pv: 0, visitors: 0, pvDelta: null, visitorsDelta: null };
}

function emptyDashboard(days: number): AnalyticsDashboard {
  return {
    available: false,
    cards: { today: emptyCard(), d7: emptyCard(), d30: emptyCard() },
    range: { days, pv: 0, visitors: 0, contact: 0, daily: [], channels: [], devices: [], topPosts: [] },
  };
}

function toBreakdown(raw: unknown, keyName: 'channel' | 'device'): BreakdownItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      const o = (it ?? {}) as Record<string, unknown>;
      return { key: String(o[keyName] ?? ''), pv: Number(o.pv) || 0 };
    })
    .filter((it) => it.key);
}

/** JST の [start, end) を1日刻みで埋め、集計に無い日は 0 で補完する（表示用の穴埋め）。 */
function fillDaily(rows: DailyPoint[], start: Date, nowMs: number): DailyPoint[] {
  const map = new Map(rows.map((r) => [r.day, r]));
  const out: DailyPoint[] = [];
  const startShifted = Math.floor((start.getTime() + JST_OFFSET_MS) / DAY_MS) * DAY_MS;
  const endShifted = Math.floor((nowMs + JST_OFFSET_MS) / DAY_MS) * DAY_MS;
  for (let t = startShifted; t <= endShifted; t += DAY_MS) {
    const d = new Date(t);
    const day = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
      d.getUTCDate(),
    ).padStart(2, '0')}`;
    out.push(map.get(day) ?? { day, pv: 0, visitors: 0 });
  }
  return out;
}

/**
 * ダッシュボードに必要な集計を一括取得する。
 * ・カード（今日 / 7日 / 30日）: analytics_totals を現在・前期間で計6回。
 * ・選択期間の詳細: analytics_detail を1回。
 * すべて並列。RPC 未作成なら available:false の空集計を返す。
 */
export async function getAnalyticsDashboard(days: number, nowMs: number): Promise<AnalyticsDashboard> {
  const supabase = getServiceSupabase();
  if (!supabase) return emptyDashboard(days);

  const now = new Date(nowMs);
  const todayStart = jstMidnight(nowMs, 0);
  const yesterdayStart = jstMidnight(nowMs, -1);
  const d7Start = new Date(nowMs - 7 * DAY_MS);
  const d7PrevStart = new Date(nowMs - 14 * DAY_MS);
  const d30Start = new Date(nowMs - 30 * DAY_MS);
  const d30PrevStart = new Date(nowMs - 60 * DAY_MS);
  const rangeStart = new Date(nowMs - days * DAY_MS);

  const [
    todayCur,
    todayPrev,
    d7Cur,
    d7Prev,
    d30Cur,
    d30Prev,
    rangeTotals,
    detailRes,
  ] = await Promise.all([
    fetchTotals(supabase, todayStart, now),
    fetchTotals(supabase, yesterdayStart, todayStart),
    fetchTotals(supabase, d7Start, now),
    fetchTotals(supabase, d7PrevStart, d7Start),
    fetchTotals(supabase, d30Start, now),
    fetchTotals(supabase, d30PrevStart, d30Start),
    fetchTotals(supabase, rangeStart, now),
    supabase.rpc('analytics_detail', { p_start: iso(rangeStart), p_end: iso(now), p_top: 10 }),
  ]);

  // どれか1つでも RPC が成功していれば「基盤あり」とみなす
  const available =
    todayCur !== null || d7Cur !== null || d30Cur !== null || rangeTotals !== null || !detailRes.error;
  if (!available) return emptyDashboard(days);

  const card = (cur: PeriodTotals | null, prev: PeriodTotals | null): SummaryCard => {
    const c = cur ?? { pv: 0, visitors: 0, contact: 0 };
    const p = prev ?? { pv: 0, visitors: 0, contact: 0 };
    return {
      pv: c.pv,
      visitors: c.visitors,
      pvDelta: pct(c.pv, p.pv),
      visitorsDelta: pct(c.visitors, p.visitors),
    };
  };

  const detail = (detailRes.error ? {} : detailRes.data ?? {}) as {
    daily?: unknown;
    channels?: unknown;
    devices?: unknown;
    topPosts?: unknown;
  };

  const dailyRaw: DailyPoint[] = Array.isArray(detail.daily)
    ? (detail.daily as unknown[]).map((it) => {
        const o = (it ?? {}) as Record<string, unknown>;
        return { day: String(o.day ?? ''), pv: Number(o.pv) || 0, visitors: Number(o.visitors) || 0 };
      })
    : [];

  const daily = fillDaily(dailyRaw, rangeStart, nowMs);
  const rt = rangeTotals ?? { pv: daily.reduce((s, d) => s + d.pv, 0), visitors: 0, contact: 0 };

  return {
    available: true,
    cards: {
      today: card(todayCur, todayPrev),
      d7: card(d7Cur, d7Prev),
      d30: card(d30Cur, d30Prev),
    },
    range: {
      days,
      pv: rt.pv,
      // 期間全体のユニーク訪問者は日別合計と一致しないため、期間 totals の値を使う
      visitors: rt.visitors,
      contact: rt.contact,
      daily,
      channels: toBreakdown(detail.channels, 'channel'),
      devices: toBreakdown(detail.devices, 'device'),
      topPosts: Array.isArray(detail.topPosts)
        ? (detail.topPosts as unknown[])
            .map((it) => {
              const o = (it ?? {}) as Record<string, unknown>;
              return { path: String(o.path ?? ''), pv: Number(o.pv) || 0 };
            })
            .filter((t) => t.path)
        : [],
    },
  };
}

/**
 * 記事パス別の PV マップを取得する（記事一覧の「30日PV」列用）。
 * 返り値: { '/blog/slug': 12, ... }。RPC 未作成・未接続時は空オブジェクト。
 */
export async function getPostPvMap(days: number, nowMs: number): Promise<Record<string, number>> {
  const supabase = getServiceSupabase();
  if (!supabase) return {};

  const start = new Date(nowMs - days * DAY_MS);
  const { data, error } = await supabase.rpc('analytics_post_pv', {
    p_start: iso(start),
    p_end: new Date(nowMs).toISOString(),
  });
  if (error || !data || typeof data !== 'object') {
    if (error) console.error('[analytics] analytics_post_pv failed:', error.message);
    return {};
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) out[k] = Number(v) || 0;
  return out;
}
