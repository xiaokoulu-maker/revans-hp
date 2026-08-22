-- ============================================================================
-- 0004 ブログ自動修正（要確認記事のAI自動修正→自動公開）用の追加マイグレーション
--
-- 実行先: Supabase プロジェクト「revans-hp-blog」の SQL Editor
-- 内容（「列の追加」のみ。既存テーブル・RLS・cron・データは一切変更しない）:
--   ・blog_settings.auto_fix（自動修正の有効フラグ）を追加。既定は true（ON）。
--
-- 目的:
--   週次 cron の safety-check で needsReview=true（[要確認]マーカー／金額表現）に
--   なった記事を、公開前に AI でもう1パス修正して公開まで完結させる運用のための
--   ON/OFF フラグ。自動公開（auto_publish）が ON のときのみ効く。
--
-- 備考:
--   ・アプリ側は列が未適用でも壊れない（getBlogSettings は列が無ければ autoFix=true
--     にフォールバックする）。このマイグレーションを適用すると、管理画面の設定
--     トグルで永続化・切り替えができるようになる。
--   ・このファイルはアプリからは実行しない（出力のみ）。手動で貼り付けて実行すること。
-- ============================================================================

alter table blog_settings
  add column if not exists auto_fix boolean not null default true;

-- 既存の1行（設定行）にも既定値 true が入る（not null default true のため自動）。
-- 明示的に既定 ON を保証したい場合は次を実行してもよい（任意）:
-- update blog_settings set auto_fix = true where auto_fix is null;
