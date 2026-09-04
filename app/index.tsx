import { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import { Colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';

const SPLASH_MS = 1200;
/** Não bloquear splash para sempre se a rede do OTA travar. */
const UPDATES_TIMEOUT_MS = 4000;

function splashLogoSize() {
  const { width, height } = Dimensions.get('window');
  return Math.round(Math.min(width, height) * 0.4);
}

export default function LaunchScreen() {
  const router = useRouter();
  const { user, loading, onboardingComplete, isAdminClube } = useAuth();
  const navigated = useRef(false);
  const [logoSize, setLogoSize] = useState(splashLogoSize);
  const [updatesReady, setUpdatesReady] = useState(
    () => !Updates.isEnabled || __DEV__
  );

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => {
      setLogoSize(splashLogoSize());
    });
    return () => sub.remove();
  }, []);

  // OTA: checa update, mas com timeout — nunca prende a splash.
  // reloadAsync só se houver update (após download).
  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) {
      setUpdatesReady(true);
      return;
    }

    let cancelled = false;
    const watchdog = setTimeout(() => {
      if (!cancelled) setUpdatesReady(true);
    }, UPDATES_TIMEOUT_MS);

    void (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (cancelled) return;
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          if (cancelled) return;
          await Updates.reloadAsync();
          return;
        }
      } catch (e) {
        console.warn('[updates] check/fetch', e);
      } finally {
        clearTimeout(watchdog);
        if (!cancelled) setUpdatesReady(true);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(watchdog);
    };
  }, []);

  useEffect(() => {
    if (!updatesReady || loading || navigated.current) return;

    const timer = setTimeout(() => {
      if (navigated.current) return;
      navigated.current = true;

      if (!user) {
        router.replace('/onboarding');
        return;
      }

      if (isAdminClube) {
        router.replace(onboardingComplete ? '/clube/painel' : '/clube/onboarding');
        return;
      }

      router.replace(onboardingComplete ? '/(tabs)/home' : '/primeiro-acesso');
    }, SPLASH_MS);

    return () => clearTimeout(timer);
  }, [user, loading, onboardingComplete, isAdminClube, router, updatesReady]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/splash-mark.png')}
        style={{ width: logoSize, height: logoSize }}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Rally Up"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
