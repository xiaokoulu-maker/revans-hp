import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────
// お問い合わせ保存（サーバー専用・service_role）
//
// contact_inquiries は RLS 有効・ポリシー無しのため、匿名キーでは読み書きできない。
// 書き込みは RLS をバイパスする service_role でのみ行う。
//   NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY（NEXT_PUBLIC_ を付けない）
// 未設定なら null を返し、呼び出し側（APIルート）でエラー応答にフォールバックする。
// クライアントバンドルに混入したら例外を投げてサービスキーの露出を防ぐ。
// ─────────────────────────────────────────────────────────────

let serviceCached: SupabaseClient | null | undefined;

function getServiceSupabase(): SupabaseClient | null {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[contact] getServiceSupabase() はサーバー専用です。クライアント側から呼び出さないでください。',
    );
  }

  if (serviceCached !== undefined) return serviceCached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    serviceCached = null;
    return null;
  }

  serviceCached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceCached;
}

/** contact_inquiries に保存する1件分の入力 */
export interface ContactInsert {
  name: string;
  email: string;
  company: string | null;
  topic: string | null;
  message: string;
  userAgent: string | null;
  ipHash: string | null;
}

/**
 * 直近 windowSeconds 秒間で同一 ip_hash からの問い合わせ件数を数える（連投制限用）。
 * 接続不可・ipHash 無し・エラー時は 0 を返し、レート制限では弾かない（保存を優先）。
 */
export async function recentCountByIpHash(
  ipHash: string | null,
  windowSeconds: number,
): Promise<number> {
  if (!ipHash) return 0;
  const supabase = getServiceSupabase();
  if (!supabase) return 0;

  const sinceIso = new Date(Date.now() - windowSeconds * 1000).toISOString();
  const { count, error } = await supabase
    .from('contact_inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', sinceIso);

  if (error) {
    console.error('[contact] recentCountByIpHash failed:', error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * 問い合わせを1件保存する。保存できた行の id を返す。
 * service_role 未設定・DBエラー時は例外を投げる（呼び出し側でユーザーにエラー返却）。
 */
export async function insertInquiry(input: ContactInsert): Promise<string> {
  const supabase = getServiceSupabase();
  if (!supabase) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY が未設定のため、問い合わせを保存できません。');
  }

  const { data, error } = await supabase
    .from('contact_inquiries')
    .insert({
      name: input.name,
      email: input.email,
      company: input.company,
      topic: input.topic,
      message: input.message,
      mail_sent: false,
      mail_error: null,
      user_agent: input.userAgent,
      ip_hash: input.ipHash,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`問い合わせの保存に失敗しました: ${error?.message ?? '不明なエラー'}`);
  }
  return (data as { id: string }).id;
}

/**
 * 保存済み行のメール送信結果を記録する。
 * 失敗しても問い合わせ本体は保存済みなので、ここでのエラーはログのみで握りつぶす。
 */
export async function updateMailStatus(
  id: string,
  mailSent: boolean,
  mailError: string | null,
): Promise<void> {
  const supabase = getServiceSupabase();
  if (!supabase) return;

  const { error } = await supabase
    .from('contact_inquiries')
    .update({ mail_sent: mailSent, mail_error: mailError })
    .eq('id', id);

  if (error) {
    console.error('[contact] updateMailStatus failed:', error.message);
  }
}
