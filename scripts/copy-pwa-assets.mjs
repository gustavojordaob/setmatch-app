/**
 * Gera ícones PWA e copia manifest/SW para dist-web após o export.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist-web');
const SOURCE = path.join(ROOT, 'assets', 'icon.png');
const BG = { r: 0, g: 0, b: 0, alpha: 1 }; // preto — alinhado ao logo icon-setmach

async function squareIcon(src, size, logoScale = 0.88) {
  const meta = await sharp(src).metadata();
  const side = Math.min(meta.width ?? size, meta.height ?? size);
  const logoSize = Math.round(size * logoScale);

  const logo = await sharp(src)
    .extract({
      left: Math.floor(((meta.width ?? side) - side) / 2),
      top: Math.floor(((meta.height ?? side) - side) / 2),
      width: side,
      height: side,
    })
    .resize(logoSize, logoSize, { fit: 'contain', background: BG })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

function copyFile(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

async function main() {
  if (!fs.existsSync(DIST)) {
    console.error('dist-web não encontrado. Rode o export web antes.');
    process.exit(1);
  }
  if (!fs.existsSync(SOURCE)) {
    console.error('Ícone não encontrado:', SOURCE);
    process.exit(1);
  }

  const publicIcons = path.join(ROOT, 'public', 'icons');
  const distIcons = path.join(DIST, 'icons');
  fs.mkdirSync(publicIcons, { recursive: true });
  fs.mkdirSync(distIcons, { recursive: true });

  for (const [name, size] of [
    ['pwa-192.png', 192],
    ['pwa-512.png', 512],
    ['apple-touch-icon.png', 180],
  ]) {
    const buf = await squareIcon(SOURCE, size);
    await sharp(buf).toFile(path.join(publicIcons, name));
    await sharp(buf).toFile(path.join(distIcons, name));
  }

  copyFile(
    path.join(ROOT, 'public', 'manifest.webmanifest'),
    path.join(DIST, 'manifest.webmanifest')
  );
  copyFile(path.join(ROOT, 'public', 'sw.js'), path.join(DIST, 'sw.js'));

  for (const folder of ['privacy', 'terms', 'suporte']) {
    const from = path.join(ROOT, 'public', folder, 'index.html');
    const to = path.join(DIST, folder, 'index.html');
    if (fs.existsSync(from)) {
      copyFile(from, to);
    }
  }

  console.log('PWA assets + páginas legais (privacy/terms/suporte) em dist-web.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
