import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { AppLocale } from '../i18n';
import { NOTICIAS, type Noticia } from '../constants/noticias';

export type IdiomaNoticia = 'pt' | 'en' | 'es';

export type NoticiaLive = Noticia & {
  url?: string;
  idioma?: IdiomaNoticia;
};

/** pt-BR → pt · en-US → en · es → es */
export function localeToIdiomaNoticia(locale: AppLocale): IdiomaNoticia {
  if (locale === 'en-US') return 'en';
  if (locale === 'es') return 'es';
  return 'pt';
}

/** Fallback estático (pt) se Firestore ainda estiver vazio. */
export function noticiasFallback(esporte: string, idioma: IdiomaNoticia): NoticiaLive[] {
  if (idioma !== 'pt') return [];
  return NOTICIAS.filter((n) => n.esporte === esporte);
}

export function listenNoticiasEsporte(
  esporte: string,
  idioma: IdiomaNoticia,
  onData: (itens: NoticiaLive[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'noticias'),
    where('esporte', '==', esporte),
    where('idioma', '==', idioma),
    orderBy('publicadoEm', 'desc'),
    limit(8)
  );

  return onSnapshot(
    q,
    (snap) => {
      const itens: NoticiaLive[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          titulo: String(data.titulo || ''),
          fonte: String(data.fonte || 'Rally Up'),
          esporte: data.esporte,
          categoria: String(data.categoria || ''),
          url: data.url ? String(data.url) : undefined,
          idioma: data.idioma as IdiomaNoticia | undefined,
        };
      });
      onData(itens.length > 0 ? itens : noticiasFallback(esporte, idioma));
    },
    (err) => {
      onError?.(err);
      onData(noticiasFallback(esporte, idioma));
    }
  );
}
