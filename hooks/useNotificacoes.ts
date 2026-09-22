import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  ouvirNaoLidasCount,
  ouvirNotificacoes,
  type NotificacaoApp,
} from '../services/notificacoes';

export function useNotificacoes(): {
  itens: NotificacaoApp[];
  naoLidas: number;
  loading: boolean;
} {
  const { user } = useAuth();
  const [itens, setItens] = useState<NotificacaoApp[]>([]);
  const [naoLidas, setNaoLidas] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setItens([]);
      setNaoLidas(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = ouvirNotificacoes(user.uid, (lista) => {
      setItens(lista);
      setLoading(false);
    });
    const unsubCount = ouvirNaoLidasCount(user.uid, setNaoLidas);
    return () => {
      unsub();
      unsubCount();
    };
  }, [user?.uid]);

  return { itens, naoLidas, loading };
}
