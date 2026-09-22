import { Platform } from 'react-native';

/** Admin no navegador desktop (site web, sem fluxo mobile/onboarding). */
export function isAdminWeb(): boolean {
  return Platform.OS === 'web';
}

/** Destino pós-login / splash para admin. Na web nunca manda para onboarding. */
export function adminHomePath(onboardingOk: boolean): '/clube/painel' | '/clube/onboarding' {
  if (isAdminWeb()) return '/clube/painel';
  return onboardingOk ? '/clube/painel' : '/clube/onboarding';
}

/** Logout / sessão expirada na web → login admin (não slides de onboarding). */
export function adminLogoutPath(): '/(auth)/admin-login' | '/onboarding' {
  return isAdminWeb() ? '/(auth)/admin-login' : '/onboarding';
}
