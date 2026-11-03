'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { requireAdmin, requireSession } from '@/features/auth/session';
import { adminDb } from '@/lib/supabase/admin';
import { workerImpact } from '@/features/workers/actions';
import {
  absenceSchema,
  entrySchema,
  id,
  shiftSchema,
  taskSchema,
  workerSchema,
} from './validation';
import type { Json } from '@/types/database';
export type ActionResult = { ok: boolean; message: string };
function check(error: { message: string; code?: string } | null) {
  if (!error) return;
  const messages: Record<string, string> = {
    '23P01': 'El horario se superpone con otro turno activo de la misma persona.',
    '23503':
      'Un registro relacionado ya no está disponible o conserva registros asociados. Recarga los datos.',
    '23514': 'Revisa los datos: fechas, duración, descanso y campos obligatorios.',
    '42501': 'No tienes permiso para realizar esta operación.',
    '40P01': 'Otra operación está modificando estos registros. Recarga y vuelve a intentar.',
    '40001': 'Los datos cambiaron durante la operación. Recarga y vuelve a intentar.',
    '22007': 'La fecha o el horario no son válidos.',
    '22008': 'La fecha no existe. Revisa el período seleccionado.',
  };
  if (error.code === '23505')
    throw new Error(
      error.message.includes('unique_worker_email')
        ? 'Ese correo ya está registrado en otro trabajador.'
        : error.message.includes('unique_active_shift_occurrence')
          ? 'Ya existe un turno igual en ese horario. Revisa los registros antes de copiar o repetir.'
          : 'Ya existe un registro con estos datos. Revisa el correo o la vinculación.',
    );
  throw new Error(
    messages[error.code ?? ''] ??
      (error.message === 'FORBIDDEN' ? 'No tienes permiso para esta operación.' : error.message),
  );
}
export async function mutate(action: string, input: unknown): Promise<ActionResult> {
  try {
    const { db, user, profile } = await requireSession();
    switch (action) {
      case 'administrator-add': {
        await requireAdmin();
        const v = z
          .object({
            email: z.email().max(320),
            name: z.string().trim().min(2).max(120),
            confirmed: z.literal(true),
          })
          .parse(input);
        const { error } = await db.rpc('grant_administrator', {
          account_email: v.email.trim(),
          administrator_name: v.name,
        });
        if (error?.code === 'PGRST202')
          throw new Error(
            'Falta aplicar la migración 202611020011 en Supabase. No se otorgaron permisos.',
          );
        check(error);
        break;
      }
      case 'worker': {
        await requireAdmin();
        const v = workerSchema.parse(input);
        if (v.id && !v.active) {
          const impact = await workerImpact(v.id);
          if ((impact.shifts || impact.tasks) && !v.acknowledge)
            throw new Error(
              `Tiene ${impact.shifts} turnos futuros y ${impact.tasks} tareas abiertas. Confirma que gestionarás estos pendientes antes de desactivar.`,
            );
        }
        const { error } = await db.rpc('save_worker', {
          payload: v,
          private_data: { email: v.email, phone: v.phone, notes: v.notes },
          expected_version: v.version,
        });
        check(error);
        break;
      }
      case 'invite': {
        await requireAdmin();
        const v = z.object({ worker_id: id }).parse(input);
        const { data: w, error: we } = await db
          .from('workers')
          .select('active')
          .eq('id', v.worker_id)
          .single();
        check(we);
        if (!w?.active) throw new Error('Trabajador inactivo.');
        const { data: details } = await db
          .from('worker_private_details')
          .select('email')
          .eq('id', v.worker_id)
          .single();
        if (!details?.email)
          throw new Error('Agrega un correo válido en la ficha antes de invitar.');
        const { data: existing } = await db
          .from('worker_invitations')
          .select('*')
          .eq('worker_id', v.worker_id)
          .maybeSingle();
        if (existing && existing.email !== details.email)
          throw new Error(
            'La invitación está vinculada a otro correo. Resuelve el vínculo desde Supabase antes de cambiarlo.',
          );
        const { error: reserve } = await db
          .from('worker_invitations')
          .upsert(
            { worker_id: v.worker_id, email: details.email },
            { onConflict: 'worker_id', ignoreDuplicates: true },
          );
        check(reserve);
        const privileged = adminDb();
        // Service-only lookup and binding is atomic and validates auth.users.email.
        const lookup = () => privileged.rpc('invitee_account', { target_worker: v.worker_id });
        const prior = await lookup();
        check(prior.error);
        if (prior.data) {
          const { error } = await db.auth.signInWithOtp({
            email: details.email,
            options: {
              shouldCreateUser: false,
              emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
            },
          });
          check(error);
        } else {
          const { error } = await privileged.auth.admin.inviteUserByEmail(details.email, {
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
          });
          if (error) {
            const retry = await lookup();
            if (!retry.data) {
              await db
                .from('worker_invitations')
                .update({ status: 'failed' })
                .eq('worker_id', v.worker_id);
              throw error;
            }
          }
          const linked = await lookup();
          check(linked.error);
          if (!linked.data)
            throw new Error('Correo enviado; falta vincular. Reintenta la invitación.');
        }
        break;
      }
      case 'shifts': {
        await requireAdmin();
        const v = z
          .object({
            request_id: id,
            items: z.array(shiftSchema).min(1).max(500),
            series_description: z.string().max(300).optional(),
          })
          .parse(input);
        const { error } = await db.rpc('save_shift_batch', { ...v, items: v.items as Json });
        check(error);
        break;
      }
      case 'shift-delete': {
        await requireAdmin();
        const v = z.object({ id, version: z.number().int().positive() }).parse(input);
        const { data, error } = await db
          .from('shifts')
          .delete()
          .eq('id', v.id)
          .eq('version', v.version)
          .select('id');
        if (error?.code === '23503')
          throw new Error(
            'Este turno está relacionado con la bitácora. Cancélalo para conservar esos registros.',
          );
        check(error);
        if (!data?.length)
          throw new Error(
            'El turno cambió o ya fue eliminado. Cierra el detalle y recarga el calendario antes de intentar de nuevo.',
          );
        break;
      }
      case 'absence': {
        await requireAdmin();
        const v = absenceSchema.parse(input);
        const { error } = await db.rpc('save_absence', {
          payload: v,
          private_note: v.private_note,
        });
        check(error);
        break;
      }
      case 'absence-delete': {
        await requireAdmin();
        const v = z.object({ id, version: z.number().int() }).parse(input);
        const { data, error } = await db
          .from('worker_absences')
          .delete()
          .eq('id', v.id)
          .eq('version', v.version)
          .select('id');
        check(error);
        if (!data?.length) throw new Error('CONFLICT: ausencia modificada.');
        break;
      }
      case 'task': {
        await requireAdmin();
        const v = taskSchema.parse(input);
        const { error } = await db.rpc('save_task', {
          payload: v,
          assignees: v.assignees,
          expected_version: v.version,
        });
        check(error);
        break;
      }
      case 'task-status': {
        const v = z
          .object({
            id,
            version: z.number().int(),
            status: z.enum(['pending', 'in_progress', 'completed', 'cancelled']),
          })
          .parse(input);
        const { data, error } = await db
          .from('tasks')
          .update({ status: v.status })
          .eq('id', v.id)
          .eq('version', v.version)
          .select('id');
        check(error);
        if (!data?.length)
          throw new Error('CONFLICT: tarea modificada o sin permiso. Recarga los datos.');
        break;
      }
      case 'comment': {
        const v = z.object({ task_id: id, body: z.string().trim().min(1).max(5000) }).parse(input);
        const { error } = await db.from('task_comments').insert({ ...v, created_by: user.id });
        check(error);
        break;
      }
      case 'entry': {
        const v = entrySchema.parse(input);
        const { id: entryId, version, ...values } = v;
        if (profile.role !== 'admin' && (values.visibility !== 'team' || values.pinned))
          throw new Error('Sin permiso para registros privados o fijados.');
        if (entryId) {
          const { data, error } = await db
            .from('logbook_entries')
            .update(values)
            .eq('id', entryId)
            .eq('version', version ?? 0)
            .select('id');
          check(error);
          if (!data?.length) throw new Error('CONFLICT: registro modificado o sin permiso.');
        } else {
          const { error } = await db
            .from('logbook_entries')
            .insert({ ...values, created_by: user.id });
          check(error);
        }
        break;
      }
      case 'profile': {
        const v = z.object({ display_name: z.string().trim().min(2).max(120) }).parse(input);
        const { error } = await db.from('profiles').update(v).eq('id', user.id);
        check(error);
        break;
      }
      case 'shift-type': {
        await requireAdmin();
        const v = z
          .object({
            name: z.string().trim().min(2).max(60),
            color: z.string().regex(/^#[\da-fA-F]{6}$/),
          })
          .parse(input);
        const { error } = await db.from('shift_types').insert(v);
        check(error);
        break;
      }
      default:
        throw new Error('Operación desconocida.');
    }
    revalidatePath('/', 'layout');
    return {
      ok: true,
      message:
        action === 'administrator-add'
          ? 'Permisos de administrador otorgados. La persona puede ingresar con su propia cuenta.'
          : action === 'shift-delete'
            ? 'Turno eliminado. Se conservó el registro en el historial.'
            : action === 'invite'
              ? 'Invitación procesada. Revisa el correo y el estado de acceso.'
              : 'Cambios guardados correctamente.',
    };
  } catch (error) {
    unstable_rethrow(error);
    const msg =
      error instanceof z.ZodError
        ? error.issues.map((i) => i.message).join(' ')
        : error instanceof Error
          ? error.message
          : 'No se pudo completar la operación.';
    return { ok: false, message: msg };
  }
}
