/** Tailwind v4（CSS-first）。globals.css 冒頭の `@import "tailwindcss";` を処理し、
 *  参照元デザインが前提とする preflight（リスト/見出し等のリセット）を有効化する。 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
