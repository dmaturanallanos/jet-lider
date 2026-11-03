import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { serverDb } from '@/lib/supabase/server';
import { monday } from '@/utils/dates';
import { paymentSourceSchema, retentionRate } from '@/features/payments/calculations';
import { paymentWorkbook } from '@/features/payments/workbook';
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
        { error: 'Inicia sesión para descargar pagos.' },
        { status: 401, headers },
      );
    const { data: admin } = await db.rpc('is_admin');
    if (!admin)
      return NextResponse.json(
        { error: 'Solo el administrador de este espacio puede exportar pagos.' },
        { status: 403, headers },
      );
    const params = z
      .object({ week: z.iso.date(), issueDate: z.iso.date() })
      .safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!params.success)
      return NextResponse.json(
        { error: 'Selecciona semana y fecha de emisión válidas.' },
        { status: 400, headers },
      );
    const start = monday(params.data.week);
    try {
      retentionRate(params.data.issueDate);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Verifica la tasa de emisión.' },
        { status: 400, headers },
      );
    }
    const { data, error } = await db.rpc('payment_week', { week_start: start });
    if (error)
      return NextResponse.json(
        {
          error: 'No se pudieron cargar los pagos. Revisa la conexión y la migración 202611030014.',
        },
        { status: 503, headers },
      );
    const source = paymentSourceSchema.parse(data);
    let workbook;
    try {
      workbook = paymentWorkbook(start, params.data.issueDate, source);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Revisa los datos de pago.' },
        { status: 422, headers },
      );
    }
    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(new Uint8Array(buffer), {
      headers: {
        ...headers,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="jet-pagos-${start}.xlsx"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo generar la planilla de pagos.' },
      { status: 500, headers },
    );
  }
}
