import { z } from 'zod';
export const reportRowsSchema = z
  .array(
    z.object({
      id: z.uuid(),
      worker_id: z.uuid().nullable(),
      worker_name: z.string(),
      starts_at: z.iso.datetime({ offset: true }),
      ends_at: z.iso.datetime({ offset: true }),
      break_minutes: z.number().int().nonnegative(),
      shift_status: z.enum(['scheduled', 'confirmed', 'cancelled']),
      shift_type: z.string(),
      location: z.string(),
      attendance_status: z.enum(['present', 'absent']).nullable(),
      attendance_notes: z.string(),
      marked_at: z.string().nullable(),
      marked_by: z.string(),
    }),
  )
  .max(10000);
export type ReportRow = z.infer<typeof reportRowsSchema>[number];
