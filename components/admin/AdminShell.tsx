'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import styles from './admin.module.css';

// 管理画面のシェル（サイドバー固定＋トップバー＋メインスクロール）。
// /admin/login のときはシェルを描画せず、子（ログインカード）だけを表示する。

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const IconDoc = (
  <svg className={styles.navIcon} viewBox="0 0 24 24">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </svg>
);
const IconCalendar = (
  <svg className={styles.navIcon} viewBox="0 0 24 24">
    <rect x="3" y="4" width="18" height="17" rx="2" />
    <path d="M3 9h18M8 2v4M16 2v4" />
  </svg>
);
const IconGear = (
  <svg className={styles.navIcon} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 0 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H1a2 2 0 0 1 0-4h.1A1.6 1.6 0 0 0 2.6 7a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H7a1.6 1.6 0 0 0 1-1.5V1a2 2 0 0 1 4 0v.1A1.6 1.6 0 0 0 17 2.6a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V7a1.6 1.6 0 0 0 1.5 1H23a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
  </svg>
);

const NAV: NavItem[] = [
  { href: '/admin/blog', label: '記事一覧', icon: IconDoc },
  { href: '/admin/blog/calendar', label: '投稿カレンダー', icon: IconCalendar },
  { href: '/admin/blog/settings', label: '設定', icon: IconGear },
];

/** 最長一致でアクティブな nav を判定（ネストで二重ハイライトを避ける） */
function activeHref(pathname: string): string {
  const matches = NAV.filter((n) => pathname === n.href || pathname.startsWith(`${n.href}/`));
  if (matches.length === 0) return '';
  return matches.reduce((a, b) => (b.href.length > a.href.length ? b : a)).href;
}

export default function AdminShell({
  email,
  children,
}: {
  email: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // ログインページはシェルなし
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  const active = activeHref(pathname);
  const title = NAV.find((n) => n.href === active)?.label ?? '管理画面';

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  };

  return (
    <div className={styles.shell}>
      <aside className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>R</span>
          <span>
            REVANS
            <br />
            <span className={styles.brandSub}>ADMIN</span>
          </span>
        </div>
        <nav className={styles.nav}>
          <p className={styles.navSection}>ブログ管理</p>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navLink} ${active === item.href ? styles.navLinkActive : ''}`}
              onClick={() => setOpen(false)}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.sidebarFoot}>
          <small>ログイン中</small>
          <b>{email ?? '—'}</b>
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={logout} style={{ width: '100%' }}>
            ログアウト
          </button>
        </div>
      </aside>

      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.hamburger}
            onClick={() => setOpen((v) => !v)}
            aria-label="メニュー"
          >
            <span />
          </button>
          <span className={styles.topbarTitle}>{title}</span>
          <span className={styles.topbarSpacer} />
          <Link href="/" className={`${styles.btn} ${styles.btnSm}`} target="_blank" rel="noreferrer">
            サイトを表示
          </Link>
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
