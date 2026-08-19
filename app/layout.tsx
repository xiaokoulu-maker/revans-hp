import type { Metadata, Viewport } from 'next';
import { SITE } from '@/lib/site';
import './globals.css';

// 参照元デザインに合わせ、フォントは外部読み込みせずシステムフォントスタックを使用
// （font-family は globals.css の body で指定）。ヘッダー/フッターは各ページが
// site-chrome から描画するため、ここではグローバルに配置しない。

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name}｜${SITE.concept}`,
    template: `%s｜${SITE.name}`,
  },
  description:
    'REVANS（レバンス）は、Web制作・広告・AI・営業支援・採用支援を組み合わせて中小企業の集客と採用を支援します。中小企業に、前進する革命を。',
  applicationName: SITE.name,
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: 'ja_JP',
    url: SITE.url,
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: 'summary_large_image',
  },
};

export const viewport: Viewport = {
  themeColor: '#08162c',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
