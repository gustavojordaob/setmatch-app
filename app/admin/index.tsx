import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { useAuth } from '../../hooks/useAuth';
import { adminHomePath } from '../../utils/adminWeb';

/**
 * Entrada do site admin (desktop).
 * URL: /admin → login ou painel. Sem onboarding de jogador.
 */
export default function AdminEntryScreen() {
  const { user, loading, perfil, onboardingComplete, isAdminClube } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/(auth)/admin-login');
      return;
    }
    if (!perfil) return;
    if (!isAdminClube) {
      // Jogador no site admin → app do jogador (mobile/PWA)
      router.replace(onboardingComplete ? '/(tabs)/home' : '/primeiro-acesso');
      return;
    }
    router.replace(adminHomePath(onboardingComplete));
  }, [user, loading, perfil, isAdminClube, onboardingComplete, router]);

  if (Platform.OS !== 'web') {
    return <Redirect href="/(auth)/admin-login" />;
  }

  return (
    <View style={styles.box}>
      <ActivityIndicator size="large" color={Colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
