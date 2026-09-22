"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paginaAbrirTorneio = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-admin/firestore");
const IOS_STORE = 'https://apps.apple.com/br/app/rallyup/id6799449067';
const ANDROID_STORE = 'https://play.google.com/store/apps/details?id=com.fabricaapps.setmatch';
const DEFAULT_OG = 'https://setmatch-app-fabrica.web.app/landing/assets/banner-hero.jpg';
const SHARE_BASE = 'https://rallyup.app.br';
function escapeHtml(s) {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function escapeAttr(s) {
    return escapeHtml(s).replace(/`/g, '');
}
function parseTorneioId(req) {
    const q = typeof req.query.id === 'string' ? req.query.id.trim() : '';
    const pathParts = String(req.path || '')
        .split('/')
        .filter(Boolean);
    // /abrir/torneio/{id} | /abrir/torneio/og/{id} | /torneio/{id}
    if (pathParts[0] === 'abrir' && pathParts[1] === 'torneio') {
        if (pathParts[2] === 'og' && pathParts[3]) {
            return decodeURIComponent(pathParts[3]);
        }
        if (pathParts[2] && pathParts[2] !== 'og') {
            return decodeURIComponent(pathParts[2]);
        }
    }
    if (pathParts[0] === 'torneio' && pathParts[1]) {
        return decodeURIComponent(pathParts[1]);
    }
    return q;
}
function isOgAssetRequest(req) {
    if (String(req.query.asset || '') === 'og')
        return true;
    const pathParts = String(req.path || '')
        .split('/')
        .filter(Boolean);
    return pathParts[0] === 'abrir' && pathParts[1] === 'torneio' && pathParts[2] === 'og';
}
async function resolveTorneioBanner(id) {
    let nome = 'Torneio no Rally Up';
    let clube = '';
    let banner = DEFAULT_OG;
    if (!id)
        return { nome, clube, banner };
    try {
        const snap = await (0, firestore_1.getFirestore)().doc(`torneios/${id}`).get();
        if (snap.exists) {
            const d = snap.data() || {};
            if (typeof d.nome === 'string' && d.nome.trim())
                nome = d.nome.trim();
            if (typeof d.clubeNome === 'string' && d.clubeNome.trim()) {
                clube = d.clubeNome.trim();
            }
            if (typeof d.bannerUrl === 'string' && d.bannerUrl.startsWith('http')) {
                banner = d.bannerUrl;
            }
            else if (typeof d.logoUrl === 'string' && d.logoUrl.startsWith('http')) {
                banner = d.logoUrl;
            }
        }
    }
    catch (e) {
        console.warn('paginaAbrirTorneio firestore', e);
    }
    return { nome, clube, banner };
}
/**
 * Página ponte do share de torneio — HTML com og:image (banner)
 * para preview no WhatsApp + deep link setmatch://torneio/{id}.
 *
 * og:image aponta para URL no mesmo domínio (?asset=og) — crawlers
 * do WhatsApp falham com frequência em firebasestorage.googleapis.com.
 */
exports.paginaAbrirTorneio = (0, https_1.onRequest)({ cors: true, region: 'southamerica-east1', invoker: 'public' }, async (req, res) => {
    const id = parseTorneioId(req);
    const { nome, clube, banner } = await resolveTorneioBanner(id);
    // Proxy da imagem OG no mesmo domínio (stream) — WhatsApp costuma falhar
    // com og:image apontando direto ao Firebase Storage / redirects longos.
    if (isOgAssetRequest(req)) {
        try {
            const imgRes = await fetch(banner);
            if (!imgRes.ok) {
                res.redirect(302, DEFAULT_OG);
                return;
            }
            const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
            const buf = Buffer.from(await imgRes.arrayBuffer());
            res.set('Cache-Control', 'public, max-age=300');
            res.set('Content-Type', contentType);
            res.set('Content-Length', String(buf.length));
            res.status(200).send(buf);
            return;
        }
        catch (e) {
            console.warn('paginaAbrirTorneio og proxy', e);
            res.redirect(302, DEFAULT_OG);
            return;
        }
    }
    const titulo = clube ? `${nome} · ${clube}` : nome;
    // Sem encode no path — parsers de scheme no Android/iOS tratam melhor.
    const deep = id ? `setmatch://torneio/${id}` : '';
    const intent = id
        ? `intent://torneio/${id}#Intent;scheme=setmatch;package=com.fabricaapps.setmatch;end`
        : '';
    const pageUrl = id
        ? `${SHARE_BASE}/abrir/torneio?id=${encodeURIComponent(id)}`
        : `${SHARE_BASE}/abrir/torneio`;
    // Path sem "&" — crawlers (WhatsApp) quebram com &amp; em og:image.
    const ogImage = id
        ? `${SHARE_BASE}/abrir/torneio/og/${encodeURIComponent(id)}`
        : DEFAULT_OG;
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
  <meta property="og:url" content="${escapeAttr(pageUrl)}" />
  <meta property="og:image" content="${escapeAttr(ogImage)}" />
  <meta property="og:image:secure_url" content="${escapeAttr(ogImage)}" />
  <meta property="og:image:type" content="image/jpeg" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="${escapeAttr(nome)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeAttr(titulo)}" />
  <meta name="twitter:description" content="${escapeAttr(desc)}" />
  <meta name="twitter:image" content="${escapeAttr(ogImage)}" />
  ${deep ? `<meta http-equiv="refresh" content="0;url=${escapeAttr(deep)}" />` : ''}
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
    <img class="banner" src="${escapeAttr(banner)}" alt="" />
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
      var intent = ${JSON.stringify(intent)};
      if (!deep) return;
      var ua = navigator.userAgent || '';
      var isAndroid = /Android/i.test(ua);
      try {
        window.location.href = isAndroid && intent ? intent : deep;
      } catch (e) {}
      setTimeout(function(){
        try { window.location.href = deep; } catch (e2) {}
      }, 400);
    })();
  </script>
</body>
</html>`;
    res.set('Cache-Control', 'public, max-age=60');
    res.status(200).send(html);
});
//# sourceMappingURL=abrirTorneioShare.js.map