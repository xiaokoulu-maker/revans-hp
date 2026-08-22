'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './admin.module.css';
import { LENGTH_PRESETS, DEFAULT_LENGTH } from '@/lib/blog/length-presets';
import type { TopicSuggestion } from '@/lib/blog/suggest-topics-server';

// 手動生成ダイアログ。テーマAI候補提示・文字数プリセット・段階進捗・二重送信防止。
// 生成後は作成された記事の編集画面へ遷移する。

const STAGES = ['準備中', '本文を執筆中', '安全チェック', '保存中'] as const;

function stageFromProgress(p: number): number {
  if (p >= 85) return 3;
  if (p >= 60) return 2;
  if (p >= 15) return 1;
  return 0;
}

export default function GenerateDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const router = useRouter();

  const [theme, setTheme] = useState('');
  const [keywords, setKeywords] = useState('');
  const [audience, setAudience] = useState('中小企業の経営者');
  const [purpose, setPurpose] = useState('');
  const [service, setService] = useState('');
  const [length, setLength] = useState(DEFAULT_LENGTH);

  const [topics, setTopics] = useState<TopicSuggestion[]>([]);
  const [loadingTopics, setLoadingTopics] = useState(false);

  const [creating, setCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const progressRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  if (!open) return null;

  const suggestTopics = async () => {
    if (loadingTopics) return;
    setLoadingTopics(true);
    setError('');
    try {
      const res = await fetch('/api/admin/suggest-topics', { method: 'POST' });
      if (!res.ok) {
        setError('テーマ候補の取得に失敗しました。');
        return;
      }
      const data = await res.json();
      setTopics(data.topics ?? []);
      if (data.error) setNotice(data.error);
    } catch {
      setError('テーマ候補の取得に失敗しました。');
    } finally {
      setLoadingTopics(false);
    }
  };

  const applyTopic = (t: TopicSuggestion) => {
    setTheme(t.theme);
    setKeywords(t.keywords);
    if (t.audience) setAudience(t.audience);
    setPurpose(t.purpose);
    setService(t.service);
  };

  const startProgress = () => {
    progressRef.current = 0;
    setProgress(0);
    timerRef.current = setInterval(() => {
      const next = Math.min(90, progressRef.current + (90 - progressRef.current) * 0.05 + 0.4);
      progressRef.current = next;
      setProgress(next);
    }, 250);
  };
  const stopProgress = (final: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    progressRef.current = final;
    setProgress(final);
  };

  const handleCreate = async () => {
    if (creating) return; // 二重送信防止
    if (!theme.trim()) {
      setError('テーマを入力してください。');
      return;
    }
    setError('');
    setNotice('');
    setCreating(true);
    startProgress();

    try {
      const res = await fetch('/api/admin/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, keywords, audience, purpose, service, length }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.ok) {
        stopProgress(progressRef.current);
        setError(data.error ?? '生成に失敗しました。');
        setCreating(false);
        return;
      }

      stopProgress(100);
      if (data.stub) {
        setNotice('APIキー未設定のため、サンプル下書きを作成しました。');
      }
      onCreated?.();
      // 少し見せてから編集画面へ
      setTimeout(() => {
        router.push(`/admin/blog/${data.id}/edit`);
        router.refresh();
      }, 500);
    } catch {
      stopProgress(progressRef.current);
      setError('通信に失敗しました。もう一度お試しください。');
      setCreating(false);
    }
  };

  const currentStage = creating ? stageFromProgress(progress) : -1;

  return (
    <div
      className={styles.dialogBackdrop}
      onClick={creating ? undefined : onClose}
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.dialogTitle}>AIで記事を作成</h2>
        <p className={styles.dialogDesc}>
          テーマを指定して記事を生成します。生成物は下書きとして保存され、その後編集画面へ移動します。
        </p>

        {error && <div className={`${styles.notice} ${styles.noticeErr}`}>{error}</div>}
        {notice && <div className={`${styles.notice} ${styles.noticeWarn}`}>{notice}</div>}

        {creating ? (
          <>
            <div className={styles.progressTrack}>
              <div className={styles.progressBar} style={{ width: `${progress}%` }} />
            </div>
            <ul className={styles.stageList}>
              {STAGES.map((label, i) => {
                const cls =
                  i < currentStage
                    ? styles.stageDone
                    : i === currentStage
                      ? styles.stageActive
                      : '';
                return (
                  <li key={label} className={`${styles.stageItem} ${cls}`}>
                    <span className={styles.stageDot}>{i < currentStage ? '✓' : i + 1}</span>
                    {label}
                  </li>
                );
              })}
            </ul>
            <p className={styles.hint} style={{ marginTop: 14 }}>
              生成には1〜2分ほどかかることがあります。この画面のまま少々お待ちください。
            </p>
          </>
        ) : (
          <>
            <div className={styles.field}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSm}`}
                onClick={suggestTopics}
                disabled={loadingTopics}
              >
                {loadingTopics ? '取得中…' : 'テーマ案をAIに出してもらう'}
              </button>
              {topics.length > 0 && (
                <div className={styles.topicChips}>
                  {topics.map((t) => (
                    <button
                      key={t.theme}
                      type="button"
                      className={styles.topicChip}
                      onClick={() => applyTopic(t)}
                    >
                      {t.theme}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>テーマ（必須）</label>
              <input
                className={styles.input}
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="例）MEO対策｜入門｜基礎と始め方"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>対策キーワード（カンマ区切り）</label>
              <input
                className={styles.input}
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="例）MEO, MEO 中小企業, Googleマップ 集客"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>想定読者</label>
              <input className={styles.input} value={audience} onChange={(e) => setAudience(e.target.value)} />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>記事の目的</label>
              <input
                className={styles.input}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="例）はじめて検討する経営者に全体像と最初の一歩を伝える"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>扱うサービス領域</label>
              <input
                className={styles.input}
                value={service}
                onChange={(e) => setService(e.target.value)}
                placeholder="例）MEO対策"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>文字数の目安</label>
              <select className={styles.select} value={length} onChange={(e) => setLength(e.target.value)}>
                {LENGTH_PRESETS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className={styles.dialogFoot}>
          <button type="button" className={styles.btn} onClick={onClose} disabled={creating}>
            閉じる
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? <span className={styles.spin} /> : '生成する'}
          </button>
        </div>
      </div>
    </div>
  );
}
