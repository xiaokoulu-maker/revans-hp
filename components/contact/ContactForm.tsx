'use client';

import { useState } from 'react';
import { SITE } from '@/lib/site';
import styles from './ContactForm.module.css';

const TOPICS = [
  'LP・ホームページ制作について',
  'MEO対策（Googleマップ集客）について',
  'AIブログ（SEO）について',
  '広告運用・動画について',
  'AI接客・AI業務改善について',
  '採用・求人支援について',
  'その他・まだ決まっていない',
];

export default function ContactForm() {
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (sending) return;

    setError(null);
    setSending(true);

    const data = new FormData(form);
    const payload = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      company: String(data.get('company') ?? ''),
      topic: String(data.get('topic') ?? ''),
      message: String(data.get('message') ?? ''),
      website: String(data.get('website') ?? ''), // honeypot（人間は空のまま）
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(
          body?.error ??
            '送信に失敗しました。時間をおいて再度お試しください。解決しない場合はメールで直接ご連絡ください。',
        );
        setSending(false);
        return;
      }

      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError(
        'ネットワークエラーで送信できませんでした。通信環境をご確認のうえ、再度お試しください。',
      );
      setSending(false);
    }
  };

  if (done) {
    return (
      <div className={styles.done} role="status" aria-live="polite">
        <h2 className={styles.doneTitle}>送信を受け付けました</h2>
        <p className={styles.doneBody}>
          ご入力ありがとうございます。1〜2営業日以内に <strong>{SITE.email}</strong>{' '}
          よりご返信します。
          <br />
          お急ぎの場合は{' '}
          <a className={styles.inlineLink} href={`mailto:${SITE.email}`}>
            メールで直接ご連絡
          </a>
          ください。
        </p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {/* honeypot: 画面外に隠す。bot が埋めるとサーバー側で破棄される。人間は触れない。 */}
      <div className={styles.hp} aria-hidden="true">
        <label htmlFor="f-website">ウェブサイト（入力しないでください）</label>
        <input id="f-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className={styles.field}>
        <label htmlFor="f-name">
          お名前<span className={styles.req}>必須</span>
        </label>
        <input id="f-name" name="name" type="text" required autoComplete="name" />
      </div>

      <div className={styles.field}>
        <label htmlFor="f-company">会社名・屋号</label>
        <input id="f-company" name="company" type="text" autoComplete="organization" />
      </div>

      <div className={styles.field}>
        <label htmlFor="f-email">
          メールアドレス<span className={styles.req}>必須</span>
        </label>
        <input id="f-email" name="email" type="email" required autoComplete="email" />
      </div>

      <div className={styles.field}>
        <label htmlFor="f-topic">
          ご相談内容<span className={styles.req}>必須</span>
        </label>
        <select id="f-topic" name="topic" required defaultValue="">
          <option value="" disabled>
            選択してください
          </option>
          {TOPICS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label htmlFor="f-msg">
          現状の課題・ご質問<span className={styles.req}>必須</span>
        </label>
        <textarea
          id="f-msg"
          name="message"
          required
          rows={6}
          maxLength={5000}
          placeholder="例：問い合わせが月0件で、何から手を付ければいいか相談したい"
        />
      </div>

      {error && (
        <p className={styles.error} role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      <p className={styles.note}>
        送信いただいた内容は、ご相談への回答以外の目的には使用しません。
      </p>
      <button className={styles.submit} type="submit" disabled={sending}>
        {sending ? '送信中…' : 'この内容で送信する'}
      </button>
    </form>
  );
}
