import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, readCookie, verifySessionToken } from '@/lib/admin/auth';

// ─────────────────────────────────────────────────────────────
// 管理画面のアクセス制御。
//
// ・/admin 配下（ログインページを除く）は、未認証なら /admin/login へリダイレクト。
// ・/api/admin 配下（ログイン/ログアウトを除く）は、未認証なら 401 JSON。
// ・公開サイト（/, /blog, /services 等）と cron（/api/cron）は一切対象外。
//
// 検証は Web Crypto ベースの verifySessionToken（Edge で動作）。各 API ルート側でも
// requireAdmin による二重チェックを行う（middleware をすり抜けた場合の保険）。
// ─────────────────────────────────────────────────────────────

const PUBLIC_ADMIN_PATHS = new Set<string>(['/admin/login']);
const PUBLIC_ADMIN_API_PATHS = new Set<string>(['/api/admin/login', '/api/admin/logout']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith('/api/admin');

  // ログイン/ログアウトは認証不要（それ以外の /api/admin・/admin を対象化）
  if (PUBLIC_ADMIN_PATHS.has(pathname) || PUBLIC_ADMIN_API_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const token = readCookie(request.headers.get('cookie') ?? '', ADMIN_COOKIE);
  const session = await verifySessionToken(token);

  if (session) return NextResponse.next();

  if (isApi) {
    return NextResponse.json({ error: '認証が必要です。' }, { status: 401 });
  }

  const loginUrl = new URL('/admin/login', request.url);
  // ログイン後に元のページへ戻れるよう next を付与
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
