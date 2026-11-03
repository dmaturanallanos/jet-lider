import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { serverDb } from '@/lib/supabase/server';
import { monday } from '@/utils/dates';
import { attendanceWorkbook, reportRowsSchema } from '@/features/shifts/weekly-report';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  const headers = {
    'Cache-Control': 'private, no-store',
    Vary: 'Cookie',
    'X-Content-Type-Options': 'nosniff',
  };
  try {
    const db = await serverDb();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return NextResponse.json(
        { error: 'Inicia sesión para descargar el informe.' },
        { status: 401, headers },
      );
    const { data: admin, error: permissionError } = await db.rpc('is_admin');
    if (permissionError || !admin)
      return NextResponse.json(
        { error: 'Solo el administrador de este espacio puede exportar.' },
        { status: 403, headers },
      );
    const date = z.iso.date().safeParse(request.nextUrl.searchParams.get('week'));
    if (!date.success)
      return NextResponse.json(
        { error: 'Selecciona una fecha válida para la semana.' },
        { status: 400, headers },
      );
    const start = monday(date.data);
    const { data, error } = await db.rpc('attendance_week', { week_start: start });
    if (error)
      return NextResponse.json(
        {
          error:
            error.code === 'PGRST202'
              ? 'Falta aplicar la migración 202611030013.'
              : 'No se pudo consultar el informe. Revisa la conexión y vuelve a intentar.',
        },
        { status: 503, headers },
      );
    const workbook = await attendanceWorkbook(start, reportRowsSchema.parse(data));
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        ...headers,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="jet-asistencia-${start}.xlsx"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo generar el Excel. Intenta nuevamente.' },
      { status: 500, headers },
    );
  }
}
