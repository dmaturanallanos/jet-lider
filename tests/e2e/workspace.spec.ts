import { test, expect } from '@playwright/test';
test('el ingreso admite contraseñas existentes de menos de doce caracteres', async ({ page }) => {
  await page.goto('/acceso');
  await page.getByText('Usar contraseña de mi cuenta', { exact: true }).click();
  const password = page.getByLabel('Contraseña', { exact: true });
  await password.fill('ocho1234');
  expect(await password.evaluate((input: HTMLInputElement) => input.validity.tooShort)).toBe(false);
  await expect(page.getByRole('button', { name: 'Olvidé mi contraseña' })).toBeVisible();
});
test('la recuperación sin enlace no permite cambiar una contraseña', async ({ page }) => {
  await page.goto('/restablecer-contrasena');
  await expect(page.getByRole('heading', { name: 'Restablecer contraseña' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Abre el enlace de recuperación');
  await expect(page.getByRole('button', { name: 'Guardar nueva contraseña' })).toHaveCount(0);
});
test('un enlace de recuperación dirigido al inicio se lleva a la pantalla correcta y limpia sus tokens', async ({
  page,
}) => {
  await page.route('**/auth/v1/**', (route) =>
    route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'invalid_token', msg: 'Test token' }),
    }),
  );
  await page.goto('/#type=recovery&access_token=test-only-invalid&refresh_token=test-only-invalid');
  await expect(page.getByRole('heading', { name: 'Restablecer contraseña' })).toBeVisible();
  await expect.poll(() => new URL(page.url()).hash).toBe('');
  await expect(page.getByRole('button', { name: 'Guardar nueva contraseña' })).toHaveCount(0);
});
test('acceso cerrado y sin registro público', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/acceso/);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByText('Sin registro público.')).toBeVisible();
});
test('navegación operativa responsive sin desbordamiento de página', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const view of [
    '',
    'turnos',
    'tareas',
    'bitacora',
    'equipo',
    'pagos',
    'configuracion',
    'mas',
  ]) {
    await page.goto(`/demo/${view}?date=2026-11-02`);
    await expect(page.getByText('Demostración · solo lectura.', { exact: false })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const size = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
    }));
    expect(size.scroll, view).toBeLessThanOrEqual(size.width + 1);
    if (view === 'turnos')
      await page.screenshot({
        path: `artifacts/calendario-${info.project.name}.png`,
        fullPage: true,
      });
  }
  expect(errors).toEqual([]);
});
test('calendario permite navegar y consultar día, mes y cuadrícula', async ({ page }) => {
  await page.goto('/demo/turnos?date=2026-11-02');
  await page.getByRole('link', { name: 'Día', exact: true }).click();
  await expect(page).toHaveURL(/mode=day/);
  await expect(page.getByRole('heading', { name: /lunes,? 2 de noviembre/i })).toBeVisible();
  await page.getByRole('link', { name: 'Mes', exact: true }).click();
  await expect(page.locator('.monthgrid')).toBeVisible();
  await page.getByRole('link', { name: 'Cuadrícula', exact: true }).click();
  await expect(page.locator('table.calendar')).toBeVisible();
  await expect(page.getByRole('columnheader', { name: /Equipo/ })).toBeVisible();
});
test('demostración no presenta mutaciones ficticias como guardadas', async ({ page }) => {
  await page.goto('/demo/turnos?date=2026-11-02');
  await page.getByRole('button', { name: 'Nuevo turno', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Demostración de solo lectura.' }),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('el detalle ofrece eliminar turno y la demostración impide borrados', async ({ page }) => {
  await page.goto('/demo/turnos?date=2026-11-02&mode=grid');
  await page.locator('button.shift').first().click();
  await page.getByRole('button', { name: 'Eliminar turno', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Demostración de solo lectura.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar eliminación' })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toBeVisible();
});
test('asistencia diaria, Excel y borrado de observaciones están disponibles y la demo no guarda', async ({
  page,
}) => {
  await page.goto('/demo/turnos?date=2020-11-02&mode=day');
  await expect(page.getByRole('button', { name: 'Excel semanal de asistencia' })).toBeVisible();
  await page.locator('button.shift').first().click();
  await expect(
    page.getByRole('heading', { name: 'Asistencia del turno', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Resultado de asistencia').selectOption('present');
  await page.getByRole('button', { name: 'Guardar asistencia', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Demostración de solo lectura.' }),
  ).toBeVisible();
  await page.goto('/demo/bitacora?date=2020-11-02');
  await page.locator('a.panel.note').first().click();
  await page.getByRole('button', { name: 'Eliminar observación', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Demostración de solo lectura.' }),
  ).toBeVisible();
});
test('Excel requiere sesión y no devuelve información privada sin autenticar', async ({
  request,
}) => {
  const result = await request.get('/api/reports/attendance?week=2020-11-02');
  expect(result.status()).toBe(401);
  expect(result.headers()['cache-control']).toContain('no-store');
});
test('pagos muestra tarifas líquidas, HE manuales y contratos sin guardar datos ficticios', async ({
  page,
}) => {
  await page.goto('/demo/pagos?date=2026-11-02');
  await expect(
    page.getByRole('heading', { name: 'Preparación de pagos', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('$28.500 líquidos por día', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver tasa SII', exact: true })).toHaveAttribute(
    'href',
    'https://www.sii.cl/destacados/boletas_honorarios/index.html',
  );
  await page.getByRole('button', { name: 'Preparar pago', exact: true }).first().click();
  await expect(page.getByLabel('Horas extra completas')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar preparación de pago', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Demostración de solo lectura.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.getByRole('button', { name: 'Preparar pago', exact: true }).nth(1).click();
  await expect(
    page.getByLabel('Líquido de contrato informado (CLP, incluye sus HE)'),
  ).toBeVisible();
});
test('planilla de pagos rechaza descargas sin sesión', async ({ request }) => {
  const response = await request.get('/api/reports/payments?week=2026-11-02&issueDate=2026-11-03');
  expect(response.status()).toBe(401);
  expect(response.headers()['cache-control']).toContain('no-store');
});
test('tareas con detalle accesible y tablero', async ({ page }) => {
  await page.goto('/demo/tareas?date=2026-11-02');
  await page.getByRole('link', { name: /Preparar despacho de primera ruta/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Comentarios' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'Tablero', exact: true }).click();
  await expect(page.locator('.boardcol')).toHaveCount(4);
});
test('administradores muestra el alcance de permisos y exige confirmación explícita', async ({
  page,
}) => {
  await page.goto('/demo/configuracion');
  await expect(
    page.getByRole('heading', { name: 'Espacios independientes', exact: true }),
  ).toBeVisible();
  await page.getByLabel('Nombre del nuevo administrador').fill('Administrador de prueba');
  await page.getByLabel('Correo de su cuenta').fill('test@example.test');
  const confirm = page.getByRole('checkbox', { name: /Confirmo que esta persona/ });
  await expect(confirm).not.toBeChecked();
  await confirm.check();
  await page.getByRole('button', { name: 'Agregar administrador', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Demostración de solo lectura.' }),
  ).toBeVisible();
});
test('tema persiste y la PWA no almacena respuestas operativas', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/demo/configuracion');
  await page.getByLabel('Tema visual').selectOption('dark');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const urls: string[] = [];
    for (const k of keys) {
      for (const r of await (await caches.open(k)).keys()) urls.push(new URL(r.url).pathname);
    }
    return urls;
  });
  expect(cached).toContain('/offline.html');
  expect(cached.every((x) => x === '/offline.html' || x.startsWith('/icons/'))).toBe(true);
  const manifest = await context.request.get('/manifest.webmanifest');
  expect((await manifest.json()).display).toBe('standalone');
  for (const size of [192, 512])
    expect((await context.request.get(`/icons/icon-${size}.png`)).ok()).toBe(true);
  expect(errors).toEqual([]);
});
test('sin conexión muestra aviso y navegación segura de respaldo', async ({ page, context }) => {
  await page.goto('/demo');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await context.setOffline(true);
  await expect(page.getByText(/Sin conexión. Necesitas internet/)).toBeVisible();
  await page.goto('/demo/turnos');
  await expect(page.getByRole('heading', { name: 'Sin conexión', exact: true })).toBeVisible();
  await context.setOffline(false);
});
