import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from './useAuth';
import { anexarListenersPush, registrarPushToken } from '../services/push';

/** Registra Expo Push Token e deep-link ao tocar no banner. */
export function usePushNotifications() {
  const { user, onboardingComplete } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user?.uid || !onboardingComplete) return;

    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      await registrarPushToken(user.uid);
      if (cancelled) return;
      cleanup = await anexarListenersPush({
        onAbrirRota: (rota) => {
          try {
            router.push(rota as never);
          } catch (e) {
            console.warn('[push] rota', e);
          }
        },
      });
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [user?.uid, onboardingComplete, router]);
}
