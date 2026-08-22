import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ADMIN_COOKIE, verifySessionToken } from '@/lib/admin/auth';
import AdminShell from '@/components/admin/AdminShell';

// 管理画面は検索避け。
export const metadata: Metadata = {
  title: '管理画面',
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE)?.value;
  const session = await verifySessionToken(token);

  return <AdminShell email={session?.sub ?? null}>{children}</AdminShell>;
}
