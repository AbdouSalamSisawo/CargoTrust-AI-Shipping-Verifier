import { redirect } from 'next/navigation';
import { AppShell } from '@/components/shell';
import { currentUser, toPublic } from '@/lib/auth';
import { getDB, aiStatus } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  const db = await getDB();
  return (
    <AppShell user={toPublic(user)} organisation={db.settings.organisation} aiActive={aiStatus(db.settings).active}>
      {children}
    </AppShell>
  );
}
