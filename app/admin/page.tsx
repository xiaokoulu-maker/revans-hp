import { redirect } from 'next/navigation';

// /admin は記事一覧へ集約する。
export default function AdminIndexPage() {
  redirect('/admin/blog');
}
