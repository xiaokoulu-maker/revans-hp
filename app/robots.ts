import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    // 公開ページは全許可。管理画面と API はクロール対象から除外する
    // （/admin は認証で保護済みだが、ログイン画面等がインデックスされるのを防ぐ）。
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api'] }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
