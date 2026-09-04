/**
 * Gera ícones do app no padrão Apple Guidelines (PDF RALLY_UP):
 * marca limão sobre fundo floresta #255943 — sem moldura/borda.
 *
 * Extrai só os pixels da marca (Vector.png), descarta fundo preto e halo.
 *
 * Uso: node scripts/generate-app-icons.mjs
 * Nativo Android: npm run icons:android
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const VECTOR = path.join(ROOT, 'assets', 'Vector.png');
const BG_BRAND = { r: 37, g: 89, b: 67, alpha: 1 }; // #255943
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** True se o pixel é a marca limão #C7D941 (não fundo, halo cinza nem moldura). */
function isLime(r, g, b, a) {
  if (a < 40) return false;
  // limão real: alto G, R médio-alto, B baixo
  return g > 160 && r > 140 && b < 100 && g > b + 80 && r > b + 40;
}

/** Extrai só a marca limão com fundo transparente + crop ao conteúdo. */
async function extractMarkPng(srcPath) {
  const { data, info } = await sharp(srcPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.from(data);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let count = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (isLime(r, g, b, a)) {
        count++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      } else {
        out[i] = 0;
        out[i + 1] = 0;
        out[i + 2] = 0;
        out[i + 3] = 0;
      }
    }
  }

  if (count === 0) {
    throw new Error(`Nenhum pixel limão em ${path.basename(srcPath)}`);
  }

  // padding 4% para antialias
  const pad = Math.max(4, Math.round(Math.max(maxX - minX, maxY - minY) * 0.04));
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(width - 1, maxX + pad);
  maxY = Math.min(height - 1, maxY + pad);

  return sharp(out, { raw: { width, height, channels: 4 } })
    .extract({
      left: minX,
      top: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    })
    .png()
    .toBuffer();
}

/** Marca limpa centralizada sobre fundo sólido da marca (sem squircle/borda). */
async function markOnBrand(markPng, size, logoScale) {
  const logoSize = Math.round(size * logoScale);
  const logo = await sharp(markPng)
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: TRANSPARENT,
    })
    .png()
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background: BG_BRAND },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(VECTOR)) {
    console.error('Falta assets/Vector.png (fonte da marca)');
    process.exit(1);
  }

  const markPng = await extractMarkPng(VECTOR);
  // Marca só — transparente — usada na tela JS (sem borda)
  await sharp(markPng).toFile(path.join(ROOT, 'assets', 'splash-mark.png'));

  // Home / adaptive: marca ~66% (safe zone Android)
  const iconMaster = await markOnBrand(markPng, 1024, 0.66);
  await sharp(iconMaster).toFile(path.join(ROOT, 'assets', 'icon.png'));
  await sharp(iconMaster).toFile(path.join(ROOT, 'assets', 'adaptive-icon.png'));
  await sharp(iconMaster).resize(192, 192).toFile(path.join(ROOT, 'assets', 'favicon.png'));

  // Splash nativo Android 12: marca ~70% no canvas verde (preenche o círculo do sistema)
  const splashMaster = await markOnBrand(markPng, 1024, 0.7);
  await sharp(splashMaster).toFile(path.join(ROOT, 'assets', 'splash-icon.png'));

  const publicIcons = path.join(ROOT, 'public', 'icons');
  fs.mkdirSync(publicIcons, { recursive: true });
  for (const [name, size] of [
    ['pwa-192.png', 192],
    ['pwa-512.png', 512],
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
  ]) {
    await sharp(iconMaster).resize(size, size).toFile(path.join(publicIcons, name));
  }

  console.log(
    'Ícones Rally Up (#255943) — marca limpa sem borda (splash-mark + splash scale 0.7). Rode: npm run icons:android'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
