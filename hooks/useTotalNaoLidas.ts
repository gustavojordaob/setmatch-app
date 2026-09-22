import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { totalNaoLidas, useConversas } from './useConversas';
import { ouvirNaoLidasCount } from '../services/notificacoes';

export type ContagemNaoLidas = {
  mensagens: number;
  notificacoes: number;
  total: number;
};

/** Mensagens e notificações in-app separadas (evita badge falso no chat). */
export function useContagemNaoLidas(): ContagemNaoLidas {
  const { user } = useAuth();
  const conversas = useConversas();
  const mensagens = totalNaoLidas(conversas, user?.uid);
  const [notificacoes, setNotificacoes] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setNotificacoes(0);
      return;
    }
    return ouvirNaoLidasCount(user.uid, setNotificacoes);
  }, [user?.uid]);

  return {
    mensagens,
    notificacoes,
    total: mensagens + notificacoes,
  };
}

/** Soma msgs + notifs (badge do sino / BottomNav). */
export function useTotalNaoLidas(): number {
  return useContagemNaoLidas().total;
}
