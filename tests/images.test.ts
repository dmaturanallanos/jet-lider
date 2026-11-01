import { it, expect } from 'vitest';
import sharp from 'sharp';
import { safeImage, MAX_IMAGE_BYTES } from '@/features/shared/images';
it('valida el contenido real, comprime, redimensiona y quita metadatos', async () => {
  const source = await sharp({
    create: { width: 2500, height: 1200, channels: 3, background: '#00bfff' },
  })
    .png()
    .toBuffer();
  const image = await safeImage(
    new File([new Uint8Array(source)], 'foto.png', { type: 'image/png' }),
  );
  const metadata = await sharp(image).metadata();
  expect(metadata.format).toBe('jpeg');
  expect(metadata.width).toBe(1920);
  expect(metadata.exif).toBeUndefined();
});
it('rechaza archivos falsos aunque declaren un MIME de imagen', async () => {
  await expect(
    safeImage(new File(['<svg>contenido</svg>'], 'fake.jpg', { type: 'image/jpeg' })),
  ).rejects.toThrow(/no es válida/);
});
it('rechaza SVG y fotos mayores al límite', async () => {
  await expect(
    safeImage(new File(['<svg/>'], 'foto.svg', { type: 'image/svg+xml' })),
  ).rejects.toThrow(/JPEG/);
  await expect(
    safeImage(new File([new Uint8Array(MAX_IMAGE_BYTES + 1)], 'foto.jpg', { type: 'image/jpeg' })),
  ).rejects.toThrow(/5 MB/);
});
