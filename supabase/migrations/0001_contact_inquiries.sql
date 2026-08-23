-- ============================================================================
-- revans-hp お問い合わせ保存テーブル
-- Supabase の SQL Editor にこのまま貼り付けて実行できる CREATE TABLE 一式。
--
--   contact_inquiries : /contact フォームからの問い合わせを1件1行で保存する。
--
-- 設計方針:
--   - DB保存が主・メール通知は副。メール送信の成否は mail_sent / mail_error に記録し、
--     メールが失敗しても問い合わせ自体は失われない。
--   - RLS を有効化し、ポリシーは一切作らない。
--     → anon / authenticated からの select / insert / update / delete はすべて拒否される。
--     → 書き込みはサーバーの service_role のみ（service_role は RLS をバイパス）。
--   - 既存の blog_posts / blog_settings には一切触れない。
-- ============================================================================

-- gen_random_uuid() を使うため（blog スキーマ実行済みなら既に有効）
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- contact_inquiries
-- ----------------------------------------------------------------------------
create table if not exists contact_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,                          -- 任意（会社名・屋号）
  topic text,                            -- 任意（ご相談内容の選択値）
  message text not null,
  mail_sent boolean not null default false,  -- 通知メール送信に成功したか
  mail_error text,                       -- 送信失敗時のエラー内容（成功時は null）
  user_agent text,                       -- 送信元 UA（迷惑投稿の調査用）
  ip_hash text,                          -- 送信元 IP のハッシュ（生IPは保存しない）
  created_at timestamptz not null default now()
);

-- 連投制限（同一 ip_hash の直近件数チェック）と新着順表示のためのインデックス
create index if not exists contact_inquiries_created_at_idx on contact_inquiries (created_at desc);
create index if not exists contact_inquiries_ip_hash_idx on contact_inquiries (ip_hash);

-- ============================================================================
-- RLS（Row Level Security）
--   有効化のみ行い、ポリシーは作成しない。
--   → anon / authenticated は select/insert/update/delete いずれも不可。
--   → service_role キー（サーバー側）は RLS をバイパスするため書き込み可能。
-- ============================================================================
alter table contact_inquiries enable row level security;

-- （ポリシーは意図的に一切作成しない）
