import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuth } from '../../hooks/useAuth';
import { useT } from '../../hooks/useI18n';

export default function EsqueciSenhaScreen() {
  const router = useRouter();
  const { resetPassword } = useAuth();
  const t = useT();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function enviar() {
    if (!email.trim()) {
      Alert.alert(t('auth.email'), t('auth.emailRequired'));
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email);
      Alert.alert(t('auth.resetSentTitle'), t('auth.resetSentBody'));
      router.back();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('auth.sendFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>{t('auth.forgotTitle')}</Text>
          <Text style={styles.sub}>{t('auth.forgotSubtitle')}</Text>

          <Input
            label={t('auth.emailAddress')}
            placeholder={t('auth.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Button label={t('auth.sendLink')} onPress={enviar} loading={loading} />

          <Text style={styles.back} onPress={() => router.back()}>
            {t('auth.backToLogin')}
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 24, paddingTop: 32, gap: 20 },
  title: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sub: {
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 15,
    opacity: 0.95,
  },
  back: {
    color: Colors.accent,
    textAlign: 'center',
    fontWeight: 'bold',
    textDecorationLine: 'underline',
    marginTop: 8,
  },
});
