import { useEffect, useState } from 'react';
import { useLocale } from './useI18n';
import {
  listenNoticiasEsporte,
  localeToIdiomaNoticia,
  noticiasFallback,
  type NoticiaLive,
} from '../services/noticias';

export function useNoticias(esporte: string): {
  noticias: NoticiaLive[];
  loading: boolean;
} {
  const { locale } = useLocale();
  const idioma = localeToIdiomaNoticia(locale);

  const [noticias, setNoticias] = useState<NoticiaLive[]>(() =>
    noticiasFallback(esporte, idioma)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = listenNoticiasEsporte(
      esporte,
      idioma,
      (itens) => {
        setNoticias(itens);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [esporte, idioma]);

  return { noticias, loading };
}
