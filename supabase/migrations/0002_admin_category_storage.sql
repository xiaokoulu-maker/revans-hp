-- ============================================================================
-- 0002 管理画面（/admin）用の追加マイグレーション
--
-- 実行先: Supabase プロジェクト「revans-hp-blog」の SQL Editor
-- 内容（いずれも「追加」のみ。既存の列変更・削除・RLS変更・cron変更は行わない）:
--   1) blog_posts に category 列を追加（カテゴリ表示・管理用）
--   2) アイキャッチ用の Storage バケット blog-images を作成（公開読み取り）
--
-- ※ このファイルはアプリからは実行しない（出力のみ）。手動で貼り付けて実行すること。
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) category 列（任意・NULL 可）
--    既存 7 記事は NULL のまま。管理画面から個別に登録できる。
--    公開側（/blog）は値があれば表示し、無ければ従来どおり 'COLUMN' を表示する。
-- ----------------------------------------------------------------------------
alter table blog_posts
  add column if not exists category text;

-- 任意: カテゴリでの絞り込みを将来行う場合に備えたインデックス（無くても動作する）
create index if not exists blog_posts_category_idx on blog_posts (category);

-- ----------------------------------------------------------------------------
-- 2) アイキャッチ用 Storage バケット（公開読み取り）
--    アップロードは service_role（サーバーAPI /api/admin/upload）が行う。
--    service_role は RLS をバイパスするため、書き込みポリシーは作成しない。
--    読み取りは公開サイトの <img> から参照するため anon にも許可する。
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do update set public = true;

-- 公開読み取りポリシー（blog-images バケットのオブジェクトのみ SELECT 可）
drop policy if exists "blog_images_public_read" on storage.objects;
create policy "blog_images_public_read"
  on storage.objects
  for select
  using (bucket_id = 'blog-images');

-- 補足:
--  ・INSERT/UPDATE/DELETE のポリシーは作らない（アップロードは service_role のみ）。
--  ・バケットを非公開に切り替えたい場合は public を false にし、
--    署名付きURL方式へ変更すること（本実装は公開URL前提）。
