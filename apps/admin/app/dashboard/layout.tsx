import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth';
import Sidebar from '@/components/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAdminSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar user={session} />
      <main className="ml-64 p-8">
        {children}
      </main>
    </div>
  );
}
