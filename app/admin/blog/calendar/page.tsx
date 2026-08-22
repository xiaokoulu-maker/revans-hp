'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import styles from '@/components/admin/admin.module.css';
import type { ScheduledPost } from '@/lib/blog/schedule';

const DOW = ['日', '月', '火', '水', '木', '金', '土'];
const WEEK_OPTIONS = [4, 8, 12];

/** ISO 日付を JST 相当の UTC 年月日で扱うためのキー */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

/** 現在の JST 日付（UTC パーツで読む） */
function jstNow(): { year: number; month: number; day: number } {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

export default function AdminCalendarPage() {
  const [weeks, setWeeks] = useState(12);
  const [schedule, setSchedule] = useState<ScheduledPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const today = jstNow();
  const [view, setView] = useState<{ year: number; month: number }>({ year: today.year, month: today.month });

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/admin/calendar?weeks=${weeks}`, { cache: 'no-store' });
        if (res.status === 401) {
          setError('セッションが切れました。再度ログインしてください。');
          return;
        }
        if (!res.ok) {
          setError('予定の取得に失敗しました。');
          return;
        }
        const data = await res.json();
        setSchedule(data.schedule ?? []);
      } catch {
        setError('予定の取得に失敗しました。');
      } finally {
        setLoading(false);
      }
    })();
  }, [weeks]);

  const byDay = useMemo(() => {
    const map = new Map<string, ScheduledPost>();
    for (const s of schedule) map.set(dayKey(s.date), s);
    return map;
  }, [schedule]);

  // 表示月のセル（UTC 基準で生成し、キーも UTC で突合）
  const cells = useMemo(() => {
    const first = new Date(Date.UTC(view.year, view.month, 1));
    const startDow = first.getUTCDay();
    const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < startDow; i += 1) arr.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) arr.push(d);
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [view]);

  const shiftMonth = (delta: number) => {
    setView((v) => {
      const m = v.month + delta;
      const year = v.year + Math.floor(m / 12);
      const month = ((m % 12) + 12) % 12;
      return { year, month };
    });
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')}（月）`;
  };

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.pageTitle}>投稿カレンダー</h1>
          <p className={styles.pageDesc}>週次自動生成（毎週月曜 9:00 JST）の予定プレビューです。</p>
        </div>
        <div className={styles.headActions}>
          <div className={styles.weekBtns}>
            {WEEK_OPTIONS.map((w) => (
              <button
                key={w}
                type="button"
                className={`${styles.weekBtn} ${weeks === w ? styles.weekBtnActive : ''}`}
                onClick={() => setWeeks(w)}
              >
                {w}週
              </button>
            ))}
          </div>
          <Link href="/admin/blog" className={styles.btn}>
            記事一覧
          </Link>
        </div>
      </div>

      {error && <div className={`${styles.notice} ${styles.noticeErr}`}>{error}</div>}

      <div className={styles.panel}>
        <div className={styles.calNav}>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => shiftMonth(-1)}>
            ← 前の月
          </button>
          <span className={styles.calMonth}>
            {view.year}年{view.month + 1}月
          </span>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => shiftMonth(1)}>
            次の月 →
          </button>
        </div>

        <div className={styles.calGrid}>
          {DOW.map((d) => (
            <div key={d} className={styles.calDow}>
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={`e${i}`} className={`${styles.calCell} ${styles.calCellMuted}`} />;
            const key = `${view.year}-${view.month}-${day}`;
            const event = byDay.get(key);
            const isToday = view.year === today.year && view.month === today.month && day === today.day;
            return (
              <div key={key} className={`${styles.calCell} ${isToday ? styles.calToday : ''}`}>
                <span className={styles.calDay}>{day}</span>
                {event && (
                  <div className={`${styles.calEvent} ${event.alreadyExists ? styles.calEventDone : ''}`}>
                    9:00 {event.service}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.schedList}>
        {loading ? (
          <div className={styles.empty}>読み込み中…</div>
        ) : schedule.length === 0 ? (
          <div className={styles.empty}>予定はありません。</div>
        ) : (
          schedule.map((s) => (
            <div key={s.date} className={styles.schedRow}>
              <span className={styles.schedDate}>{fmtDate(s.date)}</span>
              <span style={{ flex: 1 }}>{s.theme}</span>
              {s.alreadyExists && <span className={`${styles.badge} ${styles.badgeDraft}`}>生成済み見込み</span>}
            </div>
          ))
        )}
      </div>
    </>
  );
}
