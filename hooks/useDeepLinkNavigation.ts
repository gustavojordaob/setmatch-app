import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useAuth } from './useAuth';
import { rotaFromIncomingUrl } from '../utils/deepLinks';
import {
  consumePendingDeepLink,
  rememberDeepLinkUrl,
} from '../utils/pendingDeepLink';

/**
 * Segue deep links quando o app já está autenticado.
 * Cold start: app/index.tsx navega; se caiu na home (OTA/auth),
 * este hook consome o link pendente.
 */
export function useDeepLinkNavigation() {
  const router = useRouter();
  const { user, loading, onboardingComplete } = useAuth();
  const handledBoot = useRef(false);

  useEffect(() => {
    if (loading || !user || !onboardingComplete) return;

    const go = (url: string | null | undefined) => {
      if (!url) return;
      const rota = rotaFromIncomingUrl(url);
      if (!rota) return;
      setTimeout(() => {
        router.push(rota as never);
      }, 80);
    };

    if (!handledBoot.current) {
      handledBoot.current = true;
      void (async () => {
        const pending = await consumePendingDeepLink();
        if (pending) go(pending);
      })();
    }

    const sub = Linking.addEventListener('url', ({ url }) => {
      void rememberDeepLinkUrl(url);
      go(url);
    });
    return () => sub.remove();
  }, [user, loading, onboardingComplete, router]);
}
