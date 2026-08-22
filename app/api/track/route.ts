import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, readCookie, verifySessionToken } from '@/lib/admin/auth';
import {
  classifyDevice,
  classifyReferrer,
  extractClientIp,
  isBotUserAgent,
  makeVisitorHash,
  normalizePath,
} from '@/lib/analytics/collect';
import { recordPageView } from '@/lib/analytics/record';

// ─────────────────────────────────────────────────────────────
// 公開側トラッカーの記録エンドポイント（/api/track）。
//
// ・公開ページのクライアントから beacon で叩かれる。ペイロードは最小（path/referrer）。
// ・記録は service_role 経由（recordPageView）。クライアントから直接 insert させない。
// ・除外: 既知ボット UA / 管理者ログインセッションを持つブラウザ / /admin 配下パス。
// ・簡易連投抑制: 同一訪問者×同一パスの短時間重複を落とす（best-effort・インスタンス内）。
// ・いかなる場合も 204/200 を返し、本文は返さない（サイト表示に影響させない）。
// ─────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** 同一訪問者×パスの連投抑制ウィンドウ（ミリ秒） */
const DEDUPE_WINDOW_MS = 3000;
/** メモリ肥大を防ぐための最大保持キー数 */
const MAX_KEYS = 5000;

// インスタンス内のみのベストエフォート抑制（サーバーレスでは完全ではない）
const lastSeen = new Map<string, number>();

function shouldThrottle(key: string, nowMs: number): boolean {
  const prev = lastSeen.get(key);
  if (prev !== undefined && nowMs - prev < DEDUPE_WINDOW_MS) return true;
  lastSeen.set(key, nowMs);
  if (lastSeen.size > MAX_KEYS) {
    // 古いものから間引く（Map は挿入順）
    const cutoff = lastSeen.size - MAX_KEYS;
    let i = 0;
    for (const k of lastSeen.keys()) {
      if (i++ >= cutoff) break;
      lastSeen.delete(k);
    }
  }
  return false;
}

/** 記録せず終了（本文なし）。ステータスは常に 204 で統一。 */
function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: NextRequest) {
  const nowMs = Date.now();

  // 1) ペイロード検証
  let body: { path?: unknown; referrer?: unknown };
  try {
    body = await request.json();
  } catch {
    return noContent();
  }

  const path = normalizePath(body.path);
  if (!path) return noContent();

  // /admin 配下は計測対象外
  if (path === '/admin' || path.startsWith('/admin/')) return noContent();

  const referrer =
    typeof body.referrer === 'string' && body.referrer.length <= 2048 ? body.referrer : '';

  // 2) 管理者ログイン中のブラウザは除外（同一オリジンなので Cookie が届く）
  const token = readCookie(request.headers.get('cookie') ?? '', ADMIN_COOKIE);
  if (await verifySessionToken(token)) return noContent();

  // 3) 既知ボット UA を除外
  const userAgent = request.headers.get('user-agent');
  if (isBotUserAgent(userAgent)) return noContent();

  // 4) 分類・匿名化
  const host = request.headers.get('host');
  const { channel, referrerDomain } = classifyReferrer(referrer, host);
  const device = classifyDevice(userAgent);
  const ip = extractClientIp(request.headers);
  const visitorHash = await makeVisitorHash(ip, userAgent, nowMs);

  // 5) 連投抑制（同一訪問者×同一パス）
  if (shouldThrottle(`${visitorHash}|${path}`, nowMs)) return noContent();

  // 6) 記録（失敗しても静かに無視）
  await recordPageView({ path, channel, referrerDomain, device, visitorHash });

  return noContent();
}
