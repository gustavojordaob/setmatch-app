import { useEffect } from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

const PUBLIC_ROOTS = new Set(['index', '(auth)', 'onboarding']);
const WIZARD_ROOTS = new Set(['primeiro-acesso', 'wizard']);

export function AuthGuard() {
  const { user, loading, onboardingComplete } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!navState?.key || loading) return;

    const root = segments[0];
    const inAuth = root === '(auth)';
    const inOnboardingIntro = root === 'onboarding';
    const inWizard = WIZARD_ROOTS.has(root ?? '');

    if (!user) {
      if (root && !PUBLIC_ROOTS.has(root)) {
        router.replace('/onboarding');
      }
      return;
    }

    if (user && (inAuth || inOnboardingIntro)) {
      router.replace(onboardingComplete ? '/(tabs)/home' : '/primeiro-acesso');
      return;
    }

    if (user && !onboardingComplete && !inWizard && root !== 'index') {
      router.replace('/primeiro-acesso');
      return;
    }

    if (user && onboardingComplete && inWizard) {
      router.replace('/(tabs)/home');
      return;
    }
  }, [user, loading, segments, navState?.key, onboardingComplete, router]);

  return null;
}
