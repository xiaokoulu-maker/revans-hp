// 手動生成ダイアログの文字数プリセット。
//
// 注意: 記事生成の共有プロンプト（generate-prompt.ts）は本文の目安を
// 「約4,000字」で固定している（週次 cron と同一）。cron の挙動を変えない
// ガードレールのためプロンプト側は変更しておらず、ここで選んだ値は
// generateArticle への入力 length として渡るのみ（現状の生成量への影響は軽微）。

export interface LengthPreset {
  /** GenerateArticleInput.length に渡す文字列 */
  value: string;
  label: string;
}

export const LENGTH_PRESETS: LengthPreset[] = [
  { value: '2,000〜3,000', label: '2,000〜3,000字（コンパクト）' },
  { value: '3,000〜5,000', label: '3,000〜5,000字（標準）' },
  { value: '5,000〜7,000', label: '5,000〜7,000字（詳しめ）' },
];

export const DEFAULT_LENGTH = '3,000〜5,000';
