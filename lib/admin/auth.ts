// ─────────────────────────────────────────────────────────────
// 管理画面（/admin）の簡易認証。
//
// ・認証情報は環境変数 ADMIN_EMAIL / ADMIN_PASSWORD のみ（DB を使わない）。
// ・ログイン成功時に HMAC 署名付きのセッション Cookie を発行する。
// ・署名/検証は Web Crypto（crypto.subtle）で行う。これは Edge（middleware）と
//   Node（route handler）の両方で動くため、middleware とサーバー API の双方から
//   同じロジックで検証できる。
// ・署名鍵は ADMIN_SESSION_SECRET があればそれを使い、無ければ
//   ADMIN_PASSWORD + ADMIN_EMAIL から導出する（利用者が追加で用意する env を
//   最小限に留めるため）。いずれも NEXT_PUBLIC_ を付けずサーバー専用にする。
// ─────────────────────────────────────────────────────────────

/** セッション Cookie 名 */
export const ADMIN_COOKIE = 'revans_admin_session';

/** セッション有効期間（秒）。7日。 */
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 7;

interface SessionPayload {
  /** ログインしたメールアドレス */
  sub: string;
  /** 発行時刻（Unix 秒） */
  iat: number;
  /** 失効時刻（Unix 秒） */
  exp: number;
}

/** 署名鍵を返す。認証情報が無ければ null（＝ログイン不能・全リクエスト拒否）。 */
function getSecret(): string | null {
  const explicit = process.env.ADMIN_SESSION_SECRET;
  if (explicit && explicit.length >= 8) return explicit;

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return null;
  // 認証情報から鍵を導出（パスワード変更時に既存セッションが自動失効する副次効果もある）
  return `revans-admin::${email}::${password}`;
}

const encoder = new TextEncoder();

/** Uint8Array → base64url 文字列 */
function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url 文字列 → Uint8Array */
function fromBase64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmac(secret: string, message: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return new Uint8Array(sig);
}

/** 長さ非依存の定数時間比較（タイミング攻撃対策） */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * メール/パスワードが env と一致するか検証する（定数時間比較）。
 * 認証情報が未設定の環境では常に false。
 */
export function verifyCredentials(email: string, password: string): boolean {
  const envEmail = process.env.ADMIN_EMAIL;
  const envPassword = process.env.ADMIN_PASSWORD;
  if (!envEmail || !envPassword) return false;
  const emailOk = timingSafeEqual(email.trim().toLowerCase(), envEmail.trim().toLowerCase());
  const passwordOk = timingSafeEqual(password, envPassword);
  return emailOk && passwordOk;
}

/** ログイン成功後のセッショントークンを発行する。secret 未設定なら null。 */
export async function createSessionToken(email: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;

  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = { sub: email, iat: now, exp: now + ADMIN_SESSION_MAX_AGE };
  const payloadPart = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sigPart = toBase64Url(await hmac(secret, payloadPart));
  return `${payloadPart}.${sigPart}`;
}

/**
 * セッショントークンを検証する。有効なら payload、無効/失効なら null。
 * middleware（Edge）と route handler（Node）の両方から呼べる。
 */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const secret = getSecret();
  if (!secret) return null;

  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadPart, sigPart] = parts;

  const expected = toBase64Url(await hmac(secret, payloadPart));
  if (!timingSafeEqual(sigPart, expected)) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadPart))) as SessionPayload;
    if (!payload || typeof payload.exp !== 'number') return null;
    if (Math.floor(Date.now() / 1000) >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Request の Cookie から管理者セッションを検証する。
 * 有効ならメールアドレス、無効なら null を返す（route handler 用）。
 */
export async function getAdminFromRequest(request: Request): Promise<string | null> {
  const cookie = request.headers.get('cookie') ?? '';
  const token = readCookie(cookie, ADMIN_COOKIE);
  const payload = await verifySessionToken(token);
  return payload?.sub ?? null;
}

/** Cookie ヘッダ文字列から指定名の値を取り出す */
export function readCookie(cookieHeader: string, name: string): string | undefined {
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}
