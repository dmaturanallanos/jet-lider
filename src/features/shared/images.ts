import sharp from 'sharp';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export async function safeImage(file: File) {
  if (!file.size || file.size > MAX_IMAGE_BYTES) throw new Error('El límite por imagen es 5 MB.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Usa imágenes JPEG, PNG o WebP.');
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(bytes, { limitInputPixels: 32000000, failOn: 'error' });
    const metadata = await image.metadata();
    const mime = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[
      metadata.format as 'jpeg' | 'png' | 'webp'
    ];
    if (mime !== file.type) throw new Error('Tipo de archivo incorrecto.');
    const result = await image
      .rotate()
      .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 84 })
      .toBuffer();
    if (result.byteLength > MAX_IMAGE_BYTES) throw new Error('Imagen demasiado grande.');
    return result;
  } catch {
    throw new Error('La imagen no es válida o supera 32 megapíxeles.');
  }
}
