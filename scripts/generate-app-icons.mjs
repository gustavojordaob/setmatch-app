/**
 * Gera ícones do app no padrão Apple Guidelines (PDF RALLY_UP):
 * marca limão sobre fundo floresta #255943.
 *
 * Fonte preferida: assets/icon.png (já no padrão).
 * Fallback: assets/icon-setmach.png / assets/Vector.png
 *
 * Uso: node scripts/generate-app-icons.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CANDIDATES = [
  path.join(ROOT, 'assets', 'icon.png'),
  path.join(ROOT, 'assets', 'icon-setmach.png'),
  path.join(ROOT, 'assets', 'Vector.png'),
];
const BG_BRAND = { r: 37, g: 89, b: 67, alpha: 1 }; // #255943
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

function resolveSrc() {
  return CANDIDATES.find((p) => fs.existsSync(p));
}

async function squareOnBg(src, size, bg, logoScale = 0.92) {
  const logoSize = Math.round(size * logoScale);
  const logo = await sharp(src)
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
  const SRC = resolveSrc();
  if (!SRC) {
    console.error('Falta assets/icon.png (ou icon-setmach.png / Vector.png)');
    process.exit(1);
  }

  // icon / adaptive / splash: cópia quadrada 1024 no padrão da marca
  const master = await sharp(SRC)
    .resize(1024, 1024, { fit: 'cover', position: 'centre' })
    .png()
    .toBuffer();

  await sharp(master).toFile(path.join(ROOT, 'assets', 'icon.png'));
  await sharp(master).toFile(path.join(ROOT, 'assets', 'adaptive-icon.png'));
  await sharp(master).toFile(path.join(ROOT, 'assets', 'splash-icon.png'));
  await sharp(master).resize(192, 192).toFile(path.join(ROOT, 'assets', 'favicon.png'));

  const publicIcons = path.join(ROOT, 'public', 'icons');
  fs.mkdirSync(publicIcons, { recursive: true });
  for (const [name, size] of [
    ['pwa-192.png', 192],
    ['pwa-512.png', 512],
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
  ]) {
    await sharp(master).resize(size, size).toFile(path.join(publicIcons, name));
  }

  // Vector in-app: mark em fundo transparente (se a fonte for o icon cheio, usa contain em brand)
  if (path.basename(SRC) !== 'Vector.png') {
    const vectorBuf = await squareOnBg(SRC, 512, TRANSPARENT, 0.88);
    // Se SRC já é o icon com fundo verde, extrair só não ajuda sem chroma-key —
    // mantém Vector existente quando já válido.
    console.log('Vector.png preservado (edite manualmente se precisar reexportar o mark)');
  }

  console.log(`Ícones alinhados ao padrão Rally Up (#255943) a partir de ${path.basename(SRC)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
