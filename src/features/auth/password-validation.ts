import { z } from 'zod';
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, 'Usa al menos 12 caracteres.')
      .max(128, 'Usa hasta 128 caracteres.'),
    confirmation: z.string(),
  })
  .refine((v) => v.password === v.confirmation, {
    path: ['confirmation'],
    message: 'Las contraseñas no coinciden.',
  });
