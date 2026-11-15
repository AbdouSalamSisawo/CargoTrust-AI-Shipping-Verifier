import { AppShell } from '@/components/shell';
import { AuthGate } from '@/components/authGate';

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
