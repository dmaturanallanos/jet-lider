'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/browser';
export function useLiveUpdates(enabled: boolean, workspaceId: string) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const db = browserDb();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 500);
    };
    const channel = db
      .channel(`operacion:${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts', filter: `workspace_id=eq.${workspaceId}` },
        refresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'worker_absences',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `workspace_id=eq.${workspaceId}` },
        refresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'logbook_entries',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        refresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workers',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        refresh,
      )
      .subscribe();
    const auth = db.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') router.replace('/acceso');
    });
    const interval = setInterval(() => router.refresh(), 60000);
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
      void db.removeChannel(channel);
      auth.data.subscription.unsubscribe();
    };
  }, [enabled, workspaceId, router]);
}
