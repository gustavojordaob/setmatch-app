import * as Linking from 'expo-linking';

/**
 * Converte URL de share / custom scheme em rota interna do app.
 * Exemplos:
 * - setmatch://torneio/abc123
 * - setmatch://ranking/abc123
 * - https://rallyup.app.br/abrir/torneio?id=abc123
 * - https://rallyup.app.br/abrir/ranking?id=abc123
 */
export function rotaFromIncomingUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null;

  try {
    const parsed = Linking.parse(url);
    const q = parsed.queryParams?.id;
    const idQuery =
      typeof q === 'string' ? q : Array.isArray(q) ? String(q[0] ?? '') : '';

    const host = (parsed.hostname || '').replace(/^\//, '');
    const rawPath = (parsed.path || '').replace(/^\//, '');
    const combined = `${host}/${rawPath}`.replace(/\/+/g, '/');

    if (host === 'torneio' || host === 'ranking') {
      const id = rawPath.split('/')[0] || idQuery;
      if (id) return `/${host}/${id}`;
    }

    const mRanking = combined.match(/(?:^|\/)ranking\/([^/?#]+)/);
    if (mRanking?.[1] && mRanking[1] !== 'abrir') {
      return `/ranking/${mRanking[1]}`;
    }
    if (rawPath.startsWith('ranking/')) {
      const id = rawPath.slice('ranking/'.length).split('/')[0];
      if (id && id !== 'abrir') return `/ranking/${id}`;
    }

    const mTorneio = combined.match(/(?:^|\/)torneio\/([^/?#]+)/);
    if (mTorneio?.[1] && mTorneio[1] !== 'abrir') {
      return `/torneio/${mTorneio[1]}`;
    }
    if (rawPath.startsWith('torneio/')) {
      const id = rawPath.slice('torneio/'.length).split('/')[0];
      if (id && id !== 'abrir') return `/torneio/${id}`;
    }

    if (
      idQuery &&
      (url.includes('/abrir/ranking') ||
        rawPath.includes('abrir/ranking') ||
        combined.includes('abrir/ranking'))
    ) {
      return `/ranking/${idQuery}`;
    }

    if (
      idQuery &&
      (url.includes('/abrir/torneio') ||
        rawPath.includes('abrir/torneio') ||
        combined.includes('abrir/torneio'))
    ) {
      return `/torneio/${idQuery}`;
    }

    if (idQuery && /ranking/i.test(url)) return `/ranking/${idQuery}`;
    if (idQuery && /torneio/i.test(url)) return `/torneio/${idQuery}`;

    return null;
  } catch {
    return null;
  }
}
