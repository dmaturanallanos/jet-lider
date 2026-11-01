export type AuthFailure = { code?: string; status?: number; name?: string };
export function authMessage(error: AuthFailure): string {
  if (error.code === 'invalid_credentials')
    return 'El correo o la contraseña no son correctos. Revisa tus datos o solicita recuperar la contraseña.';
  if (error.code === 'email_not_confirmed') return 'Debes confirmar tu correo antes de ingresar.';
  if (error.code === 'user_banned')
    return 'Esta cuenta tiene el acceso bloqueado. Contacta al administrador.';
  if (
    error.code === 'over_request_rate_limit' ||
    error.code === 'over_email_send_rate_limit' ||
    error.status === 429
  )
    return 'Se hicieron demasiados intentos. Espera unos minutos antes de volver a intentar.';
  if (error.code === 'same_password') return 'Elige una contraseña distinta de la anterior.';
  if (error.code === 'weak_password')
    return 'La contraseña no cumple los requisitos de seguridad. Usa al menos 12 caracteres.';
  if (
    error.code === 'otp_expired' ||
    error.code === 'flow_state_expired' ||
    error.code === 'flow_state_not_found'
  )
    return 'El enlace venció o ya fue utilizado. Solicita otro enlace de recuperación.';
  if (error.code === 'reauthentication_needed')
    return 'Necesitas un enlace de recuperación nuevo antes de cambiar tu contraseña.';
  if (error.code === 'email_address_not_authorized')
    return 'El envío de correos todavía no está habilitado para esta dirección. Contacta al administrador.';
  return 'El servicio de acceso no está disponible en este momento. Vuelve a intentar en unos minutos.';
}
export function appUrl(path: string) {
  return new URL(path, process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').toString();
}
