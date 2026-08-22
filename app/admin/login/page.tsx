'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from '@/components/admin/admin.module.css';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/admin/blog';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'ログインに失敗しました。');
        setSubmitting(false);
        return;
      }
      router.push(next.startsWith('/admin') ? next : '/admin/blog');
      router.refresh();
    } catch {
      setError('通信に失敗しました。もう一度お試しください。');
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.loginWrap}>
      <form className={styles.loginCard} onSubmit={handleSubmit}>
        <div className={styles.loginBrand}>
          <span className={styles.brandMark}>R</span>
          REVANS
        </div>
        <h1 className={styles.loginTitle}>管理画面ログイン</h1>

        {error && <div className={`${styles.notice} ${styles.noticeErr}`}>{error}</div>}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="email">
            メールアドレス
          </label>
          <input
            id="email"
            type="email"
            className={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="password">
            パスワード
          </label>
          <input
            id="password"
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </div>

        <button
          type="submit"
          className={`${styles.btn} ${styles.btnPrimary}`}
          style={{ width: '100%', height: 46 }}
          disabled={submitting}
        >
          {submitting ? <span className={styles.spin} /> : 'ログイン'}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className={styles.loginWrap} />}>
      <LoginForm />
    </Suspense>
  );
}
