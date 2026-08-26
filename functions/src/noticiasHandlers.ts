import { createHash } from 'crypto';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';

type EsporteNoticia = 'tenis' | 'padel' | 'raquetinha' | 'beachtennis';
type IdiomaNoticia = 'pt' | 'en' | 'es';

type ItemRss = {
  titulo: string;
  url: string;
  fonte: string;
  publicadoEm: Date | null;
};

const IDIOMAS: IdiomaNoticia[] = ['pt', 'en', 'es'];

const ESPORTES: EsporteNoticia[] = ['tenis', 'padel', 'beachtennis', 'raquetinha'];

const LIMITES: Record<EsporteNoticia, number> = {
  tenis: 6,
  padel: 6,
  beachtennis: 6,
  raquetinha: 4,
};

/** Termos de busca Google News por esporte e idioma */
const QUERIES: Record<EsporteNoticia, Record<IdiomaNoticia, string>> = {
  tenis: {
    pt: 'tênis ATP OR WTA OR "Grand Slam"',
    en: 'tennis ATP OR WTA OR "Grand Slam"',
    es: 'tenis ATP OR WTA OR "Grand Slam"',
  },
  padel: {
    pt: 'padel OR "Premier Padel" OR "World Padel Tour"',
    en: 'padel OR "Premier Padel" OR "World Padel Tour"',
    es: 'padel OR "Premier Padel" OR pádel',
  },
  beachtennis: {
    pt: '"beach tennis" OR beachtennis OR "beach tênis"',
    en: '"beach tennis" OR beachtennis',
    es: '"beach tennis" OR beachtennis OR "tenis de playa"',
  },
  raquetinha: {
    pt: 'raquetinha OR racquetball',
    en: 'racquetball OR squash',
    es: 'racquetball OR raquetbol',
  },
};

const CATEGORIAS: Record<EsporteNoticia, Record<IdiomaNoticia, string>> = {
  tenis: { pt: 'Tênis', en: 'Tennis', es: 'Tenis' },
  padel: { pt: 'Padel', en: 'Padel', es: 'Padel' },
  beachtennis: { pt: 'Beach Tennis', en: 'Beach Tennis', es: 'Beach Tennis' },
  raquetinha: { pt: 'Raquetinha', en: 'Racquetball', es: 'Racquetball' },
};

const GOOGLE_NEWS: Record<
  IdiomaNoticia,
  { hl: string; gl: string; ceid: string }
> = {
  pt: { hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' },
  en: { hl: 'en-US', gl: 'US', ceid: 'US:en' },
  es: { hl: 'es-419', gl: 'MX', ceid: 'MX:es-419' },
};

function googleNewsRss(query: string, idioma: IdiomaNoticia): string {
  const cfg = GOOGLE_NEWS[idioma];
  return (
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}` +
    `&hl=${cfg.hl}&gl=${cfg.gl}&ceid=${cfg.ceid}`
  );
}

/** Feeds extras por idioma (Google News pode retornar 503 em Cloud IPs) */
function feedsExtras(esporte: EsporteNoticia, idioma: IdiomaNoticia): string[] {
  if (idioma === 'en') {
    if (esporte === 'tenis') return ['https://feeds.bbci.co.uk/sport/tennis/rss.xml'];
    if (esporte === 'padel') return ['https://www.padeladdict.com/feed/'];
    const sub: Partial<Record<EsporteNoticia, string>> = {
      tenis: 'tennis',
      padel: 'padel',
      beachtennis: 'beachtennis',
      raquetinha: 'racquetball',
    };
    const reddit = sub[esporte];
    if (reddit) return [`https://www.reddit.com/r/${reddit}/hot/.rss?limit=15`];
  }
  return [];
}

function feedsFor(esporte: EsporteNoticia, idioma: IdiomaNoticia): string[] {
  return [
    googleNewsRss(QUERIES[esporte][idioma], idioma),
    ...feedsExtras(esporte, idioma),
  ];
}

function db() {
  return getFirestore();
}

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .trim();
}

function tagValue(block: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? decodeXml(m[1]) : '';
}

function parseRss(xml: string): ItemRss[] {
  const items: ItemRss[] = [];
  const re = /<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) != null) {
    const block = m[1];
    let titulo = tagValue(block, 'title');
    let url = tagValue(block, 'link') || tagValue(block, 'guid');
    if (!url) {
      const href = block.match(/<link[^>]+href=["']([^"']+)["']/i);
      if (href) url = href[1];
    }
    const pubRaw = tagValue(block, 'pubDate') || tagValue(block, 'updated');
    let fonte = tagValue(block, 'source');
    if (!fonte && titulo.includes(' - ')) {
      const parts = titulo.split(' - ');
      fonte = parts.pop()?.trim() || 'RSS';
      titulo = parts.join(' - ').trim();
    }
    if (!fonte) {
      if (url.includes('bbc.')) fonte = 'BBC Sport';
      else if (url.includes('reddit.com')) fonte = 'Reddit';
      else if (url.includes('padeladdict')) fonte = 'Padel Addict';
      else fonte = 'Google News';
    }
    titulo = titulo.replace(/^\[.*?\]\s*/, '').trim();
    if (!titulo || !url) continue;
    if (titulo.length < 12) continue;
    items.push({
      titulo: titulo.slice(0, 180),
      url,
      fonte: fonte.slice(0, 60),
      publicadoEm: pubRaw ? new Date(pubRaw) : null,
    });
  }
  return items;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchRss(url: string): Promise<ItemRss[]> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; RallyUpBot/1.0; +https://setmatch-app-fabrica.web.app)',
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8,es;q=0.7',
        },
        redirect: 'follow',
      });
      if (!resp.ok) throw new Error(`RSS ${resp.status}`);
      return parseRss(await resp.text());
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      await sleep(400 * (attempt + 1));
    }
  }
  throw lastErr || new Error(`RSS falhou ${url}`);
}

