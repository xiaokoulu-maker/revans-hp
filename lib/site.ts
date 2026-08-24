// サイト全体で参照する確定情報を一元管理。
// 法人格（株式会社）は未確定のため断定表記しない。

export const SITE = {
  url: 'https://revans-web.com',
  name: 'REVANS',
  nameJa: 'レバンス',
  concept: '中小企業に、前進する革命を。',
  /** 事業概要の一言 */
  tagline: 'Web・広告・AI・採用支援／全国オンライン対応',
  email: 'xiaokoulu@gmail.com',
  /** 所在地（法人格は未確定のため会社名は付さない） */
  location: '東京都世田谷区',
  area: '全国オンライン対応',
  ogImage: '/brand/ogp-light.png',
  /** ロゴ（JSON-LD 等の絶対URL生成に使用。横ロゴ 1195x239） */
  logo: '/brand/logo-revans.png',
  hours: '受付：平日 10:00–19:00',
} as const;
