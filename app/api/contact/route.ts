import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { insertInquiry, recentCountByIpHash, updateMailStatus } from '@/lib/contact/supabase';
import { sendNotificationEmail } from '@/lib/contact/mailer';

/**
 * お問い合わせ受付エンドポイント（サーバー専用）。
 *
 * 方針: DB保存が主・メール通知は副。
 *   1. honeypot が埋まっていれば bot とみなし、成功を装って破棄（保存しない）。
 *   2. 入力検証（必須・メール形式・文字数）。
 *   3. 同一IPの連投制限（直近60秒に5件以上で 429）。
 *   4. Supabase へ insert。失敗時のみユーザーにエラー返却（500）。
 *   5. insert 成功後に Resend 送信。送信の成否は mail_sent / mail_error に記録し、
 *      メール失敗でもユーザーには成功（200）を返す（問い合わせは失われない）。
 *
 * service_role / Resend の各 env が未設定でもビルドは壊れない。
 *   - service_role 未設定 → insert が例外 → 500（保存できないため正しくエラー）。
 *   - Resend 系 未設定  → 送信スキップ＋mail_error 記録＋ユーザーには 200。
 */

// env・IP・時刻を毎回参照するため静的化させない
export const dynamic = 'force-dynamic';

// ip_hash 用の固定ソルト（生IPは保存せず、素の sha256 のレインボー化も避ける）。
// 値の秘匿性は要件ではないためコード内定数で足りる（env は増やさない）。
const IP_SALT = 'revans-hp/contact/v1';

const RATE_WINDOW_SEC = 60;
const RATE_MAX = 5;

const MAX = { name: 200, email: 320, company: 200, topic: 200, message: 5000 } as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Body {
  name?: unknown;
  email?: unknown;
  company?: unknown;
  topic?: unknown;
  message?: unknown;
  /** honeypot（画面に出さない隠しフィールド。人間は空のまま） */
  website?: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

function clientIp(request: NextRequest): string | null {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return request.headers.get('x-real-ip');
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${IP_SALT}:${ip}`).digest('hex');
}

export async function POST(request: NextRequest) {
  // --- 入力の取得 ---
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: '送信データを読み取れませんでした。' }, { status: 400 });
  }

  // 1. honeypot: bot が埋めたら成功を装って破棄
  if (str(body.website) !== '') {
    return NextResponse.json({ ok: true });
  }

  // 2. 入力検証
  const name = str(body.name);
  const email = str(body.email);
  const company = str(body.company);
  const topic = str(body.topic);
  const message = str(body.message);

  const errors: string[] = [];
  if (!name) errors.push('お名前は必須です。');
  else if (name.length > MAX.name) errors.push('お名前が長すぎます。');

  if (!email) errors.push('メールアドレスは必須です。');
  else if (email.length > MAX.email || !EMAIL_RE.test(email))
    errors.push('メールアドレスの形式が正しくありません。');

  if (!message) errors.push('お問い合わせ内容は必須です。');
  else if (message.length > MAX.message)
    errors.push(`お問い合わせ内容は${MAX.message}文字以内で入力してください。`);

  if (company.length > MAX.company) errors.push('会社名・屋号が長すぎます。');
  if (topic.length > MAX.topic) errors.push('ご相談内容が長すぎます。');

  if (errors.length > 0) {
    return NextResponse.json({ ok: false, error: errors.join(' ') }, { status: 400 });
  }

  const ipHash = hashIp(clientIp(request));
  const userAgent = request.headers.get('user-agent');

  // 3. 連投制限（同一IPの短時間多重送信を抑止・簡易）
  const recent = await recentCountByIpHash(ipHash, RATE_WINDOW_SEC);
  if (recent >= RATE_MAX) {
    return NextResponse.json(
      { ok: false, error: '送信が続けて行われました。しばらく時間をおいて再度お試しください。' },
      { status: 429 },
    );
  }

  // 4. Supabase へ保存（主処理）。失敗時のみユーザーにエラーを返す。
  let id: string;
  try {
    id = await insertInquiry({
      name,
      email,
      company: company || null,
      topic: topic || null,
      message,
      userAgent,
      ipHash,
    });
  } catch (e) {
    console.error('[contact] insert failed:', (e as Error).message);
    return NextResponse.json(
      { ok: false, error: '送信処理でエラーが発生しました。時間をおいて再度お試しください。' },
      { status: 500 },
    );
  }

  // 5. 通知メール（副処理）。成否は記録するが、失敗してもユーザーには成功を返す。
  const mail = await sendNotificationEmail({
    name,
    email,
    company: company || null,
    topic: topic || null,
    message,
    createdAt: new Date(),
  });
  await updateMailStatus(id, mail.sent, mail.error);
  if (!mail.sent) {
    console.warn('[contact] mail not sent:', mail.error);
  }

  return NextResponse.json({ ok: true });
}
