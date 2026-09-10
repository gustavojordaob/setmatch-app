import { onRequest } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';

const IOS_STORE = 'https://apps.apple.com/br/app/rallyup/id6799449067';
const ANDROID_STORE =
  'https://play.google.com/store/apps/details?id=com.fabricaapps.setmatch';
const DEFAULT_OG =
  'https://setmatch-app-fabrica.web.app/landing/assets/banner-hero.jpg';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/`/g, '');
}

/**
 * Página ponte do share de torneio — HTML com og:image (banner)
 * para preview no WhatsApp + deep link setmatch://torneio/{id}.
 */
export const paginaAbrirTorneio = onRequest(
  { cors: true, region: 'southamerica-east1', invoker: 'public' },
  async (req, res) => {
    const q = typeof req.query.id === 'string' ? req.query.id.trim() : '';
    const pathParts = String(req.path || '')
      .split('/')
      .filter(Boolean);
    const pathId =
      pathParts[0] === 'abrir' && pathParts[1] === 'torneio' && pathParts[2]
        ? decodeURIComponent(pathParts[2])
        : pathParts[0] === 'torneio' && pathParts[1]
          ? decodeURIComponent(pathParts[1])
          : '';
    const id = q || pathId;

    let nome = 'Torneio no Rally Up';
    let clube = '';
    let banner = DEFAULT_OG;

    if (id) {
      try {
        const snap = await getFirestore().doc(`torneios/${id}`).get();
        if (snap.exists) {
          const d = snap.data() || {};
          if (typeof d.nome === 'string' && d.nome.trim()) nome = d.nome.trim();
          if (typeof d.clubeNome === 'string' && d.clubeNome.trim()) {
            clube = d.clubeNome.trim();
          }
          if (typeof d.bannerUrl === 'string' && d.bannerUrl.startsWith('http')) {
            banner = d.bannerUrl;
          }
        }
      } catch (e) {
        console.warn('paginaAbrirTorneio firestore', e);
      }
    }

    const titulo = clube ? `${nome} · ${clube}` : nome;
    const deep = id ? `setmatch://torneio/${encodeURIComponent(id)}` : '';
    const desc = id
      ? 'Abra no app Rally Up para ver e se inscrever. Sem app? Baixe na loja.'
      : 'Link inválido — peça um novo link do torneio.';

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(titulo)} — Rally Up</title>
  <meta name="description" content="${escapeAttr(desc)}" />
  <meta name="robots" content="noindex,nofollow" />
  <meta property="og:title" content="${escapeAttr(titulo)}" />
  <meta property="og:description" content="${escapeAttr(desc)}" />
  <meta property="og:type" content="website" />
  <meta property="og:image" content="${escapeAttr(banner)}" />
  <meta property="og:image:alt" content="${escapeAttr(nome)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(titulo)}" />
  <meta name="twitter:description" content="${escapeAttr(desc)}" />
  <meta name="twitter:image" content="${escapeAttr(banner)}" />
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --primary: #255943; --primary-deep: #163528; --accent: #C7D941;
      --surface: #1A1A1A; --text: #FFFFFF; --text-muted: rgba(255,255,255,.72); --on-accent: #1A1A1A;
    }
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      min-height:100vh;font-family:Outfit,system-ui,sans-serif;color:var(--text);
      background:radial-gradient(ellipse 80% 50% at 50% -10%,rgba(199,217,65,.18),transparent),
        linear-gradient(180deg,var(--primary),var(--primary-deep));
      display:flex;align-items:center;justify-content:center;padding:24px;
    }
    .card{width:100%;max-width:420px;background:var(--surface);border-radius:24px;padding:24px;text-align:center}
    .banner{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:16px;margin-bottom:16px;background:#111}
    h1{font-size:1.25rem;font-weight:800;margin-bottom:8px}
    p{color:var(--text-muted);font-size:.95rem;line-height:1.5;margin-bottom:18px}
    .actions{display:flex;flex-direction:column;gap:10px}
    a.btn{display:block;border-radius:60px;padding:14px 18px;font-weight:700;text-decoration:none;color:inherit}
    a.btn-accent{background:var(--accent);color:var(--on-accent)}
    a.btn-outline{border:1.5px solid rgba(255,255,255,.35)}
    .hint{margin-top:16px;font-size:.8rem;color:var(--text-muted)}
  </style>
</head>
<body>
  <main class="card">
    ${banner ? `<img class="banner" src="${escapeAttr(banner)}" alt="" />` : ''}
    <h1>${escapeHtml(titulo)}</h1>
    <p>${escapeHtml(desc)}</p>
    <div class="actions">
      ${deep ? `<a class="btn btn-accent" id="openApp" href="${escapeAttr(deep)}">Abrir no app</a>` : ''}
      <a class="btn btn-outline" href="${IOS_STORE}" rel="noopener">Baixar na App Store</a>
      <a class="btn btn-outline" href="${ANDROID_STORE}" rel="noopener">Baixar no Google Play</a>
    </div>
    <p class="hint">Rally Up não abre o torneio no navegador.</p>
  </main>
  <script>
    (function(){
      var deep = ${JSON.stringify(deep)};
      if (deep) { window.location.href = deep; }
    })();
  </script>
</body>
</html>`;

    res.set('Cache-Control', 'public, max-age=60');
    res.status(200).send(html);
  }
);
