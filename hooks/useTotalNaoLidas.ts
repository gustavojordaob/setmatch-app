import { useAuth } from './useAuth';
import { totalNaoLidas, useConversas } from './useConversas';

/** Total de mensagens não lidas (amigo + clube) para o usuário logado. */
export function useTotalNaoLidas(): number {
  const { user } = useAuth();
  const conversas = useConversas();
  return totalNaoLidas(conversas, user?.uid);
}
