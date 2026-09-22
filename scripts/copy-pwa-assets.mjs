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

  // Fontes de ícones em /fonts (fora de assets/node_modules — Hosting ignorava node_modules)
  const ionSrc = path.join(
    ROOT,
    'node_modules',
    '@expo',
    'vector-icons',
    'build',
    'vendor',
    'react-native-vector-icons',
    'Fonts',
    'Ionicons.ttf'
  );
  if (fs.existsSync(ionSrc)) {
    const fontsPublic = path.join(ROOT, 'public', 'fonts');
    const fontsDist = path.join(DIST, 'fonts');
    fs.mkdirSync(fontsPublic, { recursive: true });
    fs.mkdirSync(fontsDist, { recursive: true });
    copyFile(ionSrc, path.join(fontsPublic, 'Ionicons.ttf'));
    copyFile(ionSrc, path.join(fontsDist, 'Ionicons.ttf'));
  }

  for (const folder of ['privacy', 'terms', 'suporte']) {
    const from = path.join(ROOT, 'public', folder, 'index.html');
    const to = path.join(DIST, folder, 'index.html');
    if (fs.existsSync(from)) {
      copyFile(from, to);
    }
  }

  // Landing page (HTML + assets da marca; ignora pasta figma/ com originais brutos)
  const landingFrom = path.join(ROOT, 'public', 'landing');
  const landingTo = path.join(DIST, 'landing');
  if (fs.existsSync(landingFrom)) {
    fs.cpSync(landingFrom, landingTo, {
      recursive: true,
      filter: (src) => !src.includes(`${path.sep}figma${path.sep}`) && !src.endsWith(`${path.sep}figma`),
    });
  }

  // Página ponte app-only (torneio): deep link + lojas — sem SPA Expo
  const abrirFrom = path.join(ROOT, 'public', 'abrir');
  const abrirTo = path.join(DIST, 'abrir');
  if (fs.existsSync(abrirFrom)) {
    fs.cpSync(abrirFrom, abrirTo, { recursive: true });
  }

  // Pontes de retorno Stripe → deep link nativo
  const pagFrom = path.join(ROOT, 'public', 'pagamento');
  const pagTo = path.join(DIST, 'pagamento');
  if (fs.existsSync(pagFrom)) {
    fs.cpSync(pagFrom, pagTo, { recursive: true });
  }

  // Remover rotas Expo /torneio para a rewrite do Hosting servir a ponte
  const torneioDist = path.join(DIST, 'torneio');
  if (fs.existsSync(torneioDist)) {
    fs.rmSync(torneioDist, { recursive: true, force: true });
  }

  // Bloquear SPA web no celular: index vira gate "use o app"
  const gate = path.join(ROOT, 'public', 'app-only.html');
  if (fs.existsSync(gate)) {
    fs.copyFileSync(gate, path.join(DIST, 'index.html'));
    // Evita service worker cacheando SPA antiga
    const swPath = path.join(DIST, 'sw.js');
    fs.writeFileSync(
      swPath,
      `self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))));
});
`
    );
  }

  console.log('PWA assets + landing + abrir + pagamento bridges + app-only gate.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
