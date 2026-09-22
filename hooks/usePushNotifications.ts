import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from './useAuth';
import {
  anexarListenersPush,
  registrarPushToken,
  solicitarPushAposOnboarding,
} from '../services/push';

/** Registra Expo Push Token e deep-link ao tocar no banner. */
export function usePushNotifications() {
  const { user, onboardingComplete } = useAuth();
  const router = useRouter();
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (!user?.uid || !onboardingComplete) return;

    let cancelled = false;

    async function setup() {
      // Mostra Alert + diálogo nativo (iOS e Android) na 1ª vez
      await solicitarPushAposOnboarding(user!.uid);
      if (cancelled) return;
      cleanupRef.current?.();
      cleanupRef.current = await anexarListenersPush({
        onAbrirRota: (rota) => {
          try {
            router.push(rota as never);
          } catch (e) {
            console.warn('[push] rota', e);
          }
        },
      });
    }

    void setup();

    const onAppState = (state: AppStateStatus) => {
      // Só re-registra token se já tiver permissão — não spamma o diálogo
      if (state === 'active') void registrarPushToken(user!.uid);
    };
    const sub = AppState.addEventListener('change', onAppState);

    return () => {
      cancelled = true;
      sub.remove();
      cleanupRef.current?.();
      cleanupRef.current = undefined;
    };
  }, [user?.uid, onboardingComplete, router]);
}
