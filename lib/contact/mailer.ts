// ─────────────────────────────────────────────────────────────
// 通知メール送信（Resend REST API を fetch で呼ぶ・依存追加なし）
//
// env 未設定でもビルド/実行が壊れないよう、キーが無ければ送信をスキップして
// { sent:false, error:'...未設定' } を返す（呼び出し側が mail_error に記録する）。
//   RESEND_API_KEY     : Resend の APIキー
//   CONTACT_NOTIFY_EMAIL : 通知の宛先（自社の受信箱）
//   CONTACT_FROM_EMAIL   : 差出人（Resend で認証済みドメインのアドレス）
// ─────────────────────────────────────────────────────────────

export interface MailPayload {
  name: string;
  email: string;
  company: string | null;
  topic: string | null;
  message: string;
  createdAt: Date;
}

export interface MailResult {
  sent: boolean;
  error: string | null;
}

/** JST（Asia/Tokyo）の読みやすい日時文字列にする */
function formatJst(date: Date): string {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

/** HTML本文向けの最小エスケープ（差し込み値の記号崩れ/混入を防ぐ） */
function esc(v: string): string {
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 問い合わせ内容を通知メールとして送る。
 * ・宛先 CONTACT_NOTIFY_EMAIL、差出人 CONTACT_FROM_EMAIL。
 * ・Reply-To は送信者本人のメールにし、受信側の「返信」でそのまま返せるようにする。
 * ・成功で { sent:true }、失敗/未設定で { sent:false, error }。例外は投げない。
 */
export async function sendNotificationEmail(payload: MailPayload): Promise<MailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_NOTIFY_EMAIL;
  const from = process.env.CONTACT_FROM_EMAIL;

  const missing: string[] = [];
  if (!apiKey) missing.push('RESEND_API_KEY');
  if (!to) missing.push('CONTACT_NOTIFY_EMAIL');
  if (!from) missing.push('CONTACT_FROM_EMAIL');
  if (missing.length > 0) {
    return { sent: false, error: `メール設定が未設定のため送信をスキップしました（${missing.join(', ')}）` };
  }

  const jst = formatJst(payload.createdAt);
  const subject = `【REVANS】サイトから問い合わせ：${payload.name}様`;

  const rows: Array<[string, string]> = [
    ['お名前', payload.name],
    ['メールアドレス', payload.email],
    ['会社名・屋号', payload.company || '（未入力）'],
    ['ご相談内容', payload.topic || '（未選択）'],
    ['受信日時（JST）', jst],
  ];

  const text = [
    ...rows.map(([k, v]) => `${k}：${v}`),
    '',
    '── 現状の課題・ご質問 ──',
    payload.message,
  ].join('\n');

  const html = [
    '<div style="font-family:sans-serif;font-size:14px;line-height:1.8;color:#0b1729">',
    '<h2 style="font-size:16px;margin:0 0 12px">サイトからのお問い合わせ</h2>',
    '<table style="border-collapse:collapse;font-size:14px">',
    ...rows.map(
      ([k, v]) =>
        `<tr><th style="text-align:left;padding:4px 16px 4px 0;white-space:nowrap;vertical-align:top">${esc(
          k,
        )}</th><td style="padding:4px 0">${esc(v)}</td></tr>`,
    ),
    '</table>',
    '<h3 style="font-size:14px;margin:18px 0 6px">現状の課題・ご質問</h3>',
    `<div style="white-space:pre-wrap;padding:12px;background:#f4f6fa;border-radius:8px">${esc(
      payload.message,
    )}</div>`,
    '</div>',
  ].join('');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: payload.email, // 返信ボタンで問い合わせ者へ直接返せるように
        subject,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { sent: false, error: `Resend送信に失敗しました（HTTP ${res.status}）: ${detail.slice(0, 500)}` };
    }
    return { sent: true, error: null };
  } catch (e) {
    return { sent: false, error: `Resend送信で例外が発生しました: ${(e as Error).message}` };
  }
}