async function coletarItens(urls: string[], limite: number): Promise<{
  items: ItemRss[];
  erros: string[];
}> {
  const seen = new Set<string>();
  const items: ItemRss[] = [];
  const erros: string[] = [];

  for (const url of urls) {
    if (items.length >= limite) break;
    try {
      const batch = await fetchRss(url);
      for (const item of batch) {
        const key = item.titulo.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
        if (items.length >= limite) break;
      }
    } catch (e: unknown) {
      erros.push(`${url}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { items, erros };
}

function docId(esporte: EsporteNoticia, idioma: IdiomaNoticia, titulo: string): string {
  const hash = createHash('sha256')
    .update(`${esporte}|${idioma}|${titulo.toLowerCase()}`)
    .digest('hex');
  return `${esporte}_${idioma}_${hash.slice(0, 20)}`;
}

export async function sincronizarNoticias(): Promise<{
  porChave: Record<string, number>;
  erros: string[];
}> {
  const porChave: Record<string, number> = {};
  const erros: string[] = [];
  const agora = FieldValue.serverTimestamp();
  const keepIds = new Set<string>();

  for (const idioma of IDIOMAS) {
    for (const esporte of ESPORTES) {
      const chave = `${esporte}_${idioma}`;
      const limite = LIMITES[esporte];
      const urls = feedsFor(esporte, idioma);

      try {
        const { items, erros: feedErros } = await coletarItens(urls, limite);
        erros.push(...feedErros.map((e) => `${chave} · ${e}`));

        let gravados = 0;
        for (const item of items) {
          const id = docId(esporte, idioma, item.titulo);
          keepIds.add(id);
          await db()
            .collection('noticias')
            .doc(id)
            .set(
              {
                titulo: item.titulo,
                fonte: item.fonte,
                esporte,
                idioma,
                categoria: CATEGORIAS[esporte][idioma],
                url: item.url,
                publicadoEm: item.publicadoEm || FieldValue.serverTimestamp(),
                atualizadoEm: agora,
                origem: 'rss_auto',
              },
              { merge: true }
            );
          gravados += 1;
        }
        porChave[chave] = gravados;
        if (gravados === 0) {
          erros.push(`${chave}: nenhum item após todos os feeds`);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        erros.push(`${chave}: ${msg}`);
        porChave[chave] = 0;
      }
    }
  }

  const corte = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const antigas = await db()
    .collection('noticias')
    .where('origem', 'in', ['rss_auto', 'google_news_rss'])
    .get();

  const batch = db().batch();
  let deletes = 0;
  for (const docSnap of antigas.docs) {
    if (keepIds.has(docSnap.id)) continue;
    const data = docSnap.data();
    const atualizado = data.atualizadoEm?.toDate?.() as Date | undefined;
    const semIdioma = !data.idioma;
    if (semIdioma || !atualizado || atualizado < corte) {
      batch.delete(docSnap.ref);
      deletes += 1;
    }
  }
  if (deletes > 0) await batch.commit();

  await db().doc('config/noticiasSync').set(
    {
      ultimaSyncEm: FieldValue.serverTimestamp(),
      porChave,
      erros,
      deletes,
    },
    { merge: true }
  );

  return { porChave, erros };
}

/** 08:00 e 20:00 (Brasília) — 2x por dia */
export const atualizarNoticias = onSchedule(
  {
    schedule: '0 8,20 * * *',
    timeZone: 'America/Sao_Paulo',
    region: 'southamerica-east1',
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async () => {
    const result = await sincronizarNoticias();
    console.log('atualizarNoticias', JSON.stringify(result));
    const ok = Object.values(result.porChave).some((n) => n > 0);
    if (!ok) {
      throw new Error(`Falha total ao sincronizar notícias: ${result.erros.join('; ')}`);
    }
  }
);

export const atualizarNoticiasManual = onRequest(
  { cors: true, region: 'southamerica-east1', timeoutSeconds: 300, memory: '512MiB' },
  async (req, res) => {
    if (req.method !== 'POST' && req.method !== 'GET') {
      res.status(405).json({ ok: false, error: 'Método não permitido' });
      return;
    }
    try {
      const result = await sincronizarNoticias();
      const ok = Object.values(result.porChave).some((n) => n > 0);
      res.status(ok ? 200 : 502).json({ ok, ...result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro';
      console.error('atualizarNoticiasManual', e);
      res.status(500).json({ ok: false, error: msg });
    }
  }
);
