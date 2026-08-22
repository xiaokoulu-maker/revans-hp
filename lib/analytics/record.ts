import { getServiceSupabase } from '@/lib/blog/supabase';
import type { Channel, Device } from './collect';

// ─────────────────────────────────────────────────────────────
// page_views への書き込み（サーバー専用・service_role）。
//
// 匿名キーは RLS により page_views を書けない（ポリシー無し＝全拒否）。
// 記録は必ずこの関数（service_role 経由）で行う。クライアントから直接 insert
// させない設計。接続情報が無い・失敗しても例外は投げず false を返す
// （公開サイトの表示に一切影響させないため）。
// ─────────────────────────────────────────────────────────────

export interface PageViewRecord {
  path: string;
  channel: Channel;
  referrerDomain: string | null;
  device: Device;
  visitorHash: string;
}

/** 1件記録する。成功で true。DB 未接続・エラー時は false（例外は投げない）。 */
export async function recordPageView(record: PageViewRecord): Promise<boolean> {
  const supabase = getServiceSupabase();
  if (!supabase) return false;

  const { error } = await supabase.from('page_views').insert({
    path: record.path,
    channel: record.channel,
    referrer_domain: record.referrerDomain,
    device: record.device,
    visitor_hash: record.visitorHash,
  });

  if (error) {
    // テーブル未作成（マイグレーション未適用）などもここに来る。ログのみで握りつぶす。
    console.error('[analytics] recordPageView failed:', error.message);
    return false;
  }
  return true;
}
