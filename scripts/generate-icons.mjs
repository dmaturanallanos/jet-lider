import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
await mkdir('public/icons', { recursive: true });
for (const [name, size, mask] of [
  ['icon-192', 192, false],
  ['icon-512', 512, false],
  ['maskable-512', 512, true],
  ['apple-touch-icon', 180, false],
]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" rx="${mask ? 0 : 95}" fill="#0b121c"/><rect x="${mask ? 112 : 64}" y="${mask ? 112 : 64}" width="${mask ? 288 : 384}" height="${mask ? 288 : 384}" rx="65" fill="#00b8ee"/><text x="238" y="${mask ? 310 : 324}" text-anchor="middle" fill="#052437" font-family="Arial, sans-serif" font-weight="900" font-style="italic" font-size="${mask ? 156 : 205}" letter-spacing="-20">jet</text></svg>`;
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icons/${name}.png`);
}
console.log('PWA icons generated.');
