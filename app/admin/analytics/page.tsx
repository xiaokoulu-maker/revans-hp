import AnalyticsClient from '@/components/admin/AnalyticsClient';

// アクセス分析ページ。認証は middleware（/admin 配下）＋ API 側 requireAdmin で担保。
export default function AdminAnalyticsPage() {
  return <AnalyticsClient />;
}
