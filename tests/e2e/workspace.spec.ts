import { test, expect } from '@playwright/test';
test('acceso cerrado y sin registro público', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/acceso/);
  await expect(page.getByRole('heading', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByText('Sin registro público.')).toBeVisible();
});
test('navegación operativa responsive sin desbordamiento de página', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const view of ['', 'turnos', 'tareas', 'bitacora', 'equipo', 'configuracion', 'mas']) {
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
test('tema persiste y la PWA no almacena respuestas operativas', async ({ page, context }) => {
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
