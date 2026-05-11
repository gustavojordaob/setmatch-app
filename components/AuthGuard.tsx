import { useEffect } from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

const PUBLIC_ROOTS = new Set<string>(['index', '(auth)']);

export function AuthGuard() {
  const { user, loading, onboardingComplete } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!navState?.key || loading) return;

    const root = segments[0];
    const inAuth = root === '(auth)';

    if (!user) {
      if (root && !PUBLIC_ROOTS.has(root)) {
        router.replace('/(auth)/login');
      }
      return;
    }

    if (user && inAuth) {
      router.replace(onboardingComplete ? '/(tabs)/home' : '/onboarding');
      return;
    }

    if (user && !onboardingComplete && root !== 'onboarding' && root !== 'index') {
      router.replace('/onboarding');
      return;
    }

    if (user && onboardingComplete && root === 'onboarding') {
      router.replace('/(tabs)/home');
      return;
    }
  }, [user, loading, segments, navState?.key, onboardingComplete, router]);

  return null;
}
