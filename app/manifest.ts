import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE.name}｜${SITE.concept}`,
    short_name: SITE.name,
    description:
      'Web制作・広告・AI・営業支援・採用支援を組み合わせて中小企業の集客と採用を支援します。',
    start_url: '/',
    display: 'standalone',
    lang: 'ja',
    background_color: '#ffffff',
    theme_color: '#08162c',
    icons: [
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/brand/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
