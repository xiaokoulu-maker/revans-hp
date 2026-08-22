// ─────────────────────────────────────────────────────────────
// アクセス計測の分類・匿名化ロジック（サーバー専用）。
//
// /api/track から呼ばれ、リクエストのヘッダと最小ペイロード（path / referrer）から
//   ・流入区分（search / social / referral / direct）
//   ・参照元ドメイン
//   ・デバイス種別（mobile / desktop / tablet）
//   ・日替わり匿名訪問者ハッシュ（IP は保存せずハッシュのみ）
// を導出する。IP・User-Agent の生値は保存しない（呼び出し側で使うだけ）。
// ─────────────────────────────────────────────────────────────

export type Channel = 'search' | 'social' | 'referral' | 'direct';
export type Device = 'mobile' | 'desktop' | 'tablet';

/** 既知の検索エンジンのホスト部分一致パターン */
const SEARCH_HOSTS = [
  'google.',
  'bing.',
  'yahoo.',
  'search.yahoo',
  'duckduckgo.',
  'baidu.',
  'yandex.',
  'ecosia.',
];

/** 既知の SNS のホスト部分一致パターン（X / Instagram / Facebook / LINE 等） */
const SOCIAL_HOSTS = [
  'x.com',
  'twitter.com',
  't.co',
  'instagram.',
  'facebook.',
  'fb.com',
  'fb.me',
  'l.facebook',
  'lm.facebook',
  'line.me',
  'liff.line',
  'lin.ee',
  'linkedin.',
  'lnkd.in',
  'youtube.',
  'youtu.be',
  'tiktok.',
  'pinterest.',
  'threads.',
  'note.com',
];

/** 既知のボット/クローラ UA（部分一致・小文字比較） */
const BOT_PATTERNS = [
  'bot',
  'crawl',
  'spider',
  'slurp',
  'mediapartners',
  'adsbot',
  'bingpreview',
  'facebookexternalhit',
  'facebot',
  'ia_archiver',
  'headless',
  'phantomjs',
  'lighthouse',
  'pagespeed',
  'chrome-lighthouse',
  'gtmetrix',
  'pingdom',
  'uptimerobot',
  'python-requests',
  'axios',
  'node-fetch',
  'curl',
  'wget',
  'go-http-client',
  'okhttp',
  'java/',
  'semrush',
  'ahrefs',
  'mj12bot',
  'dotbot',
  'petalbot',
  'applebot',
];

/** www. と末尾ドットを落としてホストを正規化する */
function normalizeHost(host: string): string {
  return host.replace(/^www\./, '').replace(/\.$/, '').toLowerCase();
}

/**
 * referrer と自サイトのホストから流入区分と参照元ドメインを判定する。
 * ・referrer 無し、または自サイト内からの遷移 → direct（ドメインは null）。
 * ・検索エンジン → search、SNS → social、それ以外の外部 → referral。
 */
export function classifyReferrer(
  referrer: string | null | undefined,
  selfHost: string | null | undefined,
): { channel: Channel; referrerDomain: string | null } {
  const ref = (referrer ?? '').trim();
  if (!ref) return { channel: 'direct', referrerDomain: null };

  let host: string;
  try {
    host = normalizeHost(new URL(ref).host);
  } catch {
    return { channel: 'direct', referrerDomain: null };
  }
  if (!host) return { channel: 'direct', referrerDomain: null };

  // 自サイト内の遷移は direct 扱い（内部回遊は流入としない）
  const self = selfHost ? normalizeHost(selfHost) : '';
  if (self && host === self) return { channel: 'direct', referrerDomain: null };

  if (SEARCH_HOSTS.some((h) => host.includes(h))) return { channel: 'search', referrerDomain: host };
  if (SOCIAL_HOSTS.some((h) => host.includes(h))) return { channel: 'social', referrerDomain: host };
  return { channel: 'referral', referrerDomain: host };
}

/**
 * User-Agent からデバイス種別を判定する。
 * タブレットを先に判定（Android タブレットは "Mobile" を含まない点に注意）。
 */
export function classifyDevice(userAgent: string | null | undefined): Device {
  const ua = (userAgent ?? '').toLowerCase();
  if (!ua) return 'desktop';

  const isTablet =
    ua.includes('ipad') ||
    ua.includes('tablet') ||
    ua.includes('playbook') ||
    ua.includes('silk') ||
    (ua.includes('android') && !ua.includes('mobile'));
  if (isTablet) return 'tablet';

  const isMobile =
    ua.includes('mobi') ||
    ua.includes('iphone') ||
    ua.includes('ipod') ||
    ua.includes('android') ||
    ua.includes('blackberry') ||
    ua.includes('iemobile') ||
    ua.includes('opera mini') ||
    ua.includes('windows phone');
  if (isMobile) return 'mobile';

  return 'desktop';
}

/** 既知ボットの User-Agent なら true（記録から除外する） */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? '').toLowerCase();
  if (!ua) return true; // UA 無しは基本ボット/計測不能として除外
  return BOT_PATTERNS.some((p) => ua.includes(p));
}

/** 分析用ソルトの基底（ANALYTICS_SALT が無ければ既存の秘密から導出。無ければ固定文字列）。 */
function saltBase(): string {
  return (
    process.env.ANALYTICS_SALT ||
    process.env.ADMIN_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    'revans-analytics-fallback-salt'
  );
}

/** 日本時間の YYYY-MM-DD（日替わりソルトに使う） */
function jstDateStamp(nowMs: number): string {
  const jst = new Date(nowMs + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(jst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 日替わり匿名訪問者ハッシュを作る。
 * ・入力: 日本時間の日付 + IP + UA + ソルト。IP・UA の生値は保存せずハッシュのみ。
 * ・翌日は同一人物でも別ハッシュになる（Cookie を使わない同意不要のライン）。
 * ・IP が取れない場合も UA だけでハッシュ化する（粒度は落ちるが動作は継続）。
 */
export async function makeVisitorHash(
  ip: string | null | undefined,
  userAgent: string | null | undefined,
  nowMs: number,
): Promise<string> {
  const material = `${jstDateStamp(nowMs)}::${saltBase()}::${(ip ?? '').trim()}::${(userAgent ?? '').trim()}`;
  const bytes = new TextEncoder().encode(material);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const arr = Array.from(new Uint8Array(digest));
  // 先頭 16 バイト（32 hex 文字）で十分に衝突しにくく、保存量も抑える
  return arr
    .slice(0, 16)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * X-Forwarded-For 等からクライアント IP を推定する（保存はしない・ハッシュ材料のみ）。
 */
export function extractClientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim() || null;
  return headers.get('x-real-ip') || headers.get('cf-connecting-ip') || null;
}

/**
 * トラッカーから受け取った path を検証・正規化する。
 * ・'/' 始まりのみ許可、クエリ・ハッシュは落とす、長すぎるものは拒否。
 * 不正なら null。
 */
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let path = raw.trim();
  if (!path.startsWith('/')) return null;
  if (path.length > 512) return null;
  // クエリ・ハッシュを除去（計測の軸はパスのみ）
  path = path.split('?')[0].split('#')[0];
  // 末尾スラッシュはトップ以外は落として集計を安定させる
  if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '');
  return path || '/';
}
