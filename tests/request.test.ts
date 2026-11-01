import { it, expect } from 'vitest';
import { limitedForm } from '@/lib/request';
it('rechaza un cuerpo grande aunque no declare Content-Length', async () => {
  const r = new Request('http://localhost/api/files', {
    method: 'POST',
    body: new Uint8Array(1025),
  });
  await expect(limitedForm(r, 1024)).rejects.toThrow(/límite/);
});
it('preserva los campos del formulario dentro del límite', async () => {
  const form = new FormData();
  form.set('parent', 'abc');
  const r = new Request('http://localhost/api/files', { method: 'POST', body: form });
  expect((await limitedForm(r)).get('parent')).toBe('abc');
});
