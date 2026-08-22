import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createSessionToken,
  verifyCredentials,
} from '@/lib/admin/auth';

// env（ADMIN_EMAIL / ADMIN_PASSWORD）で認証し、成功時にセッション Cookie を発行する。
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'リクエストが不正です。' }, { status: 400 });
  }

  const email = String(body.email ?? '');
  const password = String(body.password ?? '');

  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    return NextResponse.json(
      { error: '管理者認証が未設定です。環境変数 ADMIN_EMAIL / ADMIN_PASSWORD を設定してください。' },
      { status: 500 },
    );
  }

  if (!verifyCredentials(email, password)) {
    return NextResponse.json({ error: 'メールアドレスまたはパスワードが違います。' }, { status: 401 });
  }

  const token = await createSessionToken(email.trim().toLowerCase());
  if (!token) {
    return NextResponse.json({ error: 'セッションを発行できませんでした。' }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return response;
}
