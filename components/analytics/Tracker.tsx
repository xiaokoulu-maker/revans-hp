'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

// ─────────────────────────────────────────────────────────────
// 公開側の軽量トラッカー。
//
// ・ページ遷移（pathname 変化）ごとに1回だけ /api/track へ非同期送信する。
// ・fetch(keepalive) で送るためレンダリングをブロックしない。失敗は静かに無視。
// ・/admin 配下では送信しない（サーバー側でも Cookie で二重に除外している）。
// ・Cookie を使わず、識別はサーバー側の日替わりハッシュのみ（同意バナー不要のライン）。
// ・返り値は null。DOM を一切描画しないためレイアウトへの影響もない。
// ─────────────────────────────────────────────────────────────

function send(path: string) {
  const payload = JSON.stringify({ path, referrer: document.referrer || '' });
  try {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
      // 計測用途のため認証情報は不要だが、同一オリジンの管理 Cookie は自動送信され
      // サーバー側の管理者除外に使われる。
      cache: 'no-store',
    }).catch(() => {
      /* 送信失敗はサイト表示に影響させないため握りつぶす */
    });
  } catch {
    /* 例外も無視 */
  }
}

export default function Tracker() {
  const pathname = usePathname();
  const lastSent = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname) return;
    // 管理画面は計測対象外
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return;
    // 同一パスの二重送信を防ぐ（Strict Mode の二重実行対策も兼ねる）
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;
    send(pathname);
  }, [pathname]);

  return null;
}
