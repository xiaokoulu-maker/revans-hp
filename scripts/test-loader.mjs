// node --test 用の軽量リゾルバ。
// ・tsconfig の "@/*" → プロジェクトルート のパスエイリアスを解決する
// ・拡張子なしの相対/エイリアス import を .ts/.tsx などに解決する
// Node 24 の型ストリップ（.ts をそのまま実行）と組み合わせ、テストランナーや
// 追加依存（tsx/vitest 等）なしで TypeScript の単体テストを実行するために使う。
import module from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

// このファイルは scripts/ にあるので、親がプロジェクトルート。
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs', '.json'];

/** 拡張子なしの絶対パスを、実在する .ts 等へ解決する（index も見る）。 */
function resolveToFile(basePath) {
  if (existsSync(basePath) && path.extname(basePath)) return basePath;
  for (const ext of EXTS) {
    if (existsSync(basePath + ext)) return basePath + ext;
  }
  for (const ext of EXTS) {
    const idx = path.join(basePath, 'index' + ext);
    if (existsSync(idx)) return idx;
  }
  return null;
}

module.registerHooks({
  resolve(specifier, context, nextResolve) {
    let target = null;

    if (specifier.startsWith('@/')) {
      target = path.join(projectRoot, specifier.slice(2));
    } else if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      context.parentURL &&
      context.parentURL.startsWith('file:')
    ) {
      target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }

    if (target) {
      const resolved = resolveToFile(target);
      if (resolved) {
        return { url: pathToFileURL(resolved).href, shortCircuit: true };
      }
    }

    // それ以外（node 組み込み・npm パッケージ）は既定の解決に委ねる。
    return nextResolve(specifier, context);
  },
});
