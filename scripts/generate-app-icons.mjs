/**
 * Gera ícones do app a partir de assets/icon-setmach.png
 * Uso: node scripts/generate-app-icons.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'assets', 'icon-setmach.png');
const BG_BLACK = { r: 0, g: 0, b: 0, alpha: 1 };
const BG_BRAND = { r: 37, g: 89, b: 67, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function squareOnBg(size, bg, logoScale = 0.92) {
  const logoSize = Math.round(size * logoScale);
  const logo = await sharp(SRC)
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: TRANSPARENT,
    })
    .png()
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: bg },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(SRC)) {
    console.error('Falta assets/icon-setmach.png');
    process.exit(1);
  }

  await sharp(await squareOnBg(1024, BG_BLACK, 0.96)).toFile(
    path.join(ROOT, 'assets', 'icon.png')
  );
  await sharp(await squareOnBg(1024, TRANSPARENT, 0.72)).toFile(
    path.join(ROOT, 'assets', 'adaptive-icon.png')
  );
  await sharp(await squareOnBg(1024, BG_BRAND, 0.55)).toFile(
    path.join(ROOT, 'assets', 'splash-icon.png')
  );
  await sharp(await squareOnBg(192, BG_BLACK, 0.96))
    .resize(48, 48)
    .toFile(path.join(ROOT, 'assets', 'favicon.png'));

  const publicIcons = path.join(ROOT, 'public', 'icons');
  fs.mkdirSync(publicIcons, { recursive: true });
  for (const [name, size] of [
    ['pwa-192.png', 192],
    ['pwa-512.png', 512],
    ['apple-touch-icon.png', 180],
  ]) {
    await sharp(await squareOnBg(size, BG_BLACK, 0.96)).toFile(
      path.join(publicIcons, name)
    );
  }

  console.log('Ícones gerados de icon-setmach.png → icon, adaptive, splash, favicon, PWA');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
