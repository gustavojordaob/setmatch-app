import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { Button } from '../components/ui/Button';
import { ButtonFooter } from '../components/ui/ButtonFooter';
import { useAuth } from '../hooks/useAuth';
import { useT } from '../hooks/useI18n';

export default function PrimeiroAcessoScreen() {
  const router = useRouter();
  const t = useT();
  const { user, loading, isAdminClube, onboardingComplete, signOut } = useAuth();
  const [saindo, setSaindo] = useState(false);
  const nome = user?.displayName?.split(' ')[0] ?? 'Jogador';

  useEffect(() => {
    if (loading) return;
    if (isAdminClube) {
      router.replace(onboardingComplete ? '/clube/painel' : '/clube/onboarding');
      return;
    }
    if (onboardingComplete) {
      router.replace('/(tabs)/home');
    }
  }, [loading, isAdminClube, onboardingComplete, router]);

  async function handleSair() {
    Alert.alert(t('primeiroAcesso.exitTitle'), t('primeiroAcesso.exitBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('primeiroAcesso.exitConfirm'),
        style: 'destructive',
        onPress: async () => {
          setSaindo(true);
          try {
            await signOut();
            router.replace('/(auth)/login');
          } catch {
            Alert.alert(t('common.error'), t('common.logoutFailed'));
          } finally {
            setSaindo(false);
          }
        },
      },
    ]);
  }

  // Evita flash do wizard enquanto o perfil ainda carrega
  if (loading || isAdminClube || onboardingComplete) {
    return <View style={styles.safe} />;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>{t('primeiroAcesso.welcomeName', { name: nome })}</Text>
        <Text style={styles.sub}>{t('primeiroAcesso.subtitle')}</Text>
      </View>
      <ButtonFooter style={styles.ctaFooter}>
        <Button label={t('primeiroAcesso.cta')} onPress={() => router.push('/wizard/idade')} />
        <Button
          label={t('primeiroAcesso.exit')}
          variant="outline"
          onPress={handleSair}
          loading={saindo}
          style={styles.exitBtn}
        />
      </ButtonFooter>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background, alignItems: 'stretch' },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sub: {
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 20,
    fontSize: 16,
  },
  ctaFooter: { paddingHorizontal: 24, gap: 12 },
  exitBtn: { marginTop: 4 },
});
