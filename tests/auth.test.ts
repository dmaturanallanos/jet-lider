import { describe, it, expect } from 'vitest';
import { authMessage, appUrl } from '@/features/auth/errors';
import { newPasswordSchema } from '@/features/auth/password-validation';
describe('Acceso y recuperación', () => {
  it('distingue credenciales incorrectas, correo pendiente y límites', () => {
    expect(authMessage({ code: 'invalid_credentials' })).toMatch(/correo o la contraseña/);
    expect(authMessage({ code: 'email_not_confirmed' })).toMatch(/confirmar/);
    expect(authMessage({ status: 429 })).toMatch(/demasiados intentos/);
  });
  it('no expone detalles internos de errores desconocidos', () =>
    expect(authMessage({ code: 'unexpected_failure' })).toBe(
      'El servicio de acceso no está disponible en este momento. Vuelve a intentar en unos minutos.',
    ));
  it('solo exige la longitud nueva al establecer contraseñas nuevas', () => {
    expect(newPasswordSchema.safeParse({ password: 'corta', confirmation: 'corta' }).success).toBe(
      false,
    );
    expect(
      newPasswordSchema.safeParse({
        password: 'una-clave-larga-segura',
        confirmation: 'otra-clave-larga',
      }).success,
    ).toBe(false);
    expect(
      newPasswordSchema.safeParse({
        password: 'una-clave-larga-segura',
        confirmation: 'una-clave-larga-segura',
      }).success,
    ).toBe(true);
  });
  it('genera rutas sin dobles barras aunque el origen termine en barra', () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = 'https://jet-lider.vercel.app/';
    try {
      expect(appUrl('/auth/confirm')).toBe('https://jet-lider.vercel.app/auth/confirm');
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = previous;
    }
  });
});
