import { z } from 'zod';
export const id = z.uuid();
const optional = z.string().max(5000).optional().default('');
export const workerSchema = z.object({
  request_id: z.uuid().optional(),
  id: id.optional(),
  version: z.number().int().positive().optional(),
  full_name: z.string().trim().min(2).max(120),
  nickname: z.string().max(80).default(''),
  job_title: z.string().max(120).default(''),
  color: z.string().regex(/^#[\da-fA-F]{6}$/),
  active: z.boolean().default(true),
  acknowledge: z.boolean().default(false),
  joined_on: z.string().default(''),
  email: z.union([z.email(), z.literal('')]).default(''),
  phone: z.string().max(40).default(''),
  notes: optional,
  employment_type: z.enum(['boleta', 'contrato']).nullable().optional(),
});
export const shiftSchema = z
  .object({
    id: id.optional(),
    version: z.number().int().positive().optional(),
    worker_id: z.union([id, z.literal('')]).nullable(),
    type_id: id,
    starts_at: z.iso.datetime({ offset: true }),
    ends_at: z.iso.datetime({ offset: true }),
    break_minutes: z.number().int().min(0),
    location: z.string().max(160).default(''),
    notes: optional,
    status: z.enum(['scheduled', 'confirmed', 'cancelled']).default('scheduled'),
  })
  .superRefine((s, ctx) => {
    const duration = (Date.parse(s.ends_at) - Date.parse(s.starts_at)) / 60000;
    if (duration <= 0)
      ctx.addIssue({ code: 'custom', message: 'El término debe ser posterior al inicio.' });
    if (s.break_minutes > duration)
      ctx.addIssue({ code: 'custom', message: 'El descanso supera la duración del turno.' });
  });
export const taskSchema = z.object({
  id: id.optional(),
  version: z.number().int().positive().optional(),
  title: z.string().trim().min(2).max(180),
  description: optional,
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
  due_at: z.string().default(''),
  location: z.string().max(160).default(''),
  assignees: z.array(id).max(100),
});
export const entrySchema = z.object({
  id: id.optional(),
  version: z.number().int().positive().optional(),
  title: z.string().trim().min(2).max(180),
  description: z.string().min(1).max(10000),
  type: z.string().min(1).max(80),
  period: z.enum(['day', 'week']),
  entry_date: z.iso.date(),
  visibility: z.enum(['team', 'admin']),
  pinned: z.boolean().default(false),
  worker_id: id.nullable().default(null),
  shift_id: id.nullable().default(null),
  task_id: id.nullable().default(null),
});
export const absenceSchema = z
  .object({
    worker_id: id,
    type: z.string().min(1).max(80),
    all_day: z.boolean(),
    start_date: z.string().default(''),
    end_date: z.string().default(''),
    starts_at: z.string().default(''),
    ends_at: z.string().default(''),
    shared_note: optional,
    private_note: optional,
  })
  .superRefine((a, c) => {
    if (
      a.all_day
        ? !/^\d{4}-\d{2}-\d{2}$/.test(a.start_date) || a.end_date < a.start_date
        : !(Date.parse(a.ends_at) > Date.parse(a.starts_at))
    )
      c.addIssue({ code: 'custom', message: 'Revisa el período de la ausencia.' });
  });
