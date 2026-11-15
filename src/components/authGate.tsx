'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Client-side auth gate for the console.
 *
 * Uses localStorage instead of relying solely on the session cookie so the
 * console also works behind preview proxies / sandboxed frames that drop or
 * partition cookies. No server-side redirects are involved: an
 * unauthenticated visit simply swaps to the login screen via router.replace,
 * which cannot produce ERR_TOO_MANY_REDIRECTS through any proxy.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let authed = false;
    try {
      authed = window.localStorage.getItem('cargotrust_auth') === '1';
    } catch {
      // storage unavailable — fall through to the login screen
    }
    if (authed) {
      setOk(true);
    } else {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [router, pathname]);

  if (!ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex items-center gap-2.5 text-[13px] font-semibold text-slate-400">
          <span className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-brand-500 animate-spin"/>
          Checking session…
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
