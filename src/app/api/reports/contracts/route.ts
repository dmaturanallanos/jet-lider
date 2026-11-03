import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { serverDb } from '@/lib/supabase/server';
import { monthStart, monthlySourceSchema } from '@/features/payments/monthly-calculations';
import { monthlyWorkbook } from '@/features/payments/monthly-workbook';
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
        { error: 'Inicia sesión para descargar contratos.' },
        { status: 401, headers },
      );
    const { data: admin } = await db.rpc('is_admin');
    if (!admin)
      return NextResponse.json(
        { error: 'Solo el administrador de este espacio puede exportar.' },
        { status: 403, headers },
      );
    const parsed = z.iso.date().safeParse(request.nextUrl.searchParams.get('month'));
    if (!parsed.success)
      return NextResponse.json({ error: 'Selecciona un mes válido.' }, { status: 400, headers });
    const month = monthStart(parsed.data),
      { data, error } = await db.rpc('contract_payment_month', { month_start: month });
    if (error)
      return NextResponse.json(
        {
          error: 'No se pudieron cargar los sueldos. Revisa la conexión y migración 202611030015.',
        },
        { status: 503, headers },
      );
    const source = monthlySourceSchema.parse(data);
    let book;
    try {
      book = monthlyWorkbook(month, source);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'Completa los sueldos.' },
        { status: 422, headers },
      );
    }
    return new Response(new Uint8Array(await book.xlsx.writeBuffer()), {
      headers: {
        ...headers,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="jet-contratos-${month.slice(0, 7)}.xlsx"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'No se pudo generar el informe mensual.' },
      { status: 500, headers },
    );
  }
}
