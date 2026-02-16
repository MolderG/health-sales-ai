'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export default function DashboardNav() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setEmail(user.email);
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <a
          href="/dashboard"
          className="text-sm font-semibold text-zinc-900 hover:text-zinc-700"
        >
          Health Sales AI
        </a>

        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">{email}</span>
          <button
            onClick={handleLogout}
            className="rounded-md px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
          >
            Sair
          </button>
        </div>
      </div>
    </header>
  );
}
