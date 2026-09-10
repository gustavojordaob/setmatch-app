import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useAuth } from './useAuth';
import { rotaFromIncomingUrl } from '../utils/deepLinks';

/**
 * Quando o app já está aberto (ou volta do background), segue o deep link
 * setmatch://torneio/… sem cair na home.
 */
export function useDeepLinkNavigation() {
  const router = useRouter();
  const { user, loading, onboardingComplete } = useAuth();
  const handledInitial = useRef(false);

  useEffect(() => {
    if (loading || !user || !onboardingComplete) return;

    const go = (url: string) => {
      const rota = rotaFromIncomingUrl(url);
      if (rota) router.push(rota as never);
    };

    if (!handledInitial.current) {
      handledInitial.current = true;
      void Linking.getInitialURL().then((url) => {
        // Launch screen já trata cold start; aqui só se ainda estamos em home/painel
        // e o URL inicial não foi consumido — listener cobre app em foreground.
        if (url) {
          /* cold start: app/index.tsx já redireciona */
        }
      });
    }

    const sub = Linking.addEventListener('url', ({ url }) => go(url));
    return () => sub.remove();
  }, [user, loading, onboardingComplete, router]);
}
