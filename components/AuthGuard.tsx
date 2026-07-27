import { useEffect } from 'react';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

const PUBLIC_ROOTS = new Set(['index', '(auth)', 'onboarding']);

function homeFor(isAdmin: boolean, onboardingOk: boolean): string {
  if (isAdmin) return onboardingOk ? '/clube/painel' : '/clube/onboarding';
  return onboardingOk ? '/(tabs)/home' : '/primeiro-acesso';
}

export function AuthGuard() {
  const { user, loading, perfil, onboardingComplete, isAdminClube } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navState = useRootNavigationState();

  useEffect(() => {
    if (!navState?.key || loading) return;

    const root = segments[0];
    // Splash decide sozinho
    if (!root || root === 'index') return;

    if (!user) {
      if (!PUBLIC_ROOTS.has(root)) {
        router.replace('/onboarding');
      }
      return;
    }

    // Sem perfil carregado ainda — não redirecionar (evita flash do wizard)
    if (!perfil) return;

    const dest = homeFor(isAdminClube, onboardingComplete);

    // Logado: nunca slides de onboarding nem telas de auth
    if (root === 'onboarding' || root === '(auth)') {
      router.replace(dest);
      return;
    }

    if (isAdminClube) {
      // Admin nunca entra no wizard / tabs do jogador
      if (
        root === 'wizard' ||
        root === 'primeiro-acesso' ||
        root === '(tabs)'
      ) {
        router.replace(dest);
        return;
      }
      if (!onboardingComplete && root !== 'clube') {
        router.replace('/clube/onboarding');
      }
      return;
    }

    // Jogador
    if (!onboardingComplete) {
      if (root !== 'wizard' && root !== 'primeiro-acesso') {
        router.replace('/primeiro-acesso');
      }
      return;
    }

    if (root === 'wizard' || root === 'primeiro-acesso' || root === 'clube') {
      router.replace('/(tabs)/home');
    }
  }, [
    user,
    loading,
    perfil,
    segments,
    navState?.key,
    onboardingComplete,
    isAdminClube,
    router,
  ]);

  return null;
}
