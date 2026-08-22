'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './analytics.module.css';
import admin from './admin.module.css';

// ─────────────────────────────────────────────────────────────
// アクセス分析ダッシュボード（/admin/analytics）。
// 集計は API（/api/admin/analytics）が DB 側 RPC で行い、ここは描画のみ。
// グラフは軽量な自前 SVG（追加ライブラリなし）。
// ─────────────────────────────────────────────────────────────

type Days = 7 | 30 | 90;

interface SummaryCard {
  pv: number;
  visitors: number;
  pvDelta: number | null;
  visitorsDelta: number | null;
}
interface DailyPoint {
  day: string;
  pv: number;
  visitors: number;
}
interface BreakdownItem {
  key: string;
  pv: number;
}
interface TopPost {
  path: string;
  pv: number;
  title: string;
  publishedAt: string | null;
}
interface DashboardResponse {
  available: boolean;
  cards: { today: SummaryCard; d7: SummaryCard; d30: SummaryCard };
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

const CHANNEL_LABELS: Record<string, string> = {
  search: '検索',
  social: 'SNS',
  referral: '参照（他サイト）',
  direct: '直接',
};
const CHANNEL_COLORS: Record<string, string> = {
  search: '#1769ff',
  social: '#ff6a2c',
  referral: '#12a3a3',
  direct: '#8b93a7',
};
const DEVICE_LABELS: Record<string, string> = {
  mobile: 'モバイル',
  desktop: 'PC',
  tablet: 'タブレット',
};
const DEVICE_COLORS: Record<string, string> = {
  mobile: '#1769ff',
  desktop: '#0a4fd8',
  tablet: '#5aa0ff',
};

const nf = new Intl.NumberFormat('ja-JP');

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' → 'M/D' */
function shortDay(day: string): string {
  const parts = day.split('-');
  if (parts.length !== 3) return day;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className={`${styles.delta} ${styles.deltaFlat}`}>—</span>;
  if (value > 0) return <span className={`${styles.delta} ${styles.deltaUp}`}>▲ {value}%</span>;
  if (value < 0) return <span className={`${styles.delta} ${styles.deltaDown}`}>▼ {Math.abs(value)}%</span>;
  return <span className={`${styles.delta} ${styles.deltaFlat}`}>±0%</span>;
}

function Card({ label, card }: { label: string; card: SummaryCard }) {
  return (
    <div className={styles.card}>
      <div className={styles.cardLabel}>{label}</div>
      <div className={styles.cardMain}>
        <span className={styles.cardValue}>{nf.format(card.pv)}</span>
        <span className={styles.cardUnit}>PV</span>
      </div>
      <div className={styles.cardSub}>
        <Delta value={card.pvDelta} />
        <span>訪問者 {nf.format(card.visitors)}</span>
      </div>
    </div>
  );
}

/** 日別 PV の折れ線グラフ（自前 SVG）。 */
function LineChart({ daily }: { daily: DailyPoint[] }) {
  const W = 720;
  const H = 240;
  const padL = 40;
  const padR = 14;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const max = Math.max(1, ...daily.map((d) => d.pv));
  const n = daily.length;
  const x = (i: number) => padL + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  const linePath = daily.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(d.pv).toFixed(1)}`).join(' ');
  const areaPath =
    n > 0
      ? `${linePath} L ${x(n - 1).toFixed(1)} ${(padT + innerH).toFixed(1)} L ${x(0).toFixed(1)} ${(
          padT + innerH
        ).toFixed(1)} Z`
      : '';

  // y 軸の目盛り（0 / 半分 / 最大）
  const yTicks = [0, Math.round(max / 2), max];
  // x 軸ラベル（最大6個に間引く）
  const labelStep = Math.max(1, Math.ceil(n / 6));

  return (
    <div className={styles.chartWrap}>
      <svg className={styles.chart} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="日別PV推移">
        {yTicks.map((t) => (
          <g key={t}>
            <line className={styles.chartGrid} x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} />
            <text className={styles.chartAxis} x={padL - 6} y={y(t) + 3} textAnchor="end">
              {nf.format(t)}
            </text>
          </g>
        ))}
        {areaPath && <path className={styles.chartArea} d={areaPath} />}
        {linePath && <path className={styles.chartLine} d={linePath} />}
        {n <= 31 &&
          daily.map((d, i) => <circle key={d.day} className={styles.chartDot} cx={x(i)} cy={y(d.pv)} r={2.4} />)}
        {daily.map((d, i) =>
          i % labelStep === 0 || i === n - 1 ? (
            <text key={d.day} className={styles.chartAxis} x={x(i)} y={H - 8} textAnchor="middle">
              {shortDay(d.day)}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}

/** 内訳バー（流入元 / デバイス）。 */
function Breakdown({
  items,
  labels,
  colors,
}: {
  items: BreakdownItem[];
  labels: Record<string, string>;
  colors: Record<string, string>;
}) {
  const total = items.reduce((s, it) => s + it.pv, 0);
  if (total === 0) return <div className={styles.empty}>期間内のデータがありません。</div>;
  return (
    <div className={styles.breakdown}>
      {items.map((it) => {
        const ratio = total > 0 ? (it.pv / total) * 100 : 0;
        return (
          <div key={it.key} className={styles.bdRow}>
            <span className={styles.bdLabel}>{labels[it.key] ?? it.key}</span>
            <span className={styles.bdTrack}>
              <span
                className={styles.bdFill}
                style={{ width: `${ratio}%`, background: colors[it.key] ?? '#8b93a7' }}
              />
            </span>
            <span className={styles.bdValue}>
              {nf.format(it.pv)}
              <span className={styles.bdValueSub}>{ratio.toFixed(0)}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsClient() {
  const [days, setDays] = useState<Days>(30);
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (d: Days) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/analytics?days=${d}`, { cache: 'no-store' });
      if (res.status === 401) {
        setError('セッションが切れました。再度ログインしてください。');
        return;
      }
      if (!res.ok) {
        setError('分析データの取得に失敗しました。');
        return;
      }
      setData(await res.json());
    } catch {
      setError('分析データの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(days);
  }, [days, load]);

  const totalPv = useMemo(() => {
    if (!data) return 0;
    return data.cards.today.pv + data.cards.d7.pv + data.cards.d30.pv + data.range.pv;
  }, [data]);

  const hasData = data?.available && totalPv > 0;

  const RANGES: { key: Days; label: string }[] = [
    { key: 7, label: '7日' },
    { key: 30, label: '30日' },
    { key: 90, label: '90日' },
  ];

  return (
    <>
      <div className={admin.pageHead}>
        <div>
          <h1 className={admin.pageTitle}>アクセス分析</h1>
          <p className={admin.pageDesc}>公開サイトの閲覧状況（PV・訪問者・流入元・デバイス）を集計します。</p>
        </div>
      </div>

      {error && <div className={`${admin.notice} ${admin.noticeErr}`}>{error}</div>}

      {loading && !data ? (
        <div className={styles.empty}>読み込み中…</div>
      ) : !hasData ? (
        <div className={styles.panel}>
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>計測開始待ちです</div>
            まだアクセスデータがありません。公開サイトへの訪問が記録されると、ここに PV・訪問者・流入元などが表示されます。
            <br />
            （計測テーブル未作成の場合は、マイグレーション 0003 を適用してください。）
          </div>
        </div>
      ) : (
        <>
          {/* サマリーカード */}
          <div className={styles.cards}>
            <Card label="今日" card={data!.cards.today} />
            <Card label="直近7日" card={data!.cards.d7} />
            <Card label="直近30日" card={data!.cards.d30} />
          </div>

          {/* PV 推移グラフ */}
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>PV推移</h2>
              <span className={styles.panelSpacer} />
              <div className={styles.segmented}>
                {RANGES.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    className={`${styles.segBtn} ${days === r.key ? styles.segBtnActive : ''}`}
                    onClick={() => setDays(r.key)}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <LineChart daily={data!.range.daily} />
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={styles.legendSwatch} style={{ background: 'var(--blue)' }} />
                日別PV（期間合計 {nf.format(data!.range.pv)}／訪問者 {nf.format(data!.range.visitors)}）
              </span>
            </div>
          </div>

          {/* 流入元・デバイス内訳 */}
          <div className={styles.grid2}>
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>流入元の内訳</h2>
              </div>
              <Breakdown items={data!.range.channels} labels={CHANNEL_LABELS} colors={CHANNEL_COLORS} />
            </div>
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>デバイス別の内訳</h2>
              </div>
              <Breakdown items={data!.range.devices} labels={DEVICE_LABELS} colors={DEVICE_COLORS} />
            </div>
          </div>

          {/* /contact 到達数 ＋ 記事別ランキング */}
          <div className={styles.grid2}>
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>お問い合わせページ到達数</h2>
              </div>
              <div className={styles.cardMain}>
                <span className={styles.cardValue}>{nf.format(data!.range.contact)}</span>
                <span className={styles.cardUnit}>件（直近{days}日・/contact のPV）</span>
              </div>
            </div>
            <div className={styles.panel}>
              <div className={styles.panelHead}>
                <h2 className={styles.panelTitle}>記事別ランキング（直近{days}日）</h2>
              </div>
              {data!.range.topPosts.length === 0 ? (
                <div className={styles.empty}>期間内に閲覧された記事がありません。</div>
              ) : (
                <table className={styles.rankTable}>
                  <thead>
                    <tr>
                      <th className={styles.rankNum}>#</th>
                      <th>記事</th>
                      <th style={{ textAlign: 'right' }}>PV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.range.topPosts.map((p, i) => (
                      <tr key={p.path}>
                        <td className={styles.rankNum}>{i + 1}</td>
                        <td>
                          <div className={styles.rankTitle}>{p.title}</div>
                          <div className={styles.rankPath}>
                            {p.path}
                            {p.publishedAt ? ` ・ ${formatDate(p.publishedAt)}` : ''}
                          </div>
                        </td>
                        <td className={styles.rankPv}>{nf.format(p.pv)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
