'use client';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';
import { RecoveryHashRedirect } from '@/features/auth/recovery-hash';
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <RecoveryHashRedirect />
      {children}
    </ThemeProvider>
  );
}
