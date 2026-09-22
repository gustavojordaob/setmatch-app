import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { useAuth } from '../hooks/useAuth';
import { adminHomePath } from '../utils/adminWeb';

const PUBLIC_ROOTS = new Set(['index', '(auth)', 'onboarding', 'baixar', 'admin']);
/** Rotas profundas que o guard NÃO pode roubar (share / notificação). */
const DEEP_ROOTS = new Set([
  'torneio',
  'ranking',
  'desafio',
  'post',
  'chat',
  'jogador',
  'convite-dupla',
  'partida',
  'aula',
  'pagamento',
  'pagamentos',
  'meu-clube',
  'meus-clubes',
  'clube',
  'admin',
]);

function homeFor(isAdmin: boolean, onboardingOk: boolean): string {
  if (isAdmin) return adminHomePath(onboardingOk);
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
        // Site desktop: login admin (sem slides de onboarding de jogador)
        router.replace(Platform.OS === 'web' ? '/(auth)/admin-login' : '/onboarding');
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

    // Deep links / rotas de detalhe — não mandar para home/painel
    if (DEEP_ROOTS.has(root)) {
      if (
        !onboardingComplete &&
        root !== 'clube' &&
        root !== 'wizard' &&
        root !== 'primeiro-acesso' &&
        root !== 'admin'
      ) {
        router.replace(isAdminClube ? adminHomePath(false) : '/primeiro-acesso');
      }
      return;
    }

    if (isAdminClube) {
      if (root === 'wizard' || root === 'primeiro-acesso' || root === 'admin') {
        router.replace(dest);
        return;
      }
      // Web: nunca força onboarding de clube — vai direto ao painel
      if (Platform.OS === 'web' && root === 'clube' && segments[1] === 'onboarding') {
        router.replace('/clube/painel');
        return;
      }
      // Web: entrada sem rota específica → painel (não deixa em rotas vazias)
      if (Platform.OS === 'web' && (root === 'baixar' || root === 'setmatch')) {
        router.replace('/clube/painel');
        return;
      }
      if (root === '(tabs)') {
        const tab = segments[1];
        if (tab === 'notificacoes' || tab === 'mensagens') {
          return;
        }
        router.replace(dest);
        return;
      }
      if (!onboardingComplete && root !== 'clube' && Platform.OS !== 'web') {
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
