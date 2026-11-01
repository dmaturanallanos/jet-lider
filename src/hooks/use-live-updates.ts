'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { browserDb } from '@/lib/supabase/browser';
export function useLiveUpdates(enabled: boolean) {
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
      .channel('operacion')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'worker_absences' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logbook_entries' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workers' }, refresh)
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
  }, [enabled, router]);
}
