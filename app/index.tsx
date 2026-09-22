import { useEffect, useRef, useState } from 'react';
import { Dimensions, Image, Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { Colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { rotaFromIncomingUrl } from '../utils/deepLinks';
import {
  consumePendingDeepLink,
  rememberDeepLinkUrl,
} from '../utils/pendingDeepLink';
import { adminHomePath } from '../utils/adminWeb';

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

  // Captura deep link cedo — sobrevive se o OTA der reloadAsync().
  useEffect(() => {
    void Linking.getInitialURL().then((url) => {
      void rememberDeepLinkUrl(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      void rememberDeepLinkUrl(url);
    });
    return () => sub.remove();
  }, []);

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
        // Garante que o link de abertura já foi persistido antes do reload.
        const initial = await Linking.getInitialURL();
        await rememberDeepLinkUrl(initial);

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

      void (async () => {
        try {
          const pending = await consumePendingDeepLink();
          const initial = pending || (await Linking.getInitialURL());
          const deep = rotaFromIncomingUrl(initial);
          if (deep && user && onboardingComplete) {
            router.replace(deep as never);
            return;
          }
          // Se ainda não autenticou, re-guarda para o hook pós-login.
          if (deep && initial) await rememberDeepLinkUrl(initial);
        } catch (e) {
          console.warn('[launch] deep link', e);
        }

        if (!user) {
          // Web = site admin (desktop). Mobile = onboarding do jogador.
          router.replace(Platform.OS === 'web' ? '/(auth)/admin-login' : '/onboarding');
          return;
        }

        if (isAdminClube) {
          router.replace(adminHomePath(onboardingComplete));
          return;
        }

        router.replace(onboardingComplete ? '/(tabs)/home' : '/primeiro-acesso');
      })();
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
