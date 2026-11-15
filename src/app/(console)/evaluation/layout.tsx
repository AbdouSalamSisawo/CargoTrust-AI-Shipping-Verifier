import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Quality' };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
