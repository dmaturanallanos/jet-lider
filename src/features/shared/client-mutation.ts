'use client';
import { mutate, type ActionResult } from './actions';
export async function safeMutate(action: string, input: unknown): Promise<ActionResult> {
  if (!navigator.onLine)
    return {
      ok: false,
      message:
        'Sin conexión. No se guardaron cambios; conserva el formulario y vuelve a intentar cuando tengas internet.',
    };
  try {
    return await mutate(action, input);
  } catch {
    return {
      ok: false,
      message:
        'No pudimos confirmar el resultado por un problema de conexión. Conserva el formulario y recarga los datos antes de reenviar.',
    };
  }
}
