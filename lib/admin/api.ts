import { NextResponse } from 'next/server';
import { getAdminFromRequest } from './auth';

// ─────────────────────────────────────────────────────────────
// 管理 API ルート用の共通ヘルパー。
// 各 /api/admin ルートの先頭で requireAdmin(request) を呼び、未認証なら
// 401 を返して処理を打ち切る（middleware に加えた二重ガード）。
// ─────────────────────────────────────────────────────────────

/** 未認証時に返す 401 レスポンス */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
}

/**
 * リクエストが管理者セッションを持つか検証する。
 * 認証済みなら { ok:true, email }、未認証なら { ok:false, response:401 } を返す。
 *
 * 使い方:
 *   const auth = await requireAdmin(request);
 *   if (!auth.ok) return auth.response;
 *   // 以降 auth.email が使える
 */
export async function requireAdmin(
  request: Request,
): Promise<{ ok: true; email: string } | { ok: false; response: NextResponse }> {
  const email = await getAdminFromRequest(request);
  if (!email) return { ok: false, response: unauthorized() };
  return { ok: true, email };
}
