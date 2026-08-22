-- ============================================================================
-- 0003 アクセス分析（/admin/analytics）用の追加マイグレーション
--
-- 実行先: Supabase プロジェクト「revans-hp-blog」の SQL Editor
-- 内容（いずれも「追加」のみ。既存テーブル・RLS・cron は一切変更しない）:
--   1) page_views テーブル（アクセス計測ログ）
--   2) RLS: anon は読み取り不可・書き込み不可（記録はサーバー API の service_role のみ）
--   3) 集計用 RPC 3種（totals / detail / post_pv）。全行をアプリに引かず DB 側で集計する。
--
-- プライバシー設計:
--   ・IP アドレスは保存しない（列を持たない）。
--   ・訪問者の識別は「日替わりソルト＋IP＋UA」の SHA-256 ハッシュのみ（visitor_hash）。
--     Cookie を使わず、翌日には同一人物でも別ハッシュになる（同意バナー不要のライン）。
--
-- ※ このファイルはアプリからは実行しない（出力のみ）。手動で貼り付けて実行すること。
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1) page_views（アクセス計測ログ）
--    列は必要最小限に絞る。IP・User-Agent の生値は保存しない。
-- ----------------------------------------------------------------------------
create table if not exists page_views (
  id uuid primary key default gen_random_uuid(),
  -- 閲覧されたページのパス（クエリ・ハッシュは除いた path のみ）
  path text not null,
  -- 流入区分: 'search' | 'social' | 'referral' | 'direct'
  channel text not null default 'direct' check (channel in ('search', 'social', 'referral', 'direct')),
  -- 参照元ドメイン（direct のときは null）
  referrer_domain text,
  -- デバイス種別: 'mobile' | 'desktop' | 'tablet'
  device text not null default 'desktop' check (device in ('mobile', 'desktop', 'tablet')),
  -- 日替わり匿名訪問者ハッシュ（IP は保存せずハッシュのみ）
  visitor_hash text not null default '',
  -- 閲覧日時
  created_at timestamptz not null default now()
);

-- 集計用インデックス（日別集計・パス別・区分別が重くならないように）
create index if not exists page_views_created_at_idx on page_views (created_at desc);
create index if not exists page_views_path_created_idx on page_views (path, created_at desc);
create index if not exists page_views_channel_idx on page_views (channel);
create index if not exists page_views_device_idx on page_views (device);

-- ----------------------------------------------------------------------------
-- 2) RLS
--    ・RLS を有効化。
--    ・anon 用の SELECT / INSERT ポリシーは「作らない」。
--      → anon は読み取りも書き込みもできない（ポリシー無し＝全拒否）。
--    ・記録は必ずサーバー API（/api/track）の service_role 経由で行う。
--      service_role は RLS をバイパスするためポリシー不要。
-- ----------------------------------------------------------------------------
alter table page_views enable row level security;

-- ----------------------------------------------------------------------------
-- 3) 集計用 RPC
--    security invoker（既定）のまま。anon から呼ばれても RLS により page_views を
--    読めず 0 件になるため、集計値の漏えいは起きない。管理 API は service_role で
--    呼ぶため RLS をバイパスして正しい集計値を返す。
--    日別の区切りは日本時間（Asia/Tokyo）で行う。
-- ----------------------------------------------------------------------------

-- 3-1) 期間内の合計値（PV・ユニーク訪問者・/contact 到達数）。サマリーカード用。
create or replace function analytics_totals(p_start timestamptz, p_end timestamptz)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'pv', (
      select count(*) from page_views
      where created_at >= p_start and created_at < p_end
    ),
    'visitors', (
      select count(distinct visitor_hash) from page_views
      where created_at >= p_start and created_at < p_end and visitor_hash <> ''
    ),
    'contact', (
      select count(*) from page_views
      where created_at >= p_start and created_at < p_end and path = '/contact'
    )
  );
$$;

-- 3-2) 期間内の詳細（日別推移・流入区分・デバイス・記事別ランキング）。分析ページ本体用。
create or replace function analytics_detail(p_start timestamptz, p_end timestamptz, p_top int default 10)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'daily', coalesce((
      select jsonb_agg(row order by row->>'day')
      from (
        select jsonb_build_object(
          'day', to_char((created_at at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD'),
          'pv', count(*),
          'visitors', count(distinct visitor_hash) filter (where visitor_hash <> '')
        ) as row
        from page_views
        where created_at >= p_start and created_at < p_end
        group by (created_at at time zone 'Asia/Tokyo')::date
      ) t
    ), '[]'::jsonb),
    'channels', coalesce((
      select jsonb_agg(jsonb_build_object('channel', channel, 'pv', pv) order by pv desc)
      from (
        select channel, count(*) as pv
        from page_views
        where created_at >= p_start and created_at < p_end
        group by channel
      ) c
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object('device', device, 'pv', pv) order by pv desc)
      from (
        select device, count(*) as pv
        from page_views
        where created_at >= p_start and created_at < p_end
        group by device
      ) d
    ), '[]'::jsonb),
    'topPosts', coalesce((
      select jsonb_agg(jsonb_build_object('path', path, 'pv', pv) order by pv desc)
      from (
        select path, count(*) as pv
        from page_views
        where created_at >= p_start and created_at < p_end
          and path like '/blog/%'
        group by path
        order by count(*) desc
        limit greatest(p_top, 1)
      ) p
    ), '[]'::jsonb)
  );
$$;

-- 3-3) 期間内の記事パス別 PV マップ（記事一覧の「30日PV」列用）。{ "/blog/xxx": 12, ... }
create or replace function analytics_post_pv(p_start timestamptz, p_end timestamptz)
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_object_agg(path, pv),
    '{}'::jsonb
  )
  from (
    select path, count(*) as pv
    from page_views
    where created_at >= p_start and created_at < p_end
      and path like '/blog/%'
    group by path
  ) t;
$$;

-- 補足:
--  ・page_views への INSERT/SELECT ポリシーは意図的に作らない（anon 全拒否）。
--    記録は /api/track の service_role のみ、集計は管理 API の service_role のみ。
--  ・データ保持期間を絞りたい場合は、別途 cron 等で古い行を削除する運用を追加する
--    （本マイグレーションでは自動削除は行わない）。
