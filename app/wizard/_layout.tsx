import { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';

export default function WizardLayout() {
  const router = useRouter();
  const { loading, perfil, isAdminClube, onboardingComplete } = useAuth();

  useEffect(() => {
    if (loading || !perfil) return;
    if (isAdminClube) {
      router.replace(onboardingComplete ? '/clube/painel' : '/clube/onboarding');
      return;
    }
    if (onboardingComplete) {
      router.replace('/(tabs)/home');
    }
  }, [loading, perfil, isAdminClube, onboardingComplete, router]);

  // Não mostra idade/wizard até o perfil estar pronto — evita flash no login
  if (loading || !perfil || isAdminClube || onboardingComplete) {
    return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  );
}
