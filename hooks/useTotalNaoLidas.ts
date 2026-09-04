import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { totalNaoLidas, useConversas } from './useConversas';
import { ouvirNaoLidasCount } from '../services/notificacoes';

/** Mensagens + notificações in-app não lidas (badge do sino). */
export function useTotalNaoLidas(): number {
  const { user } = useAuth();
  const conversas = useConversas();
  const msgs = totalNaoLidas(conversas, user?.uid);
  const [notifs, setNotifs] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setNotifs(0);
      return;
    }
    return ouvirNaoLidasCount(user.uid, setNotifs);
  }, [user?.uid]);

  return msgs + notifs;
}
