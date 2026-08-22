import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/api';
import { getServiceSupabase } from '@/lib/blog/supabase';

// アイキャッチ画像を Supabase Storage（blog-images バケット）へアップロードし、
// 公開URLを返す。バケットは追加マイグレーション（0002）で作成する前提。
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const BUCKET = 'blog-images';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  const supabase = getServiceSupabase();
  if (!supabase) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY が未設定のため、アップロードできません。' },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'アップロード内容を読み取れませんでした。' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: '画像ファイルが見つかりません。' }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: '対応形式は JPEG / PNG / WebP / GIF / AVIF です。' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: '画像サイズは5MBまでです。' }, { status: 400 });
  }

  const ext = EXT[file.type] ?? 'bin';
  const path = `eyecatch/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (error) {
    const notFound = /bucket.*not.*found|does not exist/i.test(error.message);
    return NextResponse.json(
      {
        error: notFound
          ? `Storage バケット「${BUCKET}」が見つかりません。マイグレーション（supabase/migrations/0002）をrevans-hp-blogで実行してください。`
          : `アップロードに失敗しました: ${error.message}`,
      },
      { status: notFound ? 400 : 500 },
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
