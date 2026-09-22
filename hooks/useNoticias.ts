import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
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
  const { user } = useAuth();
  const { locale } = useLocale();
  const idioma = localeToIdiomaNoticia(locale);

  const [noticias, setNoticias] = useState<NoticiaLive[]>(() =>
    noticiasFallback(esporte, idioma)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNoticias(noticiasFallback(esporte, idioma));
      setLoading(false);
      return;
    }
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
  }, [esporte, idioma, user]);

  return { noticias, loading };
}
